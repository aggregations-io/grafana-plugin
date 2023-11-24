import {
  DataSourceInstanceSettings,
  CoreApp,
  MetricFindValue,
  VariableSupportType,
  DataQueryRequest,
  ScopedVars,
  VariableWithOptions,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, FilterDefinition } from './types';
import { VariableEditor } from 'components/VariableEditor';
import { uniqueId } from 'lodash';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.variables = {
      getType: () => VariableSupportType.Custom,
      editor: VariableEditor as any,
      query: (request: DataQueryRequest<MyQuery>) => {
        const queries = request.targets.map((query) => {
          return { ...query, refId: query.refId || uniqueId('tempVar') };
        });
        return this.query({ ...request, targets: queries });
      },
    };
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): Record<string, any> {
    //console.log('scoped:',scopedVars)
    let s = getTemplateSrv();
    let curr = s.getVariables();
    const rel: { [key: string]: string[] } = {};
    let hasany = false;
    //console.log('curr:',curr);
    query.fast_mode = true;
    if (scopedVars !== null && scopedVars !== undefined) {
      //console.log('SCOPED', scopedVars, curr);
    }
    if (query.grouping_filter_mapping !== undefined && query.grouping_filter_mapping != null) {
      Object.entries(query.grouping_filter_mapping).forEach((kv) => {
        let k = kv[0];
        let val = kv[1];
        if (val.id === '$__agg') {
          rel[k] = [val.id];
          hasany = true;
        } else {
          let matching = curr.find(
            (x) => x.id === val.id || (x.type === 'query' && (x.query as MyQuery)?.rand_id === val.id)
          ) as VariableWithOptions;
          if (matching !== undefined) {
            if (scopedVars[matching.id] !== undefined) {
              rel[k] = [scopedVars[matching.id]?.value];
            } else {
              if (typeof matching.current.value === 'string') {
                rel[k] = [matching.current.value];
              } else {
                rel[k] = matching.current.value;
              }
            }

            hasany = true;
          }
        }
      });
    }
    // for(var i=0;i<curr.length;i++){
    // var this_var = curr[i];

    //   if(this_var.query && this_var.query.specific_grouping){
    //     rel[this_var.query.specific_grouping]=this_var.current.value;
    //   }
    // }
    //console.log(rel);
    const interpolatedQuery: MyQuery = {
      ...query,
      groupingFilters: hasany ? rel : null,
    };
    return interpolatedQuery;
  }
  async getFilterDefinitions(): Promise<FilterDefinition[]> {
    return this.getResource('filterDefinitions');
  }
  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }
  async metricFindQuery(query: any, options?: any): Promise<MetricFindValue[]> {
    const response = await this.postResource('groupingValues', query);

    // Convert query results to a MetricFindValue[]
    const values = response.data.map((frame: any) => ({ text: frame }));

    return values;
  }
}
