import { normaliseMoney } from "./financialReporting";

export const SITE_BUDGET_FIELDS = [
  {
    key: "totalProjectBudget",
    label: "Total Project Budget",
    aliases: ["totalProjectBudget", "projectBudget", "totalBudget"],
  },
  {
    key: "materialBudget",
    label: "Material Budget",
    aliases: ["materialBudget", "materialsBudget"],
  },
  {
    key: "labourBudget",
    label: "Labour Budget",
    aliases: ["labourBudget", "laborBudget", "salaryBudget"],
  },
  {
    key: "vehicleBudget",
    label: "Vehicle / Equipment Budget",
    aliases: ["vehicleBudget", "equipmentBudget"],
  },
  {
    key: "otherExpenseBudget",
    label: "Other Expense Budget",
    aliases: ["otherExpenseBudget", "otherBudget"],
  },
  {
    key: "contingencyBudget",
    label: "Contingency Budget",
    aliases: ["contingencyBudget", "contingency"],
  },
];

const hasOwn = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

const getFiniteNonNegativeNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(
    typeof value === "string" ? value.replace(/[₹,\s]/g, "") : value
  );

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getBudgetField = (site = {}, field) => {
  const budget = site?.budget && typeof site.budget === "object"
    ? site.budget
    : {};
  const sources = [budget, site];

  for (const source of sources) {
    for (const alias of field.aliases) {
      if (!hasOwn(source, alias)) continue;

      const value = getFiniteNonNegativeNumber(source[alias]);
      if (value !== null) return { isSet: true, value };
    }
  }

  return { isSet: false, value: 0 };
};

export const createEmptySiteBudgetForm = () =>
  SITE_BUDGET_FIELDS.reduce((budget, field) => ({
    ...budget,
    [field.key]: "",
  }), {});

export const getSiteBudgetFormValues = (site = {}) => {
  const budget = {};

  SITE_BUDGET_FIELDS.forEach((field) => {
    const value = getBudgetField(site, field);
    budget[field.key] = value.isSet ? String(value.value) : "";
  });

  return budget;
};

export const validateSiteBudget = (form = {}) => {
  const budget = {};

  for (const field of SITE_BUDGET_FIELDS) {
    const rawValue = form?.[field.key];
    const isEmpty = rawValue === "" || rawValue === null || rawValue === undefined;

    if (isEmpty) continue;

    const value = getFiniteNonNegativeNumber(rawValue);
    if (value === null) {
      return {
        isValid: false,
        error: `${field.label} must be a valid non-negative amount.`,
      };
    }

    budget[field.key] = value;
  }

  return { isValid: true, value: budget };
};

export const getSiteBudget = (site = {}) => {
  const fields = SITE_BUDGET_FIELDS.reduce((budget, field) => {
    budget[field.key] = getBudgetField(site, field);
    return budget;
  }, {});
  const hasCategoryBudget = [
    fields.materialBudget,
    fields.labourBudget,
    fields.vehicleBudget,
    fields.otherExpenseBudget,
  ].some((field) => field.isSet);
  const hasBudget = fields.totalProjectBudget.isSet ||
    fields.contingencyBudget.isSet ||
    hasCategoryBudget;
  const categoryBudgetTotal =
    fields.materialBudget.value +
    fields.labourBudget.value +
    fields.vehicleBudget.value +
    fields.otherExpenseBudget.value;
  const baseBudget = fields.totalProjectBudget.isSet
    ? fields.totalProjectBudget.value
    : categoryBudgetTotal;
  const contingencyBudget = fields.contingencyBudget.value;

  return {
    hasBudget,
    baseBudget,
    totalBudget: hasBudget ? baseBudget + contingencyBudget : 0,
    contingencyBudget,
    materialBudget: fields.materialBudget.value,
    labourBudget: fields.labourBudget.value,
    vehicleBudget: fields.vehicleBudget.value,
    otherExpenseBudget: fields.otherExpenseBudget.value,
    hasMaterialBudget: fields.materialBudget.isSet,
    hasLabourBudget: fields.labourBudget.isSet,
    hasVehicleBudget: fields.vehicleBudget.isSet,
    hasOtherExpenseBudget: fields.otherExpenseBudget.isSet,
  };
};

const getUsagePercent = (actual, budget) => {
  if (budget <= 0) return null;
  return (actual / budget) * 100;
};

const createCategorySummary = (budget, actual, hasBudget) => ({
  budget,
  actual,
  remaining: hasBudget ? budget - actual : null,
  usagePercent: hasBudget ? getUsagePercent(actual, budget) : null,
  hasBudget,
});

export const calculateSiteBudgetSummary = (site = {}, financialSummary = {}) => {
  const budget = getSiteBudget(site);
  const actual = {
    material: normaliseMoney(financialSummary.materialExpense),
    labour: normaliseMoney(financialSummary.labourExpense),
    vehicle: normaliseMoney(financialSummary.vehicleExpense),
    // Other expense deliberately excludes vehicle cost because vehicle is a
    // separate budget category. Together these categories reconcile exactly
    // to calculateFinancialSummary(...).totalExpense.
    other: normaliseMoney(financialSummary.otherExpenseFromExpenses),
  };
  actual.total = actual.material + actual.labour + actual.vehicle + actual.other;
  const totalBudget = budget.totalBudget;
  const remainingBudget = budget.hasBudget ? totalBudget - actual.total : null;
  const usagePercent = budget.hasBudget
    ? getUsagePercent(actual.total, totalBudget)
    : null;
  const overBudgetAmount = budget.hasBudget
    ? Math.max(actual.total - totalBudget, 0)
    : 0;

  let status = "not-set";
  if (budget.hasBudget) {
    if (overBudgetAmount > 0) status = "over-budget";
    else if (usagePercent !== null && usagePercent >= 90) status = "critical";
    else if (usagePercent !== null && usagePercent >= 80) status = "warning";
    else status = "on-track";
  }

  return {
    ...budget,
    actualCost: actual.total,
    remainingBudget,
    usagePercent,
    overBudgetAmount,
    status,
    categories: {
      material: createCategorySummary(
        budget.materialBudget,
        actual.material,
        budget.hasMaterialBudget
      ),
      labour: createCategorySummary(
        budget.labourBudget,
        actual.labour,
        budget.hasLabourBudget
      ),
      vehicle: createCategorySummary(
        budget.vehicleBudget,
        actual.vehicle,
        budget.hasVehicleBudget
      ),
      other: createCategorySummary(
        budget.otherExpenseBudget,
        actual.other,
        budget.hasOtherExpenseBudget
      ),
    },
  };
};

export const formatBudgetUsagePercent = (value) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "N/A"
    : `${value.toFixed(1)}%`;

export const canManageSiteBudgets = (role) =>
  ["admin", "manager"].includes(String(role || "").trim().toLowerCase());
