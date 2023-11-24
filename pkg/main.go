package main

import (
	"os"

	handler "github.com/aggregations-io/grafana-plugin/pkg/plugin"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

func newDataSource(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	api_key := settings.DecryptedSecureJSONData["apiKey"]
	if api_key == "" {
		panic("No api key")
	}

	return nil, nil
}
func main() {
	err := datasource.Serve(handler.New(newDataSource))
	if err != nil {
		backend.Logger.Error("Error serving requests: ", err.Error())
		os.Exit(1)
	}
}
