import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { canManageProcurement, createInitialVendorForm, getVendorPayableSummary, validateVendor } from "../utils/procurement";
import "../Styles/Procurement.css";

const formatMoney = (value) => `₹ ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Vendors() {
  const { role, user } = useAuth();
  const canWrite = canManageProcurement(role);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [form, setForm] = useState(createInitialVendorForm);
  const [editId, setEditId] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let pending = 2;
    const done = () => { pending -= 1; if (pending <= 0) setLoading(false); };
    const unsubscribeVendors = onSnapshot(query(collection(db, "vendors"), limit(500)), (snapshot) => {
      setVendors(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      done();
    }, () => { setFeedback("Vendors could not be loaded. Please try again."); done(); });
    const unsubscribeOrders = onSnapshot(query(collection(db, "purchaseOrders"), limit(500)), (snapshot) => {
      setPurchaseOrders(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      done();
    }, () => { setFeedback("Purchase order data could not be loaded."); done(); });
    return () => { unsubscribeVendors(); unsubscribeOrders(); };
  }, []);

  const summary = useMemo(() => vendors.reduce((total, vendor) => {
    const payable = getVendorPayableSummary(vendor, purchaseOrders);
    total.total += 1;
    total.active += String(vendor.status || "active").toLowerCase() === "active" ? 1 : 0;
    total.purchases += payable.totalPurchases;
    total.outstanding += payable.outstandingAmount;
    return total;
  }, { total: 0, active: 0, purchases: 0, outstanding: 0 }), [vendors, purchaseOrders]);

  const rows = useMemo(() => vendors.map((vendor) => ({
    ...vendor,
    payable: getVendorPayableSummary(vendor, purchaseOrders),
  })).filter((vendor) => {
    const text = `${vendor.vendorName} ${vendor.contactPerson} ${vendor.mobile} ${vendor.email} ${vendor.category}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) &&
      (!categoryFilter || vendor.category === categoryFilter) &&
      (!statusFilter || String(vendor.status || "active").toLowerCase() === statusFilter);
  }), [vendors, purchaseOrders, search, categoryFilter, statusFilter]);

  const table = useDataTable(rows, {
    sortOptions: [
      { value: "vendor", label: "Vendor", getValue: (item) => item.vendorName },
      { value: "category", label: "Category", getValue: (item) => item.category },
      { value: "outstanding", label: "Outstanding", getValue: (item) => item.payable.outstandingAmount },
    ],
    defaultSortBy: "vendor",
    resetKey: `${search}|${categoryFilter}|${statusFilter}`,
  });
  const categories = useMemo(() => getDistinctValues(vendors, (item) => item.category), [vendors]);
  const selectedPayable = useMemo(
    () => selectedVendor ? getVendorPayableSummary(selectedVendor, purchaseOrders) : null,
    [selectedVendor, purchaseOrders]
  );

  const resetForm = () => { setForm(createInitialVendorForm()); setEditId(""); };
  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canWrite || saving) return;
    const validation = validateVendor(form);
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try {
      setSaving(true); setFeedback("");
      if (editId) {
        await updateDoc(doc(db, "vendors", editId), { ...validation.value, updatedAt: serverTimestamp() });
        const audit = await logAuditEvent({ action: "update", module: "vendors", recordId: editId, recordLabel: validation.value.vendorName, details: "Vendor profile updated.", site: "" });
        setFeedback(audit.success ? "Vendor updated." : getAuditFailureMessage());
      } else {
        const reference = await addDoc(collection(db, "vendors"), { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        const audit = await logAuditEvent({ action: "create", module: "vendors", recordId: reference.id, recordLabel: validation.value.vendorName, details: "Vendor created.", site: "" });
        setFeedback(audit.success ? "Vendor added." : getAuditFailureMessage());
      }
      resetForm();
    } catch (error) {
      console.error("Vendor save error:", error);
      setFeedback("Vendor could not be saved. Please try again.");
    } finally { setSaving(false); }
  };

  const startEdit = (vendor) => {
    setEditId(vendor.id);
    setForm({ ...createInitialVendorForm(), ...vendor, openingBalance: vendor.openingBalance ?? 0 });
    setSelectedVendor(vendor);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleStatus = async (vendor) => {
    if (!canWrite || saving) return;
    const nextStatus = String(vendor.status || "active").toLowerCase() === "active" ? "inactive" : "active";
    if (!window.confirm(`Mark ${vendor.vendorName} as ${nextStatus}? Existing purchase history will be preserved.`)) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "vendors", vendor.id), { status: nextStatus, updatedAt: serverTimestamp() });
      await logAuditEvent({ action: "update", module: "vendors", recordId: vendor.id, recordLabel: vendor.vendorName, details: `Vendor marked ${nextStatus}.`, site: "" });
      setFeedback(`Vendor marked ${nextStatus}.`);
    } catch (error) { setFeedback("Vendor status could not be changed."); }
    finally { setSaving(false); }
  };

  return (
    <Layout>
      <main className="procurement-page">
        <div className="procurement-heading"><div><span>Procurement</span><h1>🤝 Vendors</h1><p>Supplier records and payable visibility. Vendor history is never hard-deleted.</p></div></div>
        <section className="procurement-summary-grid">
          <article><span>Total Vendors</span><strong>{summary.total}</strong></article>
          <article><span>Active Vendors</span><strong>{summary.active}</strong></article>
          <article><span>Total Purchases</span><strong>{formatMoney(summary.purchases)}</strong></article>
          <article><span>Outstanding</span><strong>{formatMoney(summary.outstanding)}</strong></article>
        </section>
        {feedback && <p className="procurement-feedback" role="status">{feedback}</p>}
        <section className="procurement-card">
          <h2>{editId ? "Edit Vendor" : "Add Vendor"}</h2>
          {canWrite ? <form onSubmit={handleSubmit}><div className="procurement-form-grid">
            <label>Vendor Name <b>*</b><input name="vendorName" value={form.vendorName} onChange={handleChange} disabled={saving} /></label>
            <label>Contact Person<input name="contactPerson" value={form.contactPerson} onChange={handleChange} disabled={saving} /></label>
            <label>Mobile<input name="mobile" inputMode="numeric" value={form.mobile} onChange={handleChange} disabled={saving} /></label>
            <label>Email<input name="email" type="email" value={form.email} onChange={handleChange} disabled={saving} /></label>
            <label>GST Number<input name="gstNumber" value={form.gstNumber} onChange={handleChange} disabled={saving} /></label>
            <label>PAN Number<input name="panNumber" value={form.panNumber} onChange={handleChange} disabled={saving} /></label>
            <label>Category<input name="category" value={form.category} onChange={handleChange} placeholder="Cement, Steel, Transport..." disabled={saving} /></label>
            <label>Opening Balance<input name="openingBalance" type="number" min="0" step="0.01" value={form.openingBalance} onChange={handleChange} disabled={saving} /></label>
            <label>City<input name="city" value={form.city} onChange={handleChange} disabled={saving} /></label>
            <label>State<input name="state" value={form.state} onChange={handleChange} disabled={saving} /></label>
            <label>Status<select name="status" value={form.status} onChange={handleChange} disabled={saving}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label className="procurement-full">Address<textarea name="address" value={form.address} onChange={handleChange} disabled={saving} /></label>
            <label className="procurement-full">Notes<textarea name="notes" value={form.notes} onChange={handleChange} disabled={saving} /></label>
          </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>{saving ? "Saving..." : editId ? "Update Vendor" : "Save Vendor"}</button>{editId && <button type="button" className="procurement-secondary" onClick={resetForm} disabled={saving}>Cancel</button>}</div></form> : <p className="procurement-readonly">You have read-only vendor access.</p>}
        </section>
        {selectedVendor && <section className="procurement-detail"><strong>{selectedVendor.vendorName}</strong><span>{selectedVendor.contactPerson || "No contact person"}</span><span>{selectedVendor.mobile || selectedVendor.email || "No contact details"}</span><span>{selectedVendor.address || [selectedVendor.city, selectedVendor.state].filter(Boolean).join(", ") || "Address not recorded"}</span><span>Purchases: {formatMoney(selectedPayable?.totalPurchases)}</span><span>Paid: {formatMoney(selectedPayable?.totalPaid)}</span><span>Outstanding: {formatMoney(selectedPayable?.outstandingAmount)}</span></section>}
        <section className="procurement-card"><h2>Vendor Directory</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search vendor, contact, category..." table={table}>
          <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </DataTableToolbar>
        {loading ? <p className="procurement-state">Loading vendors...</p> : table.count === 0 ? <p className="procurement-state">No vendors match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Vendor</th><th>Contact</th><th>Category</th><th>Status</th><th>Purchases</th><th>Outstanding</th><th>Action</th></tr></thead><tbody>{table.rows.map((vendor) => <tr key={vendor.id}><td><button type="button" className="procurement-link" onClick={() => setSelectedVendor(vendor)}>{vendor.vendorName}</button><small>{vendor.email || vendor.mobile || "-"}</small></td><td>{vendor.contactPerson || "-"}</td><td>{vendor.category || "-"}</td><td><span className={`procurement-status procurement-status-${vendor.status || "active"}`}>{vendor.status || "active"}</span></td><td>{formatMoney(vendor.payable.totalPurchases)}</td><td>{formatMoney(vendor.payable.outstandingAmount)}</td><td>{canWrite && <><button type="button" className="procurement-text-button" onClick={() => startEdit(vendor)}>Edit</button><button type="button" className="procurement-text-button" onClick={() => toggleStatus(vendor)}>{String(vendor.status || "active").toLowerCase() === "active" ? "Disable" : "Enable"}</button></>}</td></tr>)}</tbody></table></div>}
        <DataTablePagination table={table} /></section>
      </main>
    </Layout>
  );
}

export default Vendors;
