import { createFieldUpdateDprPayload } from "./dailyProgressReporting";

export const DPR_OUTBOX_EVENT = "ap-construction-dpr-outbox-changed";
export const DPR_OUTBOX_STORAGE_KEY = "ap-construction-dpr-outbox-v1";
export const DPR_OUTBOX_DATABASE = "ap-construction-erp-offline";
export const DPR_OUTBOX_STORE = "dailyProgressReports";

export const DPR_OUTBOX_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  FAILED: "failed",
};

const cleanText = (value) => String(value ?? "").trim();
const clone = (value) => JSON.parse(JSON.stringify(value));
const getBrowserStorage = () => (typeof window === "undefined" ? null : window.localStorage);
const getIndexedDb = () => (typeof window === "undefined" ? null : window.indexedDB);

const createOutboxError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const LEGACY_PREFLIGHT_READ_FAILURE_MESSAGE = "Synchronization needs a valid active field account. This local update has been kept on this device.";
const LEGACY_PREFLIGHT_RETRY_MESSAGE = "A previous synchronization check will be retried with the current secure connection flow.";

const getDprSyncFailureCode = (error) => cleanText(error?.code).toLowerCase();

const isLegacyPreflightReadFailure = (raw = {}) =>
  raw.syncStatus === DPR_OUTBOX_STATUS.FAILED &&
  raw.retryable === false &&
  !cleanText(raw.failureCode) &&
  cleanText(raw.lastError) === LEGACY_PREFLIGHT_READ_FAILURE_MESSAGE;

const toIsoString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const randomSegment = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

export const createDprClientSubmissionId = (userId = "") => {
  const owner = cleanText(userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) || "field";
  return `dpr-${owner}-${randomSegment()}`.slice(0, 180);
};

export const notifyDprOutboxChange = () => {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(DPR_OUTBOX_EVENT));
  }
};

const normaliseEntry = (raw = {}, index = 0) => {
  const userId = cleanText(raw.userId);
  const clientSubmissionId = cleanText(raw.clientSubmissionId) || `invalid-dpr-${index}`;
  const rawPayload = raw.payload && typeof raw.payload === "object" ? raw.payload : {};
  const validation = userId
    ? createFieldUpdateDprPayload(rawPayload, userId)
    : { isValid: false, error: "A queued DPR must have an owner." };
  const knownStatus = Object.values(DPR_OUTBOX_STATUS).includes(raw.syncStatus);
  const legacyPreflightReadFailure = isLegacyPreflightReadFailure(raw);

  if (!validation.isValid || !userId || !cleanText(raw.clientSubmissionId)) {
    return {
      clientSubmissionId,
      userId,
      site: cleanText(raw.site || rawPayload.site),
      localCreatedAt: toIsoString(raw.localCreatedAt),
      payload: rawPayload,
      syncStatus: DPR_OUTBOX_STATUS.FAILED,
      retryCount: Math.max(Number(raw.retryCount) || 0, 0),
      retryable: false,
      failureCode: "dpr-outbox-invalid-payload",
      lastError: "Queued DPR contains invalid data and cannot be synchronized. It has been kept on this device for review.",
    };
  }

  return {
    clientSubmissionId,
    userId,
    site: validation.value.site,
    localCreatedAt: toIsoString(raw.localCreatedAt),
    payload: validation.value,
    syncStatus: legacyPreflightReadFailure
      ? DPR_OUTBOX_STATUS.PENDING
      : knownStatus
        ? raw.syncStatus
        : DPR_OUTBOX_STATUS.PENDING,
    retryCount: Math.max(Number(raw.retryCount) || 0, 0),
    retryable: legacyPreflightReadFailure ? true : raw.retryable !== false,
    failureCode: legacyPreflightReadFailure
      ? "dpr-outbox-legacy-preflight-read"
      : cleanText(raw.failureCode),
    lastError: legacyPreflightReadFailure
      ? LEGACY_PREFLIGHT_RETRY_MESSAGE
      : cleanText(raw.lastError),
  };
};

export const createOfflineDprEntry = ({ clientSubmissionId, userId, payload, createdAt } = {}) => {
  const owner = cleanText(userId);
  const validation = createFieldUpdateDprPayload(payload, owner);

  if (!validation.isValid) {
    throw createOutboxError("dpr-outbox-invalid-payload", validation.error);
  }

  return {
    clientSubmissionId: cleanText(clientSubmissionId) || createDprClientSubmissionId(owner),
    userId: owner,
    site: validation.value.site,
    localCreatedAt: toIsoString(createdAt),
    payload: validation.value,
    syncStatus: DPR_OUTBOX_STATUS.PENDING,
    retryCount: 0,
    retryable: true,
    failureCode: "",
    lastError: "",
  };
};

const parseRecords = (value) => {
  try {
    const records = JSON.parse(value || "[]");
    return Array.isArray(records) ? records : [];
  } catch (error) {
    return [];
  }
};

export const createLocalStorageDprOutboxStorage = ({
  storage = getBrowserStorage(),
  key = DPR_OUTBOX_STORAGE_KEY,
} = {}) => {
  const getAll = async () => {
    if (!storage) throw createOutboxError("dpr-outbox-storage", "Local device storage is unavailable.");
    return parseRecords(storage.getItem(key));
  };
  const saveAll = async (entries) => {
    if (!storage) throw createOutboxError("dpr-outbox-storage", "Local device storage is unavailable.");
    storage.setItem(key, JSON.stringify(entries));
  };

  return {
    getAll,
    put: async (entry) => {
      const entries = await getAll();
      const index = entries.findIndex((current) => current?.clientSubmissionId === entry.clientSubmissionId);
      const next = [...entries];
      if (index >= 0) next[index] = clone(entry);
      else next.push(clone(entry));
      await saveAll(next);
    },
    remove: async (clientSubmissionId) => {
      const entries = await getAll();
      await saveAll(entries.filter((entry) => entry?.clientSubmissionId !== clientSubmissionId));
    },
  };
};

const openIndexedDb = (indexedDbFactory) => new Promise((resolve, reject) => {
  if (!indexedDbFactory?.open) {
    reject(createOutboxError("dpr-outbox-storage", "IndexedDB is unavailable in this browser."));
    return;
  }

  const request = indexedDbFactory.open(DPR_OUTBOX_DATABASE, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(DPR_OUTBOX_STORE)) {
      database.createObjectStore(DPR_OUTBOX_STORE, { keyPath: "clientSubmissionId" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || createOutboxError("dpr-outbox-storage", "Could not open device storage."));
});

export const createIndexedDbDprOutboxStorage = ({ indexedDbFactory = getIndexedDb() } = {}) => {
  let databasePromise;
  const getDatabase = () => {
    if (!databasePromise) databasePromise = openIndexedDb(indexedDbFactory);
    return databasePromise;
  };

  const withStore = async (mode, operation) => {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
      let result;
      let settled = false;
      const settle = (callback, value) => {
        if (!settled) {
          settled = true;
          callback(value);
        }
      };

      try {
        const transaction = database.transaction(DPR_OUTBOX_STORE, mode);
        const request = operation(transaction.objectStore(DPR_OUTBOX_STORE));
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => settle(reject, request.error || createOutboxError("dpr-outbox-storage", "Could not save the local update."));
        transaction.oncomplete = () => settle(resolve, result);
        transaction.onerror = () => settle(reject, transaction.error || createOutboxError("dpr-outbox-storage", "Could not save the local update."));
        transaction.onabort = () => settle(reject, transaction.error || createOutboxError("dpr-outbox-storage", "Local update storage was interrupted."));
      } catch (error) {
        settle(reject, error);
      }
    });
  };

  return {
    getAll: () => withStore("readonly", (store) => store.getAll()),
    put: (entry) => withStore("readwrite", (store) => store.put(clone(entry))),
    remove: (clientSubmissionId) => withStore("readwrite", (store) => store.delete(clientSubmissionId)),
  };
};

export const createBrowserDprOutboxStorage = (options = {}) => {
  const indexedDbStorage = createIndexedDbDprOutboxStorage(options);
  const localStorage = createLocalStorageDprOutboxStorage(options);
  let useFallback = !options.indexedDbFactory && !getIndexedDb();

  const run = async (method, ...args) => {
    if (!useFallback) {
      try {
        return await indexedDbStorage[method](...args);
      } catch (error) {
        useFallback = true;
      }
    }
    return localStorage[method](...args);
  };

  return {
    getAll: () => run("getAll"),
    put: (entry) => run("put", entry),
    remove: (clientSubmissionId) => run("remove", clientSubmissionId),
  };
};

export const createMemoryDprOutboxStorage = (initialEntries = []) => {
  let entries = initialEntries.map(clone);
  return {
    getAll: async () => entries.map(clone),
    put: async (entry) => {
      const index = entries.findIndex((current) => current.clientSubmissionId === entry.clientSubmissionId);
      if (index >= 0) entries[index] = clone(entry);
      else entries.push(clone(entry));
    },
    remove: async (clientSubmissionId) => {
      entries = entries.filter((entry) => entry.clientSubmissionId !== clientSubmissionId);
    },
  };
};

export const isRetryableDprSyncError = (error) => {
  const code = getDprSyncFailureCode(error);
  const message = cleanText(error?.message).toLowerCase();
  return [
    "unavailable",
    "network",
    "deadline-exceeded",
    "timeout",
    "aborted",
    "cancelled",
    "resource-exhausted",
    "unauthenticated",
    "auth-not-ready",
    "auth/user-token-expired",
    "auth/network-request-failed",
  ].some((part) => code.includes(part) || message.includes(part));
};

export const getDprSyncFailureMessage = (error) => {
  const code = getDprSyncFailureCode(error);
  if (code.includes("dpr-outbox-auth-not-ready") || code.includes("unauthenticated") || code.includes("auth/")) {
    return "Authentication is not ready. This local update is still saved and will retry when connection and sign-in are ready.";
  }
  if (code.includes("permission-denied")) return "Permission denied while submitting this DPR. Confirm your active field access, then retry.";
  if (code.includes("dpr-outbox-owner")) return "This local update belongs to a different user and will not be synchronized by this account.";
  if (code.includes("dpr-outbox-id-collision")) return "A different report already uses this submission ID. The local update was retained for review.";
  if (code.includes("dpr-outbox-invalid")) return "Queued DPR contains invalid data and cannot be synchronized. It has been kept for review.";
  if (isRetryableDprSyncError(error)) return "Network connection was interrupted during synchronization. This site update is still saved locally and will retry.";
  return "The site update could not be synchronized. It has been kept on this device.";
};

const isSafeOutboxMessage = (message) => [
  "Authentication is not ready.",
  "Permission denied while submitting this DPR.",
  "This local update belongs to a different user",
  "A different report already uses this submission ID.",
  "Queued DPR contains invalid data",
  "Network connection was interrupted during synchronization.",
  "The site update could not be synchronized.",
  "A previous synchronization check will be retried",
].some((prefix) => cleanText(message).startsWith(prefix));

export const getDprOutboxEntryDiagnostics = (entry = {}) => {
  const payload = entry?.payload && typeof entry.payload === "object" ? entry.payload : {};
  const failureCode = cleanText(entry.failureCode).toLowerCase();
  const savedReason = cleanText(entry.lastError);
  const reason = failureCode
    ? getDprSyncFailureMessage({ code: failureCode })
    : isSafeOutboxMessage(savedReason)
      ? savedReason
      : "This local update needs review before it can synchronize.";

  return {
    activity: cleanText(payload.workActivity) || "Work activity not recorded",
    site: cleanText(entry.site || payload.site) || "Site not recorded",
    date: cleanText(payload.date) || "DPR date not recorded",
    reason,
    retryable: entry.retryable !== false,
    canManualRetry: !failureCode.includes("dpr-outbox-invalid"),
  };
};

export const getDprOutboxSummary = (entries = []) => (Array.isArray(entries) ? entries : []).reduce(
  (summary, entry) => {
    if (entry?.syncStatus === DPR_OUTBOX_STATUS.SYNCING) summary.syncing += 1;
    else if (entry?.syncStatus === DPR_OUTBOX_STATUS.FAILED) summary.failed += 1;
    else summary.pending += 1;
    summary.total += 1;
    return summary;
  },
  { pending: 0, syncing: 0, failed: 0, total: 0 }
);

export const createDprOutbox = ({ storage = createBrowserDprOutboxStorage() } = {}) => {
  const listAll = async () => (await storage.getAll())
    .map(normaliseEntry)
    .sort((first, second) => first.localCreatedAt.localeCompare(second.localCreatedAt));
  const list = async (userId) => {
    const owner = cleanText(userId);
    return owner ? (await listAll()).filter((entry) => entry.userId === owner) : [];
  };
  const put = async (entry) => {
    await storage.put(entry);
    notifyDprOutboxChange();
    return entry;
  };

  return {
    list,
    enqueue: async (options = {}) => {
      const entry = createOfflineDprEntry(options);
      const existing = (await listAll()).find((current) => current.clientSubmissionId === entry.clientSubmissionId);
      if (existing) {
        if (existing.userId !== entry.userId) {
          throw createOutboxError("dpr-outbox-owner-collision", "This submission ID belongs to another user.");
        }
        return { entry: existing, created: false };
      }
      await put(entry);
      return { entry, created: true };
    },
    recoverInterruptedSyncs: async (userId) => {
      const recovered = [];
      for (const entry of await list(userId)) {
        if (entry.syncStatus !== DPR_OUTBOX_STATUS.SYNCING) continue;
        const next = { ...entry, syncStatus: DPR_OUTBOX_STATUS.PENDING, retryable: true, lastError: "Previous synchronization was interrupted. Retrying when connected." };
        await put(next);
        recovered.push(next);
      }
      return recovered;
    },
    retry: async (userId, clientSubmissionId, { force = false } = {}) => {
      const entry = (await list(userId)).find((current) => current.clientSubmissionId === clientSubmissionId);
      if (!entry || (!force && entry.retryable === false)) return entry || null;
      return put({
        ...entry,
        syncStatus: DPR_OUTBOX_STATUS.PENDING,
        retryable: true,
        failureCode: "",
        lastError: "",
      });
    },
    discard: async (userId, clientSubmissionId) => {
      const entry = (await list(userId)).find((current) => current.clientSubmissionId === clientSubmissionId);
      if (!entry) return false;
      await storage.remove(entry.clientSubmissionId);
      notifyDprOutboxChange();
      return true;
    },
    sync: async ({ userId, syncEntry } = {}) => {
      const owner = cleanText(userId);
      const result = { synced: [], failed: [], skipped: [] };
      if (!owner || typeof syncEntry !== "function") return result;

      for (const entry of await list(owner)) {
        if (entry.userId !== owner || (entry.syncStatus === DPR_OUTBOX_STATUS.FAILED && entry.retryable === false)) {
          result.skipped.push(entry);
          continue;
        }
        const syncing = {
          ...entry,
          syncStatus: DPR_OUTBOX_STATUS.SYNCING,
          failureCode: "",
          lastError: "",
        };
        await put(syncing);
        try {
          const serverResult = await syncEntry(syncing);
          await storage.remove(syncing.clientSubmissionId);
          notifyDprOutboxChange();
          result.synced.push({ entry: syncing, serverResult });
        } catch (error) {
          const retryable = isRetryableDprSyncError(error);
          const failed = {
            ...syncing,
            // A temporary network/auth race remains pending rather than being
            // shown as a permanent attention item. Only non-retryable errors
            // require manual review.
            syncStatus: retryable ? DPR_OUTBOX_STATUS.PENDING : DPR_OUTBOX_STATUS.FAILED,
            retryCount: syncing.retryCount + 1,
            retryable,
            failureCode: getDprSyncFailureCode(error) || "dpr-outbox-sync-failed",
            lastError: getDprSyncFailureMessage(error),
          };
          await put(failed);
          result.failed.push({ entry: failed, error });
        }
      }
      return result;
    },
  };
};

export const dprOutbox = createDprOutbox();