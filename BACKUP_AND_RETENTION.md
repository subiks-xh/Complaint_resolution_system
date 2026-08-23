# Backup & Data Retention Strategy

## Scope

This document defines operational backup and retention policies for:

- MongoDB operational data
- Uploaded files/attachments
- Application logs and audit logs

## Backup Strategy

### 1) Database Backups (MongoDB)

- **Full backup frequency:** Daily (off-peak hours)
- **Incremental/oplog backup:** Every 4 hours (if supported by deployment)
- **Retention tiers:**
  - Daily backups: 14 days
  - Weekly backups: 8 weeks
  - Monthly backups: 12 months
- **Encryption:** Backup archives must be encrypted at rest.
- **Verification:** Weekly restore drill on a staging environment.

### 2) Attachments Backups

- **Cloud storage:** Versioning enabled for attachment bucket/container.
- **Snapshot frequency:** Daily snapshot of attachment metadata + object list.
- **Retention:**
  - Current + previous versions for 90 days
  - Monthly archive for 12 months

### 3) Logs and Audit Logs

- **Application logs:** Keep hot logs for 30 days.
- **Audit logs:** Keep for 180 days minimum (extendable by compliance needs).
- **Archival:** Export monthly compressed archives to low-cost storage.

## Restore Procedure (High Level)

1. Restore MongoDB from latest known-good backup.
2. Rehydrate attachments from object storage snapshot/version history.
3. Restore audit logs archive if timeline analysis is required.
4. Validate service health using `/api/health` and admin dashboard checks.

## RPO / RTO Targets

- **RPO (data loss):** <= 4 hours
- **RTO (service restore):** <= 2 hours

## Data Retention Policy

### Core Records

- Users, complaints, assignments, feedback: retained while account/org is active.
- Soft-deleted records retained for 90 days before purge workflow.

### Attachments

- Active complaint attachments retained with complaint lifecycle.
- Closed/resolved complaint attachments eligible for archival after 180 days.

### Audit & Access Logs

- Audit logs retained for minimum 180 days.
- Access logs retained for 30 days hot + 180 days cold archive.

## Operational Ownership

- **Primary owner:** Platform Admin / DevOps
- **Review cadence:** Quarterly policy review
- **Exception handling:** Documented by org admin with approval

## Implementation Notes

- Production automation should use scheduled jobs and managed backup tooling.
- Any retention changes must be reflected in this document and release notes.
