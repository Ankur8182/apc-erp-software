import {
  getSiteName,
  isSameSite,
  normaliseDate,
  normaliseSiteName,
} from "./financialReporting";
import {
  dedupeDailyProgressReports,
  getDprUsageValues,
} from "./dailyProgressReporting";

export const INVENTORY_TRANSACTION_TYPES = ["in", "out", "adjustment"];
export const INVENTORY_ADJUSTMENT_DIRECTIONS = ["increase", "decrease"];

const cleanText = (value) => String(value || "").trim();

const getStrictNonNegativeNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(String(value).replace(/[,₹\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getStrictPositiveNumber = (value) => {
  const number = getStrictNonNegativeNumber(value);
  return number !== null && number > 0 ? number : null;
};

const normaliseInventoryText = (value) =>
  normaliseSiteName(value).toLowerCase();

const createKeyPart = (value) =>
  normaliseInventoryText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

export const createInventoryItemKey = ({ materialName, site, unit } = {}) => {
  const materialKey = createKeyPart(materialName);
  const siteKey = createKeyPart(site);
  const unitKey = createKeyPart(unit);

  return materialKey && siteKey && unitKey
    ? `${siteKey}__${materialKey}__${unitKey}`
    : "";
};

export const createInitialInventoryItemForm = () => ({
  materialName: "",
  site: "",
  unit: "Bag",
  openingStock: "0",
  reorderLevel: "0",
  supplier: "",
  reference: "",
  notes: "",
});

export const createInitialInventoryTransactionForm = () => ({
  inventoryItemId: "",
  transactionType: "in",
  adjustmentDirection: "increase",
  quantity: "",
  date: new Date().toISOString().slice(0, 10),
  reason: "",
  reference: "",
  notes: "",
});

export const validateInventoryItem = (form = {}) => {
  const materialName = cleanText(form.materialName);
  const site = normaliseSiteName(form.site);
  const unit = cleanText(form.unit);
  const openingStock = getStrictNonNegativeNumber(form.openingStock);
  const reorderLevel = getStrictNonNegativeNumber(form.reorderLevel);

  if (!materialName || !site || !unit) {
    return {
      isValid: false,
      error: "Material, Site and Unit are required.",
    };
  }

  if (openingStock === null || reorderLevel === null) {
    return {
      isValid: false,
      error: "Opening Stock and Reorder Level must be valid non-negative quantities.",
    };
  }

  const itemKey = createInventoryItemKey({ materialName, site, unit });
  if (!itemKey) {
    return {
      isValid: false,
      error: "Material, Site and Unit contain an unsupported value.",
    };
  }

  return {
    isValid: true,
    value: {
      itemKey,
      materialName,
      site,
      unit,
      openingStock,
      reorderLevel,
      supplier: cleanText(form.supplier),
      reference: cleanText(form.reference),
      notes: cleanText(form.notes),
      currentStock: openingStock,
    },
  };
};

export const getInventoryTransactionDelta = (transaction = {}) => {
  const quantity = getStrictPositiveNumber(transaction.quantity);
  if (quantity === null) return 0;

  const type = cleanText(transaction.transactionType).toLowerCase();
  if (type === "in") return quantity;
  if (type === "out") return -quantity;
  if (type !== "adjustment") return 0;

  return cleanText(transaction.adjustmentDirection).toLowerCase() === "increase"
    ? quantity
    : cleanText(transaction.adjustmentDirection).toLowerCase() === "decrease"
      ? -quantity
      : 0;
};

export const validateInventoryTransaction = (
  form = {},
  inventoryItem = {},
  availableStock = 0
) => {
  const inventoryItemId = cleanText(form.inventoryItemId || inventoryItem.id);
  const transactionType = cleanText(form.transactionType).toLowerCase();
  const quantity = getStrictPositiveNumber(form.quantity);
  const date = normaliseDate(form.date);
  const adjustmentDirection = cleanText(form.adjustmentDirection).toLowerCase();
  const reason = cleanText(form.reason);

  if (!inventoryItemId || !inventoryItem?.materialName || !getSiteName(inventoryItem) || !inventoryItem?.unit) {
    return { isValid: false, error: "Select a valid inventory item." };
  }

  if (!INVENTORY_TRANSACTION_TYPES.includes(transactionType)) {
    return { isValid: false, error: "Select Stock In, Stock Out, or Adjustment." };
  }

  if (!date || quantity === null) {
    return { isValid: false, error: "Date and a quantity greater than zero are required." };
  }

  if (
    transactionType === "adjustment" &&
    (!INVENTORY_ADJUSTMENT_DIRECTIONS.includes(adjustmentDirection) || !reason)
  ) {
    return {
      isValid: false,
      error: "Every stock adjustment needs an increase/decrease direction and a reason.",
    };
  }

  const transaction = {
    inventoryItemId,
    materialName: cleanText(inventoryItem.materialName),
    site: normaliseSiteName(getSiteName(inventoryItem)),
    unit: cleanText(inventoryItem.unit),
    transactionType,
    quantity,
    date,
    reason,
    reference: cleanText(form.reference),
    notes: cleanText(form.notes),
    ...(transactionType === "adjustment" ? { adjustmentDirection } : {}),
  };
  const delta = getInventoryTransactionDelta(transaction);
  const safeAvailableStock = Math.max(getStrictNonNegativeNumber(availableStock) || 0, 0);

  if (delta < 0 && Math.abs(delta) > safeAvailableStock) {
    return {
      isValid: false,
      error: "Stock Out or a decrease adjustment cannot exceed available stock.",
    };
  }

  return { isValid: true, value: transaction, delta };
};

const getInventoryItemIdentity = (item = {}) =>
  cleanText(item.id || item.itemKey) ||
  createInventoryItemKey(item) ||
  `${normaliseInventoryText(getSiteName(item))}|${normaliseInventoryText(item.materialName)}|${normaliseInventoryText(item.unit)}`;

export const dedupeInventoryItems = (items = []) => {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    const identity = getInventoryItemIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const getTransactionIdentity = (transaction = {}) =>
  cleanText(transaction.id) || [
    cleanText(transaction.inventoryItemId),
    cleanText(transaction.transactionType),
    cleanText(transaction.adjustmentDirection),
    cleanText(transaction.quantity),
    normaliseDate(transaction.date),
    cleanText(transaction.reason),
    cleanText(transaction.reference),
  ].join("|");

export const dedupeInventoryTransactions = (transactions = []) => {
  const seen = new Set();

  return (Array.isArray(transactions) ? transactions : []).filter((transaction) => {
    if (!transaction || typeof transaction !== "object") return false;
    const identity = getTransactionIdentity(transaction);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const calculateInventoryItemSummary = (item = {}, transactions = []) => {
  const itemId = cleanText(item.id || item.itemKey);
  const openingStock = getStrictNonNegativeNumber(item.openingStock) || 0;
  const totals = {
    received: 0,
    issued: 0,
    adjustmentIncrease: 0,
    adjustmentDecrease: 0,
  };

  dedupeInventoryTransactions(transactions)
    .filter((transaction) => cleanText(transaction.inventoryItemId) === itemId)
    .forEach((transaction) => {
      const quantity = getStrictPositiveNumber(transaction.quantity);
      const type = cleanText(transaction.transactionType).toLowerCase();
      const direction = cleanText(transaction.adjustmentDirection).toLowerCase();
      if (quantity === null) return;

      if (type === "in") totals.received += quantity;
      if (type === "out") totals.issued += quantity;
      if (type === "adjustment" && direction === "increase") {
        totals.adjustmentIncrease += quantity;
      }
      if (type === "adjustment" && direction === "decrease") {
        totals.adjustmentDecrease += quantity;
      }
    });

  const rawCurrentStock =
    openingStock +
    totals.received +
    totals.adjustmentIncrease -
    totals.issued -
    totals.adjustmentDecrease;
  const currentStock = Math.max(rawCurrentStock, 0);
  const reorderLevel = getStrictNonNegativeNumber(item.reorderLevel) || 0;
  const status = currentStock <= 0
    ? "out"
    : reorderLevel > 0 && currentStock <= reorderLevel
      ? "low"
      : "available";

  return {
    ...item,
    openingStock,
    reorderLevel,
    ...totals,
    rawCurrentStock,
    currentStock,
    status,
    hasLegacyDeficit: rawCurrentStock < 0,
  };
};

export const getDprMaterialReferencesForInventoryItem = (
  dailyProgressReports = [],
  inventoryItem = {}
) => {
  const materialName = normaliseInventoryText(inventoryItem.materialName);
  const site = getSiteName(inventoryItem);
  if (!materialName || !site) return [];

  return dedupeDailyProgressReports(dailyProgressReports).filter((report) =>
    isSameSite(report, site) &&
    getDprUsageValues(report.materialsUsed).some(
      (material) => normaliseInventoryText(material) === materialName
    )
  );
};

export const summariseInventory = (
  items = [],
  transactions = [],
  dailyProgressReports = [],
  { site = "all", material = "", status = "" } = {}
) => {
  const materialSearch = normaliseInventoryText(material);
  const statusFilter = cleanText(status).toLowerCase();

  const rows = dedupeInventoryItems(items)
    .map((item) => {
      const summary = calculateInventoryItemSummary(item, transactions);
      const dprReferences = getDprMaterialReferencesForInventoryItem(
        dailyProgressReports,
        item
      );

      return { ...summary, dprReferenceCount: dprReferences.length };
    })
    .filter((item) =>
      (site === "all" || !cleanText(site) || isSameSite(item, site)) &&
      (!materialSearch || normaliseInventoryText(item.materialName).includes(materialSearch)) &&
      (!statusFilter || item.status === statusFilter)
    )
    .sort((first, second) =>
      `${getSiteName(first)} ${first.materialName}`.localeCompare(
        `${getSiteName(second)} ${second.materialName}`
      )
    );

  return {
    rows,
    itemCount: rows.length,
    lowStockCount: rows.filter((item) => item.status === "low").length,
    outOfStockCount: rows.filter((item) => item.status === "out").length,
  };
};

export const canManageInventory = (role) =>
  ["admin", "manager"].includes(cleanText(role).toLowerCase());

export const canReadInventoryAvailability = (role) =>
  ["admin", "manager", "viewer", "supervisor", "engineer"].includes(
    cleanText(role).toLowerCase()
  );
