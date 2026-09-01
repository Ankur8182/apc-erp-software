import {
  canSubmitFieldUpdate,
  canReadAuditLogs,
  canManageBackupExport,
  canManageDataHealth,
  canReadSystemHealth,
  canReadFieldReferenceData,
  FIELD_REFERENCE_COLLECTIONS,
  getDprReadScope,
  getAuthorizedRole,
  getRoleLandingPath,
  isFieldOnlyRole,
} from "./authorization";

test("authorizes active supervisor and engineer profiles", () => {
  expect(getAuthorizedRole({ active: true, role: "supervisor" })).toBe("supervisor");
  expect(getAuthorizedRole({ active: true, role: "ENGINEER" })).toBe("engineer");
});

test("does not authorize inactive or unknown field roles", () => {
  expect(getAuthorizedRole({ active: false, role: "supervisor" })).toBeNull();
  expect(getAuthorizedRole({ active: true, role: "foreman" })).toBeNull();
});

test("limits field submissions to admin, manager, supervisor, and engineer", () => {
  expect(canSubmitFieldUpdate("admin")).toBe(true);
  expect(canSubmitFieldUpdate("manager")).toBe(true);
  expect(canSubmitFieldUpdate("supervisor")).toBe(true);
  expect(canSubmitFieldUpdate("engineer")).toBe(true);
  expect(canSubmitFieldUpdate("viewer")).toBe(false);
});

test("limits field reference-data assumptions to the mobile field workflow", () => {
  expect(FIELD_REFERENCE_COLLECTIONS).toEqual(["sites", "inventoryItems", "vehicles"]);
  expect(canReadFieldReferenceData("engineer")).toBe(true);
  expect(canReadFieldReferenceData("viewer")).toBe(true);
  expect(canReadFieldReferenceData("unknown")).toBe(false);
});

test("identifies roles limited to their own field DPR records", () => {
  expect(isFieldOnlyRole("supervisor")).toBe(true);
  expect(isFieldOnlyRole("ENGINEER")).toBe(true);
  expect(isFieldOnlyRole("manager")).toBe(false);
  expect(isFieldOnlyRole("viewer")).toBe(false);
});

test("keeps field DPR reads owner-scoped and management reads unrestricted", () => {
  expect(getDprReadScope("supervisor", "supervisor-1")).toEqual({
    canRead: true,
    createdBy: "supervisor-1",
  });
  expect(getDprReadScope("engineer", "")).toEqual({
    canRead: false,
    createdBy: "",
  });
  expect(getDprReadScope("manager", "manager-1")).toEqual({
    canRead: true,
    createdBy: "",
  });
  expect(getDprReadScope("viewer", "viewer-1")).toEqual({
    canRead: false,
    createdBy: "",
  });
});

test("uses the correct landing page for field-only and ERP roles", () => {
  expect(getRoleLandingPath("engineer")).toBe("/field-dashboard");
  expect(getRoleLandingPath("supervisor")).toBe("/field-dashboard");
  expect(getRoleLandingPath("admin")).toBe("/dashboard");
  expect(getRoleLandingPath("viewer")).toBe("/dashboard");
});

test("limits audit-log access to active admin role handling", () => {
  expect(canReadAuditLogs("admin")).toBe(true);
  expect(canReadAuditLogs("manager")).toBe(false);
  expect(canReadAuditLogs("viewer")).toBe(false);
  expect(canReadAuditLogs("engineer")).toBe(false);
});

test("limits backup export administration to active admin role handling", () => {
  expect(canManageBackupExport("admin")).toBe(true);
  expect(canManageBackupExport("manager")).toBe(false);
  expect(canManageBackupExport("viewer")).toBe(false);
  expect(canManageBackupExport("supervisor")).toBe(false);
});
test("limits data-health administration to admins", () => {
  expect(canManageDataHealth("admin")).toBe(true);
  expect(canManageDataHealth("manager")).toBe(false);
  expect(canManageDataHealth("viewer")).toBe(false);
  expect(canManageDataHealth("engineer")).toBe(false);
});

test("limits System Health diagnostics to admins", () => {
  expect(canReadSystemHealth("admin")).toBe(true);
  expect(canReadSystemHealth("manager")).toBe(false);
  expect(canReadSystemHealth("viewer")).toBe(false);
  expect(canReadSystemHealth("engineer")).toBe(false);
});