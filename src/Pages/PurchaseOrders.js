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
import { buildDocumentNumber, calculatePurchaseOrderTotals, canManageProcurement, createInitialPurchaseOrderForm, createInitialPurchaseOrderItem, PURCHASE_ORDER_STATUSES, validatePurchaseOrder } from "../utils/procurement";
import "../Styles/Procurement.css";

const formatMoney = (value) => `₹ ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function PurchaseOrders() {
  const { role, user } = useAuth();
  const canWrite = canManageProcurement(role);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(createInitialPurchaseOrderForm);
  const [editId, setEditId] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let pending = 4; const done = () => { pending -= 1; if (pending <= 0) setLoading(false); };
    const subscribe = (name, setter, message) => onSnapshot(query(collection(db, name), limit(500)), (snapshot) => { setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); done(); }, (error) => { void captureMonitoringError(error, { module: "purchaseOrders", operation: "read" }); setFeedback(message); done(); });
    const unOrders = subscribe("purchaseOrders", setOrders, "Purchase orders could not be loaded.");
    const unRequests = subscribe("purchaseRequests", setRequests, "Purchase requests could not be loaded.");
    const unVendors = subscribe("vendors", setVendors, "Vendors could not be loaded.");
    const unMaterials = subscribe("materials", setMaterials, "Material reference data could not be loaded.");
    return () => { unOrders(); unRequests(); unVendors(); unMaterials(); };
  }, []);

  const activeVendors = useMemo(() => vendors.filter((vendor) =>
    String(vendor.status || "active").toLowerCase() === "active" || vendor.id === form.vendorId
  ), [vendors, form.vendorId]);
  const approvedRequests = useMemo(() => requests.filter((request) => String(request.status || "").toLowerCase() === "approved" || (editId && request.id === form.purchaseRequestId)), [requests, editId, form.purchaseRequestId]);
  const materialOptions = useMemo(() => getDistinctValues(materials, (item) => item.materialName || item.name), [materials]);
  const siteNames = useMemo(() => getDistinctValues([...orders, ...requests], (item) => item.site), [orders, requests]);
  const totals = useMemo(() => calculatePurchaseOrderTotals(form.items), [form.items]);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const text = `${order.poNumber} ${order.vendorName} ${order.site} ${(order.items || []).map((item) => item.materialName).join(" ")}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!siteFilter || order.site === siteFilter) && (!vendorFilter || order.vendorId === vendorFilter) && (!statusFilter || String(order.status || "").toLowerCase() === statusFilter);
  }), [orders, search, siteFilter, vendorFilter, statusFilter]);
  const table = useDataTable(filteredOrders, { sortOptions: [
    { value: "date", label: "PO Date", getValue: (item) => item.poDate },
    { value: "delivery", label: "Expected Delivery", getValue: (item) => item.expectedDeliveryDate },
    { value: "vendor", label: "Vendor", getValue: (item) => item.vendorName },
    { value: "total", label: "Total", getValue: (item) => item.grandTotal },
  ], defaultSortBy: "date", defaultSortDirection: "desc", resetKey: `${search}|${siteFilter}|${vendorFilter}|${statusFilter}` });

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const changeItem = (index, name, value) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value } : item) }));
  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, createInitialPurchaseOrderItem()] }));
  const removeItem = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  const resetForm = () => { setEditId(""); setForm(createInitialPurchaseOrderForm()); };

  const chooseVendor = (vendorId) => {
    const vendor = vendors.find((item) => item.id === vendorId);
    setForm((current) => ({ ...current, vendorId, vendorName: vendor?.vendorName || "" }));
  };
  const chooseRequest = (requestId) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) { change("purchaseRequestId", ""); return; }
    setForm((current) => ({ ...current, purchaseRequestId: request.id, site: request.site || "", items: (request.items || []).map((item, index) => ({ ...createInitialPurchaseOrderItem(), ...item, lineId: item.lineId || `line-${index + 1}`, rate: "", taxPercent: "0", discount: "0", receivedQuantity: 0 })) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const orderItems = form.items.map((item) => {
      const material = materials.find((record) =>
        String(record.materialName || record.name || "").trim().toLowerCase() === String(item.materialName || "").trim().toLowerCase()
      );
      return { ...item, materialId: item.materialId || material?.id || "" };
    });
    const validation = validatePurchaseOrder({ ...form, items: orderItems });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    const orderData = validation.value;
    try {
      setSaving(true); setFeedback("");
      if (editId) {
        await updateDoc(doc(db, "purchaseOrders", editId), { ...orderData, poNumber: editId, updatedAt: serverTimestamp() });
        const audit = await logAuditEvent({ action: "update", module: "purchaseOrders", recordId: editId, recordLabel: editId, details: "Draft purchase order updated.", site: orderData.site });
        setFeedback(audit.success ? "Purchase order updated." : getAuditFailureMessage());
      } else {
        const poNumber = buildDocumentNumber("PO", orders);
        const poRef = doc(db, "purchaseOrders", poNumber);
        const requestRef = orderData.purchaseRequestId ? doc(db, "purchaseRequests", orderData.purchaseRequestId) : null;
        await runTransaction(db, async (transaction) => {
          if ((await transaction.get(poRef)).exists()) throw new Error("PO number already exists. Please try again.");
          if (requestRef) {
            const request = await transaction.get(requestRef);
            if (!request.exists() || String(request.data().status || "").toLowerCase() !== "approved") throw new Error("Only an approved purchase request can be converted to a PO.");
            transaction.update(requestRef, { status: "converted to po", updatedAt: serverTimestamp() });
          }
          transaction.set(poRef, { ...orderData, poNumber, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        const audit = await logAuditEvent({ action: "create", module: "purchaseOrders", recordId: poNumber, recordLabel: poNumber, details: "Purchase order created.", site: orderData.site });
        setFeedback(audit.success ? `Purchase order ${poNumber} created.` : getAuditFailureMessage());
      }
      resetForm();
    } catch (error) { console.error("Purchase order save error:", error); void captureMonitoringError(error, { module: "purchaseOrders", operation: "write" }); setFeedback(getUserFriendlyFirebaseError(error, "Purchase order could not be saved.")); }
    finally { setSaving(false); }
  };

  const updateStatus = async (order, status) => {
    if (!canWrite || saving || !window.confirm(`Change ${order.poNumber} to ${status}?`)) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "purchaseOrders", order.id), { status, updatedAt: serverTimestamp() });
      const details = status === "issued" ? "Purchase order issued to vendor." : "Purchase order cancelled.";
      const audit = await logAuditEvent({ action: "update", module: "purchaseOrders", recordId: order.id, recordLabel: order.poNumber, details, site: order.site });
      setFeedback(audit.success ? `Purchase order ${status}.` : getAuditFailureMessage());
    } catch (error) { void captureMonitoringError(error, { module: "purchaseOrders", operation: "write" }); setFeedback("Purchase order status could not be updated."); }
    finally { setSaving(false); }
  };
  const recordPayment = async (order) => {
    if (!canWrite || saving || String(order.status || "").toLowerCase() === "cancelled") return;
    const entered = window.prompt(`Total amount paid for ${order.poNumber || order.id}:`, String(order.paidAmount || 0));
    if (entered === null) return;
    const paidAmount = Number(String(entered).replace(/[₹,\s]/g, ""));
    const grandTotal = Number(order.grandTotal || 0);
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > grandTotal) {
      setFeedback("Paid Amount must be between zero and the PO total.");
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "purchaseOrders", order.id), { paidAmount, outstandingAmount: Math.max(grandTotal - paidAmount, 0), updatedAt: serverTimestamp() });
      const audit = await logAuditEvent({ action: "update", module: "purchaseOrders", recordId: order.id, recordLabel: order.poNumber, details: "PO payable amount updated.", site: order.site });
      setFeedback(audit.success ? "PO payable updated." : getAuditFailureMessage());
    } catch (error) { void captureMonitoringError(error, { module: "purchaseOrders", operation: "write" }); setFeedback("PO payable could not be updated."); }
    finally { setSaving(false); }
  };
  const startEdit = (order) => {
    if (String(order.status || "").toLowerCase() !== "draft") { setFeedback("Only draft purchase orders can be edited."); return; }
    setEditId(order.id); setForm({ ...createInitialPurchaseOrderForm(), ...order, paidAmount: order.paidAmount ?? 0, items: (order.items || []).map((item) => ({ ...item, quantity: item.quantity, rate: item.rate, taxPercent: item.taxPercent, discount: item.discount })) }); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <Layout><main className="procurement-page"><div className="procurement-heading"><div><span>Procurement</span><h1>📄 Purchase Orders</h1><p>Approved requisitions become traceable, multi-item purchase orders.</p></div></div>{feedback && <p className="procurement-feedback" role="status">{feedback}</p>}
    <section className="procurement-card"><h2>{editId ? `Edit ${editId}` : "Create Purchase Order"}</h2>{canWrite ? <form onSubmit={handleSubmit}><div className="procurement-form-grid">
      <label>Approved Purchase Request<select value={form.purchaseRequestId} onChange={(event) => chooseRequest(event.target.value)} disabled={saving || Boolean(editId)}><option value="">Manual PO / No request</option>{approvedRequests.map((request) => <option key={request.id} value={request.id}>{request.requestNumber || request.id} · {request.site}</option>)}</select></label>
      <label>Vendor <b>*</b><select value={form.vendorId} onChange={(event) => chooseVendor(event.target.value)} disabled={saving || Boolean(editId)}><option value="">Select Vendor</option>{activeVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorName}</option>)}</select></label>
      <label>Site <b>*</b><input value={form.site} onChange={(event) => change("site", event.target.value)} disabled={saving || Boolean(editId && form.purchaseRequestId)} /></label>
      <label>PO Date <b>*</b><input type="date" value={form.poDate} onChange={(event) => change("poDate", event.target.value)} disabled={saving} /></label>
      <label>Expected Delivery <b>*</b><input type="date" value={form.expectedDeliveryDate} onChange={(event) => change("expectedDeliveryDate", event.target.value)} disabled={saving} /></label>
      <label>Paid Amount<input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => change("paidAmount", event.target.value)} disabled={saving} /></label>
      <label>Payment Terms<input value={form.paymentTerms} onChange={(event) => change("paymentTerms", event.target.value)} disabled={saving} /></label>
      <label>Delivery Terms<input value={form.deliveryTerms} onChange={(event) => change("deliveryTerms", event.target.value)} disabled={saving} /></label>
    </div><div className="procurement-line-items"><div className="procurement-line-heading"><h3>PO Items</h3><button className="procurement-secondary" type="button" onClick={addItem} disabled={saving}>+ Add Item</button></div>{form.items.map((item, index) => <div className="procurement-line-row procurement-po-line" key={item.lineId}><label>Material <b>*</b><input list="po-material-options" value={item.materialName} onChange={(event) => changeItem(index, "materialName", event.target.value)} disabled={saving} /></label><label>Qty <b>*</b><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => changeItem(index, "quantity", event.target.value)} disabled={saving} /></label><label>Unit <b>*</b><input value={item.unit} onChange={(event) => changeItem(index, "unit", event.target.value)} disabled={saving} /></label><label>Rate <b>*</b><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => changeItem(index, "rate", event.target.value)} disabled={saving} /></label><label>Tax %<input type="number" min="0" step="0.01" value={item.taxPercent} onChange={(event) => changeItem(index, "taxPercent", event.target.value)} disabled={saving} /></label><label>Discount<input type="number" min="0" step="0.01" value={item.discount} onChange={(event) => changeItem(index, "discount", event.target.value)} disabled={saving} /></label><span className="procurement-line-total">{formatMoney(calculatePurchaseOrderTotals([item]).grandTotal)}</span>{form.items.length > 1 && <button type="button" className="procurement-text-button danger" onClick={() => removeItem(index)} disabled={saving}>Remove</button>}</div>)}<datalist id="po-material-options">{materialOptions.map((material) => <option key={material} value={material} />)}</datalist></div>
    <div className="procurement-total-strip"><span>Subtotal <strong>{formatMoney(totals.subtotal)}</strong></span><span>Discount <strong>{formatMoney(totals.discount)}</strong></span><span>GST <strong>{formatMoney(totals.tax)}</strong></span><span>Grand Total <strong>{formatMoney(totals.grandTotal)}</strong></span></div><label className="procurement-full">Notes<textarea value={form.notes} onChange={(event) => change("notes", event.target.value)} disabled={saving} /></label><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>{saving ? "Saving..." : editId ? "Update Draft PO" : "Save Purchase Order"}</button>{editId && <button type="button" className="procurement-secondary" onClick={resetForm} disabled={saving}>Cancel</button>}</div></form> : <p className="procurement-readonly">You have read-only purchase order access.</p>}</section>
    <section className="procurement-card"><h2>Purchase Order Register</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search PO, vendor, site, material..." table={table}><label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All</option>{siteNames.map((site) => <option key={site}>{site}</option>)}</select></label><label><span>Vendor</span><select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option value="">All</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorName}</option>)}</select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option>{PURCHASE_ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></DataTableToolbar>
    {loading ? <p className="procurement-state">Loading purchase orders...</p> : table.count === 0 ? <p className="procurement-state">No purchase orders match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>PO</th><th>Vendor / Site</th><th>Expected</th><th>Items</th><th>Total</th><th>Paid / Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>{table.rows.map((order) => <tr key={order.id}><td><strong>{order.poNumber || order.id}</strong><small>{order.poDate}</small></td><td>{order.vendorName}<small>{order.site}</small></td><td>{order.expectedDeliveryDate || "-"}</td><td>{(order.items || []).map((item) => `${item.materialName} (${item.receivedQuantity || 0}/${item.quantity} ${item.unit})`).join(", ")}</td><td>{formatMoney(order.grandTotal)}</td><td>{formatMoney(order.paidAmount)} / {formatMoney(order.outstandingAmount)}</td><td><span className={`procurement-status procurement-status-${String(order.status || "draft").replace(/\s+/g, "-")}`}>{order.status || "draft"}</span></td><td>{canWrite && <>{String(order.status || "").toLowerCase() === "draft" && <><button type="button" className="procurement-text-button" onClick={() => startEdit(order)}>Edit</button><button type="button" className="procurement-text-button" onClick={() => updateStatus(order, "issued")}>Issue</button></>}{["draft", "issued"].includes(String(order.status || "").toLowerCase()) && <button type="button" className="procurement-text-button danger" onClick={() => updateStatus(order, "cancelled")}>Cancel</button>}{String(order.status || "").toLowerCase() !== "cancelled" && <button type="button" className="procurement-text-button" onClick={() => recordPayment(order)}>Payment</button>}</>}</td></tr>)}</tbody></table></div>}<DataTablePagination table={table} /></section>
  </main></Layout>;
}

export default PurchaseOrders;
