package handler

import (
	"time"

	"gopkg.in/guregu/null.v4"
)

type Calculation string

const (
	COUNT                 Calculation = "COUNT"
	SUM                   Calculation = "SUM"
	AVG                   Calculation = "AVG"
	MAX                   Calculation = "MAX"
	MIN                   Calculation = "MIN"
	APPROX_COUNT_DISTINCT Calculation = "APPROX_COUNT_DISTINCT"
	PERCENTILES           Calculation = "PERCENTILES"
)

type LimitType string

const (
	Top    LimitType = "Top"
	Bottom LimitType = "Bottom"
)

type FilterDefinition struct {
	FilterId     string                        `json:"id"`
	Name         string                        `json:"name"`
	Filter       string                        `json:"filter"`
	Groupings    *[]string                     `json:"groupings"`
	Aggregations []FilterDefinitionAggregation `json:"aggregations"`
}

type FilterDefinitionAggregation struct {
	Id               int32         `json:"id"`
	SubFilter        string        `json:"subFilter"`
	Calculations     []Calculation `json:"calculations"`
	AggregationField *string       `json:"calculationField"`
	Name             string        `json:"name"`
}

type QueryOptions struct {
	FilterId                   string              `json:"filterId"`
	StartTime                  string              `json:"startTime"`
	EndTime                    string              `json:"endTime"`
	GroupingFilters            map[string][]string `json:"groupingFilters"`
	AggregationId              int                 `json:"aggregationId"`
	Calculation                Calculation         `json:"calculation"`
	LimitN                     *int                `json:"limit"`
	LimitType                  *LimitType          `json:"limitType"`
	Alias                      string              `json:"alias"`
	ExcludeEmpty               bool                `json:"excludeEmptyGroupings"`
	Hide                       null.Bool           `json:"hide"`
	FilterDefinitionName       string              `json:"filterDefinitionName"`
	LongResult                 null.Bool           `json:"longResult"`
	IncludeGroupingLabels      bool                `json:"includeGroupingLabels"`
	SpecificGrouping           string              `json:"groupingName"`
	Mode                       string              `json:"mode"`
	IncludeAggregateOption     bool                `json:"includeAggregateOption"`
	IncludeIncompleteIntervals bool                `json:"includeIncompleteIntervals"`
	Percentile                 null.Float          `json:"percentile"`
	Optimized                  bool                `json:"optimized"`
	QueryId                    string              `json:"queryId"`
	FastMode                   bool                `json:"fast_mode"`
}

type MetricResult struct {
	IsSeperator null.Bool          `json:"isSeperator"`
	Dt          null.Time          `json:"dt,omitempty"`
	DtSecLater  int64              `json:"dtSecLater,omitempty"`
	Val         float64            `json:"val,omitempty"`
	Groupings   *map[string]string `json:"groupings,omitempty"`
	QueryId     null.String        `json:"queryId,omitempty"`
}

type MetricResultVal struct {
	Dt        time.Time         `json:"dt"`
	Val       float64           `json:"val"`
	Groupings map[string]string `json:"groupings"`
	QueryId   string            `json:"queryId,omitempty"`
}

type GroupingResult struct {
	Value string `json:"value"`
}
