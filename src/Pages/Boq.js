import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getSiteName } from "../utils/financialReporting";
import { BOQ_STATUSES, BOQ_UNITS, DIMENSION_TYPES, buildBoqAlerts, canManageBoq, createInitialBoqItemForm, createInitialMeasurementForm, createInitialVariationForm, getBoqItemProgressRows, getSiteBoqSummary, validateBoqItem, validateMeasurement, validateVariation } from "../utils/boqReporting";
import "../Styles/Procurement.css";

const money = (value) => "₹ " + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const rows = (snapshot) => (Array.isArray(snapshot?.docs) ? snapshot.docs : []).map((record) => ({ id: record.id, ...(record.data() || {}) }));
const statusClass = (value) => String(value || "Draft").toLowerCase().replace(/\s+/g, "-");

function Boq() {
  const { role, user } = useAuth();
  const canWrite = canManageBoq(role);
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [variations, setVariations] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [itemForm, setItemForm] = useState(createInitialBoqItemForm);
  const [measurementForm, setMeasurementForm] = useState(createInitialMeasurementForm);
  const [variationForm, setVariationForm] = useState(createInitialVariationForm);
  const [editId, setEditId] = useState("");
  const [filters, setFilters] = useState({ search: "", site: "", category: "", status: "", completion: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const sources = [["sites", setSites], ["boqItems", setItems], ["boqMeasurements", setMeasurements], ["boqVariations", setVariations], ["raBills", setRaBills], ["workOrders", setWorkOrders]];
    let pending = sources.length;
    const done = () => { pending -= 1; if (!pending) setLoading(false); };
    const unsubscribers = sources.map(([name, setter]) => onSnapshot(query(collection(db, name)), (snapshot) => { setter(rows(snapshot)); done(); }, () => { setFeedback(`${name} could not be loaded.`); done(); }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const siteNames = useMemo(() => getDistinctValues([...sites, ...items], (record) => getSiteName(record) || record.siteName || record.name), [sites, items]);
  const categories = useMemo(() => getDistinctValues(items, (item) => item.workCategory), [items]);
  const progressRows = useMemo(() => getBoqItemProgressRows({ items, measurements, variations, raBills }), [items, measurements, variations, raBills]);
  const summary = useMemo(() => getSiteBoqSummary({ site: filters.site, items, measurements, variations, raBills }), [filters.site, items, measurements, variations, raBills]);
  const alerts = useMemo(() => buildBoqAlerts({ items, measurements, variations, raBills }), [items, measurements, variations, raBills]);
  const selectedItem = useMemo(() => items.find((item) => item.id === measurementForm.boqItemId), [items, measurementForm.boqItemId]);
  const selectedProgress = useMemo(() => progressRows.find((item) => item.itemId === measurementForm.boqItemId), [progressRows, measurementForm.boqItemId]);
  const selectedVariation = useMemo(() => items.find((item) => item.id === variationForm.boqItemId), [items, variationForm.boqItemId]);
  const selectedVariationProgress = useMemo(() => progressRows.find((item) => item.itemId === variationForm.boqItemId), [progressRows, variationForm.boqItemId]);
  const filtered = useMemo(() => progressRows.filter((item) => {
    const text = [item.itemNumber, item.itemCode, item.workCategory, item.description, item.site].join(" ").toLowerCase();
    return (!filters.search || text.includes(filters.search.toLowerCase())) && (!filters.site || item.site === filters.site) && (!filters.category || item.workCategory === filters.category) && (!filters.status || item.status === filters.status) && (!filters.completion || (filters.completion === "complete" ? item.progressPercent >= 100 : item.progressPercent < 100));
  }), [filters, progressRows]);
  const table = useDataTable(filtered, { sortOptions: [{ value: "number", label: "Item number", getValue: (item) => item.itemNumber }, { value: "progress", label: "Progress", getValue: (item) => item.progressPercent }, { value: "balance", label: "Balance", getValue: (item) => item.balanceQuantity }, { value: "value", label: "Value", getValue: (item) => item.plannedValue }], defaultSortBy: "number", resetKey: JSON.stringify(filters) });

  const chooseSite = (setter, site) => {
    const match = sites.find((record) => getSiteName(record) === site || record.siteName === site || record.name === site);
    setter((current) => ({ ...current, site, siteId: match?.id || "" }));
  };
  const audit = async (event) => {
    const result = await logAuditEvent(event);
    return result.success ? "" : getAuditFailureMessage();
  };

  const submitItem = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateBoqItem(itemForm);
    const duplicate = items.find((item) => item.id !== editId && item.siteId === validation.value?.siteId && String(item.itemNumber || "").toLowerCase() === String(validation.value?.itemNumber || "").toLowerCase());
    if (!validation.isValid) { setFeedback(validation.error); return; }
    if (duplicate) { setFeedback("This BOQ item number already exists at the selected site."); return; }
    try {
      setSaving(true);
      if (editId) {
        const existing = items.find((item) => item.id === editId);
        const locked = measurements.some((record) => record.boqItemId === editId) || raBills.some((bill) => Array.isArray(bill.boqLineItems) && bill.boqLineItems.some((line) => line?.boqItemId === editId));
        if (!existing || existing.status !== "Draft" || locked) throw new Error("Only BOQ drafts without measurement or billing history can be edited.");
        await updateDoc(doc(db, "boqItems", editId), { ...validation.value, createdBy: existing.createdBy, createdAt: existing.createdAt, updatedAt: serverTimestamp() });
        setFeedback((await audit({ action: "update", module: "boqItems", recordId: editId, recordLabel: validation.value.itemNumber, details: "Draft BOQ item updated.", site: validation.value.site })) || "Draft BOQ item updated.");
      } else {
        const reference = await addDoc(collection(db, "boqItems"), { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setFeedback((await audit({ action: "create", module: "boqItems", recordId: reference.id, recordLabel: validation.value.itemNumber, details: "BOQ item created as a draft.", site: validation.value.site })) || "BOQ item saved as a draft.");
      }
      setEditId(""); setItemForm(createInitialBoqItemForm());
    } catch (error) { console.error("BOQ item save error:", error); setFeedback(error.message || "BOQ item could not be saved."); } finally { setSaving(false); }
  };

  const updateItemStatus = async (item, status) => {
    if (!canWrite || saving || !window.confirm(`Change ${item.itemNumber} to ${status}?`)) return;
    try { setSaving(true); await updateDoc(doc(db, "boqItems", item.id), { status, updatedAt: serverTimestamp() }); setFeedback((await audit({ action: "update", module: "boqItems", recordId: item.id, recordLabel: item.itemNumber, details: `BOQ item ${status.toLowerCase()}.`, site: item.site })) || `BOQ item ${status.toLowerCase()}.`); } catch { setFeedback("BOQ item status could not be updated."); } finally { setSaving(false); }
  };

  const submitMeasurement = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateMeasurement({ form: measurementForm, item: selectedItem, progress: selectedProgress });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try { setSaving(true); const reference = await addDoc(collection(db, "boqMeasurements"), { ...validation.value, measuredBy: user?.uid || "", createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setFeedback((await audit({ action: "create", module: "boqMeasurements", recordId: reference.id, recordLabel: validation.value.boqItemNumber, details: "Measurement recorded and pending certification.", site: validation.value.site })) || "Measurement recorded and pending certification."); setMeasurementForm(createInitialMeasurementForm()); } catch { setFeedback("Measurement could not be saved."); } finally { setSaving(false); }
  };

  const certifyMeasurement = async (measurement, status) => {
    if (!canWrite || saving || measurement.status !== "Pending" || !window.confirm(`${status} this measurement?`)) return;
    try { setSaving(true); await updateDoc(doc(db, "boqMeasurements", measurement.id), { status, certifiedBy: user?.uid || "", certifiedAt: serverTimestamp(), updatedAt: serverTimestamp() }); setFeedback((await audit({ action: "update", module: "boqMeasurements", recordId: measurement.id, recordLabel: measurement.boqItemNumber, details: `Measurement ${status.toLowerCase()}.`, site: measurement.site })) || `Measurement ${status.toLowerCase()}.`); } catch { setFeedback("Measurement status could not be updated."); } finally { setSaving(false); }
  };

  const submitVariation = async (event) => {
    event.preventDefault(); if (!canWrite || saving) return;
    const validation = validateVariation({ form: variationForm, item: selectedVariation, progress: selectedVariationProgress });
    if (!validation.isValid) { setFeedback(validation.error); return; }
    try { setSaving(true); const reference = await addDoc(collection(db, "boqVariations"), { ...validation.value, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setFeedback((await audit({ action: "create", module: "boqVariations", recordId: reference.id, recordLabel: validation.value.variationReference, details: "BOQ variation saved as a draft.", site: validation.value.site })) || "BOQ variation saved as a draft."); setVariationForm(createInitialVariationForm()); } catch { setFeedback("Variation could not be saved."); } finally { setSaving(false); }
  };

  const updateVariationStatus = async (variation, status) => {
    const allowed = (variation.status === "Draft" && status === "Submitted") || (variation.status === "Submitted" && ["Approved", "Rejected"].includes(status));
    if (!canWrite || saving || !allowed || !window.confirm(`${status} variation ${variation.variationReference}?`)) return;
    try { setSaving(true); const update = { status, updatedAt: serverTimestamp() }; if (status !== "Submitted") { update.approvedBy = user?.uid || ""; update.approvedAt = serverTimestamp(); } await updateDoc(doc(db, "boqVariations", variation.id), update); setFeedback((await audit({ action: "update", module: "boqVariations", recordId: variation.id, recordLabel: variation.variationReference, details: `Variation ${status.toLowerCase()}.`, site: variation.site })) || `Variation ${status.toLowerCase()}.`); } catch { setFeedback("Variation status could not be updated."); } finally { setSaving(false); }
  };
  const linkedWorkOrders = useMemo(() => workOrders.filter((order) => items.some((item) => item.id === order.boqItemId)), [items, workOrders]);
  const itemHistoryLocked = (item) => measurements.some((record) => record.boqItemId === item.id) || raBills.some((bill) => Array.isArray(bill.boqLineItems) && bill.boqLineItems.some((line) => line?.boqItemId === item.id));

  return <Layout><main className="procurement-page">
    <section className="procurement-hero"><div><p className="eyebrow">Commercial quantity control</p><h1>BOQ &amp; Quantity Measurement</h1><p>Measurement Book is the source for measured and certified quantities. It does not create income, cost, or an invoice.</p></div><span className="procurement-pill">{canWrite ? "Manager controls enabled" : "Read-only access"}</span></section>
    {feedback && <p className="procurement-feedback" role="status">{feedback}</p>}
    <section className="procurement-kpis"><article><span>Original BOQ Value</span><strong>{money(summary.originalBoqValue)}</strong><small>{summary.itemCount} registered item{summary.itemCount === 1 ? "" : "s"}</small></article><article><span>Revised BOQ Value</span><strong>{money(summary.revisedBoqValue)}</strong><small>{money(summary.approvedVariationValue)} approved change</small></article><article><span>Measured / Certified</span><strong>{money(summary.measuredWorkValue)}</strong><small>{money(summary.certifiedWorkValue)} certified</small></article><article><span>Overall Progress</span><strong>{summary.overallProgressPercent}%</strong><small>{summary.pendingCertificationQuantity} quantity pending certification</small></article></section>
    {alerts.length > 0 && <p className="procurement-warning">{alerts.length} BOQ control alert{alerts.length === 1 ? " requires" : "s require"} review. No financial total is changed by these alerts.</p>}

    <section className="procurement-card"><div className="procurement-card-heading"><div><h2>{editId ? "Edit BOQ Draft" : "Add BOQ Item"}</h2><p>Amount is derived from planned quantity × rate. Drafts lock once operational or billing history exists.</p></div></div>{canWrite ? <form onSubmit={submitItem}><div className="procurement-form-grid">
      <label>Site <b>*</b><input list="boq-sites" value={itemForm.site} onChange={(event) => chooseSite(setItemForm, event.target.value)} disabled={saving || Boolean(editId)} /><datalist id="boq-sites">{siteNames.map((site) => <option key={site} value={site} />)}</datalist></label>
      <label>BOQ Item Number <b>*</b><input value={itemForm.itemNumber} onChange={(event) => setItemForm((form) => ({ ...form, itemNumber: event.target.value }))} disabled={saving} /></label>
      <label>Item Code<input value={itemForm.itemCode} onChange={(event) => setItemForm((form) => ({ ...form, itemCode: event.target.value }))} disabled={saving} /></label>
      <label>Work Category<input value={itemForm.workCategory} onChange={(event) => setItemForm((form) => ({ ...form, workCategory: event.target.value }))} placeholder="Civil, finishing, electrical..." disabled={saving} /></label>
      <label>Unit <b>*</b><select value={itemForm.unit} onChange={(event) => setItemForm((form) => ({ ...form, unit: event.target.value }))} disabled={saving}>{BOQ_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <label>Planned Quantity <b>*</b><input type="number" min="0.001" step="0.001" value={itemForm.plannedQuantity} onChange={(event) => setItemForm((form) => ({ ...form, plannedQuantity: event.target.value }))} disabled={saving} /></label>
      <label>Rate <b>*</b><input type="number" min="0" step="0.01" value={itemForm.rate} onChange={(event) => setItemForm((form) => ({ ...form, rate: event.target.value }))} disabled={saving} /></label>
      <label>Status <b>*</b><input value="Draft — activate after review" readOnly aria-label="Initial BOQ status: Draft" /></label>
      <label className="procurement-full">Description <b>*</b><textarea value={itemForm.description} onChange={(event) => setItemForm((form) => ({ ...form, description: event.target.value }))} disabled={saving} /></label>
      <label className="procurement-full">Remarks<textarea value={itemForm.remarks} onChange={(event) => setItemForm((form) => ({ ...form, remarks: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>{saving ? "Saving..." : editId ? "Update Draft" : "Save BOQ Draft"}</button>{editId && <button className="procurement-secondary" type="button" onClick={() => { setEditId(""); setItemForm(createInitialBoqItemForm()); }} disabled={saving}>Cancel</button>}</div></form> : <p className="procurement-readonly">You have read-only BOQ commercial and quantity access.</p>}</section>

    {canWrite && <section className="procurement-grid-two"><section className="procurement-card"><h2>Measurement Book Entry</h2><p className="procurement-readonly">New records are append-preserved and start Pending. DPR references are optional and informational; old DPRs are never converted automatically.</p><form onSubmit={submitMeasurement}><div className="procurement-form-grid">
      <label className="procurement-span-two">BOQ Item <b>*</b><select value={measurementForm.boqItemId} onChange={(event) => { const item = items.find((record) => record.id === event.target.value); setMeasurementForm((form) => ({ ...form, boqItemId: event.target.value, siteId: item?.siteId || "", site: item?.site || "" })); }} disabled={saving}><option value="">Select active BOQ item</option>{items.filter((item) => item.status === "Active" || item.id === measurementForm.boqItemId).map((item) => <option key={item.id} value={item.id}>{item.site} · {item.itemNumber} · {item.description}</option>)}</select></label>
      <label>Date <b>*</b><input type="date" value={measurementForm.date} onChange={(event) => setMeasurementForm((form) => ({ ...form, date: event.target.value }))} disabled={saving} /></label>
      <label className="procurement-span-two">Location / Chainage / Reference <b>*</b><input value={measurementForm.location} onChange={(event) => setMeasurementForm((form) => ({ ...form, location: event.target.value }))} disabled={saving} /></label>
      <label>Method <b>*</b><select value={measurementForm.measurementType} onChange={(event) => setMeasurementForm((form) => ({ ...form, measurementType: event.target.value }))} disabled={saving}>{DIMENSION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      {measurementForm.measurementType === "Direct quantity" ? <label>Quantity <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.quantity} onChange={(event) => setMeasurementForm((form) => ({ ...form, quantity: event.target.value }))} disabled={saving} /></label> : <><label>Length <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.length} onChange={(event) => setMeasurementForm((form) => ({ ...form, length: event.target.value }))} disabled={saving} /></label>{measurementForm.measurementType !== "Count × per-unit quantity" && <label>Width <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.width} onChange={(event) => setMeasurementForm((form) => ({ ...form, width: event.target.value }))} disabled={saving} /></label>}{measurementForm.measurementType === "Volume (L × W × H)" && <label>Height / Depth <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.height} onChange={(event) => setMeasurementForm((form) => ({ ...form, height: event.target.value }))} disabled={saving} /></label>}{measurementForm.measurementType === "Count × per-unit quantity" && <><label>Count <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.count} onChange={(event) => setMeasurementForm((form) => ({ ...form, count: event.target.value }))} disabled={saving} /></label><label>Per-unit Quantity <b>*</b><input type="number" min="0.001" step="0.001" value={measurementForm.perUnitQuantity} onChange={(event) => setMeasurementForm((form) => ({ ...form, perUnitQuantity: event.target.value }))} disabled={saving} /></label></>}</>}
      <label>Related DPR ID<input value={measurementForm.dprId} onChange={(event) => setMeasurementForm((form) => ({ ...form, dprId: event.target.value }))} placeholder="Optional" disabled={saving} /></label><label className="procurement-full">Remarks<textarea value={measurementForm.remarks} onChange={(event) => setMeasurementForm((form) => ({ ...form, remarks: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>Save Measurement</button></div></form></section>
    <section className="procurement-card"><h2>Variation / Extra Item</h2><p className="procurement-readonly">Only approved variations affect authorised BOQ quantity and value. Original BOQ data remains intact.</p><form onSubmit={submitVariation}><div className="procurement-form-grid">
      <label>Site <b>*</b><input list="boq-variation-sites" value={variationForm.site} onChange={(event) => chooseSite(setVariationForm, event.target.value)} disabled={saving} /><datalist id="boq-variation-sites">{siteNames.map((site) => <option key={site} value={site} />)}</datalist></label>
      <label>Linked BOQ Item<select value={variationForm.boqItemId} onChange={(event) => { const item = items.find((record) => record.id === event.target.value); setVariationForm((form) => ({ ...form, boqItemId: event.target.value, siteId: item?.siteId || form.siteId, site: item?.site || form.site, itemCode: item?.itemCode || form.itemCode, description: item?.description || form.description, unit: item?.unit || form.unit, revisedRate: item?.rate ?? form.revisedRate })); }} disabled={saving}><option value="">Extra item</option>{items.filter((item) => !variationForm.site || item.site === variationForm.site).map((item) => <option key={item.id} value={item.id}>{item.itemNumber} · {item.description}</option>)}</select></label>
      <label>Variation Reference <b>*</b><input value={variationForm.variationReference} onChange={(event) => setVariationForm((form) => ({ ...form, variationReference: event.target.value }))} disabled={saving} /></label>
      {!variationForm.boqItemId && <><label>Item Code<input value={variationForm.itemCode} onChange={(event) => setVariationForm((form) => ({ ...form, itemCode: event.target.value }))} disabled={saving} /></label><label>Description <b>*</b><input value={variationForm.description} onChange={(event) => setVariationForm((form) => ({ ...form, description: event.target.value }))} disabled={saving} /></label><label>Unit <b>*</b><select value={variationForm.unit} onChange={(event) => setVariationForm((form) => ({ ...form, unit: event.target.value }))} disabled={saving}>{BOQ_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label></>}
      <label>Quantity Change (+ add / − reduce) <b>*</b><input type="number" step="0.001" value={variationForm.quantityChange} onChange={(event) => setVariationForm((form) => ({ ...form, quantityChange: event.target.value }))} disabled={saving} /></label><label>Authorised Rate<input type="number" min="0" step="0.01" value={variationForm.revisedRate} onChange={(event) => setVariationForm((form) => ({ ...form, revisedRate: event.target.value }))} disabled={saving} /></label><label>Initial Status <b>*</b><select value={variationForm.status} onChange={(event) => setVariationForm((form) => ({ ...form, status: event.target.value }))} disabled={saving}>{["Draft"].map((status) => <option key={status}>{status}</option>)}</select></label><label className="procurement-full">Reason <b>*</b><textarea value={variationForm.reason} onChange={(event) => setVariationForm((form) => ({ ...form, reason: event.target.value }))} disabled={saving} /></label>
    </div><div className="procurement-actions"><button className="procurement-primary" disabled={saving}>Save Variation</button></div></form></section></section>}

    <section className="procurement-card"><h2>BOQ Register &amp; Quantity Progress</h2><DataTableToolbar search={filters.search} onSearchChange={(search) => setFilters((current) => ({ ...current, search }))} searchPlaceholder="Search item number, code, category, description..." table={table}><label><span>Site</span><select value={filters.site} onChange={(event) => setFilters((current) => ({ ...current, site: event.target.value }))}><option value="">All</option>{siteNames.map((site) => <option key={site}>{site}</option>)}</select></label><label><span>Category</span><select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>Status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All</option>{BOQ_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Progress</span><select value={filters.completion} onChange={(event) => setFilters((current) => ({ ...current, completion: event.target.value }))}><option value="">All</option><option value="incomplete">Incomplete</option><option value="complete">Complete</option></select></label></DataTableToolbar>
    {loading ? <p className="procurement-state">Loading BOQ quantity records...</p> : table.count === 0 ? <p className="procurement-state">No BOQ items match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>BOQ Item</th><th>Site / Category</th><th>Planned / Authorised</th><th>Measured / Certified</th><th>Billed / Balance</th><th>Value / Progress</th><th>Status</th><th>Actions</th></tr></thead><tbody>{table.rows.map((item) => <tr key={item.id}><td><strong>{item.itemNumber}</strong><small>{item.itemCode || "No code"}</small><small>{item.description}</small></td><td>{item.site}<small>{item.workCategory || "Uncategorised"}</small></td><td>{item.plannedQuantity} {item.unit}<small>{item.authorizedQuantity} authorised</small></td><td>{item.measuredQuantity} / {item.certifiedQuantity} {item.unit}<small>{item.pendingCertificationQuantity} pending certification</small></td><td>{item.billedQuantity} {item.unit}<small>{item.balanceQuantity} remaining</small></td><td>{money(item.plannedValue)}<small>{item.progressPercent}% measured progress</small></td><td><span className={`procurement-status status-${statusClass(item.status)}`}>{item.status}</span></td><td>{canWrite && <div className="procurement-row-actions">{item.status === "Draft" && <><button type="button" className="table-action" onClick={() => { if (itemHistoryLocked(item)) setFeedback("This BOQ item has measurement or billing history. Use a variation instead."); else { setEditId(item.id); setItemForm({ ...createInitialBoqItemForm(), ...item }); } }}>Edit</button><button type="button" className="table-action" onClick={() => updateItemStatus(item, "Active")}>Activate</button></>}{item.status === "Active" && item.progressPercent >= 100 && <button type="button" className="table-action" onClick={() => updateItemStatus(item, "Completed")}>Complete</button>}</div>}</td></tr>)}</tbody></table></div>}<DataTablePagination table={table} /></section>

    <section className="procurement-grid-two"><section className="procurement-card"><h2>Measurement History</h2>{measurements.length === 0 ? <p className="procurement-state">No measurements recorded yet.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Date</th><th>BOQ Item</th><th>Location</th><th>Quantity</th><th>Status</th><th>Action</th></tr></thead><tbody>{measurements.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 30).map((record) => <tr key={record.id}><td>{record.date || "-"}</td><td>{record.boqItemNumber || record.boqItemId}<small>{record.boqItemDescription || "-"}</small></td><td>{record.location || "-"}</td><td>{record.quantity} {record.unit}</td><td><span className={`procurement-status status-${statusClass(record.status)}`}>{record.status || "Pending"}</span></td><td>{canWrite && record.status === "Pending" && <div className="procurement-row-actions"><button type="button" className="table-action" onClick={() => certifyMeasurement(record, "Certified")}>Certify</button><button type="button" className="table-action danger" onClick={() => certifyMeasurement(record, "Rejected")}>Reject</button></div>}</td></tr>)}</tbody></table></div>}</section>
    <section className="procurement-card"><h2>Variation Register</h2>{variations.length === 0 ? <p className="procurement-state">No BOQ variations recorded yet.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Reference</th><th>Site / Item</th><th>Quantity / Value</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{variations.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 30).map((record) => <tr key={record.id}><td>{record.variationReference || record.id}</td><td>{record.site}<small>{record.itemNumber || record.description || "Extra item"}</small></td><td>{record.quantityChange} {record.unit}<small>{money(record.variationValue)}</small></td><td>{record.reason || "-"}</td><td><span className={`procurement-status status-${statusClass(record.status)}`}>{record.status || "Draft"}</span></td><td>{canWrite && <div className="procurement-row-actions">{record.status === "Draft" && <button type="button" className="table-action" onClick={() => updateVariationStatus(record, "Submitted")}>Submit</button>}{record.status === "Submitted" && <><button type="button" className="table-action" onClick={() => updateVariationStatus(record, "Approved")}>Approve</button><button type="button" className="table-action danger" onClick={() => updateVariationStatus(record, "Rejected")}>Reject</button></>}</div>}</td></tr>)}</tbody></table></div>}</section></section>

    <section className="procurement-card"><h2>Linked Work Orders</h2><p className="procurement-readonly">BOQ references add quantity context only. Work-order certification and contractor expense remain their existing source of truth.</p>{linkedWorkOrders.length === 0 ? <p className="procurement-state">No work orders are linked to BOQ items.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>Work Order</th><th>Site</th><th>BOQ Item</th><th>Certified Quantity</th><th>Status</th></tr></thead><tbody>{linkedWorkOrders.map((order) => { const item = items.find((record) => record.id === order.boqItemId); return <tr key={order.id}><td>{order.workOrderNumber || order.id}</td><td>{order.site || "-"}</td><td>{item?.itemNumber || order.boqItemId}<small>{item?.description || "-"}</small></td><td>{order.progressQuantity || 0} {order.unit || ""}</td><td>{order.status || "Draft"}</td></tr>; })}</tbody></table></div>}</section>
  </main></Layout>;
}

export default Boq;