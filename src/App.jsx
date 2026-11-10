import Dashboard from "./Dashboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { config, emojis, isSupabaseConfigured, palette } from "./config";
import {
  addPoints,
  adjustScore,
  archivePlayer,
  createPlayer,
  fetchEvents,
  fetchPlayers,
  fetchScoreHistory,
  getCachedLeaderboard,
  getAdminProfile,
  getCurrentSession,
  signIn,
  signOut,
  updatePlayer,
  watchForAuth,
  watchForChanges,
} from "./dataService";

const initialPlayerForm = { name: "", accent: palette[0], emoji: emojis[0] };
const initialPointForm = { playerId: "", points: 1, reason: "" };

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const pointsDifference =
      Number(b.points_total || 0) - Number(a.points_total || 0);
    if (pointsDifference !== 0) return pointsDifference;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}

function formatDate(date, withSeconds = false) {
  if (!date || Number.isNaN(new Date(date).getTime()))
    return "Time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(new Date(date));
}

function Arrow() {
  return (
    <svg
      className="arrow-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}

function AccessLoading() {
  return (
    <main className="access-shell">
      <section className="access-card access-loading">
        <span className="spinner" />
        <p>Loading the league…</p>
      </section>
    </main>
  );
}

function LoginPanel({ onLogin, busy, error }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    onLogin(form);
  };
  return (
    <div className="login-screen">
      <p className="eyebrow">Restricted to people who know the scores</p>
      <h2>Scorekeeper sign in</h2>
      <p className="login-copy">
        The players can watch. Only the scorekeeper can make the numbers move.
      </p>
      <form onSubmit={submit} className="login-form">
        <label>
          Username or email
          <input
            autoComplete="username"
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
            placeholder="scorekeeper@example.com"
            required
          />
        </label>
        <label>
          Password
          <div className="password-field">
            <input
              aria-label="Password"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="primary-button full-width"
          disabled={busy}
          type="submit"
        >
          {busy ? "Checking the ledger..." : "Sign in"} <Arrow />
        </button>
      </form>
      <p className="demo-hint">
        {isSupabaseConfigured
          ? "Production mode, protected by Supabase Auth."
          : `Preview mode, try ${config.demoUsername} / ${config.demoPassword}.`}
      </p>
    </div>
  );
}

function AdminPanel({
  onClose,
  players,
  events,
  adminUser,
  onLogin,
  onRefresh,
  onBurst,
  onLogout,
  ledgerError,
}) {
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [playerForm, setPlayerForm] = useState(initialPlayerForm);
  const [pointForm, setPointForm] = useState(initialPointForm);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [pointBusy, setPointBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [formMessage, setFormMessage] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [correction, setCorrection] = useState({
    playerId: "",
    points: -1,
    reason: "",
  });
  const [manageBusy, setManageBusy] = useState(false);
  const [correctionConsent, setCorrectionConsent] = useState(false);
  const [activeTab, setActiveTab] = useState("score");
  useEffect(() => {
    const previous = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector(".admin-modal");
    const controls = () =>
      [...dialog.querySelectorAll("button, input, select, a[href]")].filter(
        (node) => !node.disabled && node.getClientRects().length,
      );
    controls()[0]?.focus();
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (
      !players.some((player) => player.id === pointForm.playerId) &&
      players.length > 0
    ) {
      setPointForm((current) => ({ ...current, playerId: players[0].id }));
    }
  }, [players, pointForm.playerId]);

  useEffect(() => {
    if (
      !players.some((player) => player.id === correction.playerId) &&
      players.length > 0
    )
      setCorrection((current) => ({ ...current, playerId: players[0].id }));
  }, [players, correction.playerId]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const handleLogin = async (form) => {
    setLoginBusy(true);
    setLoginError("");
    try {
      await onLogin(form);
    } catch (error) {
      setLoginError(error.message || "Could not open the scorebook.");
    } finally {
      setLoginBusy(false);
    }
  };

  const handlePlayer = async (event) => {
    event.preventDefault();
    if (playerForm.name.trim().length < 2)
      return setFormMessage({
        type: "error",
        text: "Give the player at least two letters. Even legends need a name.",
      });
    setPlayerBusy(true);
    setFormMessage(null);
    try {
      await createPlayer(playerForm);
      setPlayerForm({
        ...initialPlayerForm,
        accent: palette[(players.length + 1) % palette.length],
        emoji: emojis[(players.length + 1) % emojis.length],
      });
      await onRefresh();
      setFormMessage({
        type: "success",
        text: "Player added. The arena has a new suspect.",
      });
      onBurst();
    } catch (error) {
      setFormMessage({
        type: "error",
        text: error.message || "Player could not be added.",
      });
    } finally {
      setPlayerBusy(false);
    }
  };

  const handlePoints = async (event) => {
    event.preventDefault();
    if (!pointForm.playerId)
      return setFormMessage({
        type: "error",
        text: "Choose a player first. The points need an address.",
      });
    if (pointForm.reason.trim().length < 3)
      return setFormMessage({
        type: "error",
        text: "Write at least 3 characters for the reason.",
      });
    if (!consent)
      return setFormMessage({
        type: "error",
        text: "Confirm the signed receipt before publishing this point.",
      });
    setPointBusy(true);
    setFormMessage(null);
    try {
      await addPoints({
        ...pointForm,
        points: Number(pointForm.points),
        consent,
      });
      setPointForm({ ...initialPointForm, playerId: pointForm.playerId });
      setConsent(false);
      await onRefresh();
      setFormMessage({
        type: "success",
        text: `+${pointForm.points} point signed, witnessed, and released into the wild.`,
      });
      onBurst();
    } catch (error) {
      const rawMessage =
        error.message || "The point refused to enter the ledger.";
      const friendlyMessage = rawMessage.includes("digest")
        ? "Scoring is temporarily unavailable. Contact the league administrator and try again later."
        : rawMessage;
      setFormMessage({ type: "error", text: friendlyMessage });
    } finally {
      setPointBusy(false);
    }
  };

  const handleUpdatePlayer = async (event) => {
    event.preventDefault();
    setManageBusy(true);
    setFormMessage(null);
    try {
      await updatePlayer(editingPlayer);
      setEditingPlayer(null);
      await onRefresh();
      setFormMessage({ type: "success", text: "Player profile updated." });
    } catch (error) {
      setFormMessage({
        type: "error",
        text: error.message || "Player could not be updated.",
      });
    } finally {
      setManageBusy(false);
    }
  };

  const handleArchivePlayer = async (player) => {
    if (
      !window.confirm(
        `Archive ${player.name}? Their signed score history will remain in the ledger.`,
      )
    )
      return;
    setManageBusy(true);
    setFormMessage(null);
    try {
      await archivePlayer(player.id);
      await onRefresh();
      setFormMessage({
        type: "success",
        text: `${player.name} was archived safely.`,
      });
    } catch (error) {
      setFormMessage({
        type: "error",
        text: error.message || "Player could not be archived.",
      });
    } finally {
      setManageBusy(false);
    }
  };

  const handleCorrection = async (event) => {
    event.preventDefault();
    setManageBusy(true);
    setFormMessage(null);
    try {
      await adjustScore({ ...correction, consent: correctionConsent });
      setCorrectionConsent(false);
      await onRefresh();
      setCorrection({ ...correction, points: -1, reason: "" });
      setFormMessage({
        type: "success",
        text: "Score correction signed and applied.",
      });
      onBurst();
    } catch (error) {
      setFormMessage({
        type: "error",
        text: error.message || "Score could not be corrected.",
      });
    } finally {
      setManageBusy(false);
    }
  };

  if (!adminUser)
    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="admin-modal login-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Scorekeeper sign in"
        >
          <button
            className="close-button"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            onClick={onClose}
            aria-label="Close admin panel"
          >
            ×
          </button>
          <LoginPanel
            onLogin={handleLogin}
            busy={loginBusy}
            error={loginError}
          />
        </div>
      </div>
    );

  const selectedPlayer = players.find(
    (player) => player.id === pointForm.playerId,
  );
  const projectedTotal =
    Number(selectedPlayer?.points_total || 0) + Number(pointForm.points || 0);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="admin-modal admin-console"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
      >
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">Scorekeeper deck</p>
            <h2 id="admin-title">Manage the league</h2>
          </div>
          <div className="admin-top-actions">
            <span className="signed-in">
              ● Signed in as {adminUser.email || "scorekeeper"}
            </span>
            <button
              className="close-button admin-close"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }}
              onClick={onClose}
              aria-label="Close admin panel"
              title="Close admin panel"
            >
              ×
            </button>
          </div>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          <button
            type="button"
            className={activeTab === "score" ? "active" : ""}
            onClick={() => setActiveTab("score")}
          >
            <span>01</span>
            <strong>Score</strong>
            <small>Add penalties</small>
          </button>
          <button
            type="button"
            className={activeTab === "players" ? "active" : ""}
            onClick={() => setActiveTab("players")}
          >
            <span>02</span>
            <strong>Players</strong>
            <small>Add and edit</small>
          </button>
          <button
            type="button"
            className={activeTab === "ledger" ? "active" : ""}
            onClick={() => setActiveTab("ledger")}
          >
            <span>03</span>
            <strong>Ledger</strong>
            <small>{events.length} signed moves</small>
          </button>
        </nav>
        <div className={`admin-grid admin-tab-${activeTab}`}>
          <div className="admin-forms">
            {activeTab === "players" && (
              <form className="admin-card" onSubmit={handlePlayer}>
                <div className="card-title">
                  <span className="card-number">01</span>
                  <div>
                    <h3>Add a player</h3>
                    <p>Give a future champion a seat at the table.</p>
                  </div>
                </div>
                <label>
                  Player name
                  <input
                    maxLength="28"
                    value={playerForm.name}
                    onChange={(event) =>
                      setPlayerForm({ ...playerForm, name: event.target.value })
                    }
                    placeholder="e.g. The Dice Whisperer"
                  />
                </label>
                <div className="mini-fields">
                  <label>
                    Piece color
                    <div className="color-picker">
                      {palette.slice(0, 8).map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={
                            playerForm.accent === color ? "selected" : ""
                          }
                          style={{ background: color }}
                          onClick={() =>
                            setPlayerForm({ ...playerForm, accent: color })
                          }
                          aria-label={`Choose ${color} player color`}
                        />
                      ))}
                    </div>
                  </label>
                  <label>
                    Spirit emoji
                    <div className="emoji-picker">
                      {emojis.slice(0, 8).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={
                            playerForm.emoji === emoji ? "selected" : ""
                          }
                          onClick={() =>
                            setPlayerForm({ ...playerForm, emoji })
                          }
                          aria-label={`Choose ${emoji} player emoji`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
                <button
                  className="dark-button full-width"
                  disabled={playerBusy}
                  type="submit"
                >
                  {playerBusy ? "Adding..." : "Add to the arena"} <span>+</span>
                </button>
              </form>
            )}
            {activeTab === "score" && (
              <form className="admin-card points-card" onSubmit={handlePoints}>
                <div className="card-title">
                  <span className="card-number">02</span>
                  <div>
                    <h3>Record a penalty</h3>
                    <p>Type any whole number from 1 to 999.</p>
                  </div>
                </div>
                <label>
                  Player
                  <select
                    aria-label="Player"
                    value={pointForm.playerId}
                    onChange={(event) =>
                      setPointForm({
                        ...pointForm,
                        playerId: event.target.value,
                      })
                    }
                  >
                    <option value="">Choose a player...</option>
                    {players.map((player) => (
                      <option value={player.id} key={player.id}>
                        {player.emoji} {player.name}, currently{" "}
                        {player.points_total} pts
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Penalty points
                  <input
                    aria-label="Penalty points"
                    className="points-number-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="999"
                    step="1"
                    value={pointForm.points}
                    onChange={(event) =>
                      setPointForm({ ...pointForm, points: event.target.value })
                    }
                  />
                  <div className="point-picker compact">
                    {[1, 2, 3, 5, 9].map((point) => (
                      <button
                        key={point}
                        type="button"
                        className={
                          Number(pointForm.points) === point ? "selected" : ""
                        }
                        onClick={() =>
                          setPointForm({ ...pointForm, points: point })
                        }
                      >
                        +{point}
                      </button>
                    ))}
                  </div>
                </label>
                <div
                  className={`score-preview ${selectedPlayer ? "ready" : ""}`}
                >
                  <span>{selectedPlayer?.emoji || "🎯"}</span>
                  <div>
                    <small>Score impact preview</small>
                    <strong>
                      {selectedPlayer
                        ? `${selectedPlayer.name}: ${selectedPlayer.points_total} → ${projectedTotal}`
                        : "Choose a player to preview the new total"}
                    </strong>
                  </div>
                  <b>{selectedPlayer ? `+${pointForm.points}` : "—"}</b>
                </div>
                <label>
                  Reason for the penalty
                  <input
                    minLength="3"
                    maxLength="180"
                    aria-label="Reason for the penalty"
                    value={pointForm.reason}
                    onChange={(event) =>
                      setPointForm({ ...pointForm, reason: event.target.value })
                    }
                    placeholder="Lost the round"
                  />
                  <span className="field-help">
                    {pointForm.reason.length}/180 characters
                  </span>
                </label>
                <div className="reason-shortcuts" aria-label="Quick reasons">
                  {["Lost the round", "Missed the cut", "Dice betrayal"].map(
                    (reason) => (
                      <button
                        type="button"
                        key={reason}
                        onClick={() => setPointForm({ ...pointForm, reason })}
                      >
                        {reason}
                      </button>
                    ),
                  )}
                </div>
                <label className="consent-box">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <span>
                    <strong>Witnessed and approved.</strong>
                    <small>
                      This point will be signed with the current time, admin
                      identity, and previous event hash.
                    </small>
                  </span>
                  <span className="stamp">{consent ? "✓" : "!"}</span>
                </label>
                <button
                  className="primary-button full-width"
                  disabled={pointBusy || players.length === 0 || !consent}
                  type="submit"
                >
                  {pointBusy
                    ? "Signing the point..."
                    : "Sign and publish point"}{" "}
                  <span>✦</span>
                </button>
              </form>
            )}
            {activeTab === "players" && (
              <section className="admin-card manage-card">
                <div className="card-title">
                  <span className="card-number">03</span>
                  <div>
                    <h3>Manage players</h3>
                    <p>Edit profiles, archive players, or correct totals.</p>
                  </div>
                </div>
                <div className="manage-list">
                  {players.map((player) => (
                    <div className="manage-player" key={player.id}>
                      <span style={{ "--accent": player.accent }}>
                        {player.emoji}
                      </span>
                      <div>
                        <strong>{player.name}</strong>
                        <small>{player.points_total} points</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer({ ...player })}
                      >
                        Edit
                      </button>
                      <button
                        className="danger-link"
                        type="button"
                        onClick={() => handleArchivePlayer(player)}
                        disabled={manageBusy}
                      >
                        Archive
                      </button>
                    </div>
                  ))}
                </div>
                {editingPlayer && (
                  <form
                    className="edit-player-form"
                    onSubmit={handleUpdatePlayer}
                  >
                    <strong>Edit player</strong>
                    <label>
                      Name
                      <input
                        maxLength="28"
                        value={editingPlayer.name}
                        onChange={(event) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="mini-fields">
                      <label>
                        Color
                        <div className="color-picker">
                          {palette.slice(0, 8).map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={
                                editingPlayer.accent === color ? "selected" : ""
                              }
                              style={{ background: color }}
                              onClick={() =>
                                setEditingPlayer({
                                  ...editingPlayer,
                                  accent: color,
                                })
                              }
                            />
                          ))}
                        </div>
                      </label>
                      <label>
                        Emoji
                        <div className="emoji-picker">
                          {emojis.slice(0, 8).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={
                                editingPlayer.emoji === emoji ? "selected" : ""
                              }
                              onClick={() =>
                                setEditingPlayer({ ...editingPlayer, emoji })
                              }
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </label>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="dark-button"
                        disabled={manageBusy}
                        type="submit"
                      >
                        Save player
                      </button>
                    </div>
                  </form>
                )}
                <form className="correction-form" onSubmit={handleCorrection}>
                  <strong>Correct a score</strong>
                  <p>
                    Use a negative number to remove incorrect points. This
                    creates a signed adjustment instead of rewriting history.
                  </p>
                  <select
                    aria-label="Player to correct"
                    value={correction.playerId}
                    onChange={(event) =>
                      setCorrection({
                        ...correction,
                        playerId: event.target.value,
                      })
                    }
                  >
                    {players.map((player) => (
                      <option value={player.id} key={player.id}>
                        {player.name}, {player.points_total} pts
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Correction points"
                    type="number"
                    inputMode="numeric"
                    min="-999"
                    max="999"
                    step="1"
                    value={correction.points}
                    onChange={(event) =>
                      setCorrection({
                        ...correction,
                        points: event.target.value,
                      })
                    }
                  />
                  <input
                    minLength="3"
                    maxLength="180"
                    aria-label="Reason for correction"
                    placeholder="Reason for correction"
                    value={correction.reason}
                    onChange={(event) =>
                      setCorrection({
                        ...correction,
                        reason: event.target.value,
                      })
                    }
                  />
                  <label className="consent-box">
                    <input
                      type="checkbox"
                      checked={correctionConsent}
                      onChange={(event) =>
                        setCorrectionConsent(event.target.checked)
                      }
                    />
                    <span>I confirm this score correction and its reason</span>
                  </label>
                  <button
                    className="dark-button full-width"
                    disabled={manageBusy || !correctionConsent}
                    type="submit"
                  >
                    Sign correction
                  </button>
                </form>
              </section>
            )}
          </div>
          {activeTab === "ledger" && (
            <div className="ledger-card">
              <div className="ledger-heading">
                <div>
                  <p className="eyebrow">Private score receipts</p>
                  <h3>Recent moves</h3>
                </div>
                <span className="chain-mark">⛓</span>
              </div>
              <div className="ledger-list">
                {ledgerError && (
                  <div className="form-error" role="alert">
                    {ledgerError}
                    <button
                      type="button"
                      className="dash-button"
                      onClick={onRefresh}
                    >
                      Retry receipts
                    </button>
                  </div>
                )}
                {events.length === 0 ? (
                  <div className="ledger-empty">
                    No signed moves yet.
                    <br />
                    The first point is waiting for its dramatic entrance.
                  </div>
                ) : (
                  events.slice(0, 10).map((event) => {
                    const player = players.find(
                      (item) => item.id === event.player_id,
                    );
                    return (
                      <div className="ledger-row" key={event.id}>
                        <span className="ledger-points">
                          {Number(event.points) > 0 ? "+" : ""}
                          {event.points}
                        </span>
                        <div>
                          <strong>{player?.name || "Archived player"}</strong>
                          <p>{event.reason}</p>
                          <small>
                            {formatDate(event.created_at, true)} • #
                            {event.event_number || "—"}
                          </small>
                        </div>
                        <span className="ledger-hash" title={event.event_hash}>
                          ✓ {event.event_hash?.slice(0, 7)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="ledger-footer">
                <span>Receipt history</span>
                <strong>Latest {events.length} entries</strong>
              </div>
              <button
                className="logout-button"
                type="button"
                onClick={onLogout}
              >
                Lock the scorekeeper deck <Arrow />
              </button>
            </div>
          )}
        </div>
        {formMessage && (
          <div
            className={`admin-toast form-message ${formMessage.type}`}
            role="status"
          >
            <span>{formMessage.type === "success" ? "✓" : "!"}</span>
            <p>{formMessage.text}</p>
            <button
              type="button"
              onClick={() => setFormMessage(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const cachedBoard = useMemo(() => getCachedLeaderboard(), []);
  const [players, setPlayers] = useState(() =>
    sortPlayers(cachedBoard?.players || []),
  );
  const [history, setHistory] = useState(() => cachedBoard?.history || []);
  const [events, setEvents] = useState([]);
  const [ledgerError, setLedgerError] = useState("");
  const [loading, setLoading] = useState(() => !cachedBoard);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("ludo-theme") !== "paper";
    } catch {
      return true;
    }
  });
  const [lastUpdated, setLastUpdated] = useState(() =>
    cachedBoard?.savedAt ? new Date(cachedBoard.savedAt) : null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setRefreshing(true);
    const [board, ledger, scoreHistory] = await Promise.allSettled([
      fetchPlayers(),
      fetchEvents(),
      fetchScoreHistory(),
    ]);
    if (request !== requestRef.current) return;
    if (board.status === "fulfilled") {
      setPlayers(sortPlayers(board.value));
      setLastUpdated(new Date());
    }
    if (ledger.status === "fulfilled") setEvents(ledger.value);
    setLedgerError(
      ledger.status === "rejected"
        ? "Private receipts could not be refreshed. Check your connection and try again."
        : "",
    );
    if (scoreHistory.status === "fulfilled") setHistory(scoreHistory.value);
    setError(
      board.status === "rejected"
        ? "The standings could not be refreshed. Check your connection and try again."
        : scoreHistory.status === "rejected"
          ? "Score history could not be refreshed. Try again to load the latest activity."
          : "",
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applySession = (session) => {
      if (cancelled) return;
      const user = session?.user || null;
      setAdminUser(null);
      setAuthReady(true);
      if (!user) {
        setAdminOpen(false);
        return;
      }
      getAdminProfile(user.id)
        .then((profile) => {
          if (!cancelled && profile) setAdminUser(user);
        })
        .catch(() => {});
    };
    getCurrentSession()
      .then(applySession)
      .catch(() => setAuthReady(true));
    const stopWatching = watchForAuth(applySession);
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(() => {
      if (navigator.onLine && !document.hidden) refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "stadium" : "paper";
    try {
      localStorage.setItem("ludo-theme", darkMode ? "stadium" : "paper");
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  }, [darkMode]);

  useEffect(() => {
    return watchForChanges(refresh);
  }, [refresh]);
  const handleLogin = async ({ username, password }) => {
    const result = await signIn(username, password);
    setAdminUser(result.user);
    await refresh();
  };
  const handleLogout = async () => {
    await signOut();
    setAdminUser(null);
    setAdminOpen(false);
    await refresh();
  };
  const openAdmin = () => setAdminOpen(true);
  if (!authReady) return <AccessLoading />;
  return (
    <>
      <Dashboard
        players={players}
        history={history}
        loading={loading}
        error={error}
        online={online}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        onOpenAdmin={openAdmin}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((value) => !value)}
      />
      {adminOpen &&
        createPortal(
          <AdminPanel
            onClose={() => setAdminOpen(false)}
            players={players}
            events={events}
            ledgerError={ledgerError}
            adminUser={adminUser}
            onLogin={handleLogin}
            onRefresh={refresh}
            onBurst={() => {}}
            onLogout={handleLogout}
          />,
          document.body,
        )}
    </>
  );
}
