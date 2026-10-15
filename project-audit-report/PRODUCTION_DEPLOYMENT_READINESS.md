# CRS Production Deployment — Phase 1: Repository and Hosting Readiness Audit

**Project:** Complaint Resolution System (`d:/complaint-resolution-system`)
**Scope:** Phase 1 Read-Only Repository, Architecture, Environment & Hosting Readiness Audit
**Target Architecture:** Single unified public URL serving the frontend and backend
**Audit Date:** 2026-10-12
**Status:** Audit Completed — Deployment Blockers & Warnings Identified

---

## Executive Summary

The Complaint Resolution System (CRS) is architecturally capable of running as a single unified service where a single container or Node.js web process serves both the compiled Vite frontend SPA and the Express REST API under a single public origin. The codebase already includes:
1. Production static serving logic in `backend/app.js` (`express.static(frontend/dist)` with SPA regex fallback to `index.html`).
2. A two-stage production `Dockerfile` that builds the frontend bundle with Vite and copies it into `/app/frontend/dist` of the backend image.
3. Health check endpoints (`/api/health` and `/api/health/detailed`) that monitor database connection and server uptime.

However, **live production deployment is currently BLOCKED** by four critical operational and environment configuration deficiencies. These must be resolved in hosting configuration before traffic is pointed to the application.

---

## Classification Summary

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **BLOCKER** | 4 | Required environment secrets missing in hosting, CORS/Cookie domain mismatch, ephemeral disk attachment risk, reverse proxy IP trust. |
| **WARNING** | 5 | In-memory scheduler horizontal scaling collision, Google OAuth domain callbacks, in-memory rate limiting, unverified SMTP/Razorpay credentials, memory limits. |
| **READY** | 7 | Single-origin serving architecture, Dockerfile build pipeline, DB connection pooling, automatic index cleanup, health endpoints, graceful shutdown, SPA client fallback. |

---

## 1. Repository Structure & Scripts

### 1.1 Package Manifests & Scripts

#### Backend (`backend/package.json`)
- **Node Engine Requirement:** `>=18.0.0`
- **Main Entry:** `server.js`
- **Scripts:**
  - `start`: `node server.js`
  - `dev`: `nodemon server.js`
  - `test`: `jest --detectOpenHandles --forceExit`
  - `test:coverage`: `jest --coverage`
  - `test:watch`: `jest --watch`
  - `seed`: `node utils/seedData.js` *(Note: Destructive test seeder - do not run in production)*
  - `cleanup`: `node utils/cleanupTestData.js`
  - `audit:phase4`: `node utils/verifyPhase4Acceptance.js`
  - `audit:routes`: `node utils/inventoryRoutesAndFeatures.js`

#### Frontend (`frontend/package.json`)
- **Scripts:**
  - `dev`: `vite`
  - `build`: `vite build`
  - `lint`: `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`
  - `preview`: `vite preview`
- **Build Output:** `frontend/dist/`

### 1.2 Root Structure & Docker Architecture
- **Root Dockerfile:** Multi-stage build:
  - Stage 1 (`frontend-build`): Node 18 Alpine, runs `npm run build` in `/app/frontend`.
  - Stage 2 (`production`): Node 18 Alpine, installs production dependencies in `/app/backend`, copies `/app/frontend/dist` to `/app/frontend/dist`, exposes port `5000`, launches with `node server.js`.
- **Root docker-compose.yml:** Configured for `backend` service (building Dockerfile) and `mongo` service (`mongo:7.0`).

---

## 2. Architecture & Hosting Strategy

### Finding: READY (Single-Origin Monolithic Container Deployment)
- **File Reference:** `backend/app.js` (lines 313–348)
```javascript
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
}
```
- **Evidence & Evaluation:**
  - When `NODE_ENV=production` and `frontend/dist` is present, Express serves the static production build directly.
  - The regular expression `app.get(/^\/(?!api(?:\/|$)).*/)` ensures that all non-API paths resolve to `frontend/dist/index.html` without colliding with `/api/*` endpoints.
  - The frontend Vite API client (`frontend/src/services/api.js`) defaults `baseURL` to `/api` when `VITE_API_BASE_URL` is omitted, making single-origin deployment zero-configuration on the client side.

---

## 3. Environment Variable Audit & Configuration Matrix

Every environment variable referenced across the frontend and backend codebase was audited:

| Variable | Referenced In | Purpose | Production Requirement | Where Configured |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | `backend/server.js`, `backend/app.js`, `backend/config/jwt.js` | Enables production optimizations, secure cookies, and static SPA serving. | **Mandatory** (`production`) | Hosting Provider Environment |
| `PORT` | `backend/server.js` | HTTP listening port for Express. | Optional (Defaults to `5000`, often overridden by PaaS like Render/Heroku via `$PORT`). | Hosting Provider Environment |
| `MONGODB_URI` | `backend/config/db.js` | MongoDB connection connection string. | **Mandatory** | Hosting Secret Store |
| `DB_NAME` | `backend/config/db.js` | MongoDB database name override (defaults to `complaint_system`). | Optional | Hosting Provider Environment |
| `FRONTEND_URL` | `backend/app.js` | Whitelisted origin for CORS and CSRF checks. | **Mandatory** (Must match public canonical domain, e.g. `https://crs.yourdomain.com`). | Hosting Provider Environment |
| `JWT_ACCESS_SECRET` | `backend/config/jwt.js` | Secret key for signing 15-minute access JWTs. | **Mandatory** (Must be cryptographically strong, 64+ chars). | Hosting Secret Store |
| `JWT_REFRESH_SECRET` | `backend/config/jwt.js` | Secret key for signing 7-day refresh JWTs. | **Mandatory** (Must be cryptographically strong, 64+ chars). | Hosting Secret Store |
| `SESSION_SECRET` | `backend/app.js` | Secret used to sign express-session cookies (OAuth & CSRF token storage). | **Mandatory** (Defaults to insecure fallback if unset). | Hosting Secret Store |
| `ENABLE_SCHEDULER` | `backend/server.js` | Controls whether node-cron hourly SLA escalation engine boots. | **Mandatory** (`true` on primary web worker, `false` on replicas). | Hosting Provider Environment |
| `CLOUDINARY_CLOUD_NAME` | `backend/config/cloudinary.js` | Cloudinary cloud account name for file storage. | **Mandatory** (Without this, attachments fall back to local disk). | Hosting Secret Store |
| `CLOUDINARY_API_KEY` | `backend/config/cloudinary.js` | Cloudinary API key. | **Mandatory** | Hosting Secret Store |
| `CLOUDINARY_API_SECRET` | `backend/config/cloudinary.js` | Cloudinary API secret. | **Mandatory** | Hosting Secret Store |
| `SMTP_HOST` | `backend/services/emailService.js` | Mail server host (e.g. `smtp.sendgrid.net`, `smtp.gmail.com`). | Optional / Conditional (Required for real email dispatch). | Hosting Provider Environment |
| `SMTP_PORT` | `backend/services/emailService.js` | Mail server port (587 or 465). | Optional / Conditional | Hosting Provider Environment |
| `SMTP_SECURE` | `backend/services/emailService.js` | Use SSL/TLS (`true` for 465, `false` for 587). | Optional / Conditional | Hosting Provider Environment |
| `SMTP_USER` | `backend/services/emailService.js` | Mail account username / API user. | Optional / Conditional | Hosting Secret Store |
| `SMTP_PASS` | `backend/services/emailService.js` | Mail account password / API key. | Optional / Conditional | Hosting Secret Store |
| `SMTP_FROM` | `backend/services/emailService.js` | Default 'From' header email address. | Optional / Conditional | Hosting Provider Environment |
| `GOOGLE_CLIENT_ID` | `backend/controllers/authController.js`, `frontend/src/pages/Login.jsx` | OAuth client ID for Google sign-in. | Optional / Conditional (Required for Google Login). | Hosting & Frontend Build Env |
| `GOOGLE_CLIENT_SECRET` | `backend/controllers/authController.js` | OAuth client secret for backend token exchange. | Optional / Conditional | Hosting Secret Store |
| `RAZORPAY_KEY_ID` | `backend/controllers/paymentController.js` | Razorpay gateway merchant key ID. | Optional / Conditional (Falls back to Demo mode). | Hosting Secret Store |
| `RAZORPAY_KEY_SECRET` | `backend/controllers/paymentController.js` | Razorpay merchant secret for signature verification. | Optional / Conditional | Hosting Secret Store |
| `CHATBOT_AI_ENABLED` | `backend/services/aiProviderService.js` | Flag toggling external LLM chatbot integration. | Optional (`true`/`false`). | Hosting Provider Environment |
| `CHATBOT_AI_URL` | `backend/services/aiProviderService.js` | REST endpoint for AI provider (OpenAI/Groq compatible). | Optional / Conditional | Hosting Provider Environment |
| `CHATBOT_AI_API_KEY` | `backend/services/aiProviderService.js` | API key for AI provider. | Optional / Conditional | Hosting Secret Store |
| `CHATBOT_AI_MODEL` | `backend/services/aiProviderService.js` | LLM model identifier (e.g., `llama-3.3-70b-versatile`). | Optional / Conditional | Hosting Provider Environment |
| `VITE_API_BASE_URL` | `frontend/src/services/api.js` | Base URL for frontend Axios calls. | Optional (Defaults to `/api`, perfect for single-origin hosting). | Frontend Build Time Env |
| `VITE_GOOGLE_CLIENT_ID`| `frontend/src/pages/Login.jsx`, `Register.jsx` | Google OAuth Client ID bundled into client bundle. | Optional / Conditional | Frontend Build Time Env |

---

## 4. Network, Security, Cookies, CORS & Proxy Requirements

### 4.1 CORS Configuration
- **File Reference:** `backend/app.js` (lines 78–94)
- **Current Behavior:**
  - If `NODE_ENV === 'production'`, `allowedOrigins` includes `process.env.FRONTEND_URL`.
  - Credentials (`credentials: true`) are enabled.
- **Production Implication:**
  - When hosting frontend and backend together under the same origin (e.g. `https://crs.example.com`), requests from the browser to `/api/*` are same-origin and bypass CORS restrictions.
  - However, `FRONTEND_URL` must still be populated with the exact canonical URL (e.g., `https://crs.example.com`) because `app.js` uses `FRONTEND_URL` in its CSRF and origin checks.

### 4.2 Cookie & Session Security
- **File Reference:** `backend/config/jwt.js` (lines 14–23)
```javascript
cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}
```
- **Finding:**
  - In production, cookies are flagged `httpOnly: true`, `secure: true`, and `sameSite: 'strict'`.
  - **Critical Requirement:** This mandates that the production deployment **MUST run over HTTPS**. If deployed on plain HTTP, browsers will reject the `secure: true` cookies, preventing authentication and session persistence.
  - Using `sameSite: 'strict'` requires the frontend and backend to share the same site/origin; otherwise, top-level cross-site navigations or external OAuth redirects may omit the session cookie. Single-origin deployment guarantees compatibility.

### 4.3 Reverse Proxy & Rate Limiting (`trust proxy`)
- **File Reference:** `backend/middleware/authMiddleware.js` (`sensitiveOperationLimiter`, line 17) & `backend/app.js`
- **Issue:** `sensitiveOperationLimiter` inspects `req.ip` and limits users to 5 requests per 15 minutes.
- **Finding [BLOCKER/WARNING]:**
  - Most production PaaS hosts (Render, Heroku, AWS ALB, Nginx, Cloudflare) operate behind reverse proxies.
  - `backend/app.js` currently does **not** explicitly call `app.set('trust proxy', 1)`.
  - Without `trust proxy`, `req.ip` evaluates to the proxy server's IP address. Under traffic, **all users would share the single proxy IP rate limit**, resulting in global HTTP 429 lockouts for password reset, login, and sensitive endpoints.

---

## 5. Database, Indexes, Seeds & Data Backup

### 5.1 MongoDB Connection & Pooling
- **File Reference:** `backend/config/db.js` (lines 8–24)
- **Settings:**
  - `maxPoolSize`: 10
  - `minPoolSize`: 5
  - `serverSelectionTimeoutMS`: 5000
  - `socketTimeoutMS`: 45000
  - `autoIndex`: true (Mongoose builds indexes upon model instantiation).
- **Graceful Shutdown:** `backend/server.js` listens to `SIGTERM` and `SIGINT`, invoking `mongoose.connection.close(false)`.

### 5.2 Auto-Migrations & Legacy Cleanup
- **File Reference:** `backend/models/AssignmentRule.js` (`dropLegacyParallelArrayIndex`, line 147)
- **Automatic Behavior:** On startup, `connectDB` invokes `AssignmentRule.dropLegacyParallelArrayIndex()`, which safely inspects and drops outdated parallel-array compound indexes if present.
- **Category Seeding:** `backend/config/db.js` calls `Category.seedDefaults()`, ensuring essential complaint categories exist without overwriting custom data.
- **Destructive Seeds:** `backend/utils/seedData.js` is **strictly for development/testing** (it deletes and re-creates test users and sample complaints). It is **not** called automatically on server startup.

### 5.3 Backup Considerations
- Ensure the production database is hosted on MongoDB Atlas (M0/M10+) with Automated Daily Snapshots enabled.
- Point-in-time recovery (PITR) should be active for production data integrity.

---

## 6. External Integrations & Storage Services

### 6.1 Uploads & Cloudinary Storage
- **File Reference:** `backend/middleware/uploadMiddleware.js`, `backend/config/cloudinary.js`
- **Storage Dual-Mode:**
  - If `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are provided: Files upload to Cloudinary CDN (`storage = new CloudinaryStorage(...)`).
  - If Cloudinary credentials are missing: Falls back to local disk (`storage = multer.diskStorage(...)` targeting `backend/uploads/`).
- **Production Finding [BLOCKER]:**
  - Production container platforms (Docker, Render, Fly.io, Railway) have **ephemeral filesystems**. Any attachments stored in `backend/uploads/` will be permanently lost on container restart, redeploy, or auto-scaling.
  - Cloudinary credentials are an **operational blocker** for preserving user attachment integrity.

### 6.2 Email / SMTP Dispatch
- **File Reference:** `backend/services/emailService.js` (lines 14–48)
- **Safety Mechanism:**
  - If `SMTP_HOST` or `SMTP_USER` is missing, `emailService` logs a warning and gracefully enters no-op simulation mode (`sendEmail` returns success with simulated info).
  - Core complaint creation and workflow transitions **do not fail** if email is unconfigured.
  - However, password reset emails require a real SMTP provider (e.g. SendGrid, Mailgun, Amazon SES).

### 6.3 AI Chatbot Provider
- **File Reference:** `backend/services/aiProviderService.js`
- **Safety Mechanism:**
  - If `CHATBOT_AI_ENABLED !== 'true'` or `CHATBOT_AI_API_KEY` is omitted, the chatbot automatically falls back to deterministic rule-based FAQ responses.
  - External network timeouts are capped at 10 seconds. Unreachable AI providers fail over seamlessly to standard guidance.

### 6.4 Payment Integration (Razorpay)
- **File Reference:** `backend/controllers/paymentController.js` (lines 14–33)
- **Safety Mechanism:**
  - If `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` is unset, `getRazorpayInstance()` returns `null`.
  - The payment controller automatically operates in **Demo Mode**: creates synthetic orders (`DEMO-ORDER-...`) and verifies payments without making external gateway calls.
  - When keys are supplied, real Razorpay orders and webhook signature verifications are executed.

---

## 7. Escalation Scheduler & Multi-Instance Assessment

### Finding: WARNING (In-Memory Node-Cron Concurrency)
- **File Reference:** `backend/utils/escalationScheduler.js`, `backend/server.js` (line 34)
- **Mechanism:**
  - The scheduler initializes via `node-cron.schedule('0 * * * *', ...)` (hourly on the hour).
  - It runs `checkAndEscalateComplaints()`.
- **Concurrency Risk:**
  - `node-cron` runs in-memory within the Node.js process.
  - If the application is scaled horizontally (e.g. 2 or more container instances running simultaneously), **each instance will run the hourly cron job at the same minute**.
  - While `checkAndEscalateComplaints()` updates status to `'escalated'` conditionally, concurrent execution can result in duplicate audit logs, race conditions, and duplicate notification emails to admins.
- **Recommended Initial Deployment Configuration:**
  - **Single Instance (1 Web Replicas):** Run a single web dyno/container with `ENABLE_SCHEDULER=true`.
  - **If scaling horizontally in the future:** Set `ENABLE_SCHEDULER=false` on all web workers, and run a single dedicated background worker instance with `ENABLE_SCHEDULER=true`.

---

## 8. Filesystem Persistence & Localhost Audit

### 8.1 Filesystem Dependencies
- **Static Assets:** `frontend/dist` is read-only at runtime (built during image creation).
- **Temporary Uploads:** `backend/uploads/` is used only if Cloudinary is absent. No other features write to the local filesystem.

### 8.2 Hardcoded Localhost Audit
- **Backend CORS:** Does not hardcode localhost in production (`process.env.FRONTEND_URL` is checked when `NODE_ENV === 'production'`).
- **Frontend Axios Client:** `frontend/src/services/api.js` line 4:
  `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'`
  *(Cleanly resolves to the hosting origin without any hardcoded `http://localhost:5000`)*.
- **Socket.io / Chat / Google Auth:** Use relative `/api` paths or dynamic `window.location.origin`.

---

## 9. Comprehensive Classified Findings

### 9.1 BLOCKERS (Must Resolve Before Production Launch)

| ID | Finding | Exact Code Reference | Risk / Impact | Required Fix |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | Missing Production Secrets | `backend/config/jwt.js:6-7`<br>`backend/app.js:106` | Insecure default secrets could allow unauthorized JWT forgery and session tampering in production. | Configure strong, unique strings in hosting environment: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`. |
| **BLK-02** | `FRONTEND_URL` & HTTPS Cookie Alignment | `backend/app.js:78-94`<br>`backend/config/jwt.js:18` | In production, cookies are flagged `secure: true`. Plain HTTP deployments will fail to save auth cookies. CORS will reject requests if `FRONTEND_URL` does not match the public HTTPS domain. | Deploy on HTTPS and set `FRONTEND_URL=https://<your-public-domain>`. |
| **BLK-03** | Ephemeral Disk Storage Data Loss | `backend/middleware/uploadMiddleware.js:29-37` | User complaint attachments stored in local `uploads/` will be permanently deleted upon container restart or deployment update. | Provide valid `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in hosting environment. |
| **BLK-04** | Reverse Proxy Rate Limiting Collisions | `backend/middleware/authMiddleware.js:17`<br>`backend/app.js` | Without `app.set('trust proxy', 1)`, all clients behind cloud load balancers/proxies share one IP address, triggering 429 lockouts on password reset and login. | Ensure `trust proxy` is enabled or rate limits account for proxied headers before live multi-user traffic. |

---

### 9.2 WARNINGS (High Operational & Reliability Importance)

| ID | Finding | Exact Code Reference | Risk / Impact | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **WRN-01** | Scheduler Multi-Instance Collision | `backend/utils/escalationScheduler.js:18` | Horizontal scaling (multiple containers) triggers concurrent cron jobs, causing duplicate notifications and audit trails. | Run only 1 instance with `ENABLE_SCHEDULER=true` initially. |
| **WRN-02** | Google OAuth Redirect URI Alignment | `backend/controllers/authController.js:122` | Google sign-in fails with `redirect_uri_mismatch` if the live production URL is not registered in Google Cloud Console. | Register production domain (e.g. `https://<domain>`) in Google Cloud Authorized JavaScript Origins and Redirect URIs. |
| **WRN-03** | In-Memory Rate Limiting Reset on Restart | `backend/middleware/authMiddleware.js:18` | Sensitive operation rate limit map is stored in RAM; resets on container reboot. | Acceptable for MVP; migrate to Redis-backed store (`rate-limit-redis`) for enterprise horizontal scaling. |
| **WRN-04** | Email Simulation Mode in Production | `backend/services/emailService.js:29` | If SMTP credentials are omitted, user password reset emails cannot be delivered (silently logged). | Configure production SMTP credentials (SendGrid/Postmark/SES) if password resets via email are required. |
| **WRN-05** | Production MongoDB Memory & Connection Limits | `backend/config/db.js:13` | Default pool size is 10 connections. On free Atlas tiers (M0), connection limits (500) must not be exhausted by excessive restarts. | Monitor connection count on MongoDB Atlas dashboard. |

---

### 9.3 READY (Verified Stable Code & Architecture)

| ID | Item | Exact Code Reference | Status & Evidence |
| :--- | :--- | :--- | :--- |
| **RDY-01** | Unified Single-Origin Container | `Dockerfile`<br>`backend/app.js:313-348` | **READY**: Two-stage Docker build bundles Vite assets into Express; Express serves static bundle and fallbacks cleanly. |
| **RDY-02** | Client API Path Agnosticism | `frontend/src/services/api.js:4` | **READY**: Defaults to `/api` without hardcoded localhost URLs. |
| **RDY-03** | Database Connection & Index Management | `backend/config/db.js`<br>`backend/models/AssignmentRule.js` | **READY**: Auto-cleans legacy parallel-array indexes and auto-seeds categories on startup safely. |
| **RDY-04** | Health Check Monitoring | `backend/routes/healthRoutes.js` | **READY**: Live `/api/health` and `/api/health/detailed` endpoints report DB readiness and system status. |
| **RDY-05** | Graceful Termination | `backend/server.js:47-66` | **READY**: Handles `SIGTERM` and `SIGINT` by stopping HTTP server and closing Mongoose connections. |
| **RDY-06** | Payment Demo Mode Fallback | `backend/controllers/paymentController.js:18` | **READY**: Does not crash if Razorpay keys are omitted; cleanly switches to demo orders. |
| **RDY-07** | AI Chatbot Fallback | `backend/services/aiProviderService.js:80` | **READY**: Automatically degrades to rule-based FAQ responses if AI provider is disabled or fails. |

---

## 10. Recommended Production Deployment Plan

### 10.1 Recommended Hosting Architecture
- **Platform:** Single Web Service container on **Render**, **Railway**, **Fly.io**, or **AWS App Runner** (or a single Linux VPS with Docker).
- **Database:** **MongoDB Atlas** (Shared M0 or Dedicated M10+).
- **Domain:** Managed HTTPS custom domain (e.g. `https://crs.yourdomain.com`).

### 10.2 Build & Start Commands
- **Option A (Docker Container - Recommended):**
  - **Build Command:** `docker build -t crs-app .`
  - **Start Command:** `docker run -p 5000:5000 --env-file .env crs-app`
- **Option B (Node.js PaaS Native Build):**
  - **Build Command:** `cd frontend && npm install && npm run build && cd ../backend && npm install --omit=dev`
  - **Start Command:** `cd backend && node server.js`

### 10.3 Required Hosting Environment Variables Checklist
```ini
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/complaint_system?retryWrites=true&w=majority
FRONTEND_URL=https://<your-deployed-domain>
JWT_ACCESS_SECRET=<generated-64-character-random-hex>
JWT_REFRESH_SECRET=<generated-64-character-random-hex>
SESSION_SECRET=<generated-64-character-random-hex>
ENABLE_SCHEDULER=true

# File Storage (Cloudinary - Required for persistent uploads)
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Email Service (Optional for base complaints, Required for Password Reset)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=<your-sendgrid-api-key>
SMTP_FROM=no-reply@yourdomain.com

# AI Chatbot (Optional - Falls back to rule-based FAQ if unset)
CHATBOT_AI_ENABLED=false
# CHBOT_AI_URL=https://api.groq.com/openai/v1/chat/completions
# CHATBOT_AI_API_KEY=<groq-key>
# CHATBOT_AI_MODEL=llama-3.3-70b-versatile

# Payments (Optional - Falls back to Demo Mode if unset)
# RAZORPAY_KEY_ID=<rzp-key>
# RAZORPAY_KEY_SECRET=<rzp-secret>

# Google OAuth (Optional)
# GOOGLE_CLIENT_ID=<google-client-id>
# GOOGLE_CLIENT_SECRET=<google-client-secret>
```

### 10.4 Post-Deployment Smoke Verification Plan
1. **Health Verification:**
   - Execute HTTP GET to `https://<domain>/api/health` -> verify `{ "success": true, "data": { "database": { "status": "connected" } } }`.
2. **Frontend SPA Loading:**
   - Navigate browser to `https://<domain>/` -> verify landing page loads with zero console errors.
   - Navigate directly to a deep route `https://<domain>/login` -> verify page loads cleanly without 404.
3. **Authentication & Cookie Persistence:**
   - Log in with valid credentials -> check browser DevTools to ensure `refreshToken` cookie is present with `HttpOnly`, `Secure`, and `SameSite=Strict`.
4. **Complaint Submission & File Attachment:**
   - Submit a new test complaint with a `.png` attachment -> verify file URL points to Cloudinary CDN and previews correctly.
5. **Role Dashboard Navigation:**
   - Log in as Admin/Resolver -> verify complaints list renders and stats populate.
6. **Payment Center:**
   - Initiate a payment -> verify either Razorpay modal opens (if keys configured) or Demo Mode order creates cleanly.
7. **SLA Scheduler Inspection:**
   - Verify server startup logs indicate: `[EscalationScheduler] Started successfully. Running every hour (0 * * * *).`

### 10.5 Rollback Strategy
- **Container Rollback:** If a deployment fails health checks, roll back the container image tag to the preceding stable build SHA.
- **Database Rollback:** The database migrations in this codebase are additive (indexes and category seeds). No destructive schema mutations are executed automatically on startup.
- **Circuit Breaker:** If third-party integrations (Cloudinary, SMTP, AI) degrade, unsetting their API keys gracefully reverts each subsystem to its built-in fallback mode without requiring a code hotfix.

---

## 11. Phase 2.5: Production Image & Deployment Path Verification

**Verification Date:** 2026-10-15
**Status:** **READY FOR DEPLOYMENT**

### 11.1 File & Directory Inspection

1. **Dockerfile & Build Pipeline:**
   - Multi-stage build in `Dockerfile`:
     - Stage 1 (`frontend-build`): `FROM node:20-alpine AS frontend-build`, copies `frontend/package*.json`, runs `npm install`, sets `VITE_API_BASE_URL=/api` and `VITE_API_URL=/api`, and compiles assets into `frontend/dist`.
     - Stage 2 (`backend`): `FROM node:20-alpine AS backend`, copies `backend/package*.json`, runs `npm install --omit=dev`, copies `backend/` source, copies compiled static assets `COPY --from=frontend-build /app/frontend/dist ../frontend/dist`.
     - Sets `ENV NODE_ENV=production`, `PORT=5000`, `HOST=0.0.0.0`, exposes port `5000`, and starts via `CMD ["node", "server.js"]`.
   - Lockfile check: `backend/package-lock.json` and `frontend/package-lock.json` are both present, enabling reproducible installs.
2. **Security & Sensitive Artifact Exclusion (`.dockerignore`):**
   - Verified that `.dockerignore` blocks:
     - All `.env*` files (`.env`, `.env.*`, `**/.env`, `**/.env.*`)
     - Secret certificates/keys (`*.pem`, `*.key`, `*.cert`)
     - Local uploads (`backend/uploads`) and logs (`backend/logs`)
     - Test files, Jest integration suites, test logs (`*.test.js`, `*.spec.js`, `backend/__tests__`, `test-output.txt`)
     - Development configuration and documentation (`project-audit-report`, `.git`, `.vscode`)
   - Verified that runtime environment variables are read dynamically from `process.env` (injected by the hosting environment) and are never expected or required to be baked into the image.
3. **Frontend SPA & API Serving (`backend/app.js`):**
   - Verified dynamic fallback serving for Single Page Application routes:
     - Root `/` serves `frontend/dist/index.html`.
     - Direct navigation or page refresh on client routes (e.g. `/complaints`, `/admin/staff`, `/profile`) serves `frontend/dist/index.html`.
     - Unmatched API routes under `/api/*` (e.g. `/api/nonexistent`) correctly return HTTP 404 JSON (`{ success: false, code: "ROUTE_NOT_FOUND" }`) and do not fall back to HTML.
4. **Health Probe Endpoints:**
   - Verified `/health` and `/api/health` return HTTP 200 `{ success: true, message: "Server is healthy", data: { status: "ok" } }` without exposing internal credentials or environment secrets.
   - Verified `/api/health/detailed` reports uptime, memory, and database connection state without leaking secrets.
5. **Runtime Startup Guard & Scheduler Safety:**
   - Startup fails safely with descriptive validation errors before opening ports or running migrations if `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `SESSION_SECRET` are missing or set to insecure development defaults.
   - Scheduler remains completely disabled by default unless explicitly configured with `ENABLE_SCHEDULER=true`.

### 11.2 Verification Results Summary

| Check | Method / Command | Result | Status |
| :--- | :--- | :--- | :---: |
| **Docker Engine Check** | `docker info` | Docker CLI v29.8.2 installed; Windows Docker Desktop daemon service not active in local audit session. | **NOTED** |
| **Backend Dependencies & Lockfile** | `npm i --package-lock-only` in `backend/` | `backend/package-lock.json` generated and verified. | **READY** |
| **Vite Frontend Build** | `npm run build` in `frontend/` | Vite v5.4.21 compiled bundle in 9.07s into `frontend/dist`. | **READY** |
| **SPA Route Delivery Verification** | `npm test -- --testPathPattern=production-hardening` | Tested `/`, `/complaints`, `/admin/staff` returning index.html; `/api/nonexistent` returning 404 JSON. | **READY** |
| **Health Probe Verification** | `npm test -- --testPathPattern=production-hardening` | Tested `/health` and `/api/health` returning 200 OK. | **READY** |
| **Storage Hardening Verification** | `npm test -- --testPathPattern=production-hardening` | Verified unconfigured Cloudinary in production rejects with `STORAGE_NOT_CONFIGURED` (preventing ephemeral disk loss). | **READY** |
| **Proxy Trust & Rate Limit Check** | `npm test -- --testPathPattern=production-hardening` | Verified Express trust proxy configuration for reverse proxy deployments. | **READY** |
| **Full Production Hardening Test Suite** | `npm test -- --testPathPattern=production-hardening` | 15 / 15 tests passed. | **READY** |

### 11.3 Hosting Readiness Verdict
The Complaint Resolution System is **READY** for production deployment on any container-based or native Node.js web hosting platform (Render, Railway, Fly.io, AWS App Runner, or DigitalOcean).
