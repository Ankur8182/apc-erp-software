import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { captureMonitoringError } from "../utils/monitoring";
import { getSiteName } from "../utils/financialReporting";
import {
  canManageInventory,
  createInitialInventoryItemForm,
  createInitialInventoryTransactionForm,
  summariseInventory,
  validateInventoryItem,
  validateInventoryTransaction,
} from "../utils/inventory";
import "../Styles/Inventory.css";

const INVENTORY_UNITS = ["Bag", "Kg", "Ton", "Piece", "Feet", "Meter", "Litre", "Nos"];

const formatQuantity = (value) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const formatStatus = (status) => {
  if (status === "out") return "Out of Stock";
  if (status === "low") return "Low Stock";
  return "Available";
};

function Inventory() {
  const { role, user } = useAuth();
  const canWrite = canManageInventory(role);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
  const [itemForm, setItemForm] = useState(createInitialInventoryItemForm);
  const [transactionForm, setTransactionForm] = useState(
    createInitialInventoryTransactionForm
  );
  const [editingItemId, setEditingItemId] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemSaving, setItemSaving] = useState(false);
  const [transactionSaving, setTransactionSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const completedCollections = new Set();
    const complete = (name) => {
      completedCollections.add(name);
      if (completedCollections.size === 5) setLoading(false);
    };

    const subscribe = (collectionName, setData) => onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        setData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoadError("");
        complete(collectionName);
      },
      (error) => {
        console.error(`${collectionName} load error:`, error);
        void captureMonitoringError(error, { module: "inventory", operation: "read" });
        setData([]);
        setLoadError("Inventory data could not be loaded. Please try again later.");
        complete(collectionName);
      }
    );

    const unsubscribeItems = subscribe("inventoryItems", setInventoryItems);
    const unsubscribeTransactions = subscribe("inventoryTransactions", setInventoryTransactions);
    const unsubscribeSites = subscribe("sites", setSites);
    const unsubscribeMaterials = subscribe("materials", setMaterials);
    const unsubscribeDpr = subscribe("dailyProgressReports", setDailyProgressReports);

    return () => {
      unsubscribeItems();
      unsubscribeTransactions();
      unsubscribeSites();
      unsubscribeMaterials();
      unsubscribeDpr();
    };
  }, []);

  const inventory = useMemo(
    () => summariseInventory(inventoryItems, inventoryTransactions, dailyProgressReports),
    [inventoryItems, inventoryTransactions, dailyProgressReports]
  );

  const filteredRows = useMemo(() => {
    const searchText = String(search || "").trim().toLowerCase();

    return inventory.rows.filter((item) => {
      const matchesSearch = !searchText || [
        item.materialName,
        getSiteName(item),
        item.unit,
        item.supplier,
        item.reference,
      ].some((value) => String(value || "").toLowerCase().includes(searchText));

      return matchesSearch &&
        (!siteFilter || getSiteName(item) === siteFilter) &&
        (!stockStatusFilter || item.status === stockStatusFilter);
    });
  }, [inventory.rows, search, siteFilter, stockStatusFilter]);

  const inventoryTable = useDataTable(filteredRows, {
    sortOptions: [
      { value: "material", label: "Material", getValue: (item) => item.materialName },
      { value: "site", label: "Site", getValue: (item) => getSiteName(item) },
      { value: "available", label: "Available Stock", getValue: (item) => item.currentStock },
      { value: "status", label: "Stock Status", getValue: (item) => item.status },
    ],
    defaultSortBy: "material",
    resetKey: `${search}|${siteFilter}|${stockStatusFilter}`,
  });

  const siteNames = useMemo(
    () => getDistinctValues([...sites, ...inventoryItems], (item) => getSiteName(item)),
    [sites, inventoryItems]
  );
  const materialNames = useMemo(
    () => getDistinctValues(materials, (item) => item.materialName || item.name),
    [materials]
  );
  const selectedTransactionItem = useMemo(
    () => inventory.rows.find((item) => item.id === transactionForm.inventoryItemId),
    [inventory.rows, transactionForm.inventoryItemId]
  );
  const recentTransactions = useMemo(
    () => [...inventoryTransactions]
      .sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")))
      .slice(0, 12),
    [inventoryTransactions]
  );

  const clearItemForm = () => {
    setEditingItemId("");
    setItemForm(createInitialInventoryItemForm());
  };

  const handleItemChange = (event) => {
    const { name, value } = event.target;
    setItemForm((current) => ({ ...current, [name]: value }));
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    if (!canWrite || itemSaving) return;

    const validation = validateInventoryItem(itemForm);
    if (!validation.isValid) {
      setFeedback(validation.error);
      return;
    }

    const itemData = validation.value;
    const itemRef = doc(db, "inventoryItems", editingItemId || itemData.itemKey);

    try {
      setItemSaving(true);
      setFeedback("");

      if (editingItemId) {
        await updateDoc(itemRef, {
          reorderLevel: itemData.reorderLevel,
          supplier: itemData.supplier,
          reference: itemData.reference,
          notes: itemData.notes,
          updatedAt: serverTimestamp(),
        });

        const auditResult = await logAuditEvent({
          action: "update",
          module: "inventoryItems",
          recordId: editingItemId,
          recordLabel: itemData.materialName,
          details: "Inventory item settings updated; opening stock was preserved.",
          site: itemData.site,
        });
        if (!auditResult.success) setFeedback(getAuditFailureMessage());
        else setFeedback("Inventory item updated.");
      } else {
        await runTransaction(db, async (transaction) => {
          const existing = await transaction.get(itemRef);
          if (existing.exists()) {
            throw new Error("An inventory item already exists for this material, site and unit.");
          }

          transaction.set(itemRef, {
            ...itemData,
            createdBy: user?.uid || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        const auditResult = await logAuditEvent({
          action: "create",
          module: "inventoryItems",
          recordId: itemData.itemKey,
          recordLabel: itemData.materialName,
          details: "Inventory item created with opening stock.",
          site: itemData.site,
        });
        if (!auditResult.success) setFeedback(getAuditFailureMessage());
        else setFeedback("Inventory item created.");
      }

      clearItemForm();
    } catch (error) {
      console.error("Inventory item save error:", error);
      void captureMonitoringError(error, { module: "inventory", operation: "write" });
      setFeedback(getUserFriendlyFirebaseError(error, "Inventory item could not be saved."));
    } finally {
      setItemSaving(false);
    }
  };

  const startItemEdit = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      materialName: item.materialName || "",
      site: getSiteName(item),
      unit: item.unit || "Bag",
      openingStock: String(item.openingStock ?? 0),
      reorderLevel: String(item.reorderLevel ?? 0),
      supplier: item.supplier || "",
      reference: item.reference || "",
      notes: item.notes || "",
    });
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTransactionChange = (event) => {
    const { name, value } = event.target;
    setTransactionForm((current) => ({ ...current, [name]: value }));
  };

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    if (!canWrite || transactionSaving || !selectedTransactionItem) return;

    const validation = validateInventoryTransaction(
      transactionForm,
      selectedTransactionItem,
      selectedTransactionItem.currentStock
    );
    if (!validation.isValid) {
      setFeedback(validation.error);
      return;
    }

    const transactionRef = doc(collection(db, "inventoryTransactions"));
    const itemRef = doc(db, "inventoryItems", selectedTransactionItem.id);

    try {
      setTransactionSaving(true);
      setFeedback("");

      await runTransaction(db, async (transaction) => {
        const itemSnapshot = await transaction.get(itemRef);
        if (!itemSnapshot.exists()) throw new Error("The selected inventory item is no longer available.");

        const liveItem = { id: itemSnapshot.id, ...itemSnapshot.data() };
        const liveAvailable = Math.max(Number(liveItem.currentStock || 0), 0);
        const liveValidation = validateInventoryTransaction(
          transactionForm,
          liveItem,
          liveAvailable
        );
        if (!liveValidation.isValid) throw new Error(liveValidation.error);

        transaction.set(transactionRef, {
          ...liveValidation.value,
          createdBy: user?.uid || "",
          createdAt: serverTimestamp(),
        });
        transaction.update(itemRef, {
          currentStock: liveAvailable + liveValidation.delta,
          lastTransactionId: transactionRef.id,
          updatedAt: serverTimestamp(),
        });
      });

      const auditResult = await logAuditEvent({
        action: "create",
        module: "inventoryTransactions",
        recordId: transactionRef.id,
        recordLabel: selectedTransactionItem.materialName,
        details: `${validation.value.transactionType} stock transaction recorded.`,
        site: selectedTransactionItem.site,
      });
      if (!auditResult.success) setFeedback(getAuditFailureMessage());
      else setFeedback("Stock transaction recorded. History is immutable.");

      setTransactionForm(createInitialInventoryTransactionForm());
    } catch (error) {
      console.error("Inventory transaction save error:", error);
      void captureMonitoringError(error, { module: "inventory", operation: "write" });
      setFeedback(getUserFriendlyFirebaseError(error, "Stock transaction could not be recorded."));
    } finally {
      setTransactionSaving(false);
    }
  };

  return (
    <Layout>
      <div className="data-page inventory-page">
        <div className="inventory-heading">
          <div>
            <h1>📦 Inventory &amp; Stock Control</h1>
            <p>Site-wise material availability. Purchase amounts and DPR updates are never used as stock movements.</p>
          </div>
        </div>

        {!canWrite && (
          <p className="read-only-notice" role="status">
            Viewer access: inventory can be viewed and filtered, but stock changes are unavailable.
          </p>
        )}

        <section className="inventory-summary-grid" aria-label="Inventory summary">
          <article><span>Total Inventory Items</span><strong>{inventory.itemCount}</strong></article>
          <article className="inventory-low-summary"><span>Low Stock</span><strong>{inventory.lowStockCount}</strong></article>
          <article className="inventory-out-summary"><span>Out of Stock</span><strong>{inventory.outOfStockCount}</strong></article>
        </section>

        {loadError && <p className="inventory-feedback inventory-feedback-error" role="alert">{loadError}</p>}
        {feedback && <p className="inventory-feedback" role="status">{feedback}</p>}

        <section className="inventory-form-card">
          <h2>{editingItemId ? "✏️ Update Inventory Settings" : "➕ Add Inventory Item"}</h2>
          <p className="inventory-helper">Opening stock is recorded once. Use an adjustment for later corrections.</p>
          <form onSubmit={handleItemSubmit}>
            <div className="inventory-form-grid">
              <label>Material <span>*</span>
                <input name="materialName" list="inventory-material-options" value={itemForm.materialName} onChange={handleItemChange} disabled={!canWrite || itemSaving || Boolean(editingItemId)} />
                <datalist id="inventory-material-options">{materialNames.map((name) => <option key={name} value={name} />)}</datalist>
              </label>
              <label>Site <span>*</span>
                <select name="site" value={itemForm.site} onChange={handleItemChange} disabled={!canWrite || itemSaving || Boolean(editingItemId)}>
                  <option value="">Select Site</option>
                  {siteNames.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}
                </select>
              </label>
              <label>Unit <span>*</span>
                <select name="unit" value={itemForm.unit} onChange={handleItemChange} disabled={!canWrite || itemSaving || Boolean(editingItemId)}>
                  {INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label>Opening Stock <span>*</span>
                <input type="number" min="0" step="0.01" name="openingStock" value={itemForm.openingStock} onChange={handleItemChange} disabled={!canWrite || itemSaving || Boolean(editingItemId)} />
              </label>
              <label>Minimum / Reorder Level <span>*</span>
                <input type="number" min="0" step="0.01" name="reorderLevel" value={itemForm.reorderLevel} onChange={handleItemChange} disabled={!canWrite || itemSaving} />
              </label>
              <label>Supplier / Reference
                <input name="supplier" value={itemForm.supplier} onChange={handleItemChange} disabled={!canWrite || itemSaving} placeholder="Supplier name" />
              </label>
              <label>Reference
                <input name="reference" value={itemForm.reference} onChange={handleItemChange} disabled={!canWrite || itemSaving} placeholder="Delivery note / reference" />
              </label>
              <label className="inventory-full-width">Notes
                <textarea name="notes" value={itemForm.notes} onChange={handleItemChange} disabled={!canWrite || itemSaving} placeholder="Optional inventory notes" />
              </label>
            </div>
            {canWrite && (
              <div className="inventory-actions">
                <button className="inventory-primary-btn" type="submit" disabled={itemSaving}>
                  {itemSaving ? "Saving..." : editingItemId ? "Update Settings" : "Save Inventory Item"}
                </button>
                {editingItemId && <button className="inventory-secondary-btn" type="button" onClick={clearItemForm} disabled={itemSaving}>Cancel</button>}
              </div>
            )}
          </form>
        </section>

        <section className="inventory-form-card">
          <h2>↕️ Record Stock Movement</h2>
          <p className="inventory-helper">Stock movements are immutable. Use a dated adjustment with a reason for corrections.</p>
          <form onSubmit={handleTransactionSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-full-width">Inventory Item <span>*</span>
                <select name="inventoryItemId" value={transactionForm.inventoryItemId} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving}>
                  <option value="">Select material and site</option>
                  {inventory.rows.map((item) => <option key={item.id} value={item.id}>{item.materialName} · {item.site} · {formatQuantity(item.currentStock)} {item.unit} available</option>)}
                </select>
              </label>
              <label>Movement <span>*</span>
                <select name="transactionType" value={transactionForm.transactionType} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving}>
                  <option value="in">Stock In / Material Received</option>
                  <option value="out">Stock Out / Material Issued</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </label>
              {transactionForm.transactionType === "adjustment" && (
                <label>Adjustment Direction <span>*</span>
                  <select name="adjustmentDirection" value={transactionForm.adjustmentDirection} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving}>
                    <option value="increase">Increase stock</option>
                    <option value="decrease">Decrease stock</option>
                  </select>
                </label>
              )}
              <label>Quantity <span>*</span>
                <input type="number" min="0.01" step="0.01" name="quantity" value={transactionForm.quantity} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving} />
              </label>
              <label>Date <span>*</span>
                <input type="date" name="date" value={transactionForm.date} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving} />
              </label>
              {transactionForm.transactionType === "adjustment" && (
                <label>Adjustment Reason <span>*</span>
                  <input name="reason" value={transactionForm.reason} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving} placeholder="Damage, count correction, return..." />
                </label>
              )}
              <label>Reference
                <input name="reference" value={transactionForm.reference} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving} placeholder="Challan, issue slip..." />
              </label>
              <label className="inventory-full-width">Notes
                <textarea name="notes" value={transactionForm.notes} onChange={handleTransactionChange} disabled={!canWrite || transactionSaving} placeholder="Optional movement notes" />
              </label>
            </div>
            {selectedTransactionItem && (
              <p className="inventory-availability-note">Available before this movement: <strong>{formatQuantity(selectedTransactionItem.currentStock)} {selectedTransactionItem.unit}</strong></p>
            )}
            {canWrite && <button className="inventory-primary-btn" type="submit" disabled={!selectedTransactionItem || transactionSaving}>{transactionSaving ? "Recording..." : "Record Stock Movement"}</button>}
          </form>
        </section>

        <section className="inventory-table-card">
          <h2>📋 Inventory Availability</h2>
          <DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search material, site, supplier..." table={inventoryTable}>
            <label><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="">All sites</option>{siteNames.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}</select></label>
            <label><span>Stock Status</span><select value={stockStatusFilter} onChange={(event) => setStockStatusFilter(event.target.value)}><option value="">All stock</option><option value="available">Available</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select></label>
          </DataTableToolbar>
          {loading ? <p className="inventory-state">Loading inventory...</p> : inventoryTable.count === 0 ? <p className="inventory-state">No inventory items match the selected filters.</p> : (
            <div className="inventory-table-responsive">
              <table className="inventory-table">
                <thead><tr><th>Material</th><th>Site</th><th>Unit</th><th>Opening</th><th>Received</th><th>Used</th><th>Available</th><th>Reorder</th><th>Status</th><th>DPR Mentions</th>{canWrite && <th>Action</th>}</tr></thead>
                <tbody>{inventoryTable.rows.map((item) => <tr key={item.id}><td><strong>{item.materialName}</strong></td><td>{item.site}</td><td>{item.unit}</td><td>{formatQuantity(item.openingStock)}</td><td>{formatQuantity(item.received)}</td><td>{formatQuantity(item.issued)}</td><td>{formatQuantity(item.currentStock)}</td><td>{formatQuantity(item.reorderLevel)}</td><td><span className={`inventory-status inventory-status-${item.status}`}>{formatStatus(item.status)}</span></td><td>{item.dprReferenceCount ? `${item.dprReferenceCount} informational` : "-"}</td>{canWrite && <td><button type="button" className="inventory-edit-btn" onClick={() => startItemEdit(item)}>Edit</button></td>}</tr>)}</tbody>
              </table>
            </div>
          )}
          <DataTablePagination table={inventoryTable} />
        </section>

        <section className="inventory-table-card">
          <h2>🕘 Recent Stock Transactions</h2>
          <p className="inventory-helper">Transactions are append-only and cannot be edited or deleted.</p>
          {recentTransactions.length === 0 ? <p className="inventory-state">No stock movements have been recorded yet.</p> : (
            <div className="inventory-table-responsive">
              <table className="inventory-table inventory-history-table">
                <thead><tr><th>Date</th><th>Material</th><th>Site</th><th>Movement</th><th>Quantity</th><th>Reason / Reference</th></tr></thead>
                <tbody>{recentTransactions.map((entry) => <tr key={entry.id}><td>{entry.date || "-"}</td><td>{entry.materialName || "-"}</td><td>{entry.site || "-"}</td><td>{entry.transactionType === "adjustment" ? `Adjustment (${entry.adjustmentDirection || "-"})` : entry.transactionType === "in" ? "Stock In" : "Stock Out"}</td><td>{formatQuantity(entry.quantity)} {entry.unit || ""}</td><td>{entry.reason || entry.reference || entry.notes || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <p className="inventory-dpr-note">DPR material entries are informational only. They are not deducted automatically because legacy DPR records may not include a reliable material quantity and unit.</p>
      </div>
    </Layout>
  );
}

export default Inventory;
