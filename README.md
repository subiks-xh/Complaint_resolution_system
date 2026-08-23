# Complaint Resolution and Escalation System (CRS)

An enterprise-grade, full-stack MERN application designed to streamline organizational grievance handling with automated SLA tracking and hierarchical escalation.

## 🚀 Key Features

- **Multi-Role Dashboards**: Custom interfaces for Users (Complainants), Staff (Resolvers), and Administrators.
- **Automated Escalation**: Integrated cron-job system that automatically escalates tickets to senior management if resolution deadlines are breached.
- **SLA Management**: Per-category Service Level Agreements with dynamic deadline calculation.
- **Real-time Analytics**: Visualized performance data for admins using Recharts.
- **File Management**: Support for multi-file attachments using Multer and Cloudinary.
- **Secure Auth**: JWT-based authentication with high-security HTTP-only cookies and token rotation.

## 🛠️ Tech Stack

**Frontend:** React 18, Tailwind CSS, Vite, Lucide Icons, Recharts, React Hook Form, Zod.
**Backend:** Node.js, Express.js, MongoDB (Mongoose), Node-Cron, JWT, Multer.
**DevOps:** Docker, GitHub Actions (optional).

## 📦 Folder Structure

```text
complaint-resolution-system/
├── backend/            # Express API, MongoDB Models, Controllers
├── frontend/           # React SPA, Tailwind CSS, Context API
├── docker-compose.yml  # Container orchestration
└── README.md           # Documentation
```

## 🚀 Deployment

### Docker Compose

1. Copy `backend/.env.example` to `backend/.env` and fill in production values.
2. Build and start the stack:

```bash
docker compose up --build
```

3. Open the app at `http://localhost:5000`.

### Manual Production Build

1. Install backend and frontend dependencies.
2. Build the frontend:

```bash
cd frontend
npm run build
```

3. Start the backend in production mode:

```bash
cd backend
set NODE_ENV=production
node server.js
```

In production, the backend serves the built frontend from `frontend/dist` and exposes the API under `/api`.
