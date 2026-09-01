import React from "react";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "./AppErrorBoundary";
import { captureMonitoringError } from "../utils/monitoring";

jest.mock("../utils/monitoring", () => ({
  captureMonitoringError: jest.fn(),
}));

const ThrowingScreen = () => {
  throw new Error("test render failure");
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("shows a safe recovery screen and records only a sanitized application-monitoring event", () => {
    render(
      <AppErrorBoundary>
        <ThrowingScreen />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this screen. Please refresh and try again.");
    expect(screen.getByRole("button", { name: "Refresh ERP" })).toBeInTheDocument();
    expect(screen.queryByText("test render failure")).not.toBeInTheDocument();
    expect(captureMonitoringError).toHaveBeenCalledWith(
      expect.any(Error),
      { module: "app", operation: "application" }
    );
  });
});