# AP Construction ERP v1 Release Notes

## AP Construction ERP v1.0

AP Construction ERP v1.0 is the production construction-management release for A P CONSTRUCTION. It brings operational site work, controlled financial visibility, field DPR capture, and administrative safeguards into one role-protected ERP.

## Major capabilities

- **Multi-role access:** Admin, Manager, Viewer, Supervisor, and Engineer roles with route protection and Firestore authorization.
- **Site management:** Site register, Site Details, operational progress, site budgets, and shared financial/project visibility for permitted roles.
- **Labour and payroll:** Labour master, site-aware attendance, payroll, payments, advances, pending salary, and workforce reporting.
- **Materials and inventory:** Material records, site stock, stock in/out/adjustment history, minimum stock alerts, and procurement links.
- **Procurement and vendors:** Vendors, Purchase Requests, Purchase Orders, Goods Receipts, Work Orders, contractor bills, and payment history.
- **Vehicle and equipment control:** Vehicle register, assignments, fuel/expense history, maintenance/breakdown records, and related reporting.
- **Client billing:** Client/billing profiles, RA bills, controlled receipts, retention handling, invoice linkage, outstanding visibility, and billing reports.
- **BOQ and measurement:** BOQ items, measurements, variations, certified/billed progress, and site/project analytics.
- **DPR field workflow:** Mobile-oriented Field Home and Field Update, local drafts, duplicate-submit prevention, a narrow local DPR outbox, reconnection guidance, and management visibility of confirmed DPRs.
- **Financial analytics:** Shared canonical income, cost, budget, profitability, receivable, project-health, and BOQ progress calculations in Dashboard, Reports, and Site Details.
- **Reports and exports:** Filtered financial, operational, inventory, procurement, payroll, vehicle, BOQ, DPR, billing, and analytics reports with PDF, CSV, and Print support where provided.
- **Traceability:** Append-only audit logging for supported important ERP actions and Admin-only audit-log review.
- **Recovery and data health:** Admin-only controlled Firestore JSON export, documentation-led recovery precautions, and read-only legacy/data-health review.
- **Monitoring and incident operations:** Admin-only System Health, sanitized browser monitoring events, incident response guidance, and monitoring retention policy.
- **Mobile/PWA support:** AP Construction branding, responsive field interfaces, web-app manifest, and application-shell caching.

## Security and data integrity posture

- Firebase Authentication plus active Firestore role profiles determine access.
- Firestore rules, not menu hiding, are the data access boundary.
- Viewer users remain read-only; Supervisor/Engineer roles remain operational-field-only.
- Shared calculation utilities prevent duplicate counting across payroll/attendance, receipts/revenue, inventory/procurement, vehicle costs, contractor payments, and DPR operational data.
- Exports apply active filters and CSV output has formula-injection protection.
- Backup export preserves supported document IDs/dates/metadata but deliberately does not provide a browser restore or full Firebase infrastructure backup.

## Deferred and plan-dependent capabilities

- **DPR photo upload:** Firebase Storage is not provisioned for the current Spark-plan environment. Field users should submit DPRs without photos. Future activation requires Storage provisioning, reviewed Storage rules, and real-device access tests.
- **Trusted in-app User Management backend:** callable backend source exists, but live Cloud Functions-based role/status management is deferred until an approved backend rollout. The safe fallback is Firebase Console plus the controlled matching `users/{uid}` profile process.
- **Automated monitoring cleanup:** retention is currently review/policy driven. A trusted scheduled backend is future work.
- **Managed Firebase backup/restore:** the browser JSON export is a recovery aid, not a managed backup or bulk-restore system.

These limitations do not prevent normal non-photo DPR, financial, operational, reporting, monitoring, or backup-export workflows.

## Where to start

Read the [AP Construction ERP Operating Guide](AP_CONSTRUCTION_ERP_OPERATING_GUIDE.md) for daily operation, then use the [Documentation Index](README.md) for deployment, recovery, troubleshooting, and specialist runbooks.
