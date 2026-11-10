import { supabase } from "./supabase";
import { isSupabaseConfigured } from "./config";
const DEMO_KEY = "ludo-issued-certificates-demo-v1";
const setupError = () =>
  new Error(
    "Certificate issuance is not configured on this league yet. Preview downloads remain available.",
  );
function demoRecords() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
  } catch {
    return {};
  }
}
export async function registryStatus() {
  if (!isSupabaseConfigured) return { available: true, demo: true };
  const { data, error } = await supabase.rpc(
    "league_certificate_registry_status",
  );
  if (error) {
    if (["PGRST202", "42883", "PGRST205"].includes(error.code))
      return { available: false, demo: false };
    throw new Error(
      "The certificate registry could not be reached. Try again.",
    );
  }
  return data;
}
export async function getIssuedCertificate(id) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  if (!isSupabaseConfigured) return demoRecords()[id] || null;
  const { data, error } = await supabase.rpc("get_league_certificate", {
    p_certificate_id: id,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) throw setupError();
    throw new Error(
      "The certificate record could not be checked. Check your connection and retry.",
    );
  }
  return data;
}
export async function fetchCertificateComments(playerId) {
  if (!isSupabaseConfigured) {
    try {
      return JSON.parse(
        localStorage.getItem("ludo-super-league:events") || "[]",
      )
        .filter((e) => e.player_id === playerId)
        .map((e) => ({ ...e, id: e.id || `demo-${e.event_number}` }));
    } catch {
      return [];
    }
  }
  const { data, error } = await supabase
    .from("point_events")
    .select("id,event_number,player_id,points,reason,created_at")
    .eq("player_id", playerId)
    .order("event_number", { ascending: false })
    .limit(1000);
  if (error)
    throw new Error(
      "Table comments could not be loaded. Sign in as a scorekeeper and retry.",
    );
  return (data || []).reverse();
}
export async function issueCertificate({
  player,
  model,
  message,
  comments,
  consent,
  requestId,
  demoAdmin,
}) {
  if (!consent) throw new Error("Confirm publication before issuing.");
  if (!isSupabaseConfigured) {
    if (!demoAdmin)
      throw new Error("Sign in as a scorekeeper to issue a demo certificate.");
    const id = crypto.randomUUID(),
      issued_at = new Date().toISOString();
    const snapshot = {
      version: 1,
      player: { id: player.id, name: player.name, points_total: model.points },
      rank: model.rank,
      total: model.total,
      tie_count: model.tieCount || 1,
      metrics: model.metric,
      message,
      comments: comments.map(
        ({ event_number, points, reason, created_at }) => ({
          event_number,
          points,
          reason,
          created_at,
        }),
      ),
      issued_at,
      certificate_id: id,
    };
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(snapshot)),
    );
    const content_hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const record = {
      id,
      snapshot,
      issued_at,
      content_hash,
      revoked_at: null,
      demo: true,
    };
    const records = demoRecords();
    records[id] = record;
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(records));
    } catch {
      throw new Error(
        "Demo issuance needs browser storage so the record can be checked after reload.",
      );
    }
    return record;
  }
  const { data, error } = await supabase.rpc("issue_league_certificate", {
    p_player_id: player.id,
    p_message: message,
    p_event_ids: comments.map((c) => c.id),
    p_consent: consent,
    p_request_id: requestId,
    p_expected_points: model.points,
    p_expected_rank: model.rank,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code)) throw setupError();
    throw new Error(
      error.message ||
        "The certificate could not be issued. Your draft is still here.",
    );
  }
  return data;
}
export async function revokeCertificate(id, reason, demoAdmin) {
  if (!isSupabaseConfigured) {
    if (!demoAdmin) throw new Error("Scorekeeper sign-in required.");
    if (reason.trim().length < 3)
      throw new Error("Enter a reason with at least three characters.");
    const records = demoRecords();
    if (!records[id]) throw new Error("Certificate not found.");
    records[id] = {
      ...records[id],
      revoked_at: records[id].revoked_at || new Date().toISOString(),
      revocation_reason: records[id].revocation_reason || reason.trim(),
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(records));
    return records[id];
  }
  const { data, error } = await supabase.rpc("revoke_league_certificate", {
    p_certificate_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message || "Revocation failed.");
  return data;
}
export function verificationUrl(id) {
  return `${window.location.origin}${window.location.pathname}#verify${id ? `=${encodeURIComponent(id)}` : ""}`;
}

export async function listPlayerCertificates(playerId) {
  if (!isSupabaseConfigured)
    return Object.values(demoRecords())
      .filter((r) => r.snapshot?.player?.id === playerId)
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
      .slice(0, 12);
  const { data, error } = await supabase
    .from("league_certificates")
    .select("id,issued_at,revoked_at")
    .eq("snapshot->player->>id", playerId)
    .order("issued_at", { ascending: false })
    .limit(12);
  if (error)
    throw new Error(
      "Issued certificates could not be loaded. Use a certificate ID on the verification page.",
    );
  return data || [];
}
