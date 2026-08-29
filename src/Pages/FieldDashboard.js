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
import "../Styles/FieldDashboard.css";

function FieldDashboard() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftAvailable, setDraftAvailable] = useState(false);
  const dprReadScope = getDprReadScope(role, user?.uid);

  useEffect(() => {
    if (!dprReadScope.canRead) {
      setReports([]);
      setError("Your active user profile is required to load site updates.");
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
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

    return () => unsubscribe();
  }, [dprReadScope.canRead, dprReadScope.createdBy]);

  useEffect(() => {
    const updateDraftStatus = () => {
      setDraftAvailable(hasSavedFieldUpdateDraft(user?.uid));
    };

    updateDraftStatus();
    window.addEventListener("storage", updateDraftStatus);
    window.addEventListener(FIELD_DRAFT_EVENT, updateDraftStatus);

    return () => {
      window.removeEventListener("storage", updateDraftStatus);
      window.removeEventListener(FIELD_DRAFT_EVENT, updateDraftStatus);
    };
  }, [user?.uid]);

  const todaySummary = useMemo(
    () =>
      getDailyProgressOperationalSummary(reports, {
        date: getDprTodayDate(),
      }),
    [reports]
  );

  const recentReports = useMemo(
    () => sortDailyProgressReports(reports).slice(0, 5),
    [reports]
  );

  const latestOwnReport = useMemo(
    () => recentReports.find((report) => report.createdBy === user?.uid),
    [recentReports, user?.uid]
  );

  return (
    <Layout title="📱 Field Dashboard">
      <div className="field-dashboard-page">
        <div className="field-dashboard-heading">
          <div>
            <h1>📱 Field Dashboard</h1>
            <p>Today&apos;s operational site progress.</p>
          </div>
          <button type="button" className="field-dashboard-action" onClick={() => navigate("/field-update")}>
            ➕ New Site Update
          </button>
        </div>

        <div className="field-dashboard-grid">
          <div className="field-dashboard-card">
            <span>📋 Today&apos;s DPR</span>
            <strong>{todaySummary.todayCount}</strong>
          </div>
          <div className="field-dashboard-card">
            <span>👷 Manpower Reported</span>
            <strong>{todaySummary.totalManpower}</strong>
          </div>
          <div className="field-dashboard-card">
            <span>💾 Draft</span>
            <strong className={draftAvailable ? "field-draft-ready" : "field-draft-empty"}>
              {draftAvailable ? "Available" : "None"}
            </strong>
          </div>
        </div>

        {latestOwnReport && (
          <div className="field-dashboard-status">
            <strong>✅ Latest submission</strong>
            <span>{latestOwnReport.workActivity || "Site update"} · {getRecordDate(latestOwnReport) || "Date not recorded"}</span>
          </div>
        )}

        <div className="field-dashboard-history">
          <h2>🕘 Recent Submissions</h2>

          {loading ? (
            <p className="field-dashboard-state">Loading site updates...</p>
          ) : error ? (
            <p className="field-dashboard-state field-dashboard-error">{error}</p>
          ) : recentReports.length === 0 ? (
            <p className="field-dashboard-state">No site updates have been submitted yet.</p>
          ) : (
            <div className="field-dashboard-list">
              {recentReports.map((report, index) => {
                const photoCount = getDprPhotoMetadata(report).length;

                return (
                  <div className="field-dashboard-list-item" key={report.id || `dashboard-report-${index}`}>
                    <div>
                      <strong>{report.workActivity || "Work activity not recorded"}</strong>
                      <p>{getSiteName(report) || "Site not recorded"} · {getRecordDate(report) || "Date not recorded"}</p>
                    </div>
                    <span>{report.quantity ?? "-"} {report.unit || ""} · {report.manpowerCount ?? "-"} manpower{photoCount ? ` · 📷 ${photoCount}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default FieldDashboard;
