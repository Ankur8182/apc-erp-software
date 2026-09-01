import { getDocs, limit, orderBy, startAfter } from "firebase/firestore";
import {
  AUDIT_LOG_PAGE_SIZE,
  getAuditLogPage,
  mapAuditLogSnapshot,
  mergeAuditLogPages,
} from "./auditLogPaging";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ name: "auditLogs" })),
  getDocs: jest.fn(),
  limit: jest.fn((pageSize) => ({ type: "limit", pageSize })),
  orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
  query: jest.fn((reference, ...constraints) => ({ reference, constraints })),
  startAfter: jest.fn((cursor) => ({ type: "startAfter", cursor })),
}));

const makeDocument = (id, data = {}) => ({
  id,
  data: () => data,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test("maps a bounded snapshot safely and reports whether another page may exist", () => {
  const first = makeDocument("first", { action: "create" });
  const snapshot = {
    docs: [first, makeDocument("second", { action: "update" })],
  };

  expect(mapAuditLogSnapshot(snapshot, 2)).toEqual({
    logs: [
      { id: "first", action: "create" },
      { id: "second", action: "update" },
    ],
    cursor: snapshot.docs[1],
    hasMore: true,
  });
  expect(mapAuditLogSnapshot({}, 2)).toEqual({ logs: [], cursor: null, hasMore: false });
});

test("merges pages by document id to avoid duplicate rendered audit records", () => {
  expect(mergeAuditLogPages(
    [{ id: "first", details: "old" }, { id: "second" }],
    [{ id: "second", details: "updated" }, { id: "third" }]
  )).toEqual([
    { id: "first", details: "old" },
    { id: "second", details: "updated" },
    { id: "third" },
  ]);
});

test("uses a timestamp-descending bounded query and cursor for older audit pages", async () => {
  const cursor = makeDocument("cursor");
  getDocs.mockResolvedValue({ docs: [makeDocument("older")] });

  await getAuditLogPage({ database: {}, cursor });

  expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
  expect(startAfter).toHaveBeenCalledWith(cursor);
  expect(limit).toHaveBeenCalledWith(AUDIT_LOG_PAGE_SIZE);
  expect(getDocs).toHaveBeenCalledTimes(1);
});
