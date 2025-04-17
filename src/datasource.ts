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

import { MyQuery, MyDataSourceOptions, DEFAULT_QUERY, FilterDefinition, GroupingFilterItem } from './types';
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

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): MyQuery {
    //console.log('scoped:',scopedVars)
    let s = getTemplateSrv();
    let curr = s.getVariables();
    const rel: { [key: string]: GroupingFilterItem } = {};
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
         let fi =  {} as GroupingFilterItem;
         fi.grouping=k;
         
        if (val.id === '$__agg') {          
          fi.filters =  [val.id];
          fi.returnGroupingValues=false;
          hasany = true;
        } else if(val.manual_values){
          hasany = true;
          fi.filters=val.manual_values;
          if(query.grouping_filter_includes!=null && query.grouping_filter_includes[k]!==undefined){
            fi.returnGroupingValues=query.grouping_filter_includes[k];            
          }else{
            fi.returnGroupingValues=true;
          }

        } else {
          if(query.grouping_filter_includes!=null && query.grouping_filter_includes[k]!==undefined){
            fi.returnGroupingValues=query.grouping_filter_includes[k];            
          }else{
            fi.returnGroupingValues=true;
          }
          let matching = curr.find(
            (x) => x.id === val.id || (x.type === 'query' && (x.query as MyQuery)?.rand_id === val.id)
          ) as VariableWithOptions;
          if (matching !== undefined) {
            if (scopedVars[matching.id] !== undefined) {
              fi.filters=[scopedVars[matching.id]?.value];              
            } else {
              if (typeof matching.current.value === 'string') {
                fi.filters = [matching.current.value];
              } else {
                fi.filters = matching.current.value;
              }
            }

            hasany = true;
          }
        }
        rel[k]=fi;
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
      groupingFilters: hasany ? Object.values(rel).map(z=> z) : null,
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
    query.mode='variables';
    const response = await this.query(query);

    const results: MetricFindValue[] =[];
    response.forEach(x=> results.push(... x.data.map(f=> ({text:f})).flatMap(x=> x)))

    return results;
  }
}
