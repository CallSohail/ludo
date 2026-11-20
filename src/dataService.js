import { cleanReason, parsePoints, REASON_LIMIT, UNDO_MS } from "./scoring";
import { isSupabaseConfigured } from "./config";
import { supabase } from "./supabase";

const PLAYERS_KEY = "ludo-super-league:players";
const EVENTS_KEY = "ludo-super-league:events";
const CACHE_KEY = "ludo-super-league:public-cache-v2";
const CACHE_TTL = 5 * 60 * 1000;

// Demo storage remains usable when browser persistence is blocked or full.
const memoryStorage = new Map();
function readStorage(key) {
  try {
    return localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}
function writeStorage(key, value) {
  memoryStorage.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Session-only demo fallback. */
  }
}

function readPublicCache() {
  try {
    const cache = JSON.parse(readStorage(CACHE_KEY) || "null");
    if (!cache || !Array.isArray(cache.players)) return null;
    return { ...cache, stale: Date.now() - cache.savedAt > CACHE_TTL };
  } catch {
    return null;
  }
}

function writePublicCache(players, history = []) {
  try {
    writeStorage(
      CACHE_KEY,
      JSON.stringify({ players, history, savedAt: Date.now() }),
    );
  } catch {
    /* Storage may be disabled. */
  }
}

export function getCachedLeaderboard() {
  return readPublicCache();
}

const demoPlayers = [
  {
    id: "demo-mohsin",
    name: "Mohsin",
    points_total: 6,
    accent: "#f5b700",
    emoji: "😎",
    active: true,
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "demo-saboor",
    name: "Saboor",
    points_total: 8,
    accent: "#2374ab",
    emoji: "🔥",
    active: true,
    created_at: "2026-08-01T10:02:00.000Z",
  },
  {
    id: "demo-mubeen",
    name: "Mubeen",
    points_total: 8,
    accent: "#22c77a",
    emoji: "🧠",
    active: true,
    created_at: "2026-08-01T10:03:00.000Z",
  },
  {
    id: "demo-sohail",
    name: "Sohail",
    points_total: 6,
    accent: "#ff791f",
    emoji: "🚀",
    active: true,
    created_at: "2026-08-01T10:04:00.000Z",
  },
  {
    id: "demo-imran",
    name: "Imran",
    points_total: 2,
    accent: "#12b3bd",
    emoji: "🍀",
    active: true,
    created_at: "2026-08-01T10:05:00.000Z",
  },
  {
    id: "demo-abid",
    name: "Abid",
    points_total: 0,
    accent: "#4b75d1",
    emoji: "🎲",
    active: true,
    created_at: "2026-08-01T10:06:00.000Z",
  },
  {
    id: "demo-fazal",
    name: "Dr. Fazal",
    points_total: 1,
    accent: "#9a5cc7",
    emoji: "🧨",
    active: true,
    created_at: "2026-08-01T10:07:00.000Z",
  },
  {
    id: "demo-wahid",
    name: "Dr. Wahid",
    points_total: 0,
    accent: "#e94b45",
    emoji: "🕺",
    active: true,
    created_at: "2026-08-01T10:08:00.000Z",
  },
  {
    id: "demo-tariq",
    name: "Tariq",
    points_total: 0,
    accent: "#159f8e",
    emoji: "🐉",
    active: true,
    created_at: "2026-08-01T10:09:00.000Z",
  },
  {
    id: "demo-ikram",
    name: "Ikram",
    points_total: 0,
    accent: "#e91e63",
    emoji: "🦄",
    active: true,
    created_at: "2026-08-01T10:10:00.000Z",
  },
  {
    id: "demo-sami",
    name: "Dr. Sami",
    points_total: 1,
    accent: "#4057b7",
    emoji: "👑",
    active: true,
    created_at: "2026-08-01T10:11:00.000Z",
  },
];

function getDemoPlayers() {
  const stored = readStorage(PLAYERS_KEY);
  if (!stored) {
    writeStorage(PLAYERS_KEY, JSON.stringify(demoPlayers));
    return demoPlayers;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Invalid saved demo data");
    return parsed;
  } catch {
    writeStorage(PLAYERS_KEY, JSON.stringify(demoPlayers));
    return demoPlayers;
  }
}

function getDemoEvents() {
  const stored = readStorage(EVENTS_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Invalid saved demo data");
    return parsed;
  } catch {
    return [];
  }
}

function saveDemo(players, events) {
  writeStorage(PLAYERS_KEY, JSON.stringify(players));
  writeStorage(EVENTS_KEY, JSON.stringify(events));
}

async function sha256(value) {
  if (globalThis.crypto?.subtle) {
    const buffer = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return [...new Uint8Array(buffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return Array.from(value)
    .reduce(
      (hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0,
      0,
    )
    .toString(16);
}

export async function fetchScorebook() {
  if (!isSupabaseConfigured) {
    const all = getDemoPlayers().filter(
      (player) => player && typeof player.name === "string",
    );
    const names = new Map(all.map((player) => [player.id, player.name]));
    return {
      players: all.filter((player) => player.active !== false),
      history: getDemoEvents().map((event) => ({
        event_number: event.event_number,
        player_id: event.player_id,
        player_name: names.get(event.player_id),
        points: event.points,
        created_at: event.created_at,
        event_type: event.event_type,
        reason: event.published_reason ? event.reason : null,
        starting_balance: Boolean(event.starting_balance),
      })),
    };
  }
  const { data, error } = await supabase
    .rpc("get_scorebook_snapshot")
    .abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  writePublicCache(data.players, data.history);
  return data;
}

export async function fetchEvents() {
  if (!isSupabaseConfigured)
    return getDemoEvents().sort(
      (a, b) => Number(b.event_number) - Number(a.event_number),
    );
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase
      .from("point_events")
      .select(
        "id,event_number,player_id,points,reason,previous_hash,event_hash,created_by,created_at,event_type,request_id,reverses_event_id,published_reason",
      )
      .order("event_number", { ascending: false })
      .range(start, start + 499)
      .abortSignal(AbortSignal.timeout(12000));
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export async function createPlayer({ name, accent, emoji }) {
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 28)
    throw new Error("Player names must contain 2 to 28 characters.");
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    if (
      players.some(
        (player) => player.name.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      throw new Error("That player is already on the board.");
    }
    const player = {
      id: `demo-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
      name: cleanName,
      accent,
      emoji,
      points_total: 0,
      active: true,
      created_at: new Date().toISOString(),
    };
    saveDemo([...players, player], getDemoEvents());
    return player;
  }
  const { data, error } = await supabase.rpc("admin_create_player", {
    p_name: name.trim(),
    p_accent: accent,
    p_emoji: emoji,
  });
  if (error?.code === "23505")
    throw new Error("That player name is already in use.");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updatePlayer({ id, name, accent, emoji }) {
  const cleanName = name.trim();
  if (!id || cleanName.length < 2 || cleanName.length > 28)
    throw new Error("Player names must contain 2 to 28 characters.");
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const player = players.find((item) => item.id === id);
    if (!player) throw new Error("Player not found.");
    if (
      players.some(
        (item) =>
          item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase(),
      )
    )
      throw new Error("That player name is already in use.");
    Object.assign(player, { name: cleanName, accent, emoji });
    saveDemo(players, getDemoEvents());
    return player;
  }
  const { data, error } = await supabase.rpc("admin_update_player", {
    p_player_id: id,
    p_name: cleanName,
    p_accent: accent,
    p_emoji: emoji,
  });
  if (error?.code === "23505")
    throw new Error("That player name is already in use.");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function archivePlayer(id) {
  if (!id) throw new Error("Choose a player to archive.");
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const player = players.find((item) => item.id === id);
    if (!player) throw new Error("Player not found.");
    if (players.filter((item) => item.active !== false).length <= 1)
      throw new Error("Keep at least one active player.");
    player.active = false;
    saveDemo(players, getDemoEvents());
    return player;
  }
  const { data, error } = await supabase.rpc("admin_archive_player", {
    p_player_id: id,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

let demoWrite = Promise.resolve();

function demoRecordHash(event) {
  return sha256(
    JSON.stringify([
      event.previous_hash,
      event.event_number,
      event.player_id,
      event.points,
      event.reason,
      event.created_at,
      event.request_id,
      event.reverses_event_id,
      event.published_reason,
      event.event_type,
    ]),
  );
}

async function writeDemoEntry({
  playerId,
  delta,
  reason,
  requestId,
  publicReason,
  kind,
  original,
}) {
  const players = getDemoPlayers();
  const events = getDemoEvents().sort(
    (a, b) => Number(b.event_number) - Number(a.event_number),
  );
  const source =
    original &&
    events.find(
      (event) => event.id === original && event.event_type !== "adjustment",
    );
  if (original && !source)
    throw new Error("The original penalty could not be found.");
  if (source) {
    playerId = source.player_id;
    delta = -source.points;
    reason = `Undo of entry #${source.event_number}`;
  }
  const existing = events.find((event) => event.request_id === requestId);
  if (existing) {
    if (
      existing.player_id !== playerId ||
      existing.points !== delta ||
      existing.reason !== reason ||
      existing.reverses_event_id !== original ||
      existing.published_reason !== publicReason ||
      existing.event_type !== kind
    )
      throw new Error("This request ID belongs to a different score.");
    return existing;
  }
  if (source && Date.now() - Date.parse(source.created_at) > UNDO_MS)
    throw new Error("The undo window has ended. Use Correct a score.");
  if (source && events.some((event) => event.reverses_event_id === original))
    throw new Error("This penalty has already been undone.");
  const player = players.find(
    (item) => item.id === playerId && item.active !== false,
  );
  if (!player) throw new Error("This player is no longer active.");
  if (Number(player.points_total) + delta < 0)
    throw new Error("A correction cannot make the total negative.");
  const event = {
    id: crypto.randomUUID(),
    event_number: Number(events[0]?.event_number || 0) + 1,
    player_id: playerId,
    points: delta,
    reason,
    previous_hash: events[0]?.event_hash || "GENESIS-LUDO-2026",
    created_by: "demo-admin",
    created_at: new Date().toISOString(),
    event_type: kind,
    request_id: requestId,
    reverses_event_id: original,
    published_reason: publicReason,
  };
  event.event_hash = await demoRecordHash(event);
  player.points_total = Number(player.points_total) + delta;
  saveDemo(players, [event, ...events]);
  return event;
}

async function writeScore({
  playerId = null,
  points,
  reason = "",
  consent,
  requestId,
  publicReason = false,
  kind,
  original = null,
}) {
  if (!navigator.onLine)
    throw new Error("You are offline. Reconnect and retry.");
  if (!requestId || !consent)
    throw new Error("Confirm the witnessed score before publishing.");
  const delta = parsePoints(points, kind === "adjustment");
  const note = cleanReason(reason);
  if (!original && (!playerId || delta === null))
    throw new Error("Choose a player and enter valid whole points.");
  if (!original && ([...note].length < 3 || [...note].length > REASON_LIMIT))
    throw new Error("A reason must contain 3 to 180 characters.");
  if (!isSupabaseConfigured) {
    const write = () =>
      writeDemoEntry({
        playerId,
        delta,
        reason: note,
        requestId,
        publicReason,
        kind,
        original,
      });
    const result = demoWrite.then(() =>
      navigator.locks
        ? navigator.locks.request("ludo-demo-ledger", write)
        : write(),
    );
    demoWrite = result.catch(() => {});
    return result;
  }
  const params = {
    target: playerId,
    delta,
    note,
    witnessed: consent,
    request_key: requestId,
    public_note: publicReason,
    kind,
    original,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error, status } = await supabase
      .rpc("write_scorebook_entry", params)
      .abortSignal(AbortSignal.timeout(12000));
    if (!error) return Array.isArray(data) ? data[0] : data;
    if (attempt === 0 && ["40001", "40P01"].includes(error.code)) continue;
    if ([401, 403].includes(status))
      throw Object.assign(new Error("Sign in again to resume this score."), {
        reauth: true,
      });
    if (!status || status >= 500 || error.code === "57014") {
      throw Object.assign(
        new Error(
          "The league didn’t confirm this score. Retry with the same details.",
        ),
        { uncertain: true },
      );
    }
    throw error;
  }
}

export const addPoints = (values) => writeScore({ ...values, kind: "penalty" });
export const adjustScore = (values) =>
  writeScore({ ...values, kind: "adjustment" });
export const undoPoints = (eventId, requestId) =>
  writeScore({
    requestId,
    original: eventId,
    consent: true,
    kind: "adjustment",
    publicReason: true,
  });

export async function verifyScoreChain() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .rpc("verify_scorebook_chain")
      .abortSignal(AbortSignal.timeout(12000));
    if (error) throw error;
    return data;
  }
  const events = getDemoEvents().sort(
    (a, b) => Number(a.event_number) - Number(b.event_number),
  );
  const result = {
    valid: true,
    signed: 0,
    legacy: 0,
    unsigned: 0,
    first_invalid: null,
  };
  let previous;
  for (const event of events) {
    if (!event.request_id) {
      if (event.event_hash?.length === 64) {
        result.legacy++;
        const digest = await sha256(
          `${event.previous_hash}|${event.event_number}|${event.player_id}|${event.points}|${event.reason}|${event.created_at}`,
        );
        if (
          digest !== event.event_hash ||
          (previous && previous !== event.previous_hash)
        )
          result.first_invalid ??= event.event_number;
        previous = event.event_hash;
      } else {
        result.unsigned++;
        previous = undefined;
      }
      continue;
    }
    result.signed++;
    if (
      (previous && event.previous_hash !== previous) ||
      (await demoRecordHash(event)) !== event.event_hash
    )
      result.first_invalid ??= event.event_number;
    previous = event.event_hash;
  }
  result.signed += result.legacy;
  result.valid = result.first_invalid === null;
  return result;
}

export async function getAdminProfile(userId) {
  if (!isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("user_id,display_name,is_admin")
    .eq("user_id", userId)
    .eq("is_admin", true)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function signIn(username, password) {
  if (!isSupabaseConfigured) {
    if (
      username.trim() !==
        (import.meta.env.VITE_DEMO_ADMIN_USERNAME || "admin") ||
      password !== (import.meta.env.VITE_DEMO_ADMIN_PASSWORD || "ludo2026")
    ) {
      throw new Error("Demo login rejected. Try admin and ludo2026.");
    }
    return { user: { id: "demo-admin", email: username, demo: true } };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: username.trim(),
    password,
  });
  if (error) throw error;
  const profile = await getAdminProfile(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error(
      "Login worked, but this account is not on the admin list yet.",
    );
  }
  return { user: data.user, profile };
}

export async function signOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
}

export function watchForChanges(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel("ludo-super-league-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "point_events" },
      onChange,
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function watchForAuth(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    onChange(session),
  );
  return () => data.subscription.unsubscribe();
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
