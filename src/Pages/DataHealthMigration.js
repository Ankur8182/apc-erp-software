import React, { useMemo, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import Layout from "../Components/Layout";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { canManageDataHealth } from "../auth/authorization";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import {
  DATA_HEALTH_COLLECTIONS,
  DATA_HEALTH_EXCLUSIONS,
  DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION,
  filterDataHealthCandidates,
  runDataHealthDryRun,
} from "../utils/dataHealth";
import "../Styles/DataHealthMigration.css";

const CATEGORY_LABELS = {
  legacy: "Legacy / incomplete",
  normalization: "Copy normalization",
  duplicate: "Duplicate candidate",
  orphan: "Broken relationship",
  financial: "Financial validation",
  "test-demo": "Possible test/demo",
};

const getReadOnlyError = (error) => {
  if (error?.code === "data-health-collection-limit" || /safe browser diagnostic limit/i.test(error?.message || "")) {
    return "This collection is too large for a safe browser diagnostic. Use the documented controlled Admin SDK review procedure instead.";
  }
  return getUserFriendlyFirebaseError(
    error,
    "The data-health dry run could not complete. No record was changed. Please check your connection and administrator access, then try again."
  );
};

const CandidateDetails = ({ item }) => (
  <details className="data-health-candidate-details">
    <summary>Review details</summary>
    <dl>
      <div><dt>Document ID</dt><dd>{item.recordId || "Missing / unknown"}</dd></div>
      {item.site && <div><dt>Site</dt><dd>{item.site}</dd></div>}
      {item.field && <div><dt>Field</dt><dd>{item.field}</dd></div>}
      {item.value && <div><dt>Current value</dt><dd>{item.value}</dd></div>}
      {item.expected && <div><dt>Expected</dt><dd>{item.expected}</dd></div>}
      {item.relatedRecordIds?.length > 0 && <div><dt>Related candidate IDs</dt><dd>{item.relatedRecordIds.join(", ")}</dd></div>}
    </dl>
    {item.proposedChanges?.length > 0 && (
      <div className="data-health-proposals">
        <strong>Copy-only proposed changes</strong>
        <ul>
          {item.proposedChanges.map((change) => (
            <li key={`${item.id}-${change.field}-${String(change.to)}`}>
              <code>{change.field}</code>: {String(change.from || "(missing)")} → {String(change.to)} <small>{change.reason}</small>
            </li>
          ))}
        </ul>
      </div>
    )}
  </details>
);

function DataHealthMigration() {
  const { role } = useAuth();
  const canManage = canManageDataHealth(role);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const filteredCandidates = useMemo(() => filterDataHealthCandidates(report?.candidates || [], {
    category, severity, collection: collectionFilter, search,
  }), [report, category, severity, collectionFilter, search]);

  const handleDryRun = async () => {
    if (!canManage || running) return;
    const approved = window.confirm(
      "Run a read-only Data Health dry run across the known ERP collections? This will not edit, delete, migrate, or export Firestore records. Create a verified backup before any future cleanup."
    );
    if (!approved) return;

    setRunning(true);
    setProgress("");
    setError("");
    setReport(null);
    setVisibleCount(50);

    try {
      const collectionDocuments = {};
      for (let index = 0; index < DATA_HEALTH_COLLECTIONS.length; index += 1) {
        const collectionName = DATA_HEALTH_COLLECTIONS[index];
        setProgress(`Reading ${collectionName} (${index + 1} of ${DATA_HEALTH_COLLECTIONS.length})…`);
        const snapshot = await getDocs(query(
          collection(db, collectionName),
          limit(DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION + 1)
        ));
        if (snapshot.docs.length > DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION) {
          const limitError = new Error("data-health-collection-limit");
          limitError.code = "data-health-collection-limit";
          throw limitError;
        }
        collectionDocuments[collectionName] = snapshot.docs.map((document) => ({
          id: document.id,
          data: document.data(),
        }));
      }
      setReport(runDataHealthDryRun({ collectionDocuments }));
      setProgress("");
    } catch (runError) {
      console.error("Data Health dry run failed:", runError);
      setError(getReadOnlyError(runError));
      setProgress("");
    } finally {
      setRunning(false);
    }
  };

  if (!canManage) {
    return (
      <Layout title="🩺 Data Health & Migration">
        <div className="data-page data-health-page">
          <p className="data-health-state data-health-error" role="alert">
            Data Health diagnostics are restricted to active administrators.
          </p>
        </div>
      </Layout>
    );
  }

  const summary = report?.summary;
  const shownCandidates = filteredCandidates.slice(0, visibleCount);

  return (
    <Layout title="🩺 Data Health & Migration">
      <div className="data-page data-health-page">
        <section className="data-health-intro">
          <div>
            <h2>Read-only legacy-data review</h2>
            <p>Scan known ERP collections for compatibility, duplicate, relationship, and financial-data review candidates. This page never writes, deletes, merges, or migrates Firestore data.</p>
          </div>
          <span className="data-health-admin-badge">Admin only · dry run</span>
        </section>

        <section className="data-health-card data-health-run-card" aria-busy={running}>
          <div className="data-health-card-heading">
            <div>
              <h2>Safe diagnostic scan</h2>
              <p>Reads {DATA_HEALTH_COLLECTIONS.length} known top-level ERP collections once, on demand. Any future production migration must be separately reviewed and run from a controlled backend process.</p>
            </div>
            <span className="data-health-no-write-badge">0 write operations</span>
          </div>
          <div className="data-health-warning" role="note">
            <strong>Backup prerequisite:</strong> create and verify a Firestore backup before any manual cleanup. This diagnostic only identifies candidates; it does not decide whether a legacy record is disposable or correct.
          </div>
          <button className="data-health-run-button" type="button" onClick={handleDryRun} disabled={running}>
            {running ? "⏳ Running read-only dry run…" : "🔎 Run Read-Only Data Health Dry Run"}
          </button>
          {progress && <p className="data-health-state" role="status">{progress}</p>}
          {error && <p className="data-health-state data-health-error" role="alert">{error}</p>}
        </section>

        {report && <>
          <section className="data-health-summary-grid" aria-label="Dry run summary">
            <article><span>Records scanned</span><strong>{summary.recordsScanned}</strong></article>
            <article><span>Already valid</span><strong>{summary.recordsAlreadyValid}</strong></article>
            <article><span>Copy-normalizable</span><strong>{summary.recordsNormalizable}</strong></article>
            <article><span>Manual review</span><strong>{summary.recordsRequiringManualReview}</strong></article>
            <article><span>Duplicate candidates</span><strong>{summary.duplicateCandidates}</strong></article>
            <article><span>Orphan candidates</span><strong>{summary.orphanCandidates}</strong></article>
            <article><span>Financial issues</span><strong>{summary.invalidFinancialCandidates}</strong></article>
            <article><span>Test/demo candidates</span><strong>{summary.possibleTestDemoCandidates}</strong></article>
          </section>

          <section className="data-health-card">
            <div className="data-health-card-heading">
              <div><h2>Collection coverage</h2><p>{summary.collectionsScanned} known collections scanned. User profiles, Firebase Authentication, Storage files, and unknown/nested collections remain intentionally excluded.</p></div>
              <span className="data-health-no-write-badge">No migration applied</span>
            </div>
            <div className="data-health-table-wrap">
              <table className="data-health-table">
                <thead><tr><th>Collection</th><th>Scanned</th><th>Already valid</th><th>Copy-normalizable</th><th>Manual review</th><th>History</th></tr></thead>
                <tbody>{report.collectionSummary.map((row) => <tr key={row.collection}><td><strong>{row.label}</strong><small>{row.collection}</small></td><td>{row.scanned}</td><td>{row.alreadyValid}</td><td>{row.normalizable}</td><td>{row.manualReview}</td><td>{row.immutableHistory ? "Immutable" : "Current/master"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="data-health-card">
            <div className="data-health-card-heading"><div><h2>Review candidates</h2><p>Each entry requires human judgment. A candidate is not a deletion recommendation.</p></div><span className="data-health-no-write-badge">{filteredCandidates.length} shown</span></div>
            <div className="data-health-filters">
              <label><span>Search</span><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(50); }} placeholder="Collection, record, field…" /></label>
              <label><span>Category</span><select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(50); }}><option value="">All categories</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Severity</span><select value={severity} onChange={(event) => { setSeverity(event.target.value); setVisibleCount(50); }}><option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
              <label><span>Collection</span><select value={collectionFilter} onChange={(event) => { setCollectionFilter(event.target.value); setVisibleCount(50); }}><option value="">All collections</option>{DATA_HEALTH_COLLECTIONS.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            </div>
            {shownCandidates.length === 0 ? <p className="data-health-empty">No review candidates match the current filters.</p> : <div className="data-health-table-wrap"><table className="data-health-table data-health-candidates"><thead><tr><th>Severity</th><th>Category</th><th>Collection / Record</th><th>Finding</th><th>Review</th></tr></thead><tbody>{shownCandidates.map((item) => <tr key={item.id}><td><span className={`data-health-severity data-health-severity-${item.severity}`}>{item.severity}</span></td><td>{CATEGORY_LABELS[item.category] || item.category}</td><td><strong>{item.collectionLabel}</strong><small>{item.recordLabel} · {item.recordId || "missing ID"}</small></td><td>{item.summary}</td><td><CandidateDetails item={item} /></td></tr>)}</tbody></table></div>}
            {filteredCandidates.length > shownCandidates.length && <button className="data-health-more-button" type="button" onClick={() => setVisibleCount((count) => count + 50)}>Show 50 more candidates</button>}
          </section>

          <section className="data-health-card data-health-guidance">
            <h2>Controlled next step</h2>
            <p>Review a verified backup, the original record, its parent relationships, and financial impact in a test project before any change. Immutable histories such as audit logs, inventory movements, receipts, salary payments, and retention releases must not be cosmetically rewritten.</p>
            <p>See <code>docs/DATA_MIGRATION.md</code> for the dry-run, approval, migration, and rollback procedure.</p>
          </section>
        </>}

        {!report && !running && !error && <section className="data-health-card data-health-guidance"><h2>Scope and exclusions</h2><p>{DATA_HEALTH_EXCLUSIONS.users} {DATA_HEALTH_EXCLUSIONS.firebaseAuthentication}</p><p>{DATA_HEALTH_EXCLUSIONS.firebaseStorage} {DATA_HEALTH_EXCLUSIONS.unknownCollections}</p></section>}
      </div>
    </Layout>
  );
}

export default DataHealthMigration;