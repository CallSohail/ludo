import { isSupabaseConfigured } from './config';
import { supabase } from './supabase';

const PLAYERS_KEY = 'ludo-super-league:players';
const EVENTS_KEY = 'ludo-super-league:events';
const CACHE_KEY = 'ludo-super-league:public-cache-v2';
const CACHE_TTL = 5 * 60 * 1000;

function readPublicCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!cache || !Array.isArray(cache.players)) return null;
    return { ...cache, stale: Date.now() - cache.savedAt > CACHE_TTL };
  } catch { return null; }
}

function writePublicCache(players, history = []) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ players, history, savedAt: Date.now() })); } catch { /* Storage may be disabled. */ }
}

export function getCachedLeaderboard() { return readPublicCache(); }

const demoPlayers = [
  { id: 'demo-mohsin', name: 'Mohsin', points_total: 6, accent: '#f5b700', emoji: '😎', active: true, created_at: '2026-08-01T10:00:00.000Z' },
  { id: 'demo-saboor', name: 'Saboor', points_total: 8, accent: '#2374ab', emoji: '🔥', active: true, created_at: '2026-08-01T10:02:00.000Z' },
  { id: 'demo-mubeen', name: 'Mubeen', points_total: 8, accent: '#22c77a', emoji: '🧠', active: true, created_at: '2026-08-01T10:03:00.000Z' },
  { id: 'demo-sohail', name: 'Sohail', points_total: 6, accent: '#ff791f', emoji: '🚀', active: true, created_at: '2026-08-01T10:04:00.000Z' },
  { id: 'demo-imran', name: 'Imran', points_total: 2, accent: '#12b3bd', emoji: '🍀', active: true, created_at: '2026-08-01T10:05:00.000Z' },
  { id: 'demo-abid', name: 'Abid', points_total: 0, accent: '#4b75d1', emoji: '🎲', active: true, created_at: '2026-08-01T10:06:00.000Z' },
  { id: 'demo-fazal', name: 'Dr. Fazal', points_total: 1, accent: '#9a5cc7', emoji: '🧨', active: true, created_at: '2026-08-01T10:07:00.000Z' },
  { id: 'demo-wahid', name: 'Dr. Wahid', points_total: 0, accent: '#e94b45', emoji: '🕺', active: true, created_at: '2026-08-01T10:08:00.000Z' },
  { id: 'demo-tariq', name: 'Tariq', points_total: 0, accent: '#159f8e', emoji: '🐉', active: true, created_at: '2026-08-01T10:09:00.000Z' },
  { id: 'demo-ikram', name: 'Ikram', points_total: 0, accent: '#e91e63', emoji: '🦄', active: true, created_at: '2026-08-01T10:10:00.000Z' },
  { id: 'demo-sami', name: 'Dr. Sami', points_total: 1, accent: '#4057b7', emoji: '👑', active: true, created_at: '2026-08-01T10:11:00.000Z' },
];

function getDemoPlayers() {
  const stored = localStorage.getItem(PLAYERS_KEY);
  if (!stored) {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(demoPlayers));
    return demoPlayers;
  }
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(demoPlayers));
    return demoPlayers;
  }
}

function getDemoEvents() {
  const stored = localStorage.getItem(EVENTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveDemo(players, events) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

async function sha256(value) {
  if (globalThis.crypto?.subtle) {
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Array.from(value).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0).toString(16);
}

export async function fetchPlayers() {
  if (!isSupabaseConfigured) return getDemoPlayers();
  const { data, error } = await supabase
    .from('players')
    .select('id,name,accent,emoji,points_total,active,created_at')
    .eq('active', true)
    .order('points_total', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const players = data || [];
  const cache = readPublicCache();
  writePublicCache(players, cache?.history || []);
  return players;
}

export async function fetchScoreHistory() {
  if (!isSupabaseConfigured) return getDemoEvents().map(({ player_id, points, created_at, event_number }) => ({ player_id, points, created_at, event_number }));
  const { data, error } = await supabase.rpc('get_public_score_history');
  if (error) {
    if (['PGRST202', '42883'].includes(error.code)) return readPublicCache()?.history || [];
    throw error;
  }
  const history = data || [];
  const cache = readPublicCache();
  writePublicCache(cache?.players || [], history);
  return history;
}

export async function fetchEvents() {
  if (!isSupabaseConfigured) return getDemoEvents();
  const { data: sessionData } = await supabase.auth.getSession();
  // The public page does not need the private ledger. Avoid a noisy RLS error
  // before an admin signs in, then load it as soon as the admin panel opens.
  if (!sessionData.session) return [];
  const { data, error } = await supabase
    .from('point_events')
    .select('id,event_number,player_id,points,reason,previous_hash,event_hash,created_by,created_at')
    .order('event_number', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function createPlayer({ name, accent, emoji }) {
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const cleanName = name.trim();
    if (players.some((player) => player.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error('That player is already on the board.');
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
  const { data, error } = await supabase.rpc('admin_create_player', {
    p_name: name.trim(),
    p_accent: accent,
    p_emoji: emoji,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updatePlayer({ id, name, accent, emoji }) {
  const cleanName = name.trim();
  if (!id || cleanName.length < 2 || cleanName.length > 28) throw new Error('Player names must contain 2 to 28 characters.');
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const player = players.find((item) => item.id === id);
    if (!player) throw new Error('Player not found.');
    if (players.some((item) => item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase())) throw new Error('That player name is already in use.');
    Object.assign(player, { name: cleanName, accent, emoji });
    saveDemo(players, getDemoEvents()); return player;
  }
  const { data, error } = await supabase.rpc('admin_update_player', { p_player_id: id, p_name: cleanName, p_accent: accent, p_emoji: emoji });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function archivePlayer(id) {
  if (!id) throw new Error('Choose a player to archive.');
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const player = players.find((item) => item.id === id);
    if (!player) throw new Error('Player not found.');
    player.active = false; saveDemo(players, getDemoEvents()); return player;
  }
  const { data, error } = await supabase.rpc('admin_archive_player', { p_player_id: id });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function addPoints({ playerId, points, reason, consent }) {
  const numericPoints = Number(points);
  const cleanReason = reason.trim();
  if (!playerId) throw new Error('Choose a player before publishing the point.');
  if (!Number.isInteger(numericPoints) || numericPoints < 1 || numericPoints > 999) throw new Error('Points must be a whole number from 1 to 999.');
  if (cleanReason.length < 3 || cleanReason.length > 180) throw new Error('The reason must contain 3 to 180 characters.');
  if (consent !== true) throw new Error('Confirm the signed receipt before publishing.');
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers();
    const events = getDemoEvents();
    const player = players.find((item) => item.id === playerId);
    if (!player) throw new Error('Player not found. Refresh and try again.');
    const previousHash = events[0]?.event_hash || 'GENESIS-LUDO-2026';
    const createdAt = new Date().toISOString();
    const eventNumber = events.length + 1;
    const eventHash = await sha256(`${previousHash}|${eventNumber}|${playerId}|${numericPoints}|${cleanReason}|${createdAt}`);
    const event = {
      id: `demo-event-${Date.now()}`,
      event_number: eventNumber,
      player_id: playerId,
      points: numericPoints,
      reason: cleanReason,
      previous_hash: previousHash,
      event_hash: eventHash,
      created_by: 'demo-admin',
      created_at: createdAt,
    };
    player.points_total = Number(player.points_total || 0) + numericPoints;
    saveDemo(players, [event, ...events]);
    return event;
  }
  const { data, error } = await supabase.rpc('add_point_event', {
    p_player_id: playerId,
    p_points: numericPoints,
    p_reason: cleanReason,
    p_consent: consent,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function adjustScore({ playerId, points, reason, consent = true }) {
  const delta = Number(points);
  const cleanReason = reason.trim();
  if (!playerId || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 999) throw new Error('Correction must be a whole number from -999 to 999, excluding zero.');
  if (cleanReason.length < 3 || cleanReason.length > 180) throw new Error('Explain the correction in 3 to 180 characters.');
  if (!isSupabaseConfigured) {
    const players = getDemoPlayers(); const events = getDemoEvents();
    const player = players.find((item) => item.id === playerId && item.active);
    if (!player || Number(player.points_total) + delta < 0) throw new Error('This correction would make the total negative.');
    player.points_total = Number(player.points_total) + delta;
    const event = { id: `demo-adjust-${Date.now()}`, event_number: events.length + 1, player_id: playerId, points: delta, reason: cleanReason, event_type: 'adjustment', event_hash: `demo-${Date.now()}`, created_at: new Date().toISOString() };
    saveDemo(players, [event, ...events]); return event;
  }
  const { data, error } = await supabase.rpc('admin_adjust_score', { p_player_id: playerId, p_delta: delta, p_reason: cleanReason, p_consent: consent });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function getAdminProfile(userId) {
  if (!isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id,display_name,is_admin')
    .eq('user_id', userId)
    .eq('is_admin', true)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function signIn(username, password) {
  if (!isSupabaseConfigured) {
    if (username.trim() !== (import.meta.env.VITE_DEMO_ADMIN_USERNAME || 'admin') || password !== (import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'ludo2026')) {
      throw new Error('Demo login rejected. Try admin and ludo2026.');
    }
    return { user: { id: 'demo-admin', email: username, demo: true } };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: username.trim(), password });
  if (error) throw error;
  const profile = await getAdminProfile(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('Login worked, but this account is not on the admin list yet.');
  }
  return { user: data.user, profile };
}

export async function signOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
}

export function watchForChanges(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('ludo-super-league-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_events' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function watchForAuth(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(session));
  return () => data.subscription.unsubscribe();
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
