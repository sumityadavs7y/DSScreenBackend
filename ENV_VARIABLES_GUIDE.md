# 🔐 Environment Variables Setup for A2 Hosting

Your app uses environment variables for configuration. There are **3 ways** to set them on A2 Hosting.

---

## ✅ Method 1: .env File (RECOMMENDED)

Your app already uses `dotenv` which loads variables from a `.env` file.

### **On Your Server:**

```bash
# SSH to server
ssh logicalv@your-server.com

# Navigate to app
cd /home/logicalv/repositories/DSScreenBackend

# Create .env file
nano .env
```

### **Add Your Variables:**

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Database Configuration
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logicalv_dsscreen
DB_USER=logicalv_dsuser
DB_PASSWORD=your_secure_password_here

# JWT & Session Secrets
JWT_SECRET=change-this-to-a-random-string-min-32-chars
JWT_REFRESH_SECRET=change-this-to-another-random-string
SESSION_SECRET=change-this-to-yet-another-random-string

# AWS S3 Configuration (if using)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name
USE_S3=false

# Other Settings
MAX_FILE_SIZE=524288000
ALLOWED_VIDEO_TYPES=video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/webm
```

### **Save and Exit:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

### **Secure the File:**
```bash
chmod 600 .env
```

### **Restart App:**
```bash
touch tmp/restart.txt
```

---

## ✅ Method 2: cPanel Node.js Setup Interface

### **Steps:**

1. **Login to cPanel**
2. **Software** → **Setup Node.js App**
3. Click on your application
4. Scroll to **"Environment variables"** section
5. Click **"Add Variable"**
6. Add each variable:
   ```
   Name: NODE_ENV
   Value: production
   ```
7. Click **"Save"**
8. Repeat for all variables
9. Click **"Restart"** app

### **Pros:**
- ✅ Secure (not in code)
- ✅ Easy to update via UI

### **Cons:**
- ⚠️ Must add each variable manually
- ⚠️ Can't be version controlled

---

## ✅ Method 3: .htaccess File

You can set environment variables in `.htaccess` using `SetEnv`:

### **Edit .htaccess:**

```apache
# Environment Variables
SetEnv NODE_ENV production
SetEnv PORT 3000
SetEnv DB_HOST localhost
SetEnv DB_NAME logicalv_dsscreen
SetEnv DB_USER logicalv_dsuser
SetEnv DB_PASSWORD your_password
SetEnv JWT_SECRET your_secret_key
SetEnv SESSION_SECRET your_session_secret
```

### **Pros:**
- ✅ Easy to set multiple variables
- ✅ Can be committed to git (if not sensitive)

### **Cons:**
- ⚠️ Less secure (visible in .htaccess)
- ⚠️ Not recommended for secrets

---

## 🎯 Which Method to Use?

### **Best Practice (Use This!):**

**Sensitive Variables (secrets, passwords):**
- Use **Method 1 (.env file)** ✅
- Never commit `.env` to git
- Add `.env` to `.gitignore` (already done)

**Non-Sensitive Variables (NODE_ENV, PORT):**
- Can use **Method 3 (.htaccess)** ✅
- Or use **Method 2 (cPanel UI)** ✅

---

## 📋 Required Environment Variables

### **Essential (Must Set):**

```bash
NODE_ENV=production           # Run in production mode
PORT=3000                     # Port number (A2 assigns this)
BASE_URL=https://yourdomain.com  # Your domain
```

### **Database (Must Set):**

```bash
DB_DIALECT=postgres           # postgres or sqlite
DB_HOST=localhost            # Database host
DB_PORT=5432                 # PostgreSQL port
DB_NAME=logicalv_dsscreen    # Your database name
DB_USER=logicalv_dsuser      # Database user
DB_PASSWORD=***              # Database password
```

### **Security (Must Set):**

```bash
JWT_SECRET=***               # JWT token secret (min 32 chars)
JWT_REFRESH_SECRET=***       # JWT refresh secret (min 32 chars)
SESSION_SECRET=***           # Session secret (min 32 chars)
```

### **Optional:**

```bash
# AWS S3 (only if using S3 for video storage)
USE_S3=false
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
AWS_REGION=us-east-1
AWS_BUCKET_NAME=***

# File Upload Limits
MAX_FILE_SIZE=524288000      # 500MB default
ALLOWED_VIDEO_TYPES=video/mp4,video/mpeg,video/quicktime
```

---

## 🔐 Generating Secure Secrets

For `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET`:

### **Method 1: Via Terminal**

```bash
# Generate random 64-character string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### **Method 2: Via OpenSSL**

```bash
openssl rand -hex 64
```

### **Method 3: Online Generator**
- Use: https://randomkeygen.com/ (choose "Fort Knox Passwords")
- Or: https://www.grc.com/passwords.htm

**Important:** Generate **different** secrets for each variable!

---

## 🧪 Testing Environment Variables

### **Check if Variables are Loaded:**

Create a test endpoint (remove after testing):

```javascript
// In routes/index.js - TEMPORARY TEST ONLY
router.get('/env-test', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    // Don't expose actual secrets!
  });
});
```

Test:
```bash
curl https://yourdomain.com/env-test
```

**Remove this endpoint after testing!**

---

## 🐛 Troubleshooting

### **Problem: Variables Not Loading**

**Check 1: .env file exists**
```bash
cd /home/logicalv/repositories/DSScreenBackend
ls -la .env
```

**Check 2: .env file has correct content**
```bash
cat .env
# Should show your variables
```

**Check 3: App loads dotenv**
```bash
grep "dotenv" index.js
# Should show: require('dotenv').config();
```

**Check 4: Restart app after changing .env**
```bash
touch tmp/restart.txt
```

### **Problem: Database Connection Fails**

**Test database connection:**
```bash
psql -h localhost -U logicalv_dsuser -d logicalv_dsscreen
# Enter password when prompted
```

If it fails:
- Check database exists in cPanel → PostgreSQL Databases
- Check username and password are correct
- Check user has permissions on database

### **Problem: "JWT Secret Not Defined"**

Your app requires JWT secrets. Make sure these are set:
```bash
JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
SESSION_SECRET=your_session_secret_here
```

---

## 📝 .env File Template

Copy this and fill in your values:

```bash
# ============================================
# A2 Hosting Environment Variables
# ============================================

# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Database
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logicalv_dsscreen
DB_USER=logicalv_dsuser
DB_PASSWORD=CHANGE_ME

# Security (generate random strings)
JWT_SECRET=CHANGE_ME_64_CHAR_RANDOM_STRING
JWT_REFRESH_SECRET=CHANGE_ME_ANOTHER_64_CHAR_RANDOM_STRING
SESSION_SECRET=CHANGE_ME_YET_ANOTHER_64_CHAR_RANDOM_STRING

# AWS S3 (optional - only if using S3)
USE_S3=false
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_BUCKET_NAME=

# File Upload
MAX_FILE_SIZE=524288000
ALLOWED_VIDEO_TYPES=video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/webm

# ============================================
# DO NOT COMMIT THIS FILE TO GIT!
# ============================================
```

---

## ✅ Quick Setup Checklist

- [ ] Create `.env` file on server
- [ ] Add all required variables
- [ ] Generate secure secrets (64+ chars)
- [ ] Set correct database credentials
- [ ] Set BASE_URL to your domain
- [ ] Secure file permissions: `chmod 600 .env`
- [ ] Restart app: `touch tmp/restart.txt`
- [ ] Test app: `curl https://yourdomain.com/health`
- [ ] Verify database connection works
- [ ] Remove any test endpoints

---

## 🔒 Security Best Practices

1. ✅ **Never commit .env to git**
2. ✅ **Use different secrets for each variable**
3. ✅ **Use minimum 64-character random strings**
4. ✅ **Set file permissions: `chmod 600 .env`**
5. ✅ **Change secrets if exposed**
6. ✅ **Keep backups of .env in secure location**
7. ✅ **Use strong database passwords**
8. ✅ **Enable HTTPS/SSL on domain**

---

## 📞 Need Help?

If environment variables still aren't working:

1. Check app logs: `tail -50 /home/logicalv/repositories/DSScreenBackend/stderr.log`
2. Test manually: `cd ~/repositories/DSScreenBackend && node index.js`
3. Contact A2 Support: "Environment variables not loading in Node.js app"

---

Your app should now load environment variables correctly! 🎉




