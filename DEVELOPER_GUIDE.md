# Developer Guide

## 1. Project Structure

- `backend/`: Express API, Mongo models, middleware, controllers, routes
- `frontend/`: React + Vite app, components, pages, services

## 2. Local Setup

### Backend

1. Copy `.env.example` values into local env.
2. Install deps: `npm install`
3. Start dev server: `npm run dev`

### Frontend

1. Configure `VITE_API_URL` if needed.
2. Install deps: `npm install`
3. Start dev server: `npm run dev`

## 3. Testing

- Backend: `npm test`
- Frontend: `npm test`
- Frontend build: `npm run build`

## 4. API Docs

- Swagger available at `/api-docs`

## 5. Logging & Monitoring

- Winston logger in backend
- Request/action logging middleware
- Sentry optional via env DSN
- Audit logs persisted in `AuditLog` model

## 6. Key Backend Features

- Security headers, input sanitization, NoSQL sanitization
- Route-level validation via `validateRequest`
- CSRF/session middleware support
- Bulk import and report export (json/csv/pdf)

## 7. Data Ops

- Backup and retention policy: `BACKUP_AND_RETENTION.md`

## 8. Contribution Notes

- Keep changes scoped and minimal.
- Add/extend validators for new endpoints.
- Update docs when behavior or routes change.
