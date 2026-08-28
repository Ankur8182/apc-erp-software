import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

function ProtectedRoute({ children }) {
  const { loading, isAuthorized } = useAuth();

  if (loading) return null;

  return isAuthorized ? children : <Navigate to="/" replace />;
}

export function PublicOnlyRoute({ children }) {
  const { loading, isAuthorized } = useAuth();

  if (loading) return null;

  return isAuthorized ? <Navigate to="/dashboard" replace /> : children;
}

export default ProtectedRoute;
