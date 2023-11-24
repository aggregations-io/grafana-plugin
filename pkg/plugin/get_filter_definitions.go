package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (d *handler) GetFilterDefinitions(rw http.ResponseWriter, req *http.Request) {
	pluginCtx := httpadapter.PluginConfigFromContext(req.Context())
	api_token := pluginCtx.DataSourceInstanceSettings.DecryptedSecureJSONData["apiKey"]
	client := &http.Client{
		Timeout: time.Second * 10, // Set an appropriate timeout value
	}

	request, err := http.NewRequest("GET", url_base+"filter-definitions", nil)
	if err != nil {
		rw.WriteHeader(500)
		rw.Write([]byte(err.Error()))
		return
	}
	request.Header.Set("x-api-token", api_token)
	request.Header.Set("Content-Type", "application/json")
	http_response, err := client.Do(request)
	if err != nil {
		rw.WriteHeader(500)
		rw.Write([]byte(err.Error()))
		return
	}
	defer http_response.Body.Close()
	if http_response.StatusCode != 200 {
		body, err := io.ReadAll(http_response.Body)
		if err != nil {
			rw.WriteHeader(500)
			rw.Write([]byte(err.Error()))
			return
		}
		rw.WriteHeader(http_response.StatusCode)
		rw.Write(body)
		return
	}

	body, err := io.ReadAll(http_response.Body)
	if err != nil {
		rw.WriteHeader(500)
		rw.Write([]byte(err.Error()))
		return
	}
	var filters []FilterDefinition
	if err := json.Unmarshal(body, &filters); err != nil {
		if err != nil {
			//backend.Logger.Warn(string(body))
			//backend.Logger.Warn(err.Error())
			rw.WriteHeader(500)
			rw.Write([]byte("Unable to deserialize response JSON"))
			return
		}
	}
	bytes, err := json.Marshal(filters)
	if err != nil {
		rw.WriteHeader(500)
		rw.Write([]byte(err.Error()))
		return
	}
	_, err = rw.Write(bytes)
	if err != nil {
		rw.WriteHeader(500)
		rw.Write([]byte(err.Error()))
		return
	}
	rw.WriteHeader(http.StatusOK)

}
