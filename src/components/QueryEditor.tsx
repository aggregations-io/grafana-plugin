import React, { PureComponent } from 'react';
import { SharedEditor } from './SharedEditor';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';
import { QueryEditorProps } from '@grafana/data';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }
  render() {
    return (
      <div>
        <SharedEditor {...this.props} mode="query"></SharedEditor>
      </div>
    );
  }
}
