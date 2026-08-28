import React, { useEffect, useState } from "react";
import Layout from "../Components/Layout";
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

        alert("Vehicle successfully updated.");
      } else {
        await addDoc(
          collection(db, "vehicles"),
          {
            ...vehicleData,
            createdAt: serverTimestamp()
          }
        );

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

  const deleteVehicle = async (id, vehicleNo) => {
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
        alert("Vehicle expense successfully updated.");
      } else {
        const createdBy = auth.currentUser?.uid;

        await addDoc(collection(db, "vehicleExpenses"), {
          ...expenseData,
          ...(createdBy ? { createdBy } : {}),
          createdAt: serverTimestamp(),
        });
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

  const deleteVehicleExpense = async (id) => {
    if (!window.confirm("Kya aap is vehicle expense ko delete karna chahte hain?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "vehicleExpenses", id));
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

    return (
      (item.vehicleNumber || "")
        .toLowerCase()
        .includes(text) ||

      (item.vehicleType || "")
        .toLowerCase()
        .includes(text) ||

      (item.driverName || "")
        .toLowerCase()
        .includes(text) ||

      (item.mobile || "")
        .toLowerCase()
        .includes(text) ||

      (item.site || "")
        .toLowerCase()
        .includes(text) ||

      (item.status || "")
        .toLowerCase()
        .includes(text)
    );
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

      return (
        vehicleMatched &&
        siteMatched &&
        typeMatched &&
        isDateInRange(item, historyFromDate, historyToDate)
      );
    })
    .sort((first, second) =>
      normaliseDate(second.date).localeCompare(normaliseDate(first.date))
    );

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

      <div className="vehicle-page">

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
              {filteredVehicleExpenses.length} Records
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
                {filteredVehicleExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-record">
                      No Vehicle Expense Record Found
                    </td>
                  </tr>
                ) : (
                  filteredVehicleExpenses.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
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
                          onClick={() => deleteVehicleExpense(item.id)}
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
        </div>


        {/* ========================= */}
        {/* SEARCH */}
        {/* ========================= */}

        <div className="page-card search-card">

          <input
            type="text"
            className="search-box"
            placeholder="🔍 Search Vehicle Number, Driver, Site..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <div className="search-result">
            Showing {filteredVehicles.length} of {totalVehicles}
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
              {filteredVehicles.length} Records
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

                {filteredVehicles.length === 0 ? (

                  <tr>
                    <td
                      colSpan="9"
                      className="no-record"
                    >
                      🚚 No Vehicle Record Found
                    </td>
                  </tr>

                ) : (

                  filteredVehicles.map(
                    (item, index) => (

                      <tr key={item.id}>

                        <td>
                          {index + 1}
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
                                item.vehicleNumber
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

        </div>

      </div>

    </Layout>
  );
}

export default Vehicle;
