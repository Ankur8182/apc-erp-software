import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export const SYSTEM_HEALTH_COLLECTION = "systemHealthEvents";
export const SYSTEM_HEALTH_EVENT_LIMIT = 100;
export const MONITORING_THROTTLE_WINDOW_MS = 5 * 60 * 1000;
export const MONITORING_SESSION_EVENT_LIMIT = 40;

export const MONITORING_CATEGORIES = [
  "NETWORK",
  "AUTHENTICATION",
  "PERMISSION",
  "VALIDATION",
  "FIRESTORE_READ",
  "FIRESTORE_WRITE",
  "EXPORT",
  "APPLICATION",
  "UNKNOWN",
];

export const MONITORING_SEVERITIES = ["INFO", "WARNING", "ERROR", "CRITICAL"];

export const MONITORING_CODES = [
  "permission-denied",
  "unauthenticated",
  "unavailable",
  "deadline-exceeded",
  "failed-precondition",
  "resource-exhausted",
  "aborted",
  "cancelled",
  "not-found",
  "invalid-argument",
  "auth-network-request-failed",
  "auth-user-disabled",
  "auth-user-token-expired",
  "auth-invalid-credential",
  "auth-too-many-requests",
  "auth-requires-recent-login",
  "auth-operation-not-allowed",
  "application-crash",
  "unknown",
];

export const MONITORING_MODULES = [
  "app",
  "auth",
  "notifications",
  "exports",
  "fieldUpdate",
  "dailyProgressReports",
  "expenses",
  "inventory",
  "purchaseOrders",
  "goodsReceipts",
  "attendance",
  "payroll",
  "salary",
  "clientBilling",
  "payments",
  "boq",
  "vehicles",
  "reports",
  "backup",
  "procurement",
  "subcontracting",
  "audit",
  "unknown",
];

export const MONITORING_OPERATIONS = [
  "read",
  "write",
  "authentication",
  "export",
  "application",
  "sync",
  "unknown",
];

const MONITORING_ROLES = ["admin", "manager", "viewer", "supervisor", "engineer"];

const SAFE_CODE_ALIASES = {
  "permission-denied": "permission-denied",
  unauthenticated: "unauthenticated",
  unavailable: "unavailable",
  "deadline-exceeded": "deadline-exceeded",
  "failed-precondition": "failed-precondition",
  "resource-exhausted": "resource-exhausted",
  aborted: "aborted",
  cancelled: "cancelled",
  "not-found": "not-found",
  "invalid-argument": "invalid-argument",
  "auth/network-request-failed": "auth-network-request-failed",
  "auth/user-disabled": "auth-user-disabled",
  "auth/user-token-expired": "auth-user-token-expired",
  "auth/invalid-credential": "auth-invalid-credential",
  "auth/too-many-requests": "auth-too-many-requests",
  "auth/requires-recent-login": "auth-requires-recent-login",
  "auth/operation-not-allowed": "auth-operation-not-allowed",
  "application-crash": "application-crash",
};

const MODULE_ALIASES = {
  app: "app",
  auth: "auth",
  notification: "notifications",
  notifications: "notifications",
  export: "exports",
  exports: "exports",
  fieldupdate: "fieldUpdate",
  dailyprogressreports: "dailyProgressReports",
  dpr: "dailyProgressReports",
  expenses: "expenses",
  expense: "expenses",
  inventory: "inventory",
  purchaseorders: "purchaseOrders",
  purchaseorder: "purchaseOrders",
  goodsreceipts: "goodsReceipts",
  goodsreceipt: "goodsReceipts",
  attendance: "attendance",
  payroll: "payroll",
  salary: "salary",
  clientbilling: "clientBilling",
  payments: "payments",
  payment: "payments",
  boq: "boq",
  vehicles: "vehicles",
  vehicle: "vehicles",
  reports: "reports",
  report: "reports",
  backup: "backup",
  procurement: "procurement",
  subcontracting: "subcontracting",
  workorders: "subcontracting",
  audit: "audit",
};

const SAFE_MESSAGES = {
  NETWORK: "A required connection could not be completed.",
  AUTHENTICATION: "An account or session action could not be completed.",
  PERMISSION: "An ERP action was refused because the account lacks access.",
  VALIDATION: "An ERP action was rejected because the submitted data was invalid.",
  FIRESTORE_READ: "ERP data could not be read from Firestore.",
  FIRESTORE_WRITE: "An ERP change could not be saved to Firestore.",
  EXPORT: "A report export or print action could not be completed.",
  APPLICATION: "The ERP client encountered an unexpected application error.",
  UNKNOWN: "An unexpected ERP operation failure was observed.",
};

const normaliseText = (value) => String(value || "").trim().toLowerCase();
const normaliseKey = (value) => normaliseText(value).replace(/[^a-z0-9]+/g, "");

const normaliseActor = (actor = {}) => {
  const userId = String(actor?.userId || actor?.uid || "").trim();
  const userRole = normaliseText(actor?.userRole || actor?.role);

  if (!userId || !MONITORING_ROLES.includes(userRole)) return null;

  return { userId, userRole };
};

const normaliseModule = (value) => MODULE_ALIASES[normaliseKey(value)] || "unknown";

const normaliseOperation = (value) => {
  const operation = normaliseText(value);
  return MONITORING_OPERATIONS.includes(operation) ? operation : "unknown";
};

const getSafeCode = (error, operation) => {
  const code = normaliseText(error?.code);

  if (SAFE_CODE_ALIASES[code]) return SAFE_CODE_ALIASES[code];

  const message = normaliseText(error?.message);
  if (code.includes("network") || message.includes("network") || message.includes("offline")) {
    return "unavailable";
  }

  return operation === "application" ? "application-crash" : "unknown";
};

const getCategory = ({ code, operation }) => {
  if (code === "permission-denied") return "PERMISSION";
  if (code === "unauthenticated" || code.startsWith("auth-")) return "AUTHENTICATION";
  if (code === "unavailable" || code === "deadline-exceeded") return "NETWORK";
  if (code === "invalid-argument") return "VALIDATION";
  if (operation === "export") return "EXPORT";
  if (operation === "application") return "APPLICATION";
  if (operation === "read") return "FIRESTORE_READ";
  if (operation === "write" || operation === "sync") return "FIRESTORE_WRITE";
  return "UNKNOWN";
};

const getSeverity = (category) => {
  if (category === "APPLICATION") return "CRITICAL";
  if (category === "NETWORK" || category === "VALIDATION") return "WARNING";
  if (category === "UNKNOWN") return "ERROR";
  return "ERROR";
};

const getTimestampDate = (value) => {
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normaliseMonitoringError = (error, context = {}) => {
  const operation = normaliseOperation(context.operation);
  const code = getSafeCode(error, operation);
  const category = getCategory({ code, operation });
  const requestedTimestamp = Number(context.now);
  const timestamp = Number.isFinite(requestedTimestamp)
    ? new Date(requestedTimestamp)
    : new Date();

  return {
    category,
    severity: getSeverity(category),
    code,
    safeMessage: SAFE_MESSAGES[category] || SAFE_MESSAGES.UNKNOWN,
    module: normaliseModule(context.module),
    operation,
    timestamp: timestamp.toISOString(),
  };
};

export const getMonitoringSafeMessage = (event) =>
  SAFE_MESSAGES[String(event?.category || "").toUpperCase()] || SAFE_MESSAGES.UNKNOWN;

export const formatMonitoringTimestamp = (value) => {
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

export const createMonitoringThrottle = ({
  windowMs = MONITORING_THROTTLE_WINDOW_MS,
  sessionLimit = MONITORING_SESSION_EVENT_LIMIT,
} = {}) => {
  const recentFingerprints = new Map();
  let acceptedEvents = 0;

  return {
    shouldCapture(fingerprint, now = Date.now()) {
      if (!fingerprint || acceptedEvents >= sessionLimit) return false;

      const previousTimestamp = recentFingerprints.get(fingerprint);
      if (Number.isFinite(previousTimestamp) && now - previousTimestamp < windowMs) {
        return false;
      }

      recentFingerprints.set(fingerprint, now);
      acceptedEvents += 1;
      return true;
    },
    reset() {
      recentFingerprints.clear();
      acceptedEvents = 0;
    },
  };
};

let monitoringActor = null;
const monitoringThrottle = createMonitoringThrottle();

export const setMonitoringActor = (actor) => {
  monitoringActor = normaliseActor(actor);
  return monitoringActor;
};

export const clearMonitoringActor = () => {
  monitoringActor = null;
};

export const resetMonitoringStateForTests = () => {
  monitoringActor = null;
  monitoringThrottle.reset();
};

export const createMonitoringEventPayload = ({
  actor,
  error,
  context,
  normalisedError,
} = {}) => {
  const safeActor = normaliseActor(actor) || monitoringActor;
  if (!safeActor) return null;

  const event = normalisedError || normaliseMonitoringError(error, context);

  return {
    userId: safeActor.userId,
    userRole: safeActor.userRole,
    category: event.category,
    severity: event.severity,
    code: event.code,
    module: event.module,
    operation: event.operation,
    timestamp: serverTimestamp(),
  };
};

export const captureMonitoringError = async (error, context = {}) => {
  const safeActor = normaliseActor(context.actor) || monitoringActor;
  const event = normaliseMonitoringError(error, context);

  if (!safeActor) {
    return { captured: false, reason: "actor-unavailable", event };
  }

  const fingerprint = [
    safeActor.userId,
    event.category,
    event.code,
    event.module,
    event.operation,
  ].join(":");

  if (!monitoringThrottle.shouldCapture(fingerprint, context.now || Date.now())) {
    return { captured: false, reason: "throttled", event };
  }

  const payload = createMonitoringEventPayload({
    actor: safeActor,
    normalisedError: event,
  });

  try {
    const reference = await addDoc(collection(db, SYSTEM_HEALTH_COLLECTION), payload);
    return { captured: true, id: reference.id, event };
  } catch (monitoringError) {
    // Monitoring must never prevent the ERP operation or trigger another event.
    console.error("System health event capture failed:", monitoringError);
    return { captured: false, reason: "monitoring-failed", event };
  }
};

export const getRecentMonitoringEvents = async ({
  database = db,
  eventLimit = SYSTEM_HEALTH_EVENT_LIMIT,
} = {}) => {
  const boundedLimit = Math.min(
    SYSTEM_HEALTH_EVENT_LIMIT,
    Math.max(1, Number(eventLimit) || SYSTEM_HEALTH_EVENT_LIMIT)
  );
  const snapshot = await getDocs(
    query(
      collection(database, SYSTEM_HEALTH_COLLECTION),
      orderBy("timestamp", "desc"),
      limit(boundedLimit)
    )
  );

  return Array.isArray(snapshot?.docs)
    ? snapshot.docs.map((entry) => {
      const data = typeof entry?.data === "function" ? entry.data() : {};
      return {
        id: String(entry?.id || ""),
        ...(data && typeof data === "object" ? data : {}),
      };
    })
    : [];
};

export const getSystemHealthSummary = (events, {
  now = Date.now(),
  isOnline = true,
} = {}) => {
  const records = Array.isArray(events) ? events : [];
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  const datedEvents = records.map((event) => ({ event, date: getTimestampDate(event?.timestamp) }));
  const last24Hours = datedEvents.filter(({ date }) => date && date.getTime() >= dayAgo);
  const last7Days = datedEvents.filter(({ date }) => date && date.getTime() >= weekAgo);
  const byCategory = MONITORING_CATEGORIES.reduce((counts, category) => ({
    ...counts,
    [category]: last24Hours.filter(({ event }) => event?.category === category).length,
  }), {});
  const criticalCount = last24Hours.filter(({ event }) => event?.severity === "CRITICAL").length;
  const errorCount = last24Hours.filter(({ event }) => event?.severity === "ERROR").length;
  const warningCount = last24Hours.filter(({ event }) => event?.severity === "WARNING").length;

  let status = "HEALTHY";
  if (!isOnline || criticalCount > 0) status = "ATTENTION REQUIRED";
  else if (errorCount >= 3 || warningCount >= 5) status = "DEGRADED";

  return {
    status,
    last24HoursCount: last24Hours.length,
    last7DaysCount: last7Days.length,
    criticalCount,
    errorCount,
    warningCount,
    byCategory,
  };
};
