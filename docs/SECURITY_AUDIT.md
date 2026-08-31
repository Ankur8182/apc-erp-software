# Security and permission audit

## Authorization boundary

Cloud Firestore and Storage rules are the data authorization boundary. The React route guards and sidebar are defense-in-depth only; no field-only route fetches financial collections and direct URLs are guarded by the active role from `users/{uid}`.

An account is authorized only when Firebase Authentication is present and its own Firestore profile has `active: true` with one of: `admin`, `manager`, `viewer`, `supervisor`, or `engineer`. A missing, inactive, or unknown profile fails closed.

| Role | Route access | Firestore access |
| --- | --- | --- |
| Admin | Full ERP plus Audit Log, User Management, and Backup & Recovery | Authorized ERP data; immutable audit-log read; admin-only profile management through the secured callable backend |
| Manager | Standard ERP and operational field entry | Authorized ERP read/write according to collection rules; no audit-log, backup, or user-management administration |
| Viewer | Standard ERP read-only routes | Authorized ERP read-only; no mutations |
| Supervisor / Engineer | Field Dashboard and Field Update only | Own DPR records, operational site references, stock availability, and vehicle references only |

## Phase 9B hardening

- Replaced recursive rule matches for legacy top-level collections with root-document matches. New or unexpected subcollections now reach the default-deny rule rather than inheriting parent authorization.
- Restricted field-user DPR creation to the allowlisted operational payload produced by Field Update and the offline DPR synchronizer. It validates required text, ISO-style date shape, non-negative quantity/manpower/optional usage, bounded strings, server timestamps, creator UID, upload-list size, and the optional stable submission ID.
- Confirmed field pages subscribe only to own DPRs plus `sites`, `inventoryItems`, and `vehicles`; financial alerts and all commercial collections are not subscribed for field-only roles.
- Confirmed client profiles are self-read only. All `users` list/create/update/delete operations are denied to browser clients.
- Confirmed Audit Logs are admin-read, append-only, and actor/role/timestamp validated. Backup export is admin-route/UI guarded and uses ordinary collection reads, so it cannot bypass Firestore rules.

## Important limitations

- A browser-originated audit event is append-only but is not cryptographically non-repudiable. A trusted Admin SDK or Cloud Function is required to guarantee audit creation as part of every privileged business transaction.
- The existing User Management callable functions already enforce an active admin Firestore profile and prevent self-role/status changes. They must be deployed and monitored as trusted backend code; do not replace them with browser writes to `users`.
- The Firebase web configuration in `src/firebase.js` identifies the public web app. It is not a service-account credential. Security relies on Firebase Authentication, Firestore rules, Storage rules, App Check where enabled, and restricted backend credentials.
- Storage photo paths are isolated by authenticated UID and restricted image type/size. Storage rules cannot count or verify every Firestore photo-metadata map before a DPR is created; the DPR document caps its metadata list and field users may access only their own Storage namespace.
- This repository has no configured Firestore Rules Emulator test harness. The rules were statically reviewed and source-tested; add emulator tests before any major future rule redesign and test an approved admin/manager/viewer/supervisor/engineer account against the deployed rules.

## Deployment note

Phase 9B changes `firestore.rules` only. Do not deploy automatically. After review, deploy the rules with:

```powershell
firebase deploy --only firestore:rules
```

No Storage-rules deployment is required for Phase 9B.