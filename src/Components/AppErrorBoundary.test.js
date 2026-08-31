import React from "react";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "./AppErrorBoundary";

const ThrowingScreen = () => {
  throw new Error("test render failure");
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("shows a safe recovery screen instead of a blank app for render errors", () => {
    render(
      <AppErrorBoundary>
        <ThrowingScreen />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this screen. Please refresh and try again.");
    expect(screen.getByRole("button", { name: "Refresh ERP" })).toBeInTheDocument();
    expect(screen.queryByText("test render failure")).not.toBeInTheDocument();
  });
});