import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Search } from "lucide-react";
import {
  getIssuedCertificate,
  revokeCertificate,
  verificationUrl,
} from "./certificateService";
import { certificateFromRecord } from "./certificateModel";
import Certificates from "./Certificates";
import "./certificates.css";
export default function Verification({
  id = "",
  showCertificate = false,
  adminUser,
  onOpenAdmin,
}) {
  const [value, setValue] = useState(id),
    [record, setRecord] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [revoking, setRevoking] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setValue(id);
    setRecord(null);
    setError("");
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getIssuedCertificate(id)
      .then((r) => {
        if (alive) {
          if (r) certificateFromRecord(r);
          setRecord(r);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, retry]);
  const revoke = async () => {
    setRevoking(true);
    setError("");
    try {
      setRecord(await revokeCertificate(id, reason, Boolean(adminUser)));
      setReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setRevoking(false);
    }
  };
  const model = record ? certificateFromRecord(record) : null;
  return (
    <div className="certificate-verification">
      <header>
        <span className="dash-eyebrow">Ludo Super League · Registry</span>
        <h1>Certificate verification</h1>
        <p>
          Check the recipient and published details against the league’s
          original issued record.
        </p>
      </header>
      <form
        className="dash-panel certificate-verify-form"
        onSubmit={(e) => {
          e.preventDefault();
          let input = value.trim();
          try {
            if (input.includes("#verify="))
              input = new URL(input).hash.slice(8);
            else if (input.includes("#issued="))
              input = new URL(input).hash.slice(8);
          } catch {}
          window.location.hash = `verify=${encodeURIComponent(input)}`;
          setRetry((i) => i + 1);
        }}
      >
        <label>
          Certificate ID or verification link
          <input
            required
            aria-label="Certificate ID or verification link"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste the ID or link printed on your certificate"
          />
        </label>
        <button
          className="dash-button primary"
          type="submit"
          disabled={loading}
        >
          <Search size={16} />
          Check certificate
        </button>
      </form>
      {loading && <p role="status">Checking the issued record…</p>}
      {error && (
        <div className="certificate-inline-error" role="alert">
          {error}
          <button
            className="dash-button"
            onClick={() => setRetry((i) => i + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && id && !record && (
        <section className="dash-panel certificate-verify-result">
          <ShieldAlert />
          <h2>Certificate not found</h2>
          <p>
            This ID does not match an issued league certificate. Check the
            complete link or ask the scorekeeper. An unissued preview is not a
            verified award.
          </p>
        </section>
      )}
      {!id && !loading && (
        <p>
          Scan the QR code on an issued certificate or enter its ID above.
          Preview downloads have no issued record.
        </p>
      )}
      {record && (
        <>
          <section className="dash-panel certificate-verify-result">
            {record.revoked_at ? (
              <ShieldAlert size={28} />
            ) : (
              <ShieldCheck size={28} />
            )}
            <h2>
              {record.revoked_at
                ? "Certificate revoked"
                : record.demo
                  ? "Demo certificate · this browser only"
                  : "Issued record found"}
            </h2>
            <p>
              {record.demo
                ? "This is a local demonstration and cannot be verified on another device."
                : record.revoked_at
                  ? "This certificate is no longer valid. Its original record remains below."
                  : "This certificate was assigned by an approved league scorekeeper."}
            </p>
            {record.revoked_at && (
              <p role="status">
                Revoked {new Date(record.revoked_at).toLocaleString()} ·{" "}
                {record.revocation_reason}
              </p>
            )}
            <h3>{model.name}</h3>
            <p>{model.title}</p>
            <dl className="certificate-facts">
              <div>
                <dt>Position at issuance</dt>
                <dd>
                  {model.rank} / {model.total}
                </dd>
              </div>
              <div>
                <dt>Penalty points</dt>
                <dd>{model.points}</dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{new Date(record.issued_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Record ID</dt>
                <dd>{record.id}</dd>
              </div>
            </dl>
            <h3>Recognition</h3>
            <ul>
              {model.commendations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {model.message && (
              <>
                <h3>Personal commendation</h3>
                <p className="certificate-preserve">{model.message}</p>
              </>
            )}
            <h3>Published table comments</h3>
            {model.comments.length ? (
              model.comments.map((c, i) => (
                <blockquote key={i}>
                  <p>{c.reason}</p>
                  <small>
                    Entry #{c.event_number} · {c.points > 0 ? "+" : ""}
                    {c.points} points ·{" "}
                    {new Date(c.created_at).toLocaleString()}
                  </small>
                </blockquote>
              ))
            ) : (
              <p>No table comments were published.</p>
            )}
            <details>
              <summary>Record fingerprint</summary>
              <p className="certificate-fingerprint">
                SHA-256: {record.content_hash}
              </p>
              <p>
                The fingerprint identifies the stored snapshot. Compare the
                downloaded certificate’s recipient, points, comments and ID with
                this page; the record does not certify a modified image.
              </p>
            </details>
            <p>
              <a className="dash-button primary" href={`#issued=${record.id}`}>
                View and download issued certificate
              </a>{" "}
              <a className="dash-button" href={verificationUrl(record.id)}>
                Permanent verification link
              </a>
            </p>
            {adminUser && !record.revoked_at && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  revoke();
                }}
              >
                <h3>Revoke this certificate</h3>
                <p>
                  The original remains visible and is marked revoked. This
                  cannot be undone.
                </p>
                <label>
                  Public revocation reason
                  <input
                    aria-label="Public revocation reason"
                    required
                    minLength={3}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  className="dash-button"
                  disabled={revoking || reason.trim().length < 3}
                >
                  {revoking ? "Revoking…" : "Revoke certificate"}
                </button>
              </form>
            )}
          </section>
          {showCertificate && (
            <Certificates
              players={[]}
              events={[]}
              issuedRecord={record}
              adminUser={adminUser}
              onOpenAdmin={onOpenAdmin}
            />
          )}
        </>
      )}
    </div>
  );
}
