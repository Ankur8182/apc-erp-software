import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { useAuth } from "../auth/AuthProvider";
import { ATTENDANCE_STATUSES, getAttendanceKey, nonNegativeNumber } from "../utils/payroll";
import { normaliseStatus } from "../utils/financialReporting";
import { captureMonitoringError } from "../utils/monitoring";
import "../Styles/Attendance.css";
import { db } from "../firebase";
import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

const today = () => new Date().toLocaleDateString("en-CA");

function Attendance() {
  const { role } = useAuth();
  const canWrite = ["admin", "manager"].includes(role);
  const [attendance, setAttendance] = useState([]);
  const [labours, setLabours] = useState([]);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [labourId, setLabourId] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState("Present");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [workType, setWorkType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribeAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      setAttendance(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => {
      console.error("Firestore Attendance Error:", error);
      void captureMonitoringError(error, { module: "attendance", operation: "read" });
      alert("Attendance data load nahi ho saka.");
    });
    const unsubscribeLabours = onSnapshot(collection(db, "labours"), (snapshot) => {
      setLabours(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => { console.error("Labour reference Error:", error); void captureMonitoringError(error, { module: "attendance", operation: "read" }); });
    return () => { unsubscribeAttendance(); unsubscribeLabours(); };
  }, []);

  const activeLabours = useMemo(() => labours.filter((labour) =>
    labour.active !== false && String(labour.status || "").toLowerCase() !== "inactive"
  ), [labours]);
  const selectedLabour = useMemo(() => labours.find((item) => item.id === labourId), [labours, labourId]);

  const clearForm = () => {
    setLabourId(""); setDate(today()); setStatus("Present"); setOvertimeHours("");
    setWorkType(""); setRemarks(""); setEditId("");
  };

  const saveAttendance = async () => {
    if (!selectedLabour || !date || !status) {
      alert("Labour, date aur attendance status bharna zaroori hai.");
      return;
    }
    const safeOvertime = nonNegativeNumber(overtimeHours, -1);
    if (safeOvertime < 0) {
      alert("Overtime hours zero ya usse zyada honi chahiye.");
      return;
    }
    const attendanceData = {
      labourId: selectedLabour.id,
      employeeName: String(selectedLabour.name || "").trim(),
      labourName: String(selectedLabour.name || "").trim(),
      site: String(selectedLabour.site || "").trim(),
      date,
      status,
      overtimeHours: safeOvertime,
      workType: workType.trim(),
      remarks: remarks.trim(),
      attendanceKey: getAttendanceKey({ labourId: selectedLabour.id, date }),
      updatedAt: serverTimestamp(),
    };
    const existingAttendance = attendance.find((entry) => entry.id !== editId && entry.date === date &&
      (entry.labourId === selectedLabour.id || (!entry.labourId && String(entry.employeeName || entry.labourName || "").trim().toLowerCase() === String(selectedLabour.name || "").trim().toLowerCase()))
    );
    if (existingAttendance) {
      alert("Is labour ki attendance is date ke liye pehle se recorded hai. Existing record ko edit karein.");
      return;
    }
    try {
      setLoading(true);
      let recordId = editId;
      let action = "update";
      if (editId) {
        await updateDoc(doc(db, "attendance", editId), attendanceData);
      } else {
        recordId = attendanceData.attendanceKey;
        const attendanceReference = doc(db, "attendance", recordId);
        await runTransaction(db, async (transaction) => {
          const current = await transaction.get(attendanceReference);
          if (current.exists()) throw new Error("DUPLICATE_ATTENDANCE");
          transaction.set(attendanceReference, { ...attendanceData, createdAt: serverTimestamp() });
        });
        action = "create";
      }
      const auditResult = await logAuditEvent({
        action, module: "attendance", recordId, recordLabel: attendanceData.employeeName,
        details: `${status} attendance recorded for ${date}.`, site: attendanceData.site,
      });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert(action === "create" ? "Attendance successfully saved." : "Attendance successfully updated.");
      clearForm();
    } catch (error) {
      console.error("Attendance save Error:", error);
      void captureMonitoringError(error, { module: "attendance", operation: "write" });
      alert(error.message === "DUPLICATE_ATTENDANCE"
        ? "Is labour ki attendance is date ke liye pehle se recorded hai. Existing record ko edit karein."
        : "Attendance save nahi hua. Firebase connection/rules check karein.");
    } finally { setLoading(false); }
  };

  const editAttendance = (item) => {
    const labour = labours.find((entry) => entry.id === item.labourId) || labours.find((entry) =>
      String(entry.name || "").trim().toLowerCase() === String(item.employeeName || item.labourName || "").trim().toLowerCase()
    );
    if (!labour) {
      alert("This legacy attendance record has no matching labour master. Add or select the labour master before updating it.");
      return;
    }
    setLabourId(labour.id); setDate(item.date || today()); setStatus(item.status || "Present");
    setOvertimeHours(item.overtimeHours ?? item.overtime ?? ""); setWorkType(item.workType || "");
    setRemarks(item.remarks || ""); setEditId(item.id); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteAttendance = async (item) => {
    if (!window.confirm("Delete this attendance record? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "attendance", item.id));
      const auditResult = await logAuditEvent({ action: "delete", module: "attendance", recordId: item.id, recordLabel: item.employeeName || item.labourName, details: "Attendance record deleted.", site: item.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
    } catch (error) { console.error("Delete Attendance Error:", error); void captureMonitoringError(error, { module: "attendance", operation: "write" }); alert("Attendance delete nahi hui."); }
  };

  const filteredAttendance = useMemo(() => attendance.filter((item) => {
    const text = search.toLowerCase();
    const matchesSearch = [item.employeeName, item.labourName, item.site, item.status, item.workType]
      .some((value) => String(value || "").toLowerCase().includes(text));
    return matchesSearch && (!siteFilter || item.site === siteFilter) && (!statusFilter || item.status === statusFilter);
  }), [attendance, search, siteFilter, statusFilter]);
  const attendanceTable = useDataTable(filteredAttendance, {
    sortOptions: [
      { value: "date", label: "Date", getValue: (item) => item.date },
      { value: "employee", label: "Labour", getValue: (item) => item.employeeName || item.labourName },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "status", label: "Status", getValue: (item) => item.status },
    ], defaultSortBy: "date", defaultSortDirection: "desc", resetKey: `${search}|${siteFilter}|${statusFilter}`,
  });
  const attendanceSites = useMemo(() => getDistinctValues(attendance, (item) => item.site), [attendance]);
  const attendanceStatuses = useMemo(() => getDistinctValues(attendance, (item) => item.status), [attendance]);
  const presentCount = filteredAttendance.filter((item) => normaliseStatus(item.status) === "present").length;
  const absentCount = filteredAttendance.filter((item) => normaliseStatus(item.status) === "absent").length;
  const halfDayCount = filteredAttendance.filter((item) => normaliseStatus(item.status) === "half-day").length;

  return <Layout title="📋 Attendance Management"><div className="data-page attendance-page">
    <div className="page-card"><h2>📋 {editId ? "Update Attendance" : "Mark Attendance"}</h2><p className="form-helper">One attendance record is allowed per labour per date. Fields marked with * are required.</p>
      <div className="form-grid">
        <select value={labourId} onChange={(e) => setLabourId(e.target.value)} disabled={!canWrite}><option value="">Select Labour *</option>{activeLabours.map((labour) => <option value={labour.id} key={labour.id}>{labour.name} — {labour.site || "No site"}</option>)}</select>
        <input type="text" value={selectedLabour?.site || ""} placeholder="Site" readOnly />
        <input type="date" aria-label="Attendance Date *" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canWrite} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWrite}>{ATTENDANCE_STATUSES.map((value) => <option value={value} key={value}>{value}</option>)}</select>
        <input type="number" min="0" step="0.25" placeholder="Overtime Hours" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} disabled={!canWrite} />
        <input type="text" placeholder="Work Type / Shift" value={workType} onChange={(e) => setWorkType(e.target.value)} disabled={!canWrite} />
        <input type="text" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!canWrite} />
      </div>
      <button className="save-btn" onClick={saveAttendance} disabled={loading || !canWrite}>{!canWrite ? "Read-only access" : loading ? "⏳ Saving..." : editId ? "✏️ Update Attendance" : "💾 Save Attendance"}</button>
      {editId && <button type="button" className="delete-btn" style={{ marginLeft: "10px" }} onClick={clearForm}>❌ Cancel Edit</button>}
    </div>
    <div className="page-card" style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}><div><h3>Records</h3><h2>{filteredAttendance.length}</h2></div><div><h3>Present</h3><h2>{presentCount}</h2></div><div><h3>Absent</h3><h2>{absentCount}</h2></div><div><h3>Half Days</h3><h2>{halfDayCount}</h2></div></div>
    <div className="table-card"><h2>📊 Attendance Records</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search labour, site, status or work..." table={attendanceTable}>
      <label><span>Site</span><select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}><option value="">All sites</option>{attendanceSites.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{attendanceStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </DataTableToolbar><div className="table-responsive"><table className="attendance-table"><thead><tr><th>S.No</th><th>Labour</th><th>Site</th><th>Date</th><th>Status</th><th>OT Hrs</th><th>Work Type</th><th>Remarks</th><th>Action</th></tr></thead><tbody>
      {attendanceTable.count === 0 ? <tr><td colSpan="9" style={{ textAlign: "center", padding: "25px" }}>No Attendance Record Found</td></tr> : attendanceTable.rows.map((item, index) => <tr key={item.id}><td>{attendanceTable.startIndex + index + 1}</td><td>{item.employeeName || item.labourName || "-"}</td><td>{item.site || "-"}</td><td>{item.date || "-"}</td><td>{item.status || "-"}</td><td>{item.overtimeHours ?? item.overtime ?? 0}</td><td>{item.workType || "-"}</td><td>{item.remarks || "-"}</td><td>{canWrite && <><button className="edit-btn" onClick={() => editAttendance(item)}>✏️ Edit</button><button className="delete-btn" onClick={() => deleteAttendance(item)}>🗑️ Delete</button></>}</td></tr>)}
    </tbody></table></div><DataTablePagination table={attendanceTable} /></div>
  </div></Layout>;
}

export default Attendance;
