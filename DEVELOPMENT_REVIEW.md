# Development review

The original five-module React layout and Excel archive are retained. The runtime database has been migrated to Google Sheets with an Express backend and Google Identity Services sign-in. The app uses server-side ADC authentication and supports service-account impersonation.

Implemented Admin account management, multiple departments per PIC, editable department/category display names with stable internal keys, automatic activity IDs, optional compressed pictures, AREA, Jan-Dec actual savings, reporting-year separation and annual plans from the project start month through December. Admin and activity owners can edit activities subject to backend permissions.

The Sheets adapter validates headers, preserves formula columns M:N, uses RAW writes, detects duplicate/stale rows and enforces the template capacity. Audit logging, role validation, direct-actual savings normalization and serialized single-process writes remain in place.

Public repository contents exclude credentials, environment configuration, runtime user assignments, catalog state, audit records and setup screenshots. See DEPLOYMENT.md for private configuration and AI PC setup.

Verification at publication: Node/API authorization and schema tests, Chrome workflow/mobile/sign-in tests and production build. Automated Google calls are mocked. Each deployment must configure its own Google credentials and verify live access.

Known boundaries: single backend process; direct Sheet editors can bypass app workflow; local access settings and audit require persistent storage; Google tokens expire; LAN access needs HTTPS and an authorized OAuth origin. The original archive needs extended monthly headers before use as a new database.

The separate Verification module and HOD/Finance approval fields have been removed. Actual savings entered by PIC/Admin feed KPIs directly. Existing verification columns remain as derived mirrors to preserve workbook structure; legacy status values cannot suppress actual totals.
