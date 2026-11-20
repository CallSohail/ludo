export const REASON_LIMIT = 180;
export const UNDO_MS = 10_000;

export function parsePoints(value, correction = false) {
  const text = String(value ?? "").trim();
  if (!(correction ? /^-?[0-9]{1,3}$/ : /^[0-9]{1,3}$/).test(text)) return null;
  const points = Number(text);
  return points === 0 ? null : points;
}

export function cleanReason(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
}

export function sortPlayers(players) {
  return [...players].sort(
    (a, b) =>
      Number(b.points_total) - Number(a.points_total) ||
      new Date(a.created_at || 0) - new Date(b.created_at || 0) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

export function scoreImpact(players, target, points) {
  const before = players.findIndex((player) => player.id === target);
  const changed = sortPlayers(
    players.map((player) =>
      player.id === target
        ? { ...player, points_total: Number(player.points_total) + points }
        : player,
    ),
  );
  const after = changed.findIndex((player) => player.id === target);
  return {
    position: after + 1,
    passed:
      before > after && after >= 0
        ? players.slice(after, before).map((player) => player.name)
        : [],
  };
}
