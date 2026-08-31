import React, { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Layout from "../Components/Layout";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { canManageBackupExport } from "../auth/authorization";
import {
  ERP_BACKUP_COLLECTIONS,
  ERP_BACKUP_EXCLUSIONS,
  createErpBackupFileName,
  downloadErpFirestoreBackup,
  exportErpFirestoreBackup,
} from "../utils/erpBackup";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import "../Styles/BackupRecovery.css";

const BACKUP_APP_VERSION = "phase-9a";

const getBackupErrorMessage = (error) => {
  if (error?.code === "backup-export-limit" || error?.code === "backup-collection-limit" || error?.code === "backup-total-limit") {
    return "This ERP dataset is too large for a safe browser download. Use the documented Admin SDK/GCP recovery export instead.";
  }
  if (error?.code === "backup-collection-read-failed") {
    return "The export stopped before any file was created because one collection could not be read. Confirm that this is an active administrator account and try again.";
  }
  return getUserFriendlyFirebaseError(
    error,
    "The ERP backup could not be created. No partial file was downloaded. Please try again."
  );
};

function BackupRecovery() {
  const { role } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lastExport, setLastExport] = useState(null);
  const canExport = canManageBackupExport(role);

  const handleExport = async () => {
    if (!canExport || isExporting) return;

    const approved = window.confirm(
      "Download a sensitive Firestore ERP data export? Store the JSON file only in an approved, encrypted backup location. This does not back up Firebase Authentication, Storage files, or project configuration."
    );
    if (!approved) return;

    setIsExporting(true);
    setError("");
    setLastExport(null);
    setProgress("Preparing collection 1 of " + ERP_BACKUP_COLLECTIONS.length + "…");

    try {
      let collectionIndex = 0;
      const backup = await exportErpFirestoreBackup({
        appVersion: BACKUP_APP_VERSION,
        loadCollection: async (collectionName) => {
          collectionIndex += 1;
          setProgress(`Reading ${collectionName} (${collectionIndex} of ${ERP_BACKUP_COLLECTIONS.length})…`);
          return getDocs(collection(db, collectionName));
        },
      });
      const fileName = createErpBackupFileName();
      downloadErpFirestoreBackup(backup, fileName);
      setLastExport({
        fileName,
        exportedAt: backup.metadata.exportedAt,
        documentCount: backup.metadata.documentCount,
        collectionCount: backup.metadata.collectionCount,
        redactedFieldCount: backup.metadata.redactedFieldCount,
      });
      setProgress("");
    } catch (backupError) {
      console.error("ERP backup export failed:", backupError);
      setError(getBackupErrorMessage(backupError));
      setProgress("");
    } finally {
      setIsExporting(false);
    }
  };

  if (!canExport) {
    return (
      <Layout title="🗄️ Backup & Recovery">
        <div className="data-page backup-recovery-page">
          <p className="backup-state backup-error" role="alert">Backup exports are restricted to active administrators.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="🗄️ Backup & Recovery">
      <div className="data-page backup-recovery-page">
        <section className="backup-intro">
          <div>
            <h2>Firestore ERP data export</h2>
            <p>Create a manual, read-only JSON export of the browser-readable ERP data. It is not an automatic or complete Firebase backup.</p>
          </div>
          <span className="backup-admin-badge">Admin only</span>
        </section>

        <section className="backup-card backup-export-card" aria-busy={isExporting}>
          <div className="backup-card-heading">
            <div>
              <h2>Manual backup download</h2>
              <p>Includes {ERP_BACKUP_COLLECTIONS.length} operational, financial, inventory, procurement, DPR, BOQ, billing, and audit-log collections with their Firestore document IDs.</p>
            </div>
            <span className="backup-sensitive-badge">Sensitive business data</span>
          </div>

          <div className="backup-warning" role="note">
            <strong>Store this file securely.</strong> Downloaded data may contain commercial, payroll, client, and operational records. Save it only in an approved encrypted location with restricted access.
          </div>

          <dl className="backup-scope-grid">
            <div><dt>Format</dt><dd>Structured JSON with schema metadata</dd></div>
            <div><dt>Integrity</dt><dd>IDs and supported timestamps are preserved</dd></div>
            <div><dt>Safety limit</dt><dd>Export stops rather than creating a partial browser backup</dd></div>
            <div><dt>Restore</dt><dd>No bulk restore action is available in the ERP</dd></div>
          </dl>

          <button className="backup-download-btn" type="button" onClick={handleExport} disabled={isExporting}>
            {isExporting ? "⏳ Preparing secure export…" : "⬇️ Download Firestore JSON Backup"}
          </button>
          {progress && <p className="backup-state" role="status">{progress}</p>}
          {error && <p className="backup-state backup-error" role="alert">{error}</p>}
          {lastExport && (
            <p className="backup-state backup-success" role="status">
              Backup downloaded: <strong>{lastExport.fileName}</strong> · {lastExport.documentCount} documents from {lastExport.collectionCount} collections · {new Date(lastExport.exportedAt).toLocaleString("en-IN")}
              {lastExport.redactedFieldCount > 0 ? ` · ${lastExport.redactedFieldCount} credential-like field${lastExport.redactedFieldCount === 1 ? " was" : "s were"} excluded` : ""}
            </p>
          )}
        </section>

        <section className="backup-card">
          <h2>What this export covers</h2>
          <div className="backup-coverage-grid">
            <article><h3>ERP Firestore data</h3><p>Sites, finance, inventory, procurement, labour/payroll, vehicles, DPR, BOQ, client billing, and immutable audit logs in the listed top-level collections.</p></article>
            <article><h3>What is intentionally excluded</h3><p>{ERP_BACKUP_EXCLUSIONS.users} {ERP_BACKUP_EXCLUSIONS.firebaseAuthentication}</p></article>
            <article><h3>Photo evidence</h3><p>{ERP_BACKUP_EXCLUSIONS.firebaseStorage}</p></article>
            <article><h3>Infrastructure</h3><p>{ERP_BACKUP_EXCLUSIONS.firestoreInfrastructure}</p></article>
          </div>
        </section>

        <section className="backup-card backup-recovery-card">
          <h2>Safe recovery procedure</h2>
          <ol>
            <li>Stop normal ERP write activity and preserve the original backup file unchanged.</li>
            <li>Validate the backup structure and document IDs in an isolated test Firebase project first.</li>
            <li>Use a controlled Admin SDK/GCP process to restore only approved collections, preserving IDs and linked records.</li>
            <li>Do not overwrite live financial, payment, stock, billing, audit, or history records from the browser.</li>
            <li>Verify document counts, reference relationships, totals, user access, and a clean production build before resuming work.</li>
          </ol>
          <p>See <code>docs/DISASTER_RECOVERY.md</code> for the full procedure and recovery checklist.</p>
        </section>
      </div>
    </Layout>
  );
}

export default BackupRecovery;