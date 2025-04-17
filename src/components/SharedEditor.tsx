import React, { ChangeEvent, PureComponent } from 'react';
import { DataQueryRequest, DateTime, QueryEditorProps, QueryVariableModel, SelectableValue, isDataFrame } from '@grafana/data';
import { DataSource } from '../datasource';
import {
  Calculation,
  GroupingFilterMappingItem,
  FilterDefinition,
  FilterDefinitionAggregation,
  LimitType,
  MyDataSourceOptions,
  MyQuery,
  stringToCalculation,
  calculationPretty,

} from '../types';
import {
  InlineFieldRow,
  InlineField,
  Select,
  Input,
  RadioButtonGroup,
  VerticalGroup,
  InlineSwitch,
  HorizontalGroup,
  stylesFactory,
  Checkbox,
  InlineLabel,
  AsyncVirtualizedSelect,
  AsyncSelect,
  AsyncMultiSelect,
} from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import '../styles.css';



function selectable(value?: FilterDefinition | null): SelectableValue<FilterDefinition> {
  if (!value) {
    return {};
  }

  return { label: value.name, value: value };
}

const limitTypes = [
  { value: LimitType.Top, label: 'Top' },
  { value: LimitType.Bottom, label: 'Bottom' },
];

function selectableString(value?: string | null): SelectableValue<string> {
  if (!value) {
    return {};
  }

  return { label: value, value: value };
}
function selectableFDAgg(value?: FilterDefinitionAggregation | null): SelectableValue<FilterDefinitionAggregation> {
  if (!value) {
    return {};
  }

  return { label: value.name, value: value };
}
function selectableCalculation(value?: string | null): SelectableValue<Calculation> {
  if (value === undefined || value === null) {
    return {};
  }

  const conv = stringToCalculation(value);
  return { label: conv === undefined ? '' : calculationPretty(conv), value: conv };
}
export interface SharedProps extends QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions> {
  mode: string;
}
export class SharedEditor extends PureComponent<SharedProps> {
  constructor(props: SharedProps) {
    super(props);

    const cloned = structuredClone(props.query);

    //console.log('con',this.props, cloned);
    if (cloned.includeGroupingLabels === undefined) {
      cloned.includeGroupingLabels = true;
    }
    if (cloned.includeIncompleteIntervals === undefined) {
      cloned.includeIncompleteIntervals = true;
    }
    if (cloned.shouldRecalculate === undefined) {
      cloned.shouldRecalculate = false;
    }
    if (cloned.longResult === undefined) {
      cloned.longResult = false;
    }
    if (cloned.rand_id === undefined) {
      cloned.rand_id = Math.random().toString(20).substring(2, 8);
    }
    this.this_is_query_editor = props.mode === 'query';
    this.onRunQuery = this.onRunQuery.bind(this);
    //console.log(this.props)
    this.known_filters = [];
    this.known_options = {};
    if (cloned.rand_id === undefined) {
      cloned.rand_id = Math.random().toString(20).substring(2, 8);
    }
    const { onChange } = this.props;
    onChange({
      ...cloned,
      datasourceId: props.datasource.id,
      excludeEmptyGroupings: false,
      includeGroupingLabels: cloned.includeGroupingLabels === undefined || this.props.query.includeGroupingLabels === null ? true : cloned.includeGroupingLabels,
      mode: props.mode,
    });
  }
  styles = getStyles();
  this_is_query_editor: boolean;
  known_filters: Array<SelectableValue<FilterDefinition>>;
  known_options: { [key: string]: Array<SelectableValue<string>> };
  got_filters = false;
  onRunQuery(
    props: Readonly<SharedProps> &
      Readonly<{
        children?: React.ReactNode;
      }>
  ) {
    //console.log('checking', props.query);
    if (
      props.query.filter_definition &&
      props.query.filter_definition !== null &&
      props.query.filter_definition !== undefined
    ) {

      props.query.filterDefinitionName = props.query.filter_definition!.name;
      if (props.query.selected_agg && props.query.selected_agg !== null) {
        props.query.filterDefinitionName = `${props.query.filterDefinitionName} - ${props.query.selected_agg.name}`;
        if (props.query.calculation !== null) {
          props.query.filterDefinitionName = `${props.query.filterDefinitionName} - ${calculationPretty(props.query.calculation)}`;
        }
      }
    }
    if (
      props.query.filterId &&
      props.query.filterId !== '' &&
      props.query.calculation !== null &&
      //props.query.aggregation !== '' &&
      props.query.aggregationId &&
      props.query.aggregationId > 0 &&
      (!props.query.limit || props.query.limit == null || (props.query.limit && props.query.limit > 0)) &&
      props.query.filter_definition &&
      props.query.filter_definition !== null &&
      (props.query.calculation !== Calculation.Percentiles ||
        (props.query.calculation === Calculation.Percentiles &&
          props.query.percentile != null &&
          props.query.percentile > 0 &&
          props.query.percentile <= 1))
    ) {
      //console.log('ok to run', this.props.query);
      props.query.excludeEmptyGroupings = false;
      if (this.this_is_query_editor) {
        //let ts = getTemplateSrv();
        //console.log(ts.getVariables());
      }
      this.props.onRunQuery();
    } else {
      // console.log('NOT OK TO RUN ', this.props.query);
    }
  }
  getFilterDefinitions(): Array<SelectableValue<FilterDefinition>> {
    const result: Array<SelectableValue<FilterDefinition>> = [];
    if (!this.got_filters) {
      this.props.datasource.getFilterDefinitions().then((fds: FilterDefinition[]) => {
        fds.forEach((fd: FilterDefinition) => {
          if (this.props.query.filterId != null && this.props.query.filterId === fd.id) {
            this.props.query.filter_definition = fd;
          }
          result.push({ label: fd.name, value: fd });
        });
      });

      this.known_filters = result;
      this.got_filters = true;
    } else {
      return this.known_filters;
    }
    return result;
  }

  async getFilterOptions(grouping_name: string, id: string | null, datasource: DataSource, range: { from: DateTime; to: DateTime; raw: any }): Promise<SelectableValue<string>[]> {
    if (id === null) {
      return [];
    }
    if (!this.known_options[grouping_name || '-' || id]) {
      const mqf: MyQuery = {
        ... this.props.query,
        groupingName: grouping_name,
        includeAggregateOption: false,
        mode: 'variables',
        refId: 'variableCheck',
      };

      const request: DataQueryRequest<MyQuery> = {
        targets: [mqf],
        interval: '',
        scopedVars: {},
        range, // comes from props
        requestId: 'dropdown-query',
        timezone: 'browser',
        app: 'panel',
        startTime: range.from.toDate().valueOf(),
        intervalMs: 30000,
      };




      const results: Array<SelectableValue<string>> = [];

      await datasource.query(request).forEach(n => {
        for (const d of n.data) {
          if (isDataFrame(d)) {
            for (let i = 0; i < d.fields[0].values.length; i++) {
              const val = d.fields[0].values.get(i);
              results.push({ label: val, value: val })
            }
          }
        }
      });

      this.known_options[grouping_name || '-' || id] = results;
      return results;
    } else {
      return this.known_options[grouping_name || '-' || id];
    }
  }

  onFilterDefinitionChange = (event: SelectableValue<FilterDefinition>) => {
    const { onChange, query } = this.props;
    const sel_fd_agg = event.value!.aggregations.length === 1 ? event.value!.aggregations[0] : null;
    const sel_agg =
      sel_fd_agg == null ? null : sel_fd_agg.calculations.length === 1 ? sel_fd_agg.calculations[0] : null;
    onChange({
      ...query,
      filterId: event.value!.id,
      filter_definition: event.value!,
      selected_agg: sel_fd_agg,
      aggregationId: sel_fd_agg == null ? null : sel_fd_agg.id,
      calculation: sel_agg,
      filterDefinitionName: event.value!.name,
      grouping_filter_mapping: {},
      grouping_filter_mapping_str: '',
    });
  };

  getSpecificGroupingOptions(): Array<SelectableValue<string>> {
    if (!this.props.query.filter_definition || this.props.query.filter_definition.groupings == null) {
      return [];
    }
    return this.props.query.filter_definition.groupings.map((x) => selectableString(x));
  }
  getFDAggs(): Array<SelectableValue<FilterDefinitionAggregation>> {
    if (!this.props.query.filter_definition) {
      return [];
    }
    return this.props.query.filter_definition.aggregations.map((x) => selectableFDAgg(x));
  }

  onFDAggChange = (event: SelectableValue<FilterDefinitionAggregation>) => {
    const { onChange, query } = this.props;
    let new_agg =
      query.calculation === null
        ? null
        : event.value!.calculations.includes(query.calculation)
          ? query.calculation
          : null;
    if (new_agg == null) {
      if (event.value!.calculations.length === 1) {
        new_agg = event.value!.calculations[0];
      }
    }
    onChange({ ...query, aggregationId: event.value!.id, selected_agg: event.value!, calculation: new_agg });
  };

  getCalculationOptions(): Array<SelectableValue<Calculation>> {
    if (!this.props.query.selected_agg) {
      return [];
    }
    return this.props.query.selected_agg!.calculations.map((x) => selectableCalculation(x));
  }

  onAggChange = (event: SelectableValue<Calculation>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, calculation: event.value! });
  };
  onPercentileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    try {
      if (event.target.value.trim() !== '') {
        let num = parseFloat(event.target.value);
        onChange({ ...query, percentile: num });
      } else {
        onChange({ ...query, percentile: null });
      }
    } catch { }
  };
  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    try {
      if (event.target.value.trim() !== '') {
        let num = parseInt(event.target.value, 10);
        onChange({ ...query, limit: num });
      } else {
        onChange({ ...query, limit: null });
      }
    } catch { }
  };
  onAliasChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    try {
      if (event.target.value.trim() !== '') {
        onChange({ ...query, alias: event.target.value });
      } else {
        onChange({ ...query, alias: null });
      }
    } catch { }
  };
  onLimitTypeChange = (event: LimitType) => {
    const { onChange, query } = this.props;
    onChange({ ...query, limitType: event });
  };

  onIncompleteIntervalsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, includeIncompleteIntervals: event.target.checked });
    this.onRunQuery(this.props);
  };


  onShouldRecalculateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, shouldRecalculate: event.target.checked });
    this.onRunQuery(this.props);
  };

  onLongChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, longResult: event.target.checked });
    this.onRunQuery(this.props);
  };

  onIncludeAggChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;

    onChange({ ...query, includeAggregateOption: event.target.checked });
  };

  onGroupingLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, includeGroupingLabels: event.target.checked });
    this.onRunQuery(this.props);
  };
  onSpecificGroupingChange = (event: SelectableValue<string>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, groupingName: event.value || null });
    this.onRunQuery(this.props);
  };

  onGroupingFilterIncludeChange = (event: boolean, grp: string) => {
    const { onChange, query } = this.props;
    const newIncludes = { ...(query.grouping_filter_includes || {}) };
    if (!query.grouping_filter_includes || query.grouping_filter_includes === null) {
      query.grouping_filter_includes = {};
    }
    newIncludes[grp] = event;
    onChange({ ...query, grouping_filter_includes: newIncludes });
    this.onRunQuery(this.props);

  }
  onGroupingOptionsSelectedChange = (event: Array<SelectableValue<string>>, grp: string) => {
    this.changeMap(true, grp, event);
  }

  onGroupingFilterMapSelectChange = (event: SelectableValue<GroupingFilterMappingItem>, grp: string) => {

    this.changeMap(false, grp, event);

  };

  changeMap = (is_manual: boolean, grp: string, event: Array<SelectableValue<string>> | SelectableValue<GroupingFilterMappingItem>) => {
    const { onChange, query } = this.props;
    const newMap = { ...(query.grouping_filter_mapping || {}) };
    const newIncludes = { ...(query.grouping_filter_includes || {}) };
    if (Array.isArray(event)) {
      newMap[grp] = {
        id: '$__manual',
        name: '$__manual',
        manual_values: event.map(x => x.value!)
      };
    } else if (!event?.value) {
      delete newMap[grp];
    }
    else {
      newMap[grp] = event.value;
      if (event.value.id === '$__agg') {
        newIncludes[grp] = false;
      }
    }
    if (query.grouping_filter_mapping == null) {
      query.grouping_filter_mapping = {};
    }
    onChange({
      ...query, grouping_filter_mapping: newMap,
      grouping_filter_mapping_str: Object.entries(newMap)
        .filter(([k, v]) => v.id !== '$__manual')
        .map(([k, v]) => `${k}="\$${v.name}"`)
        .join('|'),
      grouping_filter_includes: newIncludes
    });
    this.onRunQuery(this.props);
  }

  render() {
    const show_grouping_ops =
      this.this_is_query_editor &&
      this.props.query.filter_definition &&
      this.props.query.filter_definition.groupings &&
      this.props.query.filter_definition.groupings.length > 0;
    let grouping_ops;
    let grouping_filters;
    let grouping_filters_any_manual: boolean;
    let grouping_filters_tbl;

    let incomplete_intervals = <InlineField label="Incomplete Intervals" labelWidth={22} tooltip={'Allow showing incomplete intervals.'}>
      <InlineSwitch
        onChange={this.onIncompleteIntervalsChange}
        value={this.props.query.includeIncompleteIntervals}
      ></InlineSwitch>
    </InlineField>;
    let recalc_intervals = <InlineField label="Recalculate Intervals" labelWidth={22} tooltip={'Should results be re-aggregated to fit, according to Query Options defined above?'}>
      <InlineSwitch
        onChange={this.onShouldRecalculateChange}
        value={this.props.query.shouldRecalculate}
      ></InlineSwitch>
    </InlineField>;
    if (this.this_is_query_editor) {
      grouping_ops = <InlineFieldRow>
        {incomplete_intervals}
        {recalc_intervals}
      </InlineFieldRow>;
    }


    if (show_grouping_ops) {
      grouping_ops = (
        <InlineFieldRow>
          <InlineField
            label="Long Result"
            labelWidth={15}
            tooltip={
              'Useful for displaying in tabular format, each grouping value will be represented as a separate column.'
            }
          >
            <InlineSwitch onChange={this.onLongChange} value={this.props.query.longResult}></InlineSwitch>
          </InlineField>
          {incomplete_intervals}
          {recalc_intervals}
          <InlineField
            label="Grouping Labels"
            labelWidth={20}
            tooltip={'When displaying series values, include grouping labels with their values'}
          >
            <InlineSwitch
              onChange={this.onGroupingLabelChange}
              value={this.props.query.includeGroupingLabels === null ? false : this.props.query.includeGroupingLabels}
            ></InlineSwitch>
          </InlineField>
        </InlineFieldRow>
      );
      let variables = getTemplateSrv()
        .getVariables()
        .map((x) => {
          const basic: SelectableValue<GroupingFilterMappingItem> = {
            value: { id: x.id, name: x.name },
            label: x.label || x.name,
          };
          if (x.type !== 'query') {
            return basic;
          }
          let mq = (x as QueryVariableModel).query as MyQuery;
          if (mq === undefined) {
            return basic;
          }
          let gfm: GroupingFilterMappingItem = { id: mq.rand_id || x.id, name: x.name };

          if (
            mq.filterId !== null &&
            mq.filterId !== undefined &&
            mq.groupingName !== null &&
            mq.groupingName !== undefined &&
            mq.groupingName.trim() !== ''
          ) {
            return {
              value: gfm,
              label: x.label || x.name,
              description: `${mq.groupingName} on ${mq.filterDefinitionName}`,
            };
          } else {
            return {
              value: gfm,
              label: x.label || x.name,
              description: 'Incomplete variable definition',
              isDisabled: true,
            };
          }
        });
      variables.unshift({
        value: { id: '$__agg', name: '$__agg' },
        label: 'IGNORED',
        description: 'do not include this grouping',
      });
      variables.unshift({
        value: { id: '$__manual', name: '$__manual' },
        label: 'MANUAL',
        description: 'input manual options to include in this filter'
      });
      let all_names = [
        ...new Set([
          ...this.props.query.filter_definition!.groupings,
          ...Object.keys(this.props.query.grouping_filter_mapping || {}),
        ]),
      ];
      if (all_names.length > 0) {
        grouping_filters_any_manual = all_names.find((x) => {
          const selected =
            variables.find((z) => z.value?.id === (this.props.query.grouping_filter_mapping || {})[x]?.id) || null;
          return selected?.value?.id === '$__manual';
        }) !== undefined;
        grouping_filters = all_names.map((x) => {


          const sel_mapping = (this.props.query.grouping_filter_mapping || {})[x];
          //console.log('GETTING FOR ',x, sel_mapping?.name);
          const selected =
            variables.find((z) => z.value?.id === sel_mapping?.id) || null;

          const force_exclude = selected !== null && selected.value?.id === '$__agg';
          const force_include = selected === null;
          const included = (this.props.query.grouping_filter_includes || {})[x];
          const is_manual = selected?.value?.id === '$__manual';
          //console.log('INCL:',x, (this.props.query.grouping_filter_includes||{})[x], included, selected);
          return (
            <tr key={x}>
              <td style={{ width: 'min-content' }}>
                <InlineLabel width={'auto'}>{x}</InlineLabel>
              </td>
              <td style={{ width: 'min-content', textAlign: 'center', verticalAlign: 'middle' }}>
                <Checkbox width="auto" disabled={force_exclude || force_include} value={force_exclude ? false : force_include ? true : included === undefined ? true : included}
                  onChange={(q) => this.onGroupingFilterIncludeChange(q.currentTarget.checked, x)}
                ></Checkbox>
              </td>
              <td style={{ width: grouping_filters_any_manual ? '50%' : '100%' }}>
                <Select
                  isClearable={true}
                  options={variables}
                  value={selected}
                  allowCustomValue={false}
                  onChange={(q) => this.onGroupingFilterMapSelectChange(q, x)}

                />
              </td>
              {is_manual &&
                <td style={{ width: '50%' }}>
                  <AsyncMultiSelect
                    isClearable={true}

                    allowCustomValue={false}
                    defaultOptions={true}
                    loadOptions={(s) => this.getFilterOptions(x, this.props.query.filterId, this.props.datasource, this.props.range!)}
                    onChange={(ops, a) => {
                      //console.log('CHANGE',ops,a);
                      return this.onGroupingOptionsSelectedChange(ops, x);
                    }}
                    onBlur={() => {
                      this.onRunQuery(this.props);
                    }}
                    value={sel_mapping.manual_values?.map(x => selectableString(x))}
                  />
                </td>
              }
            </tr>
          );
        });
        //grouping_filters.unshift(<div style={{ minWidth: '600px', height: 0 }}></div>, <h4>Grouping Filters</h4>);
        grouping_filters_tbl = <><div style={{ display: 'flex', marginRight: 'auto', flexDirection: 'column' }}><div style={{ minWidth: '660px', height: 0 }}></div><h4>Grouping Filters</h4>
          <table>
            <colgroup span={1}></colgroup>
            <colgroup span={1}></colgroup>
            <colgroup span={grouping_filters_any_manual ? 2 : 1}></colgroup>
            <thead>
              <tr><th style={{ width: 'min-content' }}><InlineLabel>Grouping</InlineLabel></th><th style={{ width: 'min-content' }}><InlineLabel tooltip={"Whether to include this grouping as a returned series to be charted, or just apply the filter"}>Include</InlineLabel></th>
                <th style={{ width: grouping_filters_any_manual ? '50%' : '100%' }}><InlineLabel>Filter</InlineLabel></th>
                {
                  grouping_filters_any_manual &&
                  <th style={{ width: '50%', minWidth: '100px' }}><InlineLabel>Manual</InlineLabel></th>
                }
              </tr></thead>
            <tbody>{grouping_filters}</tbody>
          </table>
        </div>
        </>;
      }
    }

    let filter_field = (
      <InlineField label="Filter" labelWidth={this.this_is_query_editor ? 15 : 30} tooltip="Specify Filter to work with">
        { }
        <Select
          allowCustomValue={false}
          value={selectable(this.props.query.filter_definition)}
          //placeholder="table name"
          onChange={this.onFilterDefinitionChange}
          options={this.getFilterDefinitions()}
          onBlur={() => {
            this.onRunQuery(this.props);
          }}
          width={50}
        />
      </InlineField>
    );

    return (
      <div className="upper">
        <HorizontalGroup width="100%" align="flex-start" justify="space-between" spacing="xs">
          <div style={{ width: '95%' }}>
            {/* width={this.props.query.filter_definition && this.props.query.filter_definition.groupings && this.props.query.filter_definition.groupings.length > 0 ? '60%' : '100%'} */}
            <VerticalGroup>
              {!this.this_is_query_editor && <InlineFieldRow>{filter_field}</InlineFieldRow>}
              <InlineFieldRow>
                {this.this_is_query_editor && filter_field}
                {!this.this_is_query_editor && (
                  <InlineField label="Grouping" labelWidth={this.this_is_query_editor ? 15 : 30}>
                    { }
                    <Select
                      allowCustomValue={false}
                      value={selectableString(this.props.query.groupingName)}
                      onChange={this.onSpecificGroupingChange}
                      options={this.getSpecificGroupingOptions()}
                      onBlur={() => {
                        this.onRunQuery(this.props);
                      }}
                      width={50}
                    />
                  </InlineField>
                )}
                {!this.this_is_query_editor && (
                  <InlineFieldRow>
                    {' '}
                    <InlineField
                      tooltip="Include an 'Aggregate All' option in this variable selector"
                      label="Include Aggregate Option"
                      labelWidth={30}
                    >
                      { }
                      <InlineSwitch
                        onChange={this.onIncludeAggChange}
                        value={this.props.query.includeAggregateOption}
                      ></InlineSwitch>
                    </InlineField>
                  </InlineFieldRow>
                )}
              </InlineFieldRow>
              <InlineFieldRow>
                {this.this_is_query_editor && (
                  <InlineField label="Aggregation" labelWidth={15}>
                    { }
                    <Select
                      allowCustomValue={false}
                      value={selectableFDAgg(this.props.query.selected_agg)}
                      //placeholder="table name"
                      onChange={this.onFDAggChange}
                      options={this.getFDAggs()}
                      onBlur={() => {
                        this.onRunQuery(this.props);
                      }}
                      width={50}
                    />
                  </InlineField>
                )}
              </InlineFieldRow>
              <InlineFieldRow>
                {this.this_is_query_editor && this.props.query != null && (
                  <InlineField label="Calculation" labelWidth={15}>
                    { }
                    <Select
                      allowCustomValue={false}
                      value={selectableCalculation(this.props.query.calculation)}
                      //placeholder="table name"
                      onChange={this.onAggChange}
                      options={this.getCalculationOptions()}
                      onBlur={() => {
                        this.onRunQuery(this.props);
                      }}
                      width={this.props.query.calculation === Calculation.Percentiles ? 20 : 50}
                    />
                  </InlineField>
                )}
                {this.this_is_query_editor &&
                  this.props.query?.calculation != null &&
                  this.props.query.calculation === Calculation.Percentiles && (
                    <InlineField
                      label="Percentile"
                      tooltip="Enter Percentile as Decimal between 0 and 1, so P99 should be '0.99'"
                      labelWidth={15}
                    >
                      { }
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={this.props.query.percentile == null ? undefined : this.props.query.percentile}
                        //placeholder="table name"
                        onChange={this.onPercentileChange}
                        width={20}
                        onBlur={() => {
                          this.onRunQuery(this.props);
                        }}
                      />
                    </InlineField>
                  )}
              </InlineFieldRow>
              {this.this_is_query_editor && (
                <InlineFieldRow>
                  <InlineField
                    label="Limit"
                    labelWidth={15}
                    tooltip="Per time slice, only include the Top/Bottom N grouped values."
                  >
                    { }
                    <RadioButtonGroup<LimitType>
                      value={this.props.query.limitType || LimitType.Top}
                      options={limitTypes}
                      onChange={this.onLimitTypeChange}
                    />
                  </InlineField>

                  <InlineField>
                    { }

                    <Input
                      type="number"
                      min="1"
                      max="999999"
                      step="1"
                      value={this.props.query.limit === null ? undefined : this.props.query.limit!}
                      //placeholder="table name"
                      onChange={this.onLimitChange}
                      onBlur={() => {
                        this.onRunQuery(this.props);
                      }}
                      width={20}
                    />
                  </InlineField>
                  <InlineField label="Alias" labelWidth={15}>
                    { }

                    <Input
                      type="text"
                      value={this.props.query.alias || undefined}
                      //placeholder="table name"
                      onChange={this.onAliasChange}
                      onBlur={() => {
                        this.onRunQuery(this.props);
                      }}
                      width={50}
                    />
                  </InlineField>
                </InlineFieldRow>
              )}
              {grouping_ops}
            </VerticalGroup>
          </div>
          <VerticalGroup align="flex-start" hidden={!this.this_is_query_editor}>
            {grouping_filters_tbl}
          </VerticalGroup>
        </HorizontalGroup>
      </div>
    );
  }
}
const getStyles = stylesFactory(() => {
  return {
    upper: css`
      margin-top: 10px !important;
    `,
  };
});
