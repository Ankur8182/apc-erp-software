import { getClientBillingSummary } from "./clientBilling";
import { getSiteBoqSummary } from "./boqReporting";
import { getSiteName, isSameSite, normaliseMoney, normaliseStatus } from "./financialReporting";
import { calculatePortfolioFinancialSummary } from "./projectFinancials";

export const PROJECT_HEALTH_STATUSES = Object.freeze(["Healthy", "Attention", "Critical"]);

const safeRecords = (value) => Array.isArray(value)
  ? value.filter((item) => item && typeof item === "object")
  : [];

const money = (value) => Math.round(normaliseMoney(value) * 100) / 100;
const signedMoney = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
};
const percent = (numerator, denominator) => {
  const safeNumerator = Number(numerator);
  const safeDenominator = normaliseMoney(denominator);
  return Number.isFinite(safeNumerator) && safeDenominator > 0
    ? Number((safeNumerator / safeDenominator * 100).toFixed(2))
    : null;
};

const getRowSiteName = (row = {}) => getSiteName(row) || String(row.siteName || row.site || "").trim();

export const getCostBreakdownAnalytics = (financialSummary = {}) => {
  const totalCost = money(financialSummary.totalCost);
  const categories = [
    { key: "material", label: "Materials", amount: money(financialSummary.materialCost) },
    { key: "labour", label: "Labour", amount: money(financialSummary.labourCost) },
    { key: "vehicle", label: "Vehicle", amount: money(financialSummary.vehicleCost) },
    { key: "contractor", label: "Subcontractor", amount: money(financialSummary.contractorCost) },
    { key: "other", label: "Other", amount: money(financialSummary.otherCost) },
  ].map((category) => ({ ...category, percent: percent(category.amount, totalCost) }));
  const nonZeroCategories = categories.filter((category) => category.amount > 0);

  return {
    totalCost,
    categories,
    largestCategory: nonZeroCategories.sort((first, second) => second.amount - first.amount)[0] || null,
  };
};

export const getRevenueCollectionAnalytics = ({ financialSummary = {}, raBills = [], today } = {}) => {
  const billing = getClientBillingSummary({ invoices: [], raBills, today });
  const invoicedRevenue = money(financialSummary.revenue);
  const receivedAmount = money(financialSummary.received);
  const outstandingReceivable = money(financialSummary.outstanding);

  return {
    invoicedRevenue,
    receivedAmount,
    outstandingReceivable,
    collectionPercent: percent(receivedAmount, invoicedRevenue),
    overdueReceivable: money(billing.overdueReceivable),
    retentionOutstanding: money(financialSummary.retention ?? billing.retentionReceivable),
  };
};

export const getBoqPhysicalFinancialAnalytics = (boqSummary = {}) => {
  const revisedBoqValue = money(boqSummary.revisedBoqValue);
  const measuredWorkValue = money(boqSummary.measuredWorkValue);
  const certifiedWorkValue = money(boqSummary.certifiedWorkValue);
  const billedWorkValue = money(boqSummary.billedWorkValue);
  const measuredProgressPercent = boqSummary.itemCount > 0
    ? Number(boqSummary.overallProgressPercent || 0)
    : null;
  const certifiedProgressPercent = percent(certifiedWorkValue, revisedBoqValue);
  const billedProgressPercent = percent(billedWorkValue, revisedBoqValue);
  const billingGapPercent = measuredProgressPercent === null || billedProgressPercent === null
    ? null
    : Number((billedProgressPercent - measuredProgressPercent).toFixed(2));
  let comparison = "Insufficient BOQ data";
  if (billingGapPercent !== null) {
    if (billingGapPercent <= -15) comparison = "Physical progress ahead of billing";
    else if (billingGapPercent >= 15) comparison = "Billing ahead of physical progress";
    else comparison = "Physical and billing progress broadly aligned";
  }

  return {
    hasBoq: Number(boqSummary.itemCount || 0) > 0 && revisedBoqValue > 0,
    itemCount: Number(boqSummary.itemCount || 0),
    originalBoqValue: money(boqSummary.originalBoqValue),
    revisedBoqValue,
    balanceWorkValue: money(boqSummary.balanceWorkValue),
    measuredWorkValue,
    certifiedWorkValue,
    billedWorkValue,
    measuredProgressPercent,
    certifiedProgressPercent,
    billedProgressPercent,
    billingGapPercent,
    comparison,
  };
};

export const getProjectForecast = ({ financialSummary = {}, boqAnalytics = {} } = {}) => {
  const actualCost = money(financialSummary.totalCost);
  const physicalProgressPercent = Number(boqAnalytics.measuredProgressPercent);
  const projectedRevenue = money(boqAnalytics.revisedBoqValue);
  const isUsableProgress = Number.isFinite(physicalProgressPercent) && physicalProgressPercent > 0 && physicalProgressPercent <= 100;

  if (!isUsableProgress || actualCost <= 0 || projectedRevenue <= 0) {
    return {
      status: "Insufficient data",
      projectedFinalCost: null,
      projectedProfit: null,
      projectedMarginPercent: null,
      methodology: "Requires positive actual cost, revised BOQ value, and measured BOQ progress.",
    };
  }

  const projectedFinalCost = signedMoney(actualCost * 100 / physicalProgressPercent);
  const projectedProfit = signedMoney(projectedRevenue - projectedFinalCost);
  return {
    status: "Available",
    projectedFinalCost,
    projectedProfit,
    projectedMarginPercent: percent(projectedProfit, projectedRevenue),
    methodology: "Actual cost ÷ measured BOQ progress × 100; compared with revised BOQ value.",
  };
};

export const getProjectHealth = ({ financialSummary = {}, revenueAnalytics = {}, boqAnalytics = {} } = {}) => {
  const revenue = money(financialSummary.revenue);
  const profit = signedMoney(financialSummary.profit);
  const hasBudget = Boolean(financialSummary.budgetSummary?.hasBudget);
  const budgetUsagePercent = financialSummary.budgetUsagePercent;
  const overBudgetAmount = money(financialSummary.overBudgetAmount);
  const physicalProgressPercent = boqAnalytics.measuredProgressPercent;
  const reasons = [];
  let score = 100;

  const lossMaking = revenue > 0 && profit < 0;
  const highOutstanding = revenue > 0 && money(revenueAnalytics.outstandingReceivable) / revenue >= 0.5;
  const overdueReceivable = money(revenueAnalytics.overdueReceivable) > 0;
  const hasPricedBoq = Boolean(boqAnalytics.hasBoq);
  const hasPhysicalProgress = hasPricedBoq && physicalProgressPercent !== null && physicalProgressPercent !== undefined && physicalProgressPercent !== "" && Number.isFinite(Number(physicalProgressPercent));
  const hasBillingGap = hasPricedBoq && boqAnalytics.billingGapPercent !== null && boqAnalytics.billingGapPercent !== undefined && boqAnalytics.billingGapPercent !== "" && Number.isFinite(Number(boqAnalytics.billingGapPercent));
  const costAheadOfPhysical = hasBudget && hasPhysicalProgress && Number.isFinite(Number(budgetUsagePercent)) && Number(budgetUsagePercent) >= Number(physicalProgressPercent) + 20;
  const billingLag = hasBillingGap && Number(boqAnalytics.billingGapPercent) <= -20;

  if (lossMaking) { score -= 45; reasons.push("Recognized revenue is below canonical actual cost."); }
  if (overBudgetAmount > 0) { score -= 35; reasons.push("Actual cost exceeds the approved budget."); }
  else if (hasBudget && Number(budgetUsagePercent) >= 90) { score -= 20; reasons.push("Budget utilization is at least 90%."); }
  else if (hasBudget && Number(budgetUsagePercent) >= 80) { score -= 10; reasons.push("Budget utilization is at least 80%."); }
  if (highOutstanding) { score -= 15; reasons.push("At least half of invoiced revenue remains outstanding."); }
  if (overdueReceivable) { score -= 15; reasons.push("There are overdue client receivables."); }
  if (costAheadOfPhysical) { score -= 20; reasons.push("Cost progress is materially ahead of measured physical progress."); }
  if (billingLag) { score -= 10; reasons.push("Measured physical progress is materially ahead of BOQ billing progress."); }

  const hasReliableSignal = revenue > 0 || money(financialSummary.totalCost) > 0 || hasBudget || boqAnalytics.hasBoq;
  if (!hasReliableSignal) {
    return { status: "Attention", score: null, reasons: ["Insufficient financial, budget, and BOQ data for a health score."], lossMaking, overBudget: false, highOutstanding, overdueReceivable, costAheadOfPhysical, billingLag };
  }

  const boundedScore = Math.max(0, score);
  const status = lossMaking || overBudgetAmount > 0 || boundedScore < 50
    ? "Critical"
    : boundedScore < 75
      ? "Attention"
      : "Healthy";
  return { status, score: boundedScore, reasons, lossMaking, overBudget: overBudgetAmount > 0, highOutstanding, overdueReceivable, costAheadOfPhysical, billingLag };
};

export const buildProjectAnalyticsRows = ({ siteRows = [], boqItems = [], boqMeasurements = [], boqVariations = [], raBills = [], today } = {}) =>
  safeRecords(siteRows).map((row) => {
    const siteName = getRowSiteName(row);
    const siteRABills = safeRecords(raBills).filter((bill) => isSameSite(bill, siteName));
    const boqSummary = getSiteBoqSummary({ site: siteName, items: boqItems, measurements: boqMeasurements, variations: boqVariations, raBills: siteRABills });
    const revenueAnalytics = getRevenueCollectionAnalytics({ financialSummary: row, raBills: siteRABills, today });
    const costBreakdown = getCostBreakdownAnalytics(row);
    const boqAnalytics = getBoqPhysicalFinancialAnalytics(boqSummary);
    const forecast = getProjectForecast({ financialSummary: row, boqAnalytics });
    const health = getProjectHealth({ financialSummary: row, revenueAnalytics, boqAnalytics });
    return { ...row, siteName, costBreakdown, revenueAnalytics, boqAnalytics, forecast, health };
  });

export const calculatePortfolioAnalytics = (rows = []) => {
  const safeRows = safeRecords(rows);
  const financial = calculatePortfolioFinancialSummary(safeRows);
  const categories = ["material", "labour", "vehicle", "contractor", "other"].map((key) => {
    const label = safeRows.find((row) => row.costBreakdown?.categories?.find((category) => category.key === key))?.costBreakdown.categories.find((category) => category.key === key)?.label || key;
    const amount = money(safeRows.reduce((total, row) => total + money(row.costBreakdown?.categories?.find((category) => category.key === key)?.amount), 0));
    return { key, label, amount, percent: percent(amount, financial.totalCost) };
  });
  const nonZeroCategories = categories.filter((category) => category.amount > 0);
  return {
    ...financial,
    totalInvoiced: financial.revenue,
    totalReceived: financial.received,
    totalOutstanding: financial.outstanding,
    totalOverdueReceivable: money(safeRows.reduce((total, row) => total + money(row.revenueAnalytics?.overdueReceivable), 0)),
    profitableSites: safeRows.filter((row) => money(row.revenue) > 0 && signedMoney(row.profit) >= 0).length,
    criticalProjects: safeRows.filter((row) => row.health?.status === "Critical").length,
    attentionProjects: safeRows.filter((row) => row.health?.status === "Attention").length,
    costBreakdown: categories,
    largestCostCategory: nonZeroCategories.sort((first, second) => second.amount - first.amount)[0] || null,
  };
};

export const filterProjectAnalyticsRows = (rows = [], filters = {}) => {
  const projectStatus = String(filters.projectStatus || "").trim().toLowerCase();
  const profitability = String(filters.profitability || "").trim().toLowerCase();
  const budget = String(filters.budget || "").trim().toLowerCase();
  const health = String(filters.health || "").trim().toLowerCase();
  return safeRecords(rows).filter((row) =>
    (!projectStatus || normaliseStatus(row.status) === projectStatus) &&
    (!profitability || (profitability === "profitable" ? money(row.revenue) > 0 && signedMoney(row.profit) >= 0 : money(row.revenue) > 0 && signedMoney(row.profit) < 0)) &&
    (!budget || (budget === "over-budget" ? money(row.overBudgetAmount) > 0 : Boolean(row.budgetSummary?.hasBudget))) &&
    (!health || String(row.health?.status || "").toLowerCase() === health)
  );
};

export const formatAnalyticsPercent = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "N/A";