import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  createAuditPayload,
  filterAuditLogs,
  getAuditDateKey,
  logAuditEvent,
  normaliseAuditAction,
  normaliseAuditModule,
} from "./auditLogging";
import { getPageSlice } from "./dataTable";

jest.mock("../firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => "audit-log-collection"),
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => "server-timestamp"),
}));

const actor = {
  userId: "admin-1",
  userEmail: "admin@example.com",
  userRole: "admin",
};

beforeEach(() => {
  collection.mockReturnValue("audit-log-collection");
  serverTimestamp.mockReturnValue("server-timestamp");
  addDoc.mockReset();
});

test("creates a normalised, safe audit payload", () => {
  expect(createAuditPayload({
    actor,
    action: "UPDATE",
    module: "Vehicle Expenses",
    recordId: "expense-1",
    recordLabel: "  Diesel purchase  ",
    details: "  Fuel amount updated  ",
    site: "  North Site  ",
    timestamp: "server-time",
  })).toEqual({
    userId: "admin-1",
    userEmail: "admin@example.com",
    userRole: "admin",
    action: "update",
    module: "vehicleExpenses",
    recordId: "expense-1",
    recordLabel: "Diesel purchase",
    timestamp: "server-time",
    details: "Fuel amount updated",
    site: "North Site",
  });
});

test("rejects unsupported actions and modules", () => {
  expect(() => normaliseAuditAction("login")).toThrow("Unsupported audit action");
  expect(() => normaliseAuditModule("secrets")).toThrow("Unsupported audit module");
  expect(normaliseAuditModule("user")).toBe("users");
  expect(normaliseAuditModule("Goods Receipts")).toBe("goodsReceipts");
  expect(normaliseAuditModule("salary-payments")).toBe("salaryPayments");
  expect(normaliseAuditModule("labour advances")).toBe("labourAdvances");
  expect(normaliseAuditModule("vehicle maintenance")).toBe("vehicleMaintenance");
  expect(normaliseAuditModule("vehicle assignment")).toBe("vehicleAssignments");
  expect(normaliseAuditModule("BOQ Measurements")).toBe("boqMeasurements");
  expect(normaliseAuditModule("boq-variations")).toBe("boqVariations");
});

test("records a successful activity after the caller provides the authenticated actor", async () => {
  addDoc.mockResolvedValue({ id: "audit-1" });

  await expect(logAuditEvent({
    actor,
    action: "create",
    module: "expenses",
    recordId: "expense-1",
    details: "Expense record created.",
    site: "North Site",
  })).resolves.toMatchObject({ success: true, id: "audit-1" });

  expect(addDoc).toHaveBeenCalledWith("audit-log-collection", expect.objectContaining({
    userId: "admin-1",
    action: "create",
    module: "expenses",
  }));
});

test("filters audit records by search, action, module, and local date", () => {
  const logs = [
    {
      userEmail: "admin@example.com",
      userRole: "admin",
      action: "create",
      module: "dailyProgressReports",
      recordId: "dpr-1",
      recordLabel: "Concrete work",
      details: "DPR created",
      site: "North Site",
      timestamp: new Date(2026, 7, 29, 9, 30),
    },
    {
      userEmail: "manager@example.com",
      userRole: "manager",
      action: "delete",
      module: "expenses",
      recordId: "expense-1",
      recordLabel: "Travel",
      details: "Expense deleted",
      site: "South Site",
      timestamp: new Date(2026, 7, 28, 9, 30),
    },
  ];

  expect(filterAuditLogs(logs, {
    search: "concrete",
    action: "create",
    module: "dailyProgressReports",
    date: "2026-08-29",
  })).toEqual([logs[0]]);
  expect(filterAuditLogs(logs, { search: "missing" })).toEqual([]);
  expect(getAuditDateKey(logs[0].timestamp)).toBe("2026-08-29");
  expect(getPageSlice(filterAuditLogs(logs), 2, 1)).toMatchObject({
    currentPage: 2,
    totalPages: 2,
    rows: [logs[1]],
  });
});
