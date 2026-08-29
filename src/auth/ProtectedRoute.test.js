import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedRoute, { PublicOnlyRoute } from "./ProtectedRoute";
import { useAuth } from "./AuthProvider";
import { FIELD_UPDATE_ROLES, STANDARD_ERP_ROLES } from "./authorization";

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
    useAuth.mockReturnValue({ loading: false, isAuthorized: true });

    render(
      <ProtectedRoute>
        <div>ERP data</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("ERP data")).toBeInTheDocument();
  });

  test("redirects an authorised user away from the login route", () => {
    useAuth.mockReturnValue({ loading: false, isAuthorized: true });

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
