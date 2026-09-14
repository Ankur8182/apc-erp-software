# Incident Response Runbook

## Purpose and operating principles

This runbook helps Admins and maintainers respond safely to production problems in AP Construction ERP. A monitoring event is a sanitized diagnostic signal, **not automatically an incident**. Open an incident only when a meaningful production problem is corroborated by impact, reproducibility, multiple reports, Firebase signals, audit evidence, or deployment history.

Do not create fake business records, retry unknown writes blindly, weaken Firestore rules, expose secrets, or delete evidence while investigating.

## Severity model

| Level | Definition | Typical examples | Initial owner / user guidance |
| --- | --- | --- | --- |
| P1 — Critical | Broad outage, data-integrity risk, or core workflow cannot safely continue. | App crash blocking most users; widespread sign-in/permission failure; confirmed duplicate/missing financial write. | Admin + maintainer act immediately. Stop only the affected write workflow and preserve evidence. |
| P2 — High | A major module or many users are blocked, but the whole ERP is not down. | Repeated Payroll, Client Billing, Inventory, Procurement, or Firestore write failure. | Admin triages promptly; affected users pause the module until the write outcome is confirmed. |
| P3 — Medium | Limited/degraded functionality with a safe workaround. | Intermittent report export issue; isolated module read error; recoverable UI issue. | Admin records impact, retries read-only/recoverable actions once, and schedules targeted repair. |
| P4 — Low | Isolated warning or non-blocking cosmetic/recoverable issue. | One warning after a temporary network interruption. | Record only if recurring; do not create noise or interrupt normal work. |

## Incident lifecycle

`NEW → ACKNOWLEDGED → INVESTIGATING → MITIGATED → RESOLVED → CLOSED`

- **NEW:** credible report/event received.
- **ACKNOWLEDGED:** owner, scope, and severity chosen.
- **INVESTIGATING:** evidence is being preserved; no blind retries.
- **MITIGATED:** affected workflow is safely restored or paused with a workaround.
- **RESOLVED:** root cause and corrective action are verified.
- **CLOSED:** post-checks, documentation, and follow-up actions are complete.

## Standard triage flow

1. Open System Health as Admin and record the safe category, severity, module, code, time, and affected role.
2. Confirm whether the failure is reproducible and whether it affects one user or multiple users.
3. Check the affected user’s active role/profile; never change a role just to bypass an error.
4. Check the network and browser state. Retry only a safe read or an explicitly recoverable operation once.
5. For writes with an unknown result, stop and inspect Firestore first.
6. Check the Firebase Console for authentication, Firestore, Hosting, and rules signals relevant to the failure.
7. Check recent Git commits, Hosting release, and any rule/index deployment.
8. Review audit history and relevant document IDs/timestamps.
9. Preserve safe evidence and open/update an incident note.
10. Apply the smallest targeted code/rule fix, run tests and build, then deploy only after approval.
11. Verify the affected workflow with a non-destructive or controlled valid case.
12. Close only after the monitoring signal and user impact are understood.

## Module-specific guidance

| Module | Usually retryable | Blocking / integrity-sensitive | Required manual verification |
| --- | --- | --- | --- |
| Authentication | Session refresh or password-reset flow. | Missing role/profile, disabled account, repeated sign-in failure. | Verify `users/{uid}` active role; never inspect/store passwords or tokens. |
| Expenses | Read/list retry after network recovery. | Unknown save/delete outcome, duplicate expense risk. | Find record ID, timestamp, site, amount, and audit entry before retrying. |
| Inventory | Read refresh. | Stock movement/adjustment failure or unexpected quantity. | Reconcile `inventoryTransactions`, item balance, GRN, DPR usage, and audit history. |
| Attendance | Read refresh. | Duplicate or unknown attendance write. | Check labour/date/site records before re-entry. |
| Payroll | Read refresh only. | Salary generation/payment/advance failure. | Verify salary, payment, advance, pending amount, and audit history before retrying. |
| Purchase Orders | Read refresh. | Status, payable, or duplicate PO uncertainty. | Verify PO ID, vendor, approval state, linked GRN/bill, and audit trail. |
| Goods Receipts | Read refresh. | GRN completion or linked inventory/procurement write uncertainty. | Verify GRN, inventory transaction, material link, and PO state atomically. |
| BOQ | Read refresh. | Measurement/certification/variation uncertainty. | Verify BOQ item, measurement status, rate/value immutability, and related billing. |
| Client Billing / Payments | Read refresh. | Receipt, RA bill, retention release, or payment mismatch. | Compare bill, receipt/payment ID, pending/received balance, invoice ledger, and audit history. |
| DPR | Read refresh or queued-sync status. | Duplicate DPR, partial submission, or unknown sync outcome. | Check `clientSubmissionId`, DPR ID, timestamps, site/date, and offline outbox before resubmitting. |
| Reports | Retry export after resolving browser/pop-up/network issue. | Financial totals appearing inconsistent. | Do not edit records; compare filters and canonical source documents first. |
| Backup / Recovery | Retry a read-only export if it failed before download. | Suspected incomplete/unsafe restore. | Stop, verify backup manifest/IDs/metadata, and use the disaster recovery guide; never bulk-restore from the browser. |

## Data-integrity incident procedure

Use this procedure for duplicate financial records, unknown write outcomes, inventory mismatches, billing/payment differences, duplicate DPRs, and partial multi-step transactions:

1. Pause the affected write workflow; do not blindly retry or delete.
2. Record relevant document IDs, timestamps, user role, site, and safe event/audit IDs.
3. Check Firestore documents and linked records before making any correction.
4. Compare server timestamps, transaction/batch relationships, audit entries, and canonical financial sources.
5. Preserve evidence with a controlled backup/export if needed.
6. Determine whether the original operation succeeded, partially succeeded, or failed.
7. Propose the smallest reversible correction and review its financial/security impact.
8. Test the correction outside production where feasible; require Admin/maintainer approval for production data changes.

## Frontend rollback procedure

Use rollback only for a confirmed frontend regression:

1. Identify the last known-good Git commit and the affected Hosting release.
2. Confirm whether the incident is frontend-only; do not assume rules/data changes can be rolled back safely.
3. Review Firestore rule, index, schema, and migration changes separately.
4. Build and test the selected prior frontend revision locally.
5. Deploy **Hosting only** after explicit approval.
6. Verify sign-in, role routing, affected workflow, and System Health after rollback.
7. Do not blindly roll back security rules or delete data. Document the incident and follow up with a forward fix.

## Firestore-rule incident procedure

For widespread `permission-denied`, inaccessible Admin pages, or blocked field workflows:

1. Check the exact deployed rule diff and intended active role.
2. Reproduce with the least-privilege affected role; do not change roles just to make a test pass.
3. Identify the narrow missing permission or schema validation issue.
4. Make the smallest safe correction, add/adjust tests, and review the full rule impact.
5. Deploy rules only after approval; never solve an outage with a broad `allow read, write` rule.

## Authentication incident procedure

- **Forgotten password:** use the Firebase password-reset flow; never collect or store passwords in ERP data.
- **Disabled/inactive account:** Admin verifies the authorized user profile and activation process; do not bypass restrictions.
- **Missing/invalid role or user document:** verify UID/profile existence and intended role through the protected administration process.
- **Invalid credentials/session expiry:** sign in again or reset password; inspect Firebase Authentication settings only when systemic.
- **Widespread auth failure:** classify P1/P2, check Firebase Console and the latest frontend/auth configuration release.

## Incident note template

Use a protected operational record or approved internal system when incidents warrant tracking. Do not add a client-side incident collection in this phase.

- Title and short safe summary
- P1/P2/P3/P4 severity and lifecycle state
- Module, affected sites/users count, opened/resolved timestamps
- Related sanitized monitoring event IDs and audit document IDs
- Related deployment/commit reference
- Root cause, mitigation, validation performed, and follow-up owner

Never include passwords, tokens, raw stacks, Aadhaar, bank/payment details, full form values, or unredacted browser console output.

## Closure checklist

- [ ] Impact and affected workflow were confirmed.
- [ ] Document IDs/timestamps and audit evidence were preserved where relevant.
- [ ] No unknown write was retried blindly.
- [ ] Targeted fix or mitigation was reviewed and tested.
- [ ] Required tests, lint, and production build passed.
- [ ] Deployment and role/rule impact were verified after approval.
- [ ] Monitoring trend is stable or a follow-up owner/date is recorded.
- [ ] Incident note contains no secrets or sensitive user/financial payloads.