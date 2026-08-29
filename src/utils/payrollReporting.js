import { normaliseDate, normaliseMoney, normaliseStatus } from "./financialReporting";
import { calculatePayroll, dedupeAttendance, getLabourId, getLabourName, getPayrollMonth } from "./payroll";

const cleanText = (value) => String(value || "").trim();

export const getTodayWorkforceSummary = ({ attendance = [], labours = [], salaries = [], today } = {}) => {
  const date = normaliseDate(today);
  const todayAttendance = dedupeAttendance(attendance).filter((item) => normaliseDate(item.date) === date);
  const activeLabours = (Array.isArray(labours) ? labours : []).filter((item) => item && item.active !== false && normaliseStatus(item.status) !== "inactive");
  const month = date.slice(0, 7);
  const currentPayroll = (Array.isArray(salaries) ? salaries : []).filter((item) => getPayrollMonth(item.month || item.payrollMonth) === month);
  return {
    presentToday: todayAttendance.filter((item) => normaliseStatus(item.status) === "present").length,
    absentToday: todayAttendance.filter((item) => normaliseStatus(item.status) === "absent").length,
    activeLabour: activeLabours.length,
    monthlyPayroll: currentPayroll.reduce((total, item) => total + normaliseMoney(item.netSalary ?? item.netPay ?? item.salary), 0),
    pendingSalary: currentPayroll.reduce((total, item) => total + normaliseMoney(item.pendingAmount ?? item.balanceAmount), 0),
  };
};

export const getPayrollRows = ({ labours = [], attendance = [], advances = [], payments = [], salaries = [], month, site = "" } = {}) => {
  const payrollMonth = getPayrollMonth(month);
  return (Array.isArray(labours) ? labours : [])
    .filter((labour) => labour && (labour.active !== false) && (!site || cleanText(labour.site).toLowerCase() === cleanText(site).toLowerCase()))
    .map((labour) => {
      const existing = (Array.isArray(salaries) ? salaries : []).find((salary) =>
        getLabourId(salary) === getLabourId(labour) &&
        getPayrollMonth(salary.month || salary.payrollMonth) === payrollMonth &&
        (!site || cleanText(salary.site).toLowerCase() === cleanText(site).toLowerCase())
      );
      const computed = calculatePayroll({ labour, attendance, advances, payments, payrollId: existing?.id, month: payrollMonth, site: site || labour.site, deductions: existing?.deductions, advanceRecovery: existing?.advanceDeduction, overtimeRate: existing?.overtimeRate, monthlyWorkingDays: existing?.monthlyWorkingDays || 30 });
      return { ...computed, id: existing?.id || "", labourId: getLabourId(labour), employeeName: getLabourName(labour), site: cleanText(labour.site), status: existing?.status || (computed.pendingAmount > 0 ? "Pending" : "Paid"), existing };
    });
};
