package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/ahmetb/go-linq/v3"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces- only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*handler)(nil)
	_ backend.CheckHealthHandler    = (*handler)(nil)
	_ instancemgmt.InstanceDisposer = (*handler)(nil)
)

type handler struct {
	instanceManager instancemgmt.InstanceManager
}

func New(fn datasource.InstanceFactoryFunc) datasource.ServeOpts {
	h := &handler{instanceManager: datasource.NewInstanceManager(fn)}

	// CallResourceHandler
	mux := http.NewServeMux()
	mux.HandleFunc("/filterDefinitions", h.GetFilterDefinitions)

	// QueryDataHandler
	queryTypeMux := datasource.NewQueryTypeMux()
	queryTypeMux.HandleFunc("query", h.QueryData)
	queryTypeMux.HandleFunc("", h.QueryData)

	return datasource.ServeOpts{
		CheckHealthHandler:  h,
		CallResourceHandler: httpadapter.New(mux),
		QueryDataHandler:    queryTypeMux,
	}
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *handler) Dispose() {
	// Clean up datasource instance resources.
}

type qos_return struct {
	had_err  bool
	q        backend.DataQuery
	qo       *QueryOptions
	is_valid bool
	err      error
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *handler) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	api_token := req.PluginContext.DataSourceInstanceSettings.DecryptedSecureJSONData["apiKey"]

	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.

	var qos []qos_return

	linq.From(req.Queries).Select(func(q interface{}) interface{} {
		var this_qo QueryOptions
		err := json.Unmarshal(q.(backend.DataQuery).JSON, &this_qo)
		var ret qos_return
		ret.err = err
		if err == nil {
			this_qo.StartTime = q.(backend.DataQuery).TimeRange.From.UTC().Format(time.RFC3339)
			this_qo.EndTime = q.(backend.DataQuery).TimeRange.To.UTC().Format(time.RFC3339)
			ret.had_err = false
			this_qo.QueryId = (q.(backend.DataQuery).RefID)
			this_qo.Optimized = true
			ret.q = q.(backend.DataQuery)
			ret.qo = &this_qo
			ret.is_valid = !(this_qo.FilterId == "" || (this_qo.Calculation == PERCENTILES && (!this_qo.Percentile.Valid || this_qo.Percentile.Float64 <= 0 || this_qo.Percentile.Float64 > 1)))
			if this_qo.Mode == "variables" {
				ret.is_valid = ret.is_valid && this_qo.SpecificGrouping != ""
			}
		} else {
			ret.had_err = true

		}
		return ret
	}).ToSlice(&qos)

	var ok_ct = 0
	for q := range qos {
		if !qos[q].had_err && qos[q].is_valid {
			ok_ct++
		}
	}

	fast_mode := qos[0].qo.FastMode

	var indiv []qos_return
	if fast_mode {
		var to_combine []QueryOptions

		for q := range qos {
			var this_q = qos[q]
			if this_q.had_err {
				response.Responses[this_q.q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", this_q.err.Error()))
			} else if this_q.qo.Hide.Bool {
				var blank_response backend.DataResponse
				response.Responses[this_q.q.RefID] = blank_response
			} else if !this_q.is_valid {
				var blank_response backend.DataResponse
				if this_q.qo.FilterId != "" {
					blank_response.Error = fmt.Errorf("Invalid Query %q", this_q.q.RefID)
				}
				response.Responses[this_q.q.RefID] = blank_response
			} else {
				if this_q.qo.Mode == "variables" {
					indiv = append(indiv, this_q)
				} else {

					to_combine = append(to_combine, *this_q.qo)
				}
			}
		}

		if len(to_combine) > 0 {
			var fres = d.queryMulti(ctx, api_token, req.PluginContext, to_combine)
			for id, resp := range fres {
				//backend.Logger.Info(fmt.Sprintf("Got %s - %d rows", id, len(resp.Frames)))
				response.Responses[id] = *resp
			}
		}

	} else {
		indiv = qos
	}

	for q := range indiv {
		var this_q = indiv[q]
		if this_q.had_err {
			response.Responses[this_q.q.RefID] = backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", this_q.err.Error()))
		} else if this_q.qo.Hide.Bool {
			var blank_response backend.DataResponse
			response.Responses[this_q.q.RefID] = blank_response
		} else if !this_q.is_valid {
			var blank_response backend.DataResponse
			blank_response.Error = fmt.Errorf("Invalid Query %q", this_q.q.RefID)
			response.Responses[this_q.q.RefID] = blank_response

		} else {
			var res backend.DataResponse
			if this_q.qo.Mode == "variables" {
				res = d.queryGroupings(ctx, api_token, req.PluginContext, this_q.q, *this_q.qo)
			} else {
				res = *d.queryMulti(ctx, api_token, req.PluginContext, []QueryOptions{*this_q.qo})[this_q.q.RefID]
			}
			response.Responses[this_q.q.RefID] = res
		}
	}

	return response, nil
}

const url_base = "https://app.aggregations.io/api/v1/"

//const url_base = "http://host.docker.internal:5060/api/v1/"

func (d *handler) queryMulti(_ context.Context, password string, Ctx backend.PluginContext, qos []QueryOptions) map[string]*backend.DataResponse {

	var response = make(map[string]*backend.DataResponse)

	var qos_map = make(map[string]QueryOptions)

	for q := range qos {
		var this_q = qos[q]
		var this_response backend.DataResponse
		response[this_q.QueryId] = &this_response
		qos_map[this_q.QueryId] = this_q
	}

	PrintJson(qos_map)
	client := &http.Client{
		Timeout: time.Second * 10, // Set an appropriate timeout value
	}

	payloadbytes, err := json.Marshal(qos)
	if err != nil {
		SetError(err, qos, response)
		return response
	}
	request, err := http.NewRequest("POST", url_base+"metrics/results?multi=true", bytes.NewBuffer(payloadbytes))
	if err != nil {
		SetError(err, qos, response)
		return response
	}
	request.Header.Set("x-api-token", password)
	request.Header.Set("Content-Type", "application/json")

	http_response, err := client.Do(request)
	if err != nil {
		SetError(err, qos, response)
		return response
	}
	defer http_response.Body.Close()

	if http_response.StatusCode != 200 {
		body, err := io.ReadAll(http_response.Body)
		if err != nil {
			SetError(err, qos, response)
			return response
		}
		//backend.Logger.Warn(http_response.Status)
		SetError(fmt.Errorf("Error fetching results %q / %q", http_response.Status, string(body)), qos, response)
		return response
	}

	set_frames := make(map[string]bool)
	frames := make(map[string]*data.Frame)
	names := make(map[string][]string)
	finals := make(map[string][]MetricResultVal)

	iSlice := func(is ...interface{}) []interface{} {
		s := make([]interface{}, len(is))
		copy(s, is)
		return s
	}
	for q := range qos {
		var this_q = qos[q]
		set_frames[this_q.QueryId] = false
		frames[this_q.QueryId] = data.NewFrameOfFieldTypes("response", 0, data.FieldTypeTime, data.FieldTypeFloat64)
		names[this_q.QueryId] = make([]string, 2)
		var this_finals []MetricResultVal
		finals[this_q.QueryId] = this_finals

	}

	body, err := io.ReadAll(http_response.Body)
	if err != nil {
		SetError(err, qos, response)
		return response
	}

	var metrics []MetricResult
	if err := json.Unmarshal(body, &metrics); err != nil {
		SetError(err, qos, response)
		return response
	}

	current_dt_start := time.Unix(0, 0)
	current_groupings := map[string]string{}

	var single_q = len(qos) == 1
	for _, mr := range metrics {
		if !mr.IsSeperator.Valid && single_q {
			mr.QueryId.SetValid(qos[0].QueryId)
		}
		if mr.QueryId.Valid && !set_frames[mr.QueryId.String] && current_dt_start != time.Unix(0, 0) {
			set_frames[mr.QueryId.String] = true
			PrintJson(set_frames)
			var this_names = make([]string, 2+len(current_groupings))

			data_types := make([]data.FieldType, len(this_names))
			this_names[0] = "time"
			data_types[0] = data.FieldTypeTime
			currk := 1
			for k := range current_groupings {
				data_types[currk] = data.FieldTypeString
				this_names[currk] = k
				currk++
			}
			this_names[currk] = qos_map[mr.QueryId.String].FilterDefinitionName

			if qos_map[mr.QueryId.String].Alias != "" {
				this_names[currk] = qos_map[mr.QueryId.String].Alias
			}
			PrintJson(this_names)
			names[mr.QueryId.String] = this_names
			data_types[currk] = data.FieldTypeFloat64
			this_frame := data.NewFrameOfFieldTypes("Long", 0, data_types...).SetMeta(&data.FrameMeta{
				Type:        data.FrameTypeTimeSeriesLong,
				TypeVersion: data.FrameTypeVersion{0, 0},
			})

			this_frame.SetFieldNames(this_names...)
			this_frame.Meta = &data.FrameMeta{}
			frames[mr.QueryId.String] = this_frame
		}
		if mr.IsSeperator.Bool {
			current_dt_start = mr.Dt.Time
			current_groupings = *mr.Groupings
			continue
		} else {
			mrv := MetricResultVal{Dt: current_dt_start.Add(time.Second * time.Duration(mr.DtSecLater)), Val: mr.Val, Groupings: current_groupings, QueryId: mr.QueryId.String}
			finals[mr.QueryId.String] = append(finals[mr.QueryId.String], mrv)
		}

	}
	//backend.Logger.Info("SORTING?")
	for q := range qos {
		var this_q = qos[q]
		sort.Slice(finals[this_q.QueryId][:], func(i, j int) bool {
			return finals[this_q.QueryId][i].Dt.Before(finals[this_q.QueryId][j].Dt)
		})
		for _, mrv := range finals[this_q.QueryId] {
			rr := iSlice(mrv.Dt)
			for k := range names[this_q.QueryId] {
				if k > 0 && k < len(names[this_q.QueryId])-1 {
					val, ok := mrv.Groupings[names[this_q.QueryId][k]]
					if ok {
						rr = append(rr, val)
					} else {
						rr = append(rr, "")
					}
				}
			}
			rr = append(rr, mrv.Val)
			//PrintJson(rr)
			frames[this_q.QueryId].AppendRow(rr...)
		}
		ProcessFramesFromMR(set_frames[this_q.QueryId], response[this_q.QueryId], qos_map[this_q.QueryId], names[this_q.QueryId], frames[this_q.QueryId], len(qos))
	}
	return response
}

func SetError(err error, qos []QueryOptions, response map[string]*backend.DataResponse) {
	//backend.Logger.Error(err.Error())
	for q := range qos {
		var this_q = qos[q]
		response[this_q.QueryId].Error = err
	}
}

func ProcessFramesFromMR(set_frames bool, response *backend.DataResponse, qo QueryOptions, names []string, frame2 *data.Frame, num_queries int) bool {
	if set_frames {
		if !qo.LongResult.Bool && len(names) > 2 {
			w, err := data.LongToWide(frame2, &data.FillMissing{Mode: data.FillModeNull})
			if err != nil {
				response.Error = err
				return false
			}
			for f := range w.Fields {
				var dn strings.Builder

				if num_queries > 1 {
					dn.WriteString(names[len(names)-1])
					dn.WriteString(": ")
				}
				var lbls = w.Fields[f].Labels
				if lbls != nil {

					keys := make([]string, len(lbls))
					i := 0
					for k := range lbls {
						keys[i] = k
						i++
					}
					sort.Strings(keys)
					i = 0
					for _, k := range keys {
						if qo.IncludeGroupingLabels {
							dn.WriteString(k)
							dn.WriteString("=")
						}
						if lbls[k] == "" {
							dn.WriteString("\"\"")
						} else {
							dn.WriteString(lbls[k])
						}
						if i != len(keys)-1 {
							dn.WriteString(", ")
						}
						i++
					}

					w.Fields[f].Config = &data.FieldConfig{DisplayNameFromDS: dn.String()}
				}

			}
			response.Frames = append(response.Frames, w)
		} else {
			response.Frames = append(response.Frames, frame2)
		}

	}
	return true
}

func parseResponseData(responseData []byte) ([]MetricResult, error) {
	var results []MetricResult
	err := json.Unmarshal(responseData, &results)
	if err != nil {
		return nil, err
	}
	return results, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *handler) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	pluginCtx := req.PluginContext
	api_token := pluginCtx.DataSourceInstanceSettings.DecryptedSecureJSONData["apiKey"]
	client := &http.Client{
		Timeout: time.Second * 10, // Set an appropriate timeout value
	}

	request, err := http.NewRequest("GET", url_base+"organization/ping", nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Error",
		}, nil
	}
	request.Header.Set("x-api-token", api_token)
	request.Header.Set("Content-Type", "application/json")
	http_response, err := client.Do(request)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Error",
		}, nil
	}
	if http_response.StatusCode == 401 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Invalid API Key",
		}, nil
	}
	if http_response.StatusCode == 200 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "Data source is working",
		}, nil
	}
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusError,
		Message: "Other Error, try again",
	}, nil

}

func PrintJson(v any) {
	b := new(strings.Builder)
	json.NewEncoder(b).Encode(v)
	//backend.Logger.Info(b.String())
}
