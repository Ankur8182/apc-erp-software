import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { useAuth } from "../auth/AuthProvider";
import { listErpUsers, updateErpUser } from "../services/userManagementApi";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import {
  ERP_USER_ROLES,
  filterManagedUsers,
  formatManagedUserDate,
  normaliseManagedUser,
  validateUserManagementUpdate,
} from "../utils/userManagement";
import "../Styles/UserManagement.css";

const formatRole = (role) => {
  const value = String(role || "").trim();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "—";
};

const getUserManagementError = (error, fallback) => {
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("not-found") || code.includes("functions/internal")) {
    return "User Management service is not available yet. Ask an administrator to deploy the secured backend.";
  }

  return getUserFriendlyFirebaseError(error, fallback);
};

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingUserId, setSavingUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const records = await listErpUsers();
      setUsers(records.map(normaliseManagedUser));
    } catch (loadError) {
      console.error("User management load error:", loadError);
      setUsers([]);
      setError(getUserManagementError(
        loadError,
        "ERP users could not be loaded. Please try again."
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(
    () => filterManagedUsers(users, { search, role: roleFilter, active: activeFilter }),
    [users, search, roleFilter, activeFilter]
  );
  const userSortOptions = useMemo(() => [
    { value: "name", label: "Name / email", getValue: (record) => record.name || record.email },
    { value: "role", label: "Role", getValue: (record) => record.role },
    { value: "status", label: "Status", getValue: (record) => record.active ? 1 : 0 },
    { value: "updated", label: "Updated", getValue: (record) => record.updatedAt },
  ], []);
  const userTable = useDataTable(filteredUsers, {
    sortOptions: userSortOptions,
    defaultSortBy: "name",
    resetKey: `${search}|${roleFilter}|${activeFilter}`,
  });
  const availableRoles = useMemo(
    () => getDistinctValues(users, (record) => record.role),
    [users]
  );

  const getDraft = (record) => pendingChanges[record.uid] || {
    role: record.role,
    active: record.active,
  };

  const setDraft = (record, changes) => {
    setPendingChanges((current) => ({
      ...current,
      [record.uid]: { ...getDraft(record), ...changes },
    }));
    setSuccess("");
    setError("");
  };

  const saveUser = async (record) => {
    const draft = getDraft(record);
    const validation = validateUserManagementUpdate({
      currentUserId: currentUser?.uid,
      userId: record.uid,
      role: draft.role,
      active: draft.active,
    });

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    if (record.role === validation.value.role && record.active === validation.value.active) {
      setSuccess("No user access changes to save.");
      return;
    }

    const label = record.name || record.email || record.uid;
    const confirmed = window.confirm(
      `Change ${label}'s role to ${validation.value.role} and mark the account ${validation.value.active ? "active" : "inactive"}?`
    );

    if (!confirmed) return;

    try {
      setSavingUserId(record.uid);
      setError("");
      const updatedUser = await updateErpUser(validation.value);
      const safeUpdatedUser = normaliseManagedUser({ ...record, ...updatedUser });

      setUsers((current) => current.map((item) =>
        item.uid === record.uid ? safeUpdatedUser : item
      ));
      setPendingChanges((current) => {
        const next = { ...current };
        delete next[record.uid];
        return next;
      });
      setSelectedUser((current) => current?.uid === record.uid ? safeUpdatedUser : current);
      setSuccess("User access updated successfully.");
    } catch (saveError) {
      console.error("User management update error:", saveError);
      setError(getUserManagementError(
        saveError,
        "User access could not be updated. Please try again."
      ));
    } finally {
      setSavingUserId("");
    }
  };

  return (
    <Layout title="👥 User Management">
      <div className="data-page user-management-page">
        <div className="user-management-intro">
          <div>
            <h2>ERP user access</h2>
            <p>Manage roles and ERP access for existing Firebase Authentication users.</p>
          </div>
          <button type="button" className="user-refresh-btn" onClick={loadUsers} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        <div className="user-management-note">
          User creation, password management, and account deletion are intentionally not available in this browser. They require Firebase Authentication administration through the secured backend or Firebase Console.
        </div>

        <div className="table-card user-management-card">
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, email, UID or role..."
            table={userTable}
          >
            <label>
              <span>Role</span>
              <select aria-label="Filter users by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="">All roles</option>
                {(availableRoles.length ? availableRoles : ERP_USER_ROLES).map((role) => (
                  <option key={role} value={role}>{formatRole(role)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select aria-label="Filter users by status" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </DataTableToolbar>

          {loading && <p className="user-management-state" role="status">Loading authorized ERP users…</p>}
          {!loading && error && <p className="user-management-state user-management-error" role="alert">{error}</p>}
          {!loading && success && <p className="user-management-state user-management-success" role="status">{success}</p>}
          {!loading && !error && (
            <>
              <div className="table-responsive">
                <table className="user-management-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>UID</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userTable.count === 0 ? (
                      <tr><td colSpan="7" className="user-management-empty">No ERP users match the selected filters.</td></tr>
                    ) : userTable.rows.map((record) => {
                      const draft = getDraft(record);
                      const isCurrentUser = record.uid === currentUser?.uid;
                      const isSaving = savingUserId === record.uid;

                      return (
                        <tr key={record.uid}>
                          <td>
                            <strong>{record.name || "Name unavailable"}</strong>
                            <small>{record.email || "Email unavailable"}</small>
                          </td>
                          <td className="user-uid">{record.uid}</td>
                          <td>
                            <select
                              aria-label={`Role for ${record.email || record.uid}`}
                              value={draft.role}
                              onChange={(event) => setDraft(record, { role: event.target.value })}
                              disabled={isCurrentUser || isSaving}
                            >
                              {ERP_USER_ROLES.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
                            </select>
                          </td>
                          <td>
                            <label className="user-status-toggle">
                              <input
                                aria-label={`Active status for ${record.email || record.uid}`}
                                type="checkbox"
                                checked={draft.active}
                                onChange={(event) => setDraft(record, { active: event.target.checked })}
                                disabled={isCurrentUser || isSaving}
                              />
                              <span className={draft.active ? "user-status-active" : "user-status-inactive"}>
                                {draft.active ? "Active" : "Inactive"}
                              </span>
                            </label>
                          </td>
                          <td>{formatManagedUserDate(record.createdAt)}</td>
                          <td>{formatManagedUserDate(record.updatedAt)}</td>
                          <td className="user-management-actions">
                            <button type="button" className="user-view-btn" onClick={() => setSelectedUser(record)}>View</button>
                            <button
                              type="button"
                              className="user-save-btn"
                              aria-label={`Save changes for ${record.email || record.uid}`}
                              onClick={() => saveUser(record)}
                              disabled={isCurrentUser || isSaving}
                              title={isCurrentUser ? "You cannot change your own role or active status." : "Save role and status"}
                            >
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <DataTablePagination table={userTable} />
            </>
          )}
        </div>

        {selectedUser && (
          <div className="user-profile-overlay" role="presentation" onClick={() => setSelectedUser(null)}>
            <section className="user-profile-card" role="dialog" aria-modal="true" aria-label="User profile" onClick={(event) => event.stopPropagation()}>
              <div className="user-profile-heading">
                <h2>User profile</h2>
                <button type="button" aria-label="Close user profile" onClick={() => setSelectedUser(null)}>×</button>
              </div>
              <dl>
                <div><dt>Name</dt><dd>{selectedUser.name || "—"}</dd></div>
                <div><dt>Email</dt><dd>{selectedUser.email || "—"}</dd></div>
                <div><dt>UID</dt><dd className="user-uid">{selectedUser.uid}</dd></div>
                <div><dt>Role</dt><dd>{formatRole(selectedUser.role)}</dd></div>
                <div><dt>Status</dt><dd>{selectedUser.active ? "Active" : "Inactive"}</dd></div>
                <div><dt>Created</dt><dd>{formatManagedUserDate(selectedUser.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{formatManagedUserDate(selectedUser.updatedAt)}</dd></div>
              </dl>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default UserManagement;
