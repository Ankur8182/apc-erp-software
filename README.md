# AP Construction ERP

AP Construction ERP is a React and Firebase construction-management application for site operations, procurement, inventory, labour and payroll, vehicles, client billing, BOQ/measurement, Daily Progress Reports, reports, audit history, backup export, and operational monitoring.

**Production:** <https://a-p-construction-erp.web.app>
**Firebase project:** `a-p-construction-erp`

## Documentation

Start with [docs/AP_CONSTRUCTION_ERP_OPERATING_GUIDE.md](docs/AP_CONSTRUCTION_ERP_OPERATING_GUIDE.md). The full documentation index is at [docs/README.md](docs/README.md).

## Local development

Install dependencies from the project root with the committed lockfile, then run:

```powershell
npm ci
npm start
```

The local development app is normally available at <http://localhost:3000>.

## Safe quality checks

```powershell
git status
git diff --check
npm test -- --watchAll=false --runInBand
npx eslint src
npm run build
```

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) before any release. Review and stage specific files; do not use `git add .` by default.

## Architecture

- React with React Router and responsive/PWA app-shell behavior
- Firebase Authentication for email/password sign-in
- Cloud Firestore for role-protected ERP data
- Firebase Hosting for the production single-page application

The application supports `admin`, `manager`, `viewer`, `supervisor`, and `engineer` roles. Firestore rules and route protection enforce permissions; hidden navigation alone is never the security boundary.

## Current plan-dependent limitations

- Firebase Storage is not provisioned for the current Spark-plan operating state. DPR submission works without photos; photo upload is deferred.
- Trusted Cloud Functions-based in-app User Management is deferred. Use the approved Firebase Console plus matching `users/{uid}` role-profile process.
- Browser backup export is a controlled Firestore data export, not a full Firebase infrastructure backup or browser restore tool.

Do not add passwords, tokens, service-account keys, `.env` files, backup exports, or personal credentials to source control.
