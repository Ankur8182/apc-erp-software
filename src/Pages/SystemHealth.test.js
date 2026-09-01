import React from "react";
import { render, screen } from "@testing-library/react";
import SystemHealth from "./SystemHealth";
import { useAuth } from "../auth/AuthProvider";
import {
  formatMonitoringTimestamp,
  getMonitoringSafeMessage,
  getRecentMonitoringEvents,
  getSystemHealthSummary,
} from "../utils/monitoring";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../utils/monitoring", () => ({
  SYSTEM_HEALTH_EVENT_LIMIT: 100,
  MONITORING_CATEGORIES: ["NETWORK", "PERMISSION", "FIRESTORE_WRITE"],
  MONITORING_SEVERITIES: ["WARNING", "ERROR", "CRITICAL"],
  formatMonitoringTimestamp: jest.fn(),
  getMonitoringSafeMessage: jest.fn(),
  getRecentMonitoringEvents: jest.fn(),
  getSystemHealthSummary: jest.fn(),
}));

const healthySummary = () => ({
  status: "HEALTHY",
  last24HoursCount: 1,
  last7DaysCount: 1,
  criticalCount: 0,
  errorCount: 0,
  warningCount: 1,
  byCategory: { NETWORK: 1, PERMISSION: 0, FIRESTORE_WRITE: 0, FIRESTORE_READ: 0 },
});

beforeEach(() => {
  jest.clearAllMocks();
  formatMonitoringTimestamp.mockReturnValue("01 Sep 2026, 09:30");
  getMonitoringSafeMessage.mockReturnValue("A required connection could not be completed.");
  getSystemHealthSummary.mockReturnValue(healthySummary());
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
});

test("keeps System Health inaccessible to non-admin users without reading monitoring data", () => {
  useAuth.mockReturnValue({ role: "manager" });
  render(<SystemHealth />);

  expect(screen.getByRole("alert")).toHaveTextContent("restricted to active administrators");
  expect(getRecentMonitoringEvents).not.toHaveBeenCalled();
});

test("shows a bounded sanitized health view for an admin", async () => {
  useAuth.mockReturnValue({ role: "admin" });
  getRecentMonitoringEvents.mockResolvedValue([{
    id: "health-1",
    category: "NETWORK",
    severity: "WARNING",
    code: "unavailable",
    module: "expenses",
    operation: "write",
    timestamp: { toDate: () => new Date(2026, 8, 1, 9, 30) },
  }]);

  render(<SystemHealth />);

  expect(await screen.findByText("A required connection could not be completed.")).toBeInTheDocument();
  expect(screen.getByText("Observed production health")).toBeInTheDocument();
  expect(screen.getByText("Immutable events")).toBeInTheDocument();
  expect(getRecentMonitoringEvents).toHaveBeenCalledWith({ database: {} });
  expect(screen.queryByText("health-1")).not.toBeInTheDocument();
});

test("shows a safe load error without exposing raw Firestore details", async () => {
  useAuth.mockReturnValue({ role: "admin" });
  getRecentMonitoringEvents.mockRejectedValue({ code: "permission-denied", message: "raw rule details" });
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  render(<SystemHealth />);

  expect(await screen.findByRole("alert")).toHaveTextContent("do not have permission");
  expect(screen.queryByText("raw rule details")).not.toBeInTheDocument();
  consoleErrorSpy.mockRestore();
});