import React from "react";
import { render, screen } from "@testing-library/react";
import Layout from "./Layout";

jest.mock("./Sidebar", () => () => <aside data-testid="sidebar" />);
jest.mock("./Header", () => () => <header data-testid="header" />);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "admin" }),
}));

describe("Layout page title", () => {
  it("does not add an empty page heading when a page owns its primary title", () => {
    render(
      <Layout>
        <main><h1>Inventory & Stock Control</h1></main>
      </Layout>
    );

    expect(screen.getAllByRole("heading", { name: "Inventory & Stock Control" })).toHaveLength(1);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("renders one shared primary heading for legacy pages that supply a title", () => {
    render(<Layout title="Attendance Management"><main>Attendance content</main></Layout>);

    const title = screen.getByRole("heading", { name: "Attendance Management" });
    expect(title).toHaveClass("page-title");
    expect(screen.getAllByRole("heading", { name: "Attendance Management" })).toHaveLength(1);
  });
});