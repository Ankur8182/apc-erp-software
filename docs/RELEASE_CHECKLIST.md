# AP Construction ERP Release Checklist

Use this checklist for a reviewed v1 release. It does not authorize a deployment by itself.

## Source review

- [ ] `git status` reviewed.
- [ ] Intended files are identified explicitly.
- [ ] No backup export, `.firebase` cache, dependency directory, `.env` file, credential, or personal data is included.
- [ ] `git diff --check` passes.
- [ ] No unreviewed rule, configuration, or financial-calculation change is present.

## Quality gate

- [ ] `npm test -- --watchAll=false --runInBand` passes.
- [ ] `npx eslint src` passes.
- [ ] `npm run build` passes.
- [ ] Build artifacts are current and the production build is reviewed for genuine warnings/errors.

## Security and permissions

- [ ] Authentication and active user-profile behavior are unchanged or deliberately reviewed.
- [ ] Admin, manager, viewer, supervisor, and engineer access impact is reviewed.
- [ ] Any `firestore.rules` change is least-privilege and has a role-specific validation plan.
- [ ] No secrets, tokens, passwords, service-account keys, or personal credentials are committed.
- [ ] Audit-log and data-integrity impact is understood.

## Deployment decision

- [ ] Firebase project is confirmed as `a-p-construction-erp`.
- [ ] Only the required service is selected: Hosting, Firestore rules, indexes, Storage, or Functions.
- [ ] A blanket `firebase deploy` will not be used.
- [ ] Hosting is selected only if the app/build needs release.
- [ ] Firestore rules are selected only if `firestore.rules` changed.
- [ ] Storage is not selected while Storage/DPR photos remain deferred and unprovisioned.
- [ ] Functions are not selected unless a separate approved backend rollout is ready.

## Smoke testing after an approved deployment

- [ ] Production sign-in succeeds for a real authorized account.
- [ ] Role landing page and navigation match the user role.
- [ ] Dashboard and a representative report load.
- [ ] A representative approved operational action is verified without creating fake production data.
- [ ] Field-only users remain restricted to Field Home and Field Update.
- [ ] System Health is reviewed by an Admin for sanitized application errors.
- [ ] Any affected rule, export, PWA, or field workflow is checked with the minimum safe scenario.

## Data protection

- [ ] A current secure backup exists before high-risk data/rule/migration work.
- [ ] No browser bulk restore or destructive cleanup is attempted.
- [ ] Unknown write outcomes are reconciled before retrying.
- [ ] Financial, inventory, payroll, billing, and audit histories are not duplicated or manually rewritten without approval.

## Git completion

- [ ] Specific reviewed files are staged; `git add .` was not used.
- [ ] Commit message describes the actual release.
- [ ] Commit is pushed to the intended remote branch.
- [ ] Remote synchronization is verified.
- [ ] OneDrive Git cleanup prompts were answered safely (`n`) and Git state was checked afterward.

See [Deployment Guide](DEPLOYMENT_GUIDE.md), [Security Audit](SECURITY_AUDIT.md), and [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md).
