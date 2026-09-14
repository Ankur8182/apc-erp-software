# System Health Runbook

## What this page means

**System Health** is an Admin-only view of the newest 100 sanitized client-side monitoring events. It helps identify recent ERP application failures. It does **not** prove that Firebase, Google Cloud, Hosting, or the internet is healthy.

## Status meanings

- **HEALTHY** — the loaded recent client events did not meet the configured warning/error threshold. It is not an infrastructure guarantee.
- **DEGRADED** — at least three errors or five warnings were observed in the last 24 hours. Review the event category, module, and time.
- **ATTENTION REQUIRED** — a recent application crash was observed, the browser is offline, or monitoring history could not be loaded. Resolve the visible load issue before treating counts as reliable.

## Safe investigation steps

1. Sign in as an active Admin and open **System Health**.
2. Refresh once; the page deliberately performs one bounded query, not a live history listener.
3. Filter by category/severity and inspect the safe module, operation, code, and timestamp.
4. Retry a failed user operation only after checking its normal ERP validation message and network connection.
5. Check Firebase Console when permission, unavailable, deadline, or repeated write/read errors persist.
6. Escalate recurring application crashes or repeated failed writes with the safe event details and time range.

## Controlled production smoke check

After the reviewed Hosting release is approved, perform only these non-destructive checks:

1. As an active Admin, open **System Health** and confirm the recent-events view loads. This is one bounded read and does not change ERP business data.
2. As a Manager, Viewer, Supervisor, or Engineer, manually enter `/system-health`. The route must redirect to that role's permitted landing page; no monitoring history should load.
3. In a signed-out private browser window, enter `/system-health`. The route must return to sign-in.
4. If a safe connection check is needed, briefly disconnect during a read-only screen refresh. Do not submit a form or create/edit ERP data. Reconnect and confirm normal reading recovers.

Record only the role, time, visible safe status, and whether the expected redirect/load state occurred. Do not change user roles merely to perform this check.

## What not to share

Do not copy browser console output, raw stack traces, tokens, passwords, payment details, Aadhaar values, payroll data, full form values, or screenshots containing them. System Health intentionally stores and displays only sanitized metadata.

## Coverage and retention

Monitoring is browser-side and records only attempted failures after a signed-in active role is known. It cannot observe backend outages when no browser is running, and it is not a security audit trail. Repeated identical events are throttled for five minutes and the client accepts at most 40 monitoring writes per session.

Do not delete monitoring events from the client. Review a retention policy later: retain recent operational events for a defined period, archive material incidents, and use a trusted backend process for any future cleanup.
