import React, { useContext, useState } from 'react';
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
import {
  AutoSizer,
  EmptyState,
  EntityByGuidQuery,
  HeadingText,
  LineChart,
  NerdletStateContext,
  PlatformStateContext,
  Spinner,
  TableChart,
} from 'nr1';
import { timeRangeToNrql } from '@newrelic/nr-labs-components';
import Label from './label';
import FilterIcon from './filter.svg';

const CHART_DEFS = [
  {
    title: 'Response time by host',
    query: `SELECT average(apm.service.transaction.duration * 1000) as responseTime FROM Metric FACET host LIMIT 20 TIMESERIES `,
  },
  {
    title: 'Throughput by host',
    query: `SELECT rate(count(apm.service.transaction.duration), 1 minute) as throughput FROM Metric FACET host TIMESERIES `,
  },
  {
    title: 'Error Rate by host',
    query: `SELECT count(apm.service.error.count) / count(apm.service.transaction.duration) as errorRate FROM Metric FACET host LIMIT 20 TIMESERIES `,
  },
  {
    title: 'CPU Utilization by host',
    query: `SELECT rate(sum(apm.service.cpu.usertime.utilization), 1 second) as cpuUsage FROM Metric FACET host LIMIT 20 TIMESERIES `,
  },
  {
    title: 'Memory usage by host',
    query: `SELECT (average(apm.service.memory.physical) * rate(count(apm.service.instance.count), 1 minute)) * 10e5 as memoryUsage FROM Metric FACET host LIMIT 20 TIMESERIES `,
  },
  {
    title: 'Summary of App Metrics by Host',
    query: `SELECT average(apm.service.transaction.duration * 1000) as responseTime, rate(count(apm.service.transaction.duration), 1 minute) as throughput, count(apm.service.error.count) / count(apm.service.transaction.duration) as errorRate, rate(sum(apm.service.cpu.usertime.utilization), 1 second) * 100 as cpuUsage, (average(apm.service.memory.physical) * rate(count(apm.service.instance.count), 1 minute)) / 1000 as memoryUsage FROM Metric FACET host LIMIT 20 `,
    type: 'table',
  },
];

const formatTimeRangeForDisplay = (timeRange) => {
  if (!timeRange) return;
  const { begin_time, end_time, duration } = timeRange;

  if (duration) {
    dayjs.extend(relativeTime);
    const formatted = dayjs().to(dayjs().subtract(duration, 'ms'));
    return `Since ${formatted}`;
  } else if (begin_time && end_time) {
    return `Since ${dayjs(begin_time).format('MMM DD hh:mm')} Until ${dayjs(
      end_time
    ).format('MMM DD hh:mm')}`;
  } else {
    return 'Since 60 minutes ago';
  }
};

const createQueries = (entityGuid, filterClause, timeRangeClause) => {
  return CHART_DEFS.map((q) => {
    const queryStr = `${q.query} WHERE entityGuid = '${entityGuid}' ${filterClause} ${timeRangeClause}`;
    return {
      title: q.title,
      query: queryStr,
      type: q.type,
    };
  });
};

const Home = () => {
  const [filter, setFilter] = useState();
  const { timeRange } = useContext(PlatformStateContext);
  const { entityGuid } = useContext(NerdletStateContext);

  const timeRangeClause = timeRangeToNrql({ timeRange });
  const filterClause = filter ? `WHERE host = '${filter}'` : '';
  const queries = createQueries(entityGuid, filterClause, timeRangeClause);

  const subtitle = formatTimeRangeForDisplay(timeRange);

  return (
    <AutoSizer>
      {({ width, height }) => (
        <div style={{ width, height, overflowX: 'hidden' }}>
          <EntityByGuidQuery entityGuid={entityGuid}>
            {({ data, loading, error }) => {
              if (loading) {
                return <Spinner fillContainer />;
              }
              if (error) {
                throw new Error(error);
              }

              const entity = data.entities[0];
              if (entity) {
                return (
                  <>
                    <div className="filter-bar">
                      <div className="nrlabs-filter-bar-input-field-icon">
                        <img src={FilterIcon} alt="filter by" />
                      </div>
                      {filter ? (
                        <Label
                          value={filter}
                          onRemove={() => setFilter(undefined)}
                        />
                      ) : (
                        <span className="filter-bar-placeholder">
                          Click a line in one of the line charts to apply a
                          filter
                        </span>
                      )}
                    </div>
                    <div
                      className="chartGrid"
                      style={{ width, overflowX: 'hidden' }}
                    >
                      {queries.map((q, i) => {
                        console.info('q', q);
                        return (
                          <div
                            key={i}
                            className={`chartContainer container${i}`}
                          >
                            <div className="header">
                              <HeadingText type={HeadingText.TYPE.HEADING_6}>
                                {q.title}
                              </HeadingText>
                              <div className="subheader">{subtitle}</div>
                            </div>
                            <div className="chart">
                              {q.type === 'table' ? (
                                <TableChart
                                  fullHeight
                                  fullWidth
                                  accountIds={[entity.accountId]}
                                  query={q.query}
                                />
                              ) : (
                                <LineChart
                                  fullHeight
                                  fullWidth
                                  accountIds={[entity.accountId]}
                                  query={q.query}
                                  onClickLine={({ metadata }) =>
                                    setFilter(metadata.label)
                                  }
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              } else {
                return (
                  <EmptyState
                    fullHeight
                    fullWidth
                    iconType={
                      EmptyState.ICON_TYPE
                        .HARDWARE_AND_SOFTWARE__SOFTWARE__ALL_ENTITIES
                    }
                    title="Entity not found"
                    description="This nerdpack is not enabled for the selected account - please choose an entity from an enabled account, or ask your New Relic admin to enable this nerdpack for this account."
                  />
                );
              }
            }}
          </EntityByGuidQuery>
        </div>
      )}
    </AutoSizer>
  );
};

export default Home;
