import {
  ERP_BACKUP_COLLECTIONS,
  MAX_BACKUP_DOCUMENTS_PER_COLLECTION,
  MAX_BACKUP_DOCUMENTS_TOTAL,
} from "./erpBackup";
import { getSiteName, normaliseDate, normaliseSiteName } from "./financialReporting";

// Phase 9C intentionally has no Firebase imports. It only assesses in-memory
// copies returned by a read-only administrator query.
export const DATA_HEALTH_COLLECTIONS = Object.freeze([...ERP_BACKUP_COLLECTIONS]);
export const DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION = MAX_BACKUP_DOCUMENTS_PER_COLLECTION;
export const DATA_HEALTH_MAX_DOCUMENTS_TOTAL = MAX_BACKUP_DOCUMENTS_TOTAL;

export const DATA_HEALTH_EXCLUSIONS = Object.freeze({
  users: "User profiles cannot be listed from the browser under the existing rules. Firebase Authentication accounts are not Firestore records.",
  firebaseAuthentication: "Passwords, sessions, tokens, and Authentication accounts are never read by this diagnostic.",
  firebaseStorage: "Storage objects are not read. Existing DPR photo metadata is assessed only as part of an already-read DPR document.",
  unknownCollections: "Only known top-level ERP collections are scanned; no unknown or nested collection is inferred or changed.",
});

export const IMMUTABLE_HISTORY_COLLECTIONS = Object.freeze([
  "auditLogs", "inventoryTransactions", "salaryPayments", "labourAdvances",
  "clientReceipts", "raRetentionReleases", "goodsReceipts", "vehicleExpenses",
  "vehicleMaintenance", "workOrderProgress", "boqMeasurements",
]);

const makeCatalog = (label, identity, requiredFields, optionalLegacyFields, relationships, importance) => Object.freeze({
  label, identity, requiredFields: Object.freeze(requiredFields),
  optionalLegacyFields: Object.freeze(optionalLegacyFields), relationships: Object.freeze(relationships), importance,
});

// Collection -> identity -> current required fields -> legacy aliases -> links.
// Missing data is a review signal only; it never authorizes a cleanup action.
export const DATA_HEALTH_COLLECTION_CATALOG = Object.freeze({
  sites: makeCatalog("Sites", "document ID + normalized siteName", ["siteName"], ["name", "site", "projectName"], [], "operational/financial parent"),
  siteBudgets: makeCatalog("Site Budgets", "siteId (normally site document ID)", ["siteId", "siteName", "budget"], ["site", "projectName", "totalBudget"], ["siteId → sites"], "financial planning"),
  inventoryItems: makeCatalog("Inventory Items", "itemKey or material + site + unit", ["materialName", "site", "unit"], ["material", "name", "siteName", "opening"], ["site/siteId → sites", "materialId → materials when present"], "stock control"),
  inventoryTransactions: makeCatalog("Inventory Transactions", "document ID (immutable history)", ["inventoryItemId", "transactionType", "quantity", "date"], ["itemId", "type", "qty", "transactionDate"], ["inventoryItemId → inventoryItems", "site/siteId → sites"], "immutable stock movement"),
  vendors: makeCatalog("Vendors", "document ID; GSTIN/mobile/name review keys", ["vendorName"], ["name", "supplierName", "gstin", "mobile"], [], "procurement/subcontract parent"),
  purchaseRequests: makeCatalog("Purchase Requests", "requestNumber or document ID", ["requestNumber", "site", "date"], ["number", "requestDate", "siteName"], ["site/siteId → sites"], "procurement workflow"),
  purchaseOrders: makeCatalog("Purchase Orders", "poNumber or document ID", ["poNumber", "vendorId", "site"], ["number", "purchaseOrderNumber", "vendor", "siteName"], ["vendorId → vendors", "purchaseRequestId → purchaseRequests", "site/siteId → sites"], "procurement commitment"),
  goodsReceipts: makeCatalog("Goods Receipts / GRN", "grnNumber or document ID (immutable history)", ["grnNumber", "purchaseOrderId", "vendorId", "receiptDate"], ["number", "receiptNumber", "grnDate", "poId"], ["purchaseOrderId → purchaseOrders", "vendorId → vendors", "site/siteId → sites"], "immutable receipt history"),
  workOrders: makeCatalog("Work Orders", "workOrderNumber or document ID", ["workOrderNumber", "vendorId", "site"], ["number", "orderNumber", "contractorId", "siteName"], ["vendorId → vendors", "site/siteId → sites", "boqItemId → boqItems when present"], "subcontract commitment"),
  workOrderProgress: makeCatalog("Work Order Progress", "document ID (operational history)", ["workOrderId", "date"], ["orderId", "progressDate"], ["workOrderId → workOrders", "site/siteId → sites"], "subcontract execution history"),
  contractorBills: makeCatalog("Contractor Bills", "bill number/reference or document ID", ["vendorId", "site"], ["contractorId", "amount", "billNo", "siteName"], ["vendorId → vendors", "workOrderId → workOrders when present", "site/siteId → sites"], "contractor cost"),
  contractorPayments: makeCatalog("Contractor Payments", "reference or document ID (immutable history)", ["amount", "paymentDate"], ["paidAmount", "date", "billId"], ["contractorBillId → contractorBills when present", "workOrderId → workOrders when present", "vendorId → vendors when present"], "immutable contractor payments"),
  labours: makeCatalog("Labour Masters", "document ID; Aadhaar/mobile/name + site review keys", ["name"], ["labourName", "employeeName", "dailyWage", "wage", "monthlySalary", "salary"], ["site/siteId → sites when present"], "payroll master"),
  materials: makeCatalog("Material Purchases", "document ID + bill/material/site/date review keys", ["materialName", "quantity", "rate", "site"], ["name", "material", "qty", "price", "purchaseDate"], ["site/siteId → sites"], "canonical material purchase cost"),
  expenses: makeCatalog("Expenses", "document ID + date/site/category/amount", ["amount", "date"], ["expenseAmount", "totalAmount", "type", "category", "siteName"], ["site/siteId → sites when present"], "canonical direct expense ledger"),
  attendance: makeCatalog("Attendance", "attendanceKey or labourId + date", ["labourId", "date", "status"], ["employeeName", "labourName", "name", "overtime"], ["labourId → labours", "site/siteId → sites when present"], "payroll input"),
  salaries: makeCatalog("Payroll Records", "document ID + labourId + payroll month", ["labourId", "payrollMonth/month", "netSalary/netPay"], ["employeeName", "labourName", "salary", "totalSalary"], ["labourId → labours", "site/siteId → sites when present"], "canonical labour obligation"),
  salaryPayments: makeCatalog("Salary Payments", "document ID (immutable history)", ["labourId", "amount", "paymentDate"], ["payrollId", "salaryId", "date", "paidAmount"], ["salaryId/payrollId → salaries when present", "labourId → labours"], "immutable salary payment history"),
  labourAdvances: makeCatalog("Labour Advances", "document ID (immutable history)", ["labourId", "amount", "date"], ["advanceAmount", "recoveryAmount", "employeeName"], ["labourId → labours", "site/siteId → sites when present"], "immutable payroll adjustment history"),
  vehicles: makeCatalog("Vehicles / Equipment", "document ID; vehicleNumber/registration review key", ["vehicleNumber"], ["vehicleNo", "registrationNumber", "vehicleName", "name"], ["site/siteId → sites when present"], "equipment master"),
  vehicleExpenses: makeCatalog("Vehicle Expenses", "document ID (operational cost history)", ["vehicleId", "site", "date", "amount"], ["fuelAmount", "expenseAmount", "fuelDate", "vehicleNo"], ["vehicleId → vehicles", "site/siteId → sites"], "canonical vehicle expense ledger"),
  vehicleAssignments: makeCatalog("Vehicle Assignments", "document ID (operational history)", ["vehicleId", "site", "assignmentDate"], ["vehicleNo", "date", "siteName"], ["vehicleId → vehicles", "site/siteId → sites"], "equipment assignment history"),
  vehicleMaintenance: makeCatalog("Vehicle Maintenance", "document ID (maintenance history)", ["vehicleId", "site", "serviceDate"], ["vehicleNo", "date", "amount"], ["vehicleId → vehicles", "site/siteId → sites"], "maintenance history"),
  dailyProgressReports: makeCatalog("Daily Progress Reports", "document ID + createdBy + date/site/activity", ["date", "site", "workActivity", "workLocation", "quantity", "unit", "manpowerCount"], ["siteName", "activity", "location", "materials", "equipment"], ["site/siteId → sites", "createdBy cannot be browser-verified against users/Auth"], "operational field history"),
  boqItems: makeCatalog("BOQ Items", "siteId/site + itemCode/itemNumber", ["siteId", "site", "itemNumber", "description", "unit"], ["itemNo", "code", "siteName"], ["siteId → sites"], "commercial BOQ baseline"),
  boqMeasurements: makeCatalog("BOQ Measurements", "document ID (immutable history)", ["siteId", "boqItemId", "date", "quantity"], ["itemId", "measurementDate", "qty"], ["siteId → sites", "boqItemId → boqItems"], "immutable measurement history"),
  boqVariations: makeCatalog("BOQ Variations", "variationReference + siteId/site", ["siteId", "variationReference", "quantityChange"], ["reference", "itemId", "qty"], ["siteId → sites", "boqItemId → boqItems when present"], "commercial variation history"),
  auditLogs: makeCatalog("Audit Logs", "document ID (append-only history)", ["userId", "action", "module", "timestamp"], ["userEmail", "userRole", "recordId", "site"], [], "immutable security history"),
  clients: makeCatalog("Clients", "document ID + clientName", ["clientName"], ["name", "companyName", "mobile"], [], "billing master"),
  siteBillingProfiles: makeCatalog("Site Billing Profiles", "siteId or document ID", ["siteId", "clientId", "siteName", "clientName"], ["site", "client", "agreementNo"], ["siteId → sites", "clientId → clients"], "client billing configuration"),
  raBills: makeCatalog("RA Bills", "raBillNumber or document ID", ["raBillNumber", "siteId", "clientId", "netBillAmount"], ["billNumber", "invoiceNo", "amount", "siteName"], ["siteId → sites", "clientId → clients", "linkedInvoiceId → invoices when present"], "construction billing revenue"),
  clientReceipts: makeCatalog("Client Receipts", "receiptKey/reference or document ID (immutable history)", ["raBillId", "amount", "receiptDate"], ["billId", "date", "transactionReference"], ["raBillId → raBills", "siteId → sites", "clientId → clients"], "immutable client collections"),
  raRetentionReleases: makeCatalog("RA Retention Releases", "document ID (immutable history)", ["raBillId", "amount", "releaseDate"], ["billId", "date", "releasedAmount"], ["raBillId → raBills", "siteId → sites", "clientId → clients"], "immutable retention history"),
  invoices: makeCatalog("Invoices", "invoiceNo + client/site or document ID", ["invoiceNo", "site", "totalAmount"], ["invoiceNumber", "billNo", "amount", "invoiceAmount", "siteName"], ["site/siteId → sites", "clientId → clients when present"], "legacy/canonical invoice revenue"),
  users: makeCatalog("User Profiles", "Firebase UID", ["role", "active"], ["name", "email"], ["Firebase Authentication account"], "security metadata; intentionally not browser-scanned"),
});

const cleanText = (value) => String(value === undefined || value === null ? "" : value).trim();
const keyText = (value) => cleanText(value).replace(/\s+/g, " ").toLowerCase();
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const hasValue = (value) => value !== undefined && value !== null && cleanText(value) !== "";
const isImmutableHistory = (collectionName) => IMMUTABLE_HISTORY_COLLECTIONS.includes(collectionName);
const recordKey = (collectionName, recordId) => `${collectionName}/${recordId || "[missing-id]"}`;

export const parseDataHealthNumber = (value) => {
  if (value === "" || value === null || value === undefined) return { isPresent: false, isValid: false, value: null, normalizable: false, reason: "missing" };
  if (typeof value === "number") return Number.isFinite(value)
    ? { isPresent: true, isValid: true, value, normalizable: false, reason: "number" }
    : { isPresent: true, isValid: false, value: null, normalizable: false, reason: "non-finite" };
  if (typeof value !== "string") return { isPresent: true, isValid: false, value: null, normalizable: false, reason: "not-a-number" };
  const numericText = value.trim().replace(/[₹,\s]/g, "");
  if (!numericText || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(numericText)) return { isPresent: true, isValid: false, value: null, normalizable: false, reason: "malformed" };
  const parsed = Number(numericText);
  return Number.isFinite(parsed)
    ? { isPresent: true, isValid: true, value: parsed, normalizable: true, reason: "numeric-string" }
    : { isPresent: true, isValid: false, value: null, normalizable: false, reason: "non-finite" };
};

const asRawRecords = (records) => Array.isArray(records)
  ? records
  : Array.isArray(records?.docs)
    ? records.docs.map((document) => ({ id: document?.id, data: typeof document?.data === "function" ? document.data() : document?.data }))
    : [];

export const normaliseDataHealthRecords = (records = []) => asRawRecords(records).map((entry, index) => {
  const source = isPlainObject(entry?.data) ? entry.data : isPlainObject(entry) ? entry : {};
  const { data: ignoredData, id: embeddedId, ...data } = source;
  return { id: cleanText(entry?.id || embeddedId), data: { ...data }, index };
});

const getFieldValue = (data = {}, fields = []) => {
  for (const field of fields) if (hasValue(data[field])) return data[field];
  return "";
};
const getFirstPresentField = (data = {}, fields = []) => fields.find((field) => hasValue(data[field])) || "";
const getRecordSite = (record = {}) => getSiteName(record.data || record);

const RECORD_LABEL_FIELDS = {
  sites: ["siteName", "name", "site"], siteBudgets: ["siteName", "site", "siteId"], inventoryItems: ["materialName", "material", "itemKey"], inventoryTransactions: ["reference", "inventoryItemId"], vendors: ["vendorName", "name", "supplierName"], purchaseRequests: ["requestNumber", "number"], purchaseOrders: ["poNumber", "number"], goodsReceipts: ["grnNumber", "receiptNumber", "number"], workOrders: ["workOrderNumber", "number"], workOrderProgress: ["workOrderNumber", "workOrderId"], contractorBills: ["billNumber", "contractorBillNumber", "reference"], contractorPayments: ["reference", "contractorBillId", "workOrderId"], labours: ["name", "labourName", "employeeName"], materials: ["materialName", "name", "material", "billNo"], expenses: ["description", "category", "expenseType"], attendance: ["employeeName", "labourName", "labourId"], salaries: ["employeeName", "labourName", "labourId"], salaryPayments: ["labourName", "employeeName", "reference", "labourId"], labourAdvances: ["labourName", "employeeName", "labourId"], vehicles: ["vehicleNumber", "vehicleNo", "registrationNumber", "name"], vehicleExpenses: ["vehicleNumber", "vehicleName", "vehicleId"], vehicleAssignments: ["vehicleNumber", "vehicleId"], vehicleMaintenance: ["vehicleNumber", "vehicleId"], dailyProgressReports: ["workActivity", "activity", "site"], boqItems: ["itemNumber", "itemCode", "description"], boqMeasurements: ["boqItemNumber", "boqItemId"], boqVariations: ["variationReference", "itemNumber", "boqItemId"], auditLogs: ["recordLabel", "module", "recordId"], clients: ["clientName", "name", "companyName"], siteBillingProfiles: ["siteName", "agreementNumber", "siteId"], raBills: ["raBillNumber", "billNumber"], clientReceipts: ["reference", "receiptKey", "raBillNumber", "raBillId"], raRetentionReleases: ["reference", "raBillNumber", "raBillId"], invoices: ["invoiceNo", "invoiceNumber", "billNo"],
};

export const getDataHealthRecordLabel = (collectionName, record = {}) => {
  const data = record?.data || record || {};
  return cleanText(getFieldValue(data, RECORD_LABEL_FIELDS[collectionName] || [])) || cleanText(record?.id) || "Unnamed record";
};

const candidate = ({ category, severity = "warning", collection, record, summary, field = "", value = "", expected = "", proposedChanges = [], relatedRecordIds = [], manualReview = true }) => ({
  id: [category, collection, record?.id || "missing-id", field, summary].join("::").slice(0, 500),
  category, severity, collection,
  collectionLabel: DATA_HEALTH_COLLECTION_CATALOG[collection]?.label || collection,
  recordId: record?.id || "", recordLabel: getDataHealthRecordLabel(collection, record),
  site: getSiteName(record?.data || record || {}), summary, field,
  value: value === undefined || value === null ? "" : String(value), expected,
  proposedChanges, relatedRecordIds, manualReview,
});
const NORMALIZATION_RULES = {
  sites: { aliases: { siteName: ["name", "site", "projectName"] }, text: ["siteName", "location", "engineer", "status"] },
  siteBudgets: { aliases: { siteName: ["site", "projectName"] }, text: ["siteId", "siteName"] },
  inventoryItems: { aliases: { materialName: ["material", "name"], site: ["siteName"] }, text: ["materialName", "site", "unit", "supplier", "reference"] },
  inventoryTransactions: { aliases: { inventoryItemId: ["itemId"], transactionType: ["type"], date: ["transactionDate"] }, text: ["inventoryItemId", "transactionType", "date", "site", "reference"] },
  vendors: { aliases: { vendorName: ["name", "supplierName"] }, text: ["vendorName", "gstin", "mobile", "vendorType"] },
  purchaseRequests: { aliases: { requestNumber: ["number"], date: ["requestDate"] }, text: ["requestNumber", "site", "date", "status"] },
  purchaseOrders: { aliases: { poNumber: ["number", "purchaseOrderNumber"] }, text: ["poNumber", "vendorId", "site", "poDate", "status"] },
  goodsReceipts: { aliases: { grnNumber: ["number", "receiptNumber"], receiptDate: ["grnDate", "date"], purchaseOrderId: ["poId"] }, text: ["grnNumber", "purchaseOrderId", "vendorId", "site", "receiptDate"] },
  workOrders: { aliases: { workOrderNumber: ["number", "orderNumber"], vendorId: ["contractorId"] }, text: ["workOrderNumber", "vendorId", "site", "siteId"] },
  workOrderProgress: { aliases: { workOrderId: ["orderId"], date: ["progressDate"] }, text: ["workOrderId", "site", "date"] },
  contractorBills: { aliases: { vendorId: ["contractorId"], billNumber: ["billNo"] }, text: ["vendorId", "workOrderId", "site", "billNumber"] },
  contractorPayments: { aliases: { contractorBillId: ["billId"], paymentDate: ["date"] }, text: ["contractorBillId", "workOrderId", "vendorId", "paymentDate", "reference"] },
  labours: { aliases: { name: ["labourName", "employeeName"], dailyWage: ["wage"], monthlySalary: ["salary"] }, text: ["name", "mobile", "aadhaar", "work", "site", "payType", "joiningDate"] },
  materials: { aliases: { materialName: ["material", "name"], quantity: ["qty"], rate: ["unitRate", "price"], date: ["purchaseDate"] }, text: ["materialName", "site", "unit", "date", "billNo"] },
  expenses: { aliases: { amount: ["expenseAmount"], expenseType: ["type", "category"] }, text: ["expenseType", "category", "site", "date", "description"] },
  attendance: { aliases: { labourName: ["employeeName", "name"], overtimeHours: ["overtime"] }, text: ["labourId", "labourName", "site", "date", "status"] },
  salaries: { aliases: { labourName: ["employeeName", "name"], payrollMonth: ["month"], netSalary: ["netPay"] }, text: ["labourId", "labourName", "site", "payrollMonth", "month", "status"] },
  salaryPayments: { aliases: { salaryId: ["payrollId"], paymentDate: ["date"] }, text: ["salaryId", "labourId", "labourName", "paymentDate", "reference"] },
  labourAdvances: { aliases: { amount: ["advanceAmount"], recoveredAmount: ["recoveryAmount"] }, text: ["labourId", "labourName", "site", "date", "reason", "status"] },
  vehicles: { aliases: { vehicleNumber: ["vehicleNo", "registrationNumber"] }, text: ["vehicleNumber", "vehicleName", "name", "site", "status"] },
  vehicleExpenses: { aliases: { amount: ["expenseAmount", "fuelAmount"], date: ["fuelDate"] }, text: ["vehicleId", "vehicleNumber", "site", "date", "expenseType"] },
  vehicleAssignments: { aliases: { assignmentDate: ["date"] }, text: ["vehicleId", "vehicleNumber", "site", "assignmentDate", "releaseDate"] },
  vehicleMaintenance: { aliases: { serviceDate: ["date"] }, text: ["vehicleId", "vehicleNumber", "site", "serviceDate", "status"] },
  dailyProgressReports: { aliases: { workActivity: ["activity"], workLocation: ["location"], materialsUsed: ["materials"], equipmentUsed: ["equipment"] }, text: ["site", "date", "workActivity", "workLocation", "unit", "createdBy"] },
  boqItems: { aliases: { itemNumber: ["itemNo"], itemCode: ["code"] }, text: ["siteId", "site", "itemNumber", "itemCode", "unit"] },
  boqMeasurements: { aliases: { boqItemId: ["itemId"], date: ["measurementDate"], quantity: ["qty"] }, text: ["siteId", "site", "boqItemId", "date", "status"] },
  boqVariations: { aliases: { boqItemId: ["itemId"], variationReference: ["reference"], quantityChange: ["qty"] }, text: ["siteId", "site", "boqItemId", "variationReference", "status"] },
  auditLogs: { aliases: {}, text: ["userId", "userEmail", "userRole", "action", "module", "recordId", "site"] },
  clients: { aliases: { clientName: ["name", "companyName"] }, text: ["clientName", "mobile", "email", "gstin"] },
  siteBillingProfiles: { aliases: { siteName: ["site"], agreementNumber: ["agreementNo"] }, text: ["siteId", "siteName", "clientId", "clientName", "agreementNumber"] },
  raBills: { aliases: { raBillNumber: ["billNumber"], netBillAmount: ["amount"] }, text: ["raBillNumber", "siteId", "site", "clientId", "clientName", "billDate", "status"] },
  clientReceipts: { aliases: { raBillId: ["billId"], receiptDate: ["date"], reference: ["transactionReference"] }, text: ["raBillId", "raBillNumber", "siteId", "site", "clientId", "receiptDate", "reference"] },
  raRetentionReleases: { aliases: { raBillId: ["billId"], releaseDate: ["date"], amount: ["releasedAmount"] }, text: ["raBillId", "raBillNumber", "siteId", "site", "clientId", "releaseDate", "reference"] },
  invoices: { aliases: { invoiceNo: ["invoiceNumber", "billNo"] }, text: ["invoiceNo", "site", "clientName", "invoiceDate", "status"] },
};

const DATE_FIELDS = new Set([
  "date", "joiningDate", "poDate", "expectedDeliveryDate", "receiptDate", "assignmentDate", "releaseDate", "serviceDate", "invoiceDate", "paymentDate", "billDate", "billingPeriodFrom", "billingPeriodTo", "paymentDueDate", "createdAt", "updatedAt",
]);
const NON_NEGATIVE_NUMERIC_FIELDS = new Set([
  "amount", "expenseAmount", "totalAmount", "purchaseAmount", "invoiceAmount", "netBillAmount", "grossWorkValue", "paidAmount", "pendingAmount", "receivedAmount", "creditedAmount", "tdsAmount", "tdsDeducted", "retentionBalance", "retentionAmount", "advanceReceived", "advanceAdjusted", "contractValue", "quantity", "qty", "rate", "unitRate", "price", "unitPrice", "openingStock", "currentStock", "reorderLevel", "materialBudget", "labourBudget", "vehicleBudget", "otherExpenseBudget", "totalBudget", "contingency", "dailyWage", "wage", "monthlySalary", "salary", "grossPay", "netPay", "netSalary", "basePay", "overtimePay", "overtimeRate", "overtimeHours", "deductions", "totalDeductions", "advanceDeduction", "recoveredAmount", "recoveryAmount", "fuelAmount", "fuelExpense", "fuelQuantity", "litres", "meterReading", "labourCost", "partsCost", "otherCost", "quantityChange", "revisedRate", "variationValue", "manpowerCount", "materialQuantity", "equipmentUsage",
]);

const normaliseCopyText = (value, field) => {
  if (typeof value !== "string") return value;
  return field === "site" || field === "siteName"
    ? normaliseSiteName(value)
    : value.trim().replace(/\s+/g, " ");
};

// The returned object is a transformed COPY. No caller gets a reference that
// may be used to mutate the input record, and immutable history has no proposals.
export const createDryRunNormalization = (collectionName, sourceRecord = {}) => {
  const record = normaliseDataHealthRecords([sourceRecord])[0] || { id: "", data: {}, index: 0 };
  const originalData = record.data;
  const normalizedData = { ...originalData };
  const proposedChanges = [];
  const manualReview = [];
  const rules = NORMALIZATION_RULES[collectionName] || { aliases: {}, text: [] };
  const immutable = isImmutableHistory(collectionName);

  if (!record.id) manualReview.push("Document has no usable Firestore document ID.");
  Object.entries(rules.aliases).forEach(([canonicalField, aliases]) => {
    const canonicalValue = originalData[canonicalField];
    const aliasField = getFirstPresentField(originalData, aliases);
    const aliasValue = aliasField ? originalData[aliasField] : undefined;
    if (!hasValue(canonicalValue) && hasValue(aliasValue)) {
      if (immutable) manualReview.push(`${canonicalField} exists only as legacy ${aliasField}; immutable history must not be rewritten.`);
      else {
        normalizedData[canonicalField] = aliasValue;
        proposedChanges.push({ field: canonicalField, from: "", to: aliasValue, reason: `Copy legacy ${aliasField} into the current field on a review copy.` });
      }
    } else if (hasValue(canonicalValue) && hasValue(aliasValue) && String(canonicalValue) !== String(aliasValue)) {
      manualReview.push(`${canonicalField} conflicts with legacy ${aliasField}; human review is required.`);
    }
  });

  rules.text.forEach((field) => {
    const current = normalizedData[field];
    const normalized = normaliseCopyText(current, field);
    if (typeof current === "string" && normalized !== current) {
      if (immutable) manualReview.push(`${field} has legacy formatting; immutable history must not be rewritten.`);
      else {
        normalizedData[field] = normalized;
        proposedChanges.push({ field, from: current, to: normalized, reason: "Trim and normalize whitespace without changing business meaning." });
      }
    }
  });

  Object.entries(normalizedData).forEach(([field, value]) => {
    if (!hasValue(value)) return;
    if (DATE_FIELDS.has(field)) {
      const canonicalDate = normaliseDate(value);
      if (!canonicalDate) manualReview.push(`${field} is not a valid date.`);
      else if (typeof value === "string" && value !== canonicalDate) {
        if (immutable) manualReview.push(`${field} uses a legacy date format; immutable history must not be rewritten.`);
        else {
          normalizedData[field] = canonicalDate;
          proposedChanges.push({ field, from: value, to: canonicalDate, reason: "Normalize a parseable legacy date to YYYY-MM-DD on a review copy." });
        }
      }
    }
    if (NON_NEGATIVE_NUMERIC_FIELDS.has(field)) {
      const parsed = parseDataHealthNumber(value);
      if (!parsed.isValid) manualReview.push(`${field} contains an invalid numeric value.`);
      else if (parsed.value < 0) manualReview.push(`${field} is negative where this schema expects a non-negative value.`);
      else if (parsed.normalizable) {
        if (immutable) manualReview.push(`${field} is a numeric string; immutable history must not be rewritten.`);
        else {
          normalizedData[field] = parsed.value;
          proposedChanges.push({ field, from: value, to: parsed.value, reason: "Convert a valid numeric string to a number on a review copy." });
        }
      }
    }
  });

  return { collection: collectionName, id: record.id, originalData: { ...originalData }, normalizedData, proposedChanges, manualReview, canNormalise: proposedChanges.length > 0 && manualReview.length === 0, isImmutableHistory: immutable };
};

const getMissingRequiredFieldCandidates = (collectionName, records) => {
  const requiredFields = DATA_HEALTH_COLLECTION_CATALOG[collectionName]?.requiredFields || [];
  const aliases = NORMALIZATION_RULES[collectionName]?.aliases || {};
  return records.flatMap((record) => requiredFields.flatMap((fieldGroup) => {
    const alternatives = fieldGroup.split("/");
    const hasCurrentValue = alternatives.some((field) => hasValue(record.data[field]));
    const hasLegacyFallback = alternatives.some((field) => getFirstPresentField(record.data, aliases[field] || []));
    return hasCurrentValue || hasLegacyFallback ? [] : [candidate({
      category: "legacy", severity: "warning", collection: collectionName, record, field: fieldGroup,
      summary: `Current schema field ${fieldGroup} is missing and no supported legacy fallback was found. Retain the record and review its historical context.`,
    })];
  }));
};

const getNormalizationCandidates = (collectionName, records) => records.flatMap((record) => {
  const result = createDryRunNormalization(collectionName, record);
  const candidates = result.proposedChanges.length ? [candidate({
    category: "normalization", severity: "info", collection: collectionName, record,
    summary: "A deterministic normalization is available on a copy only; no Firestore write is offered.", proposedChanges: result.proposedChanges, manualReview: false,
  })] : [];
  result.manualReview.forEach((summary) => candidates.push(candidate({ category: "legacy", severity: "warning", collection: collectionName, record, summary })));
  return candidates;
});
const getDuplicateKey = (collectionName, data = {}) => {
  const site = keyText(getSiteName(data));
  const siteId = keyText(data.siteId);
  const name = keyText(data.name || data.labourName || data.employeeName || data.vendorName || data.clientName);
  const mobile = keyText(data.mobile || data.phone || data.contactNumber);
  const aadhaar = keyText(data.aadhaar || data.aadhaarNumber);
  const gstin = keyText(data.gstin || data.gst || data.gstNumber);
  const vehicle = keyText(data.vehicleNumber || data.vehicleNo || data.registrationNumber);
  const date = normaliseDate(data.date || data.attendanceDate || data.invoiceDate || data.billDate || data.receiptDate);
  const labourId = keyText(data.labourId);
  const unit = keyText(data.unit);
  const material = keyText(data.materialName || data.material || data.name);
  const clientId = keyText(data.clientId);
  const reference = keyText(data.requestNumber || data.poNumber || data.grnNumber || data.workOrderNumber || data.invoiceNo || data.invoiceNumber || data.raBillNumber || data.receiptKey || data.reference || data.transactionReference);
  const boqCode = keyText(data.itemCode || data.itemNumber || data.boqItemId);
  if (collectionName === "sites") return site && keyText(data.location) ? `site:${site}|${keyText(data.location)}` : "";
  if (collectionName === "labours") {
    if (aadhaar) return `labour:aadhaar:${aadhaar}`;
    if (mobile && name) return `labour:mobile-name:${mobile}|${name}`;
    return name && site ? `labour:name-site:${name}|${site}` : "";
  }
  if (collectionName === "attendance") return (labourId || name) && date ? `attendance:${labourId || name}|${date}` : "";
  if (collectionName === "inventoryItems") return material && site && unit ? `inventory:${material}|${site}|${unit}` : keyText(data.itemKey) ? `inventory:${keyText(data.itemKey)}` : "";
  if (collectionName === "vendors") return gstin ? `vendor:gstin:${gstin}` : mobile && name ? `vendor:mobile-name:${mobile}|${name}` : "";
  if (collectionName === "vehicles") return vehicle ? `vehicle:${vehicle}` : "";
  if (["purchaseRequests", "purchaseOrders", "goodsReceipts", "workOrders"].includes(collectionName)) return reference ? `${collectionName}:${reference}` : "";
  if (["invoices", "raBills"].includes(collectionName)) return reference && (clientId || name) && (siteId || site) ? `${collectionName}:${reference}|${clientId || name}|${siteId || site}` : "";
  if (["clientReceipts", "contractorPayments", "salaryPayments", "raRetentionReleases"].includes(collectionName)) return reference ? `${collectionName}:${reference}` : "";
  if (collectionName === "boqItems") return (siteId || site) && boqCode ? `boq:${siteId || site}|${boqCode}` : "";
  return "";
};

export const detectDuplicateCandidates = (collectionDocuments = {}) => {
  const candidates = [];
  DATA_HEALTH_COLLECTIONS.forEach((collectionName) => {
    const groups = new Map();
    normaliseDataHealthRecords(collectionDocuments[collectionName]).forEach((record) => {
      const identity = getDuplicateKey(collectionName, record.data);
      if (!identity) return;
      const group = groups.get(identity) || [];
      group.push(record);
      groups.set(identity, group);
    });
    groups.forEach((records, identity) => {
      if (records.length < 2) return;
      records.forEach((record) => candidates.push(candidate({
        category: "duplicate", severity: "warning", collection: collectionName, record,
        summary: `Possible duplicate identity ${identity}. Compare matching documents before any manual merge or archival decision.`,
        relatedRecordIds: records.filter((entry) => entry.id !== record.id).map((entry) => entry.id),
      })));
    });
  });
  return candidates;
};

const createReferenceIndex = (records, fields) => {
  const ids = new Set();
  const names = new Set();
  records.forEach((record) => {
    if (record.id) ids.add(keyText(record.id));
    const name = getFieldValue(record.data, fields);
    if (hasValue(name)) names.add(keyText(name));
  });
  return { ids, names };
};
const hasIndexedReference = (index, value, byName = false) => {
  const key = keyText(value);
  return key && (byName ? index.names.has(key) : index.ids.has(key));
};

const collectRelationshipCandidates = (collectionName, records, indexes) => {
  const result = [];
  const add = (record, field, expected, summary, value = record.data[field]) => result.push(candidate({
    category: "orphan", severity: "warning", collection: collectionName, record, field, value, expected, summary,
  }));
  const checkId = (record, field, expected, index) => {
    if (hasValue(record.data[field]) && !hasIndexedReference(index, record.data[field])) add(record, field, expected, `${field} references a ${expected} record that was not found in this read-only scan.`);
  };
  const checkSite = (record) => {
    const siteId = record.data.siteId;
    const siteName = getRecordSite(record);
    if (hasValue(siteId)) checkId(record, "siteId", "site", indexes.sites);
    else if (hasValue(siteName) && !hasIndexedReference(indexes.sites, siteName, true)) add(record, "site", "site", "The site name does not match a scanned site master. It may be historical or renamed and requires review.", siteName);
  };
  records.forEach((record) => {
    const data = record.data;
    if (!["sites", "vendors", "clients", "auditLogs"].includes(collectionName)) checkSite(record);
    if (["attendance", "salaries", "salaryPayments", "labourAdvances"].includes(collectionName)) checkId(record, "labourId", "labour", indexes.labours);
    if (collectionName === "salaryPayments") {
      const payrollField = hasValue(data.salaryId) ? "salaryId" : "payrollId";
      if (hasValue(data[payrollField])) checkId(record, payrollField, "payroll record", indexes.salaries);
    }
    if (collectionName === "inventoryItems" && hasValue(data.materialId)) checkId(record, "materialId", "material purchase/master", indexes.materials);
    if (collectionName === "inventoryTransactions") checkId(record, "inventoryItemId", "inventory item", indexes.inventoryItems);
    if (["purchaseOrders", "goodsReceipts", "workOrders", "contractorBills", "contractorPayments"].includes(collectionName) && hasValue(data.vendorId)) checkId(record, "vendorId", "vendor", indexes.vendors);
    if (collectionName === "purchaseOrders") checkId(record, "purchaseRequestId", "purchase request", indexes.purchaseRequests);
    if (collectionName === "goodsReceipts") checkId(record, "purchaseOrderId", "purchase order", indexes.purchaseOrders);
    if (["workOrderProgress", "contractorBills", "contractorPayments"].includes(collectionName)) checkId(record, "workOrderId", "work order", indexes.workOrders);
    if (collectionName === "contractorPayments") checkId(record, "contractorBillId", "contractor bill", indexes.contractorBills);
    if (["vehicleExpenses", "vehicleAssignments", "vehicleMaintenance"].includes(collectionName)) checkId(record, "vehicleId", "vehicle", indexes.vehicles);
    if (["siteBillingProfiles", "raBills", "clientReceipts", "raRetentionReleases", "invoices"].includes(collectionName) && hasValue(data.clientId)) checkId(record, "clientId", "client", indexes.clients);
    if (["clientReceipts", "raRetentionReleases"].includes(collectionName)) checkId(record, "raBillId", "RA bill", indexes.raBills);
    if (["raBills", "clientReceipts"].includes(collectionName)) checkId(record, "linkedInvoiceId", "invoice", indexes.invoices);
    if (["boqMeasurements", "boqVariations", "workOrders"].includes(collectionName)) checkId(record, "boqItemId", "BOQ item", indexes.boqItems);
  });
  return result;
};

export const detectOrphanCandidates = (collectionDocuments = {}) => {
  const recordsByCollection = Object.fromEntries(DATA_HEALTH_COLLECTIONS.map((name) => [name, normaliseDataHealthRecords(collectionDocuments[name])]));
  const indexes = {
    sites: createReferenceIndex(recordsByCollection.sites, ["siteName", "name", "site"]),
    labours: createReferenceIndex(recordsByCollection.labours, ["name", "labourName", "employeeName"]),
    salaries: createReferenceIndex(recordsByCollection.salaries, ["employeeName", "labourName", "payrollMonth"]),
    materials: createReferenceIndex(recordsByCollection.materials, ["materialName", "name", "material"]),
    inventoryItems: createReferenceIndex(recordsByCollection.inventoryItems, ["itemKey", "materialName"]),
    vendors: createReferenceIndex(recordsByCollection.vendors, ["vendorName", "name"]),
    purchaseRequests: createReferenceIndex(recordsByCollection.purchaseRequests, ["requestNumber"]),
    purchaseOrders: createReferenceIndex(recordsByCollection.purchaseOrders, ["poNumber"]),
    workOrders: createReferenceIndex(recordsByCollection.workOrders, ["workOrderNumber"]),
    contractorBills: createReferenceIndex(recordsByCollection.contractorBills, ["billNumber"]),
    vehicles: createReferenceIndex(recordsByCollection.vehicles, ["vehicleNumber", "vehicleNo"]),
    clients: createReferenceIndex(recordsByCollection.clients, ["clientName", "name"]),
    raBills: createReferenceIndex(recordsByCollection.raBills, ["raBillNumber"]),
    invoices: createReferenceIndex(recordsByCollection.invoices, ["invoiceNo", "invoiceNumber"]),
    boqItems: createReferenceIndex(recordsByCollection.boqItems, ["itemNumber", "itemCode"]),
  };
  return DATA_HEALTH_COLLECTIONS.flatMap((name) => collectRelationshipCandidates(name, recordsByCollection[name], indexes));
};
const compareMoney = (first, second) => Math.abs(first - second) <= 0.01;
const validNumberFor = (data, fields) => {
  const field = getFirstPresentField(data, fields);
  return { field, parsed: parseDataHealthNumber(field ? data[field] : undefined) };
};

export const detectInvalidFinancialCandidates = (collectionDocuments = {}) => {
  const candidates = [];
  DATA_HEALTH_COLLECTIONS.forEach((collectionName) => {
    normaliseDataHealthRecords(collectionDocuments[collectionName]).forEach((record) => {
      const data = record.data;
      Object.entries(data).forEach(([field, value]) => {
        if (!NON_NEGATIVE_NUMERIC_FIELDS.has(field) || !hasValue(value)) return;
        const parsed = parseDataHealthNumber(value);
        if (!parsed.isValid || parsed.value < 0) candidates.push(candidate({
          category: "financial", severity: "critical", collection: collectionName, record, field, value,
          summary: !parsed.isValid
            ? `${field} is malformed or non-finite and cannot safely participate in totals.`
            : `${field} is negative where this ERP schema expects a non-negative value.`,
        }));
      });

      if (collectionName === "invoices") {
        const total = validNumberFor(data, ["totalAmount", "invoiceAmount", "amount"]);
        const paid = validNumberFor(data, ["paidAmount", "receivedAmount"]);
        const pending = validNumberFor(data, ["pendingAmount"]);
        if (total.parsed.isValid && paid.parsed.isValid && paid.parsed.value > total.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: paid.field, summary: "Invoice payment exceeds the invoice total." }));
        if (total.parsed.isValid && pending.parsed.isValid && pending.parsed.value > total.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: pending.field, summary: "Invoice pending amount exceeds the invoice total." }));
        if (total.parsed.isValid && paid.parsed.isValid && pending.parsed.isValid && !compareMoney(total.parsed.value, paid.parsed.value + pending.parsed.value)) candidates.push(candidate({ category: "financial", severity: "warning", collection: collectionName, record, field: "paidAmount/pendingAmount", summary: "Invoice total does not reconcile with paid plus pending amounts; review legacy values before changing history." }));
      }
      if (collectionName === "raBills") {
        const net = validNumberFor(data, ["netBillAmount", "totalAmount", "amount"]);
        const received = validNumberFor(data, ["receivedAmount"]);
        const pending = validNumberFor(data, ["pendingAmount"]);
        if (net.parsed.isValid && received.parsed.isValid && received.parsed.value > net.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: received.field, summary: "RA bill received amount exceeds its net bill amount." }));
        if (net.parsed.isValid && pending.parsed.isValid && pending.parsed.value > net.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: pending.field, summary: "RA bill pending amount exceeds its net bill amount." }));
        if (net.parsed.isValid && received.parsed.isValid && pending.parsed.isValid && !compareMoney(net.parsed.value, received.parsed.value + pending.parsed.value)) candidates.push(candidate({ category: "financial", severity: "warning", collection: collectionName, record, field: "receivedAmount/pendingAmount", summary: "RA bill net amount does not reconcile with received plus pending amounts; review before changing history." }));
      }
      if (collectionName === "salaries") {
        const net = validNumberFor(data, ["netSalary", "netPay", "salary", "totalSalary"]);
        const paid = validNumberFor(data, ["paidAmount"]);
        const pending = validNumberFor(data, ["pendingAmount"]);
        if (net.parsed.isValid && paid.parsed.isValid && paid.parsed.value > net.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: paid.field, summary: "Payroll paid amount exceeds its net salary." }));
        if (net.parsed.isValid && pending.parsed.isValid && pending.parsed.value > net.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: pending.field, summary: "Payroll pending amount exceeds its net salary." }));
        if (net.parsed.isValid && paid.parsed.isValid && pending.parsed.isValid && !compareMoney(net.parsed.value, paid.parsed.value + pending.parsed.value)) candidates.push(candidate({ category: "financial", severity: "warning", collection: collectionName, record, field: "paidAmount/pendingAmount", summary: "Payroll net salary does not reconcile with paid plus pending amounts; review before changing history." }));
      }
      if (collectionName === "labourAdvances") {
        const amount = validNumberFor(data, ["amount", "advanceAmount"]);
        const recovered = validNumberFor(data, ["recoveredAmount", "recoveryAmount"]);
        if (amount.parsed.isValid && recovered.parsed.isValid && recovered.parsed.value > amount.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: collectionName, record, field: recovered.field, summary: "Advance recovery exceeds the recorded advance amount." }));
      }
      if (collectionName === "siteBudgets" && isPlainObject(data.budget)) {
        Object.entries(data.budget).forEach(([field, value]) => {
          if (!hasValue(value)) return;
          const parsed = parseDataHealthNumber(value);
          if (!parsed.isValid || parsed.value < 0) candidates.push(candidate({
            category: "financial", severity: "critical", collection: collectionName, record, field: `budget.${field}`, value,
            summary: !parsed.isValid ? "Budget contains a malformed/non-finite amount." : "Budget contains a negative amount.",
          }));
        });
      }
      if (collectionName === "materials") {
        const quantity = validNumberFor(data, ["quantity", "qty"]);
        const rate = validNumberFor(data, ["rate", "unitRate", "price"]);
        const total = validNumberFor(data, ["totalAmount", "amount", "expenseAmount"]);
        if (quantity.parsed.isValid && rate.parsed.isValid && total.parsed.isValid && quantity.parsed.value >= 0 && rate.parsed.value >= 0 && !compareMoney(quantity.parsed.value * rate.parsed.value, total.parsed.value)) candidates.push(candidate({ category: "financial", severity: "warning", collection: collectionName, record, field: "quantity/rate/totalAmount", summary: "Material quantity × rate does not match its saved total. A legacy tax/discount field is possible; human review is required." }));
      }
    });
  });
  const salariesById = new Map(normaliseDataHealthRecords(collectionDocuments.salaries).filter((record) => record.id).map((record) => [record.id, record]));
  normaliseDataHealthRecords(collectionDocuments.salaryPayments).forEach((payment) => {
    const payrollId = cleanText(payment.data.salaryId || payment.data.payrollId);
    const payroll = salariesById.get(payrollId);
    const paymentAmount = validNumberFor(payment.data, ["amount", "paidAmount"]);
    const payrollNet = payroll ? validNumberFor(payroll.data, ["netSalary", "netPay", "salary", "totalSalary"]) : null;
    if (payroll && paymentAmount.parsed.isValid && payrollNet.parsed.isValid && paymentAmount.parsed.value > payrollNet.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: "salaryPayments", record: payment, field: paymentAmount.field, summary: "Salary payment exceeds the linked payroll net salary." }));
  });
  const raBillsById = new Map(normaliseDataHealthRecords(collectionDocuments.raBills).filter((record) => record.id).map((record) => [record.id, record]));
  normaliseDataHealthRecords(collectionDocuments.clientReceipts).forEach((receipt) => {
    const bill = raBillsById.get(cleanText(receipt.data.raBillId));
    const receiptAmount = validNumberFor(receipt.data, ["creditedAmount", "amount"]);
    const billNet = bill ? validNumberFor(bill.data, ["netBillAmount", "totalAmount", "amount"]) : null;
    if (bill && receiptAmount.parsed.isValid && billNet.parsed.isValid && receiptAmount.parsed.value > billNet.parsed.value) candidates.push(candidate({ category: "financial", severity: "critical", collection: "clientReceipts", record: receipt, field: receiptAmount.field, summary: "Client receipt exceeds the linked RA bill net amount." }));
  });
  return candidates;
};

const TEST_DEMO_PATTERN = /(^|[^a-z])(test|demo|sample|dummy|placeholder|trial|asdf|qwerty|xyz)([^a-z]|$)/i;
const getTestDemoValues = (data = {}) => [data.siteName, data.site, data.name, data.labourName, data.employeeName, data.vendorName, data.clientName, data.materialName, data.vehicleNumber, data.invoiceNo, data.raBillNumber, data.reference, data.description].filter(hasValue);

export const detectPossibleTestDemoCandidates = (collectionDocuments = {}) => DATA_HEALTH_COLLECTIONS.flatMap((collectionName) => normaliseDataHealthRecords(collectionDocuments[collectionName]).flatMap((record) => {
  const matchingValue = getTestDemoValues(record.data).find((value) => TEST_DEMO_PATTERN.test(String(value)));
  return matchingValue ? [candidate({
    category: "test-demo", severity: "info", collection: collectionName, record, value: matchingValue,
    summary: "Possible test/demo/placeholder wording detected. It is a manual-review candidate only and must not be assumed disposable.",
  })] : [];
}));

const getCandidateRecordKey = (entry) => recordKey(entry.collection, entry.recordId);
const countCategory = (candidates, category) => candidates.filter((entry) => entry.category === category).length;

// Runs entirely against supplied data. The explicit writeOperations: 0 value is
// intentional and tests assert it, making unsafe future expansion obvious.
export const runDataHealthDryRun = ({ collectionDocuments = {} } = {}) => {
  const recordsByCollection = Object.fromEntries(DATA_HEALTH_COLLECTIONS.map((name) => [name, normaliseDataHealthRecords(collectionDocuments[name])]));
  const total = DATA_HEALTH_COLLECTIONS.reduce((sum, name) => sum + recordsByCollection[name].length, 0);
  if (total > DATA_HEALTH_MAX_DOCUMENTS_TOTAL) throw new Error("The selected ERP data exceeds the safe browser diagnostic limit. Use a controlled Admin SDK review process instead.");
  DATA_HEALTH_COLLECTIONS.forEach((name) => {
    if (recordsByCollection[name].length > DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION) throw new Error(`Collection ${name} exceeds the safe browser diagnostic limit.`);
  });

  const schema = DATA_HEALTH_COLLECTIONS.flatMap((name) => [
    ...getMissingRequiredFieldCandidates(name, recordsByCollection[name]),
    ...getNormalizationCandidates(name, recordsByCollection[name]),
  ]);
  const candidates = [
    ...schema,
    ...detectDuplicateCandidates(recordsByCollection),
    ...detectOrphanCandidates(recordsByCollection),
    ...detectInvalidFinancialCandidates(recordsByCollection),
    ...detectPossibleTestDemoCandidates(recordsByCollection),
  ].sort((left, right) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[left.severity] - order[right.severity]) || left.collection.localeCompare(right.collection) || left.recordLabel.localeCompare(right.recordLabel);
  });

  const allKeys = new Set(DATA_HEALTH_COLLECTIONS.flatMap((name) => recordsByCollection[name].map((record) => recordKey(name, record.id || `index-${record.index}`))));
  const normalizable = new Set(candidates.filter((entry) => entry.category === "normalization").map(getCandidateRecordKey));
  const manual = new Set(candidates.filter((entry) => entry.category !== "normalization").map(getCandidateRecordKey));
  const affected = new Set([...normalizable, ...manual]);
  const collectionSummary = DATA_HEALTH_COLLECTIONS.map((name) => {
    const records = recordsByCollection[name];
    const keys = records.map((record) => recordKey(name, record.id || `index-${record.index}`));
    const uniqueAffected = new Set(keys.filter((key) => affected.has(key)));
    return {
      collection: name, label: DATA_HEALTH_COLLECTION_CATALOG[name]?.label || name, scanned: records.length,
      normalizable: keys.filter((key) => normalizable.has(key)).length,
      manualReview: keys.filter((key) => manual.has(key)).length,
      alreadyValid: Math.max(0, records.length - uniqueAffected.size), immutableHistory: isImmutableHistory(name),
    };
  });

  return {
    mode: "dry-run", writeOperations: 0, scannedAt: new Date().toISOString(), exclusions: DATA_HEALTH_EXCLUSIONS,
    collectionSummary, candidates,
    summary: {
      collectionsScanned: DATA_HEALTH_COLLECTIONS.length, recordsScanned: total,
      recordsAlreadyValid: Math.max(0, allKeys.size - affected.size), recordsNormalizable: normalizable.size,
      recordsRequiringManualReview: manual.size, duplicateCandidates: countCategory(candidates, "duplicate"),
      orphanCandidates: countCategory(candidates, "orphan"), invalidFinancialCandidates: countCategory(candidates, "financial"),
      possibleTestDemoCandidates: countCategory(candidates, "test-demo"),
      proposedChanges: candidates.reduce((sum, entry) => sum + entry.proposedChanges.length, 0),
    },
  };
};

export const filterDataHealthCandidates = (candidates = [], { category = "", severity = "", collection = "", search = "" } = {}) => {
  const query = keyText(search);
  return (Array.isArray(candidates) ? candidates : []).filter((entry) => {
    if (category && entry.category !== category) return false;
    if (severity && entry.severity !== severity) return false;
    if (collection && entry.collection !== collection) return false;
    return !query || [entry.collectionLabel, entry.recordLabel, entry.recordId, entry.summary, entry.field, entry.site, entry.value].some((value) => keyText(value).includes(query));
  });
};