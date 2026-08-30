import { createQueuedDprFirestorePayload, syncQueuedDprEntry } from "./offlineDprSync";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((database, collectionName, id) => ({ database, collectionName, id })),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  setDoc: jest.fn(),
}));

const entry = {
  clientSubmissionId: "dpr-supervisor-1-safe",
  userId: "supervisor-1",
  payload: {
    createdBy: "supervisor-1",
    site: "Civil Site",
    date: "2026-09-06",
    workActivity: "PCC work",
    workLocation: "Block A",
    quantity: 5,
    unit: "m³",
    manpowerCount: 6,
  },
};

beforeEach(() => {
  doc.mockImplementation((database, collectionName, id) => ({ database, collectionName, id }));
  serverTimestamp.mockReturnValue("SERVER_TIMESTAMP");
  setDoc.mockResolvedValue();
});

afterEach(() => jest.clearAllMocks());

test("builds a Firestore-safe queued DPR payload without retained photo blobs", () => {
  expect(createQueuedDprFirestorePayload({ ...entry, payload: { ...entry.payload, photos: ["blob"] } })).toMatchObject({
    clientSubmissionId: entry.clientSubmissionId,
    createdBy: "supervisor-1",
    photos: [],
    createdAt: "SERVER_TIMESTAMP",
    updatedAt: "SERVER_TIMESTAMP",
  });
});

test("writes a queued DPR once and creates its field audit entry after confirmed write", async () => {
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockResolvedValue();
  const auditLogger = jest.fn().mockResolvedValue({ success: true });

  await expect(syncQueuedDprEntry({ entry, userId: "supervisor-1", auditLogger })).resolves.toMatchObject({
    id: entry.clientSubmissionId,
    alreadySaved: false,
  });
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

test("recognizes an already-confirmed own submission without writing a duplicate", async () => {
  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ createdBy: "supervisor-1", clientSubmissionId: entry.clientSubmissionId }),
  });

  await expect(syncQueuedDprEntry({ entry, userId: "supervisor-1", auditLogger: jest.fn() })).resolves.toMatchObject({
    alreadySaved: true,
  });
  expect(setDoc).not.toHaveBeenCalled();
});

test("rejects owner spoofing and a conflicting document ID without changing Firestore", async () => {
  await expect(syncQueuedDprEntry({ entry, userId: "engineer-2" })).rejects.toMatchObject({
    code: "dpr-outbox-owner-mismatch",
  });

  getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ createdBy: "engineer-2", clientSubmissionId: entry.clientSubmissionId }),
  });
  await expect(syncQueuedDprEntry({ entry, userId: "supervisor-1" })).rejects.toMatchObject({
    code: "dpr-outbox-id-collision",
  });
  expect(setDoc).not.toHaveBeenCalled();
});