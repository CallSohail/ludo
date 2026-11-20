import { useMemo } from "react";
import { CalendarDays, Layers } from "lucide-react";
import { Empty, Panel } from "./ScorebookPanel";
import {
  dailyData,
  distribution,
  fullDate,
  rankTimeline,
  shortDate,
  timeline,
  SERIES,
} from "./analytics";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
function ChartTip({ active, payload, label, time = true, dateOnly = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <strong>
        {dateOnly ? shortDate(label) : time ? fullDate(label) : label}
      </strong>
      {payload.map((p, i) => (
        <div key={i}>
          <i style={{ background: p.color || "var(--green)" }} />
          <span>{p.name}</span>
          <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
}
const axis = {
  stroke: "var(--muted)",
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--muted)" },
};
function ChartData({ rows, columns }) {
  return (
    <details className="dash-chart-data">
      <summary>View chart data</summary>
      <div className="dash-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.format ? c.format(r[c.key]) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 200 && (
        <p>
          Showing the first 200 chart rows. Export history for all available
          events.
        </p>
      )}
    </details>
  );
}
export function TrendChart({
  events,
  players,
  period,
  title = "Score movement",
  description = "Net recorded point changes in the selected period",
  className = "",
}) {
  const data = useMemo(
    () => timeline(events, players, period),
    [events, players, period],
  );
  const chartPlayers = players.slice(0, 4);
  return (
    <Panel
      title={title}
      description={description}
      className={className}
      action={<span className="dash-unit">Points</span>}
    >
      {data.length ? (
        <>
          <div
            className="dash-chart dash-chart-tall"
            role="group"
            aria-label={`${title}: net recorded point changes over time`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={data}
                margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="var(--line)"
                  vertical={false}
                  strokeDasharray="3 4"
                />
                <XAxis
                  {...axis}
                  dataKey="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={shortDate}
                  minTickGap={40}
                  scale="time"
                />
                <YAxis {...axis} width={40} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={0} stroke="var(--line)" />
                {chartPlayers.map((p, i) => (
                  <Line
                    key={p.id}
                    dataKey={p.id}
                    name={p.name}
                    type="stepAfter"
                    stroke={SERIES[i]}
                    strokeDasharray={["", "6 3", "2 3", "9 3"][i]}
                    strokeWidth={2}
                    dot={data.length < 8 ? { r: 3 } : false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-legend">
            {chartPlayers.map((p, i) => (
              <span key={p.id}>
                <i style={{ background: SERIES[i] }} />
                {p.name}
              </span>
            ))}
          </div>
          <ChartData
            rows={data.slice(0, 200)}
            columns={[
              { key: "time", label: "Recorded at (Paris)", format: fullDate },
              ...chartPlayers.map((p) => ({ key: p.id, label: p.name })),
            ]}
          />
        </>
      ) : (
        <Empty title="No changes in this date range">
          Try All time or another date range. Current scores are shown
          separately.
        </Empty>
      )}
    </Panel>
  );
}
export function DailyChart({ events, title = "Daily penalty volume" }) {
  const data = dailyData(events);
  return (
    <Panel
      title={title}
      description="Points awarded and corrections by recorded day"
      action={<CalendarDays size={16} />}
    >
      {data.length ? (
        <>
          <div className="dash-chart" role="group" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                barSize={5}
                stackOffset="sign"
                margin={{ top: 16, right: 12, bottom: 8, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="var(--line)"
                  vertical={false}
                  strokeDasharray="3 4"
                />
                <XAxis
                  {...axis}
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={[(min) => min - 43200000, (max) => max + 43200000]}
                  tickFormatter={shortDate}
                  minTickGap={32}
                />
                <YAxis {...axis} width={40} allowDecimals={false} />
                <Tooltip content={<ChartTip dateOnly />} />
                <ReferenceLine y={0} stroke="var(--muted)" />
                <Bar
                  stackId="daily"
                  dataKey="awards"
                  name="Awarded points"
                  fill="var(--chart-green)"
                  maxBarSize={24}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  stackId="daily"
                  dataKey="corrections"
                  name="Corrections"
                  fill="var(--chart-gray)"
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-legend">
            <span>
              <i className="green" />
              Awarded points
            </span>
            <span>
              <i className="pink" />
              Corrections
            </span>
            <span className="dash-subtle">
              Days without entries are omitted
            </span>
          </div>
          <ChartData
            rows={data.slice(0, 200)}
            columns={[
              { key: "day", label: "Paris date" },
              { key: "awards", label: "Awarded points" },
              { key: "corrections", label: "Corrections" },
              { key: "count", label: "Entries" },
            ]}
          />
        </>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}
export function Distribution({ events }) {
  const data = distribution(events);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Panel
      title="Penalty sizes"
      description="Positive awards grouped by point value"
      action={<Layers size={16} />}
    >
      {total ? (
        <>
          <div className="dash-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 12, right: 24, bottom: 8, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="var(--line)"
                  horizontal={false}
                  strokeDasharray="3 4"
                />
                <XAxis {...axis} type="number" allowDecimals={false} />
                <YAxis {...axis} type="category" dataKey="label" width={64} />
                <Tooltip content={<ChartTip time={false} />} />
                <Bar
                  dataKey="count"
                  name="Awards"
                  fill="var(--chart-blue)"
                  maxBarSize={16}
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-chart-foot">
            {total} positive award{total === 1 ? "" : "s"} · corrections
            excluded
          </div>
          <ChartData
            rows={data}
            columns={[
              { key: "label", label: "Penalty size" },
              { key: "count", label: "Awards" },
            ]}
          />
        </>
      ) : (
        <Empty title="No positive awards in this period" />
      )}
    </Panel>
  );
}
export function RankChart({ events, players, player }) {
  const rows = useMemo(
    () => rankTimeline(events, players, player.id),
    [events, players, player.id],
  );
  return (
    <Panel
      title="Rank trend"
      description="Position among today’s active players after each recorded change"
    >
      {rows.length ? (
        <>
          <div className="dash-chart" role="group" aria-label="Rank over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  {...axis}
                  type="number"
                  dataKey="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={shortDate}
                  minTickGap={30}
                />
                <YAxis
                  {...axis}
                  domain={[1, Math.max(2, players.length)]}
                  reversed
                  allowDecimals={false}
                  width={34}
                />
                <Tooltip content={<ChartTip />} />
                <Line
                  type="stepAfter"
                  dataKey="rank"
                  name="Rank"
                  stroke="var(--green)"
                  strokeWidth={2}
                  dot={rows.length <= 2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ChartData
            rows={rows}
            columns={[
              { key: "time", label: "Recorded at (Paris)", format: fullDate },
              { key: "rank", label: "Rank" },
            ]}
          />
        </>
      ) : (
        <Empty title="No rank changes recorded">
          Rank history will appear after an entry is recorded.
        </Empty>
      )}
    </Panel>
  );
}
