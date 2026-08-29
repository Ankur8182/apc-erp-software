import {
  filterManagedUsers,
  normaliseActiveFilter,
  normaliseManagedRole,
  validateUserManagementUpdate,
} from "./userManagement";

test("accepts only supported ERP roles", () => {
  expect(normaliseManagedRole(" MANAGER ")).toBe("manager");
  expect(normaliseManagedRole("owner")).toBe("");
});

test("blocks self-role or self-status changes", () => {
  expect(validateUserManagementUpdate({
    currentUserId: "admin-1",
    userId: "admin-1",
    role: "manager",
    active: true,
  })).toEqual(expect.objectContaining({
    isValid: false,
    error: "You cannot change your own role or active status.",
  }));
});

test("validates a safe user management update payload", () => {
  expect(validateUserManagementUpdate({
    currentUserId: "admin-1",
    userId: "manager-1",
    role: "viewer",
    active: false,
  })).toEqual({
    isValid: true,
    value: { userId: "manager-1", role: "viewer", active: false },
  });
});

test("filters users by search, role, and active status", () => {
  const users = [
    { uid: "admin-1", email: "admin@example.com", role: "admin", active: true },
    { uid: "engineer-1", name: "Field Engineer", role: "engineer", active: false },
  ];

  expect(filterManagedUsers(users, { role: "engineer", active: "inactive" }))
    .toEqual([expect.objectContaining({ uid: "engineer-1" })]);
  expect(filterManagedUsers(users, { search: "admin@example" }))
    .toEqual([expect.objectContaining({ uid: "admin-1" })]);
  expect(normaliseActiveFilter("unknown")).toBe("");
});
