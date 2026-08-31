# AP Construction ERP — Backup & Disaster Recovery

## Purpose and scope

This document describes the Phase 9A recovery posture for AP Construction ERP. It is designed to prevent accidental loss from becoming an unrecoverable incident. It does **not** create an automatic Firebase backup, and it never performs a browser-based restore.

The in-app **Backup & Recovery** page is an administrator-only, manual export of selected, browser-readable Firestore collections. It preserves Firestore document IDs and writes a structured JSON file with schema/version metadata and serialized date values. Treat every exported file as sensitive business data.

## Current Firestore data audit

| Group | Collections | Recovery importance | Current deletion posture |
| --- | --- | --- | --- |
| Access profile | `users` | Critical role/profile references | Browser clients may read only their own profile; client export intentionally excludes it. Firebase Authentication accounts are separate. |
| Site and stock | `sites`, `siteBudgets`, `inventoryItems`, `inventoryTransactions` | Critical operational and budget history | Budget, inventory items, and stock ledgers are non-deletable. Sites remain legacy manager/admin-deletable. |
| Procurement and subcontracting | `vendors`, `purchaseRequests`, `purchaseOrders`, `goodsReceipts`, `workOrders`, `workOrderProgress`, `contractorBills`, `contractorPayments` | Critical purchasing, quantity, and payment trail | These are mostly status-controlled or immutable/non-deletable. |
| Labour and payroll | `labours`, `attendance`, `salaries`, `salaryPayments`, `labourAdvances` | Critical payroll and statutory history | Settlement payments are immutable; advances are retained. Legacy labour, attendance, and salary master records remain confirmed manager/admin deletions. |
| Vehicles | `vehicles`, `vehicleExpenses`, `vehicleAssignments`, `vehicleMaintenance` | Operational, fuel, and maintenance history | Assignments and maintenance are retained; legacy vehicle and vehicle-expense records remain confirmed manager/admin deletions. |
| Field evidence | `dailyProgressReports` | Operational evidence and site progress | ERP managers/admins retain confirmed delete ability; field users cannot delete DPRs. Photos are separate Storage objects. |
| BOQ and billing | `boqItems`, `boqMeasurements`, `boqVariations`, `clients`, `siteBillingProfiles`, `raBills`, `clientReceipts`, `raRetentionReleases`, `invoices` | Highest financial/revenue recovery importance | BOQ, billing, receipt, and retention ledgers are append-preserved/non-deletable. Legacy invoices remain confirmed manager/admin deletions. |
| Finance and audit | `materials`, `expenses`, `auditLogs` | Material cost, other cost, and traceability | Audit logs are append-only. Legacy material and expense records may be confirmed-deleted by manager/admin roles. |

Do not delete legacy records merely to normalize data. Before any approved deletion in a legacy-deletable collection, export a current backup and use the existing confirmation prompt. For a financial correction, prefer the existing status/cancellation/reversal workflow where the module provides one rather than removing history.

## Relationships that must be preserved

A recovery must retain document IDs and the relationships below:

- Sites connect budgets, inventory, expenses, labour/payroll, vehicles, DPRs, BOQ, work orders, and client billing through `siteId`, site names, and legacy equivalents.
- Inventory transactions point to inventory items; goods receipts create linked stock and material-cost records.
- Work orders link vendor, progress, contractor bills, contractor payments, and linked expense records.
- Salary payments and labour advances link payroll/labour records; attendance feeds payroll calculations.
- Vehicle assignments and maintenance link vehicle IDs and may link a canonical vehicle expense.
- DPR documents can include photo metadata paths, but not the Storage files themselves.
- RA bills, client receipts, retention releases, and linked invoices must be restored with their original IDs and order to preserve revenue/payment reconciliation.
- Audit logs are immutable evidence and must never be edited or regenerated as a substitute for lost records.

## What the in-app export covers

The manual JSON export covers the following top-level Firestore collections when they are readable by the active admin account:

`sites`, `siteBudgets`, `inventoryItems`, `inventoryTransactions`, `vendors`, `purchaseRequests`, `purchaseOrders`, `goodsReceipts`, `workOrders`, `workOrderProgress`, `contractorBills`, `contractorPayments`, `labours`, `materials`, `expenses`, `attendance`, `salaries`, `salaryPayments`, `labourAdvances`, `vehicles`, `vehicleExpenses`, `vehicleAssignments`, `vehicleMaintenance`, `dailyProgressReports`, `boqItems`, `boqMeasurements`, `boqVariations`, `auditLogs`, `clients`, `siteBillingProfiles`, `raBills`, `clientReceipts`, `raRetentionReleases`, and `invoices`.

The export has a browser safety limit. If the collection or total-document limit is exceeded, it fails before a file is downloaded. This is intentional: a partial browser backup must never be presented as complete.

### Intentionally not covered

- Firebase Authentication users, passwords, sessions, tokens, password-reset data, and MFA configuration.
- The complete `users` profile collection, because current security rules do not allow a browser admin to list all user profiles.
- Firebase Storage objects, including DPR/site photos. DPR photo **metadata** can be present within DPR documents, but image files are separate Storage data.
- Firestore security rules, Storage rules, indexes, Firebase project settings, Hosting, Cloud Functions, Cloud Scheduler, Secrets, service-account keys, or any unknown/nested collection.
- Credential-like data fields are excluded from the JSON export if they ever appear in a readable Firestore document.

## Manual backup procedure

1. Sign in using an active **admin** account in the production ERP.
2. Open **Backup & Recovery** from the sidebar.
3. Confirm the warning only when you can save the file in an approved encrypted location.
4. Select **Download Firestore JSON Backup** and wait for the success status. Do not close the page while it is reading collections.
5. Store the downloaded file using a date-based name in at least two controlled locations, such as an encrypted organization drive and an access-controlled offline/archive location.
6. Record the export date, filename, document count, administrator, and storage locations in the organization’s backup register. Do not put the backup itself in a public chat, email thread, or source repository.
7. Perform a non-production validation at least quarterly using the procedure below.

Recommended frequency: perform a daily manual export while on Spark/manual operations, plus immediately before major data correction, bulk import, rule change, or financial close. Retain multiple historical points according to the company’s accounting retention policy.

## Controlled restore procedure

There is intentionally **no restore/import button** in the ERP. A browser bulk restore could overwrite production data, bypass accounting controls, or break linked ledgers.

1. Declare the incident, stop normal writes, and preserve the original backup file read-only.
2. Identify the target Firebase project in Firebase Console and confirm the exact collection/document scope that is missing or damaged.
3. Validate the JSON offline using the Phase 9A schema checks. Confirm expected collection names, document counts, duplicate IDs, and serialized timestamps.
4. Create an isolated Firebase test project or a safe non-production target. Import only through a reviewed Admin SDK/GCP-controlled script operated by an authorized administrator; never from the browser.
5. Restore reference/master records first, then linked operational records, then immutable financial/payment/stock/billing/audit history. Preserve original document IDs exactly.
6. Reconcile site relationships, inventory movement balances, payroll payments, contractor and vehicle cost links, invoice/RA bill receipt totals, and audit coverage before touching production.
7. Obtain business and technical approval before any production write. Take a fresh pre-restore backup. Use idempotent, collection-scoped writes; never blindly overwrite an entire live project.
8. After recovery, verify permissions, login roles, reports, totals, DPR data, and a production build. Record the incident and validation results.

For a single accidental deletion in a legacy-deletable collection, prefer a narrowly reviewed restoration of that one document and its known linked records. Do not replace immutable ledgers with fabricated entries.

## Firebase-specific recovery limitations

### Firestore

The browser export is a data portability artifact, not a managed Firestore backup. Spark does not provide a safe automatic server-side Firestore export workflow from this frontend. Firestore point-in-time recovery, scheduled exports, and comprehensive project recovery require the relevant Firebase/GCP plan and administrative setup.

### Firebase Authentication

Authentication accounts are not Firestore documents and cannot be recovered from this JSON. Maintain a secure administrator account inventory and use Firebase Console/Admin SDK procedures for user recovery. Never export or store passwords, tokens, or service-account credentials in this project or backup file.

### Firebase Storage and DPR photos

Storage may still be unavailable on the current plan. If/when enabled, photo objects under `dprPhotos/` require a separate Storage backup/export process. Firestore DPR metadata alone does not restore an image. Test Storage recovery separately and retain photo backups with access controls equivalent to Firestore data.

### Source code and configuration

Maintain a protected remote Git repository with tagged releases and protected access. Recover source code from the approved repository/branch, then install locked dependencies from `package-lock.json` and run tests, lint, and production build. Keep Firebase project ID, deployment owner contacts, hosting domain, and authorized administrator list in a separate secure operations register—not in source code or backup JSON.

## Future automated backup option

If the project moves to Blaze/GCP-supported infrastructure, implement and test a least-privilege scheduled Firestore export to a dedicated, access-controlled Cloud Storage bucket. Configure retention, encryption, access review, cross-location policy if required, Storage photo backup, and monitored failure alerts. That future automation must be deployed and tested separately; it is not enabled by Phase 9A.

## Recovery verification checklist

- [ ] Backup schema, timestamp, collection count, document count, and document IDs validate.
- [ ] Restore rehearsal completed in a non-production Firebase project.
- [ ] Site, vendor, labour, vehicle, inventory, DPR, BOQ, and billing relationships reconcile.
- [ ] Financial totals and pending balances reconcile with approved records.
- [ ] Immutable records remain append-preserved; audit logs were not edited.
- [ ] Firebase Authentication roles and active statuses are reviewed separately.
- [ ] Storage/photo availability and evidence files are reviewed separately.
- [ ] Firestore/Storage rules, indexes, functions, Hosting, and source release are restored from approved configuration/source control.
- [ ] Admin signs off that reports, field workflow, and role restrictions behave correctly.