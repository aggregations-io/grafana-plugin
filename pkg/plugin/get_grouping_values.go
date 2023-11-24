package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (d *handler) queryGroupings(_ context.Context, password string, Ctx backend.PluginContext, query backend.DataQuery, qo QueryOptions) backend.DataResponse {
	var response backend.DataResponse

	client := &http.Client{
		Timeout: time.Second * 10, // Set an appropriate timeout value
	}

	payloadbytes, err := json.Marshal(qo)
	if err != nil {
		response.Error = err
		return response
	}

	request, err := http.NewRequest("POST", url_base+"metrics/groupings", bytes.NewBuffer(payloadbytes))

	if err != nil {
		response.Error = err
		return response
	}
	request.Header.Set("x-api-token", password)
	request.Header.Set("Content-Type", "application/json")

	http_response, err := client.Do(request)
	if err != nil {
		response.Error = err
		return response
	}
	defer http_response.Body.Close()

	if http_response.StatusCode != 200 {
		body, err := io.ReadAll(http_response.Body)
		if err != nil {
			response.Error = err
			return response
		}
		//backend.Logger.Warn(http_response.Status)
		response.Error = fmt.Errorf("Error fetching results %d / %q", http_response.StatusCode, string(body))
		return response
	}

	frame2 := data.NewFrameOfFieldTypes("response", 0, data.FieldTypeString, data.FieldTypeString)
	if qo.IncludeAggregateOption {
		frame2.AppendRow("$__agg", "Aggregate All")
	}

	body, err := io.ReadAll(http_response.Body)
	if err != nil {
		response.Error = err
		return response
	}
	//backend.Logger.Info(string(body))
	var grpings []GroupingResult
	if err := json.Unmarshal(body, &grpings); err != nil {
		response.Error = err
		return response
	}

	for _, gr := range grpings {
		frame2.AppendRow(gr.Value, gr.Value)
	}

	response.Frames = append(response.Frames, frame2)
	return response
}
