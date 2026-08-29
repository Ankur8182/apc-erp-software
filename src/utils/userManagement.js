import { getPageSlice } from "./dataTable";

export const ERP_USER_ROLES = [
  "admin",
  "manager",
  "viewer",
  "supervisor",
  "engineer",
];

const cleanText = (value) => String(value || "").trim();

export const normaliseManagedRole = (value) => {
  const role = cleanText(value).toLowerCase();
  return ERP_USER_ROLES.includes(role) ? role : "";
};

export const normaliseManagedUser = (user = {}) => ({
  uid: cleanText(user.uid || user.id),
  name: cleanText(user.name || user.displayName),
  email: cleanText(user.email),
  role: normaliseManagedRole(user.role),
  active: user.active === true,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null,
});

export const validateUserManagementUpdate = ({
  currentUserId,
  userId,
  role,
  active,
} = {}) => {
  const targetUserId = cleanText(userId);
  const safeRole = normaliseManagedRole(role);

  if (!targetUserId || !safeRole || typeof active !== "boolean") {
    return { isValid: false, error: "Select a valid role and active status." };
  }

  if (targetUserId === cleanText(currentUserId)) {
    return {
      isValid: false,
      error: "You cannot change your own role or active status.",
    };
  }

  return {
    isValid: true,
    value: { userId: targetUserId, role: safeRole, active },
  };
};

export const normaliseActiveFilter = (value) => {
  const filter = cleanText(value).toLowerCase();
  return ["active", "inactive"].includes(filter) ? filter : "";
};

export const filterManagedUsers = (users, filters = {}) => {
  const search = cleanText(filters.search).toLowerCase();
  const role = normaliseManagedRole(filters.role);
  const activeFilter = normaliseActiveFilter(filters.active);

  return (Array.isArray(users) ? users : [])
    .map(normaliseManagedUser)
    .filter((user) => {
      const searchable = [user.name, user.email, user.uid, user.role]
        .join(" ")
        .toLowerCase();
      const activeMatches =
        !activeFilter ||
        (activeFilter === "active" && user.active) ||
        (activeFilter === "inactive" && !user.active);

      return (!search || searchable.includes(search)) &&
        (!role || user.role === role) &&
        activeMatches;
    });
};

export const getManagedUserPage = (users, page, pageSize) =>
  getPageSlice(users, page, pageSize);

export const formatManagedUserDate = (value) => {
  if (!value) return "—";

  const date = typeof value?.toDate === "function"
    ? value.toDate()
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
};
