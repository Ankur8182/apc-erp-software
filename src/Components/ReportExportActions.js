import React, { useState } from "react";
import { downloadReportCsv, exportReportPdf, printReport } from "../utils/reportExporting";
import "../Styles/ReportExportActions.css";

function ReportExportActions({ report, disabled = false }) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState("");

  const handlePdfExport = async () => {
    if (exportingPdf || disabled) return;

    try {
      setExportingPdf(true);
      setError("");
      await exportReportPdf(report);
    } catch (exportError) {
      console.error("PDF export error:", exportError);
      setError("PDF export could not be created. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCsvExport = () => {
    if (disabled) return;

    try {
      setError("");
      downloadReportCsv(report);
    } catch (exportError) {
      console.error("CSV export error:", exportError);
      setError("CSV export could not be created. Please try again.");
    }
  };

  const handlePrint = () => {
    if (disabled) return;

    try {
      setError("");
      if (!printReport(report)) {
        setError("Print preview was blocked. Please allow pop-ups and try again.");
      }
    } catch (printError) {
      console.error("Print preview error:", printError);
      setError("Print preview could not be opened. Please try again.");
    }
  };

  return (
    <section className="report-export-actions" aria-label={`${report.title} export actions`}>
      <div>
        <h3>{report.title}</h3>
        <p>{report.rows.length} matching record{report.rows.length === 1 ? "" : "s"}</p>
      </div>
      <div className="report-export-buttons">
        <button type="button" onClick={handlePdfExport} disabled={disabled || exportingPdf}>
          {exportingPdf ? "Creating PDF..." : "PDF"}
        </button>
        <button type="button" onClick={handleCsvExport} disabled={disabled}>CSV</button>
        <button type="button" onClick={handlePrint} disabled={disabled}>Print</button>
      </div>
      {error && <p className="report-export-error" role="alert">{error}</p>}
    </section>
  );
}

export default ReportExportActions;
