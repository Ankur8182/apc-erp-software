import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, query, runTransaction, serverTimestamp } from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { buildDocumentNumber, canManageProcurement, createGoodsReceiptKey, createInventoryStockInFromGoodsReceipt, findInventoryItemForPurchaseLine, getPurchaseOrderLine, getPurchaseOrderReceiptStatus, validateGoodsReceipt } from "../utils/procurement";
import "../Styles/Procurement.css";

const initialForm = () => ({
  purchaseOrderId: "", lineId: "", receiptDate: new Date().toISOString().slice(0, 10),
  receivedQuantity: "", acceptedQuantity: "", rejectedQuantity: "0", challanNumber: "",
  vehicleNumber: "", receivedBy: "", remarks: "",
});
const formatMoney = (value) => `₹ ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function GoodsReceipts() {
  const { role, user } = useAuth();
  const canWrite = canManageProcurement(role);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let pending = 4; const done = () => { pending -= 1; if (pending <= 0) setLoading(false); };
    const subscribe = (name, setter, message) => onSnapshot(query(collection(db, name), limit(500)), (snapshot) => { setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); done(); }, () => { setFeedback(message); done(); });
    const unOrders = subscribe("purchaseOrders", setPurchaseOrders, "Purchase orders could not be loaded.");
    const unReceipts = subscribe("goodsReceipts", setGoodsReceipts, "Goods receipt history could not be loaded.");
    const unInventory = subscribe("inventoryItems", setInventoryItems, "Inventory items could not be loaded.");
    const unSites = subscribe("sites", setSites, "Sites could not be loaded.");
    return () => { unOrders(); unReceipts(); unInventory(); unSites(); };
  }, []);

  const receivableOrders = useMemo(() => purchaseOrders.filter((order) => ["issued", "partially received"].includes(String(order.status || "").toLowerCase())), [purchaseOrders]);
  const selectedOrder = useMemo(() => purchaseOrders.find((order) => order.id === form.purchaseOrderId), [purchaseOrders, form.purchaseOrderId]);
  const selectedLine = useMemo(() => getPurchaseOrderLine(selectedOrder, form.lineId), [selectedOrder, form.lineId]);
  const selectedInventoryItem = useMemo(() => findInventoryItemForPurchaseLine(inventoryItems, selectedOrder, selectedLine), [inventoryItems, selectedOrder, selectedLine]);
  const siteNames = useMemo(() => getDistinctValues([...sites, ...purchaseOrders], (item) => item.siteName || item.site), [sites, purchaseOrders]);
  const filteredReceipts = useMemo(() => goodsReceipts.filter((receipt) => {
    const text = `${receipt.grnNumber} ${receipt.poNumber} ${receipt.vendorName} ${receipt.site} ${receipt.materialName} ${receipt.challanNumber}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!siteFilter || receipt.site === siteFilter) && (!statusFilter || String(receipt.status || "").toLowerCase() === statusFilter);
  }), [goodsReceipts, search, siteFilter, statusFilter]);
  const table = useDataTable(filteredReceipts, { sortOptions: [
    { value: "date", label: "Receipt Date", getValue: (item) => item.receiptDate },
    { value: "site", label: "Site", getValue: (item) => item.site },
    { value: "vendor", label: "Vendor", getValue: (item) => item.vendorName },
    { value: "quantity", label: "Accepted Qty", getValue: (item) => item.acceptedQuantity },
  ], defaultSortBy: "date", defaultSortDirection: "desc", resetKey: `${search}|${siteFilter}|${statusFilter}` });

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const chooseOrder = (purchaseOrderId) => setForm((current) => ({ ...current, purchaseOrderId, lineId: "", receivedQuantity: "", acceptedQuantity: "", rejectedQuantity: "0" }));
  const chooseLine = (lineId) => {
    const line = getPurchaseOrderLine(selectedOrder, lineId);
    const remaining = Math.max(Number(line?.quantity || 0) - Number(line?.receivedQuantity || 0), 0);
    setForm((current) => ({ ...current, lineId, receivedQuantity: remaining || "", acceptedQuantity: remaining || "", rejectedQuantity: "0" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); if (!canWrite || saving || !selectedOrder) return;
    const initialValidation = validateGoodsReceipt({ purchaseOrder: selectedOrder, lineId: form.lineId, receivedQuantity: form.receivedQuantity, acceptedQuantity: form.acceptedQuantity, rejectedQuantity: form.rejectedQuantity, receiptDate: form.receiptDate, challanNumber: form.challanNumber });
    if (!initialValidation.isValid) { setFeedback(initialValidation.error); return; }
    if (initialValidation.value.acceptedQuantity > 0 && !selectedInventoryItem) {
      setFeedback("Create the matching Inventory item first. GRN stock is never written outside the inventory ledger.");
      return;
    }
    const grnNumber = buildDocumentNumber("GRN", goodsReceipts);
    const receiptKey = createGoodsReceiptKey({ purchaseOrderId: selectedOrder.id, lineId: form.lineId, challanNumber: form.challanNumber, receiptDate: form.receiptDate, receivedQuantity: form.receivedQuantity, acceptedQuantity: form.acceptedQuantity, rejectedQuantity: form.rejectedQuantity });
    if (!receiptKey) { setFeedback("A valid receipt reference could not be created."); return; }
    const grnRef = doc(db, "goodsReceipts", receiptKey);
    const poRef = doc(db, "purchaseOrders", selectedOrder.id);
    const inventoryRef = selectedInventoryItem ? doc(db, "inventoryItems", selectedInventoryItem.id) : null;
    const movementRef = doc(db, "inventoryTransactions", `grn-stock-in-${receiptKey}`);
    const materialRef = doc(db, "materials", `grn-material-${receiptKey}`);
    try {
      setSaving(true); setFeedback("");
      await runTransaction(db, async (transaction) => {
        const grnSnapshot = await transaction.get(grnRef);
        if (grnSnapshot.exists()) throw new Error("This GRN number has already been processed.");
        const orderSnapshot = await transaction.get(poRef);
        if (!orderSnapshot.exists()) throw new Error("The selected purchase order is unavailable.");
        const liveOrder = { id: orderSnapshot.id, ...orderSnapshot.data() };
        if (!["issued", "partially received"].includes(String(liveOrder.status || "").toLowerCase())) throw new Error("Only issued or partially received POs can receive goods.");
        const validation = validateGoodsReceipt({ purchaseOrder: liveOrder, lineId: form.lineId, receivedQuantity: form.receivedQuantity, acceptedQuantity: form.acceptedQuantity, rejectedQuantity: form.rejectedQuantity, receiptDate: form.receiptDate, challanNumber: form.challanNumber });
        if (!validation.isValid) throw new Error(validation.error);
        const details = validation.value;
        let liveInventory = null;
        if (details.acceptedQuantity > 0) {
          const inventorySnapshot = await transaction.get(inventoryRef);
          if (!inventorySnapshot.exists()) throw new Error("The matching inventory item is unavailable. Create it before receiving goods.");
          liveInventory = { id: inventorySnapshot.id, ...inventorySnapshot.data() };
        }
        const updatedItems = (liveOrder.items || []).map((item, index) => {
          const itemLineId = item.lineId || `line-${index + 1}`;
          return itemLineId === form.lineId ? { ...item, receivedQuantity: details.updatedReceivedQuantity } : item;
        });
        const updatedOrderStatus = getPurchaseOrderReceiptStatus(updatedItems);
        const receiptLine = { ...details.line, acceptedQuantity: details.acceptedQuantity };
        const movement = details.acceptedQuantity > 0 ? createInventoryStockInFromGoodsReceipt({ goodsReceiptId: receiptKey, purchaseOrder: liveOrder, line: receiptLine, inventoryItem: liveInventory, vendorId: liveOrder.vendorId, siteId: liveOrder.siteId || "", receiptDate: details.receiptDate }) : null;
        if (movement) {
          transaction.set(movementRef, { ...movement, createdBy: user?.uid || "", createdAt: serverTimestamp() });
          transaction.update(inventoryRef, { currentStock: Math.max(Number(liveInventory.currentStock || 0), 0) + details.acceptedQuantity, lastTransactionId: movementRef.id, updatedAt: serverTimestamp() });
          // Materials is the canonical financial source for procurement cost.
          // The GRN and inventory movement are operational records only.
          transaction.set(materialRef, {
            materialName: details.line.materialName, category: "Procurement", quantity: details.acceptedQuantity,
            unit: details.line.unit, rate: Number(details.line.rate || 0), site: liveOrder.site,
            supplier: liveOrder.vendorName, billNo: details.challanNumber, date: details.receiptDate,
            totalAmount: details.receiptCost, amount: details.receiptCost, expenseAmount: details.receiptCost,
            entryType: "purchase", source: "procurement", purchaseOrderId: liveOrder.id,
            goodsReceiptId: receiptKey, vendorId: liveOrder.vendorId, materialId: details.line.materialId || "",
            inventoryTransactionId: movementRef.id, createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        transaction.update(poRef, { items: updatedItems, status: updatedOrderStatus, lastGoodsReceiptId: receiptKey, updatedAt: serverTimestamp() });
        transaction.set(grnRef, {
          receiptKey, grnNumber, status: "completed", purchaseOrderId: liveOrder.id, poNumber: liveOrder.poNumber || liveOrder.id,
          vendorId: liveOrder.vendorId || "", vendorName: liveOrder.vendorName || "", site: liveOrder.site || "", siteId: liveOrder.siteId || "",
          lineId: form.lineId, materialId: details.line.materialId || "", materialName: details.line.materialName, unit: details.line.unit,
          orderedQuantity: details.orderedQuantity, previousReceivedQuantity: details.previousReceivedQuantity,
          receivedQuantity: details.receivedQuantity, acceptedQuantity: details.acceptedQuantity, rejectedQuantity: details.rejectedQuantity,
          challanNumber: details.challanNumber, vehicleNumber: form.vehicleNumber.trim(), receivedBy: form.receivedBy.trim() || user?.email || "",
          receiptDate: details.receiptDate, remarks: form.remarks.trim(), inventoryTransactionId: movement ? movementRef.id : "",
          materialEntryId: movement ? materialRef.id : "", createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      });
      const audit = await logAuditEvent({ action: "create", module: "goodsReceipts", recordId: receiptKey, recordLabel: grnNumber, details: "GRN completed and linked inventory Stock-In recorded.", site: selectedOrder.site });
      setFeedback(audit.success ? `GRN ${grnNumber} completed.` : getAuditFailureMessage());
      setForm(initialForm());
    } catch (error) { console.error("GRN completion error:", error); setFeedback(error.message || "Goods receipt could not be completed."); }
    finally { setSaving(false); }
  };

  return <Layout><main className="procurement-page"><div className="procurement-heading"><div><span>Procurement</span><h1>📦 Goods Receipts / GRN</h1><p>Accepted material is recorded once in the inventory ledger and once as the linked procurement cost.</p></div></div>{feedback && <p className="procurement-feedback" role="status">{feedback}</p>}
    <section className="procurement-card"><h2>Complete Material Receipt</h2>{canWrite ? <form onSubmit={handleSubmit}><div className="procurement-form-grid">
      <label>Purchase Order <b>*</b><select value={form.purchaseOrderId} onChange={(event) => chooseOrder(event.target.value)} disabled={saving}><option value="">Select issued PO</option>{receivableOrders.map((order) => <option key={order.id} value={order.id}>{order.poNumber || order.id} · {order.vendorName} · {order.site}</option>)}</select></label>
      <label>Material / PO Item <b>*</b><select value={form.lineId} onChange={(event) => chooseLine(event.target.value)} disabled={!selectedOrder || saving}><option value="">Select item</option>{(selectedOrder?.items || []).map((item, index) => { const lineId = item.lineId || `line-${index + 1}`; const remaining = Math.max(Number(item.quantity || 0) - Number(item.receivedQuantity || 0), 0); return <option key={lineId} value={lineId} disabled={remaining <= 0}>{item.materialName} · {remaining} {item.unit} remaining</option>; })}</select></label>
      <label>Receipt Date <b>*</b><input type="date" value={form.receiptDate} onChange={(event) => change("receiptDate", event.target.value)} disabled={saving} /></label>
      <label>Received By<input value={form.receivedBy} onChange={(event) => change("receivedBy", event.target.value)} placeholder={user?.email || "Name"} disabled={saving} /></label>
      <label>Received Quantity <b>*</b><input type="number" min="0.01" step="0.01" value={form.receivedQuantity} onChange={(event) => change("receivedQuantity", event.target.value)} disabled={!selectedLine || saving} /></label>
      <label>Accepted Quantity <b>*</b><input type="number" min="0" step="0.01" value={form.acceptedQuantity} onChange={(event) => change("acceptedQuantity", event.target.value)} disabled={!selectedLine || saving} /></label>
      <label>Rejected Quantity <b>*</b><input type="number" min="0" step="0.01" value={form.rejectedQuantity} onChange={(event) => change("rejectedQuantity", event.target.value)} disabled={!selectedLine || saving} /></label>
      <label>Challan Number<input value={form.challanNumber} onChange={(event) => change("challanNumber", event.target.value)} disabled={saving} /></label>
      <label>Vehicle Number<input value={form.vehicleNumber} onChange={(event) => change("vehicleNumber", event.target.value)} disabled={saving} /></label>
      <label className="procurement-full">Remarks<textarea value={form.remarks} onChange={(event) => change("remarks", event.target.value)} disabled={saving} /></label>
    </div>{selectedLine && <div className="procurement-total-strip"><span>Ordered <strong>{selectedLine.quantity} {selectedLine.unit}</strong></span><span>Previously received <strong>{selectedLine.receivedQuantity || 0} {selectedLine.unit}</strong></span><span>Estimated accepted cost <strong>{formatMoney((Number(selectedLine.lineGrandTotal || 0) / Number(selectedLine.quantity || 1)) * Number(form.acceptedQuantity || 0))}</strong></span></div>}{selectedLine && !selectedInventoryItem && Number(form.acceptedQuantity || 0) > 0 && <p className="procurement-warning">Create a matching Inventory item first; GRN completion will not bypass the immutable stock ledger.</p>}<div className="procurement-actions"><button className="procurement-primary" disabled={!selectedLine || saving}>{saving ? "Completing..." : "Complete GRN"}</button></div></form> : <p className="procurement-readonly">You have read-only goods receipt access.</p>}</section>
    <section className="procurement-card"><h2>GRN History</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search GRN, PO, vendor, challan..." table={table}><label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All</option>{siteNames.map((site) => <option key={site}>{site}</option>)}</select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All</option><option value="completed">Completed</option></select></label></DataTableToolbar>
    {loading ? <p className="procurement-state">Loading GRN history...</p> : table.count === 0 ? <p className="procurement-state">No goods receipts match the current filters.</p> : <div className="procurement-table-wrap"><table><thead><tr><th>GRN / Date</th><th>PO / Vendor</th><th>Site / Material</th><th>Ordered</th><th>Received</th><th>Accepted / Rejected</th><th>Stock / Cost Link</th></tr></thead><tbody>{table.rows.map((receipt) => <tr key={receipt.id}><td><strong>{receipt.grnNumber || receipt.id}</strong><small>{receipt.receiptDate}</small></td><td>{receipt.poNumber || "-"}<small>{receipt.vendorName || "-"}</small></td><td>{receipt.site}<small>{receipt.materialName} · {receipt.unit}</small></td><td>{receipt.orderedQuantity}</td><td>{receipt.receivedQuantity}</td><td>{receipt.acceptedQuantity} / {receipt.rejectedQuantity}</td><td>{receipt.inventoryTransactionId ? "Stock-In linked" : "No accepted stock"}<small>{receipt.materialEntryId ? "Cost linked" : "No cost entry"}</small></td></tr>)}</tbody></table></div>}<DataTablePagination table={table} /></section>
  </main></Layout>;
}

export default GoodsReceipts;
