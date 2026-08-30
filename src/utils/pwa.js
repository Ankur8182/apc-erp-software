export const getPwaServiceWorkerPath = (publicUrl = process.env.PUBLIC_URL || "") => {
  const basePath = String(publicUrl || "").replace(/\/+$/, "");
  return `${basePath}/service-worker.js`;
};

const getBrowserNavigator = () =>
  typeof navigator === "undefined" ? undefined : navigator;

export const getNetworkStatus = (navigatorObject = getBrowserNavigator()) =>
  navigatorObject?.onLine !== false;

export const getOfflineFieldMessage = () =>
  "You’re offline. Complete the form and save the site update on this device; it will synchronize after a connection returns.";

export const registerPwaServiceWorker = ({
  navigatorObject = getBrowserNavigator(),
  isProduction = process.env.NODE_ENV === "production",
  serviceWorkerPath = getPwaServiceWorkerPath(),
} = {}) => {
  if (!isProduction || !navigatorObject?.serviceWorker?.register) {
    return Promise.resolve({ registered: false, reason: "unsupported-or-development" });
  }

  return navigatorObject.serviceWorker
    .register(serviceWorkerPath)
    .then((registration) => ({ registered: true, registration }))
    .catch((error) => ({ registered: false, error }));
};