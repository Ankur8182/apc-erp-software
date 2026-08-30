import {
  buildProjectAnalyticsRows,
  calculatePortfolioAnalytics,
  filterProjectAnalyticsRows,
  getBoqPhysicalFinancialAnalytics,
  getCostBreakdownAnalytics,
  getProjectForecast,
  getProjectHealth,
  getRevenueCollectionAnalytics,
} from "./projectAnalytics";

const financial = {
  siteName: "River View", revenue: 1000, received: 400, outstanding: 600, retention: 50,
  materialCost: 100, labourCost: 150, vehicleCost: 50, contractorCost: 200, otherCost: 100,
  totalCost: 600, profit: 400, totalBudget: 700, budgetUsagePercent: 85, overBudgetAmount: 0,
  budgetSummary: { hasBudget: true }, status: "Running",
};

const boq = {
  itemCount: 1, originalBoqValue: 1000, revisedBoqValue: 1200, balanceWorkValue: 600,
  measuredWorkValue: 600, certifiedWorkValue: 500, billedWorkValue: 400, overallProgressPercent: 50,
};

describe("project profitability analytics", () => {
  it("uses the canonical cost categories exactly once and identifies the top cost driver", () => {
    const breakdown = getCostBreakdownAnalytics(financial);
    expect(breakdown.totalCost).toBe(600);
    expect(breakdown.categories.reduce((total, item) => total + item.amount, 0)).toBe(600);
    expect(breakdown.largestCategory).toMatchObject({ key: "contractor", amount: 200, percent: expect.closeTo(33.33, 2) });
  });

  it("keeps revenue, receipts, outstanding, overdue, and retention separate", () => {
    const analytics = getRevenueCollectionAnalytics({ financialSummary: financial, today: "2026-08-30", raBills: [{ status: "Partially Paid", paymentDueDate: "2026-08-20", pendingAmount: 200, retentionBalance: 50 }] });
    expect(analytics).toMatchObject({ invoicedRevenue: 1000, receivedAmount: 400, outstandingReceivable: 600, collectionPercent: 40, overdueReceivable: 200, retentionOutstanding: 50 });
  });

  it("compares BOQ physical, certified, and billed progress without mixing quantity ledgers", () => {
    const analytics = getBoqPhysicalFinancialAnalytics(boq);
    expect(analytics).toMatchObject({ hasBoq: true, measuredProgressPercent: 50, certifiedProgressPercent: expect.closeTo(41.67, 2), billedProgressPercent: expect.closeTo(33.33, 2), comparison: "Physical progress ahead of billing" });
  });

  it("returns a transparent forecast only when BOQ progress, cost, and value are sufficient", () => {
    expect(getProjectForecast({ financialSummary: financial, boqAnalytics: getBoqPhysicalFinancialAnalytics(boq) })).toMatchObject({ status: "Available", projectedFinalCost: 1200, projectedProfit: 0, projectedMarginPercent: 0 });
    expect(getProjectForecast({ financialSummary: { totalCost: 100 }, boqAnalytics: { measuredProgressPercent: 0, revisedBoqValue: 1000 } }).status).toBe("Insufficient data");
  });

  it("classifies project health deterministically and handles incomplete data safely", () => {
    expect(getProjectHealth({ financialSummary: financial, revenueAnalytics: { outstandingReceivable: 600, overdueReceivable: 200 }, boqAnalytics: getBoqPhysicalFinancialAnalytics(boq) })).toMatchObject({ status: "Critical", highOutstanding: true, overdueReceivable: true });
    expect(getProjectHealth({ financialSummary: { revenue: 100, profit: -20, totalCost: 120, overBudgetAmount: 20, budgetSummary: { hasBudget: true } }, revenueAnalytics: {}, boqAnalytics: {} }).status).toBe("Critical");
    expect(getProjectHealth({ financialSummary: {}, revenueAnalytics: {}, boqAnalytics: {} })).toMatchObject({ status: "Attention", score: null });
    expect(getProjectHealth({
      financialSummary: { revenue: 1000, profit: 200, totalCost: 800, budgetUsagePercent: 80, budgetSummary: { hasBudget: true } },
      revenueAnalytics: {},
      boqAnalytics: {},
    }).costAheadOfPhysical).toBe(false);
  });

  it("aggregates sites with the same canonical totals and filters management views", () => {
    const rows = buildProjectAnalyticsRows({
      siteRows: [financial, { ...financial, id: "hill", siteName: "Hill Top", revenue: 500, received: 500, outstanding: 0, totalCost: 700, profit: -200, materialCost: 200, labourCost: 200, contractorCost: 100, vehicleCost: 100, otherCost: 100, overBudgetAmount: 100, budgetSummary: { hasBudget: true } }],
      boqItems: [{ id: "boq-river", site: "River View", itemNumber: "1", description: "Concrete", unit: "Cum", plannedQuantity: 10, rate: 100 }],
      boqMeasurements: [{ id: "measure-river", boqItemId: "boq-river", quantity: 5, status: "Certified" }],
      raBills: [{ id: "ra-river", site: "River View", status: "Partially Paid", paymentDueDate: "2026-08-20", pendingAmount: 200, retentionBalance: 50 }],
      today: "2026-08-30",
    });
    const portfolio = calculatePortfolioAnalytics(rows);
    expect(portfolio).toMatchObject({ revenue: 1500, totalCost: 1300, profit: 200, profitableSites: 1, lossMakingSites: 1, criticalProjects: 2 });
    expect(filterProjectAnalyticsRows(rows, { profitability: "loss-making" })).toHaveLength(1);
    expect(filterProjectAnalyticsRows(rows, { budget: "over-budget" })).toHaveLength(1);
  });

  it("normalizes missing and malformed legacy values without false financial signals", () => {
    const breakdown = getCostBreakdownAnalytics({ totalCost: "bad", materialCost: "invalid", labourCost: -50 });
    expect(breakdown).toMatchObject({ totalCost: 0, largestCategory: null });
    expect(getRevenueCollectionAnalytics({ financialSummary: { revenue: "bad", received: "bad", outstanding: "bad" } }).collectionPercent).toBeNull();
  });
});