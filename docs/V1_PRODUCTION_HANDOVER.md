# AP Construction ERP V1 Production Handover

## Handover statement

AP Construction ERP v1.0.0 is being handed over as the controlled production release for A P CONSTRUCTION. The production application is hosted at <https://a-p-construction-erp.web.app> in Firebase project `a-p-construction-erp`. This document describes the operating baseline, ownership boundaries, safe fallback procedures, and the remaining plan-dependent capabilities.

The final source tag is planned as `v1.0.0` after approved commit, push, clean verification, and tag review. This document does not create that tag or authorize a deployment.

## Live production baseline

| Area | Handover state |
| --- | --- |
| Hosting | Firebase Hosting serves the React single-page ERP. |
| Authentication | Firebase Authentication supports approved email/password accounts. |
| ERP data | Cloud Firestore stores operational, financial, and reference records. |
| Role security | Active user profiles, route protection, and deployed Firestore rules enforce access. |
| Monitoring | System Health and sanitized client-side monitoring are live and Admin-only. |
| Recovery | Admin-only Firestore JSON export, disaster-recovery guidance, and Data Health review are available. |
| Photos | DPR submission works without photos; Firebase Storage is not provisioned. |
| Trusted in-app role management | Callable Functions deployment is deferred; controlled Firebase Console/profile administration remains the fallback. |

## Core modules handed over

- **Sites and Dashboard:** site identity, Site Details, budgets, shared financial/project-health visibility for permitted standard roles.
- **Labour, Attendance, Payroll, Salary and Advances:** workforce master records, daily attendance, period payroll, payment/pending control, and advance recovery.
- **Materials, Inventory and Procurement:** vendors, purchase requests, purchase orders, Goods Receipts, stock ledgers, work orders, contractor bills, and payments.
- **Vehicles and Expenses:** vehicle/equipment master, assignments, fuel/expense history, maintenance/breakdown controls, and financial visibility.
- **BOQ and Measurement:** BOQ items, measurements, certification, variations, quantity progress, and linked reporting.
- **Client Billing and Invoices:** client/billing profiles, RA bills, controlled receipts/TDS, retention releases, invoices, receivables, and profitability context.
- **DPR and Field Workflow:** Daily Progress Reports, Field Home, Field Update, drafts, duplicate-submit protection, device-local outbox, and management visibility of confirmed updates.
- **Reports and Exports:** filtered operational, financial, inventory, procurement, payroll, vehicle, BOQ, billing, and analytics views with PDF, CSV, and Print options where supplied.
- **Audit, Backup, Data Health and System Health:** append-only activity history, controlled data export, read-only data-health review, monitoring, and incident guidance.

The complete module operating instructions are in [AP Construction ERP Operating Guide](AP_CONSTRUCTION_ERP_OPERATING_GUIDE.md).

## Final role matrix

| Area | Admin | Manager | Viewer | Supervisor | Engineer |
| --- | --- | --- | --- | --- | --- |
| Standard ERP operational and financial modules | Full access allowed by rules | Business read/write allowed by rules | Read only | No access | No access |
| Reports and exports | Permitted | Permitted | Read-only permitted | No access | No access |
| Field Home and Field Update | Permitted | Permitted | No access | Own operational DPR scope | Own operational DPR scope |
| Audit Log, Backup, Data Health, System Health | Admin-only | No access | No access | No access | No access |
| User role/status administration | Admin screen only; trusted backend remains deferred | No access | No access | No access | No access |
| Financial, payroll, billing, budget and commercial BOQ data | Permitted | Permitted | Read-only permitted | No access | No access |

Field-only users can read their own DPRs plus only the operational reference data needed for field entry. They do not receive financial, budget, payroll, billing, audit, or admin data. Firestore rules—not hidden menus—are the final data boundary.

## Field handover workflow

1. Supervisor or Engineer signs in using the approved account and confirms Field mode.
2. Field Home shows own confirmed DPRs, draft/outbox state, and connection status.
3. Field Update requires site, date, activity, location, manpower, output/compatible unit, and valid optional operational details.
4. A normal online submission becomes a Firestore DPR only after confirmation.
5. A validated offline/retryable DPR is saved in a narrow local outbox on that device, is shown as pending, and synchronizes only after network/auth recovery for the same user.
6. Pending entries must not be treated as server-confirmed. Users must not clear browser data, discard an entry, or re-submit blindly.

The PWA caches the application shell. It is not a general offline accounting system and does not introduce general Firestore offline-write behavior.

## Deferred plan dependent capabilities

### Firebase Storage and DPR photos

Storage is not provisioned. Field users must submit DPRs without photos whenever photo upload is unavailable. The future-ready `storage.rules` and tests remain in source but are not an active live service.

Future activation requires an approved supported plan, Storage provisioning, reviewed rules deployment, upload/read/access-restriction/deletion verification, and real-device Supervisor/Engineer testing. It is not a v1 blocker.

### Cloud Functions based User Management

Trusted callable-function user administration is not a live v1 dependency. The safe current process is Firebase Console for Authentication accounts plus the approved matching `users/{uid}` role/active profile process. Do not give browser clients direct profile-write permission.

Future activation requires backend/plan approval, Functions deployment, active-admin validation, self-role-change prevention checks, and role-change regression tests. It is not a v1 blocker.

### Trusted monitoring retention cleanup

Monitoring retention is reviewed by policy. Browser clients do not delete monitoring records. A future trusted Admin SDK or scheduled backend process must be separately designed, approved, tested, and deployed.

## Safe rollback baseline

### Frontend regression

Identify the approved last known-good Git commit or future release tag. In a controlled environment, check out that revision, run the quality gate, then deploy **Hosting only** after explicit approval. Confirm login, role routing, the affected workflow, reports, and System Health afterward.

### Firestore rule regression

Review the exact deployed rule difference, active role, and document shape. Make the smallest safe correction and verify the affected least-privilege roles. Do not blindly restore old rules and never use a broad allow rule to resolve an outage.

### Data issue

Git rollback is not a database rollback. Stop unsafe writes, inspect linked Firestore records, Audit Log, and secure backup evidence, then perform controlled, approved remediation. There is intentionally no browser bulk-restore action.

See [Deployment Guide](DEPLOYMENT_GUIDE.md), [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md), and [Backup and Disaster Recovery](DISASTER_RECOVERY.md).

## Post release operating checklist

### First 24 hours

- [ ] Verify authorized login and correct role landing behavior.
- [ ] Verify Dashboard, a representative permitted report, and one filtered export/print action.
- [ ] Verify one real approved operational workflow without creating fake production data.
- [ ] Verify Supervisor/Engineer Field Home and Field Update remain operational-only.
- [ ] Review System Health for sanitized application errors.

### Weekly

- [ ] Review System Health, unresolved errors, and incidents.
- [ ] Verify secure backup availability.
- [ ] Review user access when role or employment status changes.
- [ ] Review DPR outbox attention items and recurring workflow exceptions.

### Monthly

- [ ] Create a secure backup export.
- [ ] Review inactive accounts and role appropriateness.
- [ ] Review Data Health candidates without destructive browser action.
- [ ] Review Firebase usage and plan-dependent limitations.

## V1 change freeze

After the approved `v1.0.0` tag exists:

- Use new commits for production bug fixes; do not rewrite history.
- Do not delete, rewrite, or force-push the v1.0.0 tag.
- Put new functionality into post-v1 phases rather than modifying the release baseline casually.
- Prioritize security and data-integrity fixes over cosmetic improvements.

Use [V1 Release Manifest](V1_RELEASE_MANIFEST.md) and [Release Checklist](RELEASE_CHECKLIST.md) for final approval evidence.
