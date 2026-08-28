const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

export const toNumber = (value) => {
  if (!hasValue(value)) return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsedValue = Number(
    String(value)
      .replace(/[₹,\s]/g, "")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const normaliseMoney = (value) => Math.max(toNumber(value), 0);

const hasValidMoneyValue = (value) => {
  if (!hasValue(value)) return false;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;

  const numericValue = String(value)
    .replace(/[₹,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  return (
    numericValue !== "" &&
    Number.isFinite(Number(numericValue)) &&
    Number(numericValue) >= 0
  );
};

const firstMoney = (...values) => {
  const value = values.find(hasValue);
  return hasValue(value) ? normaliseMoney(value) : 0;
};

export const normaliseSiteName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normaliseText = (value) => normaliseSiteName(value).toLowerCase();

export const normaliseStatus = (value) => {
  const status = normaliseText(value);
  const aliases = {
    "half day": "half-day",
    halfday: "half-day",
    half: "half-day",
    h: "half-day",
    p: "present",
    "partially paid": "partial",
  };

  return aliases[status] || status;
};

export const getSiteName = (item = {}) =>
  normaliseSiteName(
    item.site ||
      item.siteName ||
      item.projectName ||
      item.project ||
      item.siteId ||
      item.projectSite ||
      item.site_name ||
      ""
  );

export const isSameSite = (item, siteName) => {
  const currentSite = normaliseText(siteName);
  return currentSite !== "" && normaliseText(getSiteName(item)) === currentSite;
};

export const normaliseDate = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }

  if (value?.toDate) {
    return value.toDate().toISOString().slice(0, 10);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
};

export const getRecordDate = (item = {}) =>
  [
    item.invoiceDate,
    item.paymentDate,
    item.date,
    item.purchaseDate,
    item.fuelDate,
    item.fuelUpdatedAt,
    item.createdAt,
  ]
    .map(normaliseDate)
    .find(Boolean) || "";

export const isDateInRange = (item, fromDate, toDate) => {
  const from = normaliseDate(fromDate);
  const to = normaliseDate(toDate);

  if (!from && !to) return true;

  const date = getRecordDate(item);

  return Boolean(
    date &&
      (!from || date >= from) &&
      (!to || date <= to)
  );
};

export const getInvoiceSummary = (item = {}) => {
  const total = firstMoney(
    item.totalAmount,
    item.invoiceAmount,
    item.amount,
    item.total,
    item.grandTotal,
    item.netAmount,
    item.value
  );
  const receivedValue = [
    item.paidAmount,
    item.receivedAmount,
    item.paymentReceived,
  ].find(hasValue);
  const pendingValue = item.pendingAmount;
  const received = hasValidMoneyValue(receivedValue)
    ? Math.min(normaliseMoney(receivedValue), total)
    : hasValidMoneyValue(pendingValue)
      ? Math.max(total - normaliseMoney(pendingValue), 0)
      : 0;
  const pending = Math.max(total - received, 0);

  return { total, received, pending };
};

const isMaterialUsage = (item = {}) =>
  ["usage", "used", "consume", "consumption", "material usage"].includes(
    normaliseStatus(item.entryType)
  );

export const getMaterialAmount = (item = {}) => {
  if (isMaterialUsage(item)) return 0;

  const savedAmount = [
    item.totalAmount,
    item.purchaseAmount,
    item.expenseAmount,
    item.amount,
    item.total,
    item.cost,
    item.totalCost,
  ].find(hasValue);

  if (hasValue(savedAmount)) return normaliseMoney(savedAmount);

  return (
    firstMoney(item.quantity, item.qty) *
    firstMoney(item.rate, item.unitRate, item.price, item.unitPrice)
  );
};

export const getExpenseAmount = (item = {}) =>
  firstMoney(
    item.amount,
    item.expenseAmount,
    item.totalAmount,
    item.total,
    item.cost
  );

const getExpenseType = (item = {}) =>
  normaliseText(item.expenseType || item.category || item.type);

export const isMaterialExpense = (item) =>
  ["material", "materials"].includes(getExpenseType(item));

export const isLabourExpense = (item) =>
  ["labour", "labor", "wages", "salary"].includes(getExpenseType(item));

export const getSalaryAmount = (item = {}) =>
  firstMoney(
    item.salary,
    item.totalSalary,
    item.netSalary,
    item.amount,
    item.paidAmount,
    item.totalAmount
  );

export const getVehicleAmount = (item = {}) =>
  firstMoney(
    item.fuelExpense,
    item.fuelAmount,
    item.fuelCost,
    item.fuel,
    item.expense,
    item.amount,
    item.totalAmount,
    item.totalFuelCost,
    item.cost
  );

const getVehicleKeys = (item = {}) => {
  const keys = [];
  const vehicleId = normaliseText(item.vehicleId || item.id);

  if (vehicleId) keys.push(`id:${vehicleId}`);

  const vehicleNumber = normaliseText(
    item.vehicleNumber || item.vehicleName || item.name
  );

  if (vehicleNumber) keys.push(`number:${vehicleNumber}`);

  return keys;
};

export const getVehicleExpenseAmount = (item = {}) =>
  firstMoney(
    item.amount,
    item.expenseAmount,
    item.totalAmount,
    item.total,
    item.cost
  );

const getVehicleExpenseSummary = (
  vehicles = [],
  vehicleExpenses = [],
  vehicleExpenseCoverage = vehicleExpenses
) => {
  const ledgerVehicleKeys = new Set(
    vehicleExpenseCoverage.flatMap(getVehicleKeys)
  );
  const vehicleExpenseFromLedger = vehicleExpenses.reduce(
    (total, item) => total + getVehicleExpenseAmount(item),
    0
  );
  const legacyVehicleExpense = vehicles.reduce((total, item) => {
    const hasLedgerHistory = getVehicleKeys(item).some((vehicleKey) =>
      ledgerVehicleKeys.has(vehicleKey)
    );

    return total + (hasLedgerHistory
      ? 0
      : getVehicleAmount(item));
  }, 0);

  return {
    vehicleExpense: vehicleExpenseFromLedger + legacyVehicleExpense,
    vehicleExpenseFromLedger,
    legacyVehicleExpense,
  };
};

const getDailyWage = (item = {}) =>
  firstMoney(item.dailyWage, item.wage, item.rate);

const getAttendanceMultiplier = (item = {}) => {
  const status = normaliseStatus(item.status);

  if (status === "half-day") {
    return 0.5;
  }

  return status === "present" ? 1 : 0;
};

const getWorkerKey = (item = {}) =>
  `${normaliseText(getSiteName(item))}::${normaliseText(
    item.employeeName || item.name
  )}`;

const getSalaryPeriod = (item = {}) => {
  const month = String(item.month || "").trim();
  if (/^\d{4}-\d{2}$/.test(month)) return month;

  return getRecordDate(item).slice(0, 7);
};

const getAttendancePeriod = (item = {}) =>
  normaliseDate(item.date).slice(0, 7);

const getAttendanceExpense = (attendance, labours, salaries) => {
  const wagesByWorker = new Map();

  labours.forEach((labour) => {
    const workerKey = getWorkerKey(labour);
    const dailyWage = getDailyWage(labour);

    if (workerKey !== "::" && dailyWage > 0 && !wagesByWorker.has(workerKey)) {
      wagesByWorker.set(workerKey, dailyWage);
    }
  });

  const salaryPeriods = new Set(
    salaries
      .filter((salary) => getSalaryAmount(salary) !== 0)
      .map((salary) => `${getWorkerKey(salary)}::${getSalaryPeriod(salary)}`)
  );

  return attendance.reduce((total, entry) => {
    const workerKey = getWorkerKey(entry);
    const period = getAttendancePeriod(entry);

    if (
      !period ||
      salaryPeriods.has(`${workerKey}::${period}`) ||
      !wagesByWorker.has(workerKey)
    ) {
      return total;
    }

    return (
      total +
      wagesByWorker.get(workerKey) * getAttendanceMultiplier(entry)
    );
  }, 0);
};

export const calculateFinancialSummary = ({
  invoices = [],
  expenses = [],
  materials = [],
  labours = [],
  salaries = [],
  attendance = [],
  attendanceSalaryCoverage = salaries,
  vehicles = [],
  vehicleExpenses = [],
  vehicleExpenseCoverage = vehicleExpenses,
} = {}) => {
  const invoiceSummary = invoices.reduce(
    (summary, invoice) => {
      const values = getInvoiceSummary(invoice);

      return {
        income: summary.income + values.total,
        received: summary.received + values.received,
        pending: summary.pending + values.pending,
      };
    },
    { income: 0, received: 0, pending: 0 }
  );

  const materialPurchaseExpense = materials.reduce(
    (total, item) => total + getMaterialAmount(item),
    0
  );
  const materialExpenseFromExpenses = expenses.reduce(
    (total, item) =>
      total + (isMaterialExpense(item) ? getExpenseAmount(item) : 0),
    0
  );
  const labourExpenseFromExpenses = expenses.reduce(
    (total, item) =>
      total + (isLabourExpense(item) ? getExpenseAmount(item) : 0),
    0
  );
  const otherExpenseFromExpenses = expenses.reduce(
    (total, item) =>
      total +
      (isMaterialExpense(item) || isLabourExpense(item)
        ? 0
        : getExpenseAmount(item)),
    0
  );
  const salaryExpense = salaries.reduce(
    (total, item) => total + getSalaryAmount(item),
    0
  );
  // Labour records are wage masters only. Payments must be recorded in
  // salaries, attendance, or the Labour category of expenses.
  const directLabourPayment = 0;
  const attendanceExpense = getAttendanceExpense(
    attendance,
    labours,
    attendanceSalaryCoverage
  );
  const vehicleSummary = getVehicleExpenseSummary(
    vehicles,
    vehicleExpenses,
    vehicleExpenseCoverage
  );
  const vehicleExpense = vehicleSummary.vehicleExpense;
  const materialExpense =
    materialPurchaseExpense + materialExpenseFromExpenses;
  const labourExpense =
    labourExpenseFromExpenses +
    salaryExpense +
    directLabourPayment +
    attendanceExpense;
  const otherExpense = otherExpenseFromExpenses + vehicleExpense;
  const totalExpense = materialExpense + labourExpense + otherExpense;

  return {
    ...invoiceSummary,
    materialExpense,
    labourExpense,
    otherExpense,
    totalExpense,
    profit: invoiceSummary.income - totalExpense,
    materialPurchaseExpense,
    materialExpenseFromExpenses,
    labourExpenseFromExpenses,
    salaryExpense,
    directLabourPayment,
    attendanceExpense,
    vehicleExpense,
    vehicleExpenseFromLedger: vehicleSummary.vehicleExpenseFromLedger,
    legacyVehicleExpense: vehicleSummary.legacyVehicleExpense,
    otherExpenseFromExpenses,
  };
};
