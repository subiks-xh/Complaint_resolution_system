# Technical Audit: Backend & Database Architecture Review
## Complaint Escalation & Resolution System (CRS)

---

## 1. Executive Summary: Backend & Database

The backend is built with **Node.js (>=18.0.0)** and **Express.js v4.18.2**, with **MongoDB** as the persistence store managed through **Mongoose v8.0.3**.
- **Architecture Style:** Layered Controller-Service-Route structure with separated middleware.
- **Data Model:** 14 dedicated Mongoose schemas with subdocuments, virtual properties, compound indexes, and lifecycle hooks.
- **Background Tasks:** Single-process `node-cron` orchestrating hourly SLA breach checks, 30-minute warning monitors, and 09:00 AM daily digests.
- **Documentation:** Interactive OpenAPI / Swagger UI mounted at `/api-docs`.

The backend implementation is extensive and feature-rich. However, this audit has uncovered critical routing collisions, query isolation flaws, transaction omissions, and contract discrepancies.

---

## 2. Express Server & Route Configuration Audit

### 2.1 Route Namespace Collision Bug
In [backend/app.js](file:///d:/complaint-resolution-system/backend/app.js#L326-L327):
```javascript
// Line 326-327 of backend/app.js
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/admin`, assignmentRoutes);
```

**The Conflict:**
1. In [backend/routes/adminRoutes.js](file:///d:/complaint-resolution-system/backend/routes/adminRoutes.js#L160):
   ```javascript
   router.post("/complaints/:id/assign", adminValidation.assign, assignComplaint);
   ```
2. In [backend/routes/assignmentRoutes.js](file:///d:/complaint-resolution-system/backend/routes/assignmentRoutes.js#L18):
   ```javascript
   router.post('/complaints/:complaintId/assign', assignmentController.assignComplaintWithRules);
   ```

**Impact:**
Because `adminRoutes` is mounted first, any request to `POST /api/admin/complaints/:id/assign` is captured by `adminController.assignComplaint` (which performs basic direct staff assignment). The advanced `assignmentController.assignComplaintWithRules` (which evaluates least-loaded routing, skill matching, availability, and AI fallbacks) is completely shadowed and unreachable!

**Recommendation:** Disambiguate route paths:
- Mount `assignmentRoutes` under `${API_PREFIX}/admin/assignments` or `/api/assignments`.
- Standardize param naming to `:id`.

---

## 3. Database & Mongoose Schema Audit

### 3.1 Overview of Schemas & Relationships
The system defines 14 Mongoose models in `backend/models/`:

1. **`User.js` (930 lines):**
   - Implements roles: `["super_admin", "org_admin", "staff", "user"]` (with backward compatibility for `admin`).
   - Fields: `name`, `email` (unique, lowercase), `password` (bcrypt with salt 10, hidden `select: false`), `organization` (ref: `Organization`), `role`, `department`, `designation`, `avatar`, `loginAttempts`, `lockUntil`, `isLocked`, `refreshToken`, `googleId`, `isOnboarded`.
   - Methods: `comparePassword`, `incrementLoginAttempts`, `resetLoginAttempts`, `passwordChangedAfter`, `toPublicProfile`.

2. **`Complaint.js` (896 lines):**
   - Core entity with unique reference `complaintId` (e.g. `CMP-2026-000001`).
   - Relationships: `organization` (ref: `Organization`), `user` (ref: `User`), `category` (ref: `Category`), `assignedTo` (ref: `User`), `assignedBy` (ref: `User`).
   - Subdocuments: `attachments` (array of filename, url, publicId, size, mimeType), `statusHistory` (status, changedBy, changedByRole, remarks, changedAt), `escalationHistory`, `internalNotes`.
   - Timeline tracking: `submittedAt`, `assignedAt`, `firstResponseAt`, `resolvedAt`, `closedAt`, `escalatedAt`, `reopenedAt`, `lastUpdatedAt`.
   - Indexes: Compound indexes on `{ organization: 1, status: 1 }`, `{ user: 1, createdAt: -1 }`, `{ assignedTo: 1, status: 1 }`, and text index on `{ title: "text", description: "text" }`.

3. **`Category.js` (690 lines):**
   - Organization-scoped grievance classification with customizable SLA hours per priority (`low`, `medium`, `high`, `critical`) and escalation thresholds.

4. **`AssignmentRule.js` & `AssignmentLog.js`:**
   - Supports 6 routing algorithms: `round-robin`, `least-loaded`, `skill-based`, `geographic`, `performance-based`, `ai-based`.
   - Stores audit history for every assignment calculation and fallback decision.

5. **`Feedback.js` & `StaffFeedback.js`:**
   - `Feedback`: User satisfaction for resolved tickets (1-5 stars, responseTime, resolution, communication ratings). Enforces unique index `{ complaint: 1 }` (one feedback per ticket).
   - `StaffFeedback`: General multi-source staff reviews (admin and peer evaluations).

6. **`Payment.js` (135 lines):**
   - Tracks fee-based or premium priority boost payments. Contains `paymentRef` (auto-incrementing prefix `PAY-YYYY-XXXXXX`).

### 3.2 Schema Deficiencies & Optimization Gaps

1. **Legacy Array Index Workaround in `server.js`:**
   - In [server.js:164-167](file:///d:/complaint-resolution-system/backend/server.js#L164-L167), an explicit manual index drop is invoked during boot: `AssignmentRule.dropLegacyParallelArrayIndex()`. This indicates past schema index conflicts that were patched via procedural code rather than a managed migration script.
2. **Missing Transaction Atomicity:**
   - In [authController.js:56-59](file:///d:/complaint-resolution-system/backend/controllers/authController.js#L56-L59), MongoDB session transactions were commented out (`// NOTE: Removed transactions to support standalone MongoDB instances`). Multi-document writes (Organization create + Admin create) are handled with manual `findByIdAndDelete` rollbacks upon failure. This creates a data inconsistency risk during ungraceful process termination.
3. **Soft-Delete vs. Referential Integrity:**
   - Categories and users support soft-deletion (`isActive: false`). However, foreign key references in `Complaint` do not cascade or prevent deletion of active categories currently assigned to unresolved complaints.

---

## 4. Controller & Business Logic Audit

### 4.1 Complaint Creation Workflow
In [complaintController.js:26-285](file:///d:/complaint-resolution-system/backend/controllers/complaintController.js#L26-L285):
- Validates input: Title length (>= 5), description length (>= 20), active category existence.
- Dynamically sets `resolutionDeadline = Date.now() + slaHours * 3600000`.
- Inserts `statusHistory` entry (`status: "new"`).
- Sends non-blocking email and in-app notifications to user and organization admins.
- **Defect Identified:** Does **not** invoke auto-assignment. Tickets remain in `status: "new"` with `assignedTo: null` until an administrator manually assigns them or runs an explicit assignment API call.

### 4.2 Status Transition Validation
In [staffController.js:770-900](file:///d:/complaint-resolution-system/backend/controllers/staffController.js#L770-L900):
- Staff members can only update complaints assigned to their ID.
- Permitted status targets for staff: `in-progress` and `resolved`.
- Transition to `resolved` strictly validates resolution remarks (min 20 characters).
- Accurately halts active work session timers and records total seconds worked into `workTracking`.

---

## 5. Frontend / Backend Contract Verification

| API Endpoint | Expected Frontend Payload | Backend Controller Handling | Contract Status |
|---|---|---|---|
| `POST /api/complaints` | Multipart: `title`, `description`, `category`, `priority`, `files` | Parses multipart with Multer, validates fields, returns `201` + complaint | **MATCH (Aligned)** |
| `POST /api/feedback` | `{ complaintId, rating, comments, ratingBreakdown }` | Validates complaint ownership & resolved state, creates record, returns `201` | **MATCH (Aligned)** |
| `PUT /api/staff/complaints/:id/status` | `{ status: "resolved", remarks: "..." }` | Validates assignment, verifies remark length, records timeline, returns `200` | **MATCH (Aligned)** |
| `PUT /api/complaints/:id/close` | `{ satisfaction: "satisfied", remarks: "..." }` | **No route exists on `complaintRoutes.js`. Only `adminRoutes.js` defines close.** | **MISMATCH (Broken Workflow)** |
| `POST /api/payments/:id/initiate`| `{ method, purpose, notes }` | Validates complaint status, computes amount from priority, returns `201` | **MATCH (Aligned)** |
| `POST /api/payments/:id/confirm` | `{ gatewayPaymentId, markAsPaid }` | Marks paid, upgrades priority, returns `200` | **MATCH (Aligned)** |
| `GET /api/reports/export` | Query: `format=pdf&startDate=...` | Streams PDF binary response with `Content-Type: application/pdf` | **MATCH (Aligned)** |
