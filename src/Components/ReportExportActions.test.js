import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportExportActions from "./ReportExportActions";
import { exportReportPdf, printReport } from "../utils/reportExporting";
import { captureMonitoringError } from "../utils/monitoring";

jest.mock("../utils/reportExporting", () => ({
  downloadReportCsv: jest.fn(),
  exportReportPdf: jest.fn(),
  printReport: jest.fn(),
}));

jest.mock("../utils/monitoring", () => ({
  captureMonitoringError: jest.fn(),
}));

const report = {
  title: "Financial Summary",
  rows: [],
  columns: [],
  filters: [],
  summary: [],
};

describe("ReportExportActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("shows a safe print error and records a sanitized export failure", () => {
    printReport.mockImplementation(() => {
      throw new Error("internal browser error");
    });
    render(<ReportExportActions report={report} />);

    fireEvent.click(screen.getByRole("button", { name: "Print" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Print preview could not be opened. Please try again.");
    expect(screen.queryByText("internal browser error")).not.toBeInTheDocument();
    expect(captureMonitoringError).toHaveBeenCalledWith(
      expect.any(Error),
      { module: "exports", operation: "export" }
    );
  });

  test("does not create a monitoring event for a successful export", async () => {
    exportReportPdf.mockResolvedValue();
    render(<ReportExportActions report={report} />);

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(exportReportPdf).toHaveBeenCalledWith(report));
    expect(captureMonitoringError).not.toHaveBeenCalled();
  });
});