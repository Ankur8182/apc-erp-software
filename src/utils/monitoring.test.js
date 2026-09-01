import {
  captureMonitoringError,
  createMonitoringEventPayload,
  createMonitoringThrottle,
  getRecentMonitoringEvents,
  getSystemHealthSummary,
  normaliseMonitoringError,
  resetMonitoringStateForTests,
  setMonitoringActor,
  SYSTEM_HEALTH_EVENT_LIMIT,
} from "./monitoring";
import { addDoc, getDocs, limit, orderBy, startAfter } from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn((database, name) => ({ database, name })),
  getDocs: jest.fn(),
  limit: jest.fn((value) => ({ type: "limit", value })),
  orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
  query: jest.fn((reference, ...constraints) => ({ reference, constraints })),
  serverTimestamp: jest.fn(() => ({ type: "server-timestamp" })),
  startAfter: jest.fn(),
}));

jest.mock("../firebase", () => ({ db: { name: "erp" } }));

beforeEach(() => {
  jest.clearAllMocks();
  resetMonitoringStateForTests();
});

test("normalizes permission, network, auth, and Firestore write errors without retaining raw details", () => {
  const permission = normaliseMonitoringError(
    { code: "permission-denied", message: "token=secret password=not-safe" },
    { module: "expenses", operation: "write", now: 1000 }
  );
  const network = normaliseMonitoringError(
    { code: "unavailable" },
    { module: "inventory", operation: "read", now: 1000 }
  );
  const auth = normaliseMonitoringError(
    { code: "auth/user-token-expired" },
    { module: "auth", operation: "authentication", now: 1000 }
  );
  const write = normaliseMonitoringError(
    { code: "failed-precondition" },
    { module: "purchaseOrders", operation: "write", now: 1000 }
  );

  expect(permission).toMatchObject({ category: "PERMISSION", severity: "ERROR", code: "permission-denied" });
  expect(network).toMatchObject({ category: "NETWORK", severity: "WARNING", code: "unavailable" });
  expect(auth).toMatchObject({ category: "AUTHENTICATION", code: "auth-user-token-expired" });
  expect(write).toMatchObject({ category: "FIRESTORE_WRITE", code: "failed-precondition" });
  expect(JSON.stringify(permission)).not.toContain("secret");
  expect(JSON.stringify(permission)).not.toContain("password");
  expect(permission).not.toHaveProperty("message");
});

test("creates a strict monitoring payload with no raw error data or personal fields", () => {
  const payload = createMonitoringEventPayload({
    actor: { userId: "user-1", userRole: "manager" },
    error: { code: "permission-denied", message: "aadhar=1234" },
    context: { module: "inventory", operation: "write", now: 1000 },
  });

  expect(payload).toMatchObject({
    userId: "user-1",
    userRole: "manager",
    category: "PERMISSION",
    severity: "ERROR",
    code: "permission-denied",
    module: "inventory",
    operation: "write",
  });
  expect(Object.keys(payload).sort()).toEqual([
    "category",
    "code",
    "module",
    "operation",
    "severity",
    "timestamp",
    "userId",
    "userRole",
  ]);
  expect(JSON.stringify(payload)).not.toContain("aadhar");
});

test("throttles duplicate failures and caps monitoring events per session", () => {
  const throttle = createMonitoringThrottle({ windowMs: 1000, sessionLimit: 2 });

  expect(throttle.shouldCapture("same", 1000)).toBe(true);
  expect(throttle.shouldCapture("same", 1500)).toBe(false);
  expect(throttle.shouldCapture("other", 2000)).toBe(true);
  expect(throttle.shouldCapture("third", 3000)).toBe(false);
});

test("captures an authenticated failure once and safely absorbs monitoring-write failure", async () => {
  setMonitoringActor({ userId: "manager-1", userRole: "manager" });
  addDoc.mockResolvedValueOnce({ id: "health-1" });

  const first = await captureMonitoringError(
    { code: "unavailable" },
    { module: "expenses", operation: "write", now: 1000 }
  );
  const duplicate = await captureMonitoringError(
    { code: "unavailable" },
    { module: "expenses", operation: "write", now: 1001 }
  );

  expect(first).toMatchObject({ captured: true, id: "health-1" });
  expect(duplicate).toMatchObject({ captured: false, reason: "throttled" });
  expect(addDoc).toHaveBeenCalledTimes(1);

  resetMonitoringStateForTests();
  setMonitoringActor({ userId: "manager-1", userRole: "manager" });
  addDoc.mockRejectedValueOnce(new Error("monitor write unavailable"));
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  await expect(captureMonitoringError(
    { code: "failed-precondition" },
    { module: "inventory", operation: "write", now: 2000 }
  )).resolves.toMatchObject({ captured: false, reason: "monitoring-failed" });
  consoleErrorSpy.mockRestore();
});

test("uses a bounded timestamp-descending query for the Admin health view", async () => {
  getDocs.mockResolvedValue({
    docs: [{ id: "health-1", data: () => ({ category: "NETWORK" }) }],
  });

  const events = await getRecentMonitoringEvents({ database: { name: "erp" } });

  expect(events).toEqual([{ id: "health-1", category: "NETWORK" }]);
  expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
  expect(limit).toHaveBeenCalledWith(SYSTEM_HEALTH_EVENT_LIMIT);
  expect(startAfter).not.toHaveBeenCalled();
});

test("health summary stays observational and detects degraded or critical client signals", () => {
  const summary = getSystemHealthSummary([
    { severity: "ERROR", category: "FIRESTORE_WRITE", timestamp: new Date(1000) },
    { severity: "ERROR", category: "FIRESTORE_READ", timestamp: new Date(1000) },
    { severity: "ERROR", category: "NETWORK", timestamp: new Date(1000) },
  ], { now: 2000, isOnline: true });
  const critical = getSystemHealthSummary([
    { severity: "CRITICAL", category: "APPLICATION", timestamp: new Date(1000) },
  ], { now: 2000, isOnline: true });

  expect(summary.status).toBe("DEGRADED");
  expect(critical.status).toBe("ATTENTION REQUIRED");
});