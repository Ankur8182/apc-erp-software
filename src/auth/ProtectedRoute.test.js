import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedRoute, { PublicOnlyRoute } from "./ProtectedRoute";
import { useAuth } from "./AuthProvider";

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
});
