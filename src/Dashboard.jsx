import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Activity,
  BookOpen,
  Dices,
  Settings2,
  ArrowUpRight,
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X,
  WifiOff,
  AlertCircle,
  Check,
  ExternalLink,
  Trophy,
  CalendarDays,
  TrendingUp,
  Layers,
  Minus,
  Clock3,
} from "lucide-react";
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
import {
  cleanHistory,
  filterPeriod,
  stats,
  dailyData,
  timeline,
  distribution,
  shortDate,
  fullDate,
  numeric,
  exportHistory,
  SERIES,
} from "./analytics";
import { isSupabaseConfigured } from "./config";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "players", label: "Players", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "rules", label: "House rules", icon: BookOpen },
];
function routeFromHash() {
  let hash;
  try {
    hash = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    hash = "overview";
  }
  return hash.startsWith("player=")
    ? { section: "players", player: hash.slice(7) }
    : {
        section: sections.some((s) => s.id === hash) ? hash : "overview",
        player: null,
      };
}
function Avatar({ player, size = "" }) {
  const file = {
    mubeen: "mubeen-avatar.webp",
    sohail: "sohail-avatar.webp",
    saboor: "saboor-avatar.webp",
  }[player.name.trim().toLowerCase()];
  const [failed, setFailed] = useState(false);
  return (
    <span className={`dash-avatar ${size}`} aria-hidden="true">
      {file && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${file}`}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        player.name
          .trim()
          .split(/\s+/)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
function Period({ value, onChange }) {
  return (
    <div className="dash-period" aria-label="History date range">
      {[
        ["7", "7 days"],
        ["30", "30 days"],
        ["90", "90 days"],
        ["all", "All time"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function Empty({ title = "No recorded activity", children }) {
  return (
    <div className="dash-empty">
      <Activity size={24} />
      <strong>{title}</strong>
      <p>
        {children ||
          "Score changes will appear here when history is available. Current standings are still shown."}
      </p>
    </div>
  );
}
function Panel({ title, description, action, children, className = "" }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="dash-panel-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metric({ label, value, note, icon: Icon, tone = "" }) {
  return (
    <div className={`dash-metric ${tone}`}>
      <div>
        <span>{label}</span>
        {Icon && <Icon size={16} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
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
function TrendChart({
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
function DailyChart({ events, title = "Daily penalty volume" }) {
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
                  fill="var(--chart-pink)"
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
function Distribution({ events }) {
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
function Standings({ players, onPlayer, compact = false }) {
  const total = players.reduce((s, p) => s + numeric(p.points_total), 0);
  return (
    <div className={`dash-standings ${compact ? "compact" : ""}`}>
      {players.length ? (
        players.slice(0, compact ? 6 : players.length).map((p, i) => (
          <button
            type="button"
            className="dash-standing"
            onClick={() => onPlayer(p.id)}
            key={p.id}
            aria-label={`Open ${p.name} profile, rank ${i + 1}, ${p.points_total} points`}
          >
            <span className={`dash-rank ${i === 0 ? "first" : ""}`}>
              {i === 0 ? <Trophy size={14} /> : String(i + 1).padStart(2, "0")}
            </span>
            <Avatar player={p} />
            <span className="dash-standing-name">
              <strong>{p.name}</strong>
              <small>
                {total
                  ? `${Math.round((numeric(p.points_total) / total) * 100)}% of league points`
                  : "No penalty points"}
              </small>
            </span>
            <b>
              {p.points_total}
              <small>pts</small>
            </b>
            <ArrowUpRight size={15} />
          </button>
        ))
      ) : (
        <Empty title="No players yet">
          Open the scorekeeper to add the first player.
        </Empty>
      )}
    </div>
  );
}
function EventTable({
  events,
  players,
  title = "Score history",
  paginate = true,
}) {
  const [page, setPage] = useState(0);
  const pageSize = 8;
  useEffect(() => setPage(0), [events]);
  const sorted = [...events].reverse();
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = paginate
    ? sorted.slice(current * pageSize, (current + 1) * pageSize)
    : sorted.slice(0, 5);
  const names = new Map(players.map((p) => [p.id, p.name]));
  return (
    <Panel
      title={title}
      description="Public score changes. Reasons are private to the scorekeeper."
      action={<span className="dash-count">{events.length} entries</span>}
    >
      {visible.length ? (
        <>
          <div className="dash-table-scroll">
            <table className="dash-event-table">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Player</th>
                  <th>Change</th>
                  <th>Type</th>
                  <th>Recorded at · Paris</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((event, i) => (
                  <tr key={event.event_number || i}>
                    <td className="dash-subtle">
                      #{event.event_number || "—"}
                    </td>
                    <td>{names.get(event.player_id) || "Archived player"}</td>
                    <td
                      className={
                        event.points < 0 ? "dash-negative" : "dash-positive"
                      }
                    >
                      {event.points > 0 ? "+" : ""}
                      {event.points}
                    </td>
                    <td>
                      <span
                        className={`dash-event-type ${event.points < 0 ? "correction" : ""}`}
                      >
                        {event.points < 0 ? "Correction" : "Penalty"}
                      </span>
                    </td>
                    <td>
                      <time dateTime={event.created_at}>
                        {fullDate(event.time)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginate && (
            <div className="dash-pagination">
              <span>
                {current * pageSize + 1}–
                {Math.min((current + 1) * pageSize, events.length)} of{" "}
                {events.length} entries
              </span>
              <div>
                <button
                  aria-label="Previous page"
                  disabled={current === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {current + 1} / {pages}
                </span>
                <button
                  aria-label="Next page"
                  disabled={current + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}
function PlayerDirectory({ players, events, onPlayer, limit, onViewAll }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rank");
  const filtered = players
    .filter((p) =>
      p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "recent"
          ? Math.max(
              0,
              ...events.filter((e) => e.player_id === b.id).map((e) => e.time),
            ) -
            Math.max(
              0,
              ...events.filter((e) => e.player_id === a.id).map((e) => e.time),
            )
          : players.indexOf(a) - players.indexOf(b),
    );
  return (
    <Panel
      title="League players"
      description="All-time penalty standings. Select a player to explore their record."
      action={<span className="dash-count">{players.length} players</span>}
    >
      <div className="dash-directory-tools">
        <label className="dash-search">
          <Search size={16} />
          <input
            aria-label="Search players"
            placeholder="Search players"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <select
          aria-label="Sort players"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="rank">Rank: penalty points</option>
          <option value="name">Name: A–Z</option>
          <option value="recent">Latest recorded activity</option>
        </select>
      </div>
      {filtered.length ? (
        <div className="dash-directory">
          <div className="dash-directory-head">
            <span>Rank / player</span>
            <span>Available awards</span>
            <span>Last recorded</span>
            <span>Current points</span>
          </div>
          {filtered.slice(0, limit || filtered.length).map((player) => {
            const record = events.filter((e) => e.player_id === player.id);
            const metric = stats(record);
            const rank = players.indexOf(player) + 1;
            return (
              <button
                className="dash-player-row"
                key={player.id}
                onClick={() => onPlayer(player.id)}
                aria-label={`Open ${player.name} profile, rank ${rank}, ${player.points_total} points`}
              >
                <span className="dash-player-identity">
                  <span className="dash-rank">
                    {String(rank).padStart(2, "0")}
                  </span>
                  <Avatar player={player} />
                  <span>
                    <strong>{player.name}</strong>
                    <small>
                      {rank === 1
                        ? "Highest penalty total"
                        : `${Math.max(0, numeric(players[rank - 2]?.points_total) - numeric(player.points_total))} pts to previous rank`}
                    </small>
                  </span>
                </span>
                <span className="dash-cell">
                  {metric.awards}
                  <small>{metric.corrections} corrections</small>
                </span>
                <span className="dash-cell">
                  {record.length ? shortDate(record.at(-1).time) : "No history"}
                  <small>{metric.days} recorded days</small>
                </span>
                <span className="dash-player-score">
                  <b>{player.points_total}</b>
                  <span>pts</span>
                  <ArrowUpRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dash-empty">
          <Search size={24} />
          <strong>No players match that search</strong>
          <button className="dash-button" onClick={() => setQuery("")}>
            Reset search
          </button>
        </div>
      )}
      {limit && players.length > limit && (
        <button className="dash-panel-bottom-link" onClick={onViewAll}>
          View all {players.length} players
          <ArrowUpRight size={15} />
        </button>
      )}
    </Panel>
  );
}
function Rules({ onAdmin }) {
  return (
    <div className="dash-rules-grid">
      <Panel
        title="How this league works"
        description="A clear record keeps the table talk friendly."
      >
        <div className="dash-rules-copy">
          <h3>These are penalty points</h3>
          <p>
            The highest point total ranks first. This board measures recorded
            penalties, not victories, skill, or games played.
          </p>
          <h3>Ties keep a stable order</h3>
          <p>
            Equal totals are ordered by when players were created, with the
            earlier player listed first. Equal points remain equal, even when
            the displayed positions differ.
          </p>
          <h3>Every award needs a reason</h3>
          <p>
            A scorekeeper selects a player, awards a whole number from 1 to 999,
            adds a reason, and explicitly confirms the receipt before
            publishing.
          </p>
          <h3>Corrections preserve the record</h3>
          <p>
            A signed adjustment changes a score without erasing an earlier
            award. Negative corrections cannot reduce a player’s total below
            zero.
          </p>
          <button className="dash-button primary" onClick={onAdmin}>
            <Settings2 size={16} />
            Open scorekeeper
          </button>
        </div>
      </Panel>
      <Panel
        title="Understanding the analytics"
        description="What the available data can tell you."
      >
        <div className="dash-rules-copy">
          <h3>Current scores and history are different</h3>
          <p>
            Standings show current all-time totals. Charts show only available
            recorded changes in the selected period. Older or opening balances
            may not be present in history.
          </p>
          <h3>Dates use Europe/Paris</h3>
          <p>
            Daily charts group entries by the local date in Évry. Timeline
            spacing follows actual timestamps. Missing activity does not prove
            that no games were played.
          </p>
          <h3>Privacy stays with the scorekeeper</h3>
          <p>
            Public records include point changes, timestamps and entry numbers.
            Private reasons and signed receipts are available only in the
            scorekeeper.
          </p>
          <h3>Match statistics need match records</h3>
          <p>
            Win rates, opponents, attendance and winning streaks are not
            calculated because this scorebook does not record complete match
            results.
          </p>
        </div>
      </Panel>
    </div>
  );
}
function Profile({ player, players, events, onBack, period, setPeriod }) {
  const [compare, setCompare] = useState("");
  const all = useMemo(
    () => events.filter((e) => e.player_id === player.id),
    [events, player.id],
  );
  const visible = useMemo(() => filterPeriod(all, period), [all, period]);
  const metric = stats(visible);
  const rank = players.findIndex((p) => p.id === player.id) + 1;
  const total = players.reduce((s, p) => s + numeric(p.points_total), 0);
  const other =
    players.find((p) => p.id === compare) ||
    players.find((p) => p.id !== player.id);
  const selected = other ? [player, other] : [player];
  const gap =
    rank > 1
      ? numeric(players[rank - 2].points_total) - numeric(player.points_total)
      : 0;
  return (
    <>
      <button className="dash-back" onClick={onBack}>
        <ArrowLeft size={16} />
        All players
      </button>
      <section className="dash-profile-header">
        <Avatar player={player} size="large" />
        <div className="dash-profile-name">
          <h1>{player.name}</h1>
          <p>
            Player since{" "}
            {Number.isFinite(new Date(player.created_at).getTime())
              ? shortDate(player.created_at)
              : "date unavailable"}
            <span>
              Rank #{rank} of {players.length}
            </span>
          </p>
        </div>
        <div className="dash-profile-score">
          <strong>{player.points_total}</strong>
          <span>Current penalty points</span>
        </div>
        <button
          className="dash-button"
          disabled={!visible.length}
          onClick={() =>
            exportHistory(visible, players, "ludo-player-history.csv")
          }
        >
          <Download size={16} />
          Export history
        </button>
      </section>
      <div className="dash-metrics">
        <Metric
          label="Current position"
          value={`#${rank}`}
          note={
            rank === 1
              ? "Highest penalty total"
              : `${gap} points to previous rank`
          }
          icon={Trophy}
        />
        <Metric
          label="Share of league points"
          value={`${total ? ((numeric(player.points_total) / total) * 100).toFixed(1) : "0"}%`}
          note={`${player.points_total} of ${total} all-time points`}
          icon={Layers}
        />
        <Metric
          label="Recorded awards"
          value={metric.awards}
          note={`${metric.positive} points awarded in period`}
          icon={Activity}
        />
        <Metric
          label="Average penalty"
          value={metric.average.toFixed(1)}
          note={`${metric.corrections} corrections in period`}
          icon={TrendingUp}
        />
      </div>
      <div className="dash-section-toolbar">
        <div>
          <h2>Player analysis</h2>
          <p>
            Available score changes ·{" "}
            {period === "all" ? "all time" : `last ${period} days`}
          </p>
        </div>
        <Period value={period} onChange={setPeriod} />
      </div>
      <div className="dash-profile-chart-grid">
        <TrendChart
          events={events}
          players={selected}
          period={period}
          title="Score timeline"
          description="Net change from the start of the selected period"
        />
        <Panel
          title="Compare records"
          description="Current totals are all-time; award metrics use the selected period."
        >
          <label className="dash-compare-label">
            Compare with
            <select
              aria-label="Compare with player"
              value={other?.id || ""}
              onChange={(e) => setCompare(e.target.value)}
              disabled={!other}
            >
              {players
                .filter((p) => p.id !== player.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="dash-comparison">
            <div className="dash-compare-names">
              <span>{player.name}</span>
              <span>{other?.name || "No other player"}</span>
            </div>
            {[
              [
                "Current points",
                player.points_total,
                other?.points_total ?? "—",
              ],
              [
                "Awards in period",
                metric.awards,
                other
                  ? stats(
                      filterPeriod(
                        events.filter((e) => e.player_id === other.id),
                        period,
                      ),
                    ).awards
                  : "—",
              ],
              [
                "Largest penalty",
                metric.largest,
                other
                  ? stats(
                      filterPeriod(
                        events.filter((e) => e.player_id === other.id),
                        period,
                      ),
                    ).largest
                  : "—",
              ],
              [
                "Recorded days",
                metric.days,
                other
                  ? stats(
                      filterPeriod(
                        events.filter((e) => e.player_id === other.id),
                        period,
                      ),
                    ).days
                  : "—",
              ],
            ].map(([label, a, b]) => (
              <div key={label}>
                <b>{a}</b>
                <span>{label}</span>
                <b>{b}</b>
              </div>
            ))}
          </div>
          <p className="dash-panel-note">
            A comparison of penalty records, not head-to-head game results.
          </p>
        </Panel>
      </div>
      <div className="dash-two-col">
        <DailyChart events={visible} title="Player activity by day" />
        <Distribution events={visible} />
      </div>
      <div className="dash-record-details">
        <span>
          <Clock3 size={15} />
          First entry{" "}
          <b>{all.length ? shortDate(all[0].time) : "No history"}</b>
        </span>
        <span>
          Latest entry{" "}
          <b>{all.length ? fullDate(all.at(-1).time) : "No history"}</b>
        </span>
        <span>
          Corrections in period{" "}
          <b className="dash-negative">{metric.corrected}</b>
        </span>
        <span>
          Net period change{" "}
          <b>
            {metric.net > 0 ? "+" : ""}
            {metric.net}
          </b>
        </span>
      </div>
      <EventTable events={visible} players={players} />
    </>
  );
}
export default function Dashboard({
  players,
  history,
  loading,
  error,
  online,
  refreshing,
  lastUpdated,
  onRefresh,
  onOpenAdmin,
  darkMode,
  onToggleTheme,
}) {
  const [route, setRoute] = useState(routeFromHash);
  const [menu, setMenu] = useState(false);
  const [period, setPeriod] = useState("all");
  const events = useMemo(() => cleanHistory(history), [history]);
  const selectedEvents = useMemo(
    () => filterPeriod(events, period),
    [events, period],
  );
  const metric = stats(selectedEvents);
  const total = players.reduce((s, p) => s + numeric(p.points_total), 0);
  const profile = route.player
    ? players.find((p) => p.id === route.player)
    : null;
  useEffect(() => {
    const update = () => {
      setRoute(routeFromHash());
      setMenu(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const navigate = (id) => {
    window.location.hash = id;
    setMenu(false);
  };
  const openPlayer = (id) => navigate(`player=${encodeURIComponent(id)}`);
  return (
    <div className={`dash-app ${menu ? "dash-menu-open" : ""}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to dashboard
      </a>
      <aside className="dash-sidebar">
        <a className="dash-brand" href="#overview">
          <span>
            <Dices size={24} />
          </span>
          <div>
            <strong>Ludo</strong>
            <small>Super League</small>
          </div>
        </a>
        <div className="dash-league-label">
          <span className="dash-season-mark">26</span>
          <div>
            <strong>Évry league</strong>
            <small>2026 season</small>
          </div>
        </div>
        <nav aria-label="League navigation">
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              href={`#${id}`}
              key={id}
              aria-current={route.section === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {id === "players" && <span>{players.length}</span>}
            </a>
          ))}
        </nav>
        <div className="dash-sidebar-bottom">
          <div className="dash-private">
            <Settings2 size={18} />
            <strong>Keep the record fair</strong>
            <p>Manage players and publish signed score changes.</p>
            <button className="dash-button" onClick={onOpenAdmin}>
              Open scorekeeper
              <ArrowUpRight size={16} />
            </button>
          </div>
          <p>
            Friendly competition.
            <br />
            Every point accounted for.
          </p>
        </div>
      </aside>
      <div className="dash-workspace">
        <header className="dash-topbar">
          <div className="dash-breadcrumb">
            <button
              className="dash-menu-button"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Ludo Super League</span>
            <ChevronRight size={14} />
            <strong>
              {profile
                ? "Player profile"
                : sections.find((s) => s.id === route.section)?.label}
            </strong>
          </div>
          <div className="dash-top-actions">
            <span className={`dash-status ${!online ? "offline" : ""}`}>
              <i />
              {!online
                ? "Offline"
                : refreshing
                  ? "Updating"
                  : lastUpdated
                    ? "Scores loaded"
                    : "Connecting"}
            </span>
            <button
              className="dash-icon-button"
              aria-label={
                darkMode ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={onToggleTheme}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="dash-button primary" onClick={onOpenAdmin}>
              <Settings2 size={16} />
              <span>Scorekeeper</span>
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="dash-main">
          {!online && (
            <div className="dash-banner" role="status">
              <WifiOff size={17} />
              <span>
                You are offline. Showing the last loaded scores; reconnect to
                receive updates.
              </span>
            </div>
          )}
          {error && (
            <div className="dash-banner error" role="alert">
              <AlertCircle size={18} />
              <span>{error} Previously loaded scores may be out of date.</span>
              <button onClick={onRefresh}>Try again</button>
            </div>
          )}
          {!isSupabaseConfigured && (
            <div className="dash-demo-note">
              <span>Demo workspace</span> Sample data in this browser. Live
              league scores are unchanged.
            </div>
          )}
          {loading ? (
            <div
              className="dash-skeleton"
              aria-label="Loading league"
              role="status"
            >
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : route.player && !profile ? (
            <>
              <h1>Player unavailable</h1>
              <Empty title="This player is no longer on the active table">
                They may have been archived, or this profile link is incorrect.
              </Empty>
              <button
                className="dash-button"
                onClick={() => navigate("players")}
              >
                Back to players
              </button>
            </>
          ) : profile ? (
            <Profile
              key={profile.id}
              player={profile}
              players={players}
              events={events}
              onBack={() => navigate("players")}
              period={period}
              setPeriod={setPeriod}
            />
          ) : (
            <>
              <div className="dash-page-heading">
                <div>
                  <h1>
                    {route.section === "overview"
                      ? "League overview"
                      : route.section === "players"
                        ? "The players"
                        : route.section === "activity"
                          ? "Score activity"
                          : "House rules"}
                  </h1>
                  <p>
                    {route.section === "overview"
                      ? "The state of the table, without the table talk."
                      : route.section === "players"
                        ? "Every player, every point, a record to explore."
                        : route.section === "activity"
                          ? "Follow the changes behind the current standings."
                          : "How scores, rankings, and records work."}
                  </p>
                </div>
                <div className="dash-page-actions">
                  <button
                    className="dash-button"
                    onClick={onRefresh}
                    disabled={refreshing || !online}
                  >
                    <RefreshCw
                      size={15}
                      className={refreshing ? "dash-spinning" : ""}
                    />
                    {refreshing ? "Refreshing" : "Refresh"}
                  </button>
                  <button
                    className="dash-button"
                    disabled={!selectedEvents.length}
                    onClick={() => exportHistory(selectedEvents, players)}
                  >
                    <Download size={15} />
                    Export
                  </button>
                </div>
              </div>
              {(route.section === "overview" ||
                route.section === "activity") && (
                <>
                  <div className="dash-metrics">
                    <Metric
                      label="League players"
                      value={players.length}
                      note="Active on the current table"
                      icon={Users}
                    />
                    <Metric
                      label="Total penalty points"
                      value={total}
                      note="Current all-time league total"
                      icon={Layers}
                      tone="accent"
                    />
                    <Metric
                      label="Recorded awards"
                      value={metric.awards}
                      note={`${metric.positive} points in selected period`}
                      icon={Activity}
                    />
                    <Metric
                      label="Average penalty"
                      value={metric.average.toFixed(1)}
                      note={`${metric.corrections} corrections in selected period`}
                      icon={TrendingUp}
                    />
                  </div>
                  <div className="dash-section-toolbar">
                    <div className="dash-analysis-label">
                      <span className="dash-dot" />
                      Available score history
                      <small>
                        {events.length
                          ? `${shortDate(events[0].time)} – ${shortDate(events.at(-1).time)}`
                          : "No recorded history"}
                      </small>
                    </div>
                    <Period value={period} onChange={setPeriod} />
                  </div>
                </>
              )}
              {route.section === "overview" && (
                <>
                  <div className="dash-overview-grid">
                    <TrendChart
                      events={events}
                      players={players.slice(0, 3)}
                      period={period}
                      title="Penalty race"
                      description="Net recorded changes for the current top three"
                    />
                    <Panel
                      title="Current standings"
                      description="All-time · highest penalty total first"
                      action={
                        <button
                          className="dash-panel-link"
                          onClick={() => navigate("players")}
                        >
                          View all
                          <ArrowUpRight size={14} />
                        </button>
                      }
                    >
                      <Standings
                        players={players}
                        onPlayer={openPlayer}
                        compact
                      />
                      <div className="dash-panel-note">
                        Equal totals use the earlier player’s creation order.
                      </div>
                    </Panel>
                  </div>
                  <div className="dash-two-col">
                    <DailyChart events={selectedEvents} />
                    <Distribution events={selectedEvents} />
                  </div>
                  <div className="dash-overview-grid">
                    <PlayerDirectory
                      players={players}
                      events={events}
                      onPlayer={openPlayer}
                      limit={6}
                      onViewAll={() => navigate("players")}
                    />
                    <Panel
                      title="Latest changes"
                      description="Most recent in the selected period"
                      action={<Activity size={16} />}
                    >
                      <div className="dash-recent">
                        {[...selectedEvents]
                          .reverse()
                          .slice(0, 6)
                          .map((event, i) => {
                            const p = players.find(
                              (p) => p.id === event.player_id,
                            );
                            return (
                              <div key={event.event_number || i}>
                                <span
                                  className={`dash-change ${event.points < 0 ? "negative" : ""}`}
                                >
                                  {event.points > 0 ? "+" : ""}
                                  {event.points}
                                </span>
                                <div>
                                  <strong>
                                    {p?.name || "Archived player"}
                                  </strong>
                                  <small>{fullDate(event.time)}</small>
                                </div>
                                <span>#{event.event_number || "—"}</span>
                              </div>
                            );
                          })}
                        {!selectedEvents.length && <Empty />}
                      </div>
                      <button
                        className="dash-panel-bottom-link"
                        onClick={() => navigate("activity")}
                      >
                        Explore score activity
                        <ArrowUpRight size={15} />
                      </button>
                    </Panel>
                  </div>
                </>
              )}
              {route.section === "players" && (
                <PlayerDirectory
                  players={players}
                  events={events}
                  onPlayer={openPlayer}
                />
              )}
              {route.section === "activity" && (
                <>
                  <div className="dash-two-col">
                    <DailyChart events={selectedEvents} />
                    <Distribution events={selectedEvents} />
                  </div>
                  <EventTable events={selectedEvents} players={players} />
                </>
              )}
              {route.section === "rules" && <Rules onAdmin={onOpenAdmin} />}
            </>
          )}
          <footer className="dash-footer">
            <span>Ludo Super League · Évry 2026</span>
            <span>
              {lastUpdated
                ? `Last loaded ${fullDate(lastUpdated)}`
                : "Waiting for the first successful refresh"}
              <span className="dash-footer-dot">·</span>Times in Europe/Paris
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
