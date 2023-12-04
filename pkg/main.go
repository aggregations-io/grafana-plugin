package main

import (
	"os"

	handler "github.com/aggregations-io/grafana-plugin/pkg/plugin"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func newDataSource(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	api_key := settings.DecryptedSecureJSONData["apiKey"]
	if api_key == "" {
		panic("No api key")
	}

	return nil, nil
}
func main() {

	if err := datasource.Manage("aggregations-io-datasource", handler.NewDatasource, handler.DatasourceOpts); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}
