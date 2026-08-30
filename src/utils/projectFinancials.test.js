import {
  buildMonthlyFinancialTrend,
  buildSiteFinancialRows,
  calculatePortfolioFinancialSummary,
  calculateProjectFinancialSummary,
  canViewProjectFinancials,
  getContractorCost,
} from "./projectFinancials";

const riverRecords = {
  invoices: [{ id: "invoice-ra-1", site: "River View", totalAmount: 1000, paidAmount: 400, invoiceDate: "2026-08-10", sourceType: "raBill", raBillId: "ra-1" }],
  expenses: [
    { id: "material-expense", site: "River View", expenseType: "Material", amount: 10, date: "2026-08-10" },
    { id: "labour-expense", site: "River View", expenseType: "Labour", amount: 20, date: "2026-08-10" },
    { id: "contractor-expense", site: "River View", sourceType: "contractorBill", contractorBillId: "contractor-bill-1", expenseType: "Subcontractor", amount: 100, date: "2026-08-11" },
    { id: "other-expense", site: "River View", expenseType: "Other", amount: 30, date: "2026-08-12" },
  ],
  materials: [{ id: "material-purchase", site: "River View", totalAmount: 50, date: "2026-08-10" }],
  labours: [{ id: "labour-1", site: "River View", name: "Amit", dailyWage: 100 }],
  attendance: [{ id: "attendance-1", site: "River View", labourId: "labour-1", date: "2026-08-03", status: "Present" }],
  salaries: [{ id: "salary-1", site: "River View", labourId: "labour-1", month: "2026-08", netSalary: 120, date: "2026-08-31" }],
  vehicles: [
    { id: "truck-ledger", site: "River View", vehicleNumber: "UP 01 A", fuel: 25 },
    { id: "truck-legacy", site: "River View", vehicleNumber: "UP 01 B", fuel: 10 },
  ],
  vehicleExpenses: [{ id: "fuel-ledger", site: "River View", vehicleId: "truck-ledger", expenseType: "Fuel", amount: 40, date: "2026-08-11" }],
  raBills: [{ id: "ra-1", status: "Partially Paid", retentionBalance: 75, pendingAmount: 600 }],
};

describe("project financial aggregation", () => {
  it("uses canonical income and costs once, while separating revenue from receipts", () => {
    const summary = calculateProjectFinancialSummary({
      ...riverRecords,
      budgetRecord: { budget: { totalProjectBudget: 400, materialBudget: 100, labourBudget: 150, contractorBudget: 100, vehicleBudget: 100, otherExpenseBudget: 100 } },
    });

    expect(summary).toMatchObject({
      revenue: 1000,
      received: 400,
      outstanding: 600,
      retention: 75,
      materialCost: 60,
      labourCost: 140,
      contractorCost: 100,
      vehicleCost: 50,
      otherCost: 30,
      totalCost: 380,
      profit: 620,
      marginPercent: 62,
      costToRevenuePercent: 38,
      totalBudget: 400,
      budgetRemaining: 20,
      budgetUsagePercent: 95,
      budgetStatus: "critical",
    });
    expect(summary.totalCost).toBe(summary.materialCost + summary.labourCost + summary.contractorCost + summary.vehicleCost + summary.otherCost);
    expect(summary.attendanceExpense).toBe(0);
    expect(summary.otherExpenseFromExpenses).toBe(130);
  });

  it("counts only linked contractor expense records and no payment/progress operational record", () => {
    expect(getContractorCost([
      { sourceType: "contractorBill", contractorBillId: "bill-1", amount: 500 },
      { sourceType: "contractorPayment", contractorBillId: "bill-1", amount: 500 },
      { sourceType: "contractorBill", amount: 200 },
      { sourceType: "contractorBill", contractorBillId: "bill-2", amount: "invalid" },
    ])).toBe(500);
  });

  it("handles zero revenue and malformed legacy money without unsafe percentages", () => {
    const summary = calculateProjectFinancialSummary({
      expenses: [{ site: "Legacy", sourceType: "contractorBill", contractorBillId: "old", amount: "invalid" }, { site: "Legacy", amount: -50, expenseType: "Other" }],
      materials: [{ site: "Legacy", totalAmount: "bad" }],
      vehicles: [{ id: "legacy-truck", site: "Legacy", fuel: "25" }],
    });
    expect(summary).toMatchObject({ revenue: 0, totalCost: 25, profit: -25, marginPercent: null, costToRevenuePercent: null });
    expect(calculateProjectFinancialSummary({ invoices: [{ totalAmount: 100 }], expenses: [{ expenseType: "Other", amount: 150 }] })).toMatchObject({ profit: -50, marginPercent: -50, costToRevenuePercent: 150 });
  });

  it("builds canonical site and portfolio rows without cross-site or budget double counting", () => {
    const rows = buildSiteFinancialRows({
      sites: [{ id: "river", siteName: " River   View " }, { id: "hill", siteName: "Hill Top" }],
      siteBudgets: [{ siteId: "river", siteName: "River View", budget: { totalProjectBudget: 400 } }],
      ...riverRecords,
      invoices: [...riverRecords.invoices, { id: "hill-invoice", site: "Hill Top", totalAmount: 300, paidAmount: 0, invoiceDate: "2026-08-15" }],
      expenses: [...riverRecords.expenses, { id: "hill-other", site: "Hill Top", expenseType: "Other", amount: 50, date: "2026-08-15" }],
    });
    const portfolio = calculatePortfolioFinancialSummary(rows);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.siteName === "River View").totalCost).toBe(380);
    expect(rows.find((row) => row.siteName === "Hill Top").profit).toBe(250);
    expect(portfolio).toMatchObject({ revenue: 1300, received: 400, outstanding: 900, totalCost: 430, profit: 870, sitesOverBudget: 0, budgetedSiteCount: 1 });
  });

  it("builds dated monthly revenue, cost, and profit trends only from canonical financial records", () => {
    const trend = buildMonthlyFinancialTrend({
      invoices: [{ site: "River", totalAmount: 1000, invoiceDate: "2026-08-10" }, { site: "River", totalAmount: 500, invoiceDate: "2026-09-10" }],
      expenses: [{ site: "River", expenseType: "Other", amount: 100, date: "2026-08-11" }, { site: "River", expenseType: "Other", amount: 50, date: "2026-09-11" }],
    });
    expect(trend).toEqual([
      { month: "2026-08", revenue: 1000, cost: 100, profit: 900 },
      { month: "2026-09", revenue: 500, cost: 50, profit: 450 },
    ]);
  });

  it("keeps project financial access within standard ERP roles", () => {
    expect(canViewProjectFinancials("admin")).toBe(true);
    expect(canViewProjectFinancials("manager")).toBe(true);
    expect(canViewProjectFinancials("viewer")).toBe(true);
    expect(canViewProjectFinancials("supervisor")).toBe(false);
    expect(canViewProjectFinancials("engineer")).toBe(false);
  });
});