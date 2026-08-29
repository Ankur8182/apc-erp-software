import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import Layout from "../Components/Layout";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import {
  createInitialDprForm,
  DPR_UNITS,
  filterDailyProgressReports,
  sortDailyProgressReports,
  validateDailyProgressReport,
} from "../utils/dailyProgressReporting";
import { getSiteName, normaliseDate } from "../utils/financialReporting";
import "../Styles/DailyProgressReport.css";

function DailyProgressReport() {
  const { role } = useAuth();
  const [reports, setReports] = useState([]);
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [formData, setFormData] = useState(createInitialDprForm);
  const [editId, setEditId] = useState(null);
  const [viewReport, setViewReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canManage = role === "admin" || role === "manager";

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "dailyProgressReports"),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setReportsError("");
        setReportsLoading(false);
      },
      (error) => {
        console.error("DPR load error:", error);
        setReports([]);
        setReportsError("Daily Progress Report data could not be loaded.");
        setReportsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        setSites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => console.error("DPR sites load error:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "materials"),
      (snapshot) => {
        setMaterials(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => console.error("DPR materials load error:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setVehicles(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => console.error("DPR vehicles load error:", error)
    );

    return () => unsubscribe();
  }, []);

  const siteNames = useMemo(
    () => {
      const siteMap = new Map();

      [...sites, ...reports].forEach((item) => {
        const siteName = getSiteName(item);
        const siteKey = siteName.toLowerCase();

        if (siteName && !siteMap.has(siteKey)) {
          siteMap.set(siteKey, siteName);
        }
      });

      return Array.from(siteMap.values()).sort((first, second) =>
        first.localeCompare(second)
      );
    },
    [sites, reports]
  );

  const materialNames = useMemo(
    () =>
      Array.from(
        new Set(
          materials
            .map((item) => item.materialName || item.name || "")
            .filter(Boolean)
        )
      ).sort((first, second) => first.localeCompare(second)),
    [materials]
  );

  const equipmentNames = useMemo(
    () =>
      Array.from(
        new Set(
          vehicles
            .map((item) => item.vehicleNumber || item.vehicleType || "")
            .filter(Boolean)
        )
      ).sort((first, second) => first.localeCompare(second)),
    [vehicles]
  );

  const filteredReports = useMemo(
    () =>
      sortDailyProgressReports(
        filterDailyProgressReports(reports, {
          search,
          site: selectedSite,
          fromDate,
          toDate,
        })
      ),
    [reports, search, selectedSite, fromDate, toDate]
  );

  const resetForm = () => {
    setFormData(createInitialDprForm());
    setEditId(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({ ...current, [name]: value }));
  };

  const saveReport = async (event) => {
    event.preventDefault();

    if (!canManage) {
      alert("Only admin or manager can save a Daily Progress Report.");
      return;
    }

    const validation = validateDailyProgressReport(formData);

    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const reportData = {
      ...validation.value,
      updatedAt: serverTimestamp(),
    };

    try {
      setLoading(true);

      if (editId) {
        await updateDoc(doc(db, "dailyProgressReports", editId), reportData);
        alert("Daily Progress Report successfully updated.");
      } else {
        const createdBy = auth.currentUser?.uid;

        await addDoc(collection(db, "dailyProgressReports"), {
          ...reportData,
          ...(createdBy ? { createdBy } : {}),
          createdAt: serverTimestamp(),
        });
        alert("Daily Progress Report successfully saved.");
      }

      resetForm();
    } catch (error) {
      console.error("DPR save error:", error);
      alert("Daily Progress Report save nahi hua. Firebase connection/rules check karein.");
    } finally {
      setLoading(false);
    }
  };

  const editReport = (report) => {
    if (!canManage) return;

    setFormData({
      date: normaliseDate(report.date) || createInitialDprForm().date,
      site: getSiteName(report),
      workActivity: report.workActivity || "",
      workLocation: report.workLocation || "",
      quantity: report.quantity ?? "",
      unit: report.unit || "Nos",
      manpowerCount: report.manpowerCount ?? "",
      materialsUsed: report.materialsUsed || "",
      equipmentUsed: report.equipmentUsed || "",
      remarks: report.remarks || "",
    });
    setEditId(report.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteReport = async (id) => {
    if (!canManage) return;

    if (!window.confirm("Kya aap is Daily Progress Report ko delete karna chahte hain?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "dailyProgressReports", id));
      alert("Daily Progress Report successfully deleted.");

      if (editId === id) resetForm();
      if (viewReport?.id === id) setViewReport(null);
    } catch (error) {
      console.error("DPR delete error:", error);
      alert("Daily Progress Report delete nahi hua.");
    }
  };

  return (
    <Layout title="📋 Daily Progress Report">
      <div className="dpr-page">
        {canManage && (
          <div className="dpr-form-card">
            <h2>{editId ? "✏️ Edit Daily Progress Report" : "➕ Add Daily Progress Report"}</h2>

            <form onSubmit={saveReport}>
              <div className="dpr-form-grid">
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Site *</label>
                  <select name="site" value={formData.site} onChange={handleChange}>
                    <option value="">Select Site</option>
                    {siteNames.map((siteName) => (
                      <option key={siteName} value={siteName}>{siteName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Work Activity *</label>
                  <input type="text" name="workActivity" value={formData.workActivity} onChange={handleChange} placeholder="e.g. Excavation" />
                </div>

                <div className="form-group">
                  <label>Work Location *</label>
                  <input type="text" name="workLocation" value={formData.workLocation} onChange={handleChange} placeholder="e.g. Block A" />
                </div>

                <div className="form-group">
                  <label>Quantity *</label>
                  <input type="number" min="0" step="0.01" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" />
                </div>

                <div className="form-group">
                  <label>Unit *</label>
                  <select name="unit" value={formData.unit} onChange={handleChange}>
                    {DPR_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Manpower Count *</label>
                  <input type="number" min="0" step="1" name="manpowerCount" value={formData.manpowerCount} onChange={handleChange} placeholder="0" />
                </div>

                <div className="form-group">
                  <label>Materials Used</label>
                  <input type="text" name="materialsUsed" list="dpr-material-options" value={formData.materialsUsed} onChange={handleChange} placeholder="Select or enter material" />
                  <datalist id="dpr-material-options">
                    {materialNames.map((material) => <option key={material} value={material} />)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Equipment Used</label>
                  <input type="text" name="equipmentUsed" list="dpr-equipment-options" value={formData.equipmentUsed} onChange={handleChange} placeholder="Select or enter equipment" />
                  <datalist id="dpr-equipment-options">
                    {equipmentNames.map((equipment) => <option key={equipment} value={equipment} />)}
                  </datalist>
                </div>

                <div className="form-group dpr-full-width">
                  <label>Remarks</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleChange} placeholder="Optional remarks" />
                </div>
              </div>

              <div className="dpr-form-actions">
                <button className="dpr-save-btn" type="submit" disabled={loading}>
                  {loading ? "⏳ Saving..." : editId ? "✏️ Update DPR" : "💾 Save DPR"}
                </button>
                {editId && (
                  <button className="dpr-cancel-btn" type="button" onClick={resetForm}>
                    ❌ Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {viewReport && (
          <div className="dpr-view-card">
            <div className="dpr-view-header">
              <h2>👁️ DPR Details</h2>
              <button className="dpr-cancel-btn" type="button" onClick={() => setViewReport(null)}>Close</button>
            </div>
            <div className="dpr-view-grid">
              <p><strong>Date:</strong> {normaliseDate(viewReport.date) || "-"}</p>
              <p><strong>Site:</strong> {getSiteName(viewReport) || "-"}</p>
              <p><strong>Work:</strong> {viewReport.workActivity || "-"}</p>
              <p><strong>Location:</strong> {viewReport.workLocation || "-"}</p>
              <p><strong>Quantity:</strong> {viewReport.quantity ?? "-"} {viewReport.unit || ""}</p>
              <p><strong>Manpower:</strong> {viewReport.manpowerCount ?? "-"}</p>
              <p><strong>Materials:</strong> {viewReport.materialsUsed || "-"}</p>
              <p><strong>Equipment:</strong> {viewReport.equipmentUsed || "-"}</p>
              <p className="dpr-full-width"><strong>Remarks:</strong> {viewReport.remarks || "-"}</p>
            </div>
          </div>
        )}

        <div className="dpr-table-card">
          <div className="dpr-table-header">
            <div>
              <h2>📚 DPR Register</h2>
              <p>
                {reportsLoading
                  ? "Loading reports..."
                  : reportsError
                    ? "Reports unavailable"
                    : `${filteredReports.length} of ${reports.length} reports`}
              </p>
            </div>
            <input className="dpr-search" type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search work, location, material..." />
          </div>

          <div className="dpr-filter-grid">
            <select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}>
              <option value="all">All Sites</option>
              {siteNames.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="DPR From Date" />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="DPR To Date" />
          </div>

          <div className="dpr-table-wrapper">
            <table className="dpr-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Site</th>
                  <th>Work Activity</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Manpower</th>
                  <th>Materials</th>
                  <th>Equipment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reportsLoading ? (
                  <tr><td colSpan="10" className="no-dpr-data">Loading Daily Progress Reports...</td></tr>
                ) : reportsError ? (
                  <tr><td colSpan="10" className="no-dpr-data dpr-data-error">{reportsError}</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan="10" className="no-dpr-data">No Daily Progress Report Found</td></tr>
                ) : (
                  filteredReports.map((report, index) => (
                    <tr key={report.id}>
                      <td>{index + 1}</td>
                      <td>{normaliseDate(report.date) || "-"}</td>
                      <td>{getSiteName(report) || "-"}</td>
                      <td>{report.workActivity || "-"}</td>
                      <td>{report.workLocation || "-"}</td>
                      <td>{report.quantity ?? "-"} {report.unit || ""}</td>
                      <td>{report.manpowerCount ?? "-"}</td>
                      <td>{report.materialsUsed || "-"}</td>
                      <td>{report.equipmentUsed || "-"}</td>
                      <td className="dpr-action-cell">
                        <button className="dpr-view-btn" onClick={() => setViewReport(report)}>👁️ View</button>
                        {canManage && (
                          <>
                            <button className="dpr-edit-btn" onClick={() => editReport(report)}>✏️ Edit</button>
                            <button className="dpr-delete-btn" onClick={() => deleteReport(report.id)}>🗑️ Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default DailyProgressReport;
