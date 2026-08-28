export const ERP_ROLES = new Set(["admin", "manager", "viewer"]);

export const getAuthorizedRole = (profile = {}) => {
  const role = String(profile?.role || "").trim().toLowerCase();

  return profile?.active === true && ERP_ROLES.has(role) ? role : null;
};
