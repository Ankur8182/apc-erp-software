import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { canReadSystemHealth } from "../auth/authorization";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import {
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

  const healthSummary = useMemo(
    () => getSystemHealthSummary(events, { isOnline: browserOnline }),
    [browserOnline, events]
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

        <section className="system-health-summary-grid" aria-label="System health summary">
          <article className={`system-health-status-card system-health-status-${statusClassName(healthSummary.status)}`}>
            <span>Observed status</span>
            <strong>{healthSummary.status}</strong>
            <small>Based on recent browser-reported events, not a backend availability check.</small>
          </article>
          <article><span>Last 24 hours</span><strong>{healthSummary.last24HoursCount}</strong><small>Sanitized failures observed</small></article>
          <article><span>Last 7 days</span><strong>{healthSummary.last7DaysCount}</strong><small>Events in this retained view</small></article>
          <article><span>Connection signal</span><strong>{browserOnline ? "Online" : "Offline"}</strong><small>Browser signal only</small></article>
        </section>

        <section className="system-health-card system-health-insights">
          <div>
            <h2>Recent diagnostic signals</h2>
            <p>Application crashes: {healthSummary.criticalCount} · Errors: {healthSummary.errorCount} · Warnings: {healthSummary.warningCount}</p>
          </div>
          <div className="system-health-signal-list" aria-label="Error categories in the last 24 hours">
            <span>Network {healthSummary.byCategory.NETWORK}</span>
            <span>Permission {healthSummary.byCategory.PERMISSION}</span>
            <span>Firestore writes {healthSummary.byCategory.FIRESTORE_WRITE}</span>
            <span>Firestore reads {healthSummary.byCategory.FIRESTORE_READ}</span>
          </div>
        </section>

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