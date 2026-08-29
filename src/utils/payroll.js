import { normaliseDate, normaliseMoney, normaliseStatus } from "./financialReporting";

export const ATTENDANCE_STATUSES = ["Present", "Absent", "Half Day", "Leave"];
export const PAY_TYPES = ["daily", "monthly"];

const cleanText = (value) => String(value || "").trim();

export const nonNegativeNumber = (value, fallback = 0) => {
  const numeric = normaliseMoney(value);
  return numeric >= 0 ? numeric : fallback;
};

export const normalisePayType = (value, labour = {}) => {
  const type = cleanText(value || labour.payType || labour.salaryType).toLowerCase();
  if (PAY_TYPES.includes(type)) return type;
  return nonNegativeNumber(labour.monthlySalary) > 0 ? "monthly" : "daily";
};

export const getLabourId = (item = {}) => cleanText(item.labourId || item.id);

export const getLabourName = (item = {}) => cleanText(
  item.labourName || item.employeeName || item.name
);

export const getPayrollMonth = (value) => {
  const month = cleanText(value);
  if (/^\d{4}-\d{2}$/.test(month)) return month;
  return normaliseDate(value).slice(0, 7);
};

export const getAttendanceKey = ({ labourId, date } = {}) => {
  const safeLabourId = cleanText(labourId).replace(/\s+/g, "-");
  const safeDate = normaliseDate(date);
  return safeLabourId && safeDate ? `${safeLabourId}__${safeDate}` : "";
};

export const getAttendancePayableDays = (entry = {}) => {
  const status = normaliseStatus(entry.status);
  if (status === "present") return 1;
  if (status === "half-day" || status === "halfday") return 0.5;
  return 0;
};

export const getAttendanceOvertimeHours = (entry = {}) =>
  nonNegativeNumber(entry.overtimeHours ?? entry.overtime);

export const isAttendanceForLabourPeriod = (entry, labour, month, site = "") => {
  if (!entry || !labour || getPayrollMonth(entry.date) !== getPayrollMonth(month)) return false;
  const labourId = getLabourId(labour);
  const entryId = getLabourId(entry);
  const matchesLabour = labourId
    ? entryId === labourId
    : getLabourName(entry).toLowerCase() === getLabourName(labour).toLowerCase();
  // Legacy entries can lack a site; with an unambiguous labour ID they remain
  // usable for payroll instead of being silently discarded.
  const matchesSite = !cleanText(site) || !cleanText(entry.site) || cleanText(entry.site).toLowerCase() === cleanText(site).toLowerCase();
  return matchesLabour && matchesSite;
};

export const dedupeAttendance = (entries = []) => {
  const seen = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const labourId = getLabourId(entry) || getLabourName(entry).toLowerCase();
    const date = normaliseDate(entry.date);
    if (!labourId || !date) return;
    const key = `${labourId}__${date}`;
    const existing = seen.get(key);
    const entryVersion = String(entry.updatedAt?.seconds || entry.updatedAt || entry.createdAt?.seconds || entry.createdAt || "");
    const existingVersion = String(existing?.updatedAt?.seconds || existing?.updatedAt || existing?.createdAt?.seconds || existing?.createdAt || "");
    if (!existing || entryVersion >= existingVersion) seen.set(key, entry);
  });

  return Array.from(seen.values());
};

export const calculateAttendanceTotals = ({ attendance = [], labour, month, site = "" } = {}) => {
  const relevant = dedupeAttendance(attendance).filter((entry) =>
    isAttendanceForLabourPeriod(entry, labour, month, site)
  );

  return relevant.reduce((totals, entry) => {
    const status = normaliseStatus(entry.status);
    const payableDays = getAttendancePayableDays(entry);
    return {
      records: totals.records + 1,
      presentDays: totals.presentDays + (status === "present" ? 1 : 0),
      absentDays: totals.absentDays + (status === "absent" ? 1 : 0),
      halfDays: totals.halfDays + (status === "half-day" || status === "halfday" ? 1 : 0),
      leaveDays: totals.leaveDays + (status === "leave" ? 1 : 0),
      payableDays: totals.payableDays + payableDays,
      overtimeHours: totals.overtimeHours + getAttendanceOvertimeHours(entry),
    };
  }, {
    records: 0,
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    leaveDays: 0,
    payableDays: 0,
    overtimeHours: 0,
  });
};

export const getOutstandingAdvance = (advance = {}) => {
  const amount = nonNegativeNumber(advance.amount ?? advance.advanceAmount);
  const recovered = nonNegativeNumber(advance.recoveredAmount ?? advance.recoveryAmount);
  return Math.max(0, amount - recovered);
};

export const getPeriodAdvanceBalance = ({ advances = [], labour, month, site = "" } = {}) => {
  const labourId = getLabourId(labour);
  const labourName = getLabourName(labour).toLowerCase();
  const period = getPayrollMonth(month);

  return (Array.isArray(advances) ? advances : []).reduce((total, advance) => {
    if (!advance || typeof advance !== "object") return total;
    const advanceLabourId = getLabourId(advance);
    const sameLabour = labourId
      ? advanceLabourId === labourId
      : getLabourName(advance).toLowerCase() === labourName;
    const advanceDate = getPayrollMonth(advance.date || advance.payrollMonth);
    const sameSite = !cleanText(site) || cleanText(advance.site).toLowerCase() === cleanText(site).toLowerCase();
    return sameLabour && sameSite && (!advanceDate || advanceDate <= period)
      ? total + getOutstandingAdvance(advance)
      : total;
  }, 0);
};

export const getAdvanceRecoveryAllocations = ({ advances = [], labour, month, site = "", amount = 0 } = {}) => {
  const labourId = getLabourId(labour);
  const labourName = getLabourName(labour).toLowerCase();
  const period = getPayrollMonth(month);
  let remaining = nonNegativeNumber(amount);
  return (Array.isArray(advances) ? advances : [])
    .filter((advance) => {
      const sameLabour = labourId
        ? getLabourId(advance) === labourId
        : getLabourName(advance).toLowerCase() === labourName;
      const advancePeriod = getPayrollMonth(advance?.date || advance?.payrollMonth);
      const sameSite = !cleanText(site) || cleanText(advance?.site).toLowerCase() === cleanText(site).toLowerCase();
      return advance && sameLabour && sameSite && (!advancePeriod || advancePeriod <= period) && getOutstandingAdvance(advance) > 0;
    })
    .sort((left, right) => cleanText(left.date).localeCompare(cleanText(right.date)))
    .reduce((allocations, advance) => {
      if (remaining <= 0) return allocations;
      const recovered = Math.min(remaining, getOutstandingAdvance(advance));
      remaining -= recovered;
      return [...allocations, { advanceId: cleanText(advance.id), amount: recovered }];
    }, []);
};

export const getPayrollPaymentsTotal = ({ payments = [], payrollId, labour, month }) => {
  const labourId = getLabourId(labour);
  const period = getPayrollMonth(month);
  return (Array.isArray(payments) ? payments : []).reduce((total, payment) => {
    if (!payment || typeof payment !== "object") return total;
    const matchesPayroll = payrollId && cleanText(payment.salaryId || payment.payrollId) === cleanText(payrollId);
    const matchesLegacy = !payrollId &&
      getLabourId(payment) === labourId &&
      getPayrollMonth(payment.payrollMonth || payment.month) === period;
    return matchesPayroll || matchesLegacy
      ? total + nonNegativeNumber(payment.amount)
      : total;
  }, 0);
};

export const calculatePayroll = ({
  labour = {},
  attendance = [],
  advances = [],
  payments = [],
  payrollId = "",
  month,
  site = "",
  deductions = 0,
  advanceRecovery = 0,
  lockedAdvanceDeduction = null,
  overtimeRate = null,
  monthlyWorkingDays = 30,
} = {}) => {
  const payrollMonth = getPayrollMonth(month);
  const attendanceTotals = calculateAttendanceTotals({ attendance, labour, month: payrollMonth, site });
  const payType = normalisePayType(undefined, labour);
  const dailyWage = nonNegativeNumber(labour.dailyWage ?? labour.wage);
  const monthlySalary = nonNegativeNumber(labour.monthlySalary ?? labour.salary);
  const safeWorkingDays = Math.max(1, nonNegativeNumber(monthlyWorkingDays, 30));
  const basePay = payType === "monthly"
    ? monthlySalary * Math.min(safeWorkingDays, attendanceTotals.payableDays) / safeWorkingDays
    : dailyWage * attendanceTotals.payableDays;
  // A zero/default OT rate is intentional: historical wage data does not
  // define an OT policy, so the system must never invent a labour expense.
  const safeOvertimeRate = overtimeRate === null
    ? nonNegativeNumber(labour.overtimeRate)
    : nonNegativeNumber(overtimeRate);
  const overtimePay = attendanceTotals.overtimeHours * safeOvertimeRate;
  const grossPay = basePay + overtimePay;
  const outstandingAdvance = getPeriodAdvanceBalance({ advances, labour, month: payrollMonth, site });
  const requestedAdvanceRecovery = nonNegativeNumber(advanceRecovery);
  // Once a payroll has allocated an advance, editing that payroll must retain
  // the original deduction rather than trying to recover the advance again.
  const safeAdvanceRecovery = lockedAdvanceDeduction === null
    ? Math.min(outstandingAdvance, requestedAdvanceRecovery)
    : nonNegativeNumber(lockedAdvanceDeduction);
  const manualDeductions = nonNegativeNumber(deductions);
  const totalDeductions = Math.min(grossPay, manualDeductions + safeAdvanceRecovery);
  const netPay = Math.max(0, grossPay - totalDeductions);
  const paidAmount = Math.min(netPay, getPayrollPaymentsTotal({ payments, payrollId, labour, month: payrollMonth }));

  return {
    payrollMonth,
    payType,
    dailyWage,
    monthlySalary,
    ...attendanceTotals,
    basePay,
    overtimeRate: safeOvertimeRate,
    overtimePay,
    grossPay,
    outstandingAdvance,
    advanceDeduction: safeAdvanceRecovery,
    deductions: manualDeductions,
    totalDeductions,
    netPay,
    paidAmount,
    pendingAmount: Math.max(0, netPay - paidAmount),
  };
};

export const canManagePayroll = (role) =>
  ["admin", "manager"].includes(cleanText(role).toLowerCase());

export const createSalaryPaymentPayload = ({ payroll, labour, amount, paymentDate, paymentMode, reference = "", remarks = "", createdBy = "" } = {}) => {
  const paymentAmount = nonNegativeNumber(amount, -1);
  const pendingAmount = nonNegativeNumber(payroll?.pendingAmount, 0);
  if (!paymentDate || !paymentMode || paymentAmount <= 0 || paymentAmount > pendingAmount) {
    return { isValid: false, error: "Enter a valid payment not exceeding the pending salary." };
  }
  return {
    isValid: true,
    value: {
      salaryId: cleanText(payroll?.id),
      labourId: getLabourId(labour),
      labourName: getLabourName(labour),
      payrollMonth: getPayrollMonth(payroll?.month || payroll?.payrollMonth),
      site: cleanText(payroll?.site || labour?.site),
      amount: paymentAmount,
      paymentDate: normaliseDate(paymentDate),
      paymentMode: cleanText(paymentMode),
      reference: cleanText(reference),
      remarks: cleanText(remarks),
      createdBy: cleanText(createdBy),
    },
  };
};
