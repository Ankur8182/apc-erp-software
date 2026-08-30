import {
  calculateFinancialSummary,
  getRecordDate,
  getSiteName,
  isDateInRange,
  isSameSite,
  normaliseMoney,
  normaliseSiteName,
} from "./financialReporting";
import { calculateSiteBudgetSummary } from "./siteBudget";
import { getClientBillingSummary } from "./clientBilling";
import { isContractorExpense } from "./subcontracting";

// Financial source of truth: invoices are revenue/receipt records; materials,
// payroll/attendance, vehicle expenses and the expenses ledger are cost records.
// A contractor bill is operational only because it creates one sourceType:
// contractorBill expense. Purchase orders, GRNs, work orders, payments, DPRs,
// and client receipts are never added as a second financial source.
export const PROJECT_FINANCIAL_SOURCES = Object.freeze({
  revenue: "invoices (including the invoice linked to a certified RA bill)",
  receipts: "invoices.paidAmount / received amount only",
  materialCost: "materials purchases plus explicitly Material expenses",
  labourCost: "payroll, uncovered attendance wages, plus Labour expenses",
  contractorCost: "expenses where sourceType is contractorBill",
  vehicleCost: "vehicleExpenses ledger with legacy vehicle fallback",
  otherCost: "non-material, non-labour, non-contractor expenses",
  excludedOperationalSources: "purchase orders, GRNs, work orders, contractor payments, client receipts, DPRs",
});

const safeRecords = (records) => Array.isArray(records)
  ? records.filter((item) => item && typeof item === "object")
  : [];

const roundMoney = (value) => Math.round(normaliseMoney(value) * 100) / 100;
const roundSignedMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};
const percentage = (numerator, denominator) => {
  const safeDenominator = normaliseMoney(denominator);
  const signedNumerator = Number(numerator);
  return safeDenominator > 0 && Number.isFinite(signedNumerator)
    ? Number(((signedNumerator / safeDenominator) * 100).toFixed(2))
    : null;
};

export const getContractorCost = (expenses = []) => roundMoney(
  safeRecords(expenses).reduce(
    (total, expense) => total + (isContractorExpense(expense)
      ? normaliseMoney(expense.amount ?? expense.expenseAmount ?? expense.totalAmount)
      : 0),
    0
  )
);

export const calculateProjectFinancialSummary = ({
  budgetRecord = {},
  raBills = [],
  ...financialRecords
} = {}) => {
  const financial = calculateFinancialSummary(financialRecords);
  const contractorCost = getContractorCost(financialRecords.expenses);
  // Contractor expenses are already inside otherExpenseFromExpenses. Remove
  // them here so categories reconcile without charging them twice.
  const otherCost = roundMoney(Math.max(
    normaliseMoney(financial.otherExpenseFromExpenses) - contractorCost,
    0
  ));
  const totalCost = roundMoney(
    normaliseMoney(financial.materialExpense) +
    normaliseMoney(financial.labourExpense) +
    contractorCost +
    normaliseMoney(financial.vehicleExpense) +
    otherCost
  );
  const revenue = roundMoney(financial.income);
  const received = roundMoney(financial.received);
  const outstanding = roundMoney(financial.pending);
  const clientBilling = getClientBillingSummary({
    invoices: financialRecords.invoices,
    raBills,
  });
  const budgetSummary = calculateSiteBudgetSummary(budgetRecord, {
    ...financial,
    contractorExpense: contractorCost,
  });
  const profit = roundSignedMoney(revenue - totalCost);

  return {
    ...financial,
    materialCost: roundMoney(financial.materialExpense),
    labourCost: roundMoney(financial.labourExpense),
    contractorCost,
    vehicleCost: roundMoney(financial.vehicleExpense),
    otherCost,
    totalCost,
    revenue,
    received,
    outstanding,
    retention: roundMoney(clientBilling.retentionReceivable),
    profit,
    marginPercent: percentage(profit, revenue),
    costToRevenuePercent: percentage(totalCost, revenue),
    budgetSummary,
    totalBudget: budgetSummary.totalBudget,
    budgetRemaining: budgetSummary.remainingBudget === null
      ? null
      : roundSignedMoney(budgetSummary.remainingBudget),
    budgetUsagePercent: budgetSummary.usagePercent,
    overBudgetAmount: budgetSummary.overBudgetAmount,
    budgetStatus: budgetSummary.status === "on-track" ? "healthy" : budgetSummary.status,
  };
};

const SITE_RECORD_KEYS = [
  "invoices", "expenses", "materials", "labours", "salaries", "attendance",
  "vehicles", "vehicleExpenses", "raBills",
];

export const buildSiteFinancialRows = ({
  sites = [],
  siteBudgets = [],
  ...records
} = {}) => {
  const siteMap = new Map();
  const addSite = (item, details = {}) => {
    const siteName = getSiteName(item);
    const key = normaliseSiteName(siteName).toLowerCase();
    if (!key || siteMap.has(key)) return;
    siteMap.set(key, {
      id: details.id || item?.id || key,
      siteName,
      location: details.location || item?.location || "-",
      status: details.status || item?.status || "Running",
    });
  };

  safeRecords(sites).forEach((site) => addSite(site, site));
  SITE_RECORD_KEYS.forEach((key) => safeRecords(records[key]).forEach(addSite));

  return Array.from(siteMap.values()).map((site) => {
    const scopedRecords = Object.fromEntries(
      SITE_RECORD_KEYS.map((key) => [key, safeRecords(records[key]).filter((item) => isSameSite(item, site.siteName))])
    );
    const budgetRecord = safeRecords(siteBudgets).find((budget) =>
      budget.siteId === site.id || budget.id === site.id || isSameSite(budget, site.siteName)
    ) || site;
    const summary = calculateProjectFinancialSummary({
      ...scopedRecords,
      budgetRecord,
      // Salary coverage must keep the worker-period safeguard even when a
      // page currently filters displayed salary records by date.
      attendanceSalaryCoverage: safeRecords(records.attendanceSalaryCoverage || records.salaries)
        .filter((item) => isSameSite(item, site.siteName)),
      vehicleExpenseCoverage: safeRecords(records.vehicleExpenseCoverage || records.vehicleExpenses)
        .filter((item) => isSameSite(item, site.siteName)),
    });
    return { ...site, ...summary };
  }).sort((first, second) => first.siteName.localeCompare(second.siteName));
};

export const calculatePortfolioFinancialSummary = (siteRows = []) => {
  const rows = safeRecords(siteRows);
  const totals = rows.reduce((summary, row) => ({
    revenue: summary.revenue + normaliseMoney(row.revenue),
    received: summary.received + normaliseMoney(row.received),
    outstanding: summary.outstanding + normaliseMoney(row.outstanding),
    retention: summary.retention + normaliseMoney(row.retention),
    materialCost: summary.materialCost + normaliseMoney(row.materialCost),
    labourCost: summary.labourCost + normaliseMoney(row.labourCost),
    contractorCost: summary.contractorCost + normaliseMoney(row.contractorCost),
    vehicleCost: summary.vehicleCost + normaliseMoney(row.vehicleCost),
    otherCost: summary.otherCost + normaliseMoney(row.otherCost),
    totalCost: summary.totalCost + normaliseMoney(row.totalCost),
    totalBudget: summary.totalBudget + (row.budgetSummary?.hasBudget ? normaliseMoney(row.totalBudget) : 0),
    overBudgetAmount: summary.overBudgetAmount + normaliseMoney(row.overBudgetAmount),
  }), {
    revenue: 0, received: 0, outstanding: 0, retention: 0, materialCost: 0,
    labourCost: 0, contractorCost: 0, vehicleCost: 0, otherCost: 0,
    totalCost: 0, totalBudget: 0, overBudgetAmount: 0,
  });
  const profit = roundSignedMoney(totals.revenue - totals.totalCost);
  const budgetedRows = rows.filter((row) => row.budgetSummary?.hasBudget);
  const budgetUsagePercent = totals.totalBudget > 0
    ? percentage(totals.totalCost, totals.totalBudget)
    : null;
  return {
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])),
    profit,
    marginPercent: percentage(profit, totals.revenue),
    costToRevenuePercent: percentage(totals.totalCost, totals.revenue),
    budgetRemaining: totals.totalBudget > 0 ? roundSignedMoney(totals.totalBudget - totals.totalCost) : null,
    budgetUsagePercent,
    sitesOverBudget: rows.filter((row) => normaliseMoney(row.overBudgetAmount) > 0).length,
    lossMakingSites: rows.filter((row) => normaliseMoney(row.revenue) > 0 && Number(row.profit) < 0).length,
    budgetedSiteCount: budgetedRows.length,
    mostProfitableSites: [...rows].filter((row) => normaliseMoney(row.revenue) > 0).sort((a, b) => b.profit - a.profit).slice(0, 5),
    lossMakingSiteRows: [...rows].filter((row) => normaliseMoney(row.revenue) > 0 && Number(row.profit) < 0).sort((a, b) => a.profit - b.profit),
  };
};

export const buildMonthlyFinancialTrend = ({
  invoices = [], expenses = [], materials = [], labours = [], salaries = [],
  attendance = [], vehicles = [], vehicleExpenses = [], raBills = [],
} = {}) => {
  const datedRecords = [invoices, expenses, materials, salaries, attendance, vehicles, vehicleExpenses]
    .flatMap(safeRecords);
  const months = [...new Set(datedRecords.map((item) => getRecordDate(item).slice(0, 7)).filter(Boolean))].sort();
  return months.map((month) => {
    const inMonth = (records) => safeRecords(records).filter((item) => getRecordDate(item).slice(0, 7) === month);
    const summary = calculateProjectFinancialSummary({
      invoices: inMonth(invoices), expenses: inMonth(expenses), materials: inMonth(materials),
      labours: safeRecords(labours), salaries: inMonth(salaries), attendance: inMonth(attendance),
      attendanceSalaryCoverage: safeRecords(salaries), vehicles: inMonth(vehicles),
      vehicleExpenses: inMonth(vehicleExpenses), vehicleExpenseCoverage: safeRecords(vehicleExpenses),
      raBills: safeRecords(raBills).filter((bill) => String(bill.billDate || "").slice(0, 7) === month),
    });
    return { month, revenue: summary.revenue, cost: summary.totalCost, profit: summary.profit };
  });
};

export const canViewProjectFinancials = (role) =>
  ["admin", "manager", "viewer"].includes(String(role || "").trim().toLowerCase());

export const isFinancialRecordInRange = (record, fromDate, toDate) =>
  isDateInRange(record, fromDate, toDate);