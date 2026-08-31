import {
  DATA_HEALTH_COLLECTIONS,
  DATA_HEALTH_COLLECTION_CATALOG,
  createDryRunNormalization,
  detectDuplicateCandidates,
  detectInvalidFinancialCandidates,
  detectOrphanCandidates,
  detectPossibleTestDemoCandidates,
  filterDataHealthCandidates,
  parseDataHealthNumber,
  runDataHealthDryRun,
} from "./dataHealth";
import { ERP_BACKUP_COLLECTIONS } from "./erpBackup";

const records = (entries) => entries.map(([id, data]) => ({ id, data }));

test("maps every browser-readable backup collection and documents users as excluded from client scans", () => {
  expect(DATA_HEALTH_COLLECTIONS).toEqual(ERP_BACKUP_COLLECTIONS);
  ERP_BACKUP_COLLECTIONS.forEach((collectionName) => {
    expect(DATA_HEALTH_COLLECTION_CATALOG[collectionName]).toEqual(expect.objectContaining({ label: expect.any(String) }));
  });
  expect(DATA_HEALTH_COLLECTION_CATALOG.users.importance).toMatch(/not browser-scanned/i);
});

test("strict number parsing accepts numeric strings but rejects malformed and non-finite input", () => {
  expect(parseDataHealthNumber(" ₹1,250.50 ")).toMatchObject({ isValid: true, value: 1250.5, normalizable: true });
  expect(parseDataHealthNumber("12oops")).toMatchObject({ isValid: false, reason: "malformed" });
  expect(parseDataHealthNumber(Infinity)).toMatchObject({ isValid: false, reason: "non-finite" });
});

test("copy normalization preserves document ID and does not mutate the original legacy record", () => {
  const source = { id: "labour-1", data: { labourName: "  Riya   Singh ", wage: "₹500", site: "  North   Site  " } };
  const original = JSON.parse(JSON.stringify(source));

  const result = createDryRunNormalization("labours", source);
  const repeated = createDryRunNormalization("labours", { id: result.id, data: result.normalizedData });

  expect(source).toEqual(original);
  expect(result.id).toBe("labour-1");
  expect(result.normalizedData).toMatchObject({ name: "Riya Singh", dailyWage: 500, site: "North Site" });
  expect(result.proposedChanges.length).toBeGreaterThan(0);
  expect(repeated.proposedChanges).toHaveLength(0);
});

test("immutable histories are never proposed for rewrite even when a legacy field is parseable", () => {
  const result = createDryRunNormalization("salaryPayments", {
    id: "payment-1",
    data: { payrollId: "salary-1", labourId: "labour-1", amount: "500", paymentDate: "2026/08/01" },
  });

  expect(result.isImmutableHistory).toBe(true);
  expect(result.proposedChanges).toHaveLength(0);
  expect(result.manualReview.join(" ")).toMatch(/immutable history/i);
});

test("detects conservative attendance and inventory duplicate candidates without merging documents", () => {
  const duplicates = detectDuplicateCandidates({
    attendance: records([
      ["att-1", { labourId: "labour-1", date: "2026-08-01", employeeName: "Riya" }],
      ["att-2", { labourId: "labour-1", date: "2026-08-01", employeeName: "Riya" }],
    ]),
    inventoryItems: records([
      ["stock-1", { materialName: "Cement", site: "North Site", unit: "Bag" }],
      ["stock-2", { materialName: " cement ", site: "north site", unit: "bag" }],
    ]),
  });

  expect(duplicates).toEqual(expect.arrayContaining([
    expect.objectContaining({ collection: "attendance", category: "duplicate", relatedRecordIds: expect.arrayContaining(["att-2"]) }),
    expect.objectContaining({ collection: "inventoryItems", category: "duplicate" }),
  ]));
});

test("detects missing-parent relationships without treating a historical record as deletable", () => {
  const candidates = detectOrphanCandidates({
    sites: records([["site-1", { siteName: "North Site" }]]),
    attendance: records([["attendance-1", { labourId: "missing-labour", date: "2026-08-01", site: "North Site" }]]),
    vehicleExpenses: records([["fuel-1", { vehicleId: "missing-vehicle", site: "North Site", date: "2026-08-01", amount: 400 }]]),
  });

  expect(candidates).toEqual(expect.arrayContaining([
    expect.objectContaining({ collection: "attendance", field: "labourId", category: "orphan" }),
    expect.objectContaining({ collection: "vehicleExpenses", field: "vehicleId", category: "orphan" }),
  ]));
  expect(candidates.every((entry) => entry.manualReview)).toBe(true);
});

test("detects malformed, negative, and unreconciled financial values", () => {
  const candidates = detectInvalidFinancialCandidates({
    invoices: records([["invoice-1", { invoiceNo: "INV-1", site: "North", totalAmount: 1000, paidAmount: 1200, pendingAmount: -200 }]]),
    materials: records([["material-1", { materialName: "Cement", site: "North", quantity: 2, rate: 100, totalAmount: 500 }]]),
    salaries: records([["salary-1", { labourId: "labour-1", netSalary: 1000, paidAmount: 1100 }]]),
  });

  expect(candidates).toEqual(expect.arrayContaining([
    expect.objectContaining({ collection: "invoices", severity: "critical" }),
    expect.objectContaining({ collection: "materials", severity: "warning" }),
    expect.objectContaining({ collection: "salaries", summary: expect.stringMatching(/exceeds/i) }),
  ]));
});

test("checks nested budgets and linked payment records without recalculating financial ledgers", () => {
  const candidates = detectInvalidFinancialCandidates({
    siteBudgets: records([["site-1", { siteId: "site-1", budget: { material: "invalid", labour: -1 } }]]),
    salaries: records([["salary-1", { labourId: "labour-1", netSalary: 900 }]]),
    salaryPayments: records([["payment-1", { salaryId: "salary-1", labourId: "labour-1", amount: 1000 }]]),
    raBills: records([["ra-1", { raBillNumber: "RA-1", netBillAmount: 800, receivedAmount: 900, pendingAmount: 0 }]]),
    clientReceipts: records([["receipt-1", { raBillId: "ra-1", amount: 1000 }]]),
  });

  expect(candidates).toEqual(expect.arrayContaining([
    expect.objectContaining({ collection: "siteBudgets", field: "budget.material" }),
    expect.objectContaining({ collection: "siteBudgets", field: "budget.labour" }),
    expect.objectContaining({ collection: "salaryPayments", summary: expect.stringMatching(/exceeds/i) }),
    expect.objectContaining({ collection: "raBills", summary: expect.stringMatching(/exceeds/i) }),
    expect.objectContaining({ collection: "clientReceipts", summary: expect.stringMatching(/exceeds/i) }),
  ]));
});
test("labels possible test/demo wording as a review candidate rather than a deletion instruction", () => {
  const candidates = detectPossibleTestDemoCandidates({
    sites: records([["site-demo", { siteName: "Demo Road Project", location: "Pune" }]]),
  });
  expect(candidates).toEqual([expect.objectContaining({ category: "test-demo", manualReview: true, summary: expect.stringMatching(/not be assumed disposable/i) })]);
});

test("dry run reports zero writes, supports filters, and leaves supplied records unchanged", () => {
  const collectionDocuments = {
    sites: records([["site-1", { siteName: " North Site " }]]),
    labours: records([["labour-1", { labourName: "Riya", wage: "500", site: "North Site" }]]),
    attendance: records([["attendance-1", { labourId: "labour-1", date: "2026-08-01", site: "North Site", status: "Present" }]]),
    invoices: records([["invoice-1", { invoiceNo: "INV-1", site: "North Site", totalAmount: 1000, paidAmount: 1000, pendingAmount: 0 }]]),
  };
  const before = JSON.parse(JSON.stringify(collectionDocuments));

  const report = runDataHealthDryRun({ collectionDocuments });
  const onlyLegacy = filterDataHealthCandidates(report.candidates, { category: "normalization", collection: "labours" });

  expect(collectionDocuments).toEqual(before);
  expect(report.mode).toBe("dry-run");
  expect(report.writeOperations).toBe(0);
  expect(report.summary.recordsScanned).toBe(4);
  expect(report.summary.proposedChanges).toBeGreaterThan(0);
  expect(onlyLegacy).toEqual(expect.arrayContaining([expect.objectContaining({ collection: "labours", category: "normalization" })]));
});