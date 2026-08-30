import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import Layout from "../Components/Layout";
import PrintBrandHeader from "../Components/PrintBrandHeader";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { normaliseMoney } from "../utils/financialReporting";
import { getBoqItemProgressRows, validateBoqBillingLines } from "../utils/boqReporting";
import {
  BILLING_TYPES, buildRABillNumber, canManageClientBilling, canTransitionRABill, calculateRABill,
  CLIENT_STATUSES, createInitialBillingProfileForm, createInitialClientForm, createInitialRABillForm,
  getClientBillingSummary, RECEIPT_PAYMENT_MODES, RA_BILL_STATUSES, validateBillingProfile,
  validateClient, validateClientReceipt, validateRABill, validateRetentionRelease,
} from "../utils/clientBilling";
import "../Styles/Procurement.css";

const formatMoney = (value) => "₹ " + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const initialReceipt = () => ({ raBillId: "", receiptDate: today(), amount: "", tdsDeducted: "0", paymentMode: "Bank Transfer", reference: "", remarks: "" });
const initialRelease = () => ({ raBillId: "", releaseDate: today(), amount: "", paymentMode: "Bank Transfer", reference: "", remarks: "" });
const getInvoiceStatus = (paid, pending) => pending <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";
const snapshotRows = (snapshot) => {
  const documents = Array.isArray(snapshot?.docs) ? snapshot.docs : [];

  return documents.map((item) => {
    const data = typeof item?.data === "function" ? item.data() : {};
    return { id: item?.id || "", ...(data && typeof data === "object" ? data : {}) };
  });
};

function ClientBilling() {
  const { role, user } = useAuth();
  const canWrite = canManageClientBilling(role);
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [bills, setBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [retentionReleases, setRetentionReleases] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [boqMeasurements, setBoqMeasurements] = useState([]);
  const [boqVariations, setBoqVariations] = useState([]);
  const [boqLineItemId, setBoqLineItemId] = useState("");
  const [boqLineQuantity, setBoqLineQuantity] = useState("");
  const [clientForm, setClientForm] = useState(createInitialClientForm);
  const [profileForm, setProfileForm] = useState(createInitialBillingProfileForm);
  const [billForm, setBillForm] = useState(createInitialRABillForm);
  const [receiptForm, setReceiptForm] = useState(initialReceipt);
  const [releaseForm, setReleaseForm] = useState(initialRelease);
  const [editingClientId, setEditingClientId] = useState("");
  const [editingBillId, setEditingBillId] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const collections = ["sites", "clients", "siteBillingProfiles", "raBills", "clientReceipts", "raRetentionReleases", "invoices", "boqItems", "boqMeasurements", "boqVariations"];
    let remaining = collections.length;
    const complete = () => { remaining -= 1; if (remaining <= 0) setLoading(false); };
    const subscribe = (name, setter, message) => onSnapshot(query(collection(db, name)),
      (snapshot) => { setter(snapshotRows(snapshot)); complete(); },
      () => { setFeedback(message); complete(); }
    );
    const unsubscribers = [
      subscribe("sites", setSites, "Sites could not be loaded."), subscribe("clients", setClients, "Clients could not be loaded."),
      subscribe("siteBillingProfiles", setProfiles, "Billing profiles could not be loaded."), subscribe("raBills", setBills, "RA bills could not be loaded."),
      subscribe("clientReceipts", setReceipts, "Client receipts could not be loaded."), subscribe("raRetentionReleases", setRetentionReleases, "Retention releases could not be loaded."),
      subscribe("invoices", setInvoices, "Invoices could not be loaded."),
      subscribe("boqItems", setBoqItems, "BOQ items could not be loaded."),
      subscribe("boqMeasurements", setBoqMeasurements, "BOQ measurements could not be loaded."),
      subscribe("boqVariations", setBoqVariations, "BOQ variations could not be loaded."),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const activeClients = useMemo(() => clients.filter((client) => String(client.status || "active").toLowerCase() === "active" || client.id === profileForm.clientId), [clients, profileForm.clientId]);
  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.clientId && profile.contractValue > 0), [profiles]);
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === billForm.siteId || profile.siteId === billForm.siteId), [profiles, billForm.siteId]);
  const calculatedBill = useMemo(() => calculateRABill(billForm, selectedProfile || {}), [billForm, selectedProfile]);
  const billingSummary = useMemo(() => getClientBillingSummary({ invoices, raBills: bills }), [invoices, bills]);
  const boqProgressRows = useMemo(() => getBoqItemProgressRows({ items: boqItems, measurements: boqMeasurements, variations: boqVariations, raBills: bills }), [boqItems, boqMeasurements, boqVariations, bills]);
  const billableBoqRows = useMemo(() => boqProgressRows.filter((item) => !selectedProfile || item.siteId === selectedProfile.siteId || item.site === selectedProfile.siteName), [boqProgressRows, selectedProfile]);
  const billableReceipts = useMemo(() => bills.filter((bill) => ["Certified", "Partially Paid"].includes(bill.status) && normaliseMoney(bill.pendingAmount) > 0), [bills]);
  const retentionBills = useMemo(() => bills.filter((bill) => normaliseMoney(bill.retentionBalance) > 0), [bills]);
  const siteNames = useMemo(() => getDistinctValues(sites, (site) => site.siteName || site.name || site.site), [sites]);

  const filteredBills = useMemo(() => bills.filter((bill) => {
    const text = [bill.raBillNumber, bill.site, bill.clientName, bill.agreementNumber, bill.status].join(" ").toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!siteFilter || bill.site === siteFilter) && (!clientFilter || bill.clientId === clientFilter) && (!statusFilter || bill.status === statusFilter);
  }), [bills, search, siteFilter, clientFilter, statusFilter]);
  const billTable = useDataTable(filteredBills, { sortOptions: [
    { value: "date", label: "Bill date", getValue: (bill) => bill.billDate }, { value: "due", label: "Payment due", getValue: (bill) => bill.paymentDueDate },
    { value: "client", label: "Client", getValue: (bill) => bill.clientName }, { value: "amount", label: "Net receivable", getValue: (bill) => bill.netBillAmount },
  ], defaultSortBy: "date", defaultSortDirection: "desc", resetKey: [search, siteFilter, clientFilter, statusFilter].join("|") });

  const resetClient = () => { setClientForm(createInitialClientForm()); setEditingClientId(""); };
  const resetProfile = () => setProfileForm(createInitialBillingProfileForm());
  const resetBill = () => { setBillForm(createInitialRABillForm()); setEditingBillId(""); setBoqLineItemId(""); setBoqLineQuantity(""); };
  const selectProfile = (siteId) => setBillForm((current) => ({ ...current, siteId }));

  const saveClient = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateClient(clientForm);
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      if (editingClientId) {
        await updateDoc(doc(db, "clients", editingClientId), { ...validation.value, updatedAt: serverTimestamp() });
        await logAuditEvent({ action: "update", module: "clients", recordId: editingClientId, recordLabel: validation.value.clientName, details: "Client profile updated.", site: "" });
        setFeedback("Client updated.");
      } else {
        const reference = doc(collection(db, "clients"));
        const batch = writeBatch(db);
        batch.set(reference, { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await batch.commit();
        const audit = await logAuditEvent({ action: "create", module: "clients", recordId: reference.id, recordLabel: validation.value.clientName, details: "Client profile created.", site: "" });
        setFeedback(audit.success ? "Client added." : getAuditFailureMessage());
      }
      resetClient();
    } catch (error) { console.error("Client save error:", error); setFeedback("Client could not be saved."); }
    finally { setSaving(false); }
  };

  const chooseProfileClient = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    setProfileForm((current) => ({ ...current, clientId, clientName: client?.clientName || "" }));
  };
  const chooseProfileSite = (siteId) => {
    const site = sites.find((item) => item.id === siteId);
    setProfileForm((current) => ({ ...current, siteId, siteName: site?.siteName || site?.name || site?.site || "" }));
  };
  const saveProfile = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateBillingProfile(profileForm);
    if (!validation.isValid) { setFeedback(validation.error); return; }
    const existing = profiles.find((profile) => profile.id === validation.value.siteId);
    try {
      setSaving(true); setFeedback("");
      const profileReference = doc(db, "siteBillingProfiles", validation.value.siteId);
      await writeBatch(db).set(profileReference, {
        ...validation.value,
        advanceAdjusted: existing?.advanceAdjusted || 0, certifiedWorkValue: existing?.certifiedWorkValue || 0,
        lastCertifiedBillId: existing?.lastCertifiedBillId || "", createdBy: existing?.createdBy || user?.uid || "",
        ...(existing ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp(),
      }, { merge: true }).commit();
      const audit = await logAuditEvent({ action: existing ? "update" : "create", module: "siteBillingProfiles", recordId: validation.value.siteId, recordLabel: validation.value.agreementNumber, details: "Site client billing profile saved.", site: validation.value.siteName });
      setFeedback(audit.success ? "Site billing profile saved." : getAuditFailureMessage());
      resetProfile();
    } catch (error) { console.error("Billing profile save error:", error); setFeedback("Billing profile could not be saved."); }
    finally { setSaving(false); }
  };
  const saveRABill = async (event) => {
    event.preventDefault();
    if (!canWrite || saving) return;
    const profile = profiles.find((item) => item.id === billForm.siteId || item.siteId === billForm.siteId);
    const validation = validateRABill({ form: billForm, profile });
    const boqValidation = validateBoqBillingLines({ lines: billForm.boqLineItems, progressRows: boqProgressRows, existingBillId: editingBillId });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    if (!boqValidation.isValid) { setFeedback(boqValidation.error); return; }
    const billPayload = { ...validation.value, boqLineItems: boqValidation.value };
    try {
      setSaving(true); setFeedback("");
      if (editingBillId) {
        const existing = bills.find((item) => item.id === editingBillId);
        if (!existing || existing.status !== "Draft") { setFeedback("Only draft RA bills can be edited."); return; }
        await updateDoc(doc(db, "raBills", editingBillId), { ...billPayload, raBillNumber: existing.raBillNumber, updatedAt: serverTimestamp() });
        await logAuditEvent({ action: "update", module: "raBills", recordId: editingBillId, recordLabel: existing.raBillNumber, details: `Draft RA bill updated.${boqValidation.value.length ? ` ${boqValidation.value.length} BOQ quantity line(s) linked.` : ""}`, site: validation.value.site });
        setFeedback("Draft RA bill updated.");
      } else {
        const raBillNumber = buildRABillNumber(bills);
        const billReference = doc(db, "raBills", raBillNumber);
        await runTransaction(db, async (transaction) => {
          const existing = await transaction.get(billReference);
          if (existing.exists()) throw new Error("A bill with this generated number already exists. Please try again.");
          transaction.set(billReference, { ...billPayload, raBillNumber, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        const audit = await logAuditEvent({ action: "create", module: "raBills", recordId: billReference.id, recordLabel: raBillNumber, details: `Draft RA bill created.${boqValidation.value.length ? ` ${boqValidation.value.length} BOQ quantity line(s) linked.` : ""}`, site: validation.value.site });
        setFeedback(audit.success ? "Draft RA bill created." : getAuditFailureMessage());
      }
      resetBill();
    } catch (error) { console.error("RA bill save error:", error); setFeedback("RA bill could not be saved."); }
    finally { setSaving(false); }
  };

  const changeBillStatus = async (bill, status) => {
    if (!canWrite || saving || !canTransitionRABill(bill.status, status)) return;
    if (!window.confirm(`Change ${bill.raBillNumber} to ${status}?`)) return;
    try {
      setSaving(true); setFeedback("");
      if (status === "Certified") {
        const profile = profiles.find((item) => item.id === bill.siteId || item.siteId === bill.siteId);
        if (!profile) { setFeedback("A site billing profile is required before certification."); return; }
        const invoiceReference = doc(db, "invoices", `RA-${bill.id}`);
        const invoice = invoices.find((item) => item.id === invoiceReference.id);
        if (invoice || bill.linkedInvoiceId) { setFeedback("This RA bill is already linked to an invoice."); return; }
        const batch = writeBatch(db);
        const paid = 0;
        const pending = normaliseMoney(bill.netBillAmount);
        batch.update(doc(db, "raBills", bill.id), { status: "Certified", linkedInvoiceId: invoiceReference.id, certifiedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        batch.update(doc(db, "siteBillingProfiles", profile.id), {
          advanceAdjusted: normaliseMoney(profile.advanceAdjusted) + normaliseMoney(bill.advanceAdjustment),
          certifiedWorkValue: normaliseMoney(profile.certifiedWorkValue) + normaliseMoney(bill.grossWorkValue),
          lastCertifiedBillId: bill.id, updatedAt: serverTimestamp(),
        });
        batch.set(invoiceReference, {
          invoiceNo: bill.raBillNumber, site: bill.site, clientName: bill.clientName, clientId: bill.clientId,
          invoiceDate: bill.billDate, dueDate: bill.paymentDueDate,
          description: `Certified running-account bill ${bill.raBillNumber}`,
          totalAmount: pending, amount: pending, paidAmount: paid, pendingAmount: pending, status: "Pending",
          sourceType: "raBill", raBillId: bill.id, lastClientReceiptId: "", createdBy: user?.uid || "",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        await batch.commit();
        const audit = await logAuditEvent({ action: "update", module: "raBills", recordId: bill.id, recordLabel: bill.raBillNumber, details: "RA bill certified and one canonical income invoice created.", site: bill.site });
        setFeedback(audit.success ? "RA bill certified and linked invoice created." : getAuditFailureMessage());
      } else {
        await updateDoc(doc(db, "raBills", bill.id), { status, updatedAt: serverTimestamp() });
        const audit = await logAuditEvent({ action: "update", module: "raBills", recordId: bill.id, recordLabel: bill.raBillNumber, details: `RA bill status changed to ${status}.`, site: bill.site });
        setFeedback(audit.success ? `RA bill marked ${status}.` : getAuditFailureMessage());
      }
    } catch (error) { console.error("RA bill status error:", error); setFeedback("RA bill status could not be updated."); }
    finally { setSaving(false); }
  };

  const recordReceipt = async (event) => {
    event.preventDefault();
    if (!canWrite || saving) return;
    const selectedBill = bills.find((item) => item.id === receiptForm.raBillId);
    const preliminary = validateClientReceipt({ bill: selectedBill, ...receiptForm });
    if (!preliminary.isValid) { setFeedback(preliminary.error); return; }
    if (!preliminary.value.linkedInvoiceId) { setFeedback("Certify the RA bill before recording a client receipt."); return; }
    try {
      setSaving(true); setFeedback("");
      const receiptReference = doc(db, "clientReceipts", preliminary.value.receiptKey);
      let committedReceipt;
      let committedBill;
      await runTransaction(db, async (transaction) => {
        const existingReceipt = await transaction.get(receiptReference);
        const billSnapshot = await transaction.get(doc(db, "raBills", selectedBill.id));
        if (existingReceipt.exists()) throw new Error("This receipt has already been recorded.");
        if (!billSnapshot.exists()) throw new Error("The RA bill is no longer available.");
        const currentBill = { id: billSnapshot.id, ...billSnapshot.data() };
        const currentValidation = validateClientReceipt({ bill: currentBill, ...receiptForm });
        if (!currentValidation.isValid || !currentValidation.value.linkedInvoiceId) throw new Error("The receipt no longer matches the current pending receivable.");
        const invoiceReference = doc(db, "invoices", currentValidation.value.linkedInvoiceId);
        const invoiceSnapshot = await transaction.get(invoiceReference);
        if (!invoiceSnapshot.exists()) throw new Error("The linked income invoice is unavailable.");
        const invoice = invoiceSnapshot.data();
        const newPaid = normaliseMoney(invoice.paidAmount) + currentValidation.value.creditedAmount;
        const newPending = Math.max(0, normaliseMoney(invoice.totalAmount || invoice.amount) - newPaid);
        transaction.set(receiptReference, { ...currentValidation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        transaction.update(doc(db, "raBills", currentBill.id), { ...currentValidation.value.billUpdate, lastReceiptId: receiptReference.id, updatedAt: serverTimestamp() });
        transaction.update(invoiceReference, { paidAmount: newPaid, pendingAmount: newPending, status: getInvoiceStatus(newPaid, newPending), lastClientReceiptId: receiptReference.id, updatedAt: serverTimestamp() });
        committedReceipt = currentValidation.value;
        committedBill = currentBill;
      });
      const audit = await logAuditEvent({ action: "create", module: "clientReceipts", recordId: receiptReference.id, recordLabel: committedBill.raBillNumber, details: `Client receipt credited ${formatMoney(committedReceipt.creditedAmount)}.`, site: committedBill.site });
      setFeedback(audit.success ? "Client receipt recorded." : getAuditFailureMessage());
      setReceiptForm(initialReceipt());
    } catch (error) { console.error("Client receipt error:", error); setFeedback("Client receipt could not be recorded. Refresh the pending balance and try again."); }
    finally { setSaving(false); }
  };

  const recordRetentionRelease = async (event) => {
    event.preventDefault();
    if (!canWrite || saving) return;
    const selectedBill = bills.find((item) => item.id === releaseForm.raBillId);
    const preliminary = validateRetentionRelease({ bill: selectedBill, ...releaseForm });
    if (!preliminary.isValid) { setFeedback(preliminary.error); return; }
    try {
      setSaving(true); setFeedback("");
      const releaseReference = doc(collection(db, "raRetentionReleases"));
      let committedRelease;
      let committedBill;
      await runTransaction(db, async (transaction) => {
        const billSnapshot = await transaction.get(doc(db, "raBills", selectedBill.id));
        if (!billSnapshot.exists()) throw new Error("The RA bill is no longer available.");
        const currentBill = { id: billSnapshot.id, ...billSnapshot.data() };
        const currentValidation = validateRetentionRelease({ bill: currentBill, ...releaseForm });
        if (!currentValidation.isValid) throw new Error("The retention balance has changed.");
        transaction.set(releaseReference, { ...currentValidation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        transaction.update(doc(db, "raBills", currentBill.id), { ...currentValidation.value.billUpdate, lastRetentionReleaseId: releaseReference.id, updatedAt: serverTimestamp() });
        committedRelease = currentValidation.value;
        committedBill = currentBill;
      });
      const audit = await logAuditEvent({ action: "create", module: "raRetentionReleases", recordId: releaseReference.id, recordLabel: committedBill.raBillNumber, details: `Retention released ${formatMoney(committedRelease.amount)}.`, site: committedBill.site });
      setFeedback(audit.success ? "Retention release recorded." : getAuditFailureMessage());
      setReleaseForm(initialRelease());
    } catch (error) { console.error("Retention release error:", error); setFeedback("Retention release could not be recorded. Refresh the retention balance and try again."); }
    finally { setSaving(false); }
  };
  const editClient = (client) => { if (!canWrite) return; setClientForm({ ...createInitialClientForm(), ...client }); setEditingClientId(client.id); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const editBill = (bill) => {
    if (!canWrite || bill.status !== "Draft") return;
    setBillForm({ ...createInitialRABillForm(), ...bill }); setEditingBillId(bill.id); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setFormValue = (setter, field) => (event) => setter((current) => ({ ...current, [field]: event.target.value }));
  const addBoqBillingLine = () => {
    const item = billableBoqRows.find((row) => row.itemId === boqLineItemId);
    if (!item || !boqLineQuantity) { setFeedback("Select a BOQ item and positive current billed quantity."); return; }
    setBillForm((current) => ({ ...current, boqLineItems: [...(Array.isArray(current.boqLineItems) ? current.boqLineItems : []), { boqItemId: item.itemId, currentBilledQuantity: boqLineQuantity }] }));
    setBoqLineItemId(""); setBoqLineQuantity("");
  };

  return (
    <Layout>
      <main className="procurement-page">
        <PrintBrandHeader title="Client Billing & Running Account Bills" />
        <section className="procurement-hero">
          <div><p className="eyebrow">Client receivables</p><h1>Client Billing & RA Bills</h1><p>Certified RA bills create one linked invoice. The existing invoices collection remains the only income and receivables source.</p></div>
          <span className="procurement-pill">{canWrite ? "Billing control" : "Read only"}</span>
        </section>

        {feedback && <div className="procurement-feedback" role="status">{feedback}</div>}
        <section className="procurement-kpis" aria-label="Client billing summary">
          <article><span>Total Billing</span><strong>{formatMoney(billingSummary.totalClientBilling)}</strong><small>Canonical invoices</small></article>
          <article><span>Received</span><strong>{formatMoney(billingSummary.totalReceived)}</strong><small>Cash and recorded TDS credits</small></article>
          <article><span>Outstanding</span><strong>{formatMoney(billingSummary.outstandingReceivable)}</strong><small>Pending invoice receivables</small></article>
          <article><span>Retention</span><strong>{formatMoney(billingSummary.retentionReceivable)}</strong><small>Held against certified RA work</small></article>
          <article><span>Overdue / pending</span><strong>{formatMoney(billingSummary.overdueReceivable)}</strong><small>{billingSummary.pendingCertificationCount} bill(s) awaiting certification</small></article>
        </section>

        {loading ? <section className="procurement-card"><p>Loading client billing data…</p></section> : <>
          {canWrite && <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>{editingClientId ? "Update Client" : "Client Master"}</h2><p>Maintain the client details used by each site billing profile.</p></div></div>
            <form className="procurement-form-grid" onSubmit={saveClient}>
              <label>Client / Company name *<input value={clientForm.clientName} onChange={setFormValue(setClientForm, "clientName")} required /></label>
              <label>Contact person<input value={clientForm.contactPerson} onChange={setFormValue(setClientForm, "contactPerson")} /></label>
              <label>Mobile<input inputMode="numeric" value={clientForm.mobile} onChange={setFormValue(setClientForm, "mobile")} /></label>
              <label>Email<input type="email" value={clientForm.email} onChange={setFormValue(setClientForm, "email")} /></label>
              <label>GSTIN<input value={clientForm.gstin} onChange={setFormValue(setClientForm, "gstin")} /></label>
              <label>PAN<input value={clientForm.panNumber} onChange={setFormValue(setClientForm, "panNumber")} /></label>
              <label>Status<select value={clientForm.status} onChange={setFormValue(setClientForm, "status")}>{CLIENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label className="procurement-span-two">Billing address<textarea value={clientForm.billingAddress} onChange={setFormValue(setClientForm, "billingAddress")} /></label>
              <label className="procurement-span-two">Notes<textarea value={clientForm.notes} onChange={setFormValue(setClientForm, "notes")} /></label>
              <div className="procurement-actions"><button disabled={saving} type="submit">{saving ? "Saving…" : editingClientId ? "Update Client" : "Save Client"}</button>{editingClientId && <button type="button" className="secondary" onClick={resetClient}>Cancel</button>}</div>
            </form>
            <div className="procurement-table-wrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Mobile</th><th>Status</th><th>Action</th></tr></thead><tbody>{clients.length ? clients.map((client) => <tr key={client.id}><td>{client.clientName}</td><td>{client.contactPerson || "—"}</td><td>{client.mobile || "—"}</td><td>{client.status || "active"}</td><td><button type="button" className="table-action" onClick={() => editClient(client)}>Edit</button></td></tr>) : <tr><td colSpan="5">No client profiles yet.</td></tr>}</tbody></table></div>
          </section>}

          {canWrite && <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>Site Billing Profile</h2><p>One protected profile per site establishes the agreement, client advance, GST and retention terms.</p></div></div>
            <form className="procurement-form-grid" onSubmit={saveProfile}>
              <label>Site *<select value={profileForm.siteId} onChange={(event) => chooseProfileSite(event.target.value)} required><option value="">Select site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.siteName || site.name || site.site}</option>)}</select></label>
              <label>Client *<select value={profileForm.clientId} onChange={(event) => chooseProfileClient(event.target.value)} required><option value="">Select client</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}</select></label>
              <label>Agreement / work order no. *<input value={profileForm.agreementNumber} onChange={setFormValue(setProfileForm, "agreementNumber")} required /></label>
              <label>Billing type<select value={profileForm.billingType} onChange={setFormValue(setProfileForm, "billingType")}>{BILLING_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Contract value *<input type="number" min="0" step="0.01" value={profileForm.contractValue} onChange={setFormValue(setProfileForm, "contractValue")} required /></label>
              <label>Start date *<input type="date" value={profileForm.startDate} onChange={setFormValue(setProfileForm, "startDate")} required /></label>
              <label>Completion date *<input type="date" value={profileForm.completionDate} onChange={setFormValue(setProfileForm, "completionDate")} required /></label>
              <label>GST applicable<select value={profileForm.gstApplicable} onChange={setFormValue(setProfileForm, "gstApplicable")}><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label>GST rate %<input type="number" min="0" max="100" step="0.01" value={profileForm.gstRate} onChange={setFormValue(setProfileForm, "gstRate")} /></label>
              <label>Retention %<input type="number" min="0" max="100" step="0.01" value={profileForm.retentionPercent} onChange={setFormValue(setProfileForm, "retentionPercent")} /></label>
              <label>Security deposit<input type="number" min="0" step="0.01" value={profileForm.securityDeposit} onChange={setFormValue(setProfileForm, "securityDeposit")} /></label>
              <label>Client advance received<input type="number" min="0" step="0.01" value={profileForm.advanceReceived} onChange={setFormValue(setProfileForm, "advanceReceived")} /></label>
              <label className="procurement-span-two">Payment terms<textarea value={profileForm.paymentTerms} onChange={setFormValue(setProfileForm, "paymentTerms")} /></label>
              <label className="procurement-span-two">Remarks<textarea value={profileForm.remarks} onChange={setFormValue(setProfileForm, "remarks")} /></label>
              <div className="procurement-actions"><button disabled={saving} type="submit">{saving ? "Saving…" : "Save Billing Profile"}</button><button type="button" className="secondary" onClick={resetProfile}>Clear</button></div>
            </form>
            <div className="procurement-table-wrap"><table><thead><tr><th>Site</th><th>Client</th><th>Agreement</th><th>Contract</th><th>Certified work</th><th>Advance balance</th></tr></thead><tbody>{profiles.length ? profiles.map((profile) => <tr key={profile.id}><td>{profile.siteName}</td><td>{profile.clientName}</td><td>{profile.agreementNumber}</td><td>{formatMoney(profile.contractValue)}</td><td>{formatMoney(profile.certifiedWorkValue)}</td><td>{formatMoney(normaliseMoney(profile.advanceReceived) - normaliseMoney(profile.advanceAdjusted))}</td></tr>) : <tr><td colSpan="6">No site billing profiles yet.</td></tr>}</tbody></table></div>
          </section>}

          {canWrite && <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>{editingBillId ? "Update Draft RA Bill" : "Create RA Bill"}</h2><p>Only the certification action creates a linked, canonical income invoice.</p></div></div>
            <form className="procurement-form-grid" onSubmit={saveRABill}>
              <label>Billing site *<select value={billForm.siteId} onChange={(event) => selectProfile(event.target.value)} required><option value="">Select site billing profile</option>{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.siteName} — {profile.agreementNumber}</option>)}</select></label>
              <label>Client<input value={selectedProfile?.clientName || ""} readOnly /></label>
              <label>Billing period from *<input type="date" value={billForm.billingPeriodFrom} onChange={setFormValue(setBillForm, "billingPeriodFrom")} required /></label>
              <label>Billing period to *<input type="date" value={billForm.billingPeriodTo} onChange={setFormValue(setBillForm, "billingPeriodTo")} required /></label>
              <label>Bill date *<input type="date" value={billForm.billDate} onChange={setFormValue(setBillForm, "billDate")} required /></label>
              <label>Payment due date *<input type="date" value={billForm.paymentDueDate} onChange={setFormValue(setBillForm, "paymentDueDate")} required /></label>
              <label>Current work value *<input type="number" min="0" step="0.01" value={billForm.currentWorkValue} onChange={setFormValue(setBillForm, "currentWorkValue")} required /></label>
              <label>Variation amount<input type="number" min="0" step="0.01" value={billForm.variationAmount} onChange={setFormValue(setBillForm, "variationAmount")} /></label>
              <label>Material advance recovery<input type="number" min="0" step="0.01" value={billForm.materialAdvanceRecovery} onChange={setFormValue(setBillForm, "materialAdvanceRecovery")} /></label>
              <label>Client advance adjustment<input type="number" min="0" step="0.01" value={billForm.advanceAdjustment} onChange={setFormValue(setBillForm, "advanceAdjustment")} /></label>
              <label>Other deductions<input type="number" min="0" step="0.01" value={billForm.otherDeductions} onChange={setFormValue(setBillForm, "otherDeductions")} /></label>
              <label>TDS %<input type="number" min="0" max="100" step="0.01" value={billForm.tdsPercent} onChange={setFormValue(setBillForm, "tdsPercent")} /></label>
              <div className="procurement-line-items procurement-span-two"><div className="procurement-line-heading"><h3>Optional BOQ billing lines</h3><span>Quantity tracking only — it does not alter the canonical RA bill value.</span></div><div className="procurement-line-row"><label>BOQ item<select value={boqLineItemId} onChange={(event) => setBoqLineItemId(event.target.value)}><option value="">Select site BOQ item</option>{billableBoqRows.map((item) => <option key={item.itemId} value={item.itemId}>{item.itemNumber} · balance {item.authorizedQuantity - item.billedQuantity} {item.unit}</option>)}</select></label><label>Current billed quantity<input type="number" min="0.001" step="0.001" value={boqLineQuantity} onChange={(event) => setBoqLineQuantity(event.target.value)} /></label><button className="procurement-secondary" type="button" onClick={addBoqBillingLine}>Add line</button></div>{(Array.isArray(billForm.boqLineItems) ? billForm.boqLineItems : []).map((line, index) => { const item = boqProgressRows.find((row) => row.itemId === line.boqItemId); return <div className="procurement-line-row" key={`${line.boqItemId}-${index}`}><span>{item?.itemNumber || line.boqItemId}<small>{item?.description || ""}</small></span><span>{line.currentBilledQuantity} {item?.unit || ""}<small>{formatMoney(Number(line.currentBilledQuantity || 0) * Number(item?.rate || 0))}</small></span><button className="procurement-text-button danger" type="button" onClick={() => setBillForm((current) => ({ ...current, boqLineItems: current.boqLineItems.filter((_, lineIndex) => lineIndex !== index) }))}>Remove</button></div>; })}</div>
              <label className="procurement-span-two">Remarks<textarea value={billForm.remarks} onChange={setFormValue(setBillForm, "remarks")} /></label>
              {calculatedBill && <div className="procurement-callout procurement-span-two"><strong>RA bill calculation</strong><span>Gross work: {formatMoney(calculatedBill.grossWorkValue)} · GST: {formatMoney(calculatedBill.gstAmount)} · Retention: {formatMoney(calculatedBill.retentionAmount)} · TDS: {formatMoney(calculatedBill.tdsAmount)} · Recoveries: {formatMoney(calculatedBill.recoveries)} · Net receivable: {formatMoney(calculatedBill.netBillAmount)}</span></div>}
              <div className="procurement-actions"><button disabled={saving} type="submit">{saving ? "Saving…" : editingBillId ? "Update Draft" : "Save Draft"}</button>{editingBillId && <button type="button" className="secondary" onClick={resetBill}>Cancel</button>}</div>
            </form>
          </section>}
          <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>RA Bill Register</h2><p>Draft → Submitted → Certified → received. Certification creates the only linked income invoice.</p></div></div>
            <DataTableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search RA no., site, client…"
              table={billTable}
            >
              <label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All sites</option>{siteNames.map((site) => <option key={site} value={site}>{site}</option>)}</select></label>
              <label><span>Client</span><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.clientName || "Unnamed client"}</option>)}</select></label>
              <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{RA_BILL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            </DataTableToolbar>
            <div className="procurement-table-wrap"><table><thead><tr><th>RA Bill</th><th>Site / Client</th><th>Bill / Due</th><th>Net receivable</th><th>Received / Pending</th><th>Retention</th><th>Status</th>{canWrite && <th>Actions</th>}</tr></thead><tbody>
              {billTable.count > 0 ? billTable.rows.map((bill) => <tr key={bill.id}>
                <td><strong>{bill.raBillNumber}</strong><br /><small>{bill.agreementNumber}</small></td><td>{bill.site}<br /><small>{bill.clientName}</small></td><td>{bill.billDate}<br /><small>Due: {bill.paymentDueDate}</small></td>
                <td>{formatMoney(bill.netBillAmount)}</td><td>{formatMoney(bill.receivedAmount)}<br /><small>Pending: {formatMoney(bill.pendingAmount)}</small></td><td>{formatMoney(bill.retentionBalance)}</td><td><span className={`procurement-status status-${String(bill.status || "draft").toLowerCase().replace(/\s+/g, "-")}`}>{bill.status}</span></td>
                {canWrite && <td className="procurement-row-actions">
                  {bill.status === "Draft" && <><button className="table-action" type="button" onClick={() => editBill(bill)}>Edit</button><button className="table-action" type="button" disabled={saving} onClick={() => changeBillStatus(bill, "Submitted")}>Submit</button></>}
                  {bill.status === "Submitted" && <><button className="table-action" type="button" disabled={saving} onClick={() => changeBillStatus(bill, "Certified")}>Certify</button><button className="table-action" type="button" disabled={saving} onClick={() => changeBillStatus(bill, "Rejected")}>Reject</button></>}
                  {(["Draft", "Submitted"].includes(bill.status)) && <button className="table-action danger" type="button" disabled={saving} onClick={() => changeBillStatus(bill, "Cancelled")}>Cancel</button>}
                </td>}
              </tr>) : <tr><td colSpan={canWrite ? "8" : "7"}>No RA bills match the selected filters.</td></tr>}
            </tbody></table></div>
            <DataTablePagination table={billTable} />
          </section>

          {canWrite && <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>Record Client Receipt</h2><p>Cash receipt and recorded TDS credit update the linked canonical invoice once.</p></div></div>
            <form className="procurement-form-grid" onSubmit={recordReceipt}>
              <label>Certified RA bill *<select value={receiptForm.raBillId} onChange={setFormValue(setReceiptForm, "raBillId")} required><option value="">Select pending RA bill</option>{billableReceipts.map((bill) => <option key={bill.id} value={bill.id}>{bill.raBillNumber} — {bill.site} ({formatMoney(bill.pendingAmount)})</option>)}</select></label>
              <label>Receipt date *<input type="date" value={receiptForm.receiptDate} onChange={setFormValue(setReceiptForm, "receiptDate")} required /></label>
              <label>Cash amount *<input type="number" min="0.01" step="0.01" value={receiptForm.amount} onChange={setFormValue(setReceiptForm, "amount")} required /></label>
              <label>TDS credit<input type="number" min="0" step="0.01" value={receiptForm.tdsDeducted} onChange={setFormValue(setReceiptForm, "tdsDeducted")} /></label>
              <label>Payment mode *<select value={receiptForm.paymentMode} onChange={setFormValue(setReceiptForm, "paymentMode")}>{RECEIPT_PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
              <label>Reference / cheque no.<input value={receiptForm.reference} onChange={setFormValue(setReceiptForm, "reference")} /></label>
              <label className="procurement-span-two">Remarks<textarea value={receiptForm.remarks} onChange={setFormValue(setReceiptForm, "remarks")} /></label>
              <div className="procurement-actions"><button disabled={saving || !billableReceipts.length} type="submit">{saving ? "Saving…" : "Record Receipt"}</button></div>
            </form>
          </section>}

          {canWrite && <section className="procurement-card">
            <div className="procurement-card-heading"><div><h2>Retention Release</h2><p>Track retained receivables separately. A release is operational tracking and does not create income again.</p></div></div>
            <form className="procurement-form-grid" onSubmit={recordRetentionRelease}>
              <label>RA bill *<select value={releaseForm.raBillId} onChange={setFormValue(setReleaseForm, "raBillId")} required><option value="">Select RA bill with retention</option>{retentionBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.raBillNumber} — {bill.site} ({formatMoney(bill.retentionBalance)})</option>)}</select></label>
              <label>Release date *<input type="date" value={releaseForm.releaseDate} onChange={setFormValue(setReleaseForm, "releaseDate")} required /></label>
              <label>Amount *<input type="number" min="0.01" step="0.01" value={releaseForm.amount} onChange={setFormValue(setReleaseForm, "amount")} required /></label>
              <label>Payment mode *<select value={releaseForm.paymentMode} onChange={setFormValue(setReleaseForm, "paymentMode")}>{RECEIPT_PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
              <label>Reference<input value={releaseForm.reference} onChange={setFormValue(setReleaseForm, "reference")} /></label>
              <label className="procurement-span-two">Remarks<textarea value={releaseForm.remarks} onChange={setFormValue(setReleaseForm, "remarks")} /></label>
              <div className="procurement-actions"><button disabled={saving || !retentionBills.length} type="submit">{saving ? "Saving…" : "Record Retention Release"}</button></div>
            </form>
          </section>}

          <section className="procurement-grid-two">
            <article className="procurement-card"><div className="procurement-card-heading"><div><h2>Recent Receipts</h2><p>Client-payment history, including TDS credit.</p></div></div><div className="procurement-table-wrap"><table><thead><tr><th>Date</th><th>Bill</th><th>Site</th><th>Cash / TDS</th><th>Mode</th></tr></thead><tbody>{receipts.length ? receipts.slice().sort((a, b) => String(b.receiptDate).localeCompare(String(a.receiptDate))).slice(0, 8).map((item) => <tr key={item.id}><td>{item.receiptDate}</td><td>{item.raBillNumber}</td><td>{item.site}</td><td>{formatMoney(item.amount)} / {formatMoney(item.tdsDeducted)}</td><td>{item.paymentMode}</td></tr>) : <tr><td colSpan="5">No client receipts yet.</td></tr>}</tbody></table></div></article>
            <article className="procurement-card"><div className="procurement-card-heading"><div><h2>Retention History</h2><p>Released retention is tracked outside income recognition.</p></div></div><div className="procurement-table-wrap"><table><thead><tr><th>Date</th><th>Bill</th><th>Site</th><th>Amount</th><th>Mode</th></tr></thead><tbody>{retentionReleases.length ? retentionReleases.slice().sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate))).slice(0, 8).map((item) => <tr key={item.id}><td>{item.releaseDate}</td><td>{item.raBillNumber}</td><td>{item.site}</td><td>{formatMoney(item.amount)}</td><td>{item.paymentMode}</td></tr>) : <tr><td colSpan="5">No retention releases yet.</td></tr>}</tbody></table></div></article>
          </section>
        </>}
      </main>
    </Layout>
  );
}

export default ClientBilling;