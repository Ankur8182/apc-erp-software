import { ERP_NAME } from "../config/branding";

export const ERP_BACKUP_FORMAT = "ap-construction-erp-firestore-backup";
export const ERP_BACKUP_SCHEMA_VERSION = 1;
export const ERP_BACKUP_SCOPE = "Firestore ERP top-level collection export";
export const MAX_BACKUP_DOCUMENTS_PER_COLLECTION = 10000;
export const MAX_BACKUP_DOCUMENTS_TOTAL = 50000;

// `users` is intentionally excluded: the current rules permit an administrator
// to read only their own profile, and Firebase Authentication accounts cannot be
// exported from a browser. A project-level Admin SDK export is required for it.
export const ERP_BACKUP_COLLECTIONS = Object.freeze([
  "sites",
  "siteBudgets",
  "inventoryItems",
  "inventoryTransactions",
  "vendors",
  "purchaseRequests",
  "purchaseOrders",
  "goodsReceipts",
  "workOrders",
  "workOrderProgress",
  "contractorBills",
  "contractorPayments",
  "labours",
  "materials",
  "expenses",
  "attendance",
  "salaries",
  "salaryPayments",
  "labourAdvances",
  "vehicles",
  "vehicleExpenses",
  "vehicleAssignments",
  "vehicleMaintenance",
  "dailyProgressReports",
  "boqItems",
  "boqMeasurements",
  "boqVariations",
  "auditLogs",
  "clients",
  "siteBillingProfiles",
  "raBills",
  "clientReceipts",
  "raRetentionReleases",
  "invoices",
]);

export const ERP_BACKUP_EXCLUSIONS = Object.freeze({
  users: "User profiles cannot be listed by the browser under the current rules, and Firebase Authentication accounts are not Firestore data.",
  firebaseAuthentication: "Authentication accounts, passwords, sessions, and tokens are never available to the browser export.",
  firebaseStorage: "DPR photo metadata can be included in Firestore documents, but Storage files are not downloaded by this export.",
  firestoreInfrastructure: "Security rules, indexes, retention policies, and unknown or nested collections are not a part of this data export.",
});

const SENSITIVE_FIELD_KEYS = new Set([
  "password",
  "passwordhash",
  "passwordsalt",
  "token",
  "authtoken",
  "idtoken",
  "accesstoken",
  "refreshtoken",
  "secret",
  "privatekey",
  "serviceaccount",
  "credential",
  "credentials",
  "authorization",
  "apikey",
]);

const createBackupError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
};

const isPlainObject = (value) => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normaliseKey = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const isSensitiveFieldKey = (key) => SENSITIVE_FIELD_KEYS.has(normaliseKey(key));

const asIsoDate = (value, path) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createBackupError("backup-invalid-date", `Invalid date at ${path}.`, { path });
  }
  return date.toISOString();
};

const isTimestampLike = (value) =>
  value &&
  typeof value === "object" &&
  typeof value.toDate === "function" &&
  Number.isFinite(value.seconds) &&
  Number.isFinite(value.nanoseconds);

const isGeoPointLike = (value) =>
  value &&
  typeof value === "object" &&
  value.constructor?.name === "GeoPoint" &&
  Number.isFinite(value.latitude) &&
  Number.isFinite(value.longitude);

const isBytesLike = (value) =>
  value && typeof value === "object" && typeof value.toBase64 === "function";

const serialiseValue = (value, path, state) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw createBackupError("backup-unsupported-value", `Non-finite number at ${path}.`, { path });
    }
    return value;
  }

  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw createBackupError("backup-unsupported-value", `Unsupported value at ${path}.`, { path });
  }

  if (value instanceof Date) return { __apcBackupType: "date", iso: asIsoDate(value, path) };

  if (isTimestampLike(value)) {
    return {
      __apcBackupType: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: asIsoDate(value.toDate(), path),
    };
  }

  if (isGeoPointLike(value)) {
    return { __apcBackupType: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }

  if (isBytesLike(value)) {
    return { __apcBackupType: "bytes", base64: String(value.toBase64()) };
  }

  if (Array.isArray(value)) {
    if (state.stack.has(value)) {
      throw createBackupError("backup-circular-value", `Circular value at ${path}.`, { path });
    }
    state.stack.add(value);
    const serialised = value.map((entry, index) => serialiseValue(entry, `${path}[${index}]`, state));
    state.stack.delete(value);
    return serialised;
  }

  if (!isPlainObject(value)) {
    throw createBackupError("backup-unsupported-value", `Unsupported object at ${path}.`, { path });
  }

  if (state.stack.has(value)) {
    throw createBackupError("backup-circular-value", `Circular value at ${path}.`, { path });
  }

  state.stack.add(value);
  const serialised = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (isSensitiveFieldKey(key)) {
      state.redactedFieldCount += 1;
      return;
    }
    serialised[key] = serialiseValue(entry, `${path}.${key}`, state);
  });
  state.stack.delete(value);
  return serialised;
};

const normaliseDocuments = (documents, collectionName) => {
  if (Array.isArray(documents)) return documents;
  if (Array.isArray(documents?.docs)) {
    return documents.docs.map((snapshot) => ({
      id: snapshot?.id,
      data: typeof snapshot?.data === "function" ? snapshot.data() : snapshot?.data,
    }));
  }
  throw createBackupError(
    "backup-invalid-collection-payload",
    `Collection ${collectionName} did not return a valid document list.`,
    { collectionName }
  );
};

const validateCollectionNames = (collectionNames) => {
  const names = Array.isArray(collectionNames) ? collectionNames : [];
  if (names.length === 0) {
    throw createBackupError("backup-empty-collection-list", "At least one collection is required for an ERP backup.");
  }

  const seen = new Set();
  names.forEach((name) => {
    if (!ERP_BACKUP_COLLECTIONS.includes(name) || seen.has(name)) {
      throw createBackupError("backup-invalid-collection", `Unsupported or duplicate backup collection: ${name}.`, { collectionName: name });
    }
    seen.add(name);
  });

  return names;
};

const serialiseCollection = (collectionName, documents) => {
  const records = normaliseDocuments(documents, collectionName);
  if (records.length > MAX_BACKUP_DOCUMENTS_PER_COLLECTION) {
    throw createBackupError(
      "backup-collection-limit",
      `Collection ${collectionName} exceeds the safe browser export limit.`,
      { collectionName, documentCount: records.length }
    );
  }

  const ids = new Set();
  return records.map((record, index) => {
    const id = typeof record?.id === "string" ? record.id : "";
    if (!id || ids.has(id)) {
      throw createBackupError(
        "backup-duplicate-document-id",
        `Collection ${collectionName} contains a missing or duplicate document ID.`,
        { collectionName, recordIndex: index, documentId: id }
      );
    }
    if (!isPlainObject(record.data)) {
      throw createBackupError(
        "backup-invalid-document-data",
        `Document ${id} in ${collectionName} does not contain an object payload.`,
        { collectionName, documentId: id }
      );
    }

    ids.add(id);
    const state = { stack: new WeakSet(), redactedFieldCount: 0 };
    const data = serialiseValue(record.data, `${collectionName}/${id}`, state);
    return { id, data, redactedFieldCount: state.redactedFieldCount };
  }).sort((first, second) => first.id.localeCompare(second.id));
};

export const createErpFirestoreBackup = ({
  collectionDocuments = {},
  collectionNames = ERP_BACKUP_COLLECTIONS,
  exportedAt = new Date(),
  appVersion = "phase-9a",
} = {}) => {
  const names = validateCollectionNames(collectionNames);
  const collections = {};
  let documentCount = 0;
  let redactedFieldCount = 0;

  names.forEach((collectionName) => {
    if (!Object.prototype.hasOwnProperty.call(collectionDocuments, collectionName)) {
      throw createBackupError(
        "backup-missing-collection",
        `Backup input is missing the selected ${collectionName} collection.`,
        { collectionName }
      );
    }
    const records = serialiseCollection(collectionName, collectionDocuments[collectionName]);
    collections[collectionName] = records.map(({ id, data }) => ({ id, data }));
    documentCount += records.length;
    redactedFieldCount += records.reduce((total, record) => total + record.redactedFieldCount, 0);
  });

  if (documentCount > MAX_BACKUP_DOCUMENTS_TOTAL) {
    throw createBackupError(
      "backup-total-limit",
      "The ERP data exceeds the safe browser export limit. Use an Admin SDK/GCP export instead.",
      { documentCount }
    );
  }

  const backup = {
    metadata: {
      format: ERP_BACKUP_FORMAT,
      schemaVersion: ERP_BACKUP_SCHEMA_VERSION,
      application: ERP_NAME,
      appVersion: String(appVersion || "phase-9a"),
      scope: ERP_BACKUP_SCOPE,
      exportedAt: asIsoDate(exportedAt, "metadata.exportedAt"),
      collectionNames: names,
      collectionCount: names.length,
      documentCount,
      redactedFieldCount,
    },
    collections,
  };

  validateErpFirestoreBackup(backup);
  return backup;
};

const validateSerialisedValue = (value, path) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw createBackupError("backup-invalid-value", `Non-finite number at ${path}.`, { path });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateSerialisedValue(entry, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    throw createBackupError("backup-invalid-value", `Unsupported serialized value at ${path}.`, { path });
  }

  const type = value.__apcBackupType;
  if (type) {
    if (type === "date" && typeof value.iso === "string" && !Number.isNaN(Date.parse(value.iso))) return;
    if (type === "timestamp" && Number.isFinite(value.seconds) && Number.isFinite(value.nanoseconds) && typeof value.iso === "string" && !Number.isNaN(Date.parse(value.iso))) return;
    if (type === "geopoint" && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) return;
    if (type === "bytes" && typeof value.base64 === "string") return;
    throw createBackupError("backup-invalid-value", `Invalid ${type} backup value at ${path}.`, { path });
  }

  Object.entries(value).forEach(([key, entry]) => validateSerialisedValue(entry, `${path}.${key}`));
};

export const validateErpFirestoreBackup = (backup) => {
  if (!isPlainObject(backup) || !isPlainObject(backup.metadata) || !isPlainObject(backup.collections)) {
    throw createBackupError("backup-invalid-structure", "Backup must contain metadata and collection data.");
  }

  const { metadata, collections } = backup;
  if (metadata.format !== ERP_BACKUP_FORMAT || metadata.schemaVersion !== ERP_BACKUP_SCHEMA_VERSION) {
    throw createBackupError("backup-unsupported-schema", "Unsupported ERP backup format or schema version.");
  }
  if (metadata.application !== ERP_NAME || typeof metadata.appVersion !== "string" || !metadata.appVersion.trim() || metadata.scope !== ERP_BACKUP_SCOPE || typeof metadata.exportedAt !== "string" || Number.isNaN(Date.parse(metadata.exportedAt))) {
    throw createBackupError("backup-invalid-metadata", "Backup application metadata is invalid.");
  }

  const names = validateCollectionNames(metadata.collectionNames);
  if (metadata.collectionCount !== names.length || !Number.isInteger(metadata.documentCount) || metadata.documentCount < 0 || !Number.isInteger(metadata.redactedFieldCount) || metadata.redactedFieldCount < 0) {
    throw createBackupError("backup-invalid-metadata", "Backup document metadata is invalid.");
  }

  const collectionKeys = Object.keys(collections).sort();
  if (collectionKeys.length !== names.length || collectionKeys.some((name) => !names.includes(name))) {
    throw createBackupError("backup-invalid-collections", "Backup collection names do not match its metadata.");
  }

  let countedDocuments = 0;
  names.forEach((collectionName) => {
    const records = collections[collectionName];
    if (!Array.isArray(records)) {
      throw createBackupError("backup-invalid-collection-payload", `Collection ${collectionName} is not an array.`, { collectionName });
    }
    const ids = new Set();
    records.forEach((record, index) => {
      if (!isPlainObject(record) || typeof record.id !== "string" || !record.id || !isPlainObject(record.data) || ids.has(record.id)) {
        throw createBackupError("backup-invalid-document", `Invalid or duplicate document in ${collectionName}.`, { collectionName, recordIndex: index });
      }
      ids.add(record.id);
      validateSerialisedValue(record.data, `${collectionName}/${record.id}`);
    });
    countedDocuments += records.length;
  });

  if (countedDocuments !== metadata.documentCount) {
    throw createBackupError("backup-document-count-mismatch", "Backup document count does not match its collection data.");
  }

  return { valid: true, documentCount: countedDocuments, collectionCount: names.length };
};

export const createErpBackupJson = (backup) => {
  validateErpFirestoreBackup(backup);
  return `${JSON.stringify(backup, null, 2)}\n`;
};

export const createErpBackupFileName = (date = new Date()) => {
  const isoDate = asIsoDate(date, "backup file date").slice(0, 10);
  return `ap-construction-erp-backup-${isoDate}.json`;
};

export const downloadErpFirestoreBackup = (backup, fileName = createErpBackupFileName()) => {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw createBackupError("backup-download-unavailable", "This browser cannot download the ERP backup file.");
  }

  const blob = new Blob([createErpBackupJson(backup)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return fileName;
};

export const exportErpFirestoreBackup = async ({
  loadCollection,
  collectionNames = ERP_BACKUP_COLLECTIONS,
  exportedAt = new Date(),
  appVersion = "phase-9a",
} = {}) => {
  if (typeof loadCollection !== "function") {
    throw createBackupError("backup-missing-loader", "A collection loader is required to create an ERP backup.");
  }

  const names = validateCollectionNames(collectionNames);
  const collectionDocuments = {};
  let totalDocuments = 0;

  for (const collectionName of names) {
    try {
      const documents = await loadCollection(collectionName);
      const normalized = normaliseDocuments(documents, collectionName);
      totalDocuments += normalized.length;
      if (normalized.length > MAX_BACKUP_DOCUMENTS_PER_COLLECTION || totalDocuments > MAX_BACKUP_DOCUMENTS_TOTAL) {
        throw createBackupError("backup-export-limit", "The ERP data exceeds the safe browser export limit. Use an Admin SDK/GCP export instead.", { collectionName, documentCount: totalDocuments });
      }
      collectionDocuments[collectionName] = normalized;
    } catch (error) {
      if (error?.code?.startsWith("backup-")) throw error;
      throw createBackupError("backup-collection-read-failed", `Could not read ${collectionName} for the backup export.`, { collectionName, cause: error });
    }
  }

  return createErpFirestoreBackup({ collectionDocuments, collectionNames: names, exportedAt, appVersion });
};