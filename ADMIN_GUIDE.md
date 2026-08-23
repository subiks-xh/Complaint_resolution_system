# Admin Guide

## 1. Admin Scope

Admins can manage complaints, staff assignments, analytics, reports, notifications, and system-level operational visibility.

## 2. Complaint Operations

- View all complaints from admin complaint management.
- Assign/reassign/escalate/close complaints.
- Use filters by date, status, priority, and category.

## 3. Staff Operations

- Activate/deactivate staff accounts.
- Update specialization and capacity.
- Review performance and feedback.

## 4. Reports and Exports

- Open admin reports for summary analytics.
- Export via `/api/admin/reports/export` with:
  - `format=json`
  - `format=csv`
  - `format=pdf`

## 5. Import Operations

- Use bulk import endpoints for users/categories/complaints.
- Payload supports CSV text or rows array.

## 6. Audit Logs

- Open `/api/admin/audit-log`.
- Use pagination and date filters.
- Tracks mutating API actions (POST/PUT/PATCH/DELETE).

## 7. Security and Operations

- CSRF protections and rate limits are enabled.
- Sentry and structured logging are integrated.
- Review health endpoints:
  - `/api/health`
  - `/api/health/detailed`
  - `/api/admin/system/health`
