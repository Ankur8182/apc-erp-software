import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import AuditLog from "./AuditLog";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ name: "auditLogs" })),
  onSnapshot: jest.fn(),
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
  onSnapshot.mockImplementation((reference, onNext) => {
    void reference;
    onNext({ docs: entries });
    return jest.fn();
  });

  return render(<AuditLog />);
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows a clear empty state when there are no audit records", () => {
  renderAuditLog([]);

  expect(screen.getByText("No audit records match the selected filters.")).toBeInTheDocument();
  expect(screen.getByText("0 records")).toBeInTheDocument();
});

test("filters audit records and paginates the filtered history", () => {
  const logs = Array.from({ length: 11 }, (_, index) => makeLog(String(index + 1), {
    action: index === 10 ? "delete" : "create",
    module: index === 10 ? "dailyProgressReports" : "expenses",
    recordLabel: index === 10 ? "Concrete DPR" : `Expense ${index + 1}`,
  }));
  renderAuditLog(logs);

  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Search user, record, site or summary..."), {
    target: { value: "concrete" },
  });

  expect(screen.getByText("Concrete DPR")).toBeInTheDocument();
  expect(screen.getByText("1 record")).toBeInTheDocument();
});
