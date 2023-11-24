# Grafana plugin for Aggregations.io

## Installation

For on how to install this plugin on Grafana Cloud or locally, checkout the [docs for installing plugins](https://grafana.com/docs/grafana/latest/plugins/installation/).

## Building

This plugin was built by following the [Grafana Backend Data Source Plugin Template](https://github.com/grafana/grafana-plugin-examples/tree/main/examples/datasource-http-backend)

### Backend

```
mage -v
```

### Frontend

Install

```
yarn install --pure-lockfile
```

Build in dev mode

```
yarn dev
```

Build in production mode

```
yarn build
```
