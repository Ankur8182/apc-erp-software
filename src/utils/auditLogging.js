import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export const AUDIT_ACTIONS = ["create", "update", "delete"];

export const AUDIT_MODULES = [
  "labour",
  "sites",
  "materials",
  "expenses",
  "attendance",
  "salary",
  "salaryPayments",
  "labourAdvances",
  "vehicle",
  "vehicleExpenses",
  "invoices",
  "dailyProgressReports",
  "inventoryItems",
  "inventoryTransactions",
  "vendors",
  "purchaseRequests",
  "purchaseOrders",
  "goodsReceipts",
  "users",
];

const MODULE_ALIASES = {
  labour: "labour",
  labours: "labour",
  sites: "sites",
  materials: "materials",
  expenses: "expenses",
  attendance: "attendance",
  salary: "salary",
  salaries: "salary",
  salarypayments: "salaryPayments",
  "salary-payments": "salaryPayments",
  labouradvances: "labourAdvances",
  "labour-advances": "labourAdvances",
  vehicle: "vehicle",
  vehicles: "vehicle",
  vehicleexpenses: "vehicleExpenses",
  "vehicle-expenses": "vehicleExpenses",
  invoices: "invoices",
  invoice: "invoices",
  dailyprogressreports: "dailyProgressReports",
  "daily-progress-reports": "dailyProgressReports",
  dpr: "dailyProgressReports",
  inventoryitems: "inventoryItems",
  "inventory-items": "inventoryItems",
  inventorytransactions: "inventoryTransactions",
  "inventory-transactions": "inventoryTransactions",
  vendors: "vendors",
  vendor: "vendors",
  purchaserequests: "purchaseRequests",
  "purchase-requests": "purchaseRequests",
  purchaserequest: "purchaseRequests",
  purchaseorders: "purchaseOrders",
  "purchase-orders": "purchaseOrders",
  purchaseorder: "purchaseOrders",
  goodsreceipts: "goodsReceipts",
  "goods-receipts": "goodsReceipts",
  grn: "goodsReceipts",
  users: "users",
  user: "users",
};

const MAX_LENGTHS = {
  email: 320,
  recordId: 200,
  recordLabel: 250,
  details: 1000,
  site: 200,
};

const cleanText = (value, maxLength = 0) => {
  const text = String(value || "").trim();

  return maxLength ? text.slice(0, maxLength) : text;
};

export const normaliseAuditAction = (value) => {
  const action = cleanText(value).toLowerCase();

  if (!AUDIT_ACTIONS.includes(action)) {
    throw new Error("Unsupported audit action.");
  }

  return action;
};

export const normaliseAuditModule = (value) => {
  const moduleKey = cleanText(value)
    .replace(/\s+/g, "")
    .toLowerCase();
  const module = MODULE_ALIASES[moduleKey];

  if (!module) {
    throw new Error("Unsupported audit module.");
  }

  return module;
};

const normaliseAuditRole = (value) => cleanText(value).toLowerCase();

export const createAuditPayload = ({
  actor,
  action,
  module,
  recordId,
  recordLabel = "",
  details = "",
  site = "",
  timestamp = serverTimestamp(),
} = {}) => {
  const userId = cleanText(actor?.userId || actor?.uid);
  const userRole = normaliseAuditRole(actor?.userRole || actor?.role);
  const cleanRecordId = cleanText(recordId, MAX_LENGTHS.recordId);

  if (!userId || !userRole || !cleanRecordId) {
    throw new Error("Audit actor, role, and record ID are required.");
  }

  return {
    userId,
    userEmail: cleanText(actor?.userEmail || actor?.email, MAX_LENGTHS.email),
    userRole,
    action: normaliseAuditAction(action),
    module: normaliseAuditModule(module),
    recordId: cleanRecordId,
    recordLabel: cleanText(recordLabel, MAX_LENGTHS.recordLabel),
    timestamp,
    details: cleanText(details, MAX_LENGTHS.details),
    site: cleanText(site, MAX_LENGTHS.site),
  };
};

export const getCurrentAuditActor = async () => {
  const user = auth.currentUser;

  if (!user?.uid) {
    throw new Error("An authenticated user is required for audit logging.");
  }

  const profileSnapshot = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const role = normaliseAuditRole(profile.role);

  if (!role) {
    throw new Error("The current user role is unavailable for audit logging.");
  }

  return {
    userId: user.uid,
    userEmail: user.email || "",
    userRole: role,
  };
};

export const logAuditEvent = async (event) => {
  try {
    const actor = event?.actor || await getCurrentAuditActor();
    const payload = createAuditPayload({ ...event, actor });
    const auditReference = await addDoc(collection(db, "auditLogs"), payload);

    return { success: true, id: auditReference.id, payload };
  } catch (error) {
    console.error("Audit logging failed:", error);
    return { success: false, error };
  }
};

export const getAuditFailureMessage = () =>
  "The record was saved, but its audit entry could not be recorded. Please contact an administrator.";

const getTimestampDate = (value) => {
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getAuditDateKey = (value) => {
  const date = getTimestampDate(value);

  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const filterAuditLogs = (logs, filters = {}) => {
  const search = cleanText(filters.search).toLowerCase();
  const action = cleanText(filters.action).toLowerCase();
  const module = cleanText(filters.module);
  const date = cleanText(filters.date);

  return (Array.isArray(logs) ? logs : []).filter((log) => {
    const searchable = [
      log.userEmail,
      log.userId,
      log.userRole,
      log.action,
      log.module,
      log.recordId,
      log.recordLabel,
      log.details,
      log.site,
    ].join(" ").toLowerCase();

    return (!search || searchable.includes(search)) &&
      (!action || String(log.action || "").toLowerCase() === action) &&
      (!module || String(log.module || "") === module) &&
      (!date || getAuditDateKey(log.timestamp) === date);
  });
};

export const formatAuditTimestamp = (value) => {
  const date = getTimestampDate(value);

  return date
    ? date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Pending timestamp";
};
