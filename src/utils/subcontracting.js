import {
  getSiteName,
  isSameSite,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "./financialReporting";

export const CONTRACTOR_VENDOR_TYPES = [
  "Supplier",
  "Subcontractor",
  "Service Provider",
  "Equipment Provider",
  "Other",
];

export const WORK_ORDER_STATUSES = [
  "Draft",
  "Approved",
  "Active",
  "Completed",
  "Closed",
  "Cancelled",
];

export const WORK_ORDER_RATE_TYPES = [
  "Lump Sum",
  "Item Rate",
  "Daily / Other",
];

export const CONTRACTOR_BILL_STATUSES = ["Pending", "Partially Paid", "Paid"];
export const CONTRACTOR_PAYMENT_TYPES = ["Bill Payment", "Retention Release"];
export const CONTRACTOR_PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "UPI", "Other"];

const cleanText = (value) => String(value ?? "").trim();
const cleanKey = (value) => cleanText(value).toLowerCase();
const roundedMoney = (value) => Math.round(normaliseMoney(value) * 100) / 100;
const strictNonNegativeNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export const canManageSubcontracting = (role) =>
  ["admin", "manager"].includes(cleanKey(role));

export const isSubcontractorVendor = (vendor = {}) =>
  cleanKey(vendor.vendorType || vendor.type) === "subcontractor";

export const createInitialWorkOrderForm = () => ({
  vendorId: "",
  vendorName: "",
  site: "",
  siteId: "",
  workTrade: "",
  workDescription: "",
  startDate: new Date().toISOString().slice(0, 10),
  expectedCompletionDate: "",
  rateType: "Lump Sum",
  contractValue: "",
  quantity: "",
  unit: "",
  rate: "",
  retentionPercent: "0",
  advanceAmount: "0",
  terms: "",
  remarks: "",
  status: "Draft",
});

export const calculateWorkOrderValue = ({ rateType, contractValue, quantity, rate } = {}) => {
  if (cleanText(rateType) === "Item Rate") {
    const safeQuantity = strictNonNegativeNumber(quantity);
    const safeRate = strictNonNegativeNumber(rate);
    return safeQuantity === null || safeRate === null
      ? null
      : roundedMoney(safeQuantity * safeRate);
  }

  const value = strictNonNegativeNumber(contractValue);
  return value === null ? null : roundedMoney(value);
};

export const validateWorkOrder = (form = {}) => {
  const vendorId = cleanText(form.vendorId);
  const vendorName = cleanText(form.vendorName);
  const site = normaliseSiteName(form.site);
  const startDate = normaliseDate(form.startDate);
  const expectedCompletionDate = normaliseDate(form.expectedCompletionDate);
  const rateType = cleanText(form.rateType) || "Lump Sum";
  const contractValue = calculateWorkOrderValue(form);
  const retentionPercent = strictNonNegativeNumber(form.retentionPercent);
  const advanceAmount = strictNonNegativeNumber(form.advanceAmount);
  const quantity = strictNonNegativeNumber(form.quantity);
  const rate = strictNonNegativeNumber(form.rate);
  const unit = cleanText(form.unit);

  if (!vendorId || !vendorName || !site || !cleanText(form.workTrade) ||
    !cleanText(form.workDescription) || !startDate || !expectedCompletionDate) {
    return { isValid: false, error: "Vendor, site, trade, description, and dates are required." };
  }
  if (!WORK_ORDER_RATE_TYPES.includes(rateType) || contractValue === null || contractValue <= 0 ||
    retentionPercent === null || retentionPercent > 100 || advanceAmount === null || advanceAmount > contractValue) {
    return { isValid: false, error: "Enter a valid contract value, retention percentage, and advance amount." };
  }
  if (expectedCompletionDate < startDate) {
    return { isValid: false, error: "Expected completion date cannot be before the start date." };
  }
  if (rateType === "Item Rate" && (quantity === null || quantity <= 0 || !unit || rate === null || rate < 0)) {
    return { isValid: false, error: "Item-rate work orders require quantity, unit, and a valid rate." };
  }

  return {
    isValid: true,
    value: {
      vendorId,
      vendorName,
      site,
      siteId: cleanText(form.siteId),
      workTrade: cleanText(form.workTrade),
      workDescription: cleanText(form.workDescription),
      startDate,
      expectedCompletionDate,
      rateType,
      contractValue,
      quantity: rateType === "Item Rate" ? quantity : 0,
      unit: rateType === "Item Rate" ? unit : "",
      rate: rateType === "Item Rate" ? rate : 0,
      retentionPercent,
      advanceAmount,
      advanceRecovered: 0,
      progressQuantity: 0,
      progressPercent: 0,
      certifiedAmount: 0,
      billedAmount: 0,
      terms: cleanText(form.terms),
      remarks: cleanText(form.remarks),
      status: "Draft",
    },
  };
};

export const buildWorkOrderNumber = (workOrders = [], date = new Date()) => {
  const year = date.getFullYear();
  const prefix = "WO-" + year + "-";
  const used = new Set(
    (Array.isArray(workOrders) ? workOrders : [])
      .map((item) => cleanText(item?.workOrderNumber || item?.number))
      .filter((number) => number.startsWith(prefix))
  );
  let sequence = used.size + 1;
  let reference = prefix + String(sequence).padStart(4, "0");
  while (used.has(reference)) {
    sequence += 1;
    reference = prefix + String(sequence).padStart(4, "0");
  }
  return reference;
};

export const canTransitionWorkOrder = (currentStatus, nextStatus) => {
  const current = cleanText(currentStatus) || "Draft";
  const next = cleanText(nextStatus);
  if (!WORK_ORDER_STATUSES.includes(current) || !WORK_ORDER_STATUSES.includes(next)) return false;
  if (current === next) return true;
  return (
    (current === "Draft" && ["Approved", "Cancelled"].includes(next)) ||
    (current === "Approved" && ["Active", "Cancelled"].includes(next)) ||
    (current === "Active" && ["Completed", "Cancelled"].includes(next)) ||
    (current === "Completed" && next === "Closed")
  );
};

const getProgressTotals = (workOrder = {}, progressRecords = []) =>
  (Array.isArray(progressRecords) ? progressRecords : [])
    .filter((record) => record && cleanText(record.workOrderId) === cleanText(workOrder.id || workOrder.workOrderId))
    .reduce((total, record) => ({
      quantity: total.quantity + normaliseMoney(record.quantity),
      percent: total.percent + normaliseMoney(record.progressPercent),
      certifiedAmount: total.certifiedAmount + normaliseMoney(record.certifiedAmount),
    }), {
      quantity: 0,
      percent: 0,
      certifiedAmount: 0,
    });

export const validateWorkOrderProgress = ({
  workOrder,
  progressRecords = [],
  date,
  site,
  quantity,
  unit,
  progressPercent,
  remarks = "",
  dprId = "",
} = {}) => {
  const order = workOrder && typeof workOrder === "object" ? workOrder : null;
  const safeDate = normaliseDate(date);
  const safeSite = normaliseSiteName(site);
  const safeQuantity = strictNonNegativeNumber(quantity);
  const safePercent = strictNonNegativeNumber(progressPercent);
  const rateType = cleanText(order?.rateType);
  const totals = getProgressTotals(order, progressRecords);

  if (!order || !safeDate || !safeSite || !isSameSite(order, safeSite) ||
    !["Approved", "Active"].includes(cleanText(order.status))) {
    return { isValid: false, error: "Select an approved or active work order and a valid matching site/date." };
  }
  if (safePercent === null || safePercent < 0 || safePercent > 100) {
    return { isValid: false, error: "Progress percentage must be between 0 and 100." };
  }

  let certifiedAmount = 0;
  let safeUnit = cleanText(unit);
  if (rateType === "Item Rate") {
    if (safeQuantity === null || safeQuantity <= 0 || !safeUnit || safeUnit !== cleanText(order.unit)) {
      return { isValid: false, error: "Item-rate progress needs a positive quantity in the work-order unit." };
    }
    if (totals.quantity + safeQuantity > normaliseMoney(order.quantity)) {
      return { isValid: false, error: "Progress quantity exceeds the work-order quantity." };
    }
    certifiedAmount = roundedMoney(safeQuantity * normaliseMoney(order.rate));
  } else {
    if (safePercent <= 0) {
      return { isValid: false, error: "Lump-sum or daily work progress needs a positive progress percentage." };
    }
    safeUnit = safeUnit || "%";
    certifiedAmount = roundedMoney(normaliseMoney(order.contractValue) * safePercent / 100);
  }

  if (totals.percent + safePercent > 100 || totals.certifiedAmount + certifiedAmount > normaliseMoney(order.contractValue)) {
    return { isValid: false, error: "Progress exceeds the approved work-order value." };
  }

  return {
    isValid: true,
    value: {
      workOrderId: cleanText(order.id || order.workOrderId),
      workOrderNumber: cleanText(order.workOrderNumber),
      vendorId: cleanText(order.vendorId),
      vendorName: cleanText(order.vendorName),
      site: safeSite,
      date: safeDate,
      quantity: safeQuantity || 0,
      unit: safeUnit,
      progressPercent: safePercent,
      certifiedAmount,
      remarks: cleanText(remarks),
      dprId: cleanText(dprId),
      cumulativeQuantity: roundedMoney(totals.quantity + (safeQuantity || 0)),
      cumulativeProgressPercent: roundedMoney(totals.percent + safePercent),
      cumulativeCertifiedAmount: roundedMoney(totals.certifiedAmount + certifiedAmount),
    },
  };
};

const billTotals = ({
  workOrder = {},
  contractorBills = [],
  currentBillAmount,
  advanceRecovery,
  deductions,
} = {}) => {
  const current = strictNonNegativeNumber(currentBillAmount);
  const requestedAdvanceRecovery = strictNonNegativeNumber(advanceRecovery);
  const safeDeductions = strictNonNegativeNumber(deductions);
  const previousBilledAmount = (Array.isArray(contractorBills) ? contractorBills : [])
    .filter((bill) => bill && cleanText(bill.workOrderId) === cleanText(workOrder.id || workOrder.workOrderId))
    .reduce((total, bill) => total + normaliseMoney(bill.currentBillAmount), 0);
  const retentionPercent = normaliseMoney(workOrder.retentionPercent);
  const retentionAmount = current === null ? 0 : roundedMoney(current * retentionPercent / 100);
  const advanceOutstanding = Math.max(normaliseMoney(workOrder.advanceAmount) - normaliseMoney(workOrder.advanceRecovered), 0);
  const certifiedRemaining = Math.max(normaliseMoney(workOrder.certifiedAmount) - previousBilledAmount, 0);
  const recovery = requestedAdvanceRecovery === null ? null : Math.min(requestedAdvanceRecovery, advanceOutstanding);
  const payableAmount = current === null || recovery === null || safeDeductions === null
    ? null
    : roundedMoney(current - retentionAmount - recovery - safeDeductions);

  return {
    previousBilledAmount: roundedMoney(previousBilledAmount),
    retentionPercent,
    retentionAmount,
    advanceOutstanding: roundedMoney(advanceOutstanding),
    certifiedRemaining: roundedMoney(certifiedRemaining),
    advanceRecovery: recovery,
    deductions: safeDeductions,
    currentBillAmount: current,
    payableAmount,
  };
};

export const validateContractorBill = ({
  workOrder,
  contractorBills = [],
  billDate,
  currentBillAmount,
  advanceRecovery = 0,
  deductions = 0,
  remarks = "",
} = {}) => {
  const order = workOrder && typeof workOrder === "object" ? workOrder : null;
  const date = normaliseDate(billDate);
  const totals = billTotals({ workOrder: order, contractorBills, currentBillAmount, advanceRecovery, deductions });

  if (!order || !date || !["Approved", "Active", "Completed", "Closed"].includes(cleanText(order.status))) {
    return { isValid: false, error: "Select an approved, active, completed, or closed work order." };
  }
  if (totals.currentBillAmount === null || totals.currentBillAmount <= 0 || totals.advanceRecovery === null || totals.deductions === null ||
    totals.currentBillAmount > totals.certifiedRemaining || totals.payableAmount === null || totals.payableAmount < 0) {
    return { isValid: false, error: "Bill amount must not exceed certified work and deductions cannot exceed the current bill." };
  }

  return {
    isValid: true,
    value: {
      workOrderId: cleanText(order.id || order.workOrderId),
      workOrderNumber: cleanText(order.workOrderNumber),
      vendorId: cleanText(order.vendorId),
      vendorName: cleanText(order.vendorName),
      site: getSiteName(order),
      billDate: date,
      certifiedAmount: normaliseMoney(order.certifiedAmount),
      previousBilledAmount: totals.previousBilledAmount,
      currentBillAmount: totals.currentBillAmount,
      retentionPercent: totals.retentionPercent,
      retentionAmount: totals.retentionAmount,
      retentionReleased: 0,
      retentionBalance: totals.retentionAmount,
      advanceRecovery: totals.advanceRecovery,
      deductions: totals.deductions,
      payableAmount: totals.payableAmount,
      paidAmount: 0,
      pendingAmount: totals.payableAmount,
      paymentStatus: "Pending",
      remarks: cleanText(remarks),
    },
  };
};

export const validateContractorPayment = ({
  bill,
  paymentDate,
  amount,
  paymentMode,
  paymentType = "Bill Payment",
  reference = "",
  remarks = "",
} = {}) => {
  const safeAmount = strictNonNegativeNumber(amount);
  const date = normaliseDate(paymentDate);
  const type = cleanText(paymentType) || "Bill Payment";
  const mode = cleanText(paymentMode);

  if (!bill || !date || safeAmount === null || safeAmount <= 0 ||
    !CONTRACTOR_PAYMENT_TYPES.includes(type) || !CONTRACTOR_PAYMENT_MODES.includes(mode)) {
    return { isValid: false, error: "Bill, date, positive amount, payment type, and payment mode are required." };
  }

  const available = type === "Retention Release"
    ? normaliseMoney(bill.retentionBalance)
    : normaliseMoney(bill.pendingAmount);
  if (safeAmount > available) {
    return { isValid: false, error: "Payment cannot exceed the pending bill or retention balance." };
  }

  const paidAmount = type === "Retention Release"
    ? normaliseMoney(bill.paidAmount)
    : roundedMoney(normaliseMoney(bill.paidAmount) + safeAmount);
  const pendingAmount = type === "Retention Release"
    ? normaliseMoney(bill.pendingAmount)
    : roundedMoney(Math.max(normaliseMoney(bill.pendingAmount) - safeAmount, 0));
  const retentionReleased = type === "Retention Release"
    ? roundedMoney(normaliseMoney(bill.retentionReleased) + safeAmount)
    : normaliseMoney(bill.retentionReleased);
  const retentionBalance = type === "Retention Release"
    ? roundedMoney(Math.max(normaliseMoney(bill.retentionBalance) - safeAmount, 0))
    : normaliseMoney(bill.retentionBalance);

  return {
    isValid: true,
    value: {
      contractorBillId: cleanText(bill.id),
      workOrderId: cleanText(bill.workOrderId),
      workOrderNumber: cleanText(bill.workOrderNumber),
      vendorId: cleanText(bill.vendorId),
      vendorName: cleanText(bill.vendorName),
      site: getSiteName(bill),
      paymentDate: date,
      amount: safeAmount,
      paymentMode: mode,
      paymentType: type,
      reference: cleanText(reference),
      remarks: cleanText(remarks),
      billUpdate: {
        paidAmount,
        pendingAmount,
        retentionReleased,
        retentionBalance,
        paymentStatus: pendingAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Pending",
      },
    },
  };
};

export const getSubcontractingSummary = (workOrders = [], contractorBills = [], today = new Date().toISOString().slice(0, 10)) => {
  const orders = (Array.isArray(workOrders) ? workOrders : []).filter((item) => item && typeof item === "object");
  const bills = (Array.isArray(contractorBills) ? contractorBills : []).filter((item) => item && typeof item === "object");
  const currentDate = normaliseDate(today);

  return {
    activeWorkOrders: orders.filter((order) => ["Approved", "Active"].includes(cleanText(order.status))).length,
    totalContractValue: roundedMoney(orders.filter((order) => cleanText(order.status) !== "Cancelled").reduce((total, order) => total + normaliseMoney(order.contractValue), 0)),
    certifiedAmount: roundedMoney(orders.reduce((total, order) => total + normaliseMoney(order.certifiedAmount), 0)),
    pendingPayable: roundedMoney(bills.reduce((total, bill) => total + normaliseMoney(bill.pendingAmount), 0)),
    overdueWorkOrders: orders.filter((order) =>
      ["Approved", "Active"].includes(cleanText(order.status)) &&
      normaliseDate(order.expectedCompletionDate) &&
      normaliseDate(order.expectedCompletionDate) < currentDate
    ).length,
    retentionBalance: roundedMoney(bills.reduce((total, bill) => total + normaliseMoney(bill.retentionBalance), 0)),
    advanceRecoveryPending: roundedMoney(orders.reduce((total, order) =>
      total + Math.max(normaliseMoney(order.advanceAmount) - normaliseMoney(order.advanceRecovered), 0), 0)),
  };
};

export const isContractorExpense = (expense = {}) =>
  cleanKey(expense.sourceType) === "contractorbill" && cleanText(expense.contractorBillId) !== "";