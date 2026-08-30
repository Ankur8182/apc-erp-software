import {
  DPR_OUTBOX_STATUS,
  createDprOutbox,
  createLocalStorageDprOutboxStorage,
  createMemoryDprOutboxStorage,
  getDprOutboxSummary,
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

test("retains temporary sync failures, supports retry, and keeps retry metadata", async () => {
  const outbox = createDprOutbox({ storage: createMemoryDprOutboxStorage() });
  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-retry", payload: createPayload() });
  const unavailable = Object.assign(new Error("offline"), { code: "unavailable" });

  const firstResult = await outbox.sync({
    userId: "supervisor-1",
    syncEntry: jest.fn().mockRejectedValue(unavailable),
  });
  expect(firstResult.failed).toHaveLength(1);
  const [failedEntry] = await outbox.list("supervisor-1");
  expect(failedEntry).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.FAILED,
    retryCount: 1,
    retryable: true,
  });

  await outbox.retry("supervisor-1", "dpr-retry");
  await outbox.sync({ userId: "supervisor-1", syncEntry: jest.fn().mockResolvedValue({ id: "dpr-retry" }) });
  await expect(outbox.list("supervisor-1")).resolves.toEqual([]);
});

test("keeps permission and malformed failures for review without endless automatic retries", async () => {
  const storage = createMemoryDprOutboxStorage([{ userId: "supervisor-1", clientSubmissionId: "broken", payload: {} }]);
  const outbox = createDprOutbox({ storage });
  const permissionDenied = Object.assign(new Error("denied"), { code: "permission-denied" });

  await outbox.enqueue({ userId: "supervisor-1", clientSubmissionId: "dpr-denied", payload: createPayload() });
  await outbox.sync({ userId: "supervisor-1", syncEntry: jest.fn().mockRejectedValue(permissionDenied) });
  const entries = await outbox.list("supervisor-1");
  expect(entries.find((entry) => entry.clientSubmissionId === "dpr-denied")).toMatchObject({ retryable: false });
  expect(entries.find((entry) => entry.clientSubmissionId === "broken")).toMatchObject({
    syncStatus: DPR_OUTBOX_STATUS.FAILED,
    retryable: false,
  });
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