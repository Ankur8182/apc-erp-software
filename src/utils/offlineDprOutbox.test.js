import {
  DPR_OUTBOX_STATUS,
  createDprOutbox,
  createLocalStorageDprOutboxStorage,
  createMemoryDprOutboxStorage,
  getDprOutboxEntryDiagnostics,
  getDprOutboxSummary,
  getDprSyncFailureMessage,
  isRetryableDprSyncError,
} from "./offlineDprOutbox";

const createPayload = (site = "Civil Site") => ({
  date: "2026-09-06",
  site,
  workActivity: "PCC work",
  workLocation: "Block A",
  quantity: 5,
  unit: "m³",
  manpowerCount: 6,
  materialsUsed: "Cement",
  equipmentUsed: "Mixer",
  remarks: "",
});

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("creates a durable, UID-scoped DPR entry and does not duplicate its stable client ID", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  const options = {
    userId: "supervisor-1",
    clientSubmissionId: "dpr-supervisor-1-stable",
    payload: createPayload(),
    createdAt: "2026-09-06T08:15:00.000Z",
  };

  await expect(outbox.enqueue(options)).resolves.toMatchObject({ created: true });
  await expect(outbox.enqueue(options)).resolves.toMatchObject({ created: false });
  await expect(outbox.list("supervisor-1")).resolves.toEqual([
    expect.objectContaining({
      clientSubmissionId: "dpr-supervisor-1-stable",
      userId: "supervisor-1",
      site: "Civil Site",
      syncStatus: DPR_OUTBOX_STATUS.PENDING,
      payload: expect.objectContaining({ createdBy: "supervisor-1" }),
    }),
  ]);
});

test("persists queued DPR data across outbox instances without storing photo files", async () => {
  const storage = createStorage();
  const firstOutbox = createDprOutbox({ storage: createLocalStorageDprOutboxStorage({ storage }) });

  await firstOutbox.enqueue({
    userId: "engineer-1",
    clientSubmissionId: "dpr-engineer-1-persisted",
    payload: { ...createPayload("Bridge Site"), photos: ["not kept"] },
  });

  const restartedOutbox = createDprOutbox({ storage: createLocalStorageDprOutboxStorage({ storage }) });
  const [entry] = await restartedOutbox.list("engineer-1");
  expect(entry).toMatchObject({ site: "Bridge Site", userId: "engineer-1" });
  expect(entry.payload).not.toHaveProperty("photos");
});

test("removes an entry only after a confirmed successful synchronization", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-success", payload: createPayload() });
  const syncEntry = jest.fn().mockResolvedValue({ id: "dpr-success" });

  await expect(outbox.sync({ userId: "supervisor-1", syncEntry })).resolves.toMatchObject({
    synced: [expect.objectContaining({ entry: expect.objectContaining({ clientSubmissionId: "dpr-success" }) })],
    failed: [],
  });
  expect(syncEntry).toHaveBeenCalledTimes(1);
  await expect(outbox.list("supervisor-1")).resolves.toEqual([]);
});

test("keeps a temporary network failure pending and retries it without losing retry metadata", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-retry", payload: createPayload() });
  const unavailable = Object.assign(new Error("offline"), { code: "unavailable" });

  const firstResult = await outbox.sync({
    userId: "supervisor-1",
    syncEntry: jest.fn().mockRejectedValue(unavailable),
  });
  expect(firstResult.failed).toHaveLength(1);
  const [pendingEntry] = await outbox.list("supervisor-1");
  expect(pendingEntry).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.PENDING,
    retryCount: 1,
    retryable: true,
    failureCode: "unavailable",
  });
  expect(pendingEntry.lastError).toMatch(/Network connection was interrupted/i);

  await outbox.retry("supervisor-1", "dpr-retry");
  await outbox.sync({ userId: "supervisor-1", syncEntry: jest.fn().mockResolvedValue({ id: "dpr-retry" }) });
  await expect(outbox.list("supervisor-1")).resolves.toEqual([]);
});

test("keeps an authentication-not-ready race pending rather than moving it to attention", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "engineer-1", clientSubmissionId: "dpr-auth-wait", payload: createPayload("Bridge Site") });
  const authNotReady = Object.assign(new Error("auth initialization pending"), { code: "dpr-outbox-auth-not-ready" });

  await outbox.sync({
    userId: "engineer-1",
    syncEntry: jest.fn().mockRejectedValue(authNotReady),
  });

  const [entry] = await outbox.list("engineer-1");
  expect(entry).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.PENDING,
    retryable: true,
    failureCode: "dpr-outbox-auth-not-ready",
  });
  expect(entry.lastError).toMatch(/Authentication is not ready/i);
  expect(isRetryableDprSyncError(authNotReady)).toBe(true);
});

test("keeps actual permission and malformed entries for review with safe diagnostic reasons", async () => {
  const storage = createMemoryDprOutboxStorage([{ userId: "supervisor-1", clientSubmissionId: "broken", payload: {} }]);
  const outbox = createDprOutbox({ storage });
  const permissionDenied = Object.assign(new Error("denied"), { code: "permission-denied" });

  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-denied", payload: createPayload() });
  await outbox.sync({ userId: "supervisor-1", syncEntry: jest.fn().mockRejectedValue(permissionDenied) });
  const entries = await outbox.list("supervisor-1");
  const denied = entries.find((entry) => entry.clientSubmissionId === "dpr-denied");
  const broken = entries.find((entry) => entry.clientSubmissionId === "broken");

  expect(denied).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.FAILED,
    retryable: false,
    failureCode: "permission-denied",
  });
  expect(getDprOutboxEntryDiagnostics(denied)).toMatchObject({
    activity: "PCC work",
    site: "Civil Site",
    date: "2026-09-06",
    reason: expect.stringMatching(/Permission denied while submitting this DPR/i),
  });
  expect(broken).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.FAILED,
    retryable: false,
    failureCode: "dpr-outbox-invalid-payload",
  });
  expect(getDprOutboxEntryDiagnostics(broken).reason).toMatch(/Queued DPR contains invalid data/i);
expect(getDprSyncFailureMessage(permissionDenied)).toMatch(/Permission denied while submitting this DPR/i);
  expect(getDprOutboxEntryDiagnostics({
    payload: { workActivity: "Legacy update", site: "Civil Site", date: "2026-09-06" },
    lastError: "Firebase token secret should never be shown",
  }).reason).toBe("This local update needs review before it can synchronize.");
});

test("safely upgrades the old preflight-read attention record to a retryable pending entry", async () => {
  const storage = createMemoryDprOutboxStorage([{
    userId: "engineer-1",
    clientSubmissionId: "dpr-old-preflight",
    payload: { ...createPayload("Bridge Site"), createdBy: "engineer-1" },
    syncStatus: DPR_OUTBOX_STATUS.FAILED,
    retryable: false,
    lastError: "Synchronization needs a valid active field account. This local update has been kept on this device.",
  }]);
  const outbox = createDprOutbox({ storage });

  const [entry] = await outbox.list("engineer-1");
  expect(entry).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.PENDING,
    retryable: true,
    failureCode: "dpr-outbox-legacy-preflight-read",
  });
  expect(entry.lastError).toMatch(/previous synchronization check will be retried/i);
});

test("allows deliberate local discard only for the active owner", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-discard", payload: createPayload() });

  await expect(outbox.discard("engineer-2", "dpr-discard")).resolves.toBe(false);
  await expect(outbox.list("supervisor-1")).resolves.toHaveLength(1);
  await expect(outbox.discard("supervisor-1", "dpr-discard")).resolves.toBe(true);
  await expect(outbox.list("supervisor-1")).resolves.toEqual([]);
});

test("never exposes or synchronizes another user’s local DPR entries", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-owner-one", payload: createPayload() });
  await outbox.enqueue({ userId: "engineer-2", clientSubmissionId: "dpr-owner-two", payload: createPayload("Bridge Site") });
  const syncEntry = jest.fn().mockResolvedValue({ id: "server-id" });

  await outbox.sync({ userId: "engineer-2", syncEntry });
  expect(syncEntry).toHaveBeenCalledWith(expect.objectContaining({ userId: "engineer-2" }));
  await expect(outbox.list("supervisor-1")).resolves.toHaveLength(1);
  await expect(outbox.list("engineer-2")).resolves.toEqual([]);
});

test("recovers an interrupted synchronization and reports compact queue totals", async () => {
  const storage = createMemoryDprOutboxStorage();
  const outbox = createDprOutbox({ storage });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-interrupted", payload: createPayload() });
  const [entry] = await outbox.list("supervisor-1");
  await storage.put({ ...entry, syncStatus: DPR_OUTBOX_STATUS.SYNCING });

  await expect(outbox.recoverInterruptedSyncs("supervisor-1")).resolves.toHaveLength(1);
  const entries = await outbox.list("supervisor-1");
  expect(entries[0].syncStatus).toBe(DPR_OUTBOX_STATUS.PENDING);
  expect(getDprOutboxSummary(entries)).toEqual({ pending: 1, syncing: 0, failed: 0, total: 1 });
});