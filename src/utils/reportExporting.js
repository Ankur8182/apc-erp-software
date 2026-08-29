const APP_NAME = "AP Construction ERP";

const asText = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const escapeCsvValue = (value) => `"${asText(value).replace(/"/g, '""')}"`;

const escapeHtml = (value) =>
  asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getRawCellValue = (row, column) => {
  if (typeof column.getValue === "function") return column.getValue(row);
  return row?.[column.key];
};

export const formatReportCell = (row, column) => {
  const rawValue = getRawCellValue(row, column);
  return asText(column.format ? column.format(rawValue, row) : rawValue);
};

export const createExportFileName = (reportName, extension) => {
  const safeName = asText(reportName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "report";
  const date = new Date().toISOString().slice(0, 10);

  return `ap-construction-${safeName}-${date}.${extension}`;
};

export const getGeneratedReportDate = (date = new Date()) =>
  date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const buildReportCsv = ({
  title,
  filters = [],
  summary = [],
  columns = [],
  rows = [],
  generatedAt = getGeneratedReportDate(),
}) => {
  const csvRows = [
    [APP_NAME],
    ["Report", title],
    ["Generated", generatedAt],
    [],
    ["Applied filters"],
    ...filters.map(({ label, value }) => [label, value]),
    [],
    ["Summary"],
    ...summary.map(({ label, value }) => [label, value]),
    [],
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => getRawCellValue(row, column))),
  ];

  return csvRows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
};

const downloadTextFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadReportCsv = (report) => {
  downloadTextFile(
    buildReportCsv(report),
    createExportFileName(report.title, "csv"),
    "text/csv;charset=utf-8"
  );
};

const buildPrintDocument = ({
  title,
  filters = [],
  summary = [],
  columns = [],
  rows = [],
  generatedAt = getGeneratedReportDate(),
}) => {
  const filterMarkup = filters.length
    ? filters.map(({ label, value }) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")
    : "<li>No filters applied</li>";
  const summaryMarkup = summary.length
    ? summary.map(({ label, value }) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
    : "<div><span>No summary values</span></div>";
  const headerMarkup = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rowMarkup = rows.length
    ? rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(formatReportCell(row, column))}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${Math.max(columns.length, 1)}">No records match the selected filters.</td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 ${columns.length > 5 ? "landscape" : "portrait"}; margin: 12mm; }
  * { box-sizing: border-box; } body { color: #172033; font: 11px Arial, sans-serif; margin: 0; }
  header { border-bottom: 2px solid #1d4ed8; margin-bottom: 14px; padding-bottom: 10px; }
  h1 { color: #0f172a; font-size: 20px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 16px 0 8px; }
  p { color: #475569; margin: 0; } ul { display: flex; flex-wrap: wrap; gap: 6px 18px; list-style: none; margin: 0; padding: 0; }
  .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
  .summary div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px; }
  .summary span { color: #64748b; display: block; font-size: 9px; } .summary strong { display: block; margin-top: 3px; }
  table { border-collapse: collapse; font-size: 9px; table-layout: fixed; width: 100%; } thead { display: table-header-group; }
  th { background: #0f172a; color: #fff; padding: 7px 5px; text-align: left; } td { border: 1px solid #dbe3ee; overflow-wrap: anywhere; padding: 6px 5px; vertical-align: top; }
  tr { break-inside: avoid; page-break-inside: avoid; } .empty { color: #64748b; padding: 18px; text-align: center; }
  footer { color: #64748b; font-size: 9px; margin-top: 12px; text-align: right; }
</style></head><body>
  <header><h1>${APP_NAME}</h1><p>${escapeHtml(title)} | Generated ${escapeHtml(generatedAt)}</p></header>
  <h2>Applied Filters</h2><ul>${filterMarkup}</ul>
  <h2>Summary</h2><section class="summary">${summaryMarkup}</section>
  <h2>Report Details</h2><table><thead><tr>${headerMarkup}</tr></thead><tbody>${rowMarkup}</tbody></table>
  <footer>${APP_NAME} - ${escapeHtml(title)}</footer>
</body></html>`;
};

export const printReport = (report) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(report));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);

  return true;
};

const drawPdfTable = (pdf, columns, rows, startY, pageWidth, pageHeight, margin) => {
  const usableWidth = pageWidth - margin * 2;
  const totalWeight = columns.reduce((total, column) => total + (column.width || 1), 0);
  const widths = columns.map((column) => usableWidth * ((column.width || 1) / totalWeight));
  const lineHeight = 10;
  const padding = 4;
  let cursorY = startY;

  const drawHeader = () => {
    let cursorX = margin;
    pdf.setFillColor(15, 23, 42);
    pdf.rect(margin, cursorY, usableWidth, 17, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7.5);
    columns.forEach((column, index) => {
      pdf.text(column.label, cursorX + padding, cursorY + 11);
      cursorX += widths[index];
    });
    pdf.setTextColor(30, 41, 59);
    cursorY += 17;
  };

  const newPage = () => {
    pdf.addPage();
    cursorY = margin;
    drawHeader();
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    const linesByCell = columns.map((column, index) =>
      pdf.splitTextToSize(formatReportCell(row, column), Math.max(widths[index] - padding * 2, 12))
    );
    const rowHeight = Math.max(...linesByCell.map((lines) => lines.length), 1) * lineHeight + padding * 2;

    if (cursorY + rowHeight > pageHeight - margin) newPage();

    if (rowIndex % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, cursorY, usableWidth, rowHeight, "F");
    }

    let cursorX = margin;
    pdf.setDrawColor(219, 227, 238);
    pdf.setLineWidth(0.35);
    columns.forEach((column, index) => {
      pdf.rect(cursorX, cursorY, widths[index], rowHeight);
      pdf.setFontSize(7.5);
      pdf.text(linesByCell[index], cursorX + padding, cursorY + padding + 7);
      cursorX += widths[index];
    });

    cursorY += rowHeight;
  });
};

export const exportReportPdf = async (report) => {
  const { jsPDF } = await import("jspdf");
  const landscape = report.columns.length > 5;
  const pdf = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  let cursorY = margin;

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(18);
  pdf.text(APP_NAME, margin, cursorY);
  cursorY += 19;
  pdf.setFontSize(11);
  pdf.text(asText(report.title), margin, cursorY);
  cursorY += 14;
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(8);
  pdf.text(`Generated: ${getGeneratedReportDate()}`, margin, cursorY);
  cursorY += 17;

  const filterText = report.filters.length
    ? report.filters.map(({ label, value }) => `${label}: ${value}`).join(" | ")
    : "No filters applied";
  const filterLines = pdf.splitTextToSize(`Filters: ${filterText}`, pageWidth - margin * 2);
  pdf.text(filterLines, margin, cursorY);
  cursorY += filterLines.length * 10 + 8;

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(9);
  report.summary.forEach(({ label, value }) => {
    if (cursorY > pageHeight - margin - 10) {
      pdf.addPage();
      cursorY = margin;
    }
    pdf.text(`${asText(label)}: ${asText(value)}`, margin, cursorY);
    cursorY += 11;
  });
  cursorY += 8;

  drawPdfTable(pdf, report.columns, report.rows, cursorY, pageWidth, pageHeight, margin);
  pdf.save(createExportFileName(report.title, "pdf"));
};

export const buildPrintPreviewHtml = buildPrintDocument;
