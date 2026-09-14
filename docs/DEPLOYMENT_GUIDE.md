# AP Construction ERP Deployment Guide

## Purpose

This guide describes the controlled release process for AP Construction ERP v1.0. It is for an approved maintainer. It is not permission to deploy every Firebase service or to change production data.

**Production project:** `a-p-construction-erp`  
**Production URL:** <https://a-p-construction-erp.web.app>

Use the smallest deployment target that matches a reviewed change. Do not deploy Firebase services merely because their source folders exist.

## Before every release

1. Review the intended change and make sure no secret, backup export, generated cache, or unrelated file is included.
2. Confirm the Firebase project is `a-p-construction-erp`.
3. Run the local quality gate from the repository root:

```powershell
git status
git diff --check
npm test -- --watchAll=false --runInBand
npx eslint src
npm run build
```

4. Resolve genuine failures. Do not weaken tests, rules, or validation merely to obtain a green result.
5. Review the final file list with `git diff --name-only` and stage only reviewed files. Do not use `git add .` by default.

## Select the correct deployment target

| Reviewed change | Approved deployment command | Important condition |
| --- | --- | --- |
| React app, public assets, or Hosting configuration | `firebase deploy --only hosting --project a-p-construction-erp` | Run only after the production build passes. |
| `firestore.rules` | `firebase deploy --only firestore:rules --project a-p-construction-erp` | Review least-privilege impact and role behavior first. |
| Firestore index configuration, if introduced later | `firebase deploy --only firestore:indexes --project a-p-construction-erp` | Deploy only the reviewed index file. |
| `storage.rules` after Firebase Storage is provisioned | `firebase deploy --only storage --project a-p-construction-erp` | Storage and the plan/bucket must be enabled; validate real device access afterward. |
| Cloud Functions after an approved backend rollout | `firebase deploy --only functions --project a-p-construction-erp` | Requires separate plan, backend, security, and live-function review. |

Do **not** run a blanket `firebase deploy`. Do **not** deploy Firestore rules when they did not change. Do **not** deploy Storage while DPR photos remain plan-dependent and Storage is unprovisioned. Do **not** deploy Functions simply because the repository contains callable-function source.

## Standard Hosting release

After the quality gate and source review are complete, an approved maintainer may use:

```powershell
firebase deploy --only hosting --project a-p-construction-erp
```

Then perform a narrow, role-safe smoke check:

1. Open the production URL in a normal browser and confirm the current build loads.
2. Sign in with an approved account and confirm the expected role landing page.
3. Confirm Dashboard, one representative read-only report, and the notification/header shell load.
4. Perform a representative business write only when it is a real approved operational action; never create fake production records for testing.
5. For a Supervisor or Engineer, confirm Field Home and Field Update remain restricted to operational access.
6. As Admin, review System Health for any sanitized application error signals.

## Firestore rules release

Before a rules deployment, test the intended affected role and document shape against the reviewed rule change. Never solve a denial with a broad allow rule.

```powershell
firebase deploy --only firestore:rules --project a-p-construction-erp
```

After deployment, check only the minimum necessary legitimate access paths: unauthenticated denial, admin/manager allowed behavior, viewer read-only behavior, and field-only operational scope where relevant.

## Storage and photo status

Firebase Storage is not provisioned for the current Spark-plan operating state. DPR submission is valid without photos. The repository Storage rules and photo code are future-ready source, not an active production feature.

Do not deploy Storage, claim photo upload works, or require photos for a DPR until all of the following are approved:

- an appropriate Firebase plan and Storage bucket are provisioned;
- the reviewed `storage.rules` change is deployed;
- a real supervisor/engineer upload, permitted read, denied direct delete, and admin/manager cleanup check pass;
- the fallback DPR-without-photos flow remains successful.

## Functions and User Management status

The browser User Management page is admin-only, but trusted callable-function role/status management is deferred until an approved backend deployment is available. Until then, manage Authentication accounts in Firebase Console and maintain the matching active `users/{uid}` profile through the controlled administrative process.

Do not grant browser clients write access to `users`, store passwords in Firestore, or bypass self-role protections.

## Rollback and incident response

For a confirmed frontend-only regression, identify the last known-good Git commit and Hosting release, build and test that revision locally, then deploy **Hosting only** after approval. Do not blindly roll back rules, data, or infrastructure.

For a rules, data-integrity, payroll, inventory, billing, or permission incident, stop unsafe writes and follow [Incident Response Runbook](INCIDENT_RESPONSE_RUNBOOK.md). For backup or restore work, follow [Backup and Disaster Recovery](DISASTER_RECOVERY.md). Neither workflow permits a browser bulk restore.

## Source-control completion

After an approved release is verified:

```powershell
git status
git diff --check
git add <specific-reviewed-files>
git commit -m "<clear change summary>"
git push origin main
git status
```

Verify that the remote branch contains the intended commit. Do not commit `.firebase` generated cache, dependency directories, backup JSON, `.env` files, credentials, or browser exports.

If OneDrive/Git shows `Deletion of directory '.git/objects/...' failed. Should I try again? (y/n)`, answer `n`, then verify Git status, commit, push, and remote state. Do not manually delete Git object files. A separately planned repository move outside OneDrive is the long-term remedy if this recurs.
