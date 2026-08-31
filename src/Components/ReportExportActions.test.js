import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportExportActions from "./ReportExportActions";
import { printReport } from "../utils/reportExporting";

jest.mock("../utils/reportExporting", () => ({
  downloadReportCsv: jest.fn(),
  exportReportPdf: jest.fn(),
  printReport: jest.fn(),
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

  test("shows a safe print error if preview creation throws", () => {
    printReport.mockImplementation(() => {
      throw new Error("internal browser error");
    });
    render(<ReportExportActions report={report} />);

    fireEvent.click(screen.getByRole("button", { name: "Print" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Print preview could not be opened. Please try again.");
    expect(screen.queryByText("internal browser error")).not.toBeInTheDocument();
  });
});