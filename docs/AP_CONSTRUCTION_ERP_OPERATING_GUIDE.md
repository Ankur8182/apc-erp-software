# AP Construction ERP — Operating Guide

**Product:** A P CONSTRUCTION / AP Construction ERP  
**Release guide:** v1.0  
**Firebase project:** `a-p-construction-erp`  
**Production URL:** <https://a-p-construction-erp.web.app>

This is the primary operating handbook for AP Construction ERP. It is for owners, administrators, managers, field users, and future maintainers. It explains the real operating workflow, its safety boundaries, and deliberately deferred features. It contains no passwords, tokens, service-account credentials, or personal user data.

Use it with the specialist runbooks: [Backup and Disaster Recovery](DISASTER_RECOVERY.md), [Data Health and Safe Migration](DATA_MIGRATION.md), [Security Audit](SECURITY_AUDIT.md), [System Health Runbook](SYSTEM_HEALTH_RUNBOOK.md), [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md), and [Monitoring Retention Policy](MONITORING_RETENTION_POLICY.md).

## 1. Operating principles

AP Construction ERP is an internal construction-management system for sites, procurement and stock, labour and payroll, equipment, client billing, BOQ measurement, Daily Progress Reports (DPRs), reporting, audit history, backup export, and operational monitoring.

Use the module that owns the business event. Do not create a second record in a different module merely to make a report look right.

- Create client income through an invoice or the certified RA-bill flow, not through a receipt or reversal entry.
- Record client cash/TDS through the linked receipt flow; do not record it as income again.
- Use the procurement/inventory flow for accepted material. Do not post another stock-in for the same Goods Receipt.
- Use a certified contractor bill for contractor cost; do not also enter an unrelated duplicate expense.
- Record fuel/running costs in Vehicle Expense History. A maintenance record's linked vehicle expense is the financial cost—do not repeat it.
- Use payroll as the established labour-cost source. Attendance is operational input and only contributes through approved fallback logic where salary data is unavailable.
- DPR quantities are operational evidence; they do not create income, stock movement, or financial expense.

Always verify the site, date, status, document reference, and amount before saving a record. Do not retry an unknown write repeatedly after a network interruption. Check the register, status message, and Audit Log where permitted first.

## 2. Architecture and production environment

| Item | Current implementation |
| --- | --- |
| Front end | React with React Router, responsive layouts, and PWA app-shell support |
| Hosting | Firebase Hosting, with a single-page-app route rewrite |
| Sign-in | Firebase Authentication using email/password |
| ERP data | Cloud Firestore |
| Production project | `a-p-construction-erp` |
| Production URL | <https://a-p-construction-erp.web.app> |
| Firebase Storage / DPR photos | **Deferred:** Storage is not provisioned for the current Spark-plan environment |
| Trusted Cloud Functions user management | **Deferred / plan-dependent:** do not assume it is live |

```text
Browser
  → React ERP (routes, forms, validation, reports and PWA shell)
  → Firebase Authentication (signed-in identity)
  → Cloud Firestore (role-protected ERP data)
  → Firebase Hosting (production web application)
```

The production Hosting URL is intended for internal ERP use. A custom domain and public search/indexing are separate future concerns and are not required for the current internal deployment.

The operational field workflow is deliberately separated from commercial access:

```text
Supervisor / Engineer
  → Field Home / Field Update
  → Daily Progress Report
  → Firestore
  → authorised management visibility in Dashboard, Site Details, Daily Progress and Reports
```

The PWA service worker caches the application shell only. It does not claim general Firestore offline write support. The narrow DPR local outbox is the only deliberate offline queue.

The Firebase web configuration identifies the public web application; it is not a service-account credential. Protection is provided by Authentication, active role profiles, Firestore rules, Storage rules when Storage is provisioned, and controlled backend credentials.

## 3. Roles, authorization, and session basics

A user needs both a Firebase Authentication account and an active Firestore profile at `users/{uid}`. Valid lowercase roles are:

`admin`, `manager`, `viewer`, `supervisor`, `engineer`

A missing, inactive, or unrecognised profile fails closed. Hidden navigation is only a convenience; route protection and Firestore rules enforce the real boundary.

| Role | Access | Write capability | Important restriction |
| --- | --- | --- | --- |
| **Admin** | Full standard ERP, Field Update, and admin diagnostics | Allowed by collection rules | Backend-dependent user changes still need a trusted deployed backend |
| **Manager** | Standard ERP and Field Update | Business/operational changes allowed by rules | No Audit Log, System Health, Backup & Recovery, Data Health, or user/security administration |
| **Viewer** | Standard ERP and reports in read-only mode | None | No field entry or admin tools |
| **Supervisor** | Field Home and Field Update | Own operational DPR only | No finance, budget, billing, payroll, commercial BOQ, reports, or admin access |
| **Engineer** | Field Home and Field Update | Own operational DPR only | Same field-only restrictions as Supervisor |

Field-only users may read their own DPRs and the operational reference data needed for entry: sites, inventory availability, and vehicles. They do not receive access to financial materials, budgets, payroll, client billing, profitability, or audit administration.

### Sign-in and sign-out

1. Sign in at the production URL with the organisation-issued email and password.
2. Confirm the displayed role in the header.
3. Use **Logout** when leaving a shared device.

If sign-in works but ERP access is denied, check that the matching `users/{uid}` profile exists, is `active: true`, and has an approved role. Do not bypass a denial by sharing an administrator session or changing browser code.

The browser does not expose password administration. For a forgotten password, use the approved Firebase Authentication reset/Console process. Never store passwords in Firestore, audit logs, backups, source code, chat, or screenshots.

### User-management fallback

The **User Management** screen is admin-only and is designed to call secured backend operations. Live Cloud Functions-based role management is currently **deferred / plan-dependent**. If the service is unavailable, use the controlled Console procedure:

1. Create/manage the Authentication account in **Firebase Console → Authentication → Users**.
2. Create or verify the matching `users/{uid}` profile using the approved administrator process.
3. Set only a valid role and explicit active/inactive state.
4. Ask the user to sign out and sign in after an access change.

Do not grant browser clients write access to `users`, do not let users alter their own role/status, and do not store Authentication passwords in Firestore.

## 4. Standard data rules

- Use required fields and valid dates, quantities, amounts, sites, and statuses. Application validation helps, but does not replace business review.
- Select the existing canonical site, labour, vendor, vehicle, item, and document reference whenever possible.
- Legacy aliases can be normalised for reporting; older records are not automatically rewritten.
- Do not delete legacy records merely because they are old. Use Data Health review, a fresh backup, and a separately approved migration.
- Correct append-preserved or immutable histories through their supported status/follow-up process; do not silently rewrite evidence.
## 5. Module operating guide

The table gives the normal purpose, authorised operating roles, key actions, cautions, and relationships. “Read” includes filter/search/export access where the page supports it.

| Module | Purpose and primary roles | Key actions | Caution and relationship |
| --- | --- | --- | --- |
| **Dashboard** | Admin, Manager, Viewer | Review site, finance, workforce, inventory, DPR, budget and health summaries. | It reuses canonical source records and does not create a second ledger. Field-only users use Field Home. |
| **Labour** | Admin/Manager manage; Viewer read | Maintain labour identity, trade, site, wage/salary basis, joining/active state, contractor detail and notes. | A labour-master record is never a direct expense. It feeds Attendance and Payroll. Protect personal identifiers. |
| **Sites** | Admin/Manager manage; Viewer read | Maintain site data and approved budget-planning values; open Site Details. | The canonical site links operational, financial, inventory, vehicle, DPR, BOQ and billing data. Older sites can have no budget. |
| **Materials** | Admin/Manager manage; Viewer read | Maintain material/purchase records and material details. | Material cost is financial source data. DPR material references must not become a second purchase/cost. |
| **Inventory** | Admin/Manager manage; Viewer read; field users have limited operational availability through Field Update | Create stock items; record stock in/out or reasoned adjustment; review low/out-of-stock state. | Current stock is opening + received − issued/used. Never enter negative quantities or duplicate a Goods Receipt stock movement. |
| **Vendors** | Admin/Manager manage; Viewer read | Maintain supplier/contractor records and active status. | Vendor history is retained rather than hard-deleted. It links Procurement and Work Orders. |
| **Purchase Requests** | Admin/Manager manage; Viewer read | Raise, review, approve/reject and track material/service requirements. | A request is not a purchase, expense or stock receipt. Follow the status flow. |
| **Purchase Orders** | Admin/Manager manage; Viewer read | Create authorised PO lines, vendor/site references, quantities/rates and track status. | A PO is a commitment; it is not automatically a receipt or a second cost. |
| **Goods Receipts** | Admin/Manager manage; Viewer read | Record received, accepted and rejected quantity against a PO line. | GRN/receipt establishes accepted stock; do not manually post the same accepted quantity again. |
| **Work Orders** | Admin/Manager manage; Viewer read | Create vendor-linked orders, certified progress, contractor bills and payments. | A certified contractor bill creates its linked canonical expense. Progress alone is not cost and payment is settlement history. |
| **BOQ & Measurement** | Admin/Manager manage; Viewer read | Maintain BOQ items; record/certify/reject measurement; manage variations and quantity progress. | Measurement is quantity evidence—not income, cost or invoice. Only approved variations affect authorised quantity/value. |
| **Client Billing** | Admin/Manager manage; Viewer read | Maintain client/profile, RA-bill draft/certification, receipt/TDS and retention release. | Certification creates one linked canonical invoice. Receipt/TDS update it once; retention release does not create revenue again. |
| **Expenses** | Admin/Manager manage; Viewer read | Record direct expense, category, site/date and relevant context. | Do not duplicate material, labour, contractor or vehicle values represented by their canonical workflow. |
| **Attendance** | Admin/Manager manage; Viewer read | Record one entry per labour/date: site, Present/Absent/Half Day/Leave, overtime and remarks. | Do not duplicate attendance. It informs payroll and approved fallback cost logic; it is not a second salary expense. |
| **Salary / Payroll** | Admin/Manager manage; Viewer read | Review payroll by period/site/labour; salary payment, pending balance and advances. | Verify wage type, attendance, advances/deductions and period. Do not pay above pending or count payment as new labour cost. |
| **Vehicle / Equipment** | Admin/Manager manage; Viewer read | Maintain equipment, assignment, fuel/expense history, maintenance/breakdown and fuel analytics. | Vehicle Expense History is preferred financial cost. A maintenance linked cost must not be duplicated manually. |
| **Invoice** | Admin/Manager manage; Viewer read | Maintain normal invoice records and payment information. | Invoices are the canonical revenue/receivable source. Do not create another invoice for a linked certified RA bill. |
| **Daily Progress** | Admin/Manager manage; Viewer read | Add/view/edit/delete/filter formal DPRs and operational totals. | DPR is operational evidence. Incompatible units are grouped, never added. Field users submit through Field Update. |
| **Field Home** | Admin, Manager, Supervisor, Engineer | Review own today count/manpower, available sites, draft/outbox state and recent submissions. | No commercial/financial data is shown to field-only users. Pending local items are not server-confirmed. |
| **Field Update** | Admin, Manager, Supervisor, Engineer | Submit site/date/activity/location, manpower, output/unit, materials/equipment and remarks. | See the DPR workflow below. Supervisor/Engineer writes remain bound to their own identity. |
| **Reports** | Admin, Manager, Viewer | Filter and review financial, payroll, inventory, procurement, BOQ, DPR, budget and health analytics; export/print permitted data. | Exports respect current visible filters. Field-only users have no Reports route. |
| **Audit Log** | Admin read only | Search, filter and paginate append-only activity history. | Browser clients cannot edit/delete it. Client audit records are traceability, not cryptographic proof. |
| **Backup & Recovery** | Admin only | Download a controlled Firestore JSON export. | It is sensitive data, not a complete Firebase backup, and has no browser restore button. |
| **Data Health & Migration** | Admin only | Run read-only diagnostics and review candidate records. | It makes zero writes. A candidate is not permission to delete data. |
| **User Management** | Admin only | Review user list; use role/status actions only if secured backend is confirmed live. | Current live backend availability is deferred/plan-dependent. Never work around it with browser writes. |
| **System Health** | Admin only | Review bounded sanitized client monitoring events and retention-review candidates. | It is a browser/application signal, not proof that Firebase, Google or the internet is healthy. |

## 6. Core business workflows

### Procurement and inventory

```text
Vendor → Purchase Request → Purchase Order → Goods Receipt → Inventory / material availability
```

1. Create or verify the vendor.
2. Raise a Purchase Request for the real requirement and follow its intended status/approval process.
3. Create a Purchase Order only when authorised.
4. When goods physically arrive, record the Goods Receipt with the correct PO line, challan/reference, received/accepted/rejected quantities and date.
5. Review the resulting inventory position. Use stock-out or adjustment only for a separate, real movement.

A GRN/Goods Receipt is receiving evidence. It connects an ordered line to accepted stock and prevents an order from being mistaken for delivery. Do not create a manual stock-in for the same accepted GRN. Do not treat a Purchase Request or Purchase Order alone as received material.

### Labour, attendance, payroll, payments and advances

```text
Labour master → Attendance → Payroll period → Salary payment / Labour advance
```

1. Maintain the labour master first: trade, site, wage/salary basis, active state and safe contact/identity detail.
2. Record one attendance row per labour/date using the true status and approved overtime.
3. Review payroll by month, site and labour before creating/updating it. Confirm present/absent/half-day treatment, payable days, overtime, advance recovery and deductions.
4. Record salary payment only against the pending amount, preserving date, mode and reference.
5. Record an advance with its reason/recovery position before recovering it through payroll.

For daily workers, pay follows approved payable days and daily wage plus supported overtime/deductions. Monthly workers use the supported period attendance/payable-day treatment. Shared logic prevents salary from being counted twice with attendance fallback; the Labour master itself is never expense data.

### Client billing, receipts, retention and revenue

```text
Client / billing profile → RA bill or Invoice → certification / issued invoice → Receipt → outstanding receivable
```

Maintain the client and site billing profile before drafting an RA bill. Certify a bill only after commercial review: certification creates one linked canonical invoice. Record client cash and TDS through the linked receipt flow once, then verify paid/pending status before retrying anything. Record retention release separately; it tracks retained receivable movement and does not create income again.

Outstanding receivable is derived from the canonical invoice value and recognised paid/received amount. Optional BOQ billing lines provide quantity context; they do not independently change an RA-bill value.

### BOQ, measurement and variations

```text
BOQ item → Measurement Book → certification → approved variation / RA-bill quantity context → progress reporting
```

Use BOQ for planned/authorised quantities and rates. Record measured work, then certify or reject it. Use a variation only when approved scope/quantity changes; only approved variations affect authorised quantity/value. Measurements and DPR links are operational progress evidence and do not automatically create an invoice, income, material issue or cost.

### Vehicle, fuel and maintenance

Maintain equipment and its site assignment. Record fuel and other running costs in Vehicle Expense History with vehicle, site, date, type, amount and remarks. Keep maintenance/breakdown history for operational control. If maintenance has a linked vehicle expense, that linked expense is the financial cost; do not duplicate it with a second manual vehicle expense.
## 7. Financial reporting integrity

Dashboard, Reports, Site Details, budget views and project analytics use shared calculation utilities. They are management views, not separate accounting ledgers.

| Measure | Established source / treatment |
| --- | --- |
| Revenue and receivable | `invoices`, including the linked invoice created by a certified RA bill |
| Received payment | Recognised invoice paid/received values updated through the controlled receipt flow |
| Material cost | Material purchase values and explicitly categorised material expenses; DPR usage is not a duplicate purchase cost |
| Labour cost | Payroll/salary records, only uncovered approved attendance fallback, and direct Labour expense records; no labour-master or salary-payment duplication |
| Vehicle cost | `vehicleExpenses` ledger; legacy vehicle fields are only a compatibility fallback where relevant ledger history is absent |
| Contractor cost | Explicit contractor-bill-linked expense; contractor payment is settlement history, not a second cost |
| Other cost | Valid direct non-material, non-labour, non-contractor expense categories |
| Total expense / profit | Shared canonical category totals; profit/loss is revenue less canonical total expense |

Purchase Requests, Purchase Orders, Goods Receipts, Work Orders, contractor payments, client receipts, retention releases, stock references, DPR quantities and BOQ measurements are not independently added as a second financial ledger. If a report looks wrong, review its source document, site, date, status and canonical category before creating a correction.

Site/date filters use normalised dates and canonical site matching. Malformed legacy dates or amounts are handled safely for reporting; they need review rather than silent production edits.

## 8. DPR and field-user workflow

### Online DPR submission

For a Supervisor or Engineer:

1. Sign in and confirm **Field mode** and the displayed identity/role.
2. Open **Field Home** to check own DPR, local draft and outbox state.
3. Select **New Site Update** or **Field Update**.
4. Select the site and date.
5. Enter the required work activity and work location.
6. Enter manpower count. Zero is valid; negative values are not.
7. Enter output quantity and a compatible unit. Zero is valid; negative values are not.
8. Add materials used, equipment/vehicle use and remarks where applicable.
9. Review the site, date and numbers, then submit once.
10. Wait for a confirmation before treating the DPR as server-saved.

The form uses a stable client submission ID and duplicate-submit guard. It always stores the current Firebase UID as `createdBy`; a field user cannot submit a DPR as another user. Admin/Manager may use Field Update too, but field-only users can read only their own DPR scope.

### Drafts, weak networks and local outbox

An unfinished form is saved as a local device/browser draft and can be discarded deliberately. It is cleared only after confirmed submission or discard. It is not shared with another device/browser.

When a field-only user is offline, or a retryable connection failure occurs, a validated DPR can be kept in a local outbox (IndexedDB, with browser-storage fallback). It is clearly marked as pending and is **not** yet a Firestore record. When online and signed in as the same field user, the outbox attempts synchronization. Field Home and Field Update show pending/failed status and retry/review/discard controls.

For a queued entry:

- Keep using the same device/browser and account until it synchronizes.
- Do not clear browser data, uninstall the PWA/browser, or discard the entry without approval.
- Read the attention status before retrying; permission or invalid-data errors need correction/escalation, not repeated taps.
- Check DPR history after reconnection to confirm the server copy exists.

The PWA shell is not general Firestore offline sync. The DPR outbox is intentional, narrow, and must not be treated as an offline accounting system.

### Current DPR photo fallback

**Firebase Storage is not provisioned on the current Spark-plan environment. Photo upload is unavailable.** DPR submission must continue without photos when the form says photos are unavailable. The form must not crash, create invalid photo metadata, or block the DPR itself.

Photos are never saved to local drafts or the offline DPR outbox. When offline or Storage is unavailable, submit the operational DPR without photo evidence and preserve evidence through the organisation-approved external process if required.

Future photo activation requires an appropriate Firebase plan, Storage provisioning, reviewed deployment of the repository Storage rules, and real-device verification of upload, access and controlled deletion. Do not describe photo upload as an active production capability before that work is complete.

## 9. Reports, exports and print

Reports provide relevant financial summary, site-wise financial results, expenses, attendance/payroll, inventory, procurement, vehicles, DPR, BOQ progress, budget/cost control, profitability and project-health views to the permitted standard ERP roles.

1. Open the relevant section.
2. Apply site, date range, status, activity, vendor/material or visible filters.
3. Check totals and representative rows before export.
4. Use PDF, CSV or Print for the currently filtered result only.
5. Review commercial, payroll, client, vendor and personal information before external sharing.

PDF and print output use AP Construction branding, report title, generated date, filters and appropriate table/summary detail. CSV provides meaningful headings, formatted values and formula-injection protection. A CSV remains sensitive business data; never publish it publicly or casually forward it.

## 10. Backup, recovery and data health

### Backup & Recovery

Only an active Admin can use **Backup & Recovery**. It creates a manual, read-only Firestore JSON export of allowlisted top-level ERP collections. It preserves document IDs, supported timestamp/date values and schema metadata, redacts credential-like fields if encountered, and stops instead of producing a partial browser backup.

Store the export only in approved encrypted, access-controlled storage. Record its date, filename, document/collection count, administrator and storage locations in the company backup register.

It is **not** a complete Firebase infrastructure backup. It excludes Authentication accounts/passwords/tokens, the full `users` collection, Storage objects, Firestore/Storage rules, indexes, Hosting, Functions, configuration, secrets and unknown/nested collections. There is intentionally no browser bulk-restore action.

For recovery, stop unsafe writes, keep the backup read-only, validate it in an isolated non-production target, reconcile relationships, obtain approval, take a fresh backup, then use a reviewed Admin SDK/GCP-controlled process. Never bulk overwrite production from a browser. Follow [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md).

### Data Health & Migration

**Data Health & Migration** is Admin-only and read-only. It identifies legacy, malformed, duplicate or orphan candidates and reports zero write operations. It never deletes, merges, corrects, archives or migrates data.

Before a future cleanup/migration: create a fresh backup; review each candidate's business/financial relationships; rehearse in non-production; then use a separately reviewed idempotent Admin SDK or controlled backend process. A candidate is never permission to delete a record. See [DATA_MIGRATION.md](DATA_MIGRATION.md).
## 11. Audit history, monitoring and incidents

### Audit Log

Important successful ERP actions can create append-only `auditLogs` records with actor, role, action, module, record reference, safe summary, optional site and timestamp. The page is Admin-only and supports filtering/pagination. Browser clients cannot edit or delete the log.

Use it for traceability, but do not treat a browser-originated audit event as cryptographic non-repudiation. Never place passwords, tokens, Aadhaar, bank details or full form contents in audit summaries.

### System Health

System Health is Admin-only and reads a bounded, non-realtime view of the newest sanitized browser monitoring events. Events contain safe metadata such as category, severity, code, module, operation, actor role and timestamp—not raw stack traces or submitted form values.

| Status | Meaning |
| --- | --- |
| **HEALTHY** | Loaded recent events do not meet warning/error thresholds. It is not an infrastructure guarantee. |
| **DEGRADED** | Recent warning/error signals meet the configured threshold; review safe event details. |
| **ATTENTION REQUIRED** | A recent crash, offline condition, or monitoring read issue needs review before treating counts as reliable. |

Do not delete monitoring events in the browser. Retention is review/policy driven; trusted cleanup is deferred until an approved Admin SDK or scheduled backend design exists. See [SYSTEM_HEALTH_RUNBOOK.md](SYSTEM_HEALTH_RUNBOOK.md) and [MONITORING_RETENTION_POLICY.md](MONITORING_RETENTION_POLICY.md).

### Incident quick guide

Use [INCIDENT_RESPONSE_RUNBOOK.md](INCIDENT_RESPONSE_RUNBOOK.md):

```text
Detect → Confirm → Protect data → Diagnose → Fix → Test → Deploy → Verify → Close
```

- **P1 Critical:** broad outage, confirmed data-integrity risk, or core workflow cannot safely continue.
- **P2 High:** major module or many users are blocked.
- **P3 Medium:** limited issue with a safe workaround.
- **P4 Low:** isolated, non-blocking/recoverable issue.

Do not blindly retry unknown writes, weaken security rules, delete evidence, share raw console output, or create fake records during an incident.

## 12. Deployment and source-control basics

This is a future controlled-release procedure; it is not permission to deploy all Firebase services.

### Before a release

```powershell
git status
git diff --check
npm test -- --watchAll=false --runInBand
npx eslint src
npm run build
```

Review exact changes and select the smallest required deployment target:

```powershell
# Hosting application build changed
firebase deploy --only hosting --project a-p-construction-erp

# Firestore rules changed
firebase deploy --only firestore:rules --project a-p-construction-erp
```

Do not use a blanket deploy. Do not deploy Firestore rules when `firestore.rules` did not change. Do not deploy Functions unless required, supported and separately reviewed. Do not deploy Storage while Storage is unprovisioned.

After an approved deployment, perform a narrow role-safe smoke check: sign in, load Dashboard, perform only an approved representative action, confirm reports, exercise a permitted field workflow, and check System Health. Do not modify production data merely to test it.

### Git and source control

Use explicit staging, not `git add .`:

```powershell
git status
git diff --check
git add <specific-reviewed-files>
git commit -m "<clear change summary>"
git push origin main
```

Do not commit `.firebase` generated cache or dependency directories. If OneDrive/Git shows `Deletion of directory '.git/objects/...' failed. Should I try again? (y/n)`, answer **`n`**, then verify status/commit/push. Do not delete `.git` objects manually. Consider moving the repository outside OneDrive during a separately planned maintenance task if the warning recurs.

## 13. Maintenance checklist

### Daily

- Confirm failed operational actions before retrying.
- Check System Health when a user reports an issue.
- Review critical notification/monitoring signals and DPR outbox attention items.
- Verify payroll, billing, procurement, inventory and vehicle exceptions against the source record.

### Weekly

- Review monitoring events and unresolved incidents.
- Verify a recent backup exists in its approved secure location.
- Review procurement, payroll, billing, inventory and vehicle anomalies.
- Check active sites, material availability and field DPR queue issues.

### Monthly

- Create and securely retain a fresh backup.
- Review user access, inactive accounts and role appropriateness.
- Review Data Health candidates without browser-side destructive action.
- Review Firestore usage/cost, monitoring retention candidates and plan-dependent limitations.
- Reconcile high-value financial, stock, payroll and billing results with approved business records.

## 14. Deferred / plan-dependent features

| Capability | Current safe state | Future activation requirement |
| --- | --- | --- |
| **Firebase Storage / DPR photos** | Deferred. DPR works without photos; photo upload is unavailable and must not block submission. | Appropriate plan, Storage provisioning, reviewed Storage-rules deployment, real-device upload/access/deletion tests. |
| **Trusted in-app User Management** | Deferred. Do not assume callable Cloud Functions are live; use controlled Firebase Console + profile process. | Appropriate plan/backend readiness, reviewed Functions deployment and admin-only verification. |
| **Scheduled monitoring cleanup** | Deferred. Retention is review/policy based; browser clients never delete monitoring history. | Trusted Admin SDK or scheduled function with dry-run, approval, archival and conservative limits. |
| **Complete managed Firebase backup/restore** | Deferred. Browser JSON export is a portability/recovery aid, not infrastructure backup. | Reviewed GCP/Firebase backup strategy, secure storage, restore rehearsal and access controls. |

These are documented limitations—not permission to weaken rules or bypass safe fallbacks. No plan upgrade is required merely to submit a DPR without photos.

## 15. Troubleshooting safely

| Symptom | Safe first checks | Do not do | Escalate when |
| --- | --- | --- | --- |
| Invalid username/password | Verify intended email; use approved Auth reset/Console procedure. | Guess repeatedly, share credentials or store passwords in Firestore. | Multiple legitimate users cannot sign in. |
| Signed in but access denied | Verify active `users/{uid}` role profile. | Share an admin session or alter browser code. | Profile is correct but access remains denied. |
| Permission denied | Check role, route, site/reference and safe error message. | Weaken Firestore rules or retry unknown writes. | A permitted role consistently fails a documented action. |
| Blank/failed page | Refresh once; record safe route/status; Admin checks System Health. | Share raw console details or create test production records. | Reproducible on current build. |
| DPR pending | Check network/auth, Field Home outbox and retry guidance. | Clear browser data or submit duplicates. | Non-retryable status or persistent retry failure. |
| Outbox will not sync | Reconnect; use same account/device; retry after sign-in. | Transfer another user's entry or discard without approval. | Permission/invalid-data error or repeated stable-network failure. |
| Photo unavailable | Submit DPR without photos; preserve evidence externally as approved. | Delay DPR, invent photo metadata or assume Storage is live. | Storage has formally been provisioned/tested but still fails. |
| Report mismatch suspected | Check filters, source document, site/date/status and canonical category. | Add compensating duplicate income/cost. | Correct source still produces inconsistency. |
| Old Hosting content | Check approved release/build, cache/service-worker refresh and project. | Deploy all Firebase services blindly. | Confirmed Hosting release serves wrong build. |
| System Health warning | Review sanitized events and follow incident runbook. | Treat it as proof of infrastructure outage or delete events. | P1/P2 criteria, repeated failures or data risk apply. |
| Missing/legacy record | Search/filter, use Site Details/Audit Log where allowed, and Data Health review. | Browser bulk restore/migration or old-record deletion. | Evidence suggests loss/corruption. |
| OneDrive Git prompt | Answer `n`, then verify status/commit/push. | Manually delete Git object files. | Object errors recur or source integrity is uncertain. |
