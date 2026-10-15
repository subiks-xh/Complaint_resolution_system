# CRS Production Deployment Guide — Single Web Service Architecture

**Project:** Complaint Resolution System (`d:/complaint-resolution-system`)
**Deployment Target:** Unified Single Web Service (Express serves Frontend SPA + API)
**Document Version:** 1.0.0 (Phase 2 Hardened)

---

## 1. Hosting Architecture Overview

The Complaint Resolution System is architected to run as a **single, unified web service**.
- **Frontend:** React + Vite SPA, precompiled into static assets in `frontend/dist`.
- **Backend:** Node.js / Express serving:
  - Static frontend assets from `frontend/dist`.
  - Client-side routing fallback regex `app.get(/^\/(?!api(?:\/|$)).*/)` returning `index.html`.
  - JSON REST APIs under `/api/*`.
  - Health probe endpoints at `/health` and `/api/health`.
- **Recommended Cloud Hosting Platforms:**
  - **Render** (Web Service, Docker Runtime or Node Environment)
  - **Railway** (Web Service, Dockerfile builder)
  - **Fly.io** (Single machine app)
  - **AWS App Runner** or **AWS ECS/Fargate** with an Application Load Balancer
  - **DigitalOcean App Platform**

---

## 2. Build & Start Commands

### 2.1 Containerized Deployment (Recommended: Docker)
The repository contains a multi-stage `Dockerfile`:
```bash
# Build the production container image
docker build -t crs-production:latest .

# Run container locally or in staging (example port mapping)
docker run -d \
  --name crs-app \
  -p 5000:5000 \
  --env-file .env.production \
  crs-production:latest
```

### 2.2 Native Node.js PaaS Deployment (e.g. Render / Railway Native)
If deploying without Docker directly in a Node 18+ or 20+ runtime:
- **Build Command:**
  ```bash
  npm --prefix frontend install && npm --prefix frontend run build && npm --prefix backend install --omit=dev
  ```
- **Start Command:**
  ```bash
  cd backend && node server.js
  ```

---

## 3. Environment Variables Reference

Never commit `.env` or secret values to version control. The application will safely fail to start in production if mandatory secrets are missing or using default development placeholders.

### 3.1 Generating Secure Secrets
Generate cryptographically strong 64-character hex strings for the three core secrets:
```bash
# Run in bash / terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Generate three distinct keys:
1. One for `JWT_ACCESS_SECRET`
2. One for `JWT_REFRESH_SECRET`
3. One for `SESSION_SECRET`

### 3.2 Environment Variable Matrix

| Variable | Requirement in Production | Description / Format | Example (Non-secret) |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Mandatory** | Enables production security, cookie flags, and strict validation. | `production` |
| `PORT` | Optional | Port for HTTP server (PaaS providers inject this automatically). | `5000` |
| `HOST` | Optional | Interface to bind to. Inside Docker/PaaS, must be `0.0.0.0`. | `0.0.0.0` |
| `FRONTEND_URL` | **Mandatory** | Canonical HTTPS origin for CORS, CSRF, and cookies. | `https://crs.yourdomain.com` |
| `MONGODB_URI` | **Mandatory** | MongoDB Atlas connection string with replica set credentials. | `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/complaint_system?retryWrites=true&w=majority` |
| `DB_NAME` | Optional | Database name override (defaults to `complaint_system`). | `complaint_system` |
| `JWT_ACCESS_SECRET` | **Mandatory** | Cryptographic key for 15-minute access tokens (>= 32 chars). | *(Generated random hex)* |
| `JWT_REFRESH_SECRET`| **Mandatory** | Cryptographic key for 7-day refresh tokens (>= 32 chars). Must differ from access secret. | *(Generated random hex)* |
| `SESSION_SECRET` | **Mandatory** | Secret for express-session cookie signing (>= 32 chars). | *(Generated random hex)* |
| `TRUST_PROXY` | Recommended | Number of reverse proxy hops to trust (defaults to `1` in production). | `1` |
| `ENABLE_SCHEDULER` | **Mandatory** | Controls SLA hourly escalation cron. **Must be `true` on only 1 instance**. | `true` |
| `CLOUDINARY_CLOUD_NAME` | **Mandatory for uploads** | Cloudinary account cloud name. Required to prevent ephemeral disk loss. | `my-crs-cloud` |
| `CLOUDINARY_API_KEY` | **Mandatory for uploads** | Cloudinary API Key. | `123456789012345` |
| `CLOUDINARY_API_SECRET` | **Mandatory for uploads** | Cloudinary API Secret. | `abcde_SecretKey_12345` |
| `SMTP_HOST` | Conditional | SMTP mail host (e.g. SendGrid, Mailgun, Amazon SES). Required for password resets. | `smtp.sendgrid.net` |
| `SMTP_PORT` | Conditional | SMTP port (`587` for STARTTLS, `465` for SSL). | `587` |
| `SMTP_SECURE` | Conditional | Use SSL (`true` for port 465, `false` for port 587). | `false` |
| `SMTP_USER` | Conditional | SMTP username / API user. | `apikey` |
| `SMTP_PASS` | Conditional | SMTP password / API token. | *(SendGrid API key)* |
| `SMTP_FROM` | Conditional | 'From' header email. | `no-reply@yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Client ID for Google login. | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth 2.0 Client Secret. | *(Google secret)* |
| `RAZORPAY_KEY_ID` | Optional | Razorpay key ID. If omitted, operates in Demo Mode. | `rzp_live_xxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay key secret. | *(Razorpay secret)* |
| `CHATBOT_AI_ENABLED` | Optional | Set to `true` to enable external LLM provider; `false` uses built-in rules. | `false` |
| `CHATBOT_AI_URL` | Optional | Provider endpoint (Groq/OpenAI compatible). | `https://api.groq.com/openai/v1/chat/completions` |
| `CHATBOT_AI_API_KEY` | Optional | Provider API key. | `gsk_xxxxxx` |
| `CHATBOT_AI_MODEL` | Optional | Model identifier. | `llama-3.3-70b-versatile` |

---

## 4. Integration Setup Requirements

### 4.1 MongoDB Atlas Setup
1. Create a MongoDB Atlas cluster (M0 free tier or M10+ dedicated cluster).
2. **Network Access:**
   - In Atlas Dashboard, go to **Network Access** > **IP Access List**.
   - Add the outbound IP(s) of your hosting service. If hosting on dynamic cloud PaaS (Render/Railway), add `0.0.0.0/0` (secured with strong database user credentials and TLS).
3. **Database User:**
   - Create a dedicated user with `readWrite` permissions on `complaint_system`.
4. **Automated Backups:**
   - On Atlas M10+, ensure **Continuous Cloud Backups (PITR)** is enabled with minimum 7-day retention.
   - On free M0 tiers, perform periodic exports using `mongodump`.

### 4.2 Cloudinary Storage Setup
1. Sign up for a Cloudinary account at [cloudinary.com](https://cloudinary.com).
2. Retrieve your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary Console Dashboard.
3. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in your hosting dashboard.
4. *Hardening Protection:* If these variables are not configured in production, any file upload will fail safely with HTTP 500 (`STORAGE_NOT_CONFIGURED`) rather than saving to ephemeral container storage.

### 4.3 Google OAuth 2.0 Callback Configuration
If enabling Google authentication:
1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Navigate to your OAuth 2.0 Client ID.
3. Under **Authorized JavaScript origins**, add your public HTTPS domain:
   - `https://crs.yourdomain.com`
4. Under **Authorized redirect URIs**, add:
   - `https://crs.yourdomain.com/login`
   - `https://crs.yourdomain.com/onboarding`
   - `https://crs.yourdomain.com/api/auth/google/callback`

### 4.4 Razorpay Payment Gateway & Webhooks
If accepting live payments:
1. Create an account at [razorpay.com](https://razorpay.com) and generate Live API Keys.
2. In Razorpay Dashboard > **Settings** > **Webhooks**:
   - Webhook URL: `https://crs.yourdomain.com/api/payments/webhook`
   - Secret: Configure in environment if required by controller.
   - Events: `payment.captured`, `payment.failed`, `order.paid`.
3. If Razorpay keys are omitted, the application automatically functions in **Demo Payment Mode**.

---

## 5. Escalation Scheduler & Scaling Strategy

- The complaint escalation engine runs an hourly background cron (`0 * * * *`) that promotes pending complaints past their SLA deadline.
- **Initial Deployment Configuration:**
  - Launch with **1 backend instance** with `ENABLE_SCHEDULER=true`.
- **Horizontal Scaling Rule:**
  - If auto-scaling or running multiple container instances in the future, set `ENABLE_SCHEDULER=false` on all web traffic instances, and run a dedicated background worker instance with `ENABLE_SCHEDULER=true`. This avoids duplicate SLA evaluations and duplicate notifications.

---

## 6. Reverse Proxy & Rate Limiting Verification

- The backend sets `app.set('trust proxy', 1)` in production.
- This ensures Express extracts the client's true IP from the `X-Forwarded-For` header set by Render/Cloudflare/ALB instead of using the internal gateway IP.
- Rate limiting configurations (`loginLimiter`, `passwordResetLimiter`, `sensitiveOperationLimiter`) will track real client IPs, preventing global lockouts behind cloud load balancers.

---

## 7. Post-Deployment Verification & Health Checks

### Step 1: Health Probes
```bash
# Basic Health Probe
curl -i https://crs.yourdomain.com/health
# Expected: HTTP 200 OK
# {"success":true,"message":"Server is healthy","data":{"status":"ok",...}}

# Detailed Health Probe
curl -i https://crs.yourdomain.com/api/health/detailed
# Expected: HTTP 200 OK with database: { "status": "connected", "connected": true }
```

### Step 2: SPA Route Navigation
Open `https://crs.yourdomain.com/` in an incognito browser window:
- Verify the landing page loads cleanly.
- Directly enter deep routes like `https://crs.yourdomain.com/login` and `https://crs.yourdomain.com/complaints` and refresh the page to confirm SPA fallback does not return 404.

### Step 3: Authentication & Cookie Test
- Log in with credentials.
- Open Browser DevTools > Application > Cookies:
  - Verify `refreshToken` cookie exists with `HttpOnly=true`, `Secure=true`, and `SameSite=Strict`.

### Step 4: Attachment Upload Test
- Submit a complaint with an image attachment.
- Inspect the complaint in the dashboard:
  - Verify the attachment URL begins with `https://res.cloudinary.com/...`.

---

## 8. Rollback and Disaster Recovery

1. **Zero-Downtime Image Rollback:**
   - If a deployed image fails health checks (`/health`), roll back to the previously tagged Docker image or commit SHA in your hosting dashboard.
2. **Database Safe Migrations:**
   - The database uses additive Mongoose schemas and auto-indexes. No destructive database drops or migrations are triggered on boot.
3. **External Service Outage Fallback:**
   - If AI provider or Razorpay services experience outages, their failure modes are built-in:
     - Chatbot reverts to deterministic rule-based guidance.
     - Payments revert to Demo Mode if keys are removed.
