import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Crown,
  Download,
  FileImage,
  MessageSquare,
  Search,
  ArrowUpRight,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import {
  certificateModel,
  normalizeMessage,
  safeCertificateFilename,
  MAX_CERTIFICATE_MESSAGE,
} from "./certificateModel";
import {
  renderCertificate,
  canvasPng,
  certificatePdf,
  saveBlob,
} from "./certificateRenderer";
import "./certificates.css";
const DRAFT_KEY = "ludo-certificate-messages-v1";
function readDrafts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
export function LeaderSpotlight({ players, onPlayer, onCertificate }) {
  const leader = players[0];
  if (!leader) return null;
  const tied =
    players.filter(
      (p) => Number(p.points_total) === Number(leader.points_total),
    ).length > 1;
  return (
    <section className="league-crown" aria-label="Current number one">
      <span className="league-crown-seal" aria-hidden="true">
        <Crown size={24} />
      </span>
      <div>
        <strong>{leader.name}</strong>
        <small>
          {Number(leader.points_total) === 0
            ? "First on the opening table"
            : tied
              ? "The shared penalty crown"
              : "The penalty crown"}{" "}
          · Position #1 · {leader.points_total} penalty points
          {tied ? " · equal scores use creation order" : ""}
        </small>
      </div>
      <div className="league-crown-actions">
        <button className="dash-button" onClick={() => onPlayer(leader.id)}>
          View profile
          <ArrowUpRight size={14} />
        </button>
        <button
          className="dash-button crown-action"
          onClick={() => onCertificate(leader.id)}
        >
          <Award size={15} />
          Crown certificate
        </button>
      </div>
    </section>
  );
}
export default function Certificates({
  players,
  events,
  lastUpdated,
  selectedId,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState(readDrafts);
  const [storageWarning, setStorageWarning] = useState("");
  const [ready, setReady] = useState(false);
  const [renderedKey, setRenderedKey] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [busy, setBusy] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const canvas = useRef(null);
  const job = useRef(0);
  const player = selectedId
    ? players.find((p) => p.id === selectedId)
    : players[0];
  const model = useMemo(
    () =>
      player
        ? certificateModel(player, players, events, lastUpdated || new Date())
        : null,
    [player, players, events, lastUpdated],
  );
  const message = normalizeMessage(
    player && Object.hasOwn(drafts, player.id) ? drafts[player.id] : "",
  );
  const renderKey = JSON.stringify([model, message]);
  const readyForModel = ready && renderedKey === renderKey;
  const visible = players.filter((p) =>
    p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  );
  useEffect(() => {
    setReady(false);
    setPreviewError("");
    setDownloadError("");
    if (!model) return;
    const request = ++job.current;
    const timer = setTimeout(async () => {
      try {
        const buffer = document.createElement("canvas");
        await renderCertificate(buffer, model, message);
        if (request !== job.current || !canvas.current) return;
        canvas.current.width = buffer.width;
        canvas.current.height = buffer.height;
        canvas.current.getContext("2d").drawImage(buffer, 0, 0);
        setRenderedKey(renderKey);
        setReady(true);
      } catch (error) {
        if (request === job.current)
          setPreviewError(
            error.message ||
              "The certificate could not be loaded. Please try again.",
          );
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      job.current++;
    };
  }, [model, message]);
  const changeMessage = (value) => {
    const next = { ...drafts, [player.id]: normalizeMessage(value) };
    setDrafts(next);
    setAnnouncement("");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Browser storage is unavailable. Your message works for this visit but may be lost after reload.",
      );
    }
  };
  const download = async (type) => {
    if (!readyForModel || busy || !model) return;
    setBusy(type);
    setDownloadError("");
    setAnnouncement("");
    try {
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.current.width;
      snapshot.height = canvas.current.height;
      snapshot.getContext("2d").drawImage(canvas.current, 0, 0);
      const blob =
        type === "pdf"
          ? await certificatePdf(snapshot)
          : await canvasPng(snapshot);
      saveBlob(blob, safeCertificateFilename(model.name, model.rank, type));
      setAnnouncement(
        `${type.toUpperCase()} certificate downloaded for ${model.name}.`,
      );
    } catch (error) {
      setDownloadError(error.message || "Download failed. Please try again.");
    } finally {
      setBusy("");
    }
  };
  if (!players.length)
    return (
      <div className="dash-empty">
        <Award size={28} />
        <strong>No certificates yet</strong>
        <p>
          Add players in the scorekeeper. Each active player will receive a
          personalised certificate.
        </p>
      </div>
    );
  if (!player)
    return (
      <div className="dash-empty">
        <Award size={28} />
        <strong>Player certificate unavailable</strong>
        <p>
          This player is no longer on the active table, or the certificate link
          is incorrect.
        </p>
        <button className="dash-button" onClick={() => onSelect(players[0].id)}>
          View current collection
        </button>
      </div>
    );
  return (
    <div className="certificates-workspace">
      <aside className="certificate-roster dash-panel">
        <div className="dash-panel-head">
          <div>
            <h2>The league collection</h2>
            <p>{players.length} personal certificates · current standings</p>
          </div>
        </div>
        <label className="dash-search certificate-search">
          <Search size={16} />
          <input
            aria-label="Search certificate players"
            placeholder="Find a player"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div
          className="certificate-player-list"
          aria-label="Select certificate player"
        >
          {visible.map((p) => {
            const rank = players.findIndex((item) => item.id === p.id) + 1;
            return (
              <button
                key={p.id}
                className={`certificate-player ${rank === 1 ? "crown-player" : ""}`}
                aria-pressed={player.id === p.id}
                onClick={() => {
                  onSelect(p.id);
                  setAnnouncement("");
                }}
              >
                <span>
                  {rank === 1 ? (
                    <Crown size={17} />
                  ) : (
                    String(rank).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {rank === 1
                      ? "The crown edition"
                      : rank <= 3
                        ? "Podium recognition"
                        : "League recognition"}
                  </small>
                </span>
                <b>
                  {p.points_total}
                  <small>pts</small>
                </b>
              </button>
            );
          })}
          {!visible.length && (
            <div className="dash-empty">
              <strong>No player matches</strong>
              <button className="dash-button" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          )}
        </div>
        <p className="certificate-local-note">
          Live standings decide the position and edition. Downloads preserve the
          snapshot shown.
        </p>
      </aside>
      <div className="certificate-detail">
        <section className="dash-panel certificate-preview-panel">
          <div className="dash-panel-head">
            <div>
              <h2>{model.leader ? "The crown edition" : model.title}</h2>
              <p>
                {model.name} · position {model.rank} of {model.total}
              </p>
            </div>
            <span className="certificate-edition">
              {model.leader ? <Crown size={15} /> : <Award size={15} />}Évry
              2026
            </span>
          </div>
          <div
            className="certificate-paper-wrap"
            aria-busy={!readyForModel && !previewError}
          >
            <canvas
              ref={canvas}
              className={`certificate-paper ${readyForModel ? "is-ready" : ""}`}
              role="img"
              aria-label={`Certificate for ${model.name}, ${model.title}, position ${model.rank}, ${model.points} penalty points. Full certificate content is listed below.`}
            />
            {!readyForModel && !previewError && (
              <div className="certificate-loading" role="status">
                <LoaderCircle size={20} />
                <span>Preparing your certificate…</span>
              </div>
            )}
            {previewError && (
              <div className="certificate-render-error" role="alert">
                <AlertCircle size={20} />
                <strong>Certificate not ready</strong>
                <p>{previewError}</p>
              </div>
            )}
          </div>
          <div className="certificate-downloads">
            <p>
              A4 landscape · high-resolution artwork
              <br />
              <span>PDF for printing. PNG for sharing.</span>
            </p>
            <div>
              <button
                className="dash-button"
                disabled={!readyForModel || !!busy}
                onClick={() => download("png")}
              >
                <FileImage size={16} />
                {busy === "png" ? "Creating PNG…" : "Download PNG"}
              </button>
              <button
                className="dash-button primary"
                disabled={!readyForModel || !!busy}
                onClick={() => download("pdf")}
              >
                <Download size={16} />
                {busy === "pdf" ? "Creating PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
          {downloadError && (
            <div className="certificate-inline-error" role="alert">
              {downloadError}
            </div>
          )}
          <div className="certificate-download-status" role="status">
            {announcement}
          </div>
        </section>
        <section className="dash-panel certificate-content">
          <div className="dash-panel-head">
            <div>
              <h2>Included on this certificate</h2>
              <p>
                Personalised from the current profile and all available history.
              </p>
            </div>
            <MessageSquare size={17} />
          </div>
          <div className="certificate-commendations">
            <h3>
              {model.name} · {model.title}
            </h3>
            <ul>
              {model.commendations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <dl className="certificate-facts">
              <div>
                <dt>Current position</dt>
                <dd>
                  {model.rank} of {model.total}
                </dd>
              </div>
              <div>
                <dt>Penalty points</dt>
                <dd>{model.points}</dd>
              </div>
              <div>
                <dt>Available awards</dt>
                <dd>
                  {model.historyAvailable
                    ? model.metric.awards
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt>Standings loaded</dt>
                <dd>{model.dateLabel} · Paris</dd>
              </div>
            </dl>
            <label className="certificate-message-label">
              Your message to {model.name}
              <textarea
                aria-label="Personal certificate message"
                maxLength={MAX_CERTIFICATE_MESSAGE}
                rows={5}
                placeholder="Add a personal commendation, a favourite table moment, or a message from the league."
                value={message}
                onChange={(e) => changeMessage(e.target.value)}
                disabled={!!busy}
              />
              <span>
                {message.length}/{MAX_CERTIFICATE_MESSAGE} characters · included
                in both downloads
              </span>
            </label>
            <div className="certificate-message-actions">
              <p>
                Messages are saved on this device only, not shared with other
                visitors. Private scorekeeper reasons are never included
                automatically.
              </p>
              <button
                className="dash-button"
                disabled={!message || !!busy}
                onClick={() => changeMessage("")}
              >
                Clear message
              </button>
            </div>
            {storageWarning && (
              <p className="certificate-inline-error" role="status">
                {storageWarning}
              </p>
            )}
            <p className="certificate-disclosure">
              A friendly league recognition, not proof of match wins or a
              digitally signed award. Higher positions mean more penalty points.
              Ties follow the existing player creation order.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
