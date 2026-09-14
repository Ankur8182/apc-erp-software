import React from "react";
import { render, screen } from "@testing-library/react";
import SystemHealth from "./SystemHealth";
import { useAuth } from "../auth/AuthProvider";
import {
  formatMonitoringTimestamp,
  getMonitoringRetentionReview,
  getMonitoringSafeMessage,
  getRecentMonitoringEvents,
  getSystemHealthSummary,
} from "../utils/monitoring";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../utils/monitoring", () => ({
  MONITORING_RETENTION_DAYS: { CRITICAL: 180, ERROR: 90, WARNING: 30, INFO: 7 },
  SYSTEM_HEALTH_EVENT_LIMIT: 100,
  MONITORING_CATEGORIES: ["NETWORK", "PERMISSION", "FIRESTORE_WRITE"],
  MONITORING_SEVERITIES: ["WARNING", "ERROR", "CRITICAL"],
  formatMonitoringTimestamp: jest.fn(),
  getMonitoringRetentionReview: jest.fn(),
  getMonitoringSafeMessage: jest.fn(),
  getRecentMonitoringEvents: jest.fn(),
  getSystemHealthSummary: jest.fn(),
}));

const retentionReview = () => ({
  visibleEventCount: 1,
  datedEventCount: 1,
  undatedEventCount: 0,
  oldestVisibleTimestamp: new Date(2026, 8, 1, 9, 30),
  eligibleVisibleCount: 0,
  severityCounts: { INFO: 0, WARNING: 1, ERROR: 0, CRITICAL: 0 },
  eligibleBySeverity: { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
});
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
  getMonitoringRetentionReview.mockReturnValue(retentionReview());
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
  expect(screen.getByText("Retention review")).toBeInTheDocument();
  expect(screen.getByText("Read-only review")).toBeInTheDocument();
  expect(screen.getByText("Future review candidates")).toBeInTheDocument();
  expect(getMonitoringRetentionReview).toHaveBeenCalledWith(expect.any(Array));
  expect(screen.queryByRole("button", { name: /delete|archive|cleanup/i })).not.toBeInTheDocument();
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
  expect(screen.getByText("ATTENTION REQUIRED")).toBeInTheDocument();
  expect(screen.queryByText("HEALTHY")).not.toBeInTheDocument();
  expect(getSystemHealthSummary).toHaveBeenCalledWith([], expect.objectContaining({ monitoringDataAvailable: false }));
  consoleErrorSpy.mockRestore();
});
