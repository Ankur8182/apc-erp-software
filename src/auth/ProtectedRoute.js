import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import {
  getRoleLandingPath,
  isFieldOnlyRole,
  STANDARD_ERP_ROLES,
} from "./authorization";

function ProtectedRoute({ children, allowedRoles = STANDARD_ERP_ROLES }) {
  const { loading, isAuthorized, role } = useAuth();
  const hasRoleAccess =
    Array.isArray(allowedRoles) && allowedRoles.includes(role);

  if (loading) {
    return <p role="status">Checking account access...</p>;
  }

  if (!isAuthorized) return <Navigate to="/" replace />;

  return hasRoleAccess
    ? children
    : <Navigate to={isFieldOnlyRole(role) ? "/field-dashboard" : "/dashboard"} replace />;
}

export function PublicOnlyRoute({ children }) {
  const { loading, isAuthorized, role } = useAuth();

  if (loading) return <p role="status">Checking account access...</p>;

  const landingPath = getRoleLandingPath(role);

  return isAuthorized ? <Navigate to={landingPath} replace /> : children;
}

export default ProtectedRoute;
