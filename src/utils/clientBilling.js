import {
  getInvoiceSummary,
  getSiteName,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "./financialReporting";

export const CLIENT_STATUSES = ["active", "inactive"];
export const BILLING_TYPES = ["Running Account", "Milestone", "Lump Sum", "Other"];
export const RA_BILL_STATUSES = ["Draft", "Submitted", "Certified", "Partially Paid", "Paid", "Rejected", "Cancelled"];
export const RECEIPT_PAYMENT_MODES = ["Bank Transfer", "Cheque", "UPI", "Cash", "Other"];

const cleanText = (value) => String(value ?? "").trim();
const cleanRole = (value) => cleanText(value).toLowerCase();
const money = (value) => Math.round(normaliseMoney(value) * 100) / 100;
const nonNegative = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const validPercent = (value) => {
  const parsed = nonNegative(value);
  return parsed === null || parsed > 100 ? null : parsed;
};

export const canManageClientBilling = (role) => ["admin", "manager"].includes(cleanRole(role));

export const createInitialClientForm = () => ({
  clientName: "", contactPerson: "", mobile: "", email: "", gstin: "", panNumber: "",
  billingAddress: "", notes: "", status: "active",
});

export const validateClient = (form = {}) => {
  const clientName = cleanText(form.clientName);
  const mobile = cleanText(form.mobile);
  const email = cleanText(form.email);
  const status = cleanText(form.status).toLowerCase() || "active";
  if (!clientName) return { isValid: false, error: "Client/company name is required." };
  if (mobile && !/^\d{10}$/.test(mobile)) return { isValid: false, error: "Mobile number must contain 10 digits." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { isValid: false, error: "Enter a valid email address." };
  if (!CLIENT_STATUSES.includes(status)) return { isValid: false, error: "Client status is invalid." };
  return { isValid: true, value: {
    clientName, contactPerson: cleanText(form.contactPerson), mobile, email,
    gstin: cleanText(form.gstin).toUpperCase(), panNumber: cleanText(form.panNumber).toUpperCase(),
    billingAddress: cleanText(form.billingAddress), notes: cleanText(form.notes), status,
  }};
};

export const createInitialBillingProfileForm = () => ({
  siteId: "", siteName: "", clientId: "", clientName: "", agreementNumber: "", contractValue: "",
  startDate: new Date().toISOString().slice(0, 10), completionDate: "", billingType: "Running Account",
  gstApplicable: "yes", gstRate: "18", retentionPercent: "0", securityDeposit: "0", advanceReceived: "0",
  paymentTerms: "", remarks: "",
});

export const validateBillingProfile = (form = {}) => {
  const contractValue = nonNegative(form.contractValue);
  const gstRate = validPercent(form.gstRate);
  const retentionPercent = validPercent(form.retentionPercent);
  const securityDeposit = nonNegative(form.securityDeposit);
  const advanceReceived = nonNegative(form.advanceReceived);
  const startDate = normaliseDate(form.startDate);
  const completionDate = normaliseDate(form.completionDate);
  const billingType = cleanText(form.billingType) || "Running Account";
  const siteName = normaliseSiteName(form.siteName);
  if (!cleanText(form.siteId) || !siteName || !cleanText(form.clientId) || !cleanText(form.clientName) ||
    !cleanText(form.agreementNumber) || !startDate || !completionDate) {
    return { isValid: false, error: "Site, client, agreement number, and contract dates are required." };
  }
  if (contractValue === null || contractValue <= 0 || gstRate === null || retentionPercent === null ||
    securityDeposit === null || advanceReceived === null || !BILLING_TYPES.includes(billingType) || completionDate < startDate) {
    return { isValid: false, error: "Enter valid non-negative contract, tax, retention, advance, and date values." };
  }
  return { isValid: true, value: {
    siteId: cleanText(form.siteId), siteName, clientId: cleanText(form.clientId), clientName: cleanText(form.clientName),
    agreementNumber: cleanText(form.agreementNumber), contractValue: money(contractValue), startDate, completionDate,
    billingType, gstApplicable: String(form.gstApplicable).toLowerCase() !== "no", gstRate: money(gstRate),
    retentionPercent: money(retentionPercent), securityDeposit: money(securityDeposit), advanceReceived: money(advanceReceived),
    paymentTerms: cleanText(form.paymentTerms), remarks: cleanText(form.remarks),
  }};
};

export const createInitialRABillForm = () => ({
  siteId: "", clientId: "", billingPeriodFrom: new Date().toISOString().slice(0, 10), billingPeriodTo: new Date().toISOString().slice(0, 10),
  billDate: new Date().toISOString().slice(0, 10), paymentDueDate: "", currentWorkValue: "", variationAmount: "0",
  materialAdvanceRecovery: "0", advanceAdjustment: "0", otherDeductions: "0", tdsPercent: "0", remarks: "",
});

export const calculateRABill = (form = {}, profile = {}) => {
  const currentWorkValue = nonNegative(form.currentWorkValue);
  const variationAmount = nonNegative(form.variationAmount ?? 0);
  const materialAdvanceRecovery = nonNegative(form.materialAdvanceRecovery ?? 0);
  const advanceAdjustment = nonNegative(form.advanceAdjustment ?? 0);
  const otherDeductions = nonNegative(form.otherDeductions ?? 0);
  const tdsPercent = validPercent(form.tdsPercent ?? 0);
  const gstRate = profile.gstApplicable === false ? 0 : money(profile.gstRate);
  const retentionPercent = money(profile.retentionPercent);
  if ([currentWorkValue, variationAmount, materialAdvanceRecovery, advanceAdjustment, otherDeductions, tdsPercent].some((item) => item === null)) return null;
  const grossWorkValue = money(currentWorkValue + variationAmount);
  const retentionAmount = money(grossWorkValue * retentionPercent / 100);
  const tdsAmount = money(grossWorkValue * tdsPercent / 100);
  const gstAmount = money(grossWorkValue * gstRate / 100);
  const recoveries = money(materialAdvanceRecovery + advanceAdjustment + otherDeductions);
  const netBillAmount = money(grossWorkValue + gstAmount - retentionAmount - tdsAmount - recoveries);
  return { currentWorkValue: money(currentWorkValue), variationAmount: money(variationAmount), grossWorkValue,
    materialAdvanceRecovery: money(materialAdvanceRecovery), advanceAdjustment: money(advanceAdjustment),
    otherDeductions: money(otherDeductions), recoveries, retentionPercent, retentionAmount, tdsPercent: money(tdsPercent),
    tdsAmount, gstRate, gstAmount, netBillAmount };
};

export const validateRABill = ({ form = {}, profile } = {}) => {
  const calculated = calculateRABill(form, profile);
  const periodFrom = normaliseDate(form.billingPeriodFrom);
  const periodTo = normaliseDate(form.billingPeriodTo);
  const billDate = normaliseDate(form.billDate);
  const paymentDueDate = normaliseDate(form.paymentDueDate);
  if (!profile || !periodFrom || !periodTo || !billDate || !paymentDueDate || periodTo < periodFrom || paymentDueDate < billDate || !calculated) {
    return { isValid: false, error: "Select a billing profile and valid billing-period, bill, and payment-due dates." };
  }
  if (calculated.currentWorkValue <= 0 || calculated.netBillAmount < 0 || calculated.recoveries > calculated.grossWorkValue + calculated.gstAmount - calculated.retentionAmount - calculated.tdsAmount) {
    return { isValid: false, error: "Current work must be positive and recoveries cannot exceed the bill value." };
  }
  const previousCertifiedAmount = money(profile.certifiedWorkValue);
  const contractRemaining = money(profile.contractValue - previousCertifiedAmount);
  const advanceBalance = money(profile.advanceReceived - profile.advanceAdjusted);
  if (calculated.grossWorkValue > contractRemaining || calculated.advanceAdjustment > advanceBalance) {
    return { isValid: false, error: "Work value exceeds the remaining contract or advance adjustment exceeds the available client advance." };
  }
  return { isValid: true, value: {
    siteId: cleanText(profile.siteId), site: normaliseSiteName(profile.siteName), clientId: cleanText(profile.clientId), clientName: cleanText(profile.clientName),
    agreementNumber: cleanText(profile.agreementNumber), billingPeriodFrom: periodFrom, billingPeriodTo: periodTo, billDate,
    paymentDueDate, previousCertifiedAmount, cumulativeCertifiedAmount: money(previousCertifiedAmount + calculated.grossWorkValue),
    ...calculated, status: "Draft", receivedAmount: 0, pendingAmount: calculated.netBillAmount,
    retentionReleased: 0, retentionBalance: calculated.retentionAmount, linkedInvoiceId: "", lastReceiptId: "", lastRetentionReleaseId: "",
    remarks: cleanText(form.remarks),
  }};
};

export const buildRABillNumber = (bills = [], date = new Date()) => {
  const prefix = "RA-" + date.getFullYear() + "-";
  const used = new Set((Array.isArray(bills) ? bills : []).map((bill) => cleanText(bill?.raBillNumber || bill?.id)).filter((value) => value.startsWith(prefix)));
  let sequence = used.size + 1;
  let number = prefix + String(sequence).padStart(4, "0");
  while (used.has(number)) { sequence += 1; number = prefix + String(sequence).padStart(4, "0"); }
  return number;
};

export const canTransitionRABill = (currentStatus, nextStatus) => {
  const current = cleanText(currentStatus) || "Draft";
  const next = cleanText(nextStatus);
  if (!RA_BILL_STATUSES.includes(current) || !RA_BILL_STATUSES.includes(next)) return false;
  if (current === next) return true;
  return (current === "Draft" && ["Submitted", "Cancelled"].includes(next)) ||
    (current === "Submitted" && ["Certified", "Rejected", "Cancelled"].includes(next)) ||
    (current === "Certified" && ["Partially Paid", "Paid"].includes(next)) ||
    (current === "Partially Paid" && next === "Paid");
};

export const buildClientReceiptKey = ({ billId, receiptDate, reference = "", amount, tdsDeducted = 0 } = {}) => {
  const source = [cleanText(billId), normaliseDate(receiptDate), cleanText(reference) || "no-reference", cleanText(amount), cleanText(tdsDeducted)].join("|");
  const compact = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
  return compact ? "receipt-" + compact : "";
};

export const validateClientReceipt = ({ bill, receiptDate, amount, paymentMode, reference = "", tdsDeducted = 0, remarks = "" } = {}) => {
  const cashAmount = nonNegative(amount);
  const tds = nonNegative(tdsDeducted);
  const date = normaliseDate(receiptDate);
  const mode = cleanText(paymentMode);
  if (!bill || !date || cashAmount === null || cashAmount <= 0 || tds === null || !RECEIPT_PAYMENT_MODES.includes(mode)) {
    return { isValid: false, error: "Bill, receipt date, positive amount, TDS, and payment mode are required." };
  }
  const creditedAmount = money(cashAmount + tds);
  const pending = money(bill.pendingAmount);
  if (creditedAmount > pending) return { isValid: false, error: "Receipt plus TDS cannot exceed the pending receivable." };
  const receivedAmount = money(money(bill.receivedAmount) + creditedAmount);
  const pendingAmount = money(pending - creditedAmount);
  const receiptKey = buildClientReceiptKey({ billId: bill.id, receiptDate: date, reference, amount: cashAmount, tdsDeducted: tds });
  if (!receiptKey) return { isValid: false, error: "Receipt reference data is invalid." };
  return { isValid: true, value: {
    receiptKey, raBillId: cleanText(bill.id), raBillNumber: cleanText(bill.raBillNumber), linkedInvoiceId: cleanText(bill.linkedInvoiceId),
    siteId: cleanText(bill.siteId), site: getSiteName(bill), clientId: cleanText(bill.clientId), clientName: cleanText(bill.clientName),
    receiptDate: date, amount: money(cashAmount), tdsDeducted: money(tds), creditedAmount, paymentMode: mode,
    reference: cleanText(reference), remarks: cleanText(remarks), billUpdate: {
      receivedAmount, pendingAmount, status: pendingAmount === 0 ? "Paid" : "Partially Paid",
    },
  }};
};

export const validateRetentionRelease = ({ bill, releaseDate, amount, paymentMode, reference = "", remarks = "" } = {}) => {
  const releaseAmount = nonNegative(amount);
  const date = normaliseDate(releaseDate);
  const mode = cleanText(paymentMode);
  if (!bill || !date || releaseAmount === null || releaseAmount <= 0 || !RECEIPT_PAYMENT_MODES.includes(mode)) return { isValid: false, error: "Bill, release date, positive amount, and payment mode are required." };
  if (releaseAmount > money(bill.retentionBalance)) return { isValid: false, error: "Retention release cannot exceed the pending retention balance." };
  return { isValid: true, value: {
    raBillId: cleanText(bill.id), raBillNumber: cleanText(bill.raBillNumber), siteId: cleanText(bill.siteId), site: getSiteName(bill), clientId: cleanText(bill.clientId), clientName: cleanText(bill.clientName),
    releaseDate: date, amount: money(releaseAmount), paymentMode: mode, reference: cleanText(reference), remarks: cleanText(remarks),
    billUpdate: { retentionReleased: money(money(bill.retentionReleased) + releaseAmount), retentionBalance: money(money(bill.retentionBalance) - releaseAmount) },
  }};
};

export const getClientBillingSummary = ({ invoices = [], raBills = [], today = new Date().toISOString().slice(0, 10) } = {}) => {
  const canonicalInvoices = (Array.isArray(invoices) ? invoices : []).filter((item) => item && typeof item === "object");
  const bills = (Array.isArray(raBills) ? raBills : []).filter((item) => item && typeof item === "object");
  const invoiceSummary = canonicalInvoices.reduce((summary, invoice) => {
    const values = getInvoiceSummary(invoice);
    return { billed: summary.billed + values.total, received: summary.received + values.received, pending: summary.pending + values.pending };
  }, { billed: 0, received: 0, pending: 0 });
  const safeToday = normaliseDate(today);
  return {
    totalClientBilling: money(invoiceSummary.billed), totalReceived: money(invoiceSummary.received), outstandingReceivable: money(invoiceSummary.pending),
    certifiedRABillCount: bills.filter((bill) => ["Certified", "Partially Paid", "Paid"].includes(cleanText(bill.status))).length,
    retentionReceivable: money(bills.reduce((sum, bill) => sum + money(bill.retentionBalance), 0)),
    overdueReceivable: money(bills.filter((bill) => ["Certified", "Partially Paid"].includes(cleanText(bill.status)) && normaliseDate(bill.paymentDueDate) && normaliseDate(bill.paymentDueDate) < safeToday).reduce((sum, bill) => sum + money(bill.pendingAmount), 0)),
    pendingCertificationCount: bills.filter((bill) => cleanText(bill.status) === "Submitted").length,
  };
};

export const isRABillIncomeInvoice = (invoice = {}) => cleanText(invoice.sourceType).toLowerCase() === "rabill" && cleanText(invoice.raBillId) !== "";