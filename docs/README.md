# AP Construction ERP Documentation Index

## Start here

- [AP Construction ERP Operating Guide](AP_CONSTRUCTION_ERP_OPERATING_GUIDE.md) - primary handbook for owners, Admins, managers, field users, and maintainers.
- [Release Notes v1](RELEASE_NOTES_V1.md) - product-level summary of the v1 release.
- [Security and Permission Audit](SECURITY_AUDIT.md) - active role boundary and deferred backend/photo-service position.

## Operating and maintenance

- [Operations Maintenance Checklist](OPERATIONS_MAINTENANCE_CHECKLIST.md) - daily, weekly, and monthly controls.
- [System Health Runbook](SYSTEM_HEALTH_RUNBOOK.md) - how to interpret the Admin-only System Health page.
- [Monitoring Retention Policy](MONITORING_RETENTION_POLICY.md) - review-led retention and future trusted-cleanup policy.
- [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md) - severity model and safe incident lifecycle.
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) - safe first checks and escalation points.

## Deployment and release

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - quality gate, selective Firebase deployment, smoke checks, and Git process.
- [Release Checklist](RELEASE_CHECKLIST.md) - pre-release and post-release checklist.

## Data protection and recovery

- [Backup and Disaster Recovery](DISASTER_RECOVERY.md) - Admin-only Firestore JSON export, recovery precautions, and limits.
- [Data Health and Safe Migration](DATA_MIGRATION.md) - review-only legacy/duplicate candidate process.

## Current plan-dependent features

- DPR photo upload is deferred because Firebase Storage is not provisioned. DPR submission remains supported without photos.
- Trusted Cloud Functions-based in-app User Management is deferred. Use the controlled Firebase Console and `users/{uid}` profile process instead.
- Automated monitoring cleanup and comprehensive managed backup/restore are future trusted-backend work.

Do not put passwords, tokens, service-account keys, full backup files, or private user data in documentation or source control.
