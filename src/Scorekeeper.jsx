import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShieldCheck } from "lucide-react";
import { config, isSupabaseConfigured, palette } from "./config";
import {
  addPoints,
  adjustScore,
  archivePlayer,
  createPlayer,
  undoPoints,
  updatePlayer,
  verifyScoreChain,
} from "./dataService";
import { fullDate } from "./analytics";
import {
  cleanReason,
  parsePoints,
  REASON_LIMIT,
  scoreImpact,
  UNDO_MS,
} from "./scoring";
import { Avatar } from "./PlayerAvatar";
import Sheet from "./Sheet";

const localPlayerKey = "ludo-last-score-player";
const newPlayer = { name: "", accent: palette[2], emoji: "🎲" };
const blankScore = {
  points: "1",
  reason: "",
  witnessed: false,
  publicReason: false,
};

function readLastPlayer() {
  try {
    return localStorage.getItem(localPlayerKey);
  } catch {
    return null;
  }
}

function Login({ onLogin }) {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      await onLogin({
        username: form.get("username"),
        password: form.get("password"),
      });
    } catch (error) {
      setMessage(error.message || "Sign-in failed. Try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="score-login">
      <p>Sign in with an approved scorekeeper account.</p>
      <form onSubmit={submit}>
        <label>
          Username or email
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              aria-label="Password"
              name="password"
              autoComplete="current-password"
              type={show ? "text" : "password"}
              required
            />
            <button type="button" onClick={() => setShow(!show)}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {message && (
          <p className="score-error" role="alert">
            {message}
          </p>
        )}
        <button type="submit" className="solid-action" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {!isSupabaseConfigured && (
        <small>
          Demo sign-in {config.demoUsername} / {config.demoPassword}
        </small>
      )}
    </div>
  );
}

function PlayerForm({ initial, onSave, onCancel, onDirty, editing }) {
  const [form, setForm] = useState(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await onSave(form);
      if (!editing) setForm(newPlayer);
    } catch (error) {
      setNotice(error.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="score-player-form" onSubmit={submit}>
      <h3>{editing ? "Edit player" : "Add a player"}</h3>
      <label>
        Player name
        <input
          minLength={2}
          maxLength={28}
          required
          value={form.name}
          onChange={(event) => {
            onDirty();
            setForm({ ...form, name: event.target.value });
          }}
        />
      </label>
      <fieldset>
        <legend>Avatar colour</legend>
        <div className="score-swatches">
          {palette.map((colour, index) => (
            <button
              type="button"
              key={colour}
              style={{ "--swatch": colour }}
              aria-label={`Colour ${index + 1}`}
              aria-pressed={form.accent === colour}
              onClick={() => {
                onDirty();
                setForm({ ...form, accent: colour });
              }}
            >
              {form.accent === colour && <Check size={16} />}
            </button>
          ))}
        </div>
      </fieldset>
      {notice && (
        <p role="alert" className="score-error">
          {notice}
        </p>
      )}
      <div className="score-inline">
        <button type="submit" className="solid-action" disabled={busy}>
          {editing ? "Save player" : "Add player"}
        </button>
        {editing && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function PrivateLedger({ events, names, error, refresh, loading }) {
  const [verification, setVerification] = useState(null);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState("");
  const [page, setPage] = useState(0);
  const count = 10;
  const pageIndex = Math.min(
    page,
    Math.max(0, Math.ceil(events.length / count) - 1),
  );
  async function verify() {
    setChecking(true);
    setFailure("");
    try {
      setVerification(await verifyScoreChain());
    } catch (e) {
      setFailure(e.message || "Chain verification failed. Try again.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="score-ledger" aria-busy={loading}>
      {loading && !events.length && (
        <p role="status">Loading signed receipts…</p>
      )}
      <div className="score-inline score-ledger-head">
        <h3>{events.length} ledger entries</h3>
        <button type="button" onClick={verify} disabled={checking}>
          <ShieldCheck size={17} />
          {checking ? "Verifying…" : "Verify chain"}
        </button>
      </div>
      {error && (
        <p role="alert" className="score-error">
          {error} <button onClick={refresh}>Retry</button>
        </p>
      )}
      {failure && (
        <p role="alert" className="score-error">
          {failure}
        </p>
      )}
      {verification && (
        <p role="status">
          {verification.valid
            ? "Chain verified."
            : `Check entry #${verification.first_invalid}.`}{" "}
          {verification.signed} signed, including {verification.legacy}{" "}
          original-format entries. {verification.unsigned} unsigned entries.
        </p>
      )}
      {!events.length && !error && !loading && (
        <p>No penalties or corrections have been recorded.</p>
      )}
      <ul>
        {events
          .slice(pageIndex * count, (pageIndex + 1) * count)
          .map((event) => (
            <li key={event.id || event.event_number}>
              <b className="score-delta">
                {event.points > 0 ? "+" : ""}
                {event.points}
              </b>
              <div>
                <strong>
                  {names.get(event.player_id) || "Archived player"}
                </strong>
                <p>{event.reason || "No reason recorded"}</p>
                <time dateTime={event.created_at}>
                  {fullDate(event.created_at)}
                </time>
              </div>
              <div className="score-receipt">
                <small>#{event.event_number}</small>
                <code title={event.event_hash}>
                  {event.event_hash?.length === 64
                    ? event.event_hash.slice(0, 8)
                    : "Unsigned"}
                </code>
                {event.event_hash?.length === 64 && !event.request_id && (
                  <small>Original format</small>
                )}
              </div>
            </li>
          ))}
      </ul>
      {events.length > count && (
        <div className="score-inline">
          <button
            onClick={() => setPage(pageIndex - 1)}
            disabled={pageIndex === 0}
          >
            Previous entries
          </button>
          <button
            onClick={() => setPage(pageIndex + 1)}
            disabled={(pageIndex + 1) * count >= events.length}
          >
            Next entries
          </button>
        </div>
      )}
    </section>
  );
}

export default function Scorekeeper({
  admin,
  players,
  history,
  events,
  ledgerError,
  refreshing,
  online,
  refresh,
  onLogin,
  onLogout,
  onClose,
}) {
  const [tab, setTab] = useState("Score");
  const [target, setTarget] = useState(() => {
    const last = readLastPlayer();
    return players.some((player) => player.id === last)
      ? last
      : (players[0]?.id ?? null);
  });
  const [draft, setDraft] = useState(blankScore);
  const [correcting, setCorrecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [editing, setEditing] = useState(null);
  const [undo, setUndo] = useState(null);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const pending = useRef(null);
  const playersDirty = useRef(false);
  const active = players.find((player) => player.id === target);
  const points = parsePoints(draft.points, correcting);
  const reasonLength = [...cleanReason(draft.reason)].length;
  const valid =
    active &&
    points !== null &&
    reasonLength >= 3 &&
    draft.witnessed &&
    Number(active.points_total) + points >= 0;
  const impact =
    active && points !== null ? scoreImpact(players, active.id, points) : null;
  const names = new Map([
    ...history.map((event) => [event.player_id, event.player_name]),
    ...players.map((player) => [player.id, player.name]),
  ]);
  const recent = [
    ...new Set(
      events
        .filter((event) => event.reason && !event.reverses_event_id)
        .map((event) => event.reason),
    ),
  ].slice(0, 4);
  const remaining = undo
    ? Math.max(0, Math.ceil((undo.deadline - now) / 1000))
    : 0;
  const title = !admin || reauth ? "Scorekeeper sign in" : "Manage the league";
  const dirty =
    draft.reason ||
    draft.witnessed ||
    draft.publicReason ||
    draft.points !== (correcting ? "-1" : "1");

  useEffect(() => {
    if (!undo || now >= undo.deadline) return;
    const timer = setTimeout(() => setNow(Date.now()), 200);
    return () => clearTimeout(timer);
  }, [undo, now]);

  function edit(change) {
    pending.current = null;
    setConfirming(false);
    setNotice(null);
    setDraft((current) => ({ ...current, ...change }));
  }

  function close() {
    if (lock.current) return;
    if (
      (dirty || playersDirty.current || retry) &&
      !window.confirm(
        retry
          ? "The last score has no confirmation yet. Close and discard the retry draft?"
          : "Discard the unsaved changes?",
      )
    )
      return;
    onClose();
  }

  async function publish(payload = pending.current) {
    if (!payload || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    let receipt;
    try {
      const write = payload.correcting ? adjustScore : addPoints;
      receipt = await write(payload);
    } catch (error) {
      if (error.reauth) setReauth(true);
      if (error.uncertain || error.reauth || !navigator.onLine) setRetry(true);
      else setRetry(false);
      setNotice({
        error: true,
        text: error.message || "The league didn’t confirm this score.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
    if (!receipt) return;
    pending.current = null;
    setRetry(false);
    setConfirming(false);
    setCorrecting(false);
    setDraft(blankScore);
    try {
      localStorage.setItem(localPlayerKey, payload.playerId);
    } catch {}
    const passed = payload.impact?.passed;
    setNotice({
      text: `${payload.correcting ? "Correction published" : "Penalty published"} for ${payload.name}.${passed?.length ? ` Passed ${passed.join(", ")} in the standings.` : ""}`,
    });
    if (!payload.correcting) {
      setNow(Date.now());
      setUndo({
        id: receipt.id,
        deadline: Date.parse(receipt.created_at) + UNDO_MS,
        key: crypto.randomUUID(),
      });
    }
    await refresh();
  }

  function submit(event) {
    event.preventDefault();
    if (!valid || !online || lock.current) return;
    if (correcting && !confirming) {
      setConfirming(true);
      return;
    }
    const payload = {
      playerId: active.id,
      points,
      reason: draft.reason,
      consent: draft.witnessed,
      requestId: pending.current?.requestId ?? crypto.randomUUID(),
      name: active.name,
      publicReason: draft.publicReason,
      correcting,
      impact,
    };
    pending.current = payload;
    publish(payload);
  }

  async function reverse() {
    if (!undo || lock.current || !online) return;
    lock.current = true;
    setBusy(true);
    try {
      await undoPoints(undo.id, undo.key);
      setUndo(null);
      setNotice({
        text: "Penalty undone. A signed correction was added to the ledger.",
      });
      await refresh();
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Sheet
      titleId="scorekeeper-title"
      label="Close admin panel"
      onClose={close}
      className="scorekeeper-sheet"
    >
      <header className="sheet-heading">
        <h2 id="scorekeeper-title">{title}</h2>
        {admin && !reauth && (
          <div className="score-session">
            <span>Signed in as {admin.email || "scorekeeper"}</span>
            <button
              onClick={async () => {
                if (
                  (dirty || retry || playersDirty.current) &&
                  !window.confirm("Sign out and discard the unsaved changes?")
                )
                  return;
                await onLogout();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      {!admin || reauth ? (
        <>
          <Login
            onLogin={async (credentials) => {
              await onLogin(credentials);
              setReauth(false);
              if (pending.current) await publish();
            }}
          />
          {reauth && (
            <p role="status" className="score-toast">
              Your score draft will resume after sign-in.
            </p>
          )}
        </>
      ) : (
        <>
          <nav className="score-tabs" aria-label="Scorekeeper sections">
            {["Score", "Players", "Ledger"].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={tab === name}
                disabled={busy || retry}
                onClick={() => {
                  if (
                    tab === "Players" &&
                    name !== tab &&
                    playersDirty.current
                  ) {
                    if (!window.confirm("Discard the unsaved player changes?"))
                      return;
                    playersDirty.current = false;
                    setEditing(null);
                  }
                  setTab(name);
                }}
              >
                {name}
              </button>
            ))}
          </nav>
          {tab === "Score" && (
            <form className="score-form" onSubmit={submit} noValidate>
              {!online && (
                <p role="status">
                  Offline. Your draft is ready to retry when you reconnect.
                </p>
              )}
              {!players.length && (
                <p>No active players. Add one in the Players tab.</p>
              )}
              <fieldset disabled={busy || retry || confirming}>
                <legend>Player</legend>
                <div className="score-players">
                  {players.map((player) => (
                    <button
                      type="button"
                      key={player.id}
                      aria-pressed={active?.id === player.id}
                      onClick={() => {
                        setTarget(player.id);
                        edit({});
                      }}
                    >
                      <Avatar player={player} />
                      {player.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={busy || retry || confirming}>
                <legend>{correcting ? "Correction" : "Penalty points"}</legend>
                <div className="score-stepper">
                  <button
                    type="button"
                    aria-label="Decrease points"
                    onClick={() =>
                      edit({
                        points: String(
                          Math.max(correcting ? -999 : 1, (points ?? 2) - 1),
                        ),
                      })
                    }
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    inputMode={correcting ? "text" : "numeric"}
                    aria-label={correcting ? "Correction points" : "Points"}
                    value={draft.points}
                    aria-invalid={points === null}
                    onChange={(event) => edit({ points: event.target.value })}
                  />
                  <button
                    type="button"
                    aria-label="Increase points"
                    onClick={() =>
                      edit({ points: String(Math.min(999, (points ?? 0) + 1)) })
                    }
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {!correcting && (
                  <div className="score-quick">
                    {[1, 2, 3, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={points === value}
                        onClick={() => edit({ points: String(value) })}
                      >
                        +{value}
                      </button>
                    ))}
                  </div>
                )}
                {points === null && (
                  <small>
                    {correcting
                      ? "Enter a whole change from −999 to 999, excluding zero."
                      : "Enter a whole number from 1 to 999."}
                  </small>
                )}
                {active &&
                  points !== null &&
                  Number(active.points_total) + points < 0 && (
                    <small>A correction cannot make the total negative.</small>
                  )}
              </fieldset>
              <fieldset disabled={busy || retry || confirming}>
                <label>
                  <span className="score-inline score-reason-label">
                    Reason{" "}
                    <small>
                      {reasonLength}/{REASON_LIMIT}
                    </small>
                  </span>
                  <textarea
                    aria-label="Reason for the penalty"
                    rows={2}
                    value={draft.reason}
                    onChange={(event) =>
                      edit({
                        reason: [
                          ...event.target.value.replace(
                            /[\u0000-\u001f\u007f-\u009f]/g,
                            "",
                          ),
                        ]
                          .slice(0, REASON_LIMIT)
                          .join(""),
                      })
                    }
                    required
                  />
                </label>
                {!!recent.length && (
                  <div className="score-quick" aria-label="Recent reasons">
                    {recent.map((reason) => (
                      <button
                        type="button"
                        key={reason}
                        onClick={() => edit({ reason })}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                )}
                <label className="score-toggle">
                  <input
                    type="checkbox"
                    checked={draft.publicReason}
                    onChange={(event) =>
                      edit({ publicReason: event.target.checked })
                    }
                  />{" "}
                  Share this reason in public activity
                </label>
                <label className="score-toggle witness">
                  <input
                    type="checkbox"
                    checked={draft.witnessed}
                    onChange={(event) =>
                      edit({ witnessed: event.target.checked })
                    }
                  />{" "}
                  Witnessed
                </label>
              </fieldset>
              {active && points !== null && (
                <div className="score-preview-line">
                  <strong>
                    {active.name} {active.points_total} →{" "}
                    {Number(active.points_total) + points}
                  </strong>
                  <span>Position {impact.position}</span>
                </div>
              )}
              {confirming && (
                <div className="score-confirm">
                  <p>Publish this signed correction for {active?.name}?</p>
                  <button type="button" onClick={() => setConfirming(false)}>
                    Keep editing
                  </button>
                </div>
              )}
              {retry ? (
                <button
                  type="button"
                  className="solid-action"
                  disabled={!online || busy}
                  onClick={() => publish()}
                >
                  {busy ? "Waiting for the league…" : "Retry publishing"}
                </button>
              ) : (
                <button
                  type="submit"
                  className="solid-action"
                  disabled={!valid || !online || busy}
                >
                  {busy
                    ? "Publishing…"
                    : correcting && !confirming
                      ? "Review correction"
                      : active && points !== null
                        ? `Publish ${points > 0 ? "+" : ""}${points} to ${active.name}`
                        : "Publish score"}
                </button>
              )}
              <button
                type="button"
                className="score-text-button"
                disabled={busy || retry}
                onClick={() => {
                  if (
                    draft.reason &&
                    !window.confirm("Discard the unsaved reason?")
                  )
                    return;
                  setCorrecting(!correcting);
                  edit({ ...blankScore, points: correcting ? "1" : "-1" });
                }}
              >
                {correcting ? "Back to penalties" : "Correct a score"}
              </button>
            </form>
          )}
          {tab === "Players" && (
            <section className="score-player-tools">
              <PlayerForm
                key={editing?.id || "new"}
                initial={editing || newPlayer}
                editing={Boolean(editing)}
                onDirty={() => {
                  playersDirty.current = true;
                }}
                onCancel={() => {
                  if (
                    !playersDirty.current ||
                    window.confirm("Discard the unsaved player changes?")
                  ) {
                    setEditing(null);
                    playersDirty.current = false;
                  }
                }}
                onSave={async (form) => {
                  await (editing ? updatePlayer(form) : createPlayer(form));
                  playersDirty.current = false;
                  setEditing(null);
                  setNotice({
                    text: editing ? "Player updated." : "Player added.",
                  });
                  await refresh();
                }}
              />
              <ul>
                {players.map((player) => (
                  <li key={player.id}>
                    <Avatar player={player} />
                    <strong>{player.name}</strong>
                    <button
                      onClick={() => {
                        if (
                          playersDirty.current &&
                          !window.confirm("Discard the unsaved player changes?")
                        )
                          return;
                        playersDirty.current = false;
                        setEditing(player);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Archive ${player.name}? Their score history stays in the ledger.`,
                          )
                        )
                          return;
                        try {
                          await archivePlayer(player.id);
                          await refresh();
                          setNotice({ text: `${player.name} archived.` });
                        } catch (error) {
                          setNotice({ error: true, text: error.message });
                        }
                      }}
                    >
                      Archive
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === "Ledger" && (
            <PrivateLedger
              events={events}
              names={names}
              error={ledgerError}
              refresh={refresh}
            />
          )}
          {notice && (
            <div
              className={`score-toast ${notice.error ? "score-error" : ""}`}
              role={notice.error ? "alert" : "status"}
            >
              {notice.text}
            </div>
          )}
          {undo && remaining > 0 && (
            <div className="undo-bar">
              <span>Undo available for {remaining}s</span>
              <button
                type="button"
                onClick={reverse}
                disabled={busy || !online}
              >
                Undo penalty
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
