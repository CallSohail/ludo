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
  certificateFromRecord,
  normalizeMessage,
  safeCertificateFilename,
  MAX_CERTIFICATE_MESSAGE,
} from "./certificateModel";
import {
  renderCertificate,
  certificatePngBundle,
  certificatePageCount,
  certificatePdf,
  saveBlob,
} from "./certificateRenderer";
import "./certificates.css";
import {
  registryStatus,
  listPlayerCertificates,
  fetchCertificateComments,
  issueCertificate,
  verificationUrl,
} from "./certificateService";
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
  adminUser,
  onOpenAdmin,
  issuedRecord,
}) {
  const [record, setRecord] = useState(null);
  const [issuedList, setIssuedList] = useState([]);
  const [listError, setListError] = useState("");
  const [comments, setComments] = useState([]);
  const [selectedComments, setSelectedComments] = useState([]);
  const [commentError, setCommentError] = useState("");
  const [registry, setRegistry] = useState(null);
  const [issueError, setIssueError] = useState("");
  const [consent, setConsent] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const requestId = useRef(crypto.randomUUID());
  const activeRecord = issuedRecord || record;
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
  const fullPreview = useRef(null);
  const [fullPreviewSrc, setFullPreviewSrc] = useState("");
  const job = useRef(0);
  const player = selectedId
    ? players.find((p) => p.id === selectedId)
    : players[0];
  const draftModel = useMemo(
    () =>
      player
        ? certificateModel(player, players, events, lastUpdated || new Date())
        : null,
    [player, players, events, lastUpdated],
  );
  const model = useMemo(
    () =>
      activeRecord
        ? certificateFromRecord(activeRecord)
        : draftModel
          ? { ...draftModel, comments: selectedComments }
          : null,
    [activeRecord, draftModel, selectedComments],
  );
  const message = activeRecord
    ? model.message
    : normalizeMessage(
        player && Object.hasOwn(drafts, player.id) ? drafts[player.id] : "",
      );
  const renderKey = JSON.stringify([model, message, pageIndex]);
  useEffect(() => {
    let alive = true;
    registryStatus()
      .then((s) => {
        if (alive) setRegistry(s);
      })
      .catch((e) => {
        if (alive) setIssueError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setRecord(null);
    setSelectedComments([]);
    setComments([]);
    setCommentError("");
    setConsent(false);
    setPageIndex(0);
    requestId.current = crypto.randomUUID();
  }, [selectedId]);
  useEffect(() => {
    let alive = true;
    if (!adminUser || !player || issuedRecord) {
      setComments([]);
      setSelectedComments([]);
      return;
    }
    fetchCertificateComments(player.id)
      .then((rows) => {
        if (alive) setComments(rows);
      })
      .catch((e) => {
        if (alive) setCommentError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [adminUser, player?.id, issuedRecord, lastUpdated]);
  useEffect(() => {
    let alive = true;
    setIssuedList([]);
    setListError("");
    if (!player || issuedRecord || !registry?.available) return;
    listPlayerCertificates(player.id)
      .then((rows) => {
        if (alive) setIssuedList(rows);
      })
      .catch((e) => {
        if (alive) setListError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [player?.id, record, issuedRecord, registry]);
  useEffect(() => {
    setConsent(false);
    requestId.current = crypto.randomUUID();
  }, [message, selectedComments, draftModel]);
  const issue = async () => {
    setBusy("issue");
    setIssueError("");
    try {
      const result = await issueCertificate({
        player,
        model,
        message,
        comments: selectedComments,
        consent,
        requestId: requestId.current,
        demoAdmin: Boolean(adminUser),
      });
      setRecord(result);
      setPageIndex(0);
      setAnnouncement(
        result.demo
          ? "Demo certificate saved in this browser. Its verification link works here only."
          : "Certificate issued. The permanent verification link is ready.",
      );
    } catch (e) {
      setIssueError(e.message);
    } finally {
      setBusy("");
    }
  };
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
        await renderCertificate(buffer, model, message, pageIndex);
        const count = await certificatePageCount(model, message);
        if (request === job.current) setPageCount(count);
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
  }, [model, message, pageIndex]);
  const changeMessage = (value) => {
    setPageIndex(0);
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
      await renderCertificate(snapshot, model, message, 0);
      const result =
        type === "pdf"
          ? {
              blob: await certificatePdf(snapshot, model, message),
              extension: "pdf",
            }
          : await certificatePngBundle(snapshot, model, message);
      saveBlob(
        result.blob,
        safeCertificateFilename(model.name, model.rank, result.extension),
      );
      setAnnouncement(
        `${type.toUpperCase()} certificate downloaded for ${model.name}.`,
      );
    } catch (error) {
      setDownloadError(error.message || "Download failed. Please try again.");
    } finally {
      setBusy("");
    }
  };
  if (!players.length && !activeRecord)
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
  if (!player && !activeRecord)
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
      {!issuedRecord && (
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
                  aria-pressed={player?.id === p.id}
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
            Live standings decide the position and edition. Downloads preserve
            the snapshot shown.
          </p>
        </aside>
      )}
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
          <div className="certificate-preview-tools">
            <button
              className="dash-button"
              disabled={!readyForModel}
              onClick={() => {
                setFullPreviewSrc(canvas.current.toDataURL("image/png"));
                fullPreview.current.showModal();
              }}
            >
              Open full-size preview
            </button>
            <a className="dash-button" href="#verify">
              Verify a certificate
            </a>
          </div>
          <dialog
            ref={fullPreview}
            className="certificate-full-preview"
            aria-label="Full-size certificate preview"
          >
            <form method="dialog">
              <button className="dash-button" autoFocus>
                Close preview
              </button>
            </form>
            {fullPreviewSrc && (
              <img
                src={fullPreviewSrc}
                alt={`Full-size certificate for ${model.name}, page ${pageIndex + 1}`}
              />
            )}
          </dialog>
          {pageCount > 1 && (
            <div className="certificate-page-controls">
              <button
                className="dash-button"
                disabled={pageIndex === 0 || !!busy}
                onClick={() => setPageIndex((i) => i - 1)}
              >
                Previous page
              </button>
              <span>
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button
                className="dash-button"
                disabled={pageIndex === pageCount - 1 || !!busy}
                onClick={() => setPageIndex((i) => i + 1)}
              >
                Next page
              </button>
            </div>
          )}
          <div className="certificate-downloads">
            <p>
              A4 landscape · high-resolution artwork
              <br />
              <span>
                PDF with clickable verification link. 3500 × 2475 px PNG per
                page.
              </span>
            </p>
            <div>
              <button
                className="dash-button"
                disabled={!readyForModel || !!busy}
                onClick={() => download("png")}
              >
                <FileImage size={16} />
                {busy === "png"
                  ? "Creating PNG…"
                  : pageCount > 1
                    ? "Download PNGs (ZIP)"
                    : "Download PNG"}
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
        {!issuedRecord && (
          <section className="dash-panel certificate-issued-panel">
            <div className="dash-panel-head">
              <div>
                <h2>Issued for {model.name}</h2>
                <p>
                  Latest 12 permanent snapshots. Open a record to verify or
                  download it again.
                </p>
              </div>
            </div>
            <div className="certificate-issued-list">
              {listError ? (
                <p role="status">{listError}</p>
              ) : issuedList.length ? (
                issuedList.map((r) => (
                  <a
                    className="dash-button"
                    key={r.id}
                    href={`#verify=${r.id}`}
                  >
                    {new Date(r.issued_at).toLocaleString()} ·{" "}
                    {r.revoked_at ? "Revoked" : "View record"} ↗
                  </a>
                ))
              ) : (
                <p>No certificates have been issued for this player yet.</p>
              )}
            </div>
          </section>
        )}
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
            {activeRecord && (
              <p className="certificate-disclosure">
                {activeRecord.demo
                  ? "Demo record saved in this browser."
                  : "Issued snapshot saved to the league registry."}{" "}
                <a href={verificationUrl(activeRecord.id)}>
                  Verify this certificate ↗
                </a>
                {!issuedRecord && (
                  <button
                    className="dash-button"
                    onClick={() => {
                      setRecord(null);
                      setConsent(false);
                      requestId.current = crypto.randomUUID();
                    }}
                  >
                    Create a new draft
                  </button>
                )}
              </p>
            )}
            <label className="certificate-message-label">
              Your message to {model.name}
              <textarea
                aria-label="Personal certificate message"
                maxLength={MAX_CERTIFICATE_MESSAGE}
                rows={5}
                placeholder="Add a personal commendation, a favourite table moment, or a message from the league."
                value={message}
                onChange={(e) => changeMessage(e.target.value)}
                disabled={!!busy || !!activeRecord}
              />
              <span>
                {message.length}/{MAX_CERTIFICATE_MESSAGE} characters · included
                in both downloads
              </span>
            </label>
            {activeRecord ? (
              <div className="certificate-approved-comments">
                <h3>Published table comments</h3>
                {model.comments.length ? (
                  model.comments.map((c, i) => (
                    <blockquote key={i}>
                      <p>{c.reason}</p>
                      <small>
                        Entry #{c.event_number} · {c.points > 0 ? "+" : ""}
                        {c.points} points
                      </small>
                    </blockquote>
                  ))
                ) : (
                  <p>No table comments were published on this certificate.</p>
                )}
              </div>
            ) : (
              <div className="certificate-comment-picker">
                <h3>Words from the table</h3>
                <p>
                  Choose scoring comments to publish on the certificate and
                  verification page. Only a scorekeeper can read private
                  comments. The latest 1,000 entries are available for
                  selection.
                </p>
                {!adminUser ? (
                  <button
                    className="dash-button"
                    onClick={() => onOpenAdmin("certificate")}
                  >
                    Sign in to include table comments
                  </button>
                ) : (
                  <>
                    <p>
                      {selectedComments.length} selected · maximum 100 · longer
                      collections include attachment pages
                    </p>
                    {comments.map((c) => (
                      <label className="certificate-comment-choice" key={c.id}>
                        <input
                          type="checkbox"
                          checked={selectedComments.some((x) => x.id === c.id)}
                          disabled={
                            !!busy ||
                            (selectedComments.length >= 100 &&
                              !selectedComments.some((x) => x.id === c.id))
                          }
                          onChange={(e) => {
                            setSelectedComments((old) =>
                              e.target.checked
                                ? [...old, c].sort(
                                    (a, b) => a.event_number - b.event_number,
                                  )
                                : old.filter((x) => x.id !== c.id),
                            );
                            setPageIndex(0);
                          }}
                        />
                        <span>
                          <strong>
                            #{c.event_number} · {c.points > 0 ? "+" : ""}
                            {c.points} points
                          </strong>
                          <br />
                          {c.reason}
                        </span>
                      </label>
                    ))}
                    {!comments.length && !commentError && (
                      <p>No scoring comments available for this player.</p>
                    )}
                    {commentError && <p role="alert">{commentError}</p>}
                  </>
                )}
              </div>
            )}
            <div className="certificate-message-actions">
              <p>
                Messages are saved on this device only, not shared with other
                visitors. Selected scoring comments are published only after a
                scorekeeper confirms issuance.
              </p>
              <button
                className="dash-button"
                disabled={!message || !!busy || !!activeRecord}
                onClick={() => changeMessage("")}
              >
                Clear message
              </button>
            </div>
            {!activeRecord && (
              <div className="certificate-issuance">
                <h3>Issue a verifiable certificate</h3>
                <p>
                  Preview downloads are marked unissued. Issuing freezes this
                  recipient, standings, personal message and selected comments
                  in a public record.
                </p>
                {registry?.demo && (
                  <p>
                    Demo mode: records are saved only in this browser and are
                    labelled demo.
                  </p>
                )}
                {adminUser ? (
                  <>
                    <label className="certificate-comment-choice">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        disabled={!!busy}
                      />
                      <span>
                        I approve publishing this certificate, personal message
                        and selected table comments publicly.
                      </span>
                    </label>
                    <button
                      className="dash-button primary"
                      disabled={
                        !consent ||
                        !readyForModel ||
                        !!busy ||
                        !registry?.available
                      }
                      onClick={issue}
                    >
                      {busy === "issue" ? "Issuing…" : "Issue certificate"}
                    </button>
                    {registry && !registry.available && (
                      <p>
                        Certificate registry unavailable. Preview downloads
                        still work.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    className="dash-button"
                    onClick={() => onOpenAdmin("certificate")}
                  >
                    Sign in as scorekeeper to issue
                  </button>
                )}
                {issueError && <p role="alert">{issueError}</p>}
              </div>
            )}
            {storageWarning && (
              <p className="certificate-inline-error" role="status">
                {storageWarning}
              </p>
            )}
            <p className="certificate-disclosure">
              A friendly league recognition. Issued records verify the recipient
              and published snapshot; they do not prove match wins. Higher
              positions mean more penalty points. Ties follow the existing
              player creation order.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
