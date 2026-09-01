import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { db } from "../firebase";
import { AUDIT_ACTIONS, AUDIT_MODULES, filterAuditLogs, formatAuditTimestamp } from "../utils/auditLogging";
import { getAuditLogPage, mergeAuditLogPages } from "../utils/auditLogPaging";
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
  salaryPayments: "Salary Payments",
  labourAdvances: "Labour Advances",
  vehicle: "Vehicle",
  vehicleExpenses: "Vehicle Expenses",
  vehicleAssignments: "Vehicle Assignments",
  vehicleMaintenance: "Vehicle Maintenance",
  invoices: "Invoices",
  dailyProgressReports: "Daily Progress Reports",
  inventoryItems: "Inventory Items",
  inventoryTransactions: "Inventory Transactions",
  vendors: "Vendors",
  purchaseRequests: "Purchase Requests",
  purchaseOrders: "Purchase Orders",
  goodsReceipts: "Goods Receipts",
  workOrders: "Work Orders",
  workOrderProgress: "Work Order Progress",
  contractorBills: "Contractor Bills",
  contractorPayments: "Contractor Payments",
  clients: "Clients",
  siteBillingProfiles: "Site Billing Profiles",
  raBills: "RA Bills",
  clientReceipts: "Client Receipts",
  raRetentionReleases: "RA Retention Releases",
  boqItems: "BOQ Items",
  boqMeasurements: "BOQ Measurements",
  boqVariations: "BOQ Variations",
  users: "User Management",
};

const toTitleCase = (value) => {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "—";
};

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [lastDocument, setLastDocument] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError("");
    setLoadMoreError("");

    try {
      const page = await getAuditLogPage({ database: db });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setLogs(page.logs);
      setLastDocument(page.cursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      console.error("Audit log load failed:", loadError);
      setLogs([]);
      setLastDocument(null);
      setHasMore(false);
      setError(getUserFriendlyFirebaseError(
        loadError,
        "Audit logs could not be loaded. Please try again."
      ));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !lastDocument) return;

    const requestId = ++requestIdRef.current;

    setLoadingMore(true);
    setLoadMoreError("");

    try {
      const page = await getAuditLogPage({ database: db, cursor: lastDocument });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setLogs((currentLogs) => mergeAuditLogPages(currentLogs, page.logs));
      setLastDocument(page.cursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      console.error("Older audit log load failed:", loadError);
      setLoadMoreError(getUserFriendlyFirebaseError(
        loadError,
        "Older audit logs could not be loaded. Please try again."
      ));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [hasMore, lastDocument, loading, loadingMore]);

  useEffect(() => {
    mountedRef.current = true;
    void loadFirstPage();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadFirstPage]);

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
          <div className="audit-log-intro-actions">
            <button
              className="audit-log-refresh-button"
              type="button"
              onClick={loadFirstPage}
              disabled={loading || loadingMore}
            >
              {loading ? "Refreshing…" : "Refresh history"}
            </button>
            <span className="audit-log-admin-badge">Admin only</span>
          </div>
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
                  <option key={module} value={module}>{MODULE_LABELS[module] || module}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </label>
          </DataTableToolbar>

          {loading && <p className="audit-log-state" role="status">Loading newest audit history…</p>}
          {!loading && error && (
            <div className="audit-log-state audit-log-error" role="alert">
              <p>{error}</p>
              <button className="audit-log-retry-button" type="button" onClick={loadFirstPage}>
                Try again
              </button>
            </div>
          )}
          {!loading && !error && (
            <>
              <p className="audit-log-loaded-note" role="status">
                {logs.length} newest audit record{logs.length === 1 ? "" : "s"} loaded.
                {hasMore
                  ? " Search and filters apply to loaded history; load more to include older activity."
                  : ""}
              </p>
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
              <div className="audit-log-load-more">
                {loadMoreError && <p className="audit-log-load-more-error" role="alert">{loadMoreError}</p>}
                {hasMore && (
                  <button
                    className="audit-log-load-more-button"
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading older history…" : "Load more history"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default AuditLog;
