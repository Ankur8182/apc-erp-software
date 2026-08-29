import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { useAuth } from "../auth/AuthProvider";
import {
  calculatePayroll,
  canManagePayroll,
  createSalaryPaymentPayload,
  getAdvanceRecoveryAllocations,
  getLabourId,
  getLabourName,
  getPayrollMonth,
  nonNegativeNumber,
} from "../utils/payroll";
import "../Styles/Salary.css";
import { db } from "../firebase";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, deleteDoc } from "firebase/firestore";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentDate = () => new Date().toLocaleDateString("en-CA");
const formatMoney = (value) => `₹ ${nonNegativeNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Salary() {
  const { role, user } = useAuth();
  const canWrite = canManagePayroll(role);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [labourId, setLabourId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [deductions, setDeductions] = useState("");
  const [advanceRecovery, setAdvanceRecovery] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(currentDate());
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [advanceLabourId, setAdvanceLabourId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(currentDate());
  const [advanceReason, setAdvanceReason] = useState("");

  useEffect(() => {
    const subscriptions = [
      ["labours", setLabours], ["attendance", setAttendance], ["salaries", setSalaries],
      ["labourAdvances", setAdvances], ["salaryPayments", setPayments],
    ].map(([name, setter]) => onSnapshot(collection(db, name), (snapshot) => {
      setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => console.error(`Unable to load ${name}:`, error)));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, []);

  const activeLabours = useMemo(() => labours.filter((labour) => labour.active !== false && String(labour.status || "").toLowerCase() !== "inactive"), [labours]);
  const selectedLabour = useMemo(() => labours.find((labour) => labour.id === labourId), [labours, labourId]);
  const selectedExistingSalary = useMemo(() => salaries.find((salary) =>
    getPayrollMonth(salary.month || salary.payrollMonth) === month &&
    (getLabourId(salary) === labourId || (!salary.labourId && selectedLabour &&
      getLabourName(salary).toLowerCase() === getLabourName(selectedLabour).toLowerCase() &&
      String(salary.site || "").trim().toLowerCase() === String(selectedLabour.site || "").trim().toLowerCase()))
  ), [salaries, labourId, month, selectedLabour]);
  const payrollPreview = useMemo(() => selectedLabour ? calculatePayroll({
    labour: selectedLabour, attendance, advances, payments, payrollId: selectedExistingSalary?.id,
    month, site: selectedLabour.site, deductions, advanceRecovery, overtimeRate,
    lockedAdvanceDeduction: selectedExistingSalary ? selectedExistingSalary.advanceDeduction ?? selectedExistingSalary.advance ?? 0 : null,
  }) : null, [selectedLabour, attendance, advances, payments, selectedExistingSalary, month, deductions, advanceRecovery, overtimeRate]);

  const savePayroll = async () => {
    if (!selectedLabour || !month || !payrollPreview) { alert("Labour aur salary month select karein."); return; }
    if (payrollPreview.grossPay <= 0) { alert("No payable attendance/wage was found for this payroll period."); return; }
    const salaryId = selectedExistingSalary?.id || `${selectedLabour.id}__${month}`;
    const salaryReference = doc(db, "salaries", salaryId);
    const advanceAllocations = selectedExistingSalary?.advanceAllocations || getAdvanceRecoveryAllocations({
      advances, labour: selectedLabour, month, site: selectedLabour.site, amount: payrollPreview.advanceDeduction,
    });
    const salaryData = {
      labourId: selectedLabour.id,
      employeeName: getLabourName(selectedLabour),
      labourName: getLabourName(selectedLabour),
      site: selectedLabour.site || "",
      month,
      payrollMonth: month,
      date: `${month}-01`,
      payType: payrollPreview.payType,
      dailyWage: payrollPreview.dailyWage,
      monthlySalary: payrollPreview.monthlySalary,
      presentDays: payrollPreview.presentDays,
      absentDays: payrollPreview.absentDays,
      halfDays: payrollPreview.halfDays,
      leaveDays: payrollPreview.leaveDays,
      workingDays: payrollPreview.payableDays,
      overtimeHours: payrollPreview.overtimeHours,
      overtimeRate: payrollPreview.overtimeRate,
      basePay: payrollPreview.basePay,
      grossPay: payrollPreview.grossPay,
      overtimePay: payrollPreview.overtimePay,
      deductions: payrollPreview.deductions,
      advanceDeduction: payrollPreview.advanceDeduction,
      advance: payrollPreview.advanceDeduction,
      advanceAllocations,
      totalDeductions: payrollPreview.totalDeductions,
      netSalary: payrollPreview.netPay,
      netPay: payrollPreview.netPay,
      // Legacy-compatible canonical financial amount. Payments are a ledger,
      // not a new expense source.
      salary: payrollPreview.netPay,
      paidAmount: payrollPreview.paidAmount,
      pendingAmount: payrollPreview.pendingAmount,
      status: payrollPreview.pendingAmount > 0 ? (payrollPreview.paidAmount > 0 ? "Partial" : "Pending") : "Paid",
      paymentDate: selectedExistingSalary?.paymentDate || "",
      createdBy: selectedExistingSalary?.createdBy || user?.uid || "",
      updatedAt: serverTimestamp(),
    };
    try {
      setLoading(true);
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(salaryReference);
        if (!current.exists()) {
          advanceAllocations.forEach((allocation) => {
            const advance = advances.find((item) => item.id === allocation.advanceId);
            if (!advance) return;
            const recoveredAmount = nonNegativeNumber(advance.recoveredAmount) + allocation.amount;
            transaction.update(doc(db, "labourAdvances", allocation.advanceId), {
              recoveredAmount,
              recoveryStatus: recoveredAmount >= nonNegativeNumber(advance.amount) ? "Recovered" : "Partial",
              updatedAt: serverTimestamp(),
            });
          });
        }
        transaction.set(salaryReference, { ...salaryData, createdAt: current.exists() ? current.data().createdAt : serverTimestamp() }, { merge: true });
      });
      const auditResult = await logAuditEvent({ action: selectedExistingSalary ? "update" : "create", module: "salary", recordId: salaryId, recordLabel: salaryData.employeeName, details: `Payroll generated for ${month}: net ${formatMoney(salaryData.netSalary)}.`, site: salaryData.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert("Payroll successfully saved. Use Record Payment to settle the pending amount.");
    } catch (error) { console.error("Save payroll error:", error); alert("Payroll save nahi hua. Firebase connection/rules check karein."); }
    finally { setLoading(false); }
  };

  const recordPayment = async () => {
    if (!paymentTarget) return;
    if (!user?.uid) { alert("An authenticated user is required to record a salary payment."); return; }
    const labour = labours.find((item) => item.id === paymentTarget.labourId) || paymentTarget;
    const validation = createSalaryPaymentPayload({ payroll: paymentTarget, labour, amount: paymentAmount, paymentDate, paymentMode, reference: paymentReference, remarks: paymentRemarks, createdBy: user?.uid });
    if (!validation.isValid) { alert(validation.error); return; }
    const paymentReferenceDoc = doc(collection(db, "salaryPayments"));
    const salaryReference = doc(db, "salaries", paymentTarget.id);
    try {
      setLoading(true);
      await runTransaction(db, async (transaction) => {
        const salarySnapshot = await transaction.get(salaryReference);
        if (!salarySnapshot.exists()) throw new Error("PAYROLL_NOT_FOUND");
        const currentSalary = salarySnapshot.data();
        const pending = nonNegativeNumber(currentSalary.pendingAmount ?? currentSalary.netSalary ?? currentSalary.salary);
        if (validation.value.amount > pending) throw new Error("OVERPAYMENT");
        const paidAmount = nonNegativeNumber(currentSalary.paidAmount) + validation.value.amount;
        const pendingAmount = Math.max(0, nonNegativeNumber(currentSalary.netSalary ?? currentSalary.salary) - paidAmount);
        transaction.set(paymentReferenceDoc, { ...validation.value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        transaction.update(salaryReference, { paidAmount, pendingAmount, paymentDate: validation.value.paymentDate, status: pendingAmount === 0 ? "Paid" : "Partial", updatedAt: serverTimestamp() });
      });
      const auditResult = await logAuditEvent({ action: "create", module: "salaryPayments", recordId: paymentReferenceDoc.id, recordLabel: validation.value.labourName, details: `Salary payment of ${formatMoney(validation.value.amount)} recorded for ${validation.value.payrollMonth}.`, site: validation.value.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert("Salary payment recorded.");
      setPaymentTarget(null); setPaymentAmount(""); setPaymentReference(""); setPaymentRemarks("");
    } catch (error) {
      console.error("Salary payment error:", error);
      alert(error.message === "OVERPAYMENT" ? "Payment pending salary se zyada nahi ho sakta." : "Salary payment save nahi hua.");
    } finally { setLoading(false); }
  };

  const saveAdvance = async () => {
    const labour = labours.find((item) => item.id === advanceLabourId);
    const amount = nonNegativeNumber(advanceAmount, -1);
    if (!labour || amount <= 0 || !advanceDate || !user?.uid) { alert("Labour, valid advance amount, date aur signed-in user zaroori hai."); return; }
    const advanceReference = doc(collection(db, "labourAdvances"));
    try {
      setLoading(true);
      await runTransaction(db, async (transaction) => transaction.set(advanceReference, {
        labourId: labour.id, labourName: getLabourName(labour), site: labour.site || "", date: advanceDate,
        amount, reason: advanceReason.trim(), recoveredAmount: 0, recoveryStatus: "Pending", createdBy: user?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }));
      const auditResult = await logAuditEvent({ action: "create", module: "labourAdvances", recordId: advanceReference.id, recordLabel: getLabourName(labour), details: `Labour advance of ${formatMoney(amount)} recorded.`, site: labour.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
      setAdvanceLabourId(""); setAdvanceAmount(""); setAdvanceReason(""); alert("Labour advance recorded.");
    } catch (error) { console.error("Advance error:", error); alert("Labour advance save nahi hua."); }
    finally { setLoading(false); }
  };

  const deleteSalary = async (salary) => {
    if (nonNegativeNumber(salary.paidAmount) > 0) { alert("A payroll with recorded payments cannot be deleted. Correct it with a documented adjustment."); return; }
    if (!window.confirm("Delete this unpaid payroll record?")) return;
    try {
      await deleteDoc(doc(db, "salaries", salary.id));
      const auditResult = await logAuditEvent({ action: "delete", module: "salary", recordId: salary.id, recordLabel: salary.employeeName, details: "Unpaid payroll record deleted.", site: salary.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
    } catch (error) { console.error("Delete Salary Error:", error); alert("Salary delete nahi hui."); }
  };

  const filteredSalaries = useMemo(() => salaries.filter((item) => {
    const text = search.toLowerCase();
    return [item.employeeName, item.labourName, item.site, item.month, item.status].some((value) => String(value || "").toLowerCase().includes(text)) &&
      (!siteFilter || item.site === siteFilter) && (!statusFilter || item.status === statusFilter);
  }), [salaries, search, siteFilter, statusFilter]);
  const salaryTable = useDataTable(filteredSalaries, { sortOptions: [
    { value: "month", label: "Salary month", getValue: (item) => item.month || item.payrollMonth },
    { value: "employee", label: "Labour", getValue: (item) => item.employeeName || item.labourName },
    { value: "site", label: "Site", getValue: (item) => item.site },
    { value: "pending", label: "Pending", getValue: (item) => item.pendingAmount },
  ], defaultSortBy: "month", defaultSortDirection: "desc", resetKey: `${search}|${siteFilter}|${statusFilter}` });
  const salarySites = useMemo(() => getDistinctValues(salaries, (item) => item.site), [salaries]);
  const salaryStatuses = useMemo(() => getDistinctValues(salaries, (item) => item.status), [salaries]);
  const totalNet = filteredSalaries.reduce((total, item) => total + nonNegativeNumber(item.netSalary ?? item.netPay ?? item.salary), 0);
  const totalPending = filteredSalaries.reduce((total, item) => total + nonNegativeNumber(item.pendingAmount), 0);

  return <Layout title="💵 Salary & Payroll"><div className="data-page salary-page">
    <div className="page-card"><h2>💵 Generate Payroll</h2><p className="form-helper">Attendance supplies payable days. This payroll record is the only new labour expense source; payment entries only settle its pending balance.</p>
      <div className="form-grid"><select value={labourId} onChange={(e) => setLabourId(e.target.value)} disabled={!canWrite}><option value="">Select Labour *</option>{activeLabours.map((labour) => <option key={labour.id} value={labour.id}>{labour.name} — {labour.site || "No site"}</option>)}</select><input value={selectedLabour?.site || ""} placeholder="Site" readOnly /><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={!canWrite} /><input type="number" min="0" placeholder="OT rate per hour (optional)" value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} disabled={!canWrite} /><input type="number" min="0" placeholder="Other deductions" value={deductions} onChange={(e) => setDeductions(e.target.value)} disabled={!canWrite} /><input type="number" min="0" placeholder="Advance recovery this payroll" value={advanceRecovery} onChange={(e) => setAdvanceRecovery(e.target.value)} disabled={!canWrite || Boolean(selectedExistingSalary)} /></div>
      {payrollPreview && <div className="payroll-preview"><span>Present: <strong>{payrollPreview.presentDays}</strong></span><span>Half: <strong>{payrollPreview.halfDays}</strong></span><span>Payable days: <strong>{payrollPreview.payableDays}</strong></span><span>OT: <strong>{payrollPreview.overtimeHours}h</strong></span><span>Gross: <strong>{formatMoney(payrollPreview.grossPay)}</strong></span><span>Net: <strong>{formatMoney(payrollPreview.netPay)}</strong></span><span>Outstanding advance: <strong>{formatMoney(payrollPreview.outstandingAdvance)}</strong></span></div>}
      <button className="save-btn" onClick={savePayroll} disabled={loading || !canWrite}>{!canWrite ? "Read-only access" : loading ? "⏳ Saving..." : selectedExistingSalary ? "✏️ Update Payroll" : "💾 Save Payroll"}</button>
    </div>
    {canWrite && <div className="page-card"><h2>💸 Record Labour Advance</h2><div className="form-grid"><select value={advanceLabourId} onChange={(e) => setAdvanceLabourId(e.target.value)}><option value="">Select Labour *</option>{activeLabours.map((labour) => <option key={labour.id} value={labour.id}>{labour.name} — {labour.site || "No site"}</option>)}</select><input type="number" min="0" placeholder="Advance Amount *" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} /><input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /><input type="text" placeholder="Reason" value={advanceReason} onChange={(e) => setAdvanceReason(e.target.value)} /></div><button className="save-btn" disabled={loading} onClick={saveAdvance}>💾 Save Advance</button></div>}
    <div className="page-card" style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}><div><h3>Net Payroll</h3><h2>{formatMoney(totalNet)}</h2></div><div><h3>Pending Salary</h3><h2>{formatMoney(totalPending)}</h2></div><div><h3>Payroll Records</h3><h2>{filteredSalaries.length}</h2></div></div>
    <div className="table-card"><h2>📋 Payroll Records</h2><DataTableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search labour, site, month or status..." table={salaryTable}><label><span>Site</span><select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}><option value="">All sites</option>{salarySites.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{salaryStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></DataTableToolbar><div className="table-responsive"><table className="salary-table"><thead><tr><th>S.No</th><th>Labour</th><th>Site</th><th>Month</th><th>Payable Days / OT</th><th>Gross</th><th>Deduction</th><th>Net Salary</th><th>Paid</th><th>Pending</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {salaryTable.count === 0 ? <tr><td colSpan="12" style={{ textAlign: "center", padding: "25px" }}>No Salary Record Found</td></tr> : salaryTable.rows.map((item, index) => <tr key={item.id}><td>{salaryTable.startIndex + index + 1}</td><td>{item.employeeName || item.labourName || "-"}</td><td>{item.site || "-"}</td><td>{item.month || item.payrollMonth || "-"}</td><td>{item.workingDays ?? "-"} / {item.overtimeHours ?? 0}h</td><td>{formatMoney(item.grossPay ?? item.salary)}</td><td>{formatMoney(item.totalDeductions ?? item.advance)}</td><td>{formatMoney(item.netSalary ?? item.netPay ?? item.salary)}</td><td>{formatMoney(item.paidAmount)}</td><td>{formatMoney(item.pendingAmount)}</td><td>{item.status || "-"}</td><td>{canWrite && <><button className="edit-btn" onClick={() => { setLabourId(item.labourId || ""); setMonth(item.month || item.payrollMonth || currentMonth()); setDeductions(item.deductions ?? ""); setAdvanceRecovery(item.advanceDeduction ?? item.advance ?? ""); setOvertimeRate(item.overtimeRate ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>✏️ Edit</button>{nonNegativeNumber(item.pendingAmount) > 0 && <button className="save-btn" style={{ marginTop: 0 }} onClick={() => { setPaymentTarget(item); setPaymentAmount(""); }}>Pay</button>}<button className="delete-btn" onClick={() => deleteSalary(item)}>🗑️ Delete</button></>}</td></tr>)}
    </tbody></table></div><DataTablePagination table={salaryTable} /></div>
    {paymentTarget && <div className="page-card"><h2>Record Salary Payment — {paymentTarget.employeeName || paymentTarget.labourName}</h2><p className="form-helper">Pending: {formatMoney(paymentTarget.pendingAmount)}</p><div className="form-grid"><input type="number" min="0" max={paymentTarget.pendingAmount} placeholder="Payment Amount *" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option></select><input placeholder="Reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /><input placeholder="Remarks" value={paymentRemarks} onChange={(e) => setPaymentRemarks(e.target.value)} /></div><button className="save-btn" disabled={loading} onClick={recordPayment}>💾 Record Payment</button><button type="button" className="delete-btn" style={{ marginLeft: "10px" }} onClick={() => setPaymentTarget(null)}>Cancel</button></div>}
  </div></Layout>;
}

export default Salary;
