# Monitoring Retention Policy

## Scope and current controls

AP Construction ERP stores sanitized browser-reported operational failures in the `systemHealthEvents` Firestore collection. New records contain only `userId`, `userRole`, `category`, `severity`, `code`, `module`, `operation`, and server timestamp. The collection is append-only: active authorized roles can create their own strict enum-shaped records, only Admin can read them, and no client can update or delete them.

System Health reads one timestamp-descending, non-realtime query limited to the newest 100 records. The client throttles an identical user/category/code/module/operation fingerprint for five minutes and accepts at most 40 monitoring writes per browser session. Successful operations are not recorded as monitoring events.

There is currently **no automatic retention, TTL, archive, or cleanup process**. This is intentional: browser-based cleanup would be unsafe and the collection must not become writable/deletable by normal clients.

## Recommended retention schedule

These periods begin at a confirmed server timestamp. They are a review policy, not an automatic deletion policy.

| Severity | Recommended retention | Operational rule |
| --- | ---: | --- |
| `CRITICAL` | 180 days | Preserve longer when linked to a P1/P2 incident, audit evidence, or rollback review. Archive evidence before considering cleanup. |
| `ERROR` | 90 days | Keep long enough for recurrence investigation and release validation. |
| `WARNING` | 30 days | Remove only after confirming it is not part of an active/repeated incident. |
| `INFO` | 7 days | Reserved for low-value diagnostic noise; the current client does not generate normal success telemetry as `INFO`. |
| Missing/invalid timestamp | Manual review | Never treat as automatically eligible. Resolve provenance first. |

The Admin System Health retention review displays candidates only among its current **bounded newest 100-event view**. It is not a collection-wide count, does not query older records, and must not be used as evidence that all eligible records were found.

## Current risk and cost posture

The bounded query and client throttling keep normal monitoring read/write volume low. However, immutable records can grow indefinitely across browsers and sessions because client-side throttling is not a global server-side rate limit. The collection is currently appropriate for operational troubleshooting, but indefinite growth creates long-term Firestore cost, privacy, and review burden.

Monitoring events are client-generated diagnostics, not independently verified incidents. Treat an event as a lead: corroborate it with reproducibility, affected users, Firestore/Firebase Console signals, audit history, and deployment history before classifying an incident.

## Prohibited cleanup patterns

Never:

- add a System Health “Delete all” button;
- grant client delete/update access to `systemHealthEvents`;
- run a browser `deleteDoc`, batch delete, or unbounded query against monitoring history;
- delete records tied to an active incident before evidence has been exported and reviewed;
- copy raw browser console output, credentials, financial details, or user-entered data into monitoring notes.

Monitoring history is intentionally excluded from the normal browser backup export. Material incident evidence therefore needs a separately controlled archive before a trusted cleanup operation.

## Future trusted cleanup design

Use one of these separately reviewed approaches only:

1. **Admin SDK one-time script** run by an approved maintainer in a controlled environment.
2. **Scheduled Cloud Function** only after a separate Blaze/least-privilege design and deployment review.

A trusted cleanup tool must support all of the following:

- dry-run as the default;
- explicit `before` timestamp and severity criteria;
- a conservative maximum deletion limit (for example, 200 records per approved run);
- output of document IDs, severity, timestamp, and reason without exposing secrets;
- a mandatory check that records are not related to open/investigating incidents;
- export/archive of material incident evidence before deletion;
- explicit human approval before a non-dry run;
- separate operational logging outside the records being deleted.

Do not implement or run such a tool in the browser. On the current plan, manual Admin SDK review/export is the safe option. A scheduled cleanup function is a future reliability improvement and is not required for normal ERP operation.

## Review cadence

- Review System Health after a P1/P2 incident and after a production release with unexpected errors.
- Review retention candidates monthly while event volume is low; move to a documented recurring trusted cleanup process only after approval.
- Review this policy quarterly, after role/rule changes, and before enabling any backend cleanup.

## Privacy requirements

Long-term monitoring data must remain limited to the existing safe metadata. Never add raw error messages, stacks, form payloads, Aadhaar, payroll/payment details, tokens, authorization headers, passwords, bank details, or Firebase credentials. If a legacy record contains unexpected fields, System Health discards them before display; do not export those fields into incident notes.