const leaguePortraits = new Map([
  ["05997b3c-7d02-4ac6-8f84-0acc85e74bac", "mubeen-avatar.webp"],
  ["a4074e48-9d90-4f0d-8fa7-2cb7bb83a404", "sohail-avatar.webp"],
  ["7f2934e1-606d-42ae-8951-6747c1a3db15", "saboor-avatar.webp"],
  ["demo-mubeen", "mubeen-avatar.webp"],
  ["demo-sohail", "sohail-avatar.webp"],
  ["demo-saboor", "saboor-avatar.webp"],
]);

export function playerPortraitFile(playerId) {
  return leaguePortraits.get(playerId);
}

export function playerMonogram(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] || "")
      .join("")
      .toLocaleUpperCase() || "—"
  );
}
