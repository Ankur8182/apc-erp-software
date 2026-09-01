import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { getDocs, limit, orderBy, startAfter } from "firebase/firestore";
import AuditLog from "./AuditLog";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ name: "auditLogs" })),
  getDocs: jest.fn(),
  limit: jest.fn((pageSize) => ({ type: "limit", pageSize })),
  orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
  query: jest.fn((reference, ...constraints) => ({ reference, constraints })),
  startAfter: jest.fn((cursor) => ({ type: "startAfter", cursor })),
  addDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

const makeLog = (id, overrides = {}) => ({
  id,
  data: () => ({
    userEmail: "admin@example.com",
    userRole: "admin",
    action: "create",
    module: "expenses",
    recordId: `record-${id}`,
    recordLabel: `Expense ${id}`,
    details: "Expense record created.",
    site: "North Site",
    timestamp: { toDate: () => new Date(2026, 7, 29, 9, 30) },
    ...overrides,
  }),
});

const renderAuditLog = (entries) => {
  getDocs.mockResolvedValue({ docs: entries });

  return render(<AuditLog />);
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows a clear empty state when there are no audit records", async () => {
  renderAuditLog([]);

  expect(await screen.findByText("No audit records match the selected filters.")).toBeInTheDocument();
  expect(screen.getByText("0 records")).toBeInTheDocument();
  expect(screen.getByText("0 newest audit records loaded.")).toBeInTheDocument();
  expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
  expect(limit).toHaveBeenCalledWith(100);
  expect(getDocs).toHaveBeenCalledTimes(1);
});

test("filters audit records and paginates the loaded history", async () => {
  const logs = Array.from({ length: 11 }, (_, index) => makeLog(String(index + 1), {
    action: index === 10 ? "delete" : "create",
    module: index === 10 ? "dailyProgressReports" : "expenses",
    recordLabel: index === 10 ? "Concrete DPR" : `Expense ${index + 1}`,
  }));
  renderAuditLog(logs);

  expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Search user, record, site or summary..."), {
    target: { value: "concrete" },
  });

  expect(screen.getByText("Concrete DPR")).toBeInTheDocument();
  expect(screen.getByText("1 record")).toBeInTheDocument();
});

test("loads older bounded audit history from the last document without duplicate rows", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => makeLog(String(index + 1)));
  const duplicate = firstPage[99];
  const nextPage = [duplicate, makeLog("101")];

  getDocs
    .mockResolvedValueOnce({ docs: firstPage })
    .mockResolvedValueOnce({ docs: nextPage });
  render(<AuditLog />);

  expect(await screen.findByRole("button", { name: "Load more history" })).toBeInTheDocument();
  expect(screen.getByText(/100 newest audit records loaded/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Load more history" }));

  expect(await screen.findByText(/101 newest audit records loaded/)).toBeInTheDocument();
  expect(startAfter).toHaveBeenCalledWith(firstPage[99]);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "Load more history" })).not.toBeInTheDocument();
});

test("shows a safe error and permits retrying the initial audit history read", async () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  getDocs
    .mockRejectedValueOnce({ code: "permission-denied" })
    .mockResolvedValueOnce({ docs: [] });
  render(<AuditLog />);

  expect(await screen.findByRole("alert")).toHaveTextContent("do not have permission");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("No audit records match the selected filters.")).toBeInTheDocument();
  expect(getDocs).toHaveBeenCalledTimes(2);
  consoleErrorSpy.mockRestore();
});
