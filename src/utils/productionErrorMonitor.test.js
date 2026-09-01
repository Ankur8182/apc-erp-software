import { captureMonitoringError } from "./monitoring";
import {
  installProductionErrorMonitoring,
  resetProductionErrorMonitoringForTests,
} from "./productionErrorMonitor";

jest.mock("./monitoring", () => ({
  captureMonitoringError: jest.fn(),
}));

afterEach(() => {
  resetProductionErrorMonitoringForTests();
  jest.clearAllMocks();
});

test("captures unhandled application failures through one global listener", () => {
  installProductionErrorMonitoring();
  installProductionErrorMonitoring();
  const error = new Error("raw stack should not be rendered");
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", { value: error });

  window.dispatchEvent(event);

  expect(captureMonitoringError).toHaveBeenCalledTimes(1);
  expect(captureMonitoringError).toHaveBeenCalledWith(
    error,
    { module: "app", operation: "application" }
  );
});