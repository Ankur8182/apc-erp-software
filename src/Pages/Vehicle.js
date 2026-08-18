import React, { useEffect, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Vehicle.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

function Vehicle() {
  const [vehicles, setVehicles] = useState([]);
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

  // =========================
  // SAVE / UPDATE VEHICLE
  // =========================

  const saveVehicle = async () => {
    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
    const cleanVehicleType = vehicleType.trim();

    if (!cleanVehicleNumber || !cleanVehicleType) {
      alert("Vehicle Number aur Vehicle Type bharna zaroori hai.");
      return;
    }

    if (mobile && !/^[0-9]{10}$/.test(mobile.trim())) {
      alert("Driver Mobile Number 10 digit ka hona chahiye.");
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

    const vehicleData = {
      vehicleNumber: cleanVehicleNumber,
      vehicleType: cleanVehicleType,
      driverName: driverName.trim(),
      mobile: mobile.trim(),
      site: site.trim(),
      fuel: Number(fuel) || 0,
      status: status || "Active",
      updatedAt: serverTimestamp()
    };

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
              <label>Site Name</label>

              <input
                type="text"
                placeholder="Site Name"
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