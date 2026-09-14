import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { canReadSystemHealth } from "../auth/authorization";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import {
  getMonitoringRetentionReview,
  MONITORING_RETENTION_DAYS,
  getMonitoringSafeMessage,
  getRecentMonitoringEvents,
  getSystemHealthSummary,
  formatMonitoringTimestamp,
  MONITORING_CATEGORIES,
  MONITORING_SEVERITIES,
  SYSTEM_HEALTH_EVENT_LIMIT,
} from "../utils/monitoring";
import "../Styles/SystemHealth.css";

const getBrowserOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

const toLabel = (value) => String(value || "Unknown")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClassName = (status) => String(status || "HEALTHY")
  .toLowerCase()
  .replace(/\s+/g, "-");

function SystemHealth() {
  const { role } = useAuth();
  const canRead = canReadSystemHealth(role);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [browserOnline, setBrowserOnline] = useState(getBrowserOnline);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const loadEvents = useCallback(async ({ refresh = false } = {}) => {
    if (!canRead) {
      setEvents([]);
      setLoading(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const recentEvents = await getRecentMonitoringEvents({ database: db });
      setEvents(recentEvents);
    } catch (loadError) {
      console.error("System health event load failed:", loadError);
      setEvents([]);
      setError(getUserFriendlyFirebaseError(
        loadError,
        "System health events could not be loaded. Please try again."
      ));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRead]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const updateBrowserOnline = () => setBrowserOnline(getBrowserOnline());
    updateBrowserOnline();
    window.addEventListener("online", updateBrowserOnline);
    window.addEventListener("offline", updateBrowserOnline);

    return () => {
      window.removeEventListener("online", updateBrowserOnline);
      window.removeEventListener("offline", updateBrowserOnline);
    };
  }, []);

  const filteredEvents = useMemo(
    () => events.filter((event) =>
      (!categoryFilter || event.category === categoryFilter) &&
      (!severityFilter || event.severity === severityFilter)
    ),
    [categoryFilter, events, severityFilter]
  );

  const monitoringDataAvailable = !loading && !error;
  const healthSummary = useMemo(
    () => getSystemHealthSummary(events, {
      isOnline: browserOnline,
      monitoringDataAvailable,
    }),
    [browserOnline, events, monitoringDataAvailable]
  );
  const observedStatus = monitoringDataAvailable
    ? healthSummary.status
    : "ATTENTION REQUIRED";
  const retentionReview = useMemo(
    () => getMonitoringRetentionReview(events),
    [events]
  );

  if (!canRead) {
    return (
      <Layout title="🩺 System Health">
        <div className="data-page system-health-page">
          <p className="system-health-state system-health-error" role="alert">
            System Health diagnostics are restricted to active administrators.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="🩺 System Health">
      <div className="data-page system-health-page">
        <section className="system-health-intro">
          <div>
            <h2>Observed production health</h2>
            <p>Recent sanitized client failures only. This page does not verify Firebase or internet infrastructure health.</p>
          </div>
          <div className="system-health-intro-actions">
            <button
              className="system-health-refresh-button"
              type="button"
              onClick={() => void loadEvents({ refresh: true })}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <span className="system-health-admin-badge">Admin only</span>
          </div>
        </section>

        {!loading && (
          <>
            <section className="system-health-summary-grid" aria-label="System health summary">
              <article className={`system-health-status-card system-health-status-${statusClassName(observedStatus)}`}>
                <span>Observed status</span>
                <strong>{observedStatus}</strong>
                <small>{monitoringDataAvailable
                  ? "Based on recent browser-reported events, not a backend availability check."
                  : "Monitoring history could not be loaded, so no healthy-application conclusion can be made."}
                </small>
              </article>
              <article><span>Last 24 hours</span><strong>{monitoringDataAvailable ? healthSummary.last24HoursCount : "—"}</strong><small>{monitoringDataAvailable ? "Sanitized failures observed" : "Unavailable while monitoring history cannot load"}</small></article>
              <article><span>Last 7 days</span><strong>{monitoringDataAvailable ? healthSummary.last7DaysCount : "—"}</strong><small>{monitoringDataAvailable ? "Events in this retained view" : "Unavailable while monitoring history cannot load"}</small></article>
              <article><span>Connection signal</span><strong>{browserOnline ? "Online" : "Offline"}</strong><small>Browser signal only</small></article>
            </section>

            <section className="system-health-card system-health-insights">
              <div>
                <h2>Recent diagnostic signals</h2>
                <p>{monitoringDataAvailable
                  ? `Application crashes: ${healthSummary.criticalCount} · Errors: ${healthSummary.errorCount} · Warnings: ${healthSummary.warningCount}`
                  : "Recent error totals are unavailable until monitoring history can be loaded."}
                </p>
              </div>
              {monitoringDataAvailable && (
                <div className="system-health-signal-list" aria-label="Error categories in the last 24 hours">
                  <span>Network {healthSummary.byCategory.NETWORK}</span>
                  <span>Permission {healthSummary.byCategory.PERMISSION}</span>
                  <span>Firestore writes {healthSummary.byCategory.FIRESTORE_WRITE}</span>
                  <span>Firestore reads {healthSummary.byCategory.FIRESTORE_READ}</span>
                </div>
              )}
            </section>
          </>
        )}

        {monitoringDataAvailable && (
          <section className="system-health-card system-health-retention-review" aria-label="Monitoring retention review">
            <div className="system-health-card-heading">
              <div>
                <h2>Retention review</h2>
                <p>Read-only review of the loaded recent event window. It never deletes, archives, or counts unqueried monitoring history.</p>
              </div>
              <span className="system-health-read-only-badge">Read-only review</span>
            </div>
            <div className="system-health-summary-grid system-health-retention-grid">
              <article><span>Visible retained events</span><strong>{retentionReview.visibleEventCount}</strong><small>Newest bounded view only</small></article>
              <article><span>Oldest visible</span><strong>{retentionReview.oldestVisibleTimestamp ? formatMonitoringTimestamp(retentionReview.oldestVisibleTimestamp) : "No dated events"}</strong><small>{retentionReview.undatedEventCount} undated record(s) excluded from candidates</small></article>
              <article><span>Future review candidates</span><strong>{retentionReview.eligibleVisibleCount}</strong><small>Eligible only under the advisory policy</small></article>
              <article><span>Dated events</span><strong>{retentionReview.datedEventCount}</strong><small>Use evidence review before any future cleanup</small></article>
            </div>
            <div className="system-health-signal-list system-health-retention-severities" aria-label="Visible monitoring events by severity">
              {MONITORING_SEVERITIES.map((severity) => <span key={severity}>{toLabel(severity)} {retentionReview.severityCounts[severity]}</span>)}
            </div>
            <p className="system-health-retention-policy">
              Advisory retention: Critical {MONITORING_RETENTION_DAYS.CRITICAL} days · Error {MONITORING_RETENTION_DAYS.ERROR} days · Warning {MONITORING_RETENTION_DAYS.WARNING} days · Info {MONITORING_RETENTION_DAYS.INFO} days. Candidate counts cover only these loaded records; preserve incident evidence and use a trusted backend or Admin SDK process before any archive/delete action.
            </p>
          </section>
        )}
        <section className="system-health-card">
          <div className="system-health-card-heading">
            <div>
              <h2>Recent sanitized failure events</h2>
              <p>Loads at most the newest {SYSTEM_HEALTH_EVENT_LIMIT} events. Error stacks, form values, credentials, passwords, and tokens are never shown or stored.</p>
            </div>
            <span className="system-health-read-only-badge">Immutable events</span>
          </div>

          <div className="system-health-filters">
            <label>
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">All categories</option>
                {MONITORING_CATEGORIES.map((category) => <option key={category} value={category}>{toLabel(category)}</option>)}
              </select>
            </label>
            <label>
              <span>Severity</span>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                <option value="">All severities</option>
                {MONITORING_SEVERITIES.map((severity) => <option key={severity} value={severity}>{toLabel(severity)}</option>)}
              </select>
            </label>
          </div>

          {loading && <p className="system-health-state" role="status">Loading recent system health events…</p>}
          {!loading && error && <p className="system-health-state system-health-error" role="alert">{error}</p>}
          {!loading && !error && (
            <>
              {events.length === SYSTEM_HEALTH_EVENT_LIMIT && (
                <p className="system-health-bounded-note" role="note">
                  This screen intentionally shows only the newest {SYSTEM_HEALTH_EVENT_LIMIT} events. Older history is not loaded automatically.
                </p>
              )}
              {filteredEvents.length === 0 ? (
                <p className="system-health-state">No recent monitoring events match the selected filters.</p>
              ) : (
                <div className="system-health-table-wrap">
                  <table className="system-health-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Severity</th>
                        <th>Category</th>
                        <th>Module / Operation</th>
                        <th>Safe diagnostic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{formatMonitoringTimestamp(event.timestamp)}</td>
                          <td><span className={`system-health-severity system-health-severity-${String(event.severity || "UNKNOWN").toLowerCase()}`}>{toLabel(event.severity)}</span></td>
                          <td>{toLabel(event.category)}</td>
                          <td><strong>{toLabel(event.module)}</strong><small>{toLabel(event.operation)} · {event.code || "unknown"}</small></td>
                          <td>{getMonitoringSafeMessage(event)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}

export default SystemHealth;
