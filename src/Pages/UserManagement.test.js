import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserManagement from "./UserManagement";
import { listErpUsers, updateErpUser } from "../services/userManagementApi";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "admin-1", email: "admin@example.com" } }),
}));
jest.mock("../services/userManagementApi", () => ({
  listErpUsers: jest.fn(),
  updateErpUser: jest.fn(),
}));

const users = [
  {
    uid: "admin-1",
    name: "Main Admin",
    email: "admin@example.com",
    role: "admin",
    active: true,
    createdAt: 1760000000000,
    updatedAt: 1760000000000,
  },
  {
    uid: "engineer-1",
    name: "Field Engineer",
    email: "engineer@example.com",
    role: "engineer",
    active: false,
    createdAt: 1760000000000,
    updatedAt: 1760000000000,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  listErpUsers.mockResolvedValue(users);
  updateErpUser.mockResolvedValue({ ...users[1], role: "viewer", active: true });
});

test("shows loading and then an admin user list", async () => {
  let resolveUsers;
  listErpUsers.mockReturnValue(new Promise((resolve) => { resolveUsers = resolve; }));
  render(<UserManagement />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading authorized ERP users");
  resolveUsers(users);

  expect(await screen.findByText("Field Engineer")).toBeInTheDocument();
  expect(screen.getByLabelText("Role for admin@example.com")).toBeDisabled();
});

test("shows a clear empty state when no ERP user profiles are returned", async () => {
  listErpUsers.mockResolvedValue([]);
  render(<UserManagement />);

  expect(await screen.findByText("No ERP users match the selected filters.")).toBeInTheDocument();
});

test("filters users by role and active status", async () => {
  render(<UserManagement />);
  await screen.findByText("Field Engineer");

  const roleSelect = screen.getByLabelText("Filter users by role");
  const statusSelect = screen.getByLabelText("Filter users by status");
  fireEvent.change(roleSelect, { target: { value: "engineer" } });
  fireEvent.change(statusSelect, { target: { value: "inactive" } });

  expect(screen.getByText("Field Engineer")).toBeInTheDocument();
  expect(screen.queryByText("Main Admin")).not.toBeInTheDocument();
});

test("shows a safe backend readiness error", async () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  listErpUsers.mockRejectedValue({ code: "functions/not-found" });
  render(<UserManagement />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "User Management service is not available yet."
  );
  consoleErrorSpy.mockRestore();
});

test("opens a read-only user profile view", async () => {
  render(<UserManagement />);
  await screen.findByText("Field Engineer");
  fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);

  expect(screen.getByRole("dialog", { name: "User profile" })).toHaveTextContent("Field Engineer");
  expect(screen.getByRole("dialog", { name: "User profile" })).toHaveTextContent("engineer-1");
});

test("confirms and submits a safe role/status update for another user", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  render(<UserManagement />);
  await screen.findByText("Field Engineer");

  fireEvent.change(screen.getByLabelText("Role for engineer@example.com"), {
    target: { value: "viewer" },
  });
  fireEvent.click(screen.getByLabelText("Active status for engineer@example.com"));
  fireEvent.click(screen.getByRole("button", { name: "Save changes for engineer@example.com" }));

  await waitFor(() => expect(updateErpUser).toHaveBeenCalledWith({
    userId: "engineer-1",
    role: "viewer",
    active: true,
  }));
  expect(await screen.findByRole("status")).toHaveTextContent("User access updated successfully.");
  window.confirm.mockRestore();
});
