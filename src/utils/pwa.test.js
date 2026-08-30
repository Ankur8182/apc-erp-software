import {
  getNetworkStatus,
  getOfflineFieldMessage,
  getPwaServiceWorkerPath,
  registerPwaServiceWorker,
} from "./pwa";

describe("PWA and mobile network helpers", () => {
  it("uses a root-safe service-worker path and does not register in development", async () => {
    expect(getPwaServiceWorkerPath("")).toBe("/service-worker.js");
    expect(getPwaServiceWorkerPath("/erp/")).toBe("/erp/service-worker.js");

    const register = jest.fn();
    await expect(registerPwaServiceWorker({
      isProduction: false,
      navigatorObject: { serviceWorker: { register } },
    })).resolves.toMatchObject({ registered: false });
    expect(register).not.toHaveBeenCalled();
  });

  it("registers only an explicitly supported production app shell", async () => {
    const registration = { scope: "/" };
    const register = jest.fn().mockResolvedValue(registration);

    await expect(registerPwaServiceWorker({
      isProduction: true,
      navigatorObject: { serviceWorker: { register } },
      serviceWorkerPath: "/service-worker.js",
    })).resolves.toMatchObject({ registered: true, registration });
    expect(register).toHaveBeenCalledWith("/service-worker.js");
  });

  it("reports offline state without claiming that a Firestore write was saved", () => {
    expect(getNetworkStatus({ onLine: true })).toBe(true);
    expect(getNetworkStatus({ onLine: false })).toBe(false);
    expect(getOfflineFieldMessage()).toMatch(/offline.*save.*device.*synchronize/i);
  });
});