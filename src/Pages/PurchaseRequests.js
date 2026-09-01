import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { captureMonitoringError } from "../utils/monitoring";
import { buildDocumentNumber, canApprovePurchaseRequest, canManageProcurement, createInitialPurchaseRequestForm, createInitialPurchaseRequestItem, PURCHASE_PRIORITIES, PURCHASE_REQUEST_STATUSES, validatePurchaseRequest } from "../utils/procurement";
import "../Styles/Procurement.css";

function PurchaseRequests() {
  const { role, user } = useAuth();
  const canWrite = canManageProcurement(role);
  const canApprove = canApprovePurchaseRequest(role);
  const [requests, setRequests] = useState([]);
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(createInitialPurchaseRequestForm);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let pending = 3;
    const done = () => { pending -= 1; if (pending <= 0) setLoading(false); };
    const subscribe = (name, setData, errorMessage) => onSnapshot(query(collection(db, name), limit(500)), (snapshot) => { setData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); done(); }, (error) => { void captureMonitoringError(error, { module: "procurement", operation: "read" }); setFeedback(errorMessage); done(); });
    const unRequests = subscribe("purchaseRequests", setRequests, "Purchase requests could not be loaded.");
    const unSites = subscribe("sites", setSites, "Sites could not be loaded.");
    const unMaterials = subscribe("materials", setMaterials, "Material reference data could not be loaded.");
    return () => { unRequests(); unSites(); unMaterials(); };
  }, []);

  const siteNames = useMemo(() => getDistinctValues(sites, (item) => item.siteName || item.name || item.site), [sites]);
  const materialOptions = useMemo(() => getDistinctValues(materials, (item) => item.materialName || item.name), [materials]);
  const filteredRequests = useMemo(() => requests.filter((request) => {
    const searchText = `${request.requestNumber} ${request.site} ${request.requestedBy} ${(request.items || []).map((item) => item.materialName).join(" ")}`.toLowerCase();
    return (!search || searchText.includes(search.toLowerCase())) &&
      (!siteFilter || request.site === siteFilter) &&
      (!statusFilter || String(request.status || "").toLowerCase() === statusFilter) &&
      (!priorityFilter || request.priority === priorityFilter);
  }), [requests, search, siteFilter, statusFilter, priorityFilter]);
  const table = useDataTable(filteredRequests, {
    sortOptions: [
      { value: "date", label: "Request Date", getValue: (item) => item.date },
      { value: "required", label: "Required Date", getValue: (item) => item.requiredDate },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "status", label: "Status", getValue: (item) => item.status },
    ], defaultSortBy: "date", defaultSortDirection: "desc", resetKey: `${search}|${siteFilter}|${statusFilter}|${priorityFilter}`,
  });

  const changeItem = (index, field, value) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, createInitialPurchaseRequestItem()] }));
  const removeItem = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canWrite || saving) return;
    const requestItems = form.items.map((item) => {
      const material = materials.find((record) =>
        String(record.materialName || record.name || "").trim().toLowerCase() === String(item.materialName || "").trim().toLowerCase()
      );
      return { ...item, materialId: item.materialId || material?.id || "" };
    });
    const validation = validatePurchaseRequest({ ...form, items: requestItems, requestedBy: form.requestedBy || user?.email || "Manager" });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    const requestNumber = buildDocumentNumber("PR", requests);
    const requestRef = doc(db, "purchaseRequests", requestNumber);
    try {
      setSaving(true); setFeedback("");
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(requestRef)).exists()) throw new Error("Request number already exists. Please try again.");
        transaction.set(requestRef, {
          ...validation.value,
          requestNumber,
          createdBy: user?.uid || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      const audit = await logAuditEvent({ action: "create", module: "purchaseRequests", recordId: requestNumber, recordLabel: requestNumber, details: "Purchase request submitted for approval.", site: validation.value.site });
      setFeedback(audit.success ? `Purchase request ${requestNumber} submitted.` : getAuditFailureMessage());
      setForm(createInitialPurchaseRequestForm());
    } catch (error) { console.error("Purchase request save error:", error); void captureMonitoringError(error, { module: "procurement", operation: "write" }); setFeedback(getUserFriendlyFirebaseError(error, "Purchase request could not be saved.")); }
    finally { setSaving(false); }
  };

  const updateRequestStatus = async (request, nextStatus) => {
    if (!canApprove || saving || !window.confirm(`Mark ${request.requestNumber} as ${nextStatus}?`)) return;
    let rejectionReason = "";
    if (nextStatus === "rejected") {
      rejectionReason = window.prompt("Rejection reason (required):") || "";
      if (!rejectionReason.trim()) { setFeedback("A rejection reason is required."); return; }
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "purchaseRequests", request.id), {
        status: nextStatus,
        approvedBy: user?.uid || "",
        approvedAt: serverTimestamp(),
        rejectionReason: nextStatus === "rejected" ? rejectionReason.trim() : "",
        updatedAt: serverTimestamp(),
      });
      const audit = await logAuditEvent({ action: "update", module: "purchaseRequests", recordId: request.id, recordLabel: request.requestNumber, details: `Purchase request ${nextStatus}.`, site: request.site });
      setFeedback(audit.success ? `Purchase request ${nextStatus}.` : getAuditFailureMessage());
    } catch (error) { console.error("Purchase request approval error:", error); void captureMonitoringError(error, { module: "procurement", operation: "write" }); setFeedback("The request status could not be updated."); }
    finally { setSaving(false); }
  };

  return <Layout><main className="procurement-page">
    <div className="procurement-heading"><div><span>Procurement</span><h1>📝 Purchase Requests</h1><p>Material requisitions enter approval before a purchase order is created.</p></div></div>
    {feedback && <p className="procurement-feedback" role="status">{feedback}</p>}
    <section className="procurement-card"><h2>New Material Requisition</h2>
      {canWrite ? <form onSubmit={handleSubmit}><div className="procurement-form-grid">
        <label>Date <b>*</b><input type="date" name="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} disabled={saving} /></label>
        <label>Site <b>*</b><select name="site" value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} disabled={saving}><option value="">Select Site</option>{siteNames.map((site) => <option key={site} value={site}>{site}</option>)}</select></label>
        <label>Requested By <b>*</b><input name="requestedBy" value={form.requestedBy} onChange={(event) => setForm({ ...form, requestedBy: event.target.value })} placeholder={user?.email || "Name"} disabled={saving} /></label>
        <label>Required Date <b>*</b><input type="date" name="requiredDate" value={form.requiredDate} onChange={(event) => setForm({ ...form, requiredDate: event.target.value })} disabled={saving} /></label>
        <label>Priority<select name="priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} disabled={saving}>{PURCHASE_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>Purpose / Work Activity<input name="purpose" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} disabled={saving} /></label>
      </div>
      <div className="procurement-line-items"><div className="procurement-line-heading"><h3>Material Items</h3><button type="button" className="procurement-secondary" onClick={addItem} disabled={saving}>+ Add Item</button></div>{form.items.map((item, index) => <div className="procurement-line-row" key={item.lineId}><label>Material <b>*</b><input list="pr-material-options" value={item.materialName} onChange={(event) => changeItem(index, "materialName", event.target.value)} disabled={saving} /></label><label>Quantity <b>*</b><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => changeItem(index, "quantity", event.target.value)} disabled={saving} /></label><label>Unit <b>*</b><input value={item.unit} onChange={(event) => changeItem(index, "unit", event.target.value)} disabled={saving} /></label>{form.items.length > 1 && <button type="button" className="procurement-text-button" onClick={() => removeItem(index)} disabled={saving}>Remove</button>}</div>)}<datalist id="pr-material-options">{materialOptions.map((material) => <option key={material} value={material} />)}</datalist></div>
      <label className="procurement-full">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} disabled={saving} /></label><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>{saving ? "Submitting..." : "Submit for Approval"}</button></div></form> : <p className="procurement-readonly">You have read-only purchase request access.</p>}
    </section>
    <section className="procurement-card"><h2>Request Register</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search request, site, material..." table={table}><label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All</option>{siteNames.map((site) => <option key={site} value={site}>{site}</option>)}</select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option>{PURCHASE_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">All</option>{PURCHASE_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label></DataTableToolbar>
      {loading ? <p className="procurement-state">Loading purchase requests...</p> : table.count === 0 ? <p className="procurement-state">No purchase requests match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Request</th><th>Date</th><th>Site</th><th>Items</th><th>Required</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{table.rows.map((request) => <tr key={request.id}><td><strong>{request.requestNumber || request.id}</strong><small>{request.requestedBy}</small></td><td>{request.date || "-"}</td><td>{request.site || "-"}</td><td>{(request.items || []).map((item) => `${item.materialName} (${item.quantity} ${item.unit})`).join(", ") || "-"}</td><td>{request.requiredDate || "-"}</td><td>{request.priority || "Normal"}</td><td><span className={`procurement-status procurement-status-${String(request.status || "draft").replace(/\s+/g, "-")}`}>{request.status || "draft"}</span></td><td>{canApprove && String(request.status || "").toLowerCase() === "pending approval" && <><button type="button" className="procurement-text-button" onClick={() => updateRequestStatus(request, "approved")}>Approve</button><button type="button" className="procurement-text-button danger" onClick={() => updateRequestStatus(request, "rejected")}>Reject</button></>}</td></tr>)}</tbody></table></div>}<DataTablePagination table={table} /></section>
  </main></Layout>;
}

export default PurchaseRequests;
