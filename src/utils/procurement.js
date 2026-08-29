import {
  getSiteName,
  isSameSite,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "./financialReporting";
import { createInventoryItemKey } from "./inventory";

export const VENDOR_STATUSES = ["active", "inactive"];
export const PURCHASE_REQUEST_STATUSES = [
  "draft",
  "pending approval",
  "approved",
  "rejected",
  "converted to po",
];
export const PURCHASE_PRIORITIES = ["Low", "Normal", "High", "Urgent"];
export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "issued",
  "partially received",
  "received",
  "cancelled",
];

const cleanText = (value) => String(value || "").trim();

const strictNumber = (value, { positive = false } = {}) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(number) || number < 0 || (positive && number <= 0)) {
    return null;
  }
  return number;
};

const roundedMoney = (value) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const getLineId = (item = {}, index = 0) =>
  cleanText(item.lineId) || `line-${index + 1}`;

export const createInitialVendorForm = () => ({
  vendorName: "",
  contactPerson: "",
  mobile: "",
  email: "",
  gstNumber: "",
  panNumber: "",
  address: "",
  city: "",
  state: "",
  category: "",
  openingBalance: "0",
  notes: "",
  status: "active",
});

export const validateVendor = (form = {}) => {
  const vendorName = cleanText(form.vendorName);
  const mobile = cleanText(form.mobile);
  const email = cleanText(form.email);
  const openingBalance = strictNumber(form.openingBalance);
  const status = cleanText(form.status).toLowerCase() || "active";

  if (!vendorName) return { isValid: false, error: "Vendor Name is required." };
  if (mobile && !/^\d{10}$/.test(mobile)) {
    return { isValid: false, error: "Mobile number must contain 10 digits." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { isValid: false, error: "Enter a valid email address." };
  }
  if (openingBalance === null || !VENDOR_STATUSES.includes(status)) {
    return { isValid: false, error: "Vendor balance or status is invalid." };
  }

  return {
    isValid: true,
    value: {
      vendorName,
      contactPerson: cleanText(form.contactPerson),
      mobile,
      email,
      gstNumber: cleanText(form.gstNumber).toUpperCase(),
      panNumber: cleanText(form.panNumber).toUpperCase(),
      address: cleanText(form.address),
      city: cleanText(form.city),
      state: cleanText(form.state),
      category: cleanText(form.category),
      openingBalance,
      notes: cleanText(form.notes),
      status,
    },
  };
};

export const createInitialPurchaseRequestItem = () => ({
  lineId: `line-${Date.now()}`,
  materialId: "",
  materialName: "",
  quantity: "",
  unit: "Bag",
});

export const createInitialPurchaseRequestForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  site: "",
  requestedBy: "",
  requiredDate: "",
  priority: "Normal",
  purpose: "",
  notes: "",
  items: [createInitialPurchaseRequestItem()],
});

const normaliseRequestItems = (items = []) => {
  const seen = new Set();
  const result = [];

  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const materialName = cleanText(item?.materialName);
    const quantity = strictNumber(item?.quantity, { positive: true });
    const unit = cleanText(item?.unit);
    const identity = `${materialName.toLowerCase()}|${unit.toLowerCase()}`;

    if (!materialName || quantity === null || !unit || seen.has(identity)) return;
    seen.add(identity);
    result.push({
      lineId: getLineId(item, index),
      materialId: cleanText(item?.materialId),
      materialName,
      quantity,
      unit,
    });
  });

  return result;
};

export const validatePurchaseRequest = (form = {}) => {
  const date = normaliseDate(form.date);
  const requiredDate = normaliseDate(form.requiredDate);
  const site = normaliseSiteName(form.site);
  const requestedBy = cleanText(form.requestedBy);
  const priority = cleanText(form.priority) || "Normal";
  const items = normaliseRequestItems(form.items);

  if (!date || !site || !requestedBy || !requiredDate) {
    return { isValid: false, error: "Date, Site, Requested By, and Required Date are required." };
  }
  if (!PURCHASE_PRIORITIES.includes(priority) || items.length === 0) {
    return { isValid: false, error: "Add at least one valid material item and priority." };
  }

  return {
    isValid: true,
    value: {
      date,
      site,
      requestedBy,
      requiredDate,
      priority,
      purpose: cleanText(form.purpose),
      notes: cleanText(form.notes),
      items,
      status: "pending approval",
    },
  };
};

export const createInitialPurchaseOrderItem = () => ({
  lineId: `line-${Date.now()}`,
  materialId: "",
  materialName: "",
  quantity: "",
  unit: "Bag",
  rate: "",
  taxPercent: "0",
  discount: "0",
  receivedQuantity: 0,
});

export const createInitialPurchaseOrderForm = () => ({
  purchaseRequestId: "",
  vendorId: "",
  vendorName: "",
  site: "",
  poDate: new Date().toISOString().slice(0, 10),
  expectedDeliveryDate: "",
  paymentTerms: "",
  deliveryTerms: "",
  notes: "",
  paidAmount: "0",
  status: "draft",
  items: [createInitialPurchaseOrderItem()],
});

export const calculatePurchaseOrderTotals = (items = []) => {
  const calculatedItems = (Array.isArray(items) ? items : []).map((item, index) => {
    const quantity = strictNumber(item?.quantity, { positive: true }) || 0;
    const rate = strictNumber(item?.rate) || 0;
    const taxPercent = strictNumber(item?.taxPercent) || 0;
    const requestedDiscount = strictNumber(item?.discount) || 0;
    const lineSubtotal = roundedMoney(quantity * rate);
    const discount = Math.min(requestedDiscount, lineSubtotal);
    const taxableAmount = roundedMoney(lineSubtotal - discount);
    const taxAmount = roundedMoney(taxableAmount * taxPercent / 100);

    return {
      ...item,
      lineId: getLineId(item, index),
      quantity,
      rate,
      taxPercent,
      discount,
      lineSubtotal,
      taxableAmount,
      taxAmount,
      lineGrandTotal: roundedMoney(taxableAmount + taxAmount),
      receivedQuantity: strictNumber(item?.receivedQuantity) || 0,
    };
  });

  return {
    items: calculatedItems,
    subtotal: roundedMoney(calculatedItems.reduce((total, item) => total + item.lineSubtotal, 0)),
    discount: roundedMoney(calculatedItems.reduce((total, item) => total + item.discount, 0)),
    tax: roundedMoney(calculatedItems.reduce((total, item) => total + item.taxAmount, 0)),
    grandTotal: roundedMoney(calculatedItems.reduce((total, item) => total + item.lineGrandTotal, 0)),
  };
};

export const validatePurchaseOrder = (form = {}) => {
  const vendorId = cleanText(form.vendorId);
  const vendorName = cleanText(form.vendorName);
  const site = normaliseSiteName(form.site);
  const poDate = normaliseDate(form.poDate);
  const expectedDeliveryDate = normaliseDate(form.expectedDeliveryDate);
  const status = cleanText(form.status).toLowerCase() || "draft";
  const rawItems = Array.isArray(form.items) ? form.items : [];
  const hasInvalidLine = rawItems.some((item) =>
    !cleanText(item?.materialName) || !cleanText(item?.unit) ||
    strictNumber(item?.quantity, { positive: true }) === null ||
    strictNumber(item?.rate, { positive: true }) === null ||
    strictNumber(item?.taxPercent) === null || strictNumber(item?.discount) === null
  );
  const totals = calculatePurchaseOrderTotals(rawItems);
  const items = totals.items.filter((item) =>
    cleanText(item.materialName) && item.quantity > 0 && cleanText(item.unit) && item.rate >= 0
  );
  const paidAmount = form.paidAmount === "" || form.paidAmount === undefined
    ? 0
    : strictNumber(form.paidAmount);

  if (!vendorId || !vendorName || !site || !poDate || !expectedDeliveryDate) {
    return { isValid: false, error: "Vendor, Site, PO Date, and Expected Delivery Date are required." };
  }
  if (!PURCHASE_ORDER_STATUSES.includes(status) || items.length === 0 || hasInvalidLine) {
    return { isValid: false, error: "Every PO item needs a material, positive quantity/rate, unit, and valid tax/discount." };
  }
  if (paidAmount === null || paidAmount > totals.grandTotal) {
    return { isValid: false, error: "Paid Amount cannot exceed the PO total." };
  }

  return {
    isValid: true,
    value: {
      purchaseRequestId: cleanText(form.purchaseRequestId),
      vendorId,
      vendorName,
      site,
      poDate,
      expectedDeliveryDate,
      paymentTerms: cleanText(form.paymentTerms),
      deliveryTerms: cleanText(form.deliveryTerms),
      notes: cleanText(form.notes),
      paidAmount,
      status,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      grandTotal: totals.grandTotal,
      outstandingAmount: roundedMoney(Math.max(totals.grandTotal - paidAmount, 0)),
    },
  };
};

export const getVendorPayableSummary = (vendor = {}, purchaseOrders = []) => {
  const vendorId = cleanText(vendor.id || vendor.vendorId);
  const relatedOrders = (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter(
    (order) => vendorId && cleanText(order?.vendorId) === vendorId &&
      cleanText(order?.status).toLowerCase() !== "cancelled"
  );
  const totalPurchases = relatedOrders.reduce(
    (total, order) => total + normaliseMoney(order?.grandTotal),
    0
  );
  const totalPaid = relatedOrders.reduce(
    (total, order) => total + normaliseMoney(order?.paidAmount),
    0
  );
  const openingBalance = normaliseMoney(vendor?.openingBalance);

  return {
    totalPurchases: roundedMoney(totalPurchases),
    totalPaid: roundedMoney(totalPaid),
    outstandingAmount: roundedMoney(Math.max(openingBalance + totalPurchases - totalPaid, 0)),
    purchaseOrderCount: relatedOrders.length,
  };
};

export const getProcurementSummary = (purchaseRequests = [], purchaseOrders = [], goodsReceipts = []) => {
  const orders = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  const requests = Array.isArray(purchaseRequests) ? purchaseRequests : [];
  const receipts = Array.isArray(goodsReceipts) ? goodsReceipts : [];
  const activeOrders = orders.filter((order) =>
    order && typeof order === "object" && cleanText(order.status).toLowerCase() !== "cancelled"
  );

  return {
    pendingRequests: requests.filter((item) => cleanText(item?.status).toLowerCase() === "pending approval").length,
    openPurchaseOrders: activeOrders.filter((item) => !["received"].includes(cleanText(item?.status).toLowerCase())).length,
    pendingDeliveries: activeOrders.filter((item) => ["issued", "partially received"].includes(cleanText(item?.status).toLowerCase())).length,
    purchaseValue: roundedMoney(activeOrders.reduce((total, item) => total + normaliseMoney(item?.grandTotal), 0)),
    vendorOutstanding: roundedMoney(activeOrders.reduce((total, item) => total + normaliseMoney(item?.outstandingAmount), 0)),
    goodsReceiptCount: receipts.filter((item) => item && typeof item === "object").length,
  };
};

export const getPurchaseOrderLine = (purchaseOrder = {}, lineId = "") =>
  (Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : []).find(
    (item, index) => getLineId(item, index) === cleanText(lineId)
  );

export const validateGoodsReceipt = ({ purchaseOrder, lineId, receivedQuantity, acceptedQuantity, rejectedQuantity, receiptDate, challanNumber = "" } = {}) => {
  const line = getPurchaseOrderLine(purchaseOrder, lineId);
  const received = strictNumber(receivedQuantity, { positive: true });
  const accepted = strictNumber(acceptedQuantity);
  const rejected = strictNumber(rejectedQuantity);
  const date = normaliseDate(receiptDate);
  const orderedQuantity = strictNumber(line?.quantity, { positive: true }) || 0;
  const previousReceivedQuantity = strictNumber(line?.receivedQuantity) || 0;
  const remainingQuantity = Math.max(orderedQuantity - previousReceivedQuantity, 0);

  if (!line || !date || received === null || accepted === null || rejected === null) {
    return { isValid: false, error: "Select a PO item and enter valid receipt quantities and date." };
  }
  if (accepted + rejected !== received) {
    return { isValid: false, error: "Accepted Quantity plus Rejected Quantity must equal Received Quantity." };
  }
  if (received > remainingQuantity) {
    return { isValid: false, error: `Only ${remainingQuantity} ${line.unit} remains to be received for this PO item.` };
  }

  return {
    isValid: true,
    value: {
      line,
      receiptDate: date,
      challanNumber: cleanText(challanNumber),
      receivedQuantity: received,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      orderedQuantity,
      previousReceivedQuantity,
      remainingQuantity,
      updatedReceivedQuantity: roundedMoney(previousReceivedQuantity + received),
      receiptCost: roundedMoney(
        orderedQuantity > 0 ? normaliseMoney(line.lineGrandTotal) * accepted / orderedQuantity : 0
      ),
    },
  };
};

export const getPurchaseOrderReceiptStatus = (items = []) => {
  const lineItems = Array.isArray(items) ? items : [];
  if (lineItems.length === 0) return "draft";
  const allReceived = lineItems.every((item) =>
    (strictNumber(item?.receivedQuantity) || 0) >= (strictNumber(item?.quantity) || 0)
  );
  const hasReceived = lineItems.some((item) => (strictNumber(item?.receivedQuantity) || 0) > 0);
  return allReceived ? "received" : hasReceived ? "partially received" : "issued";
};

export const createInventoryStockInFromGoodsReceipt = ({ goodsReceiptId, purchaseOrder, line, inventoryItem, vendorId, siteId = "", receiptDate }) => {
  const inventoryItemId = cleanText(inventoryItem?.id || inventoryItem?.itemKey);
  const acceptedQuantity = strictNumber(line?.acceptedQuantity, { positive: true });
  const site = normaliseSiteName(getSiteName(purchaseOrder));
  const materialName = cleanText(line?.materialName);
  const unit = cleanText(line?.unit);

  if (!goodsReceiptId || !inventoryItemId || !acceptedQuantity || !site || !materialName || !unit) {
    throw new Error("A valid GRN, PO line, and inventory item are required for Stock-In.");
  }

  return {
    inventoryItemId,
    materialName,
    site,
    unit,
    transactionType: "in",
    quantity: acceptedQuantity,
    date: normaliseDate(receiptDate),
    reference: goodsReceiptId,
    notes: `Stock-In from GRN ${goodsReceiptId}.`,
    sourceType: "goodsReceipt",
    goodsReceiptId: cleanText(goodsReceiptId),
    purchaseOrderId: cleanText(purchaseOrder?.id),
    vendorId: cleanText(vendorId),
    siteId: cleanText(siteId),
    materialId: cleanText(line?.materialId),
  };
};

export const findInventoryItemForPurchaseLine = (inventoryItems = [], purchaseOrder = {}, line = {}) => {
  const targetKey = createInventoryItemKey({
    materialName: line?.materialName,
    site: getSiteName(purchaseOrder),
    unit: line?.unit,
  });

  return (Array.isArray(inventoryItems) ? inventoryItems : []).find((item) =>
    cleanText(item?.id || item?.itemKey) === targetKey ||
    (isSameSite(item, getSiteName(purchaseOrder)) &&
      cleanText(item?.materialName).toLowerCase() === cleanText(line?.materialName).toLowerCase() &&
      cleanText(item?.unit).toLowerCase() === cleanText(line?.unit).toLowerCase())
  );
};

export const buildDocumentNumber = (prefix, records = [], date = new Date()) => {
  const year = date.getFullYear();
  const count = (Array.isArray(records) ? records : []).filter((record) =>
    cleanText(record?.number || record?.requestNumber || record?.poNumber || record?.grnNumber)
      .startsWith(`${prefix}-${year}-`)
  ).length + 1;
  return `${prefix}-${year}-${String(count).padStart(4, "0")}`;
};

export const createGoodsReceiptKey = ({ purchaseOrderId, lineId, challanNumber = "", receiptDate, receivedQuantity, acceptedQuantity, rejectedQuantity } = {}) => {
  const source = [
    cleanText(purchaseOrderId), cleanText(lineId), cleanText(challanNumber) || "no-challan",
    normaliseDate(receiptDate), cleanText(receivedQuantity), cleanText(acceptedQuantity), cleanText(rejectedQuantity),
  ].join("|");
  const compact = source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 170);
  return compact ? `grn-${compact}` : "";
};

export const canApprovePurchaseRequest = (role) =>
  ["admin", "manager"].includes(cleanText(role).toLowerCase());

export const canManageProcurement = (role) =>
  ["admin", "manager"].includes(cleanText(role).toLowerCase());

export const canReadProcurement = (role) =>
  ["admin", "manager", "viewer"].includes(cleanText(role).toLowerCase());
