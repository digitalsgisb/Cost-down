# Deploy on the AI PC (Windows)

## Install and build

Install Git, Node.js 22 or newer, and the official Google Cloud CLI on the AI PC. Then run PowerShell:

```powershell
git clone https://github.com/digitalsgisb/Cost-down.git
Set-Location Cost-down
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` locally. Set `GOOGLE_CLIENT_ID`, `GOOGLE_SPREADSHEET_ID`, and the bootstrap administrator's Google subject in `DASHBOARD_USERS`, for example:

```dotenv
DASHBOARD_USERS={"YOUR_VERIFIED_GOOGLE_SUB":{"role":"Admin","email":"YOUR_GOOGLE_EMAIL"}}
```

Use the existing client ID and administrator subject from the original PC's private configuration if deploying the same accounts. Do not paste credentials into GitHub. Without an assigned role, Google sign-in returns the verified subject in the role-assignment error; the operator can then assign the bootstrap Admin locally and restart. Admin can subsequently add PIC accounts in the dashboard.

## Authenticate Google Sheets on this PC

The existing Google project uses keyless service-account impersonation. Private JSON keys are blocked by organization policy. Do not change that policy.

The operator's Google account needs Service Account Token Creator on the backend service account. The service account needs Editor access to the database Sheet. Enable Google Sheets API and IAM Service Account Credentials API in the Google project.

Run the helper below. It supports either the bundled CLI under `.tools/google-cloud-sdk` or a Google Cloud CLI installed on PATH:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/google-login.ps1 -ServiceAccount "YOUR_SERVICE_ACCOUNT_EMAIL"
```

Complete Google's interactive login with the authorized account. The helper stores local ADC credentials in ignored `credentials/gcloud` and sets the absolute path in `.env.local`. Authenticate again on the AI PC rather than copying a refresh-token file through GitHub.

For a different project, pass `-ServiceAccount SERVICE_ACCOUNT_EMAIL` to the helper. The account must already have impersonation permission. No OAuth client secret is required by this app.

## Keep access settings when moving PCs

Transfer these files directly through a private channel if preserving existing access and lists:

- `.env.local`: update `GOOGLE_APPLICATION_CREDENTIALS` to the new PC's path using the login helper.
- `data/users.json`: Admin and PIC account assignments, including bound Google subjects.
- `data/catalog.json`, if present: departments, categories and their immutable department codes.
- `data/audit.jsonl`, if preserving historical audit records.

These are deliberately excluded from GitHub. Restrict access on the AI PC and include `data/` in backups. Activity records, monthly actuals and compressed pictures remain in the existing Google Sheet and need no Git transfer. Do not run the original and replacement backend simultaneously: writes are serialized only within one Node process.

## Verify and run

```powershell
npm test
npm run build
node scripts/check-google.mjs
npm start
```

Open **http://localhost:3001** on the AI PC. Click Connect Sheets and sign in with the assigned Admin Google account. The server must stay running. To start it in a hidden background process:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-dashboard.ps1
```

Review `data/server-output.log` and `data/server-error.log`. Check `http://localhost:3001/api/health` for server readiness; `configured: true` confirms settings exist, while `check-google.mjs` checks actual Sheet access. A background process is not an auto-start service; after reboot, run the start script again or configure a Windows startup task under the same Windows account with the project folder as its working directory.

For a new Sheet based on the original template, run `node scripts/prepare-monthly.mjs` once after configuration to reserve the monthly columns. The existing project Sheet has already been prepared. Do not reorder its A:AL columns. After updating for yearly / one-time plans, run `node scripts/prepare-monthly.mjs` to reserve AK:AL and expand the grid if necessary.

## Access from another computer

`localhost` always refers to the computer opening the browser. To use the dashboard from other PCs, configure an HTTPS hostname and reverse proxy on the AI PC, allow the required firewall access, and add that exact HTTPS origin to the Google OAuth client's Authorized JavaScript origins. An arbitrary HTTP LAN IP is not a replacement for the configured localhost Google sign-in origin.

## Update

Stop the running dashboard before updating. Back up `.env.local` and `data/`, then:

```powershell
git pull --ff-only
npm ci
npm test
npm run build
npm start
```

The repository includes source code, dependency lockfile and automated tests. The original Excel archive is retained privately and is not needed when using the existing Google Sheet. It excludes runtime credentials, private access assignments, audit logs, dependencies, generated build files and setup screenshots.
