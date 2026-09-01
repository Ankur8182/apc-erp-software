import { captureMonitoringError } from "./monitoring";

let removeListeners = null;

const reportUnhandledError = (error) => {
  void captureMonitoringError(error, {
    module: "app",
    operation: "application",
  });
};

export const installProductionErrorMonitoring = () => {
  if (typeof window === "undefined" || removeListeners) return removeListeners || (() => {});

  const onError = (event) => {
    // Resource-load events do not reliably carry a JavaScript Error and are
    // intentionally ignored to avoid noisy, low-value monitoring writes.
    if (event?.error || event?.message) reportUnhandledError(event.error || event);
  };
  const onUnhandledRejection = (event) => reportUnhandledError(event?.reason || event);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  removeListeners = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    removeListeners = null;
  };

  return removeListeners;
};

export const resetProductionErrorMonitoringForTests = () => {
  if (removeListeners) removeListeners();
};