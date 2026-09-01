import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { captureMonitoringError } from "../utils/monitoring";
import { getSiteName, normaliseMoney } from "../utils/financialReporting";
import {
  buildWorkOrderNumber, canManageSubcontracting, canTransitionWorkOrder,
  CONTRACTOR_PAYMENT_MODES, CONTRACTOR_PAYMENT_TYPES, createInitialWorkOrderForm,
  getSubcontractingSummary, isSubcontractorVendor, validateContractorBill,
  validateContractorPayment, validateWorkOrder, validateWorkOrderProgress,
  WORK_ORDER_RATE_TYPES, WORK_ORDER_STATUSES,
} from "../utils/subcontracting";
import "../Styles/Procurement.css";

const formatMoney = (value) => "₹ " + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const initialProgressForm = () => ({ workOrderId: "", date: today(), site: "", quantity: "", unit: "", progressPercent: "", remarks: "", dprId: "" });
const initialBillForm = () => ({ workOrderId: "", billDate: today(), currentBillAmount: "", advanceRecovery: "0", deductions: "0", remarks: "" });
const initialPaymentForm = () => ({ contractorBillId: "", paymentDate: today(), amount: "", paymentMode: "Bank Transfer", paymentType: "Bill Payment", reference: "", remarks: "" });

function WorkOrders() {
  const { role, user } = useAuth();
  const canWrite = canManageSubcontracting(role);
  const [vendors, setVendors] = useState([]);
  const [sites, setSites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [progressRecords, setProgressRecords] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [orderForm, setOrderForm] = useState(createInitialWorkOrderForm);
  const [progressForm, setProgressForm] = useState(initialProgressForm);
  const [billForm, setBillForm] = useState(initialBillForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [editId, setEditId] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const names = ["vendors", "sites", "workOrders", "workOrderProgress", "contractorBills", "contractorPayments", "boqItems"];
    let remaining = names.length;
    const complete = () => { remaining -= 1; if (remaining <= 0) setLoading(false); };
    const subscribe = (name, setter, message) => onSnapshot(query(collection(db, name)),
      (snapshot) => { setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); complete(); },
      (error) => { void captureMonitoringError(error, { module: "subcontracting", operation: "read" }); setFeedback(message); complete(); }
    );
    const unsubscribers = [
      subscribe("vendors", setVendors, "Vendors could not be loaded."),
      subscribe("sites", setSites, "Sites could not be loaded."),
      subscribe("workOrders", setOrders, "Work orders could not be loaded."),
      subscribe("workOrderProgress", setProgressRecords, "Work progress history could not be loaded."),
      subscribe("contractorBills", setBills, "Contractor bills could not be loaded."),
      subscribe("contractorPayments", setPayments, "Contractor payment history could not be loaded."),
      subscribe("boqItems", setBoqItems, "BOQ items could not be loaded."),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const activeVendors = useMemo(() => vendors.filter((vendor) => String(vendor.status || "active").toLowerCase() === "active" || vendor.id === orderForm.vendorId).sort((first, second) => {
    const firstPriority = isSubcontractorVendor(first) ? 0 : 1;
    const secondPriority = isSubcontractorVendor(second) ? 0 : 1;
    return firstPriority - secondPriority || String(first.vendorName || "").localeCompare(String(second.vendorName || ""));
  }), [vendors, orderForm.vendorId]);
  const siteNames = useMemo(() => getDistinctValues([...sites, ...orders], (item) => getSiteName(item) || item.siteName || item.name), [sites, orders]);
  const approvedOrders = useMemo(() => orders.filter((order) => ["Approved", "Active"].includes(order.status)), [orders]);
  const availableBoqItems = useMemo(() => boqItems.filter((item) => item.status === "Active" && (!orderForm.site || item.site === orderForm.site)), [boqItems, orderForm.site]);
  const billableOrders = useMemo(() => orders.filter((order) => ["Approved", "Active", "Completed", "Closed"].includes(order.status)), [orders]);
  const paymentableBills = useMemo(() => bills.filter((bill) => normaliseMoney(bill.pendingAmount) > 0 || normaliseMoney(bill.retentionBalance) > 0), [bills]);
  const summary = useMemo(() => getSubcontractingSummary(orders, bills), [orders, bills]);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const text = [order.workOrderNumber, order.vendorName, order.site, order.workTrade, order.workDescription].join(" ").toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!siteFilter || order.site === siteFilter) && (!vendorFilter || order.vendorId === vendorFilter) && (!statusFilter || order.status === statusFilter);
  }), [orders, search, siteFilter, vendorFilter, statusFilter]);
  const table = useDataTable(filteredOrders, { sortOptions: [
    { value: "start", label: "Start date", getValue: (item) => item.startDate },
    { value: "due", label: "Expected completion", getValue: (item) => item.expectedCompletionDate },
    { value: "vendor", label: "Vendor", getValue: (item) => item.vendorName },
    { value: "value", label: "Contract value", getValue: (item) => item.contractValue },
  ], defaultSortBy: "due", resetKey: [search, siteFilter, vendorFilter, statusFilter].join("|") });

  const changeOrder = (name, value) => setOrderForm((current) => ({ ...current, [name]: value }));
  const chooseVendor = (vendorId) => {
    const vendor = vendors.find((item) => item.id === vendorId);
    setOrderForm((current) => ({ ...current, vendorId, vendorName: vendor?.vendorName || "" }));
  };
  const chooseSite = (site) => {
    const matched = sites.find((item) => getSiteName(item) === site || item.siteName === site || item.name === site);
    setOrderForm((current) => ({ ...current, site, siteId: matched?.id || current.siteId || "" }));
  };
  const resetOrder = () => { setEditId(""); setOrderForm(createInitialWorkOrderForm()); };

  const submitWorkOrder = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateWorkOrder(orderForm);
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      if (editId) {
        const existing = orders.find((item) => item.id === editId);
        if (!existing || existing.status !== "Draft") throw new Error("Only draft work orders can be edited.");
        await updateDoc(doc(db, "workOrders", editId), { ...validation.value, workOrderNumber: existing.workOrderNumber, createdBy: existing.createdBy, createdAt: existing.createdAt, updatedAt: serverTimestamp() });
        const audit = await logAuditEvent({ action: "update", module: "workOrders", recordId: editId, recordLabel: existing.workOrderNumber, details: "Draft work order updated.", site: validation.value.site });
        setFeedback(audit.success ? "Draft work order updated." : getAuditFailureMessage());
      } else {
        const workOrderNumber = buildWorkOrderNumber(orders);
        const reference = doc(db, "workOrders", workOrderNumber);
        await runTransaction(db, async (transaction) => {
          if ((await transaction.get(reference)).exists()) throw new Error("Work-order number already exists. Please save again.");
          transaction.set(reference, { ...validation.value, workOrderNumber, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        const audit = await logAuditEvent({ action: "create", module: "workOrders", recordId: workOrderNumber, recordLabel: workOrderNumber, details: "Draft work order created.", site: validation.value.site });
        setFeedback(audit.success ? "Draft work order created." : getAuditFailureMessage());
      }
      resetOrder();
    } catch (error) { console.error("Work order save error:", error); void captureMonitoringError(error, { module: "subcontracting", operation: "write" }); setFeedback(getUserFriendlyFirebaseError(error, "Work order could not be saved.")); }
    finally { setSaving(false); }
  };

  const editOrder = (order) => {
    if (order.status !== "Draft") { setFeedback("Approved work orders are commercially immutable. Create a new work order if scope changes."); return; }
    setEditId(order.id);
    setOrderForm({ ...createInitialWorkOrderForm(), ...order, contractValue: order.contractValue ?? "", quantity: order.quantity ?? "", rate: order.rate ?? "", retentionPercent: order.retentionPercent ?? 0, advanceAmount: order.advanceAmount ?? 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updateOrderStatus = async (order, status) => {
    if (!canWrite || saving || !canTransitionWorkOrder(order.status, status) || !window.confirm("Change " + order.workOrderNumber + " to " + status + "?")) return;
    try {
      setSaving(true); await updateDoc(doc(db, "workOrders", order.id), { status, updatedAt: serverTimestamp() });
      const audit = await logAuditEvent({ action: "update", module: "workOrders", recordId: order.id, recordLabel: order.workOrderNumber, details: "Work order status changed to " + status + ".", site: order.site });
      setFeedback(audit.success ? "Work order " + status.toLowerCase() + "." : getAuditFailureMessage());
    } catch (error) { void captureMonitoringError(error, { module: "subcontracting", operation: "write" }); setFeedback("Work-order status could not be changed."); }
    finally { setSaving(false); }
  };
  const selectProgressOrder = (workOrderId) => {
    const order = orders.find((item) => item.id === workOrderId);
    setProgressForm((current) => ({ ...current, workOrderId, site: order?.site || "", unit: order?.rateType === "Item Rate" ? order.unit : "%", quantity: "", progressPercent: "" }));
  };
  const submitProgress = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const order = orders.find((item) => item.id === progressForm.workOrderId);
    const validation = validateWorkOrderProgress({ workOrder: order, progressRecords, ...progressForm });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      const progressReference = doc(collection(db, "workOrderProgress"));
      const batch = writeBatch(db);
      batch.set(progressReference, { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(doc(db, "workOrders", order.id), {
        progressQuantity: validation.value.cumulativeQuantity,
        progressPercent: validation.value.cumulativeProgressPercent,
        certifiedAmount: validation.value.cumulativeCertifiedAmount,
        status: order.status === "Approved" ? "Active" : order.status,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      const audit = await logAuditEvent({ action: "create", module: "workOrderProgress", recordId: progressReference.id, recordLabel: order.workOrderNumber, details: "Certified progress recorded.", site: validation.value.site });
      setFeedback(audit.success ? "Certified work progress saved." : getAuditFailureMessage());
      setProgressForm(initialProgressForm());
    } catch (error) { console.error("Progress save error:", error); void captureMonitoringError(error, { module: "subcontracting", operation: "write" }); setFeedback("Work progress could not be saved."); }
    finally { setSaving(false); }
  };

  const selectBillOrder = (workOrderId) => setBillForm((current) => ({ ...current, workOrderId, currentBillAmount: "", advanceRecovery: "0", deductions: "0" }));
  const submitBill = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const order = orders.find((item) => item.id === billForm.workOrderId);
    const validation = validateContractorBill({ workOrder: order, contractorBills: bills, ...billForm });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      const billReference = doc(collection(db, "contractorBills"));
      const expenseReference = doc(collection(db, "expenses"));
      const billNumber = "CB-" + String(order.workOrderNumber || order.id) + "-" + String(bills.filter((item) => item.workOrderId === order.id).length + 1).padStart(2, "0");
      const batch = writeBatch(db);
      batch.set(billReference, {
        ...validation.value, billNumber, linkedExpenseId: expenseReference.id,
        createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      batch.set(expenseReference, {
        date: validation.value.billDate, site: validation.value.site, expenseType: "Subcontractor",
        amount: validation.value.currentBillAmount, paidTo: validation.value.vendorName,
        description: "Certified work under " + order.workOrderNumber, remarks: validation.value.remarks,
        sourceType: "contractorBill", contractorBillId: billReference.id, workOrderId: order.id,
        workOrderNumber: order.workOrderNumber, vendorId: validation.value.vendorId,
        createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, "workOrders", order.id), {
        advanceRecovered: normaliseMoney(order.advanceRecovered) + validation.value.advanceRecovery,
        billedAmount: normaliseMoney(order.billedAmount) + validation.value.currentBillAmount,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      const billAudit = await logAuditEvent({ action: "create", module: "contractorBills", recordId: billReference.id, recordLabel: billNumber, details: "Certified contractor bill created with linked expense.", site: validation.value.site });
      await logAuditEvent({ action: "create", module: "expenses", recordId: expenseReference.id, recordLabel: billNumber, details: "Subcontractor bill expense linked to contractor bill.", site: validation.value.site });
      setFeedback(billAudit.success ? "Contractor bill and its linked expense were saved." : getAuditFailureMessage());
      setBillForm(initialBillForm());
    } catch (error) { console.error("Contractor bill save error:", error); void captureMonitoringError(error, { module: "subcontracting", operation: "write" }); setFeedback("Contractor bill could not be saved."); }
    finally { setSaving(false); }
  };

  const selectPaymentBill = (contractorBillId) => setPaymentForm((current) => ({ ...current, contractorBillId, amount: "", paymentType: "Bill Payment" }));
  const submitPayment = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const bill = bills.find((item) => item.id === paymentForm.contractorBillId);
    const validation = validateContractorPayment({ bill, ...paymentForm });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      const paymentReference = doc(collection(db, "contractorPayments"));
      const batch = writeBatch(db);
      batch.set(paymentReference, { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(doc(db, "contractorBills", bill.id), { ...validation.value.billUpdate, updatedAt: serverTimestamp() });
      await batch.commit();
      const audit = await logAuditEvent({ action: "create", module: "contractorPayments", recordId: paymentReference.id, recordLabel: bill.billNumber || bill.id, details: validation.value.paymentType + " recorded.", site: validation.value.site });
      setFeedback(audit.success ? "Contractor payment recorded." : getAuditFailureMessage());
      setPaymentForm(initialPaymentForm());
    } catch (error) { console.error("Contractor payment error:", error); void captureMonitoringError(error, { module: "subcontracting", operation: "write" }); setFeedback("Contractor payment could not be saved."); }
    finally { setSaving(false); }
  };

  return <Layout><main className="procurement-page">
    <div className="procurement-heading"><div><span>Subcontracting</span><h1>🧱 Work Orders</h1><p>Vendor-linked contracts, certified progress, retention, advances, bills, and payment history.</p></div></div>
    <section className="procurement-summary-grid">
      <article><span>Active Work Orders</span><strong>{summary.activeWorkOrders}</strong></article>
      <article><span>Contract Value</span><strong>{formatMoney(summary.totalContractValue)}</strong></article>
      <article><span>Certified Work</span><strong>{formatMoney(summary.certifiedAmount)}</strong></article>
      <article><span>Pending Bills</span><strong>{formatMoney(summary.pendingPayable)}</strong></article>
      <article><span>Retention Held</span><strong>{formatMoney(summary.retentionBalance)}</strong></article>
      <article><span>Overdue Orders</span><strong>{summary.overdueWorkOrders}</strong></article>
    </section>
    {feedback && <p className="procurement-feedback" role="status">{feedback}</p>}

    <section className="procurement-card"><h2>{editId ? "Edit Draft Work Order" : "Create Work Order"}</h2>{canWrite ? <form onSubmit={submitWorkOrder}><div className="procurement-form-grid">
      <label>Vendor / Contractor <b>*</b><select value={orderForm.vendorId} onChange={(event) => chooseVendor(event.target.value)} disabled={saving || Boolean(editId)}><option value="">Select Vendor</option>{activeVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorName} · {vendor.vendorType || "Supplier"}</option>)}</select></label>
      <label>Site <b>*</b><input list="work-order-sites" value={orderForm.site} onChange={(event) => chooseSite(event.target.value)} disabled={saving || Boolean(editId)} /><datalist id="work-order-sites">{siteNames.map((site) => <option key={site} value={site} />)}</datalist></label>
      <label>Linked BOQ Item<select value={orderForm.boqItemId || ""} onChange={(event) => changeOrder("boqItemId", event.target.value)} disabled={saving || Boolean(editId)}><option value="">No BOQ link</option>{availableBoqItems.map((item) => <option key={item.id} value={item.id}>{item.itemNumber} · {item.description}</option>)}</select></label>
      <label>Trade / Work Type <b>*</b><input value={orderForm.workTrade} onChange={(event) => changeOrder("workTrade", event.target.value)} placeholder="Civil, electrical, plumbing..." disabled={saving || Boolean(editId)} /></label>
      <label>Rate Type <b>*</b><select value={orderForm.rateType} onChange={(event) => changeOrder("rateType", event.target.value)} disabled={saving || Boolean(editId)}>{WORK_ORDER_RATE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Start Date <b>*</b><input type="date" value={orderForm.startDate} onChange={(event) => changeOrder("startDate", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      <label>Expected Completion <b>*</b><input type="date" value={orderForm.expectedCompletionDate} onChange={(event) => changeOrder("expectedCompletionDate", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      {orderForm.rateType === "Item Rate" ? <><label>Contract Quantity <b>*</b><input type="number" min="0.01" step="0.01" value={orderForm.quantity} onChange={(event) => changeOrder("quantity", event.target.value)} disabled={saving || Boolean(editId)} /></label><label>Unit <b>*</b><input value={orderForm.unit} onChange={(event) => changeOrder("unit", event.target.value)} disabled={saving || Boolean(editId)} /></label><label>Rate <b>*</b><input type="number" min="0" step="0.01" value={orderForm.rate} onChange={(event) => changeOrder("rate", event.target.value)} disabled={saving || Boolean(editId)} /></label></> : <label>Contract Value <b>*</b><input type="number" min="0.01" step="0.01" value={orderForm.contractValue} onChange={(event) => changeOrder("contractValue", event.target.value)} disabled={saving || Boolean(editId)} /></label>}
      <label>Retention %<input type="number" min="0" max="100" step="0.01" value={orderForm.retentionPercent} onChange={(event) => changeOrder("retentionPercent", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      <label>Advance Amount<input type="number" min="0" step="0.01" value={orderForm.advanceAmount} onChange={(event) => changeOrder("advanceAmount", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      <label className="procurement-full">Work Description <b>*</b><textarea value={orderForm.workDescription} onChange={(event) => changeOrder("workDescription", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      <label className="procurement-full">Terms<textarea value={orderForm.terms} onChange={(event) => changeOrder("terms", event.target.value)} disabled={saving || Boolean(editId)} /></label>
      <label className="procurement-full">Remarks<textarea value={orderForm.remarks} onChange={(event) => changeOrder("remarks", event.target.value)} disabled={saving || Boolean(editId)} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>{saving ? "Saving..." : editId ? "Update Draft" : "Save Draft Work Order"}</button>{editId && <button type="button" className="procurement-secondary" onClick={resetOrder} disabled={saving}>Cancel</button>}</div></form> : <p className="procurement-readonly">You have read-only work-order access.</p>}</section>
    {canWrite && <section className="procurement-card"><h2>Record Certified Progress</h2><form onSubmit={submitProgress}><div className="procurement-form-grid">
      <label>Work Order <b>*</b><select value={progressForm.workOrderId} onChange={(event) => selectProgressOrder(event.target.value)} disabled={saving}><option value="">Select approved / active work order</option>{approvedOrders.map((order) => <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.site}</option>)}</select></label>
      <label>Date <b>*</b><input type="date" value={progressForm.date} onChange={(event) => setProgressForm((current) => ({ ...current, date: event.target.value }))} disabled={saving} /></label>
      <label>Site <b>*</b><input value={progressForm.site} readOnly /></label>
      <label>Progress % <b>*</b><input type="number" min="0" max="100" step="0.01" value={progressForm.progressPercent} onChange={(event) => setProgressForm((current) => ({ ...current, progressPercent: event.target.value }))} disabled={saving} /></label>
      <label>Quantity<input type="number" min="0" step="0.01" value={progressForm.quantity} onChange={(event) => setProgressForm((current) => ({ ...current, quantity: event.target.value }))} disabled={saving} /></label>
      <label>Unit<input value={progressForm.unit} onChange={(event) => setProgressForm((current) => ({ ...current, unit: event.target.value }))} disabled={saving} /></label>
      <label>Related DPR ID (optional)<input value={progressForm.dprId} onChange={(event) => setProgressForm((current) => ({ ...current, dprId: event.target.value }))} disabled={saving} /></label>
      <label className="procurement-full">Remarks<textarea value={progressForm.remarks} onChange={(event) => setProgressForm((current) => ({ ...current, remarks: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>Save Certified Progress</button></div></form></section>}

    {canWrite && <section className="procurement-card"><h2>Create Contractor Bill</h2><p className="procurement-readonly">Each certified bill creates one linked expense record. It is the only financial cost source for this work.</p><form onSubmit={submitBill}><div className="procurement-form-grid">
      <label>Work Order <b>*</b><select value={billForm.workOrderId} onChange={(event) => selectBillOrder(event.target.value)} disabled={saving}><option value="">Select billable work order</option>{billableOrders.map((order) => <option key={order.id} value={order.id}>{order.workOrderNumber} · Certified {formatMoney(order.certifiedAmount)}</option>)}</select></label>
      <label>Bill Date <b>*</b><input type="date" value={billForm.billDate} onChange={(event) => setBillForm((current) => ({ ...current, billDate: event.target.value }))} disabled={saving} /></label>
      <label>Current Bill Amount <b>*</b><input type="number" min="0.01" step="0.01" value={billForm.currentBillAmount} onChange={(event) => setBillForm((current) => ({ ...current, currentBillAmount: event.target.value }))} disabled={saving} /></label>
      <label>Advance Recovery<input type="number" min="0" step="0.01" value={billForm.advanceRecovery} onChange={(event) => setBillForm((current) => ({ ...current, advanceRecovery: event.target.value }))} disabled={saving} /></label>
      <label>Deductions<input type="number" min="0" step="0.01" value={billForm.deductions} onChange={(event) => setBillForm((current) => ({ ...current, deductions: event.target.value }))} disabled={saving} /></label>
      <label className="procurement-full">Remarks<textarea value={billForm.remarks} onChange={(event) => setBillForm((current) => ({ ...current, remarks: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>Save Bill & Linked Expense</button></div></form></section>}

    {canWrite && <section className="procurement-card"><h2>Record Contractor Payment</h2><form onSubmit={submitPayment}><div className="procurement-form-grid">
      <label>Bill <b>*</b><select value={paymentForm.contractorBillId} onChange={(event) => selectPaymentBill(event.target.value)} disabled={saving}><option value="">Select pending bill</option>{paymentableBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.billNumber || bill.id} · Pending {formatMoney(bill.pendingAmount)} · Retention {formatMoney(bill.retentionBalance)}</option>)}</select></label>
      <label>Payment Date <b>*</b><input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} disabled={saving} /></label>
      <label>Payment Type <b>*</b><select value={paymentForm.paymentType} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentType: event.target.value }))} disabled={saving}>{CONTRACTOR_PAYMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Amount <b>*</b><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} disabled={saving} /></label>
      <label>Payment Mode <b>*</b><select value={paymentForm.paymentMode} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMode: event.target.value }))} disabled={saving}>{CONTRACTOR_PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
      <label>Reference<input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} disabled={saving} /></label>
      <label className="procurement-full">Remarks<textarea value={paymentForm.remarks} onChange={(event) => setPaymentForm((current) => ({ ...current, remarks: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>Record Payment</button></div></form></section>}

    <section className="procurement-card"><h2>Work Order Register</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search work order, contractor, site, trade..." table={table}>
      <label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All</option>{siteNames.map((site) => <option key={site}>{site}</option>)}</select></label>
      <label><span>Vendor</span><select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option value="">All</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorName}</option>)}</select></label>
      <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option>{WORK_ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
    </DataTableToolbar>
    {loading ? <p className="procurement-state">Loading work orders...</p> : table.count === 0 ? <p className="procurement-state">No work orders match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Work Order</th><th>Vendor / Site</th><th>Scope</th><th>Contract / Certified</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{table.rows.map((order) => <tr key={order.id}><td><strong>{order.workOrderNumber || order.id}</strong><small>{order.startDate || "-"}</small></td><td>{order.vendorName || "-"}<small>{order.site || "-"}</small></td><td>{order.workTrade || "-"}<small>{order.workDescription || "-"}</small></td><td>{formatMoney(order.contractValue)}<small>{formatMoney(order.certifiedAmount)} certified · {order.progressPercent || 0}%</small></td><td>{order.expectedCompletionDate || "-"}</td><td><span className={"procurement-status procurement-status-" + String(order.status || "Draft").toLowerCase()}>{order.status || "Draft"}</span></td><td>{canWrite && <>{order.status === "Draft" && <><button type="button" className="procurement-text-button" onClick={() => editOrder(order)}>Edit</button><button type="button" className="procurement-text-button" onClick={() => updateOrderStatus(order, "Approved")}>Approve</button><button type="button" className="procurement-text-button danger" onClick={() => updateOrderStatus(order, "Cancelled")}>Cancel</button></>}{order.status === "Approved" && <><button type="button" className="procurement-text-button" onClick={() => updateOrderStatus(order, "Active")}>Activate</button><button type="button" className="procurement-text-button danger" onClick={() => updateOrderStatus(order, "Cancelled")}>Cancel</button></>}{order.status === "Active" && <><button type="button" className="procurement-text-button" onClick={() => updateOrderStatus(order, "Completed")}>Complete</button><button type="button" className="procurement-text-button danger" onClick={() => updateOrderStatus(order, "Cancelled")}>Cancel</button></>}{order.status === "Completed" && <button type="button" className="procurement-text-button" onClick={() => updateOrderStatus(order, "Closed")}>Close</button>}</>}</td></tr>)}</tbody></table></div>}
    <DataTablePagination table={table} /></section>

    <section className="procurement-card"><h2>Certified Contractor Bills</h2>{bills.length === 0 ? <p className="procurement-state">No contractor bills have been created.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Bill</th><th>Date / Site</th><th>Vendor</th><th>Current Bill</th><th>Paid / Pending</th><th>Retention</th><th>Status</th></tr></thead><tbody>{bills.slice().sort((first, second) => String(second.billDate || "").localeCompare(String(first.billDate || ""))).map((bill) => <tr key={bill.id}><td>{bill.billNumber || bill.id}<small>{bill.workOrderNumber || "-"}</small></td><td>{bill.billDate || "-"}<small>{bill.site || "-"}</small></td><td>{bill.vendorName || "-"}</td><td>{formatMoney(bill.currentBillAmount)}</td><td>{formatMoney(bill.paidAmount)} / {formatMoney(bill.pendingAmount)}</td><td>{formatMoney(bill.retentionBalance)}</td><td><span className={"procurement-status procurement-status-" + String(bill.paymentStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}>{bill.paymentStatus || "Pending"}</span></td></tr>)}</tbody></table></div>}</section>
    <section className="procurement-card"><h2>Contractor Payment History</h2>{payments.length === 0 ? <p className="procurement-state">No contractor payments have been recorded.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Date</th><th>Bill / Work Order</th><th>Vendor / Site</th><th>Type / Mode</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{payments.slice().sort((first, second) => String(second.paymentDate || "").localeCompare(String(first.paymentDate || ""))).map((payment) => <tr key={payment.id}><td>{payment.paymentDate || "-"}</td><td>{payment.workOrderNumber || "-"}<small>{payment.contractorBillId || "-"}</small></td><td>{payment.vendorName || "-"}<small>{payment.site || "-"}</small></td><td>{payment.paymentType || "-"}<small>{payment.paymentMode || "-"}</small></td><td>{formatMoney(payment.amount)}</td><td>{payment.reference || "-"}</td></tr>)}</tbody></table></div>}</section>
  </main></Layout>;
}

export default WorkOrders;
