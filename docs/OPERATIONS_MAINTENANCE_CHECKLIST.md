# AP Construction ERP Operations Maintenance Checklist

Use this checklist as an operating routine. It does not automate actions or authorize data changes.

## Daily

- [ ] Confirm any failed operational action before retrying it; never assume an interrupted write failed.
- [ ] When an issue is reported, have an Admin review System Health and record only safe diagnostic details.
- [ ] Review critical notifications, DPR outbox attention items, and field-user pending-status messages.
- [ ] Verify urgent procurement, inventory, payroll, billing, vehicle, and site exceptions against their source records.
- [ ] Ensure field users know a DPR can be submitted without photos while Storage remains unavailable.

## Weekly

- [ ] Review recent sanitized monitoring events and unresolved incidents.
- [ ] Verify a recent Firestore JSON backup exists in an approved encrypted, access-controlled location.
- [ ] Review open procurement, GRN, contractor, inventory, payroll, vehicle maintenance, and client-billing exceptions.
- [ ] Review active sites, material availability, and field DPR pending/failed entries.
- [ ] Review any recurring permission-denied or offline-sync issue before changing roles, rules, or data.

## Monthly

- [ ] Create and securely retain a fresh Admin-only Firestore JSON export.
- [ ] Review user access, inactive accounts, and whether each active role remains appropriate.
- [ ] Review Data Health & Migration candidates without performing browser-side cleanup.
- [ ] Reconcile significant site financial, inventory, payroll, billing, and vehicle results with approved business records.
- [ ] Review Firestore usage/cost, monitoring-retention candidates, and all plan-dependent limitations.
- [ ] Review whether any deferred backend, Storage, backup, or monitoring feature has a separately approved implementation plan.

## When preparing a change or release

Use [Release Checklist](RELEASE_CHECKLIST.md), [Deployment Guide](DEPLOYMENT_GUIDE.md), and [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md). Do not deploy, bulk restore, or alter production data as a routine maintenance action.
