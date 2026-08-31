import {
  createQueuedDprFirestorePayload,
  ensureQueuedDprAuthReady,
  syncQueuedDprEntry,
} from "./offlineDprSync";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {}, auth: { currentUser: null } }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((database, collectionName, id) => ({ database, collectionName, id })),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  setDoc: jest.fn(),
}));

const createEntry = (userId = "supervisor-1") => ({
  clientSubmissionId: `dpr-${userId}-safe`,
  userId,
  payload: {
    createdBy: userId,
    site: "Civil Site",
    date: "2026-09-06",
    workActivity: "PCC work",
    workLocation: "Block A",
    quantity: 5,
    unit: "m³",
    manpowerCount: 6,
  },
});

const createAuth = (userId, getIdToken = jest.fn().mockResolvedValue("field-token")) => ({
  currentUser: { uid: userId, getIdToken },
});

beforeEach(() => {
  doc.mockImplementation((database, collectionName, id) => ({ database, collectionName, id }));
  serverTimestamp.mockReturnValue("SERVER_TIMESTAMP");
  setDoc.mockResolvedValue();
  getDoc.mockReset();
});

afterEach(() => jest.clearAllMocks());

test("builds a Firestore-safe queued DPR payload without retained photo blobs", () => {
  const entry = createEntry();

  expect(createQueuedDprFirestorePayload({ ...entry, payload: { ...entry.payload, photos: ["blob"] } })).toMatchObject({
    clientSubmissionId: entry.clientSubmissionId,
    createdBy: "supervisor-1",
    photos: [],
    createdAt: "SERVER_TIMESTAMP",
    updatedAt: "SERVER_TIMESTAMP",
  });
});

test("waits for the active field account and directly creates a new queued DPR without a preflight read", async () => {
  const entry = createEntry();
  const events = [];
  const getIdToken = jest.fn().mockImplementation(async () => {
    events.push("auth-ready");
    return "field-token";
  });
  setDoc.mockImplementation(async () => {
    events.push("firestore-write");
  });
  const auditLogger = jest.fn().mockResolvedValue({ success: true });

  await expect(syncQueuedDprEntry({
    entry,
    userId: "supervisor-1",
    authInstance: createAuth("supervisor-1", getIdToken),
    auditLogger,
  })).resolves.toMatchObject({
    id: entry.clientSubmissionId,
    alreadySaved: false,
    auditWarning: "",
  });

  expect(events).toEqual(["auth-ready", "firestore-write"]);
  expect(getDoc).not.toHaveBeenCalled();
  expect(doc).toHaveBeenCalledWith({}, "dailyProgressReports", entry.clientSubmissionId);
  expect(setDoc).toHaveBeenCalledWith(expect.objectContaining({ id: entry.clientSubmissionId }), expect.objectContaining({
    clientSubmissionId: entry.clientSubmissionId,
    createdBy: "supervisor-1",
    photos: [],
  }));
  expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
    module: "dailyProgressReports",
    action: "create",
    recordId: entry.clientSubmissionId,
  }));
});

test.each([
  ["engineer", "engineer-1"],
  ["supervisor", "supervisor-1"],
])("%s queued DPR sync uses the matching authenticated UID", async (role, userId) => {
  const entry = createEntry(userId);

  await expect(syncQueuedDprEntry({
    entry,
    userId,
    authInstance: createAuth(userId),
    auditLogger: jest.fn().mockResolvedValue({ success: true }),
  })).resolves.toMatchObject({ id: entry.clientSubmissionId, alreadySaved: false });

  expect(setDoc).toHaveBeenCalledWith(
    expect.objectContaining({ id: entry.clientSubmissionId }),
    expect.objectContaining({ createdBy: userId, clientSubmissionId: entry.clientSubmissionId })
  );
});

test("recovers a confirmed own DPR after a lost write acknowledgement without creating a duplicate", async () => {
  const entry = createEntry();
  setDoc.mockRejectedValue({ code: "permission-denied" });
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ createdBy: "supervisor-1", clientSubmissionId: entry.clientSubmissionId }),
  });

  await expect(syncQueuedDprEntry({
    entry,
    userId: "supervisor-1",
    authInstance: createAuth("supervisor-1"),
    auditLogger: jest.fn(),
  })).resolves.toMatchObject({
    id: entry.clientSubmissionId,
    alreadySaved: true,
  });

  expect(setDoc).toHaveBeenCalledTimes(1);
  expect(getDoc).toHaveBeenCalledTimes(1);
});

test("keeps an audit failure from changing an already-confirmed DPR sync into a failed outbox item", async () => {
  const entry = createEntry();

  await expect(syncQueuedDprEntry({
    entry,
    userId: "supervisor-1",
    authInstance: createAuth("supervisor-1"),
    auditLogger: jest.fn().mockRejectedValue(new Error("audit unavailable")),
  })).resolves.toMatchObject({
    alreadySaved: false,
    auditWarning: expect.stringMatching(/audit entry could not be recorded/i),
  });
  expect(setDoc).toHaveBeenCalledTimes(1);
});

test("does not write when field authentication is not ready", async () => {
  const entry = createEntry();

  await expect(ensureQueuedDprAuthReady({
    userId: "supervisor-1",
    authInstance: { currentUser: null },
  })).rejects.toMatchObject({ code: "dpr-outbox-auth-not-ready" });

  await expect(syncQueuedDprEntry({
    entry,
    userId: "supervisor-1",
    authInstance: { currentUser: null },
  })).rejects.toMatchObject({ code: "dpr-outbox-auth-not-ready" });
  expect(setDoc).not.toHaveBeenCalled();
});

test("rejects owner spoofing and a conflicting readable document ID without changing Firestore", async () => {
  const entry = createEntry();
  await expect(syncQueuedDprEntry({ entry, userId: "engineer-2" })).rejects.toMatchObject({
    code: "dpr-outbox-owner-mismatch",
  });

  setDoc.mockRejectedValue({ code: "permission-denied" });
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ createdBy: "engineer-2", clientSubmissionId: entry.clientSubmissionId }),
  });
  await expect(syncQueuedDprEntry({
    entry,
    userId: "supervisor-1",
    authInstance: createAuth("supervisor-1"),
  })).rejects.toMatchObject({
    code: "dpr-outbox-id-collision",
  });
  expect(setDoc).toHaveBeenCalledTimes(1);
});