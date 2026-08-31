import React from "react";
import {
  DPR_OUTBOX_STATUS,
  getDprOutboxEntryDiagnostics,
} from "../utils/offlineDprOutbox";
import "../Styles/DprOutboxAttentionList.css";

const getFailedEntries = (entries) => (Array.isArray(entries) ? entries : []).filter(
  (entry) => entry?.syncStatus === DPR_OUTBOX_STATUS.FAILED
);

function DprOutboxAttentionList({
  entries,
  isOnline,
  isSyncing,
  onRetry,
  onDiscard,
}) {
  const failedEntries = getFailedEntries(entries);

  if (failedEntries.length === 0) return null;

  const handleDiscard = (entry, details) => {
    const description = `${details.activity} at ${details.site} on ${details.date}`;
    const confirmed = typeof window === "undefined" || typeof window.confirm !== "function"
      ? false
      : window.confirm(`Discard this unsynchronized local site update (${description})? This only removes it from this device and cannot delete a server DPR.`);

    if (confirmed && typeof onDiscard === "function") {
      void onDiscard(entry.clientSubmissionId);
    }
  };

  return (
    <section className="dpr-outbox-attention" aria-live="polite" aria-labelledby="dpr-outbox-attention-title">
      <div className="dpr-outbox-attention-heading">
        <div>
          <h2 id="dpr-outbox-attention-title">Local updates needing attention</h2>
          <p>These updates remain only on this device until Firestore confirms them.</p>
        </div>
      </div>

      <div className="dpr-outbox-attention-list">
        {failedEntries.map((entry) => {
          const details = getDprOutboxEntryDiagnostics(entry);

          return (
            <article className="dpr-outbox-attention-item" key={entry.clientSubmissionId}>
              <div className="dpr-outbox-attention-details">
                <strong>{details.activity}</strong>
                <span>{details.site} · {details.date}</span>
                <p><b>Reason:</b> {details.reason}</p>
                <small>{details.retryable ? "Manual retry is available." : "Review the reason before retrying or discarding this local update."}</small>
              </div>
              <div className="dpr-outbox-attention-actions">
                <button
                  type="button"
                  onClick={() => { if (typeof onRetry === "function") void onRetry(entry.clientSubmissionId); }}
                  disabled={!isOnline || isSyncing || !details.canManualRetry}
                  title={details.canManualRetry ? "Try synchronizing this local update again." : "This queued DPR is invalid. Enter a new DPR after reviewing the required details."}
                >
                  {isSyncing ? "Syncing..." : "Retry Sync"}
                </button>
                <button
                  type="button"
                  className="dpr-outbox-discard"
                  onClick={() => handleDiscard(entry, details)}
                  disabled={isSyncing}
                >
                  Discard Local Update
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default DprOutboxAttentionList;