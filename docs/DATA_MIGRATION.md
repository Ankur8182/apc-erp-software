# Data Health & Safe Migration

## Phase 9C safety contract

The **Data Health & Migration** page is an administrator-only, read-only diagnostic. It reads the known top-level ERP collections only when an admin starts a dry run. It does **not** create, update, delete, merge, archive, clear, or migrate any Firestore document. The dry-run result always reports `writeOperations: 0`.

A candidate is not a deletion recommendation. Old records can have valid business value even when their schema is incomplete, a name is unusual, or a reference no longer resolves.

## Backup prerequisite

Before any future production cleanup or migration:

1. Create and verify a fresh Phase 9A Firestore JSON backup from **Backup & Recovery**.
2. Preserve the original backup as read-only in an approved encrypted location.
3. Reproduce the proposed change in an isolated Firebase project first.
4. Have an authorized business owner approve each affected record group.
5. Validate document counts, linked IDs, financial totals, stock, payroll, billing, and access after the test migration.

The browser ERP does not contain a bulk restore or production migration action. See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for recovery controls.

## Collection map

| Collection | Identity / current core fields | Legacy compatibility / relationships |
| --- | --- | --- |
| `sites` | ID, `siteName` | `name`, `site`, `projectName`; parent for operational/financial records |
| `siteBudgets` | `siteId`, `siteName`, `budget` | `site`, `projectName`, `totalBudget`; links to `sites` |
| `materials` | material purchase ID, `materialName`, `quantity`, `rate`, `site` | `name`, `material`, `qty`, `price`, `purchaseDate`; canonical material cost source |
| `inventoryItems` | `itemKey` or material + site + unit | `material`, `name`, `siteName`; links to sites/materials where an ID exists |
| `inventoryTransactions` | immutable ID, `inventoryItemId`, type, quantity, date | `itemId`, `type`, `qty`, `transactionDate`; links to inventory item/site |
| `expenses` | ID, amount/date/category/site | `expenseAmount`, `totalAmount`, `type`, `category`, `siteName`; canonical direct expense ledger |
| `labours` | ID, name, wage/pay type | `labourName`, `employeeName`, `wage`, `salary`; optional site link |
| `attendance` | `attendanceKey` or labour + date | labour name fallbacks and `overtime`; links to labour/site |
| `salaries` | ID, labour + payroll month + net pay | `employeeName`, `labourName`, `salary`, `totalSalary`; links to labour/site |
| `salaryPayments` | immutable payment ID | `payrollId`, `salaryId`, `date`, `paidAmount`; links to payroll/labour |
| `labourAdvances` | immutable advance ID | `advanceAmount`, `recoveryAmount`; links to labour/site |
| `vehicles` | ID, `vehicleNumber` / registration | `vehicleNo`, `registrationNumber`, `vehicleName`; optional site link |
| `vehicleExpenses` | immutable operational cost ID | `fuelAmount`, `expenseAmount`, `fuelDate`; links to vehicle/site; canonical vehicle expense ledger |
| `vehicleAssignments` | immutable assignment ID | legacy vehicle/site/date fields; links to vehicle/site |
| `vehicleMaintenance` | immutable maintenance ID | legacy vehicle/date/amount fields; links to vehicle/site |
| `vendors` | ID, `vendorName` | `name`, `supplierName`, GSTIN/mobile review keys |
| `purchaseRequests` | request number or ID | `number`, `requestDate`, `siteName`; links to site |
| `purchaseOrders` | PO number or ID | `number`, `purchaseOrderNumber`, `vendor`; links to vendor/request/site |
| `goodsReceipts` | immutable GRN number or ID | `receiptNumber`, `grnDate`, `poId`; links to PO/vendor/site |
| `workOrders` | work order number or ID | `orderNumber`, `contractorId`; links to vendor/site/optional BOQ |
| `workOrderProgress` | immutable progress ID | `orderId`, `progressDate`; links to work order/site |
| `contractorBills` | bill number/reference or ID | `contractorId`, `billNo`; links to vendor/work order/site |
| `contractorPayments` | immutable payment/reference ID | `paidAmount`, `date`, `billId`; links to bill/work order/vendor |
| `dailyProgressReports` | ID + createdBy/date/site/activity | `siteName`, `activity`, `location`, materials/equipment aliases; createdBy cannot be browser-verified against users/Auth |
| `boqItems` | site + item code/number | `itemNo`, `code`, `siteName`; links to site |
| `boqMeasurements` | immutable measurement ID | `itemId`, `measurementDate`, `qty`; links to site/BOQ item |
| `boqVariations` | variation reference + site | `reference`, `itemId`, `qty`; links to site/optional BOQ item |
| `clients` | ID + client name | `name`, `companyName`; billing master |
| `siteBillingProfiles` | `siteId` or ID | `site`, `client`, `agreementNo`; links to site/client |
| `raBills` | RA bill number or ID | `billNumber`, `invoiceNo`, `amount`; links to site/client/optional invoice |
| `clientReceipts` | immutable receipt key/reference or ID | `billId`, `date`, `transactionReference`; links to RA bill/site/client |
| `raRetentionReleases` | immutable release ID | `billId`, `date`, `releasedAmount`; links to RA bill/site/client |
| `invoices` | invoice number + client/site or ID | `invoiceNumber`, `billNo`, `amount`, `invoiceAmount`; links to site/optional client |
| `auditLogs` | immutable append-only ID | user/action/module/timestamp and optional context; never rewritten for formatting |
| `users` | Firebase UID | not listable by the browser under current rules; Firebase Auth accounts are not Firestore documents |

No supported application subcollections are used by the current codebase. Firebase Storage photo objects and Firebase Authentication accounts are intentionally outside this browser diagnostic.

## Legacy and invalid-data strategy

The diagnostic reports (never changes) the following:

- Missing current fields, IDs, parent references, statuses, dates, or source fields.
- Parseable legacy aliases, whitespace, dates, and numeric strings that can be normalized on a **copy**.
- Ambiguous aliases where current and legacy fields conflict. These are always marked **manual review required**.
- Malformed/non-finite or negative numeric values, irreconcilable invoice values, overpaid payroll, over-recovered advances, and material total mismatches.
- Possible test/demo/placeholder wording. This is only a review signal, never a disposable-data classification.

The existing report, financial, payroll, inventory, DPR, billing, and BOQ fallbacks remain active. Phase 9C does not remove or rewrite them.

## Duplicate and orphan strategy

Duplicate candidates are grouped only on conservative review identities: normalized site + location; labour Aadhaar or mobile/name; attendance labour + date; inventory material/site/unit; vendor GSTIN or mobile/name; registration/vehicle number; purchase document numbers; invoice/RA number + client/site; receipt references; and BOQ site + code/number.

Orphan candidates are identified only where an explicit parent ID or canonical site name exists. Examples include attendance/labour, stock transaction/item, PO/vendor/request, GRN/PO/vendor, vehicle history/vehicle, billing/client/site/RA bill, work order/vendor/BOQ, and measurement/BOQ item. A renamed site, missing historical master, or partial browser scope can all create a review candidate; no record is deleted or hidden.

## Immutable and financial histories

Do not cosmetically rewrite, merge, or delete these histories from a browser migration: `auditLogs`, `inventoryTransactions`, `salaryPayments`, `labourAdvances`, `clientReceipts`, `raRetentionReleases`, `goodsReceipts`, `vehicleExpenses`, `vehicleMaintenance`, `workOrderProgress`, and `boqMeasurements`.

Financial source-of-truth logic is unchanged. In particular, payroll obligations, attendance fallback rules, material purchases, expense categories, vehicle expense ledger/fallback rules, RA bills, and client receipt calculations are not recomputed or re-posted by Data Health.

## Dry-run review procedure

1. Sign in as an active administrator and open **Data Health & Migration**.
2. Confirm the explicit read-only prompt.
3. Review collection coverage, severity/category/collection filters, and each candidate’s document ID, fields, related candidate IDs, and copy-only proposal.
4. Export/verify a backup before deciding any action.
5. For each proposed normalization, compare original and normalized copies and validate linked records and financial meaning.
6. Record an approved, per-record plan outside the browser ERP.

## Future controlled production migration

A future migration is a separate change, not a button in this phase. It must use a reviewed Admin SDK or Cloud Run job with: a fixed backup ID, allowlisted collection + document IDs, precondition/version checks, idempotent transformations, dry-run logs, approval evidence, rollback plan, and a reconciliation report. It must refuse broad collection writes and must not overwrite immutable histories.

If rollback is required, stop normal writes and follow the tested recovery procedure in `DISASTER_RECOVERY.md`; never attempt a blind browser bulk restore over live financial or history records.