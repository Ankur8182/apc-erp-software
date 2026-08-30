import React from "react";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";
import { useAuth } from "../auth/AuthProvider";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
}));

test("shows supervisor users only the field workflow navigation", () => {
  useAuth.mockReturnValue({ role: "supervisor" });
  render(<Sidebar />);

  expect(screen.getByText("Field Home")).toBeInTheDocument();
  expect(screen.getByText("Field Update")).toBeInTheDocument();
  expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  expect(screen.queryByText("Reports")).not.toBeInTheDocument();
    expect(screen.queryByText("Inventory")).not.toBeInTheDocument();
    expect(screen.queryByText("Vendors")).not.toBeInTheDocument();
    expect(screen.queryByText("Purchase Requests")).not.toBeInTheDocument();
  expect(screen.queryByText("Expenses")).not.toBeInTheDocument();
});

test("keeps the standard ERP navigation for an admin", () => {
  useAuth.mockReturnValue({ role: "admin" });
  render(<Sidebar />);

  expect(screen.getByText("Dashboard")).toBeInTheDocument();
  expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Vendors")).toBeInTheDocument();
    expect(screen.getByText("Purchase Requests")).toBeInTheDocument();
  expect(screen.getByText("Daily Progress")).toBeInTheDocument();
  expect(screen.getByText("Client Billing")).toBeInTheDocument();
  expect(screen.getByText("User Management")).toBeInTheDocument();
});

test("uses the compact official brand in the sidebar without changing role menus", () => {
  useAuth.mockReturnValue({ role: "viewer" });
  render(<Sidebar />);

  expect(screen.getByAltText("A P Construction logo")).toBeInTheDocument();
  expect(screen.getAllByText("A P CONSTRUCTION").length).toBeGreaterThan(0);
  expect(screen.getByText("Dashboard")).toBeInTheDocument();
});