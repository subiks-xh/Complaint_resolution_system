# 🚀 Deployment Guide - Complaint Resolution System

**Version:** 1.0.0  
**Last Updated:** March 2026  
**For Review:** Complete production-ready deployment instructions

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Testing](#testing)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment (Heroku/AWS)](#cloud-deployment)
6. [Production Checklist](#production-checklist)
7. [Troubleshooting](#troubleshooting)
8. [Environment Configuration](#environment-configuration)

---

## 📦 Prerequisites

### System Requirements

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB:** v5.0 or higher (Local) or MongoDB Atlas (Cloud)
- **Git:** v2.0 or higher
- **Docker:** (Optional, for containerized deployment)
- **RAM:** Minimum 2GB
- **Disk Space:** Minimum 5GB

### Required Accounts

1. **MongoDB Atlas** - Database hosting
2. **Cloudinary** - File upload and image management
3. **Email Service** - Gmail, SendGrid, or Mailgun for email notifications
4. **Heroku/AWS** - (Optional, for cloud hosting)

---

## 🛠️ Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd complaint-resolution-system
```

### Step 2: Install Dependencies

#### Backend

```bash
cd backend
npm install
```

#### Frontend

```bash
cd ../frontend
npm install
```

### Step 3: Environment Configuration

#### Backend (.env)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/complaint-system

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=7d

# Cloudinary (File Storage)
CLOUDINARY_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Service (Gmail example)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Escalation
ESCALATION_CHECK_INTERVAL=3600000
```

#### Frontend (.env)

```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=CRS Portal
```

### Step 4: Database Setup

#### Option A: Local MongoDB

```bash
# Install MongoDB if not already installed
# macOS
brew install mongodb-community

# Windows
# Download from https://www.mongodb.com/try/download/community

# Start MongoDB
mongod
```

#### Option B: MongoDB Atlas (Recommended for Production)

1. Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create cluster
4. Get connection string
5. Add to `MONGODB_URI` in `.env`

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/complaint-system
```

### Step 5: Seed Initial Data

```bash
cd backend
npm run seed:categories
npm run seed:users
```

### Step 6: Start Development Servers

#### Terminal 1 - Backend

```bash
cd backend
npm run dev
# Backend runs on http://localhost:3000
```

#### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Step 7: Access Application

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **API Docs:** http://localhost:3000/api-docs
- **Test Account:**
  - Email: `user@example.com`
  - Password: (check seed script)

---

## 🧪 Testing

### Run All Tests

```bash
cd backend
npm test
```

### Run Specific Test Suite

```bash
npm test -- __tests__/middleware/auth.test.js
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Watch Mode (For Development)

```bash
npm run test:watch
```

---

## 🐳 Docker Deployment

### Step 1: Build Docker Images

```bash
# From project root
docker-compose build
```

### Step 2: Run Containers

```bash
docker-compose up -d
```

### Step 3: Verify Services

```bash
# Check running containers
docker-compose ps

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access services
# Frontend: http://localhost:80
# API: http://localhost:3000
```

### Step 4: Initialize Database

```bash
docker-compose exec backend npm run seed:categories
docker-compose exec backend npm run seed:users
```

### Step 5: Stop Services

```bash
docker-compose down
```

---

## ☁️ Cloud Deployment

### Option 1: Heroku Deployment

#### Create Heroku Account

1. Sign up at [Heroku](https://www.heroku.com)
2. Install Heroku CLI

#### Deploy Backend

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create complaint-resolution-api

# Add MongoDB Atlas URI
heroku config:set MONGODB_URI=mongodb+srv://...

# Add other configs
heroku config:set JWT_SECRET=your-secret-key
heroku config:set CLOUDINARY_NAME=your-name
heroku config:set EMAIL_SERVICE=gmail
heroku config:set EMAIL_USER=your-email
heroku config:set EMAIL_PASSWORD=your-password
heroku config:set FRONTEND_URL=https://your-frontend-url

# Deploy
git subtree push --prefix backend heroku main

# Check logs
heroku logs --tail
```

#### Deploy Frontend

```bash
# Create separate Heroku app
heroku create complaint-resolution-ui

# Deploy frontend
git subtree push --prefix frontend heroku main

# Set API URL
heroku config:set VITE_API_URL=https://complaint-resolution-api.herokuapp.com
```

### Option 2: AWS EC2 Deployment

#### Step 1: Launch EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com)
2. Launch Ubuntu 20.04 LTS t2.micro instance
3. Create/select security group (allow ports 80, 443, 3000, 5173)
4. Create key pair (save .pem file)
5. Copy public IP address

#### Step 2: Connect to Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-public-ip
```

#### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git
```

#### Step 4: Clone and Deploy

```bash
# Clone repository
git clone <repository-url>
cd complaint-resolution-system

# Backend setup
cd backend
npm install
npm run build

# Frontend setup
cd ../frontend
npm install
npm run build
```

#### Step 5: Configure Nginx

Create `/etc/nginx/sites-available/complaint-system`:

```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/complaint-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Start Services

```bash
cd /path/to/backend
npm run start &
cd /path/to/frontend
npm run preview &
```

---

## ✅ Production Checklist

### Security

- [ ] Change all default credentials
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/SSL certificates
- [ ] Set strong JWT_SECRET
- [ ] Configure rate limiting appropriately
- [ ] Setup CORS properly (whitelist domains)
- [ ] Enable database authentication
- [ ] Setup firewall rules
- [ ] Enable MongoDB encryption
- [ ] Enable Cloudinary API security

### Performance

- [ ] Enable database indexes
- [ ] Setup caching strategy (Redis)
- [ ] Compress API responses
- [ ] Optimize frontend bundle
- [ ] Setup CDN for static assets
- [ ] Enable gzip compression in Nginx
- [ ] Setup monitoring/APM

### Monitoring & Logging

- [ ] Setup application logging (Winston)
- [ ] Setup error tracking (Sentry)
- [ ] Setup uptime monitoring
- [ ] Setup email alerts
- [ ] Setup database backups
- [ ] Enable audit logging

### Database

- [ ] Daily automated backups
- [ ] Test backup restoration
- [ ] Setup replication
- [ ] Monitor database size
- [ ] Setup alerts for space usage

### Email Service

- [ ] Verify sender email domain
- [ ] Setup SPF/DKIM/DMARC records
- [ ] Test email delivery
- [ ] Setup email templates
- [ ] Monitor email send rate

### SSL/TLS

- [ ] Install SSL certificate
- [ ] Configure HTTPS redirect
- [ ] Enable HSTS header
- [ ] Setup certificate auto-renewal

### Deployment

- [ ] Document deployment process
- [ ] Create rollback procedure
- [ ] Setup CI/CD pipeline
- [ ] Test failover scenarios
- [ ] Document contact information

---

## 🔧 Environment Configuration

### Development (.env)

```env
NODE_ENV=development
DEBUG=true
MONGODB_URI=mongodb://localhost:27017/complaint-system
JWT_SECRET=dev-secret-key
```

### Production (.env)

```env
NODE_ENV=production
DEBUG=false
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/complaint-system
JWT_SECRET=production-super-secret-key
FRONTEND_URL=https://your-domain.com
API_URL=https://api.your-domain.com
```

### Testing (.env.test)

```env
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/complaint-system-test
JWT_SECRET=test-secret-key
```

---

## 🐛 Troubleshooting

### MongoDB Connection Fails

```bash
# Check if MongoDB is running
mongosh

# If not installed, install MongoDB
# macOS: brew install mongodb-community
# Ubuntu: sudo apt install mongodb-org

# If using MongoDB Atlas, ensure:
# 1. IP whitelist includes your IP
# 2. Username and password are correct
# 3. Connection string format is correct
```

### Port Already in Use

```bash
# Find process using port 3000
# macOS/Linux:
lsof -i :3000

# Windows:
netstat -ano | findstr :3000

# Kill process
kill -9 <PID>
```

### Environment Variables Not Loading

```bash
# Ensure .env file is in correct directory
# Backend: complaint-resolution-system/backend/.env
# Frontend: complaint-resolution-system/frontend/.env

# Restart dev server after changing .env
```

### Tests Failing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose
```

### Docker Issues

```bash
# Remove all containers and images
docker-compose down -v
docker system prune -a

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up
```

---

## 📞 Support & Documentation

- **API Documentation:** `http://localhost:3000/api-docs`
- **GitHub Issues:** [Project Repository]
- **Email Support:** support@complaint-system.com
- **Documentation:** [Wiki/Docs](./docs)

---

## 📝 Version History

- **v1.0.0** (March 2026) - Initial release

---

**Last Updated:** March 23, 2026  
**Status:** ✅ Production Ready
