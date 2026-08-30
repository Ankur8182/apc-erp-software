import {
  buildPrintPreviewHtml,
  buildReportCsv,
  createExportFileName,
  formatReportCell,
} from "./reportExporting";

const report = {
  title: "Expenses Report",
  filters: [{ label: "Site", value: "North Site" }],
  summary: [{ label: "Total Expense", value: "INR 1250" }],
  columns: [
    { key: "date", label: "Date" },
    { key: "amount", label: "Amount", format: (value) => `INR ${value}` },
    { key: "remarks", label: "Remarks" },
  ],
  rows: [{ date: "2026-08-01", amount: 1250, remarks: 'Pipe "repair"' }],
};

describe("report export helpers", () => {
  it("keeps numeric source values in CSV and safely escapes commas and quotes", () => {
    const csv = buildReportCsv(report, { generatedAt: "01 Aug 2026" });

    expect(csv).toContain('"Amount"');
    expect(csv).toContain('"1250"');
    expect(csv).toContain('"Pipe ""repair"""');
  });

  it("uses formatting only for presentation exports", () => {
    expect(formatReportCell(report.rows[0], report.columns[1])).toBe("INR 1250");
  });

  it("creates predictable download names", () => {
    expect(createExportFileName("Site-wise Financial Report", "csv")).toMatch(/^ap-construction-site-wise-financial-report-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("escapes report content in print markup", () => {
    const html = buildPrintPreviewHtml({
      ...report,
      rows: [{ date: "2026-08-01", amount: 1250, remarks: "<script>alert(1)</script>" }],
      generatedAt: "01 Aug 2026",
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<td><script>");
    expect(html).toContain("A P CONSTRUCTION");
    expect(html).toContain('class="brand-logo"');
  });
});
