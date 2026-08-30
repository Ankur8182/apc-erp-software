import {
  getSiteName,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "./financialReporting";

export const BOQ_UNITS = ["Nos", "Sqm", "Cum", "Rmt", "Kg", "MT", "Litre", "Job", "LS"];
export const BOQ_STATUSES = ["Draft", "Active", "Completed", "Archived"];
export const MEASUREMENT_STATUSES = ["Pending", "Certified", "Rejected"];
export const VARIATION_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"];
export const DIMENSION_TYPES = ["Direct quantity", "Area (L × W)", "Volume (L × W × H)", "Count × per-unit quantity"];

const cleanText = (value, maxLength = 0) => {
  const text = String(value ?? "").trim();
  return maxLength ? text.slice(0, maxLength) : text;
};

const money = (value) => Math.round(normaliseMoney(value) * 100) / 100;
const signedMoney = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
};
const quantity = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};
const positiveQuantity = (value) => {
  const numeric = quantity(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};
const signedNonZeroQuantity = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : null;
};const safeRecords = (records) => (Array.isArray(records) ? records : []).filter((record) => record && typeof record === "object");
const cleanStatus = (value) => cleanText(value);
const dateWithinRange = (date, from, to) => {
  const normalized = normaliseDate(date);
  return Boolean(normalized) && (!from || normalized >= from) && (!to || normalized <= to);
};
const roundQuantity = (value) => Math.round(Math.max(Number(value) || 0, 0) * 1000) / 1000;
const entryKey = (record, index) => cleanText(record?.id || record?.measurementId || record?.lineId || `row-${index}`);

export const canManageBoq = (role) => ["admin", "manager"].includes(cleanText(role).toLowerCase());
export const canReadBoq = (role) => ["admin", "manager", "viewer"].includes(cleanText(role).toLowerCase());

export const createInitialBoqItemForm = () => ({
  siteId: "", site: "", itemNumber: "", itemCode: "", workCategory: "", description: "", unit: "Nos",
  plannedQuantity: "", rate: "", remarks: "", status: "Draft",
});

export const validateBoqItem = (form = {}) => {
  const site = normaliseSiteName(form.site);
  const plannedQuantity = positiveQuantity(form.plannedQuantity);
  const rate = quantity(form.rate);
  const unit = cleanText(form.unit);
  const status = cleanStatus(form.status) || "Draft";
  if (!cleanText(form.siteId) || !site || !cleanText(form.itemNumber) || !cleanText(form.description) || !unit) {
    return { isValid: false, error: "Site, BOQ item number, description, and unit are required." };
  }
  if (!BOQ_UNITS.includes(unit) || plannedQuantity === null || rate === null || !BOQ_STATUSES.includes(status)) {
    return { isValid: false, error: "Enter a positive planned quantity, a valid non-negative rate, unit, and status." };
  }
  return {
    isValid: true,
    value: {
      siteId: cleanText(form.siteId), site, itemNumber: cleanText(form.itemNumber, 100), itemCode: cleanText(form.itemCode, 100),
      workCategory: cleanText(form.workCategory, 150), description: cleanText(form.description, 1000), unit,
      plannedQuantity: roundQuantity(plannedQuantity), rate: money(rate), amount: money(plannedQuantity * rate),
      remarks: cleanText(form.remarks, 1000), status,
    },
  };
};

export const createInitialMeasurementForm = () => ({
  siteId: "", site: "", boqItemId: "", date: new Date().toISOString().slice(0, 10), location: "", measurementType: "Direct quantity",
  quantity: "", length: "", width: "", height: "", count: "", perUnitQuantity: "", remarks: "", dprId: "",
});

export const calculateDimensionalQuantity = (form = {}) => {
  const type = cleanText(form.measurementType) || "Direct quantity";
  if (!DIMENSION_TYPES.includes(type)) return null;
  if (type === "Direct quantity") return positiveQuantity(form.quantity);
  const length = positiveQuantity(form.length);
  const width = positiveQuantity(form.width);
  const height = positiveQuantity(form.height);
  const count = positiveQuantity(form.count);
  const perUnitQuantity = positiveQuantity(form.perUnitQuantity);
  if (type === "Area (L × W)") return length === null || width === null ? null : roundQuantity(length * width);
  if (type === "Volume (L × W × H)") return length === null || width === null || height === null ? null : roundQuantity(length * width * height);
  return count === null || perUnitQuantity === null ? null : roundQuantity(count * perUnitQuantity);
};

export const validateMeasurement = ({ form = {}, item, progress } = {}) => {
  const site = normaliseSiteName(form.site);
  const date = normaliseDate(form.date);
  const measurementType = cleanText(form.measurementType) || "Direct quantity";
  const measuredQuantity = calculateDimensionalQuantity(form);
  const authorizedQuantity = roundQuantity(progress?.authorizedQuantity ?? item?.plannedQuantity);
  const existingMeasured = roundQuantity(progress?.measuredQuantity);
  if (!item || !cleanText(form.siteId) || !site || !date || !cleanText(form.boqItemId) || !cleanText(form.location)) {
    return { isValid: false, error: "Site, BOQ item, date, and location/reference are required." };
  }
  if (!DIMENSION_TYPES.includes(measurementType) || measuredQuantity === null || measuredQuantity <= 0) {
    return { isValid: false, error: "Enter valid positive measurement dimensions or a direct quantity." };
  }
  if (existingMeasured + measuredQuantity > authorizedQuantity + 0.001) {
    return { isValid: false, error: "Measurement exceeds the authorized BOQ quantity. Approve a variation before recording extra work." };
  }
  const dimensions = measurementType === "Direct quantity" ? {} : {
    length: quantity(form.length) ?? 0, width: quantity(form.width) ?? 0, height: quantity(form.height) ?? 0,
    count: quantity(form.count) ?? 0, perUnitQuantity: quantity(form.perUnitQuantity) ?? 0,
  };
  return {
    isValid: true,
    value: {
      siteId: cleanText(form.siteId), site, boqItemId: cleanText(form.boqItemId), boqItemNumber: cleanText(item.itemNumber, 100),
      boqItemCode: cleanText(item.itemCode, 100), boqItemDescription: cleanText(item.description, 1000), unit: cleanText(item.unit),
      date, location: cleanText(form.location, 500), measurementType, quantity: roundQuantity(measuredQuantity), dimensions,
      remarks: cleanText(form.remarks, 1000), dprId: cleanText(form.dprId, 200), status: "Pending",
    },
  };
};

export const createInitialVariationForm = () => ({
  siteId: "", site: "", boqItemId: "", variationReference: "", itemCode: "", description: "", unit: "Nos",
  quantityChange: "", revisedRate: "", reason: "", status: "Draft",
});

export const validateVariation = ({ form = {}, item, progress } = {}) => {
  const site = normaliseSiteName(form.site);
  const amountQuantity = signedNonZeroQuantity(form.quantityChange);
  const revisedRate = quantity(form.revisedRate);
  const status = cleanStatus(form.status) || "Draft";
  const linkedItem = item && typeof item === "object" ? item : null;
  const itemCode = cleanText(linkedItem?.itemCode || form.itemCode, 100);
  const description = cleanText(linkedItem?.description || form.description, 1000);
  const unit = cleanText(linkedItem?.unit || form.unit);
  const rate = revisedRate === null ? money(linkedItem?.rate) : money(revisedRate);
  if (!cleanText(form.siteId) || !site || !cleanText(form.variationReference) || !description || !unit || amountQuantity === null) return { isValid: false, error: "Site, variation reference, item details, unit, and a non-zero quantity change are required." };
  if (linkedItem && progress && Number(progress.authorizedQuantity || 0) + amountQuantity <= 0) return { isValid: false, error: "A reduction cannot reduce the authorised BOQ quantity to zero or below." };
  if (!BOQ_UNITS.includes(unit) || rate < 0 || !VARIATION_STATUSES.includes(status)) return { isValid: false, error: "Enter a valid unit, non-negative authorized rate, and variation status." };
  return { isValid: true, value: { siteId: cleanText(form.siteId), site, boqItemId: cleanText(linkedItem?.id || form.boqItemId), variationReference: cleanText(form.variationReference, 120), itemNumber: cleanText(linkedItem?.itemNumber, 100), itemCode, description, unit, quantityChange: Math.round(amountQuantity * 1000) / 1000, revisedRate: rate, variationValue: signedMoney(amountQuantity * rate), reason: cleanText(form.reason, 1000), status } };
};
const dedupeRecords = (records) => {
  const seen = new Set();
  return safeRecords(records).filter((record, index) => {
    const key = entryKey(record, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isMatchingSite = (record, siteName) => {
  const target = normaliseSiteName(siteName);
  return Boolean(target) && normaliseSiteName(getSiteName(record) || record?.siteName) === target;
};

export const getApprovedVariationsForItem = (variations = [], item = {}) => dedupeRecords(variations).filter((variation) =>
  cleanStatus(variation.status) === "Approved" && cleanText(variation.boqItemId) === cleanText(item.id)
);

export const getMeasurementProgress = ({ item = {}, measurements = [], variations = [], raBills = [] } = {}) => {
  const relevantMeasurements = dedupeRecords(measurements).filter((measurement) =>
    cleanText(measurement.boqItemId) === cleanText(item.id) && cleanStatus(measurement.status) !== "Rejected"
  );
  const approvedVariations = getApprovedVariationsForItem(variations, item);
  const plannedQuantity = roundQuantity(item.plannedQuantity);
  const variationQuantity = roundQuantity(approvedVariations.reduce((total, variation) => total + (signedNonZeroQuantity(variation.quantityChange) || 0), 0));
  const authorizedQuantity = roundQuantity(plannedQuantity + variationQuantity);
  const measuredQuantity = roundQuantity(relevantMeasurements.reduce((total, measurement) => total + (positiveQuantity(measurement.quantity) || 0), 0));
  const certifiedQuantity = roundQuantity(relevantMeasurements.filter((measurement) => cleanStatus(measurement.status) === "Certified").reduce((total, measurement) => total + (positiveQuantity(measurement.quantity) || 0), 0));
  const billedQuantity = roundQuantity(getBilledQuantityForItem(raBills, item.id));
  const balanceQuantity = roundQuantity(Math.max(authorizedQuantity - measuredQuantity, 0));
  const certifiedBalanceQuantity = roundQuantity(Math.max(authorizedQuantity - certifiedQuantity, 0));
  const rate = money(item.rate);
  const progressPercent = authorizedQuantity > 0 ? Math.min(100, roundQuantity(measuredQuantity / authorizedQuantity * 100)) : 0;
  return {
    itemId: cleanText(item.id), plannedQuantity, variationQuantity, authorizedQuantity, measuredQuantity, certifiedQuantity,
    billedQuantity, balanceQuantity, certifiedBalanceQuantity, progressPercent, rate,
    plannedValue: money(plannedQuantity * rate), approvedVariationValue: signedMoney(approvedVariations.reduce((total, variation) => total + signedMoney(variation.variationValue), 0)),
    measuredValue: money(measuredQuantity * rate), certifiedValue: money(certifiedQuantity * rate), billedValue: money(billedQuantity * rate),
    pendingCertificationQuantity: roundQuantity(Math.max(measuredQuantity - certifiedQuantity, 0)),
    overBilledQuantity: roundQuantity(Math.max(billedQuantity - authorizedQuantity, 0)),
  };
};

export const getBilledQuantityForItem = (raBills = [], itemId) => roundQuantity(dedupeRecords(raBills).filter((bill) =>
  !["Rejected", "Cancelled"].includes(cleanStatus(bill.status))
).reduce((total, bill) => total + (Array.isArray(bill.boqLineItems) ? bill.boqLineItems : []).reduce((lineTotal, line) =>
  cleanText(line?.boqItemId) === cleanText(itemId) ? lineTotal + (positiveQuantity(line.currentBilledQuantity) || 0) : lineTotal, 0
), 0));

export const getBoqItemProgressRows = ({ items = [], measurements = [], variations = [], raBills = [] } = {}) => dedupeRecords(items).map((item) => ({
  ...item,
  ...getMeasurementProgress({ item, measurements, variations, raBills }),
}));

export const getSiteBoqSummary = ({ site, items = [], measurements = [], variations = [], raBills = [] } = {}) => {
  const siteItems = dedupeRecords(items).filter((item) => !site || isMatchingSite(item, site));
  const rows = getBoqItemProgressRows({ items: siteItems, measurements, variations, raBills });
  const siteVariations = dedupeRecords(variations).filter((variation) => (!site || isMatchingSite(variation, site)) && cleanStatus(variation.status) === "Approved");
  const sum = (field) => money(rows.reduce((total, row) => total + money(row[field]), 0));
  const originalBoqValue = sum("plannedValue");
  const approvedVariationValue = signedMoney(siteVariations.reduce((total, variation) => total + signedMoney(variation.variationValue), 0));
  const revisedBoqValue = signedMoney(originalBoqValue + approvedVariationValue);
  const measuredWorkValue = sum("measuredValue");
  const certifiedWorkValue = sum("certifiedValue");
  const billedWorkValue = sum("billedValue");
  const overallProgressPercent = revisedBoqValue > 0 ? Math.min(100, roundQuantity(measuredWorkValue / revisedBoqValue * 100)) : 0;
  return {
    itemCount: rows.length, originalBoqValue, approvedVariationValue, revisedBoqValue, measuredWorkValue, certifiedWorkValue,
    billedWorkValue, balanceWorkValue: money(Math.max(revisedBoqValue - measuredWorkValue, 0)), overallProgressPercent,
    pendingCertificationQuantity: roundQuantity(rows.reduce((total, row) => total + row.pendingCertificationQuantity, 0)),
    pendingVariationCount: dedupeRecords(variations).filter((variation) => (!site || isMatchingSite(variation, site)) && cleanStatus(variation.status) === "Submitted").length,
    incompleteItems: rows.filter((row) => row.progressPercent < 100 && row.authorizedQuantity > 0).sort((first, second) => first.progressPercent - second.progressPercent),
    rows,
  };
};

export const validateBoqBillingLines = ({ lines = [], progressRows = [], existingBillId = "" } = {}) => {
  const lineItems = Array.isArray(lines) ? lines.filter((line) => line && typeof line === "object") : [];
  const seen = new Set();
  for (const line of lineItems) {
    const itemId = cleanText(line.boqItemId);
    const quantityValue = positiveQuantity(line.currentBilledQuantity);
    const progress = progressRows.find((row) => cleanText(row.itemId || row.id) === itemId);
    if (!itemId || quantityValue === null || !progress || seen.has(itemId)) return { isValid: false, error: "Each BOQ billing line needs one item and a positive, unique quantity." };
    seen.add(itemId);
    const previousBilledQuantity = roundQuantity(Math.max(progress.billedQuantity - (existingBillId ? quantityValue : 0), 0));
    if (previousBilledQuantity + quantityValue > progress.authorizedQuantity + 0.001) {
      return { isValid: false, error: `${progress.itemNumber || "Selected item"} exceeds its authorized BOQ quantity.` };
    }
  }
  return { isValid: true, value: lineItems.map((line) => {
    const progress = progressRows.find((row) => cleanText(row.itemId || row.id) === cleanText(line.boqItemId));
    const currentBilledQuantity = roundQuantity(positiveQuantity(line.currentBilledQuantity) || 0);
    const previousBilledQuantity = roundQuantity(Math.max(progress.billedQuantity - (existingBillId ? currentBilledQuantity : 0), 0));
    return {
      boqItemId: cleanText(progress.itemId || progress.id), itemNumber: cleanText(progress.itemNumber), itemCode: cleanText(progress.itemCode),
      description: cleanText(progress.description), unit: cleanText(progress.unit), previousBilledQuantity,
      currentBilledQuantity, cumulativeBilledQuantity: roundQuantity(previousBilledQuantity + currentBilledQuantity),
      rate: money(progress.rate), currentAmount: money(currentBilledQuantity * progress.rate),
    };
  }) };
};

export const filterBoqRecords = ({ items = [], measurements = [], variations = [], filters = {} } = {}) => {
  const site = normaliseSiteName(filters.site);
  const itemId = cleanText(filters.itemId);
  const category = cleanText(filters.category).toLowerCase();
  const status = cleanText(filters.status);
  const fromDate = normaliseDate(filters.fromDate);
  const toDate = normaliseDate(filters.toDate);
  const matchesItem = (item) => (!site || isMatchingSite(item, site)) && (!itemId || cleanText(item.id) === itemId) && (!category || cleanText(item.workCategory).toLowerCase() === category) && (!status || cleanStatus(item.status) === status);
  const matchesHistory = (entry) => (!site || isMatchingSite(entry, site)) && (!itemId || cleanText(entry.boqItemId) === itemId) && (!status || cleanStatus(entry.status) === status) && dateWithinRange(entry.date || entry.createdAt, fromDate, toDate);
  return {
    items: dedupeRecords(items).filter(matchesItem),
    measurements: dedupeRecords(measurements).filter(matchesHistory),
    variations: dedupeRecords(variations).filter(matchesHistory),
  };
};

export const buildBoqAlerts = ({ items = [], measurements = [], variations = [], raBills = [] } = {}) => {
  const summary = getSiteBoqSummary({ items, measurements, variations, raBills });
  const alerts = [];
  summary.rows.forEach((row) => {
    if (row.authorizedQuantity > 0 && row.measuredQuantity >= row.authorizedQuantity * 0.9 && row.measuredQuantity < row.authorizedQuantity) {
      alerts.push({ id: `boq-nearing-${row.itemId}`, severity: "warning", title: "BOQ quantity nearing limit", message: `${row.itemNumber || row.description} is at ${row.progressPercent}% of authorized quantity.`, date: new Date(), href: "/boq" });
    }
    if (row.measuredQuantity > row.authorizedQuantity + 0.001 || row.billedQuantity > row.authorizedQuantity + 0.001) {
      alerts.push({ id: `boq-exceeded-${row.itemId}`, severity: "critical", title: "BOQ quantity needs review", message: `${row.itemNumber || row.description} exceeds its authorized quantity.`, date: new Date(), href: "/boq" });
    }
    if (row.pendingCertificationQuantity > 0) {
      alerts.push({ id: `boq-certification-${row.itemId}`, severity: "info", title: "Measurement pending certification", message: `${row.itemNumber || row.description} has ${row.pendingCertificationQuantity} ${row.unit} awaiting certification.`, date: new Date(), href: "/boq" });
    }
  });
  dedupeRecords(variations).filter((variation) => cleanStatus(variation.status) === "Submitted").forEach((variation) => {
    alerts.push({ id: `boq-variation-${variation.id}`, severity: "warning", title: "BOQ variation awaiting approval", message: `${variation.variationReference || "Variation"} for ${getSiteName(variation) || "a site"} is awaiting approval.`, date: variation.createdAt || new Date(), href: "/boq" });
  });
  return alerts;
};

export const getBoqMeasurementDisplayQuantity = (measurement = {}) => `${roundQuantity(measurement.quantity)} ${cleanText(measurement.unit)}`.trim();