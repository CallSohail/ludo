import { Avatar } from "./PlayerAvatar";
import Sheet from "./Sheet";
import Verification from "./Verification";
import Certificates, { LeaderSpotlight } from "./Certificates";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Empty, Panel } from "./ScorebookPanel";
import {
  Award,
  Trophy,
  Plus,
  Users,
  Activity,
  BookOpen,
  ShieldCheck,
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
  X,
  WifiOff,
  AlertCircle,
  Check,
  ExternalLink,
  CalendarDays,
  TrendingUp,
  Layers,
  Minus,
  Clock3,
} from "lucide-react";

import {
  cleanHistory,
  filterPeriod,
  stats,
  shortDate,
  fullDate,
  numeric,
  exportHistory,
  relativeDate,
} from "./analytics";
import { isSupabaseConfigured } from "./config";

const sections = [
  { id: "overview", label: "Standings", icon: Trophy },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "players", label: "Players", icon: Users },
  { id: "rules", label: "Rules", icon: BookOpen },
];
function routeFromHash() {
  let hash;
  try {
    hash = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    hash = "overview";
  }
  if (hash === "scorekeeper") return { section: "scorekeeper" };
  if (hash === "certificates") return { section: "certificates" };
  if (hash === "verify" || hash.startsWith("verify="))
    return { section: "verify", verification: hash.slice(7) };
  if (hash.startsWith("issued="))
    return {
      section: "verify",
      verification: hash.slice(7),
      showCertificate: true,
    };
  if (hash.startsWith("certificates="))
    return {
      section: "certificates",
      player: null,
      certificate: hash.slice(13),
    };
  return hash.startsWith("player=")
    ? { section: "players", player: hash.slice(7) }
    : {
        section: sections.some((s) => s.id === hash) ? hash : "overview",
        player: null,
      };
}
const charts = {
  TrendChart: lazy(() =>
    import("./ScoreCharts").then((module) => ({ default: module.TrendChart })),
  ),
  DailyChart: lazy(() =>
    import("./ScoreCharts").then((module) => ({ default: module.DailyChart })),
  ),
  Distribution: lazy(() =>
    import("./ScoreCharts").then((module) => ({
      default: module.Distribution,
    })),
  ),
  RankChart: lazy(() =>
    import("./ScoreCharts").then((module) => ({ default: module.RankChart })),
  ),
};

class ChartRecovery extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <Panel title="Chart unavailable">
          <Empty title="The chart couldn’t load">
            The scorebook is still available.{" "}
            <button
              className="dash-button"
              onClick={() => window.location.reload()}
            >
              Reload the chart
            </button>
          </Empty>
        </Panel>
      );
    return this.props.children;
  }
}

function DeferredChart({ chart, deferred = false, ...props }) {
  const wrapper = useRef(null);
  const [visible, setVisible] = useState(!deferred);
  useEffect(() => {
    if (!deferred) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [deferred]);
  const Chart = charts[chart];
  const placeholder = (
    <div className="dash-chart-placeholder" role="status">
      {props.title || "Chart"} is loading…
    </div>
  );
  return (
    <div ref={wrapper} className="dash-chart-slot">
      {visible ? (
        <ChartRecovery>
          <Suspense fallback={placeholder}>
            <Chart {...props} />
          </Suspense>
        </ChartRecovery>
      ) : (
        placeholder
      )}
    </div>
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
function Metric({ label, value, note, description, icon: Icon, tone = "" }) {
  return (
    <div className={`dash-metric ${tone}`} title={description}>
      <div>
        <span>{label}</span>
        {Icon && <Icon size={16} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
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
      description="Penalties, corrections, and starting balances."
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
                  <th>Reason</th>
                  <th>Recorded at · Paris</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((event, i) => (
                  <tr key={event.event_number || i}>
                    <td className="dash-subtle">
                      #{event.event_number || "—"}
                    </td>
                    <td>
                      {names.get(event.player_id) ||
                        event.player_name ||
                        "Archived player"}
                    </td>
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
                        {event.starting_balance
                          ? "Starting balance"
                          : event.event_type === "adjustment" ||
                              event.points < 0
                            ? "Correction"
                            : "Penalty"}
                      </span>
                    </td>
                    <td>{event.reason || "Private"}</td>
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
function Rules({ onAdmin, adminUser }) {
  return (
    <section className="dash-panel rules-reading">
      <details open>
        <summary>How penalties work</summary>
        <p>
          Each witnessed penalty adds 1 to 999 whole points to a player’s total.
          The person with the most penalty points holds the crown. If two
          players have the same total, the player added earlier appears first.
        </p>
      </details>
      <details>
        <summary>Corrections and the ledger</summary>
        <p>
          Corrections add a signed entry and keep the original entry in the
          ledger. A correction cannot bring a player below zero. The scorekeeper
          who published a penalty has ten seconds to undo it.
        </p>
      </details>
      <details>
        <summary>History, opening balances, and dates</summary>
        <p>
          The opening day is marked as a starting balance. Its points count in
          the standings, totals, and ledger. The charts show movement after the
          starting balance. Times use Europe/Paris. Archived players remain in
          the ledger.
        </p>
      </details>
      <details>
        <summary>Reasons and certificates</summary>
        <p>
          Reasons are private unless a scorekeeper shares them in activity or
          approves them for a certificate. Verify an issued certificate to see
          its original recipient and details.
        </p>
        <div className="score-inline">
          <a className="dash-button" href="#certificates">
            Browse certificates
          </a>
          <a className="dash-button" href="#verify">
            Verify a certificate
          </a>
        </div>
      </details>
      <details>
        <summary>Scorekeeper access</summary>
        <p>
          Approved scorekeepers can record penalties, manage players, and check
          signed receipts.
        </p>
        <button className="dash-button" onClick={() => onAdmin("sign-in")}>
          {adminUser ? "Open scorekeeper" : "Scorekeeper sign in"}
        </button>
      </details>
    </section>
  );
}

function Profile({
  player,
  players,
  events,
  onBack,
  period,
  setPeriod,
  onCertificate,
}) {
  const [compare, setCompare] = useState("");
  const all = useMemo(
    () => events.filter((e) => e.player_id === player.id),
    [events, player.id],
  );
  const visible = useMemo(() => filterPeriod(all, period), [all, period]);
  const motion = useMemo(
    () => all.filter((event) => !event.starting_balance),
    [all],
  );
  const visibleMotion = useMemo(
    () => filterPeriod(motion, period),
    [motion, period],
  );
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
          <h2 id="player-sheet-title">{player.name}</h2>
          <p>
            Player since{" "}
            {Number.isFinite(new Date(player.created_at).getTime())
              ? shortDate(player.created_at)
              : "date unavailable"}
            <span>
              Rank #{rank} of {players.length}
            </span>
          </p>
          <button
            type="button"
            className="dash-panel-link profile-certificate-link"
            onClick={() => onCertificate(player.id)}
          >
            <Award size={16} />
            View player certificate
          </button>
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
      <DeferredChart
        chart="RankChart"
        events={events}
        players={players}
        player={player}
      />
      <EventTable
        title="Recent entries"
        events={visible}
        players={players}
        paginate={false}
      />
      <details className="player-deep-dive">
        <summary>Full player analysis</summary>
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
          <DeferredChart
            chart="TrendChart"
            events={events.filter((event) => !event.starting_balance)}
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
          <DeferredChart
            chart="DailyChart"
            events={visibleMotion}
            title="Player activity by day"
          />
          <DeferredChart chart="Distribution" events={visibleMotion} />
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
      </details>
    </>
  );
}
export default function Dashboard({
  adminUser,
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
  const handledHash = useRef(window.location.hash);
  const profileOrigin = useRef("players");
  const section = route.player ? profileOrigin.current : route.section;
  const [period, setPeriod] = useState("all");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [ledgerPlayer, setLedgerPlayer] = useState("");
  const events = useMemo(() => cleanHistory(history), [history]);
  const profile =
    route.player && players.find((player) => player.id === route.player);
  const eventPlayers = useMemo(
    () =>
      new Map([
        ...events.map((event) => [
          event.player_id,
          event.player_name || "Archived player",
        ]),
        ...players.map((player) => [player.id, player.name]),
      ]),
    [events, players],
  );
  const selected = useMemo(() => {
    const query = ledgerQuery.trim().toLowerCase();
    return filterPeriod(events, period).filter(
      (event) =>
        (!ledgerPlayer || event.player_id === ledgerPlayer) &&
        (!query ||
          `${event.event_number} ${eventPlayers.get(event.player_id)} ${event.reason || ""}`
            .toLowerCase()
            .includes(query)),
    );
  }, [events, period, ledgerPlayer, ledgerQuery, eventPlayers]);
  const movements = useMemo(
    () => selected.filter((event) => !event.starting_balance),
    [selected],
  );
  const overviewMovements = useMemo(
    () => events.filter((event) => !event.starting_balance),
    [events],
  );
  const metric = stats(selected);
  const opening = metric.net - stats(movements).net;
  useEffect(() => {
    const update = () => {
      if (window.location.hash === handledHash.current) return;
      handledHash.current = window.location.hash;
      const next = routeFromHash();
      setRoute(next);
      if (!next.player) window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  function navigate(id, keepPosition = false) {
    window.location.hash = id;
    handledHash.current = window.location.hash;
    const next = routeFromHash();
    setRoute(next);
    if (!keepPosition && !next.player)
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openPlayer(id) {
    profileOrigin.current = section;
    navigate(`player=${encodeURIComponent(id)}`);
  }
  const openCertificate = (id) =>
    navigate(`certificates=${encodeURIComponent(id)}`);
  const tab =
    section === "certificates" || section === "verify" ? "players" : section;
  const title = {
    overview: "League standings",
    players: "The players",
    activity: "Score activity",
    certificates: "Player certificates",
    rules: "House rules",
  }[section];
  const latest = [...events]
    .reverse()
    .filter((event) => !event.starting_balance)
    .slice(0, 4);
  const tableTotal = players.reduce(
    (sum, player) => sum + numeric(player.points_total),
    0,
  );

  return (
    <div className="dash-app premium-scorebook" data-section={section}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to scorebook
      </a>
      <header className="dash-topbar">
        <a href="#overview" className="dash-brand">
          <span>
            <Dices size={22} />
          </span>
          <div>
            <strong>Ludo</strong>
            <small>Super League</small>
          </div>
        </a>
        <nav className="league-dock" aria-label="League navigation">
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                navigate(id);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="dash-top-actions">
          <button
            className="dash-icon-button"
            type="button"
            aria-label={
              darkMode ? "Switch to light theme" : "Switch to dark theme"
            }
            onClick={onToggleTheme}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {adminUser && (
            <>
              <button
                className="dash-button primary scorekeeper-desktop"
                onClick={onOpenAdmin}
              >
                <Settings2 size={16} />
                Scorekeeper
              </button>
              <button
                className="scorekeeper-fab"
                aria-label="Open scorekeeper"
                onClick={onOpenAdmin}
              >
                <Plus size={23} />
              </button>
            </>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="dash-main">
        {!online && (
          <div className="dash-banner" role="status">
            <WifiOff size={17} />
            <span>You are offline. Showing the last loaded scores.</span>
          </div>
        )}
        {error && (
          <div className="dash-banner error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={onRefresh}>Retry</button>
          </div>
        )}
        {!isSupabaseConfigured && (
          <p className="dash-demo-note">Demo workspace</p>
        )}
        {section === "verify" ? (
          <Verification
            id={route.verification}
            showCertificate={route.showCertificate}
            adminUser={adminUser}
            onOpenAdmin={onOpenAdmin}
          />
        ) : section === "scorekeeper" ? (
          <Panel
            title={
              adminUser ? "Scorekeeper" : "Scorekeeper access is restricted"
            }
          >
            <div className="rules-reading">
              <p>
                {adminUser
                  ? "Open the scorekeeper to record or correct a score."
                  : "This area is for approved scorekeepers."}
              </p>
              {adminUser ? (
                <button className="dash-button" onClick={onOpenAdmin}>
                  Open scorekeeper
                </button>
              ) : (
                <a className="dash-button" href="#rules">
                  Back to house rules
                </a>
              )}
            </div>
          </Panel>
        ) : loading ? (
          <div
            className="dash-skeleton"
            aria-label="Loading league scores"
            role="status"
          >
            <div />
            <div />
            <div />
          </div>
        ) : (
          <>
            <div className="dash-page-heading">
              <div>
                <p className="season-label">Évry, 2026</p>
                <h1>{title}</h1>
                {section === "overview" && (
                  <p>The league’s penalty scorebook.</p>
                )}
              </div>
              <div className="dash-page-actions">
                {section === "certificates" && (
                  <a className="dash-button" href="#verify">
                    <ShieldCheck size={16} />
                    Verify a certificate
                  </a>
                )}
                {section === "players" && (
                  <a className="dash-button" href="#certificates">
                    <Award size={16} />
                    Certificates
                  </a>
                )}
                {["overview", "activity"].includes(section) && (
                  <button
                    className="dash-button refresh-action"
                    aria-label={refreshing ? "Refreshing" : "Refresh"}
                    disabled={refreshing || !online}
                    onClick={onRefresh}
                  >
                    <RefreshCw size={16} />
                    <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
                  </button>
                )}
              </div>
            </div>
            {section === "overview" && (
              <>
                <LeaderSpotlight
                  players={players}
                  onPlayer={openPlayer}
                  onCertificate={openCertificate}
                />
                <div className="scorebook-grid">
                  <Panel
                    title="Leaderboard"
                    description={`${players.length} active players · ${tableTotal} penalty points`}
                    className="scorebook-leaderboard"
                  >
                    <Standings players={players} onPlayer={openPlayer} />
                  </Panel>
                  <div className="scorebook-side">
                    <Panel
                      title="Latest changes"
                      action={
                        <a className="dash-panel-link" href="#activity">
                          See all activity
                        </a>
                      }
                    >
                      {latest.length ? (
                        <ul className="latest-feed">
                          {latest.map((event) => (
                            <li key={event.event_number || event.time}>
                              <b className="score-delta">
                                {event.points > 0 ? "+" : ""}
                                {event.points}
                              </b>
                              <div>
                                <strong>
                                  {eventPlayers.get(event.player_id)}
                                </strong>
                                <p>{event.reason || "Reason kept private"}</p>
                              </div>
                              <time
                                dateTime={event.created_at}
                                title={fullDate(event.time)}
                              >
                                {relativeDate(
                                  event.time,
                                  lastUpdated?.getTime(),
                                )}
                              </time>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Empty title="No recent changes" />
                      )}
                    </Panel>
                    {!!events.some((event) => event.starting_balance) && (
                      <p className="starting-note">
                        <strong>Starting balance</strong>{" "}
                        {
                          stats(
                            events.filter((event) => event.starting_balance),
                          ).net
                        }{" "}
                        opening points stay in the standings. The chart begins
                        with later changes.
                      </p>
                    )}
                    <DeferredChart
                      chart="TrendChart"
                      deferred
                      events={overviewMovements}
                      players={players.slice(0, 3)}
                      period="all"
                      title="Penalty race"
                      description="Recorded movement for the current top three"
                    />
                  </div>
                </div>
              </>
            )}
            {section === "players" && (
              <>
                <PlayerDirectory
                  players={players}
                  events={events}
                  onPlayer={openPlayer}
                />
                {route.player && !profile && (
                  <Empty title="Player unavailable">
                    This player may have been archived or the link may be
                    incorrect.
                  </Empty>
                )}
              </>
            )}
            {section === "activity" && (
              <>
                <section
                  className="dash-panel activity-filters"
                  aria-label="Filter activity"
                >
                  <label>
                    Search entries
                    <input
                      type="search"
                      placeholder="Name, reason, or entry number"
                      value={ledgerQuery}
                      onChange={(event) => setLedgerQuery(event.target.value)}
                    />
                  </label>
                  <label>
                    Player
                    <select
                      aria-label="Player"
                      value={ledgerPlayer}
                      onChange={(event) => setLedgerPlayer(event.target.value)}
                    >
                      <option value="">All players</option>
                      {[...eventPlayers]
                        .sort((a, b) => a[1].localeCompare(b[1]))
                        .map(([id, name]) => (
                          <option value={id} key={id}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Period value={period} onChange={setPeriod} />
                  <button
                    className="dash-button"
                    disabled={!selected.length}
                    onClick={() => exportHistory(selected, players)}
                  >
                    <Download size={16} />
                    Export
                  </button>
                </section>
                <div className="dash-metrics">
                  <Metric
                    label="Net recorded points"
                    value={metric.net}
                    note="Gross points minus negative changes"
                    description={`${metric.positive} gross points minus ${-metric.corrected} removed equals ${metric.net} net points.`}
                    icon={Layers}
                  />
                  <Metric
                    label="Gross points"
                    value={metric.positive}
                    note={`${-metric.corrected} points removed`}
                    icon={Activity}
                  />
                  <Metric
                    label="Average penalty"
                    value={stats(movements).average.toFixed(1)}
                    note="Excludes starting balances"
                    icon={TrendingUp}
                  />
                  <Metric
                    label="Entries"
                    value={metric.count}
                    note={`${metric.corrections} negative changes`}
                    icon={CalendarDays}
                  />
                </div>
                {!!opening && (
                  <p className="starting-note">
                    <strong>Starting balance</strong> {opening} points are
                    included in the totals and excluded from chart scales.
                  </p>
                )}
                <div className="dash-two-col">
                  <DeferredChart chart="DailyChart" events={movements} />
                  <DeferredChart chart="Distribution" events={movements} />
                </div>
                <EventTable events={selected} players={players} />
              </>
            )}
            {section === "certificates" && (
              <>
                <LeaderSpotlight
                  players={players}
                  onPlayer={openPlayer}
                  onCertificate={openCertificate}
                />
                <Certificates
                  players={players}
                  events={events}
                  lastUpdated={lastUpdated}
                  selectedId={route.certificate}
                  onSelect={openCertificate}
                  adminUser={adminUser}
                  onOpenAdmin={onOpenAdmin}
                />
              </>
            )}
            {section === "rules" && (
              <Rules onAdmin={onOpenAdmin} adminUser={adminUser} />
            )}
          </>
        )}
        {profile && (
          <Sheet
            label="Close player sheet"
            titleId="player-sheet-title"
            className="player-sheet"
            onClose={() => navigate(profileOrigin.current, true)}
          >
            <Profile
              key={profile.id}
              player={profile}
              players={players}
              events={events}
              onBack={() => navigate("players")}
              period={period}
              setPeriod={setPeriod}
              onCertificate={openCertificate}
            />
          </Sheet>
        )}
        <footer className="dash-footer">
          <span>Ludo Super League · Évry 2026</span>
          <span>
            {lastUpdated
              ? `Updated ${fullDate(lastUpdated)} (Paris)`
              : "Waiting for scores"}
          </span>
        </footer>
      </main>
    </div>
  );
}
