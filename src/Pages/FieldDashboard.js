import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Layout from "../Components/Layout";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { getDprReadScope } from "../auth/authorization";
import {
  getDailyProgressOperationalSummary,
  getDprTodayDate,
  sortDailyProgressReports,
} from "../utils/dailyProgressReporting";
import { getDprPhotoMetadata } from "../utils/dprPhotos";
import {
  FIELD_DRAFT_EVENT,
  hasSavedFieldUpdateDraft,
} from "../utils/fieldUpdateDrafts";
import { getRecordDate, getSiteName } from "../utils/financialReporting";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { useDprOutboxSync } from "../hooks/useDprOutboxSync";
import DprOutboxAttentionList from "../Components/DprOutboxAttentionList";
import "../Styles/FieldDashboard.css";

const getAvailableSiteNames = (sites = []) => {
  const values = new Map();

  sites.forEach((site) => {
    const siteName = getSiteName(site);
    const key = siteName.toLowerCase();
    if (siteName && !values.has(key)) values.set(key, siteName);
  });

  return Array.from(values.values()).sort((first, second) => first.localeCompare(second));
};

function FieldDashboard() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [availableSites, setAvailableSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [error, setError] = useState("");
  const [sitesError, setSitesError] = useState("");
  const [draftAvailable, setDraftAvailable] = useState(false);
  const dprReadScope = getDprReadScope(role, user?.uid);
  const {
    isOnline,
    entries: outboxEntries,
    summary: outboxSummary,
    isSyncing: isOutboxSyncing,
    syncMessage: outboxSyncMessage,
    retryPending,
    retryEntry,
    discardEntry,
  } = useDprOutboxSync({ userId: user?.uid, role });
  const canRetryOutbox = outboxEntries.some((entry) => entry.retryable !== false);

  useEffect(() => {
    if (!dprReadScope.canRead) {
      setReports([]);
      setAvailableSites([]);
      setError("Your active user profile is required to load site updates.");
      setLoading(false);
      setSitesLoading(false);
      return undefined;
    }

    const unsubscribeReports = onSnapshot(
      dprReadScope.createdBy
        ? query(
          collection(db, "dailyProgressReports"),
          where("createdBy", "==", dprReadScope.createdBy)
        )
        : collection(db, "dailyProgressReports"),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setError("");
        setLoading(false);
      },
      (loadError) => {
        console.error("Field dashboard DPR load error:", loadError);
        setReports([]);
        setError(
          getUserFriendlyFirebaseError(
            loadError,
            "Site updates could not be loaded. Please try again later."
          )
        );
        setLoading(false);
      }
    );

    const unsubscribeSites = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        setAvailableSites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setSitesError("");
        setSitesLoading(false);
      },
      (loadError) => {
        console.error("Field dashboard sites load error:", loadError);
        setAvailableSites([]);
        setSitesError(
          getUserFriendlyFirebaseError(
            loadError,
            "Available sites could not be loaded. Please try again later."
          )
        );
        setSitesLoading(false);
      }
    );

    return () => {
      unsubscribeReports();
      unsubscribeSites();
    };
  }, [dprReadScope.canRead, dprReadScope.createdBy]);

  useEffect(() => {
    const updateDraftStatus = () => setDraftAvailable(hasSavedFieldUpdateDraft(user?.uid));

    updateDraftStatus();
    window.addEventListener("storage", updateDraftStatus);
    window.addEventListener(FIELD_DRAFT_EVENT, updateDraftStatus);

    return () => {
      window.removeEventListener("storage", updateDraftStatus);
      window.removeEventListener(FIELD_DRAFT_EVENT, updateDraftStatus);
    };
  }, [user?.uid]);

  const todaySummary = useMemo(
    () => getDailyProgressOperationalSummary(reports, { date: getDprTodayDate() }),
    [reports]
  );
  const recentReports = useMemo(() => sortDailyProgressReports(reports).slice(0, 5), [reports]);
  const siteNames = useMemo(() => getAvailableSiteNames(availableSites), [availableSites]);
  const latestReport = useMemo(
    () => recentReports.find((report) => !dprReadScope.createdBy || report.createdBy === user?.uid),
    [dprReadScope.createdBy, recentReports, user?.uid]
  );
  const todayStatus = todaySummary.todayCount > 0
    ? `Today has ${todaySummary.todayCount} submitted site update${todaySummary.todayCount > 1 ? "s" : ""}.`
    : "No site update has been submitted by you today.";

  return (
    <Layout>
      <main className="field-dashboard-page">
        <div className="field-dashboard-heading">
          <div>
            <h1>📱 Field Dashboard</h1>
            <p>Today&apos;s operational site progress—without commercial or financial data.</p>
          </div>
          <button type="button" className="field-dashboard-action" onClick={() => navigate("/field-update")}>
            ➕ New Site Update
          </button>
        </div>

        <section className="field-dashboard-grid" aria-label="Today&apos;s field summary">
          <div className="field-dashboard-card">
            <span>📋 Today&apos;s DPR</span>
            <strong>{todaySummary.todayCount}</strong>
          </div>
          <div className="field-dashboard-card">
            <span>👷 Manpower Reported</span>
            <strong>{todaySummary.totalManpower}</strong>
          </div>
          <div className="field-dashboard-card">
            <span>🏗️ Available Sites</span>
            <strong>{sitesLoading ? "…" : siteNames.length}</strong>
          </div>
          <div className="field-dashboard-card">
            <span>💾 Draft</span>
            <strong className={draftAvailable ? "field-draft-ready" : "field-draft-empty"}>
              {draftAvailable ? "Available" : "None"}
            </strong>
          </div>
        </section>

        <section className="field-dashboard-operational" aria-live="polite">
          <div>
            <strong>{todaySummary.todayCount > 0 ? "✅ Today’s DPR recorded" : "⏱️ Today’s DPR pending"}</strong>
            <span>{todayStatus}</span>
          </div>
          {draftAvailable && <button type="button" onClick={() => navigate("/field-update")}>Continue draft</button>}
        </section>

        <section className="field-dashboard-outbox" aria-live="polite">
          <div>
            <strong>{isOnline ? "● Online sync" : "○ Offline sync"}</strong>
            <span>
              {isOutboxSyncing
                ? "Synchronizing local site updates..."
                : outboxSummary.total === 0
                  ? "All local site updates are synchronized."
                  : `${outboxSummary.pending} pending · ${outboxSummary.failed} need attention`}
            </span>
          </div>
          {outboxSummary.total > 0 && canRetryOutbox && (
            <button type="button" onClick={() => { void retryPending(); }} disabled={!isOnline || isOutboxSyncing}>
              {isOutboxSyncing ? "Syncing..." : "Retry Sync"}
            </button>
          )}
        </section>
        <DprOutboxAttentionList
          entries={outboxEntries}
          isOnline={isOnline}
          isSyncing={isOutboxSyncing}
          onRetry={retryEntry}
          onDiscard={discardEntry}
        />
        {outboxSyncMessage && <p className="field-dashboard-sync-message" role="status">{outboxSyncMessage}</p>}

        <section className="field-dashboard-sites" aria-labelledby="field-available-sites">
          <div className="field-dashboard-section-heading">
            <div>
              <h2 id="field-available-sites">🏗️ Available Sites</h2>
              <p>Reference sites available under your current field access.</p>
            </div>
          </div>
          {sitesLoading ? (
            <p className="field-dashboard-state">Loading available sites...</p>
          ) : sitesError ? (
            <p className="field-dashboard-state field-dashboard-error" role="alert">{sitesError}</p>
          ) : siteNames.length === 0 ? (
            <p className="field-dashboard-state">No site references are available yet. Contact an administrator if you need access.</p>
          ) : (
            <div className="field-site-chip-list">
              {siteNames.map((siteName) => <span key={siteName} className="field-site-chip">{siteName}</span>)}
            </div>
          )}
        </section>

        {latestReport && (
          <section className="field-dashboard-status" aria-live="polite">
            <strong>✅ Latest submission</strong>
            <span>{latestReport.workActivity || "Site update"} · {getRecordDate(latestReport) || "Date not recorded"}</span>
          </section>
        )}

        <section className="field-dashboard-history" aria-labelledby="field-recent-submissions">
          <h2 id="field-recent-submissions">🕘 Recent Submissions</h2>

          {loading ? (
            <p className="field-dashboard-state">Loading site updates...</p>
          ) : error ? (
            <p className="field-dashboard-state field-dashboard-error" role="alert">{error}</p>
          ) : recentReports.length === 0 ? (
            <p className="field-dashboard-state">No site updates have been submitted yet.</p>
          ) : (
            <div className="field-dashboard-list">
              {recentReports.map((report, index) => {
                const photoCount = getDprPhotoMetadata(report).length;

                return (
                  <article className="field-dashboard-list-item" key={report.id || `dashboard-report-${index}`}>
                    <div>
                      <strong>{report.workActivity || "Work activity not recorded"}</strong>
                      <p>{getSiteName(report) || "Site not recorded"} · {getRecordDate(report) || "Date not recorded"}</p>
                    </div>
                    <span>{report.quantity ?? "-"} {report.unit || ""} · {report.manpowerCount ?? "-"} manpower{photoCount ? ` · 📷 ${photoCount}` : ""}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}

export default FieldDashboard;