# CRS Database Identification Audit Report (Read-Only)

**Project:** Complaint Resolution System (`d:/complaint-resolution-system`)
**Audit Type:** Read-Only Database Identification & Verification
**Audit Date:** 2026-10-15
**Auditor:** CRS Deployment Engineer (AI Pair Programmer)
**Safety Status:** Strictly Read-Only (Zero writes, mutations, migrations, or drops executed)

---

## 1. Executive Summary & Result

| Item | Finding |
| :--- | :--- |
| **Configured Database Name** | `complaint_system` |
| **Connection Configuration Source** | `backend/.env` (`MONGODB_URI` path & `DB_NAME` variable) and `backend/config/db.js` |
| **Active CRS Database in Local MongoDB** | **`complaint_system`** (Size on disk: ~3.23 MB) |
| **Confidence Level** | **Definitive (100%)** |
| **Active Data Profile** | Contains all 14 application collections, 8 production-like users across 4 roles, 12 real complaint lifecycles across 3 organizations, 7 seeded categories, and active audit/notification/payment records. |
| **Other Local Databases** | Legacy prototypes (`complaint-management`, `complaint_management`, `complaint-escalation`) and automated test execution databases (`complaint_system_*_test`). |

---

## 2. Environment Configuration & Connection Code Inspection

### 2.1 Backend Connection Configuration
- **File Reference:** `backend/config/db.js` (lines 15–33, 49–63)
```javascript
const connectionOptions = {
  maxPoolSize: 10,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  dbName: process.env.DB_NAME || 'complaint_system',
};
```
- **Connection Logic:**
  - `connectDB()` connects using `process.env.MONGODB_URI`.
  - The Mongoose connection explicitly enforces `dbName: process.env.DB_NAME || 'complaint_system'`.

### 2.2 Environment Inspection (Non-Secret Audit)
- **Active Environment (`backend/.env`):**
  - Configured URI points to local MongoDB (`localhost:27017`).
  - Database segment in URI path: `complaint_system`.
  - `DB_NAME` environment variable: `complaint_system`.
  - Both parameters align identically to `complaint_system`.
- **Default Reference (`backend/.env.example`):**
  - Line 12: `MONGODB_URI=mongodb://localhost:27017/complaint_system`
  - Line 17: `DB_NAME=complaint_system`
- **Docker Compose (`docker-compose.yml`):**
  - Line 26: `MONGODB_URI: mongodb://mongo:27017/complaint_system`
  - Line 27: `DB_NAME: complaint_system`

---

## 3. Expected Application Collections (Mongoose Models)

The backend defines **14 Mongoose models** under `backend/models/`. Mongoose maps these models to the following collections:

| Model Name | Source File | Mongoose Collection Name | Purpose |
| :--- | :--- | :--- | :--- |
| `User` | `backend/models/User.js` | `users` | User accounts, credentials, role assignments, org affiliations |
| `Complaint` | `backend/models/Complaint.js` | `complaints` | Core complaint tickets, statuses, SLA tracking, priority |
| `Organization` | `backend/models/Organization.js` | `organizations` | Multi-tenant organization definitions & tenant codes |
| `Category` | `backend/models/Category.js` | `categories` | Complaint categories and department SLA baselines |
| `Notification` | `backend/models/Notification.js` | `notifications` | In-app notification delivery log and dispatch status |
| `AuditLog` | `backend/models/AuditLog.js` | `auditlogs` | Security, action, and access audit records |
| `Payment` | `backend/models/Payment.js` | `payments` | Priority resolution fee and processing records |
| `StaffFeedback` | `backend/models/StaffFeedback.js` | `stafffeedbacks` | Staff performance evaluations and reviews |
| `StaffAvailability` | `backend/models/StaffAvailability.js` | `staffavailabilities` | Staff leave, shift, and work availability status |
| `Feedback` | `backend/models/Feedback.js` | `feedbacks` | Complainant satisfaction feedback on resolved tickets |
| `AssignmentRule` | `backend/models/AssignmentRule.js` | `assignmentrules` | Auto-assignment logic and rules per category |
| `AssignmentLog` | `backend/models/AssignmentLog.js` | `assignmentlogs` | Log of automated ticket assignment decisions |
| `EscalationRule` | `backend/models/EscalationRule.js` | `escalationrules` | Tiered SLA escalation triggers |
| `ResponseTemplate`| `backend/models/ResponseTemplate.js`| `responsetemplates` | Pre-defined response templates for resolvers |

---

## 4. Local MongoDB Database Survey

A read-only query of the local MongoDB instance at `localhost:27017` revealed 16 databases:

| Database Name | Disk Size | Category / Classification |
| :--- | :---: | :--- |
| `complaint_system` | **3.23 MB** | **Active CRS Application Database** |
| `complaint-management` | 1.15 MB | Stale/Legacy Prototype Database |
| `complaint_management` | 12.2 KB | Empty Stale Database |
| `complaint-escalation` | 8.19 KB | Empty Stale Database |
| `complaint_system_test` | 1.52 MB | Integration Test Database |
| `complaint_system_assignment_test` | 1.65 MB | Integration Test Database |
| `complaint_system_admin_actions_staff_tenant_test` | 1.63 MB | Integration Test Database |
| `complaint_system_complaint_tenant_test` | 1.57 MB | Integration Test Database |
| `complaint_system_analytics_feedback_tenant_test` | 1.55 MB | Integration Test Database |
| `complaint_system_escalation_engine_test` | 1.52 MB | Integration Test Database |
| `complaint_system_category_tenant_test` | 1.27 MB | Integration Test Database |
| `complaint_system_chatbot_test` | 1.18 MB | Integration Test Database |
| `admin` | 40.9 KB | MongoDB System Internal |
| `config` | 36.8 KB | MongoDB System Internal |
| `local` | 131 KB | MongoDB System Internal |
| `foodsaver` | 958 KB | Unrelated Project Database |

---

## 5. Detailed Collection & Document Count Comparison

A collection-level audit was executed across `complaint_system` and the similar candidate databases:

| Collection Name | `complaint_system` (Active) | `complaint-management` (Legacy) | `complaint_management` | `complaint-escalation` | `complaint_system_test` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `users` | **8** | 1 | 0 | 0 | 0 |
| `complaints` | **12** | 0 | 0 | 0 | 0 |
| `organizations` | **3** | 1 | 0 | 0 | 0 |
| `categories` | **7** | 4 | 0 | 0 | 0 |
| `notifications` | **72** | 0 | 0 | 0 | 12 |
| `auditlogs` | **320** | 0 | 0 | 0 | 39 |
| `payments` | **3** | 0 | 0 | 0 | 0 |
| `stafffeedbacks` | **2** | 0 | 0 | 0 | 0 |
| `assignmentrules` | **0** | 0 | 0 | 0 | 0 |
| `assignmentlogs` | **0** | 0 | 0 | 0 | 0 |
| `escalationrules` | **0** | 0 | 0 | 0 | 0 |
| `responsetemplates` | **0** | 0 | 0 | 0 | 0 |
| `feedbacks` | **0** | 0 | 0 | 0 | 0 |
| `staffavailabilities` | **0** | 0 | 0 | 0 | 0 |
| **Total Collections** | **14** | 5 | 1 | 1 | 14 |
| **Total Records** | **427** | 6 | 0 | 0 | 51 |

---

## 6. Deep Content Analysis of Candidate Databases

### 6.1 `complaint_system` (Confirmed Active Database)
- **Role Distribution:** 8 active user accounts:
  - `super_admin`: 1
  - `org_admin`: 2
  - `staff`: 2
  - `user`: 3
- **Organizations:** 3 active tenant organizations:
  - *TechFlow Solutions* (Code: `TEC-05D811`)
  - *Acme Corp* (Code: `ACM-D59ADA`)
  - *Default Organization* (Code: `ORG-DEFAULT`)
- **Complaints Breakdown:** 12 active complaint records spanning realistic statuses:
  - `new`: 1
  - `assigned`: 1
  - `in-progress`: 1
  - `resolved`: 2
  - `escalated`: 7
- **Categories:** 7 default standard categories seeded by `Category.seedDefaults()`:
  - *IT Support*, *Maintenance*, *Human Resources*, *Security*, *Housekeeping*, *Administration*, *Other*
- **Audit Logs:** 320 recorded actions corresponding to real API user interactions and tests performed during application acceptance.
- **Payments:** 3 paid fee orders (amounts: 199, 299, 399).
- **Recent Timestamps:** Record updates extend up to October 2026, confirming continuous alignment with the development and browser audit phases.

### 6.2 `complaint-management` (Stale / Early Prototype Database)
- Contains only 1 user (with a generic `admin` role, whereas the current application uses `org_admin` and `super_admin`).
- Organization name is *System Administration* without a tenant code (`code: undefined`), which violates the current schema requiring a tenant code.
- Categories list is outdated (4 items: *User Management, System Issues, Feature Requests, General Support*) and does not match the current application categories.
- Zero complaints, zero notifications, zero audit logs.
- **Verdict:** Stale legacy database from an earlier application iteration.

### 6.3 `complaint_management` & `complaint-escalation`
- `complaint_management`: Contains only an empty `organizations` collection (0 documents).
- `complaint-escalation`: Contains only an empty `users` collection (0 documents).
- **Verdict:** Abandoned database artifacts with 0 documents.

### 6.4 `complaint_system_*_test` Databases
- Inspection of the test suite (`backend/__tests__/integration/*.test.js`) reveals an explicit safety guard:
  - Tests connect strictly to isolated databases with `_test` suffix (e.g. `complaint_system_complaint_tenant_test`, `complaint_system_category_tenant_test`, etc.).
  - The tests run `beforeEach` and `afterEach` hooks that wipe all business collections (`users.deleteMany({})`, `complaints.deleteMany({})`), leaving only temporary audit and notification logs.
  - Zero permanent application data or user accounts reside in these databases.
- **Verdict:** Ephemeral automated integration test runners.

---

## 7. Migration & Deployment Recommendation

When deploying to MongoDB Atlas for production:
1. **Target Database Name:** Set `DB_NAME=complaint_system` and specify `...mongodb.net/complaint_system` in the production `MONGODB_URI`.
2. **Data Export/Import:**
   - If migrating existing seed/acceptance data from local to Atlas, export exclusively from the **`complaint_system`** database:
     ```bash
     mongodump --db=complaint_system --out=./backup/
     mongorestore --uri="<MONGODB_ATLAS_URI>" --nsInclude="complaint_system.*" ./backup/complaint_system/
     ```
3. **Fresh Production Boot:**
   - If starting with a clean production database, the application will automatically initialize the `complaint_system` database on Atlas, create required indexes, and seed the default 7 categories on initial boot.
4. **Cleanup Guidance:**
   - Do **NOT** drop `complaint_system`.
   - The test databases (`*_test`) are automatically managed by Jest.
   - The legacy databases (`complaint-management`, `complaint_management`, `complaint-escalation`) can be archived or ignored as they are not referenced anywhere in the current codebase.
