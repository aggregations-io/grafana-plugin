import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export enum LimitType {
  Top = 'Top',
  Bottom = 'Bottom',
}

export interface MyQuery extends DataQuery {
  filterId: string | null;
  aggregationId: number | null;
  calculation: Calculation | null;
  limit: number | null;
  limitType: LimitType | null;
  groupingFilters: { [key: string]: string[] } | null;
  grouping_filter_mapping: { [key: string]: GroupingFilterMappingItem } | null;
  grouping_filter_mapping_str: string;
  datasourceId: number | null;
  filter_definition: FilterDefinition | null;
  selected_agg: FilterDefinitionAggregation | null;
  alias: string | null;
  excludeEmptyGroupings: boolean;
  filterDefinitionName: string | null;
  longResult: boolean;
  includeGroupingLabels: boolean | null;
  mode: string;
  groupingName: string | null;
  includeAggregateOption: boolean;
  rand_id: string;
  includeIncompleteIntervals: boolean;
  percentile: number | null;
  fast_mode: boolean;
}

export interface GroupingFilterMappingItem {
  id: string;
  name: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  limitType: LimitType.Top,
  excludeEmptyGroupings: false,
  includeGroupingLabels: true,
  includeAggregateOption: true,
  includeIncompleteIntervals: true,
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

export interface Items {
  filter_definitions: FilterDefinition[];
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

export interface FilterDefinition {
  id: string;
  name: string;
  filter: string;
  groupings: string[];
  aggregations: FilterDefinitionAggregation[];
}

export interface FilterDefinitionAggregation {
  id: number;
  subFilter: string;
  calculations: Calculation[];
  calculationField: string;
  name: string;
}

export enum Calculation {
  Count = 'COUNT',
  Sum = 'SUM',
  Avg = 'AVG',
  Max = 'MAX',
  Min = 'MIN',
  Approx_Count_Distinct = 'APPROX_COUNT_DISTINCT',
  Percentiles = 'PERCENTILES',
}

export function calculationPretty(value: Calculation ):string {
   switch(value){
    case Calculation.Count:
      return 'Count';          
      case Calculation.Sum:
        return 'Sum';        
      case Calculation.Approx_Count_Distinct:
        return 'Approx. Count Distinct';
      case Calculation.Avg:
        return 'Avg';
      case Calculation.Max:
        return 'Max';
      case Calculation.Min:
        return 'Min';
      case Calculation.Percentiles:
        return 'Percentiles';            
  }
}

export function stringToCalculation(value: string): Calculation | undefined {
  if (
    Object.values(Calculation)
      .map((z) => z.valueOf())
      .indexOf(value) >= 0
  ) {
    return value as Calculation;
  }
  return undefined;
}
