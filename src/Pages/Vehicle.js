import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import "../Styles/Vehicle.css";

import { auth, db } from "../firebase";
import {
  getSiteName,
  isDateInRange,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "../utils/financialReporting";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

const expenseTypes = [
  "Fuel",
  "Maintenance",
  "Repair",
  "Driver Payment",
  "Toll",
  "Insurance",
  "Other",
];

function Vehicle() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [search, setSearch] = useState("");
  const [vehicleSiteFilter, setVehicleSiteFilter] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [mobile, setMobile] = useState("");
  const [site, setSite] = useState("");
  const [fuel, setFuel] = useState("");
  const [status, setStatus] = useState("Active");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [expenseVehicleId, setExpenseVehicleId] = useState("");
  const [expenseSite, setExpenseSite] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseRemarks, setExpenseRemarks] = useState("");
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);

  const [historyVehicleFilter, setHistoryVehicleFilter] = useState("all");
  const [historySiteFilter, setHistorySiteFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");

  // =========================
  // LOAD VEHICLES - REAL TIME
  // =========================

  useEffect(() => {
    const vehicleRef = collection(db, "vehicles");

    const unsubscribe = onSnapshot(
      vehicleRef,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setVehicles(data);
      },
      (error) => {
        console.error("Firestore Vehicle Error:", error);
        alert("Vehicle data load nahi ho saka.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicleExpenses"),
      (snapshot) => {
        setVehicleExpenses(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => {
        console.error("Firestore vehicle expense error:", error);
        alert("Vehicle expense history load nahi ho saka.");
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setVehicleNumber("");
    setVehicleType("");
    setDriverName("");
    setMobile("");
    setSite("");
    setFuel("");
    setStatus("Active");
    setEditId(null);
  };

  const clearExpenseForm = () => {
    setExpenseVehicleId("");
    setExpenseSite("");
    setExpenseDate("");
    setExpenseType("");
    setExpenseAmount("");
    setExpenseRemarks("");
    setExpenseEditId(null);
  };

  // =========================
  // SAVE / UPDATE VEHICLE
  // =========================

  const saveVehicle = async () => {
    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
    const cleanVehicleType = vehicleType.trim();
    const fuelAmount = Number(fuel || 0);

    if (!cleanVehicleNumber || !cleanVehicleType || !site.trim()) {
      alert("Vehicle Number, Vehicle Type aur Site bharna zaroori hai.");
      return;
    }

    if (mobile && !/^[0-9]{10}$/.test(mobile.trim())) {
      alert("Driver Mobile Number 10 digit ka hona chahiye.");
      return;
    }

    if (!Number.isFinite(fuelAmount) || fuelAmount < 0) {
      alert("Fuel Cost valid non-negative number hona chahiye.");
      return;
    }

    const duplicateVehicle = vehicles.find(
      (item) =>
        item.vehicleNumber?.toLowerCase() ===
          cleanVehicleNumber.toLowerCase() &&
        item.id !== editId
    );

    if (duplicateVehicle) {
      alert("Ye Vehicle Number pehle se system me available hai.");
      return;
    }

    const currentVehicle = editId
      ? vehicles.find((item) => item.id === editId)
      : null;

    const vehicleData = {
      vehicleNumber: cleanVehicleNumber,
      vehicleType: cleanVehicleType,
      driverName: driverName.trim(),
      mobile: mobile.trim(),
      site: site.trim(),
      fuel: fuelAmount,
      status: status || "Active",
      updatedAt: serverTimestamp()
    };

    if (!currentVehicle || Number(currentVehicle.fuel || 0) !== fuelAmount) {
      vehicleData.fuelUpdatedAt = serverTimestamp();
    }

    try {
      setLoading(true);

      if (editId) {
        await updateDoc(
          doc(db, "vehicles", editId),
          vehicleData
        );

        const auditResult = await logAuditEvent({
          action: "update",
          module: "vehicle",
          recordId: editId,
          recordLabel: vehicleData.vehicleNumber,
          details: "Vehicle record updated.",
          site: vehicleData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Vehicle successfully updated.");
      } else {
        const vehicleReference = await addDoc(
          collection(db, "vehicles"),
          {
            ...vehicleData,
            createdAt: serverTimestamp()
          }
        );

        const auditResult = await logAuditEvent({
          action: "create",
          module: "vehicle",
          recordId: vehicleReference.id,
          recordLabel: vehicleData.vehicleNumber,
          details: "Vehicle record created.",
          site: vehicleData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Vehicle successfully saved.");
      }

      clearForm();
    } catch (error) {
      console.error("Vehicle Error:", error);

      alert(
        "Vehicle save nahi hua. Firebase connection check karein."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EDIT VEHICLE
  // =========================

  const editVehicle = (item) => {
    setVehicleNumber(item.vehicleNumber || "");
    setVehicleType(item.vehicleType || "");
    setDriverName(item.driverName || "");
    setMobile(item.mobile || "");
    setSite(item.site || "");
    setFuel(item.fuel ?? "");
    setStatus(item.status || "Active");

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // =========================
  // DELETE VEHICLE
  // =========================

  const deleteVehicle = async (id, vehicleNo, record = {}) => {
    const hasExpenseHistory = vehicleExpenses.some(
      (expense) =>
        expense.vehicleId === id ||
        String(expense.vehicleNumber || "").trim().toLowerCase() ===
          String(vehicleNo || "").trim().toLowerCase()
    );

    if (hasExpenseHistory) {
      alert("Vehicle expense history pehle remove karein, phir vehicle delete karein.");
      return;
    }

    const confirmDelete = window.confirm(
      `Kya aap vehicle "${vehicleNo}" ko delete karna chahte hain?`
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(
        doc(db, "vehicles", id)
      );

      const auditResult = await logAuditEvent({
        action: "delete",
        module: "vehicle",
        recordId: id,
        recordLabel: vehicleNo,
        details: "Vehicle record deleted.",
        site: record.site,
      });
      if (!auditResult.success) alert(getAuditFailureMessage());

      alert("Vehicle successfully deleted.");

      if (editId === id) {
        clearForm();
      }
    } catch (error) {
      console.error("Delete Vehicle Error:", error);

      alert("Vehicle delete nahi hua.");
    }
  };

  const selectExpenseVehicle = (selectedVehicleId) => {
    setExpenseVehicleId(selectedVehicleId);

    const selectedVehicle = vehicles.find(
      (item) => item.id === selectedVehicleId
    );

    if (selectedVehicle) {
      setExpenseSite(getSiteName(selectedVehicle));
    }
  };

  const saveVehicleExpense = async () => {
    const selectedVehicle = vehicles.find(
      (item) => item.id === expenseVehicleId
    );
    const cleanSite = normaliseSiteName(expenseSite);
    const normalisedExpenseDate = normaliseDate(expenseDate);
    const amount = Number(expenseAmount);

    if (!selectedVehicle || !cleanSite || !normalisedExpenseDate || !expenseType) {
      alert("Vehicle, Site, Date aur Expense Type bharna zaroori hai.");
      return;
    }

    if (normalisedExpenseDate !== expenseDate) {
      alert("Valid expense date select karein.");
      return;
    }

    if (!expenseTypes.includes(expenseType)) {
      alert("Valid expense type select karein.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Expense amount 0 se zyada valid number hona chahiye.");
      return;
    }

    const expenseData = {
      vehicleId: selectedVehicle.id,
      vehicleNumber: String(selectedVehicle.vehicleNumber || "").trim(),
      vehicleName: String(
        selectedVehicle.vehicleType || selectedVehicle.vehicleNumber || ""
      ).trim(),
      site: cleanSite,
      date: normalisedExpenseDate,
      expenseType,
      amount: normaliseMoney(amount),
      remarks: expenseRemarks.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      setExpenseLoading(true);

      if (expenseEditId) {
        await updateDoc(
          doc(db, "vehicleExpenses", expenseEditId),
          expenseData
        );
        const auditResult = await logAuditEvent({
          action: "update",
          module: "vehicleExpenses",
          recordId: expenseEditId,
          recordLabel: expenseData.vehicleNumber || expenseData.vehicleName,
          details: `${expenseData.expenseType} vehicle expense updated.`,
          site: expenseData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());
        alert("Vehicle expense successfully updated.");
      } else {
        const createdBy = auth.currentUser?.uid;

        const vehicleExpenseReference = await addDoc(collection(db, "vehicleExpenses"), {
          ...expenseData,
          ...(createdBy ? { createdBy } : {}),
          createdAt: serverTimestamp(),
        });
        const auditResult = await logAuditEvent({
          action: "create",
          module: "vehicleExpenses",
          recordId: vehicleExpenseReference.id,
          recordLabel: expenseData.vehicleNumber || expenseData.vehicleName,
          details: `${expenseData.expenseType} vehicle expense created.`,
          site: expenseData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());
        alert("Vehicle expense successfully saved.");
      }

      clearExpenseForm();
    } catch (error) {
      console.error("Save vehicle expense error:", error);
      alert("Vehicle expense save nahi hua. Firebase connection/rules check karein.");
    } finally {
      setExpenseLoading(false);
    }
  };

  const editVehicleExpense = (item) => {
    setExpenseVehicleId(item.vehicleId || "");
    setExpenseSite(getSiteName(item));
    setExpenseDate(normaliseDate(item.date));
    setExpenseType(item.expenseType || "");
    setExpenseAmount(item.amount ?? "");
    setExpenseRemarks(item.remarks || "");
    setExpenseEditId(item.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteVehicleExpense = async (id, record = {}) => {
    if (!window.confirm("Kya aap is vehicle expense ko delete karna chahte hain?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "vehicleExpenses", id));
      const auditResult = await logAuditEvent({
        action: "delete",
        module: "vehicleExpenses",
        recordId: id,
        recordLabel: record.vehicleNumber || record.vehicleName,
        details: `${record.expenseType || "Vehicle"} expense deleted.`,
        site: getSiteName(record),
      });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert("Vehicle expense successfully deleted.");

      if (expenseEditId === id) {
        clearExpenseForm();
      }
    } catch (error) {
      console.error("Delete vehicle expense error:", error);
      alert("Vehicle expense delete nahi hua.");
    }
  };

  // =========================
  // SEARCH
  // =========================

  const filteredVehicles = vehicles.filter((item) => {
    const text = search.toLowerCase().trim();
    const searchMatched = [item.vehicleNumber, item.vehicleType, item.driverName, item.mobile, item.site, item.status]
      .some((value) => String(value || "").toLowerCase().includes(text));

    return searchMatched &&
      (!vehicleSiteFilter || item.site === vehicleSiteFilter) &&
      (!vehicleStatusFilter || item.status === vehicleStatusFilter);
  });

  const expenseSites = Array.from(
    new Set(
      [...vehicles, ...vehicleExpenses]
        .map((item) => getSiteName(item))
        .filter(Boolean)
    )
  ).sort((first, second) => first.localeCompare(second));

  const filteredVehicleExpenses = vehicleExpenses
    .filter((item) => {
      const historySearchText = historySearch.toLowerCase().trim();
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id === historyVehicleFilter
      );
      const vehicleMatched =
        historyVehicleFilter === "all" ||
        item.vehicleId === historyVehicleFilter ||
        (selectedVehicle &&
          String(item.vehicleNumber || "").trim().toLowerCase() ===
            String(selectedVehicle.vehicleNumber || "").trim().toLowerCase());
      const siteMatched =
        historySiteFilter === "all" ||
        getSiteName(item).toLowerCase() === historySiteFilter.toLowerCase();
      const typeMatched =
        historyTypeFilter === "all" || item.expenseType === historyTypeFilter;
      const searchMatched = [item.vehicleNumber, item.vehicleName, getSiteName(item), item.expenseType, item.remarks]
        .some((value) => String(value || "").toLowerCase().includes(historySearchText));

      return (
        vehicleMatched &&
        siteMatched &&
        typeMatched &&
        searchMatched &&
        isDateInRange(item, historyFromDate, historyToDate)
      );
    });

  const vehicleSortOptions = useMemo(
    () => [
      { value: "number", label: "Vehicle number", getValue: (item) => item.vehicleNumber },
      { value: "type", label: "Vehicle type", getValue: (item) => item.vehicleType },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "fuel", label: "Fuel / day", getValue: (item) => item.fuel },
      { value: "status", label: "Status", getValue: (item) => item.status },
    ],
    []
  );
  const vehicleTable = useDataTable(filteredVehicles, {
    sortOptions: vehicleSortOptions,
    defaultSortBy: "number",
    resetKey: `${search}|${vehicleSiteFilter}|${vehicleStatusFilter}`,
  });
  const vehicleExpenseSortOptions = useMemo(
    () => [
      { value: "date", label: "Date", getValue: (item) => normaliseDate(item.date) },
      { value: "vehicle", label: "Vehicle", getValue: (item) => item.vehicleNumber || item.vehicleName },
      { value: "site", label: "Site", getValue: (item) => getSiteName(item) },
      { value: "type", label: "Expense type", getValue: (item) => item.expenseType },
      { value: "amount", label: "Amount", getValue: (item) => normaliseMoney(item.amount) },
    ],
    []
  );
  const vehicleExpenseTable = useDataTable(filteredVehicleExpenses, {
    sortOptions: vehicleExpenseSortOptions,
    defaultSortBy: "date",
    defaultSortDirection: "desc",
    resetKey: `${historySearch}|${historyVehicleFilter}|${historySiteFilter}|${historyTypeFilter}|${historyFromDate}|${historyToDate}`,
  });
  const vehicleSites = useMemo(() => getDistinctValues(vehicles, (item) => item.site), [vehicles]);
  const vehicleStatuses = useMemo(() => getDistinctValues(vehicles, (item) => item.status), [vehicles]);

  // =========================
  // SUMMARY
  // =========================

  const totalVehicles = vehicles.length;

  const activeVehicles = vehicles.filter(
    (item) => item.status === "Active"
  ).length;

  const inactiveVehicles = vehicles.filter(
    (item) => item.status === "Inactive"
  ).length;

  const maintenanceVehicles = vehicles.filter(
    (item) => item.status === "Maintenance"
  ).length;

  const getStatusClass = (vehicleStatus) => {
    if (vehicleStatus === "Active") {
      return "status-active";
    }

    if (vehicleStatus === "Inactive") {
      return "status-inactive";
    }

    if (vehicleStatus === "Maintenance") {
      return "status-maintenance";
    }

    return "";
  };

  return (
    <Layout title="🚚 Vehicle Management">

      <div className="data-page vehicle-page">

        {/* ========================= */}
        {/* FORM */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">

          <div className="vehicle-card-header">
            <div>
              <h2>
                🚚 {editId
                  ? "Update Vehicle"
                  : "Add Vehicle"}
              </h2>

              <p>
                Vehicle details aur daily fuel information manage karein
              </p>
              <p className="form-helper">Fields marked with * are required.</p>
            </div>

            {editId && (
              <span className="edit-mode-badge">
                ✏️ Edit Mode
              </span>
            )}
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>Vehicle Number *</label>

              <input
                type="text"
                placeholder="UP32 AB 1234"
                value={vehicleNumber}
                onChange={(e) =>
                  setVehicleNumber(
                    e.target.value.toUpperCase()
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Vehicle Type *</label>

              <input
                type="text"
                placeholder="Pickup / Truck / JCB"
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Driver Name</label>

              <input
                type="text"
                placeholder="Driver Name"
                value={driverName}
                onChange={(e) =>
                  setDriverName(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Driver Mobile</label>

              <input
                type="tel"
                maxLength="10"
                placeholder="10 Digit Mobile Number"
                value={mobile}
                onChange={(e) =>
                  setMobile(
                    e.target.value.replace(/\D/g, "")
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Site Name *</label>

              <input
                type="text"
                placeholder="Site Name *"
                value={site}
                onChange={(e) =>
                  setSite(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Fuel / Day (₹)</label>

              <input
                type="number"
                min="0"
                placeholder="Daily Fuel Cost"
                value={fuel}
                onChange={(e) =>
                  setFuel(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Vehicle Status</label>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >
                <option value="Active">
                  🟢 Active
                </option>

                <option value="Inactive">
                  🔴 Inactive
                </option>

                <option value="Maintenance">
                  🛠️ Maintenance
                </option>
              </select>
            </div>

          </div>

          <div className="vehicle-action-buttons">

            <button
              className="save-btn"
              onClick={saveVehicle}
              disabled={loading}
            >
              {loading
                ? "⏳ Saving..."
                : editId
                ? "✏️ Update Vehicle"
                : "💾 Save Vehicle"
              }
            </button>

            {editId && (
              <button
                className="cancel-btn"
                onClick={clearForm}
              >
                ❌ Cancel
              </button>
            )}

          </div>

        </div>


        {/* ========================= */}
        {/* VEHICLE EXPENSE HISTORY */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">

          <div className="vehicle-card-header">
            <div>
              <h2>
                💳 {expenseEditId
                  ? "Update Vehicle Expense"
                  : "Add Vehicle Expense"}
              </h2>

              <p>
                Fuel aur vehicle costs ko date ke saath record karein
              </p>
              <p className="form-helper">Fields marked with * are required.</p>
            </div>

            {expenseEditId && (
              <span className="edit-mode-badge">
                ✏️ Edit Mode
              </span>
            )}
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>Vehicle *</label>

              <select
                value={expenseVehicleId}
                onChange={(event) => selectExpenseVehicle(event.target.value)}
              >
                <option value="">Select Vehicle</option>
                {vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.vehicleNumber || item.vehicleType || item.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Site *</label>

              <select
                value={expenseSite}
                onChange={(event) => setExpenseSite(event.target.value)}
              >
                <option value="">Select Site</option>
                {expenseSites.map((siteName) => (
                  <option key={siteName} value={siteName}>
                    {siteName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Expense Date *</label>

              <input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Expense Type *</label>

              <select
                value={expenseType}
                onChange={(event) => setExpenseType(event.target.value)}
              >
                <option value="">Select Expense Type</option>
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Amount (₹) *</label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Expense Amount"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>

              <input
                type="text"
                placeholder="Optional remarks"
                value={expenseRemarks}
                onChange={(event) => setExpenseRemarks(event.target.value)}
              />
            </div>

          </div>

          <div className="vehicle-action-buttons">
            <button
              className="save-btn"
              onClick={saveVehicleExpense}
              disabled={expenseLoading}
            >
              {expenseLoading
                ? "⏳ Saving..."
                : expenseEditId
                ? "✏️ Update Expense"
                : "💾 Save Expense"}
            </button>

            {expenseEditId && (
              <button
                className="cancel-btn"
                onClick={clearExpenseForm}
              >
                ❌ Cancel
              </button>
            )}
          </div>

        </div>


        {/* ========================= */}
        {/* EXPENSE FILTERS */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">
          <div className="vehicle-card-header">
            <div>
              <h2>🔎 Vehicle Expense History</h2>
              <p>Vehicle, site, date aur type ke hisaab se filter karein</p>
            </div>

            <span className="record-count">
              {vehicleExpenseTable.count} Records
            </span>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Vehicle</label>
              <select
                value={historyVehicleFilter}
                onChange={(event) => setHistoryVehicleFilter(event.target.value)}
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.vehicleNumber || item.vehicleType || item.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Site</label>
              <select
                value={historySiteFilter}
                onChange={(event) => setHistorySiteFilter(event.target.value)}
              >
                <option value="all">All Sites</option>
                {expenseSites.map((siteName) => (
                  <option key={siteName} value={siteName}>
                    {siteName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Expense Type</label>
              <select
                value={historyTypeFilter}
                onChange={(event) => setHistoryTypeFilter(event.target.value)}
              >
                <option value="all">All Expense Types</option>
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>From Date</label>
              <input
                type="date"
                value={historyFromDate}
                onChange={(event) => setHistoryFromDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>To Date</label>
              <input
                type="date"
                value={historyToDate}
                onChange={(event) => setHistoryToDate(event.target.value)}
              />
            </div>
          </div>
        </div>


        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>🧾 Vehicle Expense Records</h2>
              <p>New dated expenses are the preferred reporting source</p>
            </div>
          </div>

          <DataTableToolbar
            search={historySearch}
            onSearchChange={setHistorySearch}
            searchPlaceholder="Search vehicle, site, type or remarks..."
            table={vehicleExpenseTable}
          />

          <div className="table-responsive">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {vehicleExpenseTable.count === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-record">
                      No Vehicle Expense Record Found
                    </td>
                  </tr>
                ) : (
                  vehicleExpenseTable.rows.map((item, index) => (
                    <tr key={item.id}>
                      <td>{vehicleExpenseTable.startIndex + index + 1}</td>
                      <td>{normaliseDate(item.date) || "-"}</td>
                      <td>{item.vehicleNumber || item.vehicleName || "-"}</td>
                      <td>{getSiteName(item) || "-"}</td>
                      <td>{item.expenseType || "-"}</td>
                      <td className="fuel-amount">
                        ₹ {normaliseMoney(item.amount).toLocaleString("en-IN")}
                      </td>
                      <td>{item.remarks || "-"}</td>
                      <td className="action-cell">
                        <button
                          className="edit-btn"
                          onClick={() => editVehicleExpense(item)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deleteVehicleExpense(item.id, item)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataTablePagination table={vehicleExpenseTable} />
        </div>


        {/* ========================= */}
        {/* SEARCH */}
        {/* ========================= */}

        <div className="page-card search-card">

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search vehicle number, driver, site..."
            table={vehicleTable}
          >
            <label>
              <span>Site</span>
              <select value={vehicleSiteFilter} onChange={(event) => setVehicleSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {vehicleSites.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {vehicleStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </DataTableToolbar>

          <div className="search-result">
            Showing {vehicleTable.count} of {totalVehicles}
          </div>

        </div>


        {/* ========================= */}
        {/* SUMMARY */}
        {/* ========================= */}

        <div className="vehicle-summary-grid">

          <div className="summary-card">
            <span className="summary-icon">
              🚚
            </span>

            <div>
              <p>Total Vehicles</p>
              <h2>{totalVehicles}</h2>
            </div>
          </div>

          <div className="summary-card active-card">
            <span className="summary-icon">
              🟢
            </span>

            <div>
              <p>Active Vehicles</p>
              <h2>{activeVehicles}</h2>
            </div>
          </div>

          <div className="summary-card inactive-card">
            <span className="summary-icon">
              🔴
            </span>

            <div>
              <p>Inactive Vehicles</p>
              <h2>{inactiveVehicles}</h2>
            </div>
          </div>

          <div className="summary-card maintenance-card">
            <span className="summary-icon">
              🛠️
            </span>

            <div>
              <p>Maintenance</p>
              <h2>{maintenanceVehicles}</h2>
            </div>
          </div>

        </div>


        {/* ========================= */}
        {/* TABLE */}
        {/* ========================= */}

        <div className="table-card">

          <div className="table-header">
            <div>
              <h2>📋 Vehicle Records</h2>
              <p>All registered vehicles</p>
            </div>

            <span className="record-count">
              {vehicleTable.count} Records
            </span>
          </div>

          <div className="table-responsive">

            <table className="vehicle-table">

              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Vehicle No.</th>
                  <th>Type</th>
                  <th>Driver</th>
                  <th>Mobile</th>
                  <th>Site</th>
                  <th>Fuel/Day</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {vehicleTable.count === 0 ? (

                  <tr>
                    <td
                      colSpan="9"
                      className="no-record"
                    >
                      🚚 No Vehicle Record Found
                    </td>
                  </tr>

                ) : (

                  vehicleTable.rows.map(
                    (item, index) => (

                      <tr key={item.id}>

                        <td>
                          {vehicleTable.startIndex + index + 1}
                        </td>

                        <td className="vehicle-number">
                          {item.vehicleNumber || "-"}
                        </td>

                        <td>
                          {item.vehicleType || "-"}
                        </td>

                        <td>
                          {item.driverName || "-"}
                        </td>

                        <td>
                          {item.mobile || "-"}
                        </td>

                        <td>
                          {item.site || "-"}
                        </td>

                        <td className="fuel-amount">
                          ₹ {Number(item.fuel || 0).toLocaleString("en-IN")}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "-"}
                          </span>
                        </td>

                        <td className="action-cell">

                          <button
                            className="edit-btn"
                            onClick={() =>
                              editVehicle(item)
                            }
                          >
                            ✏️ Edit
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() =>
                              deleteVehicle(
                                item.id,
                                item.vehicleNumber,
                                item
                              )
                            }
                          >
                            🗑️ Delete
                          </button>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

          <DataTablePagination table={vehicleTable} />

        </div>

      </div>

    </Layout>
  );
}

export default Vehicle;
