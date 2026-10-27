# Company-Wide Cost Down Dashboard V2

React, Tailwind CSS, Recharts and Node.js/Express dashboard using Google Sheets as the activity database.

## Deploy on an AI PC

See [DEPLOYMENT.md](DEPLOYMENT.md) for Windows installation, Google authentication, administrator setup, private access-settings transfer, startup and updates.

```powershell
git clone https://github.com/digitalsgisb/Cost-down.git
Set-Location Cost-down
npm ci
Copy-Item .env.example .env.local
# Configure .env.local privately, following DEPLOYMENT.md.
npm run build
npm start
```

Requires Node.js 22+. Open http://localhost:3001. Keep the Node server running. For development, run `npm run dev` and open http://localhost:5173. Never commit `.env.local`, credentials or runtime data.

## Modules

- Management Overview: annual plan, Finance-verified savings, achievement, gap, monthly chart and department scorecard.
- Department Explorer: department comparison and initiative register.
- PIC Activity Management: plans, monthly actual savings, dates, area, optional picture, progress and evidence.
- Finance Savings Verification: PIC-reported versus verified amounts and approval workflow.
- Progress Monitoring: overdue, high-priority, status and next-action tracking.
- Admin: add PIC accounts, assign multiple departments, disable access, add departments/categories, edit display names and create/edit activities.

## Roles

Bootstrap administrators are configured privately in `DASHBOARD_USERS`, keyed by verified Google subject IDs. Google ID tokens are validated server-side for audience, signature, issuer, expiry and verified email. An Admin can invite PICs by Google email; their first verified sign-in binds the invitation to their immutable subject ID. PICs edit activities matching their owner name and assigned departments. HOD handles department approval; Finance handles savings verification; Management is read-only.

Admin and PIC activity changes reset HOD/Finance approval and verified savings. Finance verification requires HOD approval and an HTTPS evidence link. Only Finance-verified savings count toward realized-savings KPIs. Activity IDs and reporting years remain fixed on edit.

## Activity IDs and monthly savings

New activity IDs are assigned on save: `YYMMCCnn`, using the Malaysian creation month, department code and next available sequence. The department codes shipped with the app are RF, CV, QM, RD, MM, MT, DT and OS. Admin can add departments with unique two-letter codes. Existing IDs are preserved.

Enter Planned Saving (RM / month), Reporting Year, Start Date and actual amounts for Jan-Dec. Annual plan counts the project start month through December. For example, September start and RM1,000/month gives RM4,000 annual plan. Actual amounts before the start month are excluded; blank means unreported and zero means no savings. The year selector separates reporting years. Create a new activity for another year. Finance verification remains a cumulative annual amount.

## Google Sheets schema

Use the Activities tab with headers on row 4 and activity rows 5:204 (200 records). Do not insert, reorder or remove database columns.

| Columns | Contents |
| --- | --- |
| A:I | Activity ID, Department, Initiative / Cost Down Item, Category, PIC, Priority, Status, Start Date, Target Date |
| J:L | Plan Saving (RM), PIC Actual (RM), Finance Verified (RM) |
| M:N | Saving Gap (RM), Achievement % (template formulas, preserved) |
| O:T | Progress %, HOD Approval, Finance Approval, Last Update, Issue / Next Action, Evidence Link |
| U:V | Activity Image, Area |
| W:X | Planned Saving Monthly (RM), Reporting Year |
| Y:AJ | Jan Actual Saving (RM) through Dec Actual Saving (RM) |

J and K contain the annual plan and cumulative PIC actual on save. The adapter derives current totals from monthly fields on read. Existing legacy annual records remain readable. PIC must allocate legacy actual totals to the correct months when converting a record; the app does not guess a month.

The original Excel archive is retained privately and is not required for this deployment. Use your existing prepared Google Sheet. For a new database, create an Activities tab with the exact A:T headers listed above, then run `node scripts/prepare-monthly.mjs` to validate columns and create the extended monthly headers.

Pictures are optional: one JPEG, PNG or WebP up to 10 MB source size. A compressed JPEG copy of at most 45,000 characters is stored in column U and displayed as a thumbnail with an enlarged preview. Source originals are not retained.

## Persistence and deployment limits

Activity records live in Google Sheets. Account assignments and catalog settings live in ignored `data/users.json` and `data/catalog.json`; audit attempts/results are appended to `data/audit.jsonl`. Back up this directory securely. Display-name edits preserve internal names and department codes, keeping historical activities and PIC access linked.

Run one backend process. Writes are serialized and checked against fresh row fingerprints; stale changes return 409. Google Sheets is not transactional: simultaneous direct Sheet edits can bypass permissions and race app writes. Multiple backend replicas need shared locking and centralized audit. Refresh after an ambiguous save failure before retrying.

The app defaults to clearly marked demo data until Google sign-in and database loading succeed. Demo edits are session-only. Refresh Sheets reloads live data; there is no automatic polling. Deploy behind HTTPS for access from other PCs and register the exact origin with Google.

## Verify

```powershell
npm test
npm run build
npm run test:e2e
node scripts/check-google.mjs
```

Browser tests require Google Chrome. Automated tests mock Google identity and transport; `check-google.mjs` checks actual read access using private local configuration. Its optional `--verify-write` echoes the validated existing headers and does not create activity data.

Public health/config endpoints expose readiness and the public Google client ID, not credentials or account assignments.
