import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';
import { SharedEditor } from './SharedEditor';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function VariableEditor(props: Props) {
  return <SharedEditor {...props} query={{ ...props.query, refId: 'tempvar' }} mode="variables" />;
}
