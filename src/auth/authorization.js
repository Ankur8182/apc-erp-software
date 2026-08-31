export const STANDARD_ERP_ROLES = ["admin", "manager", "viewer"];
export const ADMIN_ROLES = ["admin"];
export const FIELD_UPDATE_ROLES = [
  "admin",
  "manager",
  "supervisor",
  "engineer",
];
export const FIELD_USER_ROLES = ["supervisor", "engineer"];
export const FIELD_REFERENCE_COLLECTIONS = ["sites", "inventoryItems", "vehicles"];
export const ERP_ROLES = new Set([
  ...STANDARD_ERP_ROLES,
  "supervisor",
  "engineer",
]);

export const canSubmitFieldUpdate = (role) =>
  FIELD_UPDATE_ROLES.includes(String(role || "").trim().toLowerCase());

export const isFieldOnlyRole = (role) =>
  FIELD_USER_ROLES.includes(String(role || "").trim().toLowerCase());

export const getRoleLandingPath = (role) =>
  isFieldOnlyRole(role) ? "/field-dashboard" : "/dashboard";

export const getDprReadScope = (role, userId = "") => {
  const cleanUserId = String(userId || "").trim();

  if (isFieldOnlyRole(role)) {
    return cleanUserId
      ? { canRead: true, createdBy: cleanUserId }
      : { canRead: false, createdBy: "" };
  }

  return FIELD_UPDATE_ROLES.includes(String(role || "").trim().toLowerCase())
    ? { canRead: true, createdBy: "" }
    : { canRead: false, createdBy: "" };
};

export const canReadFieldReferenceData = (role) =>
  ERP_ROLES.has(String(role || "").trim().toLowerCase());

export const canReadAuditLogs = (role) =>
  ADMIN_ROLES.includes(String(role || "").trim().toLowerCase());

export const canManageBackupExport = (role) =>
  ADMIN_ROLES.includes(String(role || "").trim().toLowerCase());

export const getAuthorizedRole = (profile = {}) => {
  const role = String(profile?.role || "").trim().toLowerCase();

  return profile?.active === true && ERP_ROLES.has(role) ? role : null;
};
