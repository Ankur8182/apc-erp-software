# Security and Permission Audit

## Current authorization boundary

Cloud Firestore rules are the live data authorization boundary for AP Construction ERP. React route guards and sidebar visibility are defense in depth only; they do not replace Firestore rules. Firebase Storage is not provisioned for the current Spark-plan deployment, so DPR photo upload is unavailable and no live Storage data boundary is currently in use.

An account is authorized only when Firebase Authentication is present and its own Firestore profile has `active: true` with one of these roles: `admin`, `manager`, `viewer`, `supervisor`, or `engineer`. A missing, inactive, or unknown profile fails closed.

| Role | Route access | Live Firestore access |
| --- | --- | --- |
| Admin | Full ERP plus Audit Log, System Health, Backup & Recovery, Data Health & Migration, and User Management page | Authorized ERP data; immutable audit-log read; protected own user profile read |
| Manager | Standard ERP and operational field entry | Authorized ERP read/write according to collection rules; no admin-only diagnostics, backups, or browser user administration |
| Viewer | Standard ERP routes in read-only mode | Authorized ERP reads; no mutations |
| Supervisor / Engineer | Field Dashboard and Field Update only | Own DPR records plus operational site, stock-availability, and vehicle reference data only |

## Active hardening controls

- Legacy top-level collections use root-document matches. New or unexpected subcollections reach the default-deny rule instead of inheriting parent authorization.
- Field-user DPR creation is limited to the allowlisted operational payload produced by Field Update and the offline DPR synchronizer. It validates required text, ISO-style date shape, non-negative quantity/manpower/optional usage, bounded strings, server timestamps, creator UID, upload-list size, and the optional stable submission ID.
- Field pages subscribe only to own DPRs plus `sites`, `inventoryItems`, and `vehicles`. They do not subscribe to financial alerts or commercial collections for field-only roles.
- Browser clients can read only their own `users/{uid}` profile. Browser list/create/update/delete access to user profiles is denied.
- Audit Logs are admin-read and append-only. Actor, role, and timestamp fields are validated. Backup export is admin-route/UI guarded and uses ordinary collection reads, so it cannot bypass Firestore rules.

## Deferred plan dependent services

### Firebase Storage and DPR photos

The repository contains future-ready `storage.rules` and DPR photo-validation code. They are not active until Firebase Storage is provisioned, the project plan and bucket are configured as required, and the reviewed Storage rules are deployed.

Current safe behavior is intentional: when Storage is unavailable, Field Update explains that photos cannot be uploaded and submits the DPR without photo metadata. Field users must continue to submit operational DPRs without photos. Do not claim photo evidence exists unless the DPR record actually contains valid photo metadata after future Storage activation.

When Storage is enabled in a future approved change, validate upload, read, and deletion behavior with real least-privilege accounts before relying on photo evidence. The source rules restrict new field uploads to the user-owned DPR path and reserve deletion for admin/manager users.

### In app User Management backend

The repository contains secured callable-function source for listing and updating ERP user profiles, including active-admin checks and self-change prevention. That backend is not a current live dependency and in-app role management is deferred until the required Firebase plan/backend deployment is approved and verified.

Until then, use the Firebase Console to create or manage Authentication accounts and maintain the matching `users/{uid}` Firestore profile through the approved administrative process. Never replace this fallback with browser writes to `users`, and never store passwords in Firestore.

### Trusted scheduled monitoring cleanup

Monitoring retention is currently policy and review driven. Browser clients do not delete monitoring events. Any automated cleanup requires a separately reviewed trusted backend or Admin SDK design and is not active.

## Important limitations

- A browser-originated audit event is append-only but is not cryptographically non-repudiable. A trusted Admin SDK or deployed Cloud Function would be required to guarantee audit creation as part of every privileged business transaction.
- The Firebase web configuration in `src/firebase.js` identifies the public web app. It is not a service-account credential. Security relies on Firebase Authentication, Firestore rules, controlled backend credentials where used, and future Storage rules only after Storage is provisioned.
- This repository has no configured Firestore Rules Emulator test harness. The rules are statically reviewed and source-tested. Add emulator tests before a major future rule redesign and test approved admin, manager, viewer, supervisor, and engineer accounts against deployed rules.

## Deployment note

Do not deploy Firebase services merely because a source file exists. Review the exact diff and deploy only the service whose approved configuration changed. In the current Spark-plan state, do not deploy Storage for the deferred photo feature. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for the standard release procedure.
