import { calculateFinancialSummary } from "./financialReporting";
import {
  calculateSiteBudgetSummary,
  canManageSiteBudgets,
  getSiteBudget,
  validateSiteBudget,
} from "./siteBudget";

describe("site budget calculations", () => {
  const site = {
    budget: {
      totalProjectBudget: 10000,
      materialBudget: 4500,
      labourBudget: 3000,
      vehicleBudget: 1500,
      otherExpenseBudget: 1000,
      contingencyBudget: 500,
    },
  };

  it("calculates total, remaining budget, category usage, and 80% status", () => {
    const summary = calculateSiteBudgetSummary(site, {
      materialExpense: 4000,
      labourExpense: 3000,
      vehicleExpense: 1200,
      otherExpenseFromExpenses: 400,
    });

    expect(summary.totalBudget).toBe(10500);
    expect(summary.actualCost).toBe(8600);
    expect(summary.remainingBudget).toBe(1900);
    expect(summary.usagePercent).toBeCloseTo(81.904, 2);
    expect(summary.status).toBe("warning");
    expect(summary.categories.material.remaining).toBe(500);
    expect(summary.categories.labour.usagePercent).toBe(100);
  });

  it("detects 90% and over-budget conditions", () => {
    expect(
      calculateSiteBudgetSummary(site, {
        materialExpense: 5000,
        labourExpense: 3000,
        vehicleExpense: 1500,
        otherExpenseFromExpenses: 0,
      }).status
    ).toBe("critical");

    const overBudget = calculateSiteBudgetSummary(site, {
      materialExpense: 5500,
      labourExpense: 3500,
      vehicleExpense: 1500,
      otherExpenseFromExpenses: 1000,
    });
    expect(overBudget.status).toBe("over-budget");
    expect(overBudget.overBudgetAmount).toBe(1000);
    expect(overBudget.remainingBudget).toBe(-1000);
  });

  it("keeps missing and malformed legacy budgets out of comparisons", () => {
    const missing = calculateSiteBudgetSummary({}, { materialExpense: 400 });
    const malformed = getSiteBudget({
      budget: { totalProjectBudget: "invalid", materialBudget: -10 },
    });

    expect(missing).toMatchObject({
      hasBudget: false,
      totalBudget: 0,
      remainingBudget: null,
      usagePercent: null,
    });
    expect(malformed.hasBudget).toBe(false);
  });

  it("reuses the canonical financial summary without vehicle double counting", () => {
    const financialSummary = calculateFinancialSummary({
      vehicles: [{ id: "vehicle-1", site: "River View", fuel: 250 }],
      vehicleExpenses: [
        { id: "expense-1", vehicleId: "vehicle-1", site: "River View", amount: 100 },
      ],
      materials: [{ site: "River View", amount: 200 }],
      expenses: [{ site: "River View", amount: 50, expenseType: "Other" }],
    });
    const summary = calculateSiteBudgetSummary(
      { budget: { totalProjectBudget: 500 } },
      financialSummary
    );

    expect(financialSummary.totalExpense).toBe(350);
    expect(summary.actualCost).toBe(financialSummary.totalExpense);
    expect(summary.categories.vehicle.actual).toBe(100);
  });
});

describe("site budget validation and roles", () => {
  it("allows zero or positive values and blocks malformed or negative values", () => {
    expect(
      validateSiteBudget({ totalProjectBudget: "0", materialBudget: "1200.50" })
    ).toEqual({
      isValid: true,
      value: { totalProjectBudget: 0, materialBudget: 1200.5 },
    });
    expect(validateSiteBudget({ labourBudget: "-1" })).toMatchObject({ isValid: false });
    expect(validateSiteBudget({ vehicleBudget: "not-a-number" })).toMatchObject({ isValid: false });
  });

  it("limits budget editing to admin and manager roles", () => {
    expect(canManageSiteBudgets("admin")).toBe(true);
    expect(canManageSiteBudgets("manager")).toBe(true);
    expect(canManageSiteBudgets("viewer")).toBe(false);
    expect(canManageSiteBudgets("supervisor")).toBe(false);
  });
});
