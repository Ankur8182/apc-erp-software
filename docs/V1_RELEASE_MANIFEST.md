# AP Construction ERP V1 Release Manifest

## Release identity

| Item | Value |
| --- | --- |
| Product | AP Construction ERP |
| Release | v1.0.0 |
| Release status | Production — release source closure pending approved commit and tag |
| Firebase project | `a-p-construction-erp` |
| Production URL | <https://a-p-construction-erp.web.app> |
| Branch | `main` |
| Release baseline before Phase 12C | `a5496609a1fae758f8ca2b2368ca56c19618059e` (`docs: add v1 operating and release handbook`) |
| Planned release tag | `v1.0.0` (not created by this phase) |

The baseline was synchronized with `origin/main` before Phase 12C release-closure edits. This manifest contains no passwords, tokens, private keys, customer data, or business records.

## Production deployment architecture

```text
Browser
  -> React ERP with React Router and PWA application shell
  -> Firebase Authentication for signed-in identity
  -> Cloud Firestore for role-protected ERP data
  -> Firebase Hosting for the production web application
```

| Service or component | Current v1 status |
| --- | --- |
| Firebase Hosting | Live production web application at the URL above; SPA rewrite configured. |
| Firebase Authentication | Live email/password identity service. |
| Cloud Firestore | Live ERP data service with deployed role-based security rules. |
| System Health and browser monitoring | Live, Admin-only operational visibility with sanitized/bounded events. |
| Firebase Storage / DPR photos | Deferred and unprovisioned. DPR submission is safe without photos. |
| Cloud Functions User Management | Source exists, but live trusted backend deployment is deferred/plan-dependent. |
| Firestore composite indexes | No Phase 12C index configuration or deployment is required. |

## Supported roles

| Role | Major access areas |
| --- | --- |
| Admin | Standard ERP, Field workflow, Audit Log, Backup & Recovery, Data Health & Migration, System Health, and admin-only User Management screen. |
| Manager | Standard ERP business operations, financial/operational modules, and Field Update; no admin diagnostics or security administration. |
| Viewer | Standard ERP read-only access, including permitted reports; no create, update, or delete actions. |
| Supervisor | Field Home and Field Update; own operational DPR scope and limited reference data only. |
| Engineer | Field Home and Field Update; own operational DPR scope and limited reference data only. |

Route protection and Firestore rules enforce these boundaries. Hidden navigation is not the security boundary.

## Included v1 capabilities

- Sites, labour, attendance, payroll, salary payments, and advances.
- Materials, inventory, vendors, purchase requests, purchase orders, goods receipts, work orders, contractor bills, and payments.
- Vehicles/equipment, vehicle expense history, assignments, fuel, and maintenance.
- Expenses, invoices, client billing, RA bills, receipts, retention, BOQ, measurements, and variations.
- Daily Progress Reports, field mobile/PWA workflow, local DPR drafts, and the narrow device-local DPR outbox.
- Shared Dashboard, Site Details, Reports, budget/cost control, profitability, health, export, and print views.
- Append-only audit records, Admin backup export, Data Health review, System Health, monitoring, and incident/retention guidance.

## Security, backup, and monitoring baseline

- Firestore retains a default catch-all deny rule after allowlisted collection rules.
- Viewer accounts are read-only; field-only roles do not receive financial, payroll, billing, budget, audit, or admin scope.
- Audit logs and system-health events are protected append-only records; their views are Admin-only.
- Backup & Recovery provides an Admin-only, controlled Firestore JSON export with IDs, supported dates/timestamps, metadata, and credential-like-field redaction. It is not a complete Firebase infrastructure backup and contains no browser restore action.
- System Health provides browser/application signals, not proof of Firebase or internet infrastructure health.

## Deferred plan dependent capabilities

| Capability | Current safe state | Required future activation |
| --- | --- | --- |
| DPR photos / Firebase Storage | Storage is unprovisioned. Submit DPRs without photos. Future-ready source rules/tests are retained. | Supported plan, Storage provisioning, reviewed `storage.rules` deployment, upload/access/delete tests, and real-device Supervisor/Engineer validation. |
| Trusted live User Management | Do not assume callable Functions are deployed. Use Firebase Console plus approved `users/{uid}` role profile process. | Supported plan/backend readiness, Functions deployment, admin-only validation, and role-change tests. |
| Scheduled monitoring cleanup | Retention is policy/review driven; browser clients do not delete monitoring events. | Trusted Admin SDK or scheduled backend with conservative limits, approval, archival, and verification. |
| Managed infrastructure backup/restore | Browser JSON export is a recovery aid only. | Reviewed Firebase/GCP backup strategy, secure storage, controlled restore tooling, and rehearsal. |

These are non-blocking v1 limitations. They do not prevent normal non-photo DPR, operational, financial, reporting, backup-export, or monitoring workflows.

## Rollback reference

- **Frontend regression:** identify the approved last known-good commit or future tag, check it out in a controlled environment, run the quality gate, and deploy Hosting only after approval.
- **Firestore rule regression:** review the exact rules diff and affected role/schema; make the smallest safe correction. Do not blindly restore old rules or broaden access.
- **Data issue:** Git rollback is not a database rollback. Preserve evidence, inspect linked Firestore records, Audit Log, and secure backup, then use controlled remediation. Never bulk restore from the browser.

See [Deployment Guide](DEPLOYMENT_GUIDE.md), [Release Checklist](RELEASE_CHECKLIST.md), [Backup and Disaster Recovery](DISASTER_RECOVERY.md), and [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md).

## Release quality evidence

The Phase 12C local quality gate passed on 2026-09-14:

- `npm test -- --watchAll=false --runInBand`: 49 test suites and 277 tests passed.
- `npx eslint src`: passed with no findings.
- `npm run build`: compiled successfully. The only console warning was Node's non-blocking `DEP0176` deprecation notice for `fs.F_OK`.
- `git diff --check`: passed with no whitespace errors. Git reported only normal Windows LF-to-CRLF conversion notices for modified tracked files.

These checks ran locally against the release working tree. No Firebase, Storage, Functions, Hosting, production-data, commit, push, or tag operation was performed by Phase 12C.
## Tag plan

After the final reviewed commit has been pushed and the working tree is clean, the approved maintainer may create the planned immutable tag:

```powershell
git tag -a v1.0.0 -m "AP Construction ERP v1.0.0"
git push origin v1.0.0
```

Do not rewrite, delete, or force-push the v1.0.0 tag. Later fixes must use new commits and new release tags. Security fixes take priority over cosmetic work.
