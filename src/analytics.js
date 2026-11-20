export const PARIS = "Europe/Paris";
export const SERIES = [
  "var(--chart-green)",
  "var(--chart-gray)",
  "var(--chart-blue)",
  "var(--chart-stone)",
];
export const numeric = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
export const dayKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const shortDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
export const fullDate = (value) =>
  Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: PARIS,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Date unavailable";
export function cleanHistory(history = []) {
  const seen = new Set();
  return history
    .filter((event) => {
      if (
        !event ||
        !event.player_id ||
        !Number.isFinite(new Date(event.created_at).getTime()) ||
        !Number.isFinite(Number(event.points))
      )
        return false;
      const key = event.event_number
        ? `event-${event.event_number}`
        : `${event.player_id}-${event.created_at}-${event.points}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((event) => ({
      ...event,
      points: Number(event.points),
      time: new Date(event.created_at).getTime(),
    }))
    .sort(
      (a, b) =>
        a.time - b.time || numeric(a.event_number) - numeric(b.event_number),
    );
}
export function filterPeriod(events, period, now = Date.now()) {
  return period === "all"
    ? events
    : events.filter(
        (event) =>
          event.time >= now - Number(period) * 86400000 && event.time <= now,
      );
}
export function stats(events) {
  const awards = events.filter((e) => e.points > 0);
  const corrections = events.filter((e) => e.points < 0);
  return {
    count: events.length,
    awards: awards.length,
    positive: awards.reduce((s, e) => s + e.points, 0),
    corrections: corrections.length,
    corrected: corrections.reduce((s, e) => s + e.points, 0),
    net: events.reduce((s, e) => s + e.points, 0),
    average: awards.length
      ? awards.reduce((s, e) => s + e.points, 0) / awards.length
      : 0,
    largest: Math.max(0, ...awards.map((e) => e.points)),
    days: new Set(events.map((e) => dayKey(e.time))).size,
  };
}
export function dailyData(events) {
  const rows = new Map();
  for (const event of events) {
    const day = dayKey(event.time);
    if (!rows.has(day))
      rows.set(day, {
        day,
        // Calendar-day anchor: noon UTC always falls on this date in Paris.
        time: Date.parse(`${day}T12:00:00Z`),
        awards: 0,
        corrections: 0,
        count: 0,
      });
    const row = rows.get(day);
    row.count++;
    if (event.points > 0) row.awards += event.points;
    else row.corrections += event.points;
  }
  return [...rows.values()].sort((a, b) => a.time - b.time);
}
export function timeline(events, players, period = "all", now = Date.now()) {
  const ids = new Set(players.map((p) => p.id));
  const relevant = events.filter((e) => ids.has(e.player_id));
  const visible = filterPeriod(relevant, period, now);
  if (!visible.length) return [];
  const totals = Object.fromEntries(players.map((p) => [p.id, 0]));
  const rows = [{ time: visible[0].time - 1, ...totals }];
  for (const event of visible) {
    totals[event.player_id] += event.points;
    rows.push({ time: event.time, ...totals });
  }
  if (rows.at(-1).time === rows[0].time) rows[0].time -= 1000;
  return rows;
}
export function distribution(events) {
  return [
    { label: "1 point", min: 1, max: 1 },
    { label: "2 points", min: 2, max: 2 },
    { label: "3–5", min: 3, max: 5 },
    { label: "6–9", min: 6, max: 9 },
    { label: "10+", min: 10, max: Infinity },
  ].map((bin) => ({
    ...bin,
    count: events.filter((e) => e.points >= bin.min && e.points <= bin.max)
      .length,
  }));
}
export function csvCell(value) {
  const text = String(value ?? "");
  const safe =
    typeof value === "number" && Number.isFinite(value)
      ? text
      : /^[=+\-@\t\r]/.test(text)
        ? `'${text}`
        : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportHistory(
  events,
  players,
  filename = "ludo-score-history.csv",
) {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const rows = [
    [
      "Event",
      "Player",
      "Point change",
      "Recorded at (UTC)",
      "Type",
      "Public reason",
    ],
    ...events.map((e) => [
      e.event_number || "",
      names.get(e.player_id) || e.player_name || "Archived player",
      e.points,
      new Date(e.time).toISOString(),
      e.starting_balance
        ? "Starting balance"
        : e.event_type === "adjustment" || e.points < 0
          ? "Correction"
          : "Penalty",
      e.reason || "",
    ]),
  ];
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeDate(value, now = Date.now()) {
  const elapsed = (value - now) / 1000;
  for (const [unit, seconds] of [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]) {
    if (Math.abs(elapsed) >= seconds)
      return relative.format(Math.trunc(elapsed / seconds), unit);
  }
  return "just now";
}

export function rankTimeline(events, players, playerId) {
  const totals = new Map(
    players.map((player) => [player.id, numeric(player.points_total)]),
  );
  const ordered = [...players].sort(
    (a, b) =>
      new Date(a.created_at) - new Date(b.created_at) ||
      String(a.id).localeCompare(String(b.id)),
  );
  const order = new Map(ordered.map((player, index) => [player.id, index]));
  for (const event of events)
    if (totals.has(event.player_id))
      totals.set(event.player_id, totals.get(event.player_id) - event.points);
  const rank = () =>
    ordered.filter(
      (player) =>
        totals.get(player.id) > totals.get(playerId) ||
        (totals.get(player.id) === totals.get(playerId) &&
          order.get(player.id) < order.get(playerId)),
    ).length + 1;
  const rows = [];
  for (const event of events) {
    if (!totals.has(event.player_id)) continue;
    totals.set(event.player_id, totals.get(event.player_id) + event.points);
    if (!event.starting_balance) {
      const row = { time: event.time, rank: rank() };
      if (rows.at(-1)?.time === row.time) rows[rows.length - 1] = row;
      else rows.push(row);
    }
  }
  return rows;
}
