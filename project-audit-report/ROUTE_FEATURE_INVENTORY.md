# Route and Feature Inventory

**Project:** Generic Complaint Resolution and Escalation System (CRS)
**Location:** `d:/complaint-resolution-system`
**Audit Date:** 2026-10-12
**Scope:** Master Full Application Acceptance Audit (Frontend & Backend Complete Inventory)

---

## 1. Frontend Route Inventory

### A. Public Routes (Accessible without Authentication)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/` | `Home.jsx` | Public (`Guest / Any`) | Hero banner, value propositions, feature highlights, quick login/register CTAs, responsive layout. | Static / Client-side routing |
| `/login` | `Login.jsx` | Public (`Guest`) | Email/password login form, Google OAuth trigger button, "Forgot Password" link, validation, redirect on success. | `POST /api/auth/login`, `POST /api/auth/google` |
| `/register` | `Register.jsx` | Public (`Guest`) | User registration form (name, email, password, phone, organization selection or join code), validation. | `POST /api/auth/register`, `GET /api/categories`, `POST /api/auth/register-org` |
| `/forgot-password` | `ForgotPassword.jsx` | Public (`Guest`) | Password reset request form, sends reset link to user email. | `POST /api/auth/forgot-password` |
| `/reset-password/:token` | `ResetPassword.jsx` | Public (`Guest`) | Password reset token consumer form, password confirmation, submit new password. | `POST /api/auth/reset-password/:token` |
| `/unauthorized` | `Unauthorized.jsx` | Public / Role fallback | Access denied alert page, back to safe dashboard CTA. | Client-side routing |
| `/about` | `About.jsx` | Public (`Guest / Any`) | Project description, architecture overview, institutional information. | Static content |
| `/features` | `Features.jsx` | Public (`Guest / Any`) | Feature breakdown (SLA, Rule assignment, Escalations, Payments, Audit logs). | Static content |
| `/support` | `Support.jsx` | Public (`Guest / Any`) | FAQ accordion, contact forms, support contact channels. | Static content / Client interactions |
| `/privacy` | `Privacy.jsx` | Public (`Guest / Any`) | Privacy policy documentation, GDPR/compliance statements. | Static content |
| `/terms` | `Terms.jsx` | Public (`Guest / Any`) | Terms of service and platform conditions. | Static content |
| `/404` | `NotFound.jsx` | Public (`Any`) | 404 error page with navigation return button. | Catch-all redirect (`*`) |

---

### B. Common Authenticated Routes (Any Authenticated Role)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/onboarding` | `GoogleOnboarding.jsx` | `PrivateRoute` (Authenticated) | First-time Google user onboarding to select or link organization and profile data. | `POST /api/auth/google/onboarding` |
| `/dashboard` | `Dashboard.jsx` (Switch) | `PrivateRoute` (Authenticated) | Role dispatcher dynamically loading `UserDashboard`, `StaffDashboard`, or `AdminDashboard`. | Role-branched to respective dashboard APIs |
| `/profile` | `Profile.jsx` | `PrivateRoute` (Authenticated) | User profile details, avatar upload/delete, phone, department, notification preferences (inApp, email, complaintUpdates, escalationAlerts). | `GET /api/users/profile`, `PUT /api/users/profile`, `PUT /api/users/profile/avatar`, `GET /api/users/notification-preferences`, `PUT /api/users/notification-preferences` |
| `/complaints/:id` | `ComplaintDetails.jsx` | `PrivateRoute` (Owner, Staff, Admin) | Complete complaint timeline, status, category, priority, attachments viewer, work timer live display, feedback submission (if resolved). | `GET /api/complaints/:id`, `GET /api/complaints/:id/timeline`, `POST /api/feedback`, `POST /api/complaints/:id/attachments` |

---

### C. Complainant / Regular User Routes (`role: user`)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/complaints` | `ComplaintList.jsx` | `RoleBasedRoute (user)` | User's complaint list, search by title/ID, filter by status, priority, category, pagination, link to complaint details. | `GET /api/complaints/my-complaints`, `GET /api/complaints/my-stats` |
| `/complaints/new` | `ComplaintForm.jsx` | `RoleBasedRoute (user)` | Complaint creation form with title, category selector, priority, detailed description, multiple file upload (Cloudinary/local fallback). | `GET /api/categories`, `POST /api/complaints` |
| `/payments/my-payments` | `PaymentCenter.jsx` | `RoleBasedRoute (user, admin, org_admin, super_admin)` | User's transactions view, initiate payment for priority/expedited resolution, demo/Razorpay checkout, receipt view. | `GET /api/payments/my-payments`, `POST /api/payments/complaints/:id/initiate`, `POST /api/payments/:paymentId/confirm`, `GET /api/payments/:paymentId/receipt` |

---

### D. Resolver / Staff Routes (`role: staff`, `org_admin`)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/staff/dashboard` | `Dashboard.jsx` -> `StaffDashboard.jsx` | `RoleBasedRoute (staff, org_admin)` | Workload metrics, urgent/overdue SLA counts, active work timers, quick shortcuts to complaints. | `GET /api/staff/dashboard`, `GET /api/staff/workload`, `GET /api/staff/performance` |
| `/staff/complaints` | `AssignedComplaints.jsx` | `RoleBasedRoute (staff, org_admin)` | Assigned complaints table, search, status filters, SLA indicators, quick start work button, active timer tracking, resolution modal. | `GET /api/staff/complaints`, `PUT /api/staff/complaints/:id/start`, `POST /api/staff/complaints/:id/work-session/start`, `POST /api/staff/complaints/:id/work-session/pause` |
| `/staff/complaints/:id` | `ComplaintWorkspace.jsx` | `RoleBasedRoute (staff, org_admin)` | Detailed resolver workspace: status transition controls, work timer, internal notes (visible only to staff/admin), evidence uploads, template response applicator, request reassignment modal. | `GET /api/staff/complaints/:id`, `PUT /api/staff/complaints/:id/status`, `POST /api/staff/complaints/:id/notes`, `POST /api/staff/complaints/:id/evidence`, `POST /api/staff/complaints/:id/resolve`, `POST /api/staff/complaints/:id/request-reassignment` |
| `/admin/templates` | `TemplateLibrary.jsx` | `RoleBasedRoute (staff, admin, org_admin, super_admin)` | Canned responses & template library: browse templates, create/update/archive templates, apply template to complaint directly. | `GET /api/templates`, `POST /api/templates`, `PUT /api/templates/:id`, `DELETE /api/templates/:id`, `POST /api/templates/:templateId/apply/:complaintId` |

---

### E. Organization Administrator Routes (`role: org_admin`, `super_admin`)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/admin/dashboard` | `Dashboard.jsx` -> `AdminDashboard.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Tenant-wide metrics (total, open, resolved, overdue), Recharts status distribution, category breakdown, quick links hub. | `GET /api/admin/dashboard` |
| `/admin/complaints` | `ComplaintManagement.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Tenant complaint directory, search, multi-filter, direct manual staff assignment modal, rule-based auto assignment trigger, force close, force escalate. | `GET /api/admin/complaints`, `POST /api/admin/complaints/:id/assign`, `POST /api/admin/complaints/:id/assign-with-rules`, `PUT /api/admin/complaints/:id/reassign`, `PUT /api/admin/complaints/:id/close`, `POST /api/admin/complaints/:id/escalate` |
| `/admin/staff` | `StaffManagement.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Staff directory, active/deactive toggle, specializations & capacity editor, performance inspection modal, staff feedback view and admin rating submission. | `GET /api/admin/staff`, `GET /api/admin/staff/available`, `GET /api/admin/staff/:id/performance`, `PUT /api/admin/staff/:id/status`, `PUT /api/admin/staff/:id/specializations`, `GET /api/admin/staff/:id/feedback`, `POST /api/admin/staff/:id/feedback` |
| `/admin/categories` | `CategoryManagement.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Category list, create new category, edit SLA thresholds (critical, high, medium, low hours), color picker, delete category. | `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`, `PUT /api/categories/:id/sla` |
| `/admin/analytics` | `AnalyticsPanel.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Performance analytics, daily volume vs resolution charts, export CSV analytics report. | `GET /api/admin/analytics`, `GET /api/admin/analytics/trends` |
| `/admin/assignment-config` | `AssignmentRulesConfig.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Auto-assignment rules configuration: rule builder, skill matching toggle, workload threshold, least-loaded/round-robin strategy, priority order. | `GET /api/admin/assignment-rules`, `POST /api/admin/assignment-rules`, `PUT /api/admin/assignment-rules/:id`, `DELETE /api/admin/assignment-rules/:id`, `GET /api/admin/assignment-analytics` |
| `/admin/escalation-rules` | `EscalationRules.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Custom escalation rule builder: conditions (time threshold, priority, category), actions (supervisor notification, priority bump, auto-reassign), active toggle, manual escalation trigger button. | `GET /api/admin/escalation-rules`, `POST /api/admin/escalation-rules`, `PUT /api/admin/escalation-rules/:id`, `DELETE /api/admin/escalation-rules/:id`, `POST /api/admin/escalation-rules/process` |
| `/admin/notifications` | `NotificationPanel.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Real-time admin notification inbox, SLA breach notices, escalation warnings, mark as read, mark all read. | `GET /api/admin/notifications`, `GET /api/admin/notifications/urgent`, `PATCH /api/admin/notifications/:id/read`, `PATCH /api/admin/notifications/mark-all-read` |
| `/admin/reports` | `ReportingModule.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Comprehensive reporting panel, date range filters, category filters, download PDF report, download Excel/CSV report. | `GET /api/admin/reports`, `GET /api/admin/reports/export` |
| `/admin/audit-log` | `AuditLogPanel.jsx` | `RoleBasedRoute (org_admin, super_admin, admin)` | Tenant security and mutation audit trails, actor filtering, action text regex search, date range filtering, pagination. | `GET /api/admin/audit-log` |
| `/payments/my-payments` | `PaymentCenter.jsx` | `RoleBasedRoute (org_admin, super_admin)` | Organization-wide transaction ledger, payment volume summaries, issue refunds, download payment receipts. | `GET /api/payments/my-payments?scope=organization`, `GET /api/payments/admin/summary`, `POST /api/payments/:paymentId/refund`, `GET /api/payments/:paymentId/receipt` |

---

### F. Super Administrator Only Routes (`role: super_admin`)
| Route Path | Component / Page | Access Control | Primary Features & Views | Backend Endpoints Linked |
|---|---|---|---|---|
| `/admin/organizations` | `OrganizationManagement.jsx` | `RoleBasedRoute (super_admin)` | Multi-tenant platform management, list all registered organizations, create new organization tenant, view organization codes and administrator contacts. | `GET /api/admin/organizations`, `POST /api/admin/organizations` |
| `/admin/users` | `SystemUsers.jsx` | `RoleBasedRoute (super_admin)` | Global system user directory, role filter (`super_admin`, `org_admin`, `staff`, `user`), keyword search, organization association. | `GET /api/admin/users`, `GET /api/users` |

---

### G. Global Floating & Embedded Experience Features
| Feature / Component | Scope | Access Control | Primary Functionality |
|---|---|---|---|
| `Navbar.jsx` | Top Header | All Roles (Dynamic) | Responsive navigation links per role, unread notification counter & live dropdown, dark/light mode toggle, online/offline status pill, profile dropdown, logout action. |
| `Footer.jsx` | Bottom Footer | All Roles | Quick links, legal links, platform version, copyright. |
| `GlobalExperienceLayer.jsx` | Global Overlay | All Roles | Shortcut Command Palette (`Ctrl+K` / `Cmd+K`), contextual page headers, quick breadcrumbs, offline network toast alert. |
| `SupportChatbot.jsx` | Floating Bottom-Right | Authenticated Users | Floating AI-powered assistant, Groq LLM integration (`openai/gpt-oss-120b`) with deterministic rule fallback, conversation history, ticket status inquiry. |
| `ErrorBoundary.jsx` | Root Application | All Roles | Catches uncaught React render exceptions, displays resilient fallback recovery screen with page reload action. |
| `Toaster` (`react-hot-toast`) | Global Top-Right | All Roles | Centralized toast notifications for API success, validation errors, and network warnings. |

---

## 2. Backend API Endpoint Inventory

### Authentication & Identity (`/api/auth`)
- `POST /api/auth/register-org` — Register new organization and initial administrator.
- `POST /api/auth/register` — Register regular user joining an organization.
- `POST /api/auth/login` — Authenticate user and issue JWT token in HTTP-only cookie / response payload.
- `POST /api/auth/google` — Google OAuth credential login / user lookup.
- `POST /api/auth/google/onboarding` — Complete mandatory onboarding for new Google signups.
- `POST /api/auth/refresh-token` — Rotate and renew access token.
- `POST /api/auth/logout` — Invalidate user token and clear secure session cookies.
- `POST /api/auth/forgot-password` — Generate reset token and email password reset link.
- `POST /api/auth/reset-password/:token` — Consume reset token and update password.
- `GET /api/auth/verify-email/:token` — Email verification link handler.
- `POST /api/auth/resend-verification` — Resend verification email to authenticated user.
- `GET /api/auth/me` — Fetch current authenticated user identity and role.
- `PUT /api/auth/change-password` — Authenticated password change.
- `POST /api/auth/register-staff` — Admin endpoint to provision resolver staff.
- `POST /api/auth/register-admin` — Provision additional administrator.
- `GET /api/auth/check` — Light auth check endpoint for frontend bootstrapping.
- `GET /api/auth/validate-token` — Token expiration and role validator.

### User & Profile Management (`/api/users`)
- `GET /api/users/profile` — Get full user profile and metadata.
- `PUT /api/users/profile` — Update user profile details.
- `PUT /api/users/profile/avatar` — Upload and update profile avatar image.
- `DELETE /api/users/profile/avatar` — Remove profile avatar.
- `GET /api/users/stats` — User complaint metrics.
- `PUT /api/users/deactivate` — Self-deactivate account.
- `GET /api/users/notifications` — Retrieve paginated user notifications.
- `PUT /api/users/notifications/:id/read` — Mark notification as read.
- `PUT /api/users/notifications/read-all` — Mark all user notifications as read.
- `DELETE /api/users/notifications/:id` — Delete notification record.
- `GET /api/users/notification-preferences` — Get notification channel and event preferences.
- `PUT /api/users/notification-preferences` — Update notification preferences.
- `POST /api/users/staff-feedback/:staffId` — Submit user feedback and rating for a staff resolver.
- `GET /api/users` — Super Admin / Admin paginated user query.
- `GET /api/users/:id` — Get user profile by ID.
- `PUT /api/users/:id` — Admin update user.
- `DELETE /api/users/:id` — Admin delete user.

### Complaint Lifecycle (`/api/complaints`)
- `POST /api/complaints` — Create complaint with multipart file attachments and initial SLA deadline assignment.
- `GET /api/complaints/my-complaints` — Get current user's submitted complaints with filters.
- `GET /api/complaints/my-stats` — Get current user's complaint count breakdown.
- `GET /api/complaints/search` — Search complaints by text, status, and category.
- `GET /api/complaints/:id` — Get complaint details by ID (tenant-scoped and role-protected).
- `PUT /api/complaints/:id` — Edit complaint (only allowed when status is `new`).
- `GET /api/complaints/:id/timeline` — Get audit timeline and status history.
- `POST /api/complaints/:id/attachments` — Add new file attachments to existing complaint.
- `DELETE /api/complaints/:id/attachments/:attachmentId` — Remove an attachment.
- `PUT /api/complaints/:id/cancel` — Cancel/withdraw complaint with cancellation reason.
- `PUT /api/complaints/:id/reopen` — Reopen a resolved complaint.

### Resolver / Staff Endpoints (`/api/staff`)
- `GET /api/staff/dashboard` — Staff dashboard stats, active tasks, overdue items.
- `GET /api/staff/workload` — Staff current capacity and workload metrics.
- `GET /api/staff/performance` — Staff resolution rate, SLA compliance, and rating stats.
- `GET /api/staff/feedback` — Feedback ratings received by current staff member.
- `GET /api/staff/available-staff` — List fellow available staff in organization for reassignment suggestion.
- `GET /api/staff/complaints` — Get assigned complaints for authenticated staff.
- `GET /api/staff/complaints/:id` — Get full assigned complaint details.
- `PUT /api/staff/complaints/:id/status` — Update status (`assigned`, `in-progress`, `pending-user`, `on-hold`).
- `PUT /api/staff/complaints/:id/start` — Quick action to mark in-progress and start work session.
- `POST /api/staff/complaints/:id/work-session/start` — Start work tracking timer.
- `POST /api/staff/complaints/:id/work-session/pause` — Pause work tracking timer and record elapsed seconds.
- `POST /api/staff/complaints/:id/resolve` — Mark complaint resolved with remarks and optional evidence files.
- `POST /api/staff/complaints/:id/notes` — Add internal note (hidden from regular user).
- `DELETE /api/staff/complaints/:id/notes/:noteId` — Delete internal note within allowed window.
- `POST /api/staff/complaints/:id/evidence` — Upload resolution evidence files.
- `DELETE /api/staff/complaints/:id/evidence/:evidenceId` — Remove resolution evidence file.
- `POST /api/staff/complaints/:id/request-reassignment` — Submit reassignment request to administrator with reason.
- `POST /api/staff/complaints/:id/request-payment` — Request fee/payment for priority handling.
- `POST /api/staff/complaints/:id/acknowledge-payment` — Acknowledge payment receipt.

### Organization Administration (`/api/admin`)
- `GET /api/admin/dashboard` — Organization dashboard metrics and charts data.
- `GET /api/admin/analytics` — Detailed analytics data.
- `GET /api/admin/analytics/trends` — Historical trend breakdown.
- `GET /api/admin/analytics/forecast` — Forecasting data.
- `GET /api/admin/complaints` — Get all organization complaints with multi-filters and pagination.
- `GET /api/admin/complaints/unassigned` — Unassigned complaints filter.
- `GET /api/admin/complaints/escalated` — Escalated complaints filter.
- `POST /api/admin/complaints/:id/assign` — Direct manual assignment to staff member.
- `POST /api/admin/complaints/:id/assign-with-rules` — Automated rule-based assignment execution.
- `PUT /api/admin/complaints/:id/reassign` — Reassign complaint to new staff member.
- `POST /api/admin/complaints/bulk-assign` — Bulk assign multiple complaints.
- `POST /api/admin/complaints/:id/escalate` — Force manual escalation of a complaint.
- `PUT /api/admin/complaints/:id/close` — Permanently close resolved complaint.
- `GET /api/admin/staff` — Staff directory with performance, workload, and organization lookup.
- `GET /api/admin/staff/available` — List available staff for assignment.
- `GET /api/admin/staff/:id/performance` — Detailed individual staff performance metrics.
- `PUT /api/admin/staff/:id/status` — Activate/deactivate staff account.
- `PUT /api/admin/staff/:id/specializations` — Update staff specializations and max capacity.
- `GET /api/admin/staff/:id/feedback` — View all feedback entries for staff member.
- `POST /api/admin/staff/:id/feedback` — Add administrator rating and feedback for staff member.
- `GET /api/admin/export/complaints` — Export complaints to CSV/JSON.
- `POST /api/admin/import/users` — Bulk import users via CSV.
- `POST /api/admin/import/complaints` — Bulk import complaints via CSV.
- `POST /api/admin/import/categories` — Bulk import categories via CSV.
- `GET /api/admin/notifications` — Admin notification inbox.
- `GET /api/admin/notifications/urgent` — Urgent breach notifications.
- `PATCH /api/admin/notifications/:id/read` — Mark admin notification read.
- `PATCH /api/admin/notifications/mark-all-read` — Mark all admin notifications read.
- `GET /api/admin/organizations` — (Super Admin) List all organizations.
- `POST /api/admin/organizations` — (Super Admin) Create organization.
- `GET /api/admin/users` — (Super Admin) List all system users.
- `POST /api/admin/announcements` — Publish system announcements.
- `GET /api/admin/system/health` — System uptime and database health check.
- `GET /api/admin/system/performance` — Event loop latency and memory diagnostics.
- `GET /api/admin/audit-log` — Tenant and global audit log ledger.
- `GET /api/admin/reports` — Advanced reporting summary and analytics.
- `GET /api/admin/reports/export` — Export reports in PDF (`pdfkit`) or CSV format.
- `GET /api/admin/escalation-rules` — Get configured escalation rules.
- `POST /api/admin/escalation-rules` — Create escalation rule.
- `PUT /api/admin/escalation-rules/:id` — Update escalation rule.
- `DELETE /api/admin/escalation-rules/:id` — Delete escalation rule.
- `PATCH /api/admin/escalation-rules/:id/toggle` — Enable/disable escalation rule.
- `POST /api/admin/escalation-rules/process` — Manually trigger escalation engine run.
- `GET /api/admin/assignment-rules` — Get auto-assignment rules.
- `POST /api/admin/assignment-rules` — Create auto-assignment rule.
- `PUT /api/admin/assignment-rules/:id` — Update auto-assignment rule.
- `DELETE /api/admin/assignment-rules/:id` — Delete auto-assignment rule.
- `GET /api/admin/assignment-analytics` — Auto-assignment metrics and logs.

### Category Management (`/api/categories`)
- `GET /api/categories` — List active categories (public/authenticated with optional stats).
- `GET /api/categories/tree` — Category hierarchy.
- `POST /api/categories` — (Admin) Create category with custom SLA thresholds.
- `GET /api/categories/:id` — Get category details.
- `PUT /api/categories/:id` — (Admin) Update category.
- `DELETE /api/categories/:id` — (Admin) Delete category.
- `PATCH /api/categories/:id/toggle` — (Admin) Toggle active state.
- `PUT /api/categories/:id/sla` — (Admin) Update SLA thresholds.

### Feedback System (`/api/feedback`)
- `POST /api/feedback` — Submit feedback and rating for a resolved complaint.
- `GET /api/feedback/my-feedback` — User's submitted feedback history.
- `GET /api/feedback/complaint/:complaintId` — Get feedback associated with a complaint.
- `GET /api/feedback` — (Admin) List all feedback across organization.
- `GET /api/feedback/stats` — Feedback statistics and average rating metrics.
- `POST /api/feedback/:id/respond` — (Admin) Respond to user feedback.

### Payments & Invoicing (`/api/payments`)
- `POST /api/payments/complaints/:id/initiate` — Initiate payment for a complaint (Demo or Razorpay).
- `GET /api/payments/complaints/status` — Batch lookup payment status for complaints.
- `POST /api/payments/:paymentId/confirm` — Confirm payment completion.
- `GET /api/payments/my-payments` — List payments (personal or organization scope).
- `GET /api/payments/:paymentId/receipt` — Retrieve printable receipt metadata.
- `GET /api/payments/staff/incentives` — Resolver incentive overview.
- `GET /api/payments/admin/summary` — Admin payment volume and revenue metrics.
- `POST /api/payments/:paymentId/refund` — Admin issue payment refund.

### Response Templates (`/api/templates`)
- `POST /api/templates` — Create response template.
- `GET /api/templates` — List response templates.
- `PUT /api/templates/:id` — Update response template.
- `DELETE /api/templates/:id` — Delete response template.
- `POST /api/templates/:templateId/apply/:complaintId` — Apply template to complaint as status update or note.

### AI Chatbot Assistant (`/api/chatbot`)
- `POST /api/chatbot/message` — Send query to CRS Assistant (Groq LLM with deterministic fallback, context-aware complaint lookup, tenant boundary protected).
