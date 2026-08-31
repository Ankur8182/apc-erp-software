import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedRoute, { PublicOnlyRoute } from "./ProtectedRoute";
import { useAuth } from "./AuthProvider";
import { ADMIN_ROLES, FIELD_UPDATE_ROLES, STANDARD_ERP_ROLES } from "./authorization";

jest.mock("./AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <div data-testid="redirect">{to}</div>,
}));

describe("route authorization", () => {
  test("redirects an unauthorised user away from ERP routes", () => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: false });

    render(
      <ProtectedRoute>
        <div>ERP data</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent("/");
    expect(screen.queryByText("ERP data")).not.toBeInTheDocument();
  });

  test("renders ERP routes only for an authorised user", () => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: true, role: "admin" });

    render(
      <ProtectedRoute>
        <div>ERP data</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("ERP data")).toBeInTheDocument();
  });

  test("fails closed for a missing or unknown route role", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthorized: true,
      role: "unrecognised-role",
    });

    render(
      <ProtectedRoute>
        <div>Sensitive ERP data</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(screen.queryByText("Sensitive ERP data")).not.toBeInTheDocument();
  });
  test("redirects an authorised user away from the login route", () => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: true, role: "admin" });

    render(
      <PublicOnlyRoute>
        <div>Login</div>
      </PublicOnlyRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
  });

  test("allows a supervisor to use the mobile field-update route only", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthorized: true,
      role: "supervisor",
    });

    render(
      <ProtectedRoute allowedRoles={FIELD_UPDATE_ROLES}>
        <div>Field Update</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Field Update")).toBeInTheDocument();
  });

  test("redirects a supervisor from standard ERP routes to Field Home", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthorized: true,
      role: "supervisor",
    });

    render(
      <ProtectedRoute allowedRoles={STANDARD_ERP_ROLES}>
        <div>Financial data</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent("/field-dashboard");
    expect(screen.queryByText("Financial data")).not.toBeInTheDocument();
  });

  test("keeps admin and viewer access to their standard ERP routes", () => {
    ["admin", "viewer"].forEach((role) => {
      useAuth.mockReturnValue({
        loading: false,
        isAuthorized: true,
        role,
      });

      const { unmount } = render(
        <ProtectedRoute allowedRoles={STANDARD_ERP_ROLES}>
          <div>{role} ERP data</div>
        </ProtectedRoute>
      );

      expect(screen.getByText(`${role} ERP data`)).toBeInTheDocument();
      unmount();
    });
  });

  test("allows an admin to open audit-log routes", () => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: true, role: "admin" });

    render(
      <ProtectedRoute allowedRoles={ADMIN_ROLES}><div>Audit history</div></ProtectedRoute>
    );

    expect(screen.getByText("Audit history")).toBeInTheDocument();
  });

  test.each([
    ["manager", "/dashboard"],
    ["viewer", "/dashboard"],
    ["supervisor", "/field-dashboard"],
    ["engineer", "/field-dashboard"],
  ])("denies %s access to admin-only routes", (role, redirectPath) => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: true, role });

    render(
      <ProtectedRoute allowedRoles={ADMIN_ROLES}><div>Audit history</div></ProtectedRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent(redirectPath);
    expect(screen.queryByText("Audit history")).not.toBeInTheDocument();
  });

  test("shows a safe loading state while the user role is being checked", () => {
    useAuth.mockReturnValue({ loading: true, isAuthorized: false });

    render(
      <ProtectedRoute allowedRoles={STANDARD_ERP_ROLES}>
        <div>ERP data</div>
      </ProtectedRoute>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking account access...");
  });

  test("sends an authorised engineer to the field-dashboard landing page", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthorized: true,
      role: "engineer",
    });

    render(
      <PublicOnlyRoute>
        <div>Login</div>
      </PublicOnlyRoute>
    );

    expect(screen.getByTestId("redirect")).toHaveTextContent("/field-dashboard");
  });
});
