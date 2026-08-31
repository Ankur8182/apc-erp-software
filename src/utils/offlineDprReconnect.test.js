import {
  createDprOutbox,
  createMemoryDprOutboxStorage,
} from "./offlineDprOutbox";
import { syncQueuedDprEntry } from "./offlineDprSync";
import { doc, getDoc, setDoc } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {}, auth: { currentUser: null } }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((database, collectionName, id) => ({ database, collectionName, id })),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  setDoc: jest.fn(),
}));

const createPayload = (userId, site) => ({
  date: "2026-09-06",
  site,
  workActivity: "Jointing",
  workLocation: "Block A",
  quantity: 0,
  unit: "Nos",
  manpowerCount: 4,
  materialsUsed: "",
  equipmentUsed: "",
  remarks: "",
  createdBy: userId,
});

const createAuth = (userId) => ({
  currentUser: {
    uid: userId,
    getIdToken: jest.fn().mockResolvedValue("ready-token"),
  },
});

beforeEach(() => {
  doc.mockImplementation((database, collectionName, id) => ({ database, collectionName, id }));
  getDoc.mockReset();
  setDoc.mockReset();
});

afterEach(() => jest.clearAllMocks());

test.each([
  ["Engineer", "engineer-1", "Bridge Site"],
  ["Supervisor", "supervisor-1", "Civil Site"],
])("%s offline DPR survives restart, synchronizes after reconnect, and is removed only after Firestore confirms it", async (role, userId, site) => {
  const storedDocuments = new Map();
  const storage = createMemoryDprOutboxStorage();
  const offlineOutbox = createDprOutbox({ storage });
  const clientSubmissionId = `dpr-${userId}-reconnect`;

  await offlineOutbox.enqueue({
    userId,
    clientSubmissionId,
    payload: createPayload(userId, site),
  });

  // Simulate closing/reopening the PWA before connectivity returns.
  const reconnectedOutbox = createDprOutbox({ storage });
  setDoc.mockImplementation(async (reference, data) => {
    storedDocuments.set(reference.id, data);
  });
  getDoc.mockImplementation(async (reference) => ({
    exists: () => storedDocuments.has(reference.id),
    data: () => storedDocuments.get(reference.id),
  }));

  const result = await reconnectedOutbox.sync({
    userId,
    syncEntry: (entry) => syncQueuedDprEntry({
      entry,
      userId,
      authInstance: createAuth(userId),
      auditLogger: jest.fn().mockResolvedValue({ success: true }),
    }),
  });

  if (result.failed.length) throw result.failed[0].error;
  expect(result.synced).toHaveLength(1);
  expect(result.failed).toHaveLength(0);
  expect(storedDocuments.get(clientSubmissionId)).toMatchObject({
    createdBy: userId,
    clientSubmissionId,
    site,
    workActivity: "Jointing",
    photos: [],
  });
  await expect(reconnectedOutbox.list(userId)).resolves.toEqual([]);
  expect(getDoc).not.toHaveBeenCalled();
});

test("an acknowledgement-lost duplicate retry resolves the existing own DPR once without a second document", async () => {
  const storedDocuments = new Map();
  const userId = "engineer-1";
  const clientSubmissionId = "dpr-engineer-1-idempotent";
  const storage = createMemoryDprOutboxStorage();
  const outbox = createDprOutbox({ storage });
  await outbox.enqueue({ userId, clientSubmissionId, payload: createPayload(userId, "Bridge Site") });

  setDoc.mockImplementation(async (reference, data) => {
    storedDocuments.set(reference.id, data);
    throw Object.assign(new Error("write acknowledgement was lost"), { code: "permission-denied" });
  });
  getDoc.mockImplementation(async (reference) => ({
    exists: () => storedDocuments.has(reference.id),
    data: () => storedDocuments.get(reference.id),
  }));

  const result = await outbox.sync({
    userId,
    syncEntry: (entry) => syncQueuedDprEntry({
      entry,
      userId,
      authInstance: createAuth(userId),
      auditLogger: jest.fn(),
    }),
  });

  if (result.failed.length) throw result.failed[0].error;
  expect(result.synced).toHaveLength(1);
  expect(result.synced[0].serverResult).toMatchObject({ alreadySaved: true });
  expect(storedDocuments.size).toBe(1);
  await expect(outbox.list(userId)).resolves.toEqual([]);
});