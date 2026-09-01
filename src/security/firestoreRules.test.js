const fs = require("fs");
const path = require("path");

const rules = fs.readFileSync(
  path.join(process.cwd(), "firestore.rules"),
  "utf8"
);

describe("Firestore security rules", () => {
  test("keeps every supported legacy collection root-scoped", () => {
    [
      "sites/{siteId}",
      "labours/{labourId}",
      "expenses/{expenseId}",
      "attendance/{attendanceId}",
      "salaries/{salaryId}",
      "vehicles/{vehicleId}",
      "vehicleExpenses/{vehicleExpenseId}",
      "dailyProgressReports/{reportId}",
      "invoices/{invoiceId}",
    ].forEach((pathSegment) => {
      expect(rules).toContain(`match /${pathSegment} {`);
    });

    expect(rules).not.toContain("match /dailyProgressReports/{document=**} {");
    expect(rules).not.toContain("match /sites/{document=**} {");
    expect(rules).toContain("match /{document=**} {");
    expect(rules).toContain("allow read, write: if false;");
  });

  test("permits field DPR creation only with the bounded operational payload", () => {
    expect(rules).toContain("request.resource.data.keys().hasOnly([");
    expect(rules).toContain('"clientSubmissionId"');
    expect(rules).toContain('"photos"');
    expect(rules).toContain("request.resource.data.createdBy == request.auth.uid");
    expect(rules).toContain("request.resource.data.createdAt == request.time");
    expect(rules).toContain("request.resource.data.updatedAt == request.time");
    expect(rules).toContain("request.resource.data.quantity is number && request.resource.data.quantity >= 0");
    expect(rules).toContain("request.resource.data.manpowerCount is number && request.resource.data.manpowerCount >= 0");
  });

  test("retains role isolation for profiles, finance, audit, and field references", () => {
    expect(rules).toContain("allow list, create, update, delete: if false;");
    expect(rules).toContain("match /siteBudgets/{siteId} {");
    expect(rules).toContain("allow read: if isAuthorizedErpUser();");
    expect(rules).toContain("match /auditLogs/{documentId} {");
    expect(rules).toContain("allow read: if isAdmin();");
    expect(rules).toContain("match /inventoryItems/{itemId} {");
    expect(rules).toContain("allow read: if isAuthorizedErpUser() || isFieldUser();");
  });

  test("keeps System Health events sanitized, append-only, and admin-readable", () => {
    expect(rules).toContain("match /systemHealthEvents/{eventId} {");
    expect(rules).toContain("allow read: if isAdmin();");
    expect(rules).toContain("allow create: if canCreateSystemHealthEvent();");
    expect(rules).toContain("allow update, delete: if false;");
    expect(rules).toContain("request.resource.data.userId == request.auth.uid");
    expect(rules).toContain('"FIRESTORE_WRITE"');
    expect(rules).toContain('"application-crash"');
    expect(rules).toContain('"subcontracting"');
    expect(rules).not.toContain('request.resource.data.stack');
  });
});
