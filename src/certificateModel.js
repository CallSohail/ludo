import { numeric, stats, fullDate } from "./analytics.js";
export const MAX_CERTIFICATE_MESSAGE = 600;
export function certificateModel(player, players, events, asOf = new Date()) {
  const index = players.findIndex((p) => p.id === player.id);
  if (index < 0)
    throw new Error("This player is no longer on the active table.");
  const metric = stats(events.filter((e) => e.player_id === player.id));
  return modelFromFacts(
    player,
    index + 1,
    players.length,
    metric,
    players.filter(
      (p) => numeric(p.points_total) === numeric(player.points_total),
    ).length,
    asOf,
  );
}
function modelFromFacts(player, rank, total, metric, ties, asOf) {
  const points = numeric(player.points_total);
  const title =
    rank === 1
      ? points > 0
        ? "Keeper of the penalty crown"
        : "Opening table distinction"
      : rank === 2
        ? "Distinguished contender"
        : rank === 3
          ? "Podium distinction"
          : points === 0
            ? "Clean record distinction"
            : "League fellowship";
  const commendations = [
    rank === 1
      ? points > 0
        ? "First on the current penalty table: the league’s most memorable burden to carry."
        : "First in the opening table order, with no penalty points recorded."
      : rank <= 3
        ? `Recognised in position ${rank} on the current penalty table.`
        : `A place in the Évry league’s shared story, in position ${rank} of ${total}.`,
    points === 0
      ? "A current total of zero penalty points: a clean scorebook to preserve."
      : `${points} penalty point${points === 1 ? "" : "s"} on the current all-time table.`,
    metric.count
      ? `${metric.awards} recorded award${metric.awards === 1 ? "" : "s"} across ${metric.days} recorded day${metric.days === 1 ? "" : "s"}, with ${metric.corrections} correction${metric.corrections === 1 ? "" : "s"}.`
      : "Current standings recognised; detailed score history is not available yet.",
  ];
  if (ties > 1)
    commendations.push(
      `${ties} players share this score. Displayed positions use player creation order.`,
    );
  const time = Number.isFinite(new Date(asOf).getTime())
    ? new Date(asOf)
    : new Date();
  const safeId =
    String(player.id)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-10)
      .toUpperCase() || "PLAYER";
  return {
    playerId: player.id,
    name: player.name,
    rank,
    points,
    total: total,
    leader: rank === 1,
    title,
    commendations,
    metric,
    historyAvailable: metric.count > 0,
    asOf: time.toISOString(),
    dateLabel: fullDate(time),
    id: `LSL26-${safeId}-${time.toISOString().slice(0, 10).replaceAll("-", "")}-${time.toISOString().slice(11, 19).replaceAll(":", "")}`,
    tied: ties > 1,
    tieCount: ties,
    comments: [],
    message: "",
    issued: false,
  };
}
export function safeCertificateFilename(name, rank, extension) {
  const stem =
    String(name)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "player";
  return `ludo-2026-${String(rank).padStart(2, "0")}-${stem.toLowerCase()}.${extension}`;
}
export function normalizeMessage(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, MAX_CERTIFICATE_MESSAGE);
}

export function certificateFromRecord(record) {
  const s = record?.snapshot;
  if (
    !s ||
    s.version !== 1 ||
    typeof s.player?.name !== "string" ||
    !Number.isInteger(s.rank) ||
    s.rank < 1 ||
    !Number.isInteger(s.total) ||
    s.total < s.rank ||
    !s.metrics
  )
    throw new Error("The certificate record is incomplete or unsupported.");
  return {
    ...modelFromFacts(
      s.player,
      s.rank,
      s.total,
      s.metrics,
      s.tie_count,
      s.issued_at,
    ),
    id: record.id,
    issued: true,
    demo: Boolean(record.demo),
    message: s.message || "",
    comments: Array.isArray(s.comments) ? s.comments : [],
    contentHash: record.content_hash,
    revokedAt: record.revoked_at || null,
  };
}
