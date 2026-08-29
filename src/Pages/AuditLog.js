import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { db } from "../firebase";
import { AUDIT_ACTIONS, AUDIT_MODULES, filterAuditLogs, formatAuditTimestamp } from "../utils/auditLogging";
import { useDataTable } from "../utils/dataTable";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import "../Styles/AuditLog.css";

const MODULE_LABELS = {
  labour: "Labour",
  sites: "Sites",
  materials: "Materials",
  expenses: "Expenses",
  attendance: "Attendance",
  salary: "Salary",
  vehicle: "Vehicle",
  vehicleExpenses: "Vehicle Expenses",
  invoices: "Invoices",
  dailyProgressReports: "Daily Progress Reports",
  users: "User Management",
};

const toTitleCase = (value) => {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "—";
};

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "auditLogs"),
      (snapshot) => {
        setLogs(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Audit log load failed:", snapshotError);
        setError(getUserFriendlyFirebaseError(
          snapshotError,
          "Audit logs could not be loaded. Please try again."
        ));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const filteredLogs = useMemo(
    () => filterAuditLogs(logs, {
      search,
      action: actionFilter,
      module: moduleFilter,
      date: dateFilter,
    }),
    [logs, search, actionFilter, moduleFilter, dateFilter]
  );
  const sortOptions = useMemo(() => [
    { value: "timestamp", label: "Date / time", getValue: (entry) => entry.timestamp },
    { value: "action", label: "Action", getValue: (entry) => entry.action },
    { value: "module", label: "Module", getValue: (entry) => entry.module },
    { value: "user", label: "User", getValue: (entry) => entry.userEmail || entry.userId },
  ], []);
  const auditTable = useDataTable(filteredLogs, {
    sortOptions,
    defaultSortBy: "timestamp",
    defaultSortDirection: "desc",
    resetKey: `${search}|${actionFilter}|${moduleFilter}|${dateFilter}`,
  });

  return (
    <Layout title="🛡️ Audit Log">
      <div className="data-page audit-log-page">
        <div className="audit-log-intro">
          <div>
            <h2>Activity history</h2>
            <p>Append-only history of successful ERP record changes.</p>
          </div>
          <span className="audit-log-admin-badge">Admin only</span>
        </div>

        <div className="table-card audit-log-card">
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search user, record, site or summary..."
            table={auditTable}
          >
            <label>
              <span>Action</span>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                <option value="">All actions</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>{toTitleCase(action)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Module</span>
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                <option value="">All modules</option>
                {AUDIT_MODULES.map((module) => (
                  <option key={module} value={module}>{MODULE_LABELS[module]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </label>
          </DataTableToolbar>

          {loading && <p className="audit-log-state" role="status">Loading audit history…</p>}
          {!loading && error && <p className="audit-log-state audit-log-error" role="alert">{error}</p>}
          {!loading && !error && (
            <>
              <div className="table-responsive">
                <table className="audit-log-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Record</th>
                      <th>Site</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditTable.count === 0 ? (
                      <tr><td colSpan="8" className="audit-log-empty">No audit records match the selected filters.</td></tr>
                    ) : auditTable.rows.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatAuditTimestamp(entry.timestamp)}</td>
                        <td>{entry.userEmail || entry.userId || "—"}</td>
                        <td>{toTitleCase(entry.userRole)}</td>
                        <td><span className={`audit-action audit-action-${entry.action}`}>{toTitleCase(entry.action)}</span></td>
                        <td>{MODULE_LABELS[entry.module] || entry.module || "—"}</td>
                        <td title={entry.recordId}>{entry.recordLabel || entry.recordId || "—"}</td>
                        <td>{entry.site || "—"}</td>
                        <td>{entry.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataTablePagination table={auditTable} />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default AuditLog;
