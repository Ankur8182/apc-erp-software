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

const firstNumber = (...values) => {
  const value = values.find(hasValue);
  return hasValue(value) ? toNumber(value) : 0;
};

const normaliseText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const getSiteName = (item = {}) =>
  String(
    item.site ||
      item.siteName ||
      item.projectName ||
      item.project ||
      item.siteId ||
      item.projectSite ||
      item.site_name ||
      ""
  ).trim();

export const isSameSite = (item, siteName) => {
  const currentSite = normaliseText(siteName);
  return currentSite !== "" && normaliseText(getSiteName(item)) === currentSite;
};

const getDateValue = (item = {}) =>
  item.invoiceDate ||
  item.paymentDate ||
  item.date ||
  item.purchaseDate ||
  item.fuelDate ||
  item.fuelUpdatedAt ||
  item.createdAt ||
  "";

const normaliseDate = (value) => {
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

export const isDateInRange = (item, fromDate, toDate) => {
  if (!fromDate && !toDate) return true;

  const date = normaliseDate(getDateValue(item));

  return Boolean(
    date &&
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
  );
};

export const getInvoiceSummary = (item = {}) => {
  const total = firstNumber(
    item.totalAmount,
    item.invoiceAmount,
    item.amount,
    item.total,
    item.grandTotal,
    item.netAmount,
    item.value
  );
  const received = firstNumber(
    item.paidAmount,
    item.receivedAmount,
    item.paymentReceived
  );
  const pending = hasValue(item.pendingAmount)
    ? Math.max(toNumber(item.pendingAmount), 0)
    : Math.max(total - received, 0);

  return { total, received, pending };
};

const isMaterialUsage = (item = {}) =>
  ["usage", "used", "consume", "consumption"].includes(
    normaliseText(item.entryType)
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

  if (hasValue(savedAmount)) return toNumber(savedAmount);

  return (
    firstNumber(item.quantity, item.qty) *
    firstNumber(item.rate, item.unitRate, item.price, item.unitPrice)
  );
};

export const getExpenseAmount = (item = {}) =>
  firstNumber(
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
  firstNumber(
    item.salary,
    item.totalSalary,
    item.netSalary,
    item.amount,
    item.paidAmount,
    item.totalAmount
  );

export const getVehicleAmount = (item = {}) =>
  firstNumber(
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

const getDirectLabourPayment = (item = {}) =>
  firstNumber(
    item.amount,
    item.payment,
    item.paidAmount,
    item.totalAmount,
    item.totalWage
  );

const getDailyWage = (item = {}) =>
  firstNumber(item.dailyWage, item.wage, item.rate);

const getAttendanceMultiplier = (item = {}) => {
  const status = normaliseText(item.status);

  if (["half day", "half-day", "half", "h"].includes(status)) {
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

  return normaliseDate(getDateValue(item)).slice(0, 7);
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
  const directLabourPayment = labours.reduce(
    (total, item) => total + getDirectLabourPayment(item),
    0
  );
  const attendanceExpense = getAttendanceExpense(
    attendance,
    labours,
    attendanceSalaryCoverage
  );
  const vehicleExpense = vehicles.reduce(
    (total, item) => total + getVehicleAmount(item),
    0
  );
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
    otherExpenseFromExpenses,
  };
};
