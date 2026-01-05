# 🔧 A2 Hosting Setup Guide - Complete Configuration

## 📁 Required Files for A2 Hosting

### 1. `.htaccess` (Apache Configuration)
**Location:** Root of your app directory  
**Purpose:** Tells Apache how to route requests to your Node.js app

```apache
PassengerEnabled on
PassengerAppRoot /home/YOUR_USERNAME/repositories/DSScreenBackend
PassengerAppType node
PassengerStartupFile index.js
PassengerNodejs /usr/bin/node
PassengerAppEnv production
```

**⚠️ Important:** Update `PassengerAppRoot` with your actual path!

---

### 2. `index.js` (Application Entry Point)
**Location:** Root of your app directory  
**Purpose:** Main file that starts your Node.js app

✅ You already have this file!

---

### 3. `.env` (Environment Variables)
**Location:** Root of your app directory  
**Purpose:** Store sensitive configuration

```bash
# Database
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=production
BASE_URL=https://yourdomain.com

# JWT Secret
JWT_SECRET=your-super-secret-key-change-this
SESSION_SECRET=your-session-secret-change-this

# AWS S3 (if using)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
```

**⚠️ Never commit .env to git!**

---

### 4. `.gitignore`
**Location:** Root of your app directory  
**Purpose:** Tell git which files to ignore

✅ You already have this file!

---

### 5. `package.json`
**Location:** Root of your app directory  
**Purpose:** Define dependencies and scripts

✅ You already have this file!

---

### 6. `tmp/restart.txt` (Passenger Restart Trigger)
**Location:** `tmp/restart.txt` inside app directory  
**Purpose:** Touch this file to restart your app

```bash
mkdir -p tmp
touch tmp/restart.txt
```

---

## 📂 Directory Structure on A2 Hosting

```
/home/logicalv/
├── public_html/                    # Web root (usually not used for Node.js)
├── repositories/                   # Your git repositories
│   └── DSScreenBackend/           # Your app (this is where it runs from)
│       ├── .htaccess              # ✅ Apache config
│       ├── .env                   # ✅ Environment variables
│       ├── .gitignore             # ✅ Git ignore
│       ├── index.js               # ✅ App entry point
│       ├── package.json           # ✅ Dependencies
│       ├── routes/                # ✅ Your routes
│       ├── models/                # ✅ Your models
│       ├── views/                 # ✅ Your views
│       ├── public/                # ✅ Static files
│       ├── node_modules/          # Dependencies (auto-generated)
│       ├── tmp/                   # Passenger restart
│       │   └── restart.txt        # Touch to restart
│       ├── stderr.log             # Error logs
│       ├── app.log                # App logs
│       └── videos/                # Your videos
└── logs/                          # System logs (if any)
```

---

## ⚙️ cPanel Configuration

### 1. Setup Node.js App

**Location:** cPanel → Software → Setup Node.js App

**Configuration:**
```
Application Mode:      production
Application Root:      repositories/DSScreenBackend
Application URL:       yourdomain.com
Application Startup:   index.js
Node.js Version:       18.x or higher (recommended: latest LTS)
```

**Environment Variables (add these in cPanel interface):**
- `NODE_ENV` = `production`
- `PORT` = `3000` (or whatever port assigned)
- Other variables from your `.env` file

---

### 2. Git™ Version Control

**Location:** cPanel → Files → Git™ Version Control

**Configuration:**
```
Clone URL:         https://github.com/YOUR_USERNAME/DSScreenBackend.git
Repository Path:   repositories/DSScreenBackend
Branch:            test_host (or master)
```

**After creating:**
- Click "Manage"
- Copy SSH public key
- Add to GitHub Deploy Keys

---

### 3. Database Setup (PostgreSQL)

**Location:** cPanel → Databases → PostgreSQL Database Wizard

1. **Create Database:**
   - Name: `dsscreen` or similar
   
2. **Create User:**
   - Username: `dsuser`
   - Password: (strong password)
   
3. **Add User to Database:**
   - Grant ALL PRIVILEGES

4. **Get Connection Info:**
   - Host: Usually `localhost`
   - Port: `5432`
   - Update your `.env` file

---

### 4. SSL Certificate (HTTPS)

**Location:** cPanel → Security → SSL/TLS Status

1. Run AutoSSL or Let's Encrypt
2. Enable HTTPS for your domain
3. Update `.htaccess` to force HTTPS (uncomment the lines)

---

## 🔧 Configuration Files Explained

### `.htaccess` Configuration Options

```apache
# Enable Passenger
PassengerEnabled on

# Path to your app (CHANGE THIS!)
PassengerAppRoot /home/YOUR_USERNAME/repositories/DSScreenBackend

# App type (node, python, ruby)
PassengerAppType node

# Entry file
PassengerStartupFile index.js

# Node.js binary path (usually this)
PassengerNodejs /usr/bin/node

# Or if using specific Node version via nvm:
# PassengerNodejs /home/YOUR_USERNAME/.nvm/versions/node/v18.x.x/bin/node

# Environment (production or development)
PassengerAppEnv production

# Memory limit (optional)
PassengerMaxPoolSize 6
PassengerMinInstances 1

# Keep alive (optional)
PassengerMaxRequestQueueSize 100
```

---

## 🚀 Initial Deployment Steps

### Step 1: Create Git Repository in cPanel

1. **Git™ Version Control** → **Create**
2. Enter your GitHub repo URL
3. Set path: `repositories/DSScreenBackend`
4. Select branch: `test_host`
5. Click **Create**

### Step 2: Create .env File

```bash
# SSH to server
ssh logicalv@your-server.com

# Navigate to app
cd ~/repositories/DSScreenBackend

# Create .env from template
nano .env

# Add your variables (see .env section above)
# Press Ctrl+X, Y, Enter to save
```

### Step 3: Install Dependencies

Via cPanel:
- **Setup Node.js App** → **Run NPM Install**

Or via SSH:
```bash
cd ~/repositories/DSScreenBackend
npm install --production
```

### Step 4: Run Migrations

```bash
cd ~/repositories/DSScreenBackend
npm run migrate:run
```

### Step 5: Configure Setup Node.js App

1. **Setup Node.js App** → **Create Application**
2. Fill in configuration (see above)
3. Click **Create**

### Step 6: Start the App

- Click **"Start App"** in Setup Node.js App interface
- Wait 30 seconds
- Test: `https://yourdomain.com/health`

---

## 🔄 Update/Restart Workflow

### When You Push New Code:

**Option 1: Via cPanel**
```
1. Git™ Version Control → Manage → Pull
2. Setup Node.js App → Restart
3. Done!
```

**Option 2: Via SSH**
```bash
cd ~/repositories/DSScreenBackend
git pull origin test_host
npm install --production
npm run migrate:run
touch tmp/restart.txt
```

---

## 🐛 Troubleshooting

### App Won't Start (503 Error)

1. **Check logs:**
   ```bash
   cd ~/repositories/DSScreenBackend
   tail -50 stderr.log
   tail -50 app.log
   ```

2. **Test manually:**
   ```bash
   cd ~/repositories/DSScreenBackend
   node index.js
   # Watch for errors
   ```

3. **Check Node version:**
   ```bash
   node -v  # Should be 18.x or higher
   ```

4. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install --production
   ```

### Can't Connect to Database

1. **Check credentials in .env**
2. **Test connection:**
   ```bash
   psql -h localhost -U dsuser -d dsscreen
   ```
3. **Check if PostgreSQL is running:**
   - cPanel → PostgreSQL Databases

### Git Pull Not Working

1. **Check SSH key:**
   - cPanel → Git™ Version Control → Manage
   - Copy public key
   - Add to GitHub Deploy Keys

2. **Or use HTTPS with credentials**

### Changes Not Showing

1. **Pull latest code:**
   ```bash
   git pull origin test_host
   ```

2. **Force restart:**
   ```bash
   touch tmp/restart.txt
   ```

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R

---

## 📋 Checklist for A2 Hosting Setup

- [ ] `.htaccess` file created and configured
- [ ] `.env` file created with all variables
- [ ] Git repository set up in cPanel
- [ ] SSH deploy key added to GitHub
- [ ] Node.js app configured in cPanel
- [ ] Node.js version 18+ selected
- [ ] Database created and configured
- [ ] Dependencies installed (`npm install`)
- [ ] Migrations run (`npm run migrate:run`)
- [ ] App started and running
- [ ] SSL/HTTPS configured
- [ ] Test endpoints working

---

## 🔐 Security Best Practices

1. **Never commit .env to git**
2. **Use strong passwords for database**
3. **Enable HTTPS/SSL**
4. **Keep dependencies updated:** `npm audit fix`
5. **Restrict file permissions:**
   ```bash
   chmod 600 .env
   chmod 755 tmp
   ```
6. **Add security headers in .htaccess**

---

## 📞 A2 Hosting Support

If you need help:
- **Live Chat:** Available 24/7
- **Ticket System:** Login to A2 account
- **Knowledge Base:** https://www.a2hosting.com/kb/

Common questions to ask:
- "Where is my Node.js application root?"
- "What Node.js versions are available?"
- "How do I check Passenger logs?"
- "Is ffmpeg available on my server?"

---

## ✅ Quick Reference Commands

```bash
# Navigate to app
cd ~/repositories/DSScreenBackend

# Pull latest code
git pull origin test_host

# Install dependencies
npm install --production

# Run migrations
npm run migrate:run

# Restart app
touch tmp/restart.txt

# Check if running
ps aux | grep node

# View logs
tail -f stderr.log
tail -f app.log

# Test endpoint
curl http://localhost:3000/health
```

---

Your app should now be fully configured for A2 Hosting! 🎉

