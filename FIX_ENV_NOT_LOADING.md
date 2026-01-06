# 🔧 Fix: Environment Variables Not Updating After Restart

## 🔍 Step 1: Check What's Currently Loaded

I've added a debug endpoint. Deploy this change and test:

```bash
# Push the change
git add routes/index.js
git commit -m "Add debug endpoint for env variables"
git push origin test_host

# Pull on server and restart
cd /home/logicalv/repositories/SignageBackend
git pull origin test_host
touch tmp/restart.txt
sleep 10

# Test the endpoint
curl http://localhost:3000/debug-env
# OR
curl https://signage.logicalvalleys.in/debug-env
```

This will show you **exactly what environment variables your app sees**.

---

## 🎯 Common Issues & Solutions

### **Issue 1: .htaccess SetEnv Not Working with Passenger**

**Problem:** You added `SetEnv BASE_URL https://...` but Passenger might not read it.

**Solution A: Use cPanel Node.js Interface (BEST)**

1. **cPanel** → **Setup Node.js App**
2. Find your app → Click on it
3. Scroll to **"Environment variables"** section
4. Click **"Add Variable"**
5. Add:
   ```
   Name: BASE_URL
   Value: https://signage.logicalvalleys.in
   ```
6. Click **"Save"**
7. Click **"Restart"** button
8. Test: `curl https://signage.logicalvalleys.in/debug-env`

**Solution B: Create .env File on Server**

```bash
# SSH to server
ssh logicalv@your-server.com

# Navigate to app
cd /home/logicalv/repositories/SignageBackend

# Create .env file
nano .env
```

Add all your variables:
```bash
NODE_ENV=production
PORT=3000
BASE_URL=https://signage.logicalvalleys.in

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

JWT_SECRET=your_64_char_secret
JWT_REFRESH_SECRET=your_64_char_refresh_secret
SESSION_SECRET=your_64_char_session_secret
```

Save (Ctrl+X, Y, Enter) and restart:
```bash
chmod 600 .env
touch tmp/restart.txt
sleep 10
curl http://localhost:3000/debug-env
```

---

### **Issue 2: Restart Not Actually Happening**

**Check if restart worked:**

```bash
# Before restart - note the PIDs
ps aux | grep "lsnode.*SignageBackend" | grep -v grep

# Restart
cd /home/logicalv/repositories/SignageBackend
touch tmp/restart.txt

# Wait and check PIDs again (they should be DIFFERENT)
sleep 10
ps aux | grep "lsnode.*SignageBackend" | grep -v grep
```

**If PIDs are the same**, restart didn't work. Try:

```bash
# Force kill and let Passenger restart
pkill -f "lsnode.*SignageBackend"
sleep 10
ps aux | grep "lsnode.*SignageBackend" | grep -v grep
```

---

### **Issue 3: Old .env File Being Cached**

**Check if .env exists and has correct content:**

```bash
cd /home/logicalv/repositories/SignageBackend

# Check if .env exists
ls -la .env

# View contents (careful - shows passwords!)
cat .env

# Check when it was last modified
stat .env
```

**If old or missing**, create/update it:

```bash
nano .env
# Add all variables
# Save and restart
touch tmp/restart.txt
```

---

### **Issue 4: dotenv Not Loading .env File**

**Check if index.js loads dotenv:**

```bash
cd /home/logicalv/repositories/SignageBackend
head -5 index.js
```

Should show:
```javascript
// Load environment variables from .env file
require('dotenv').config();
```

**If missing**, add it at the TOP of index.js (line 1-2).

---

### **Issue 5: Wrong Directory**

**Verify you're restarting the correct app:**

```bash
# Check where the app is actually running from
ps aux | grep "lsnode.*SignageBackend"

# Should show: lsnode:/home/logicalv/repositories/SignageBackend/

# Make sure you're in the right directory
cd /home/logicalv/repositories/SignageBackend
pwd  # Should match the path above

# Restart
touch tmp/restart.txt
```

---

## ✅ Complete Fix Procedure

### **Step 1: Add Environment Variables via cPanel (Recommended)**

1. **cPanel** → **Setup Node.js App**
2. Click your app
3. Add these variables one by one:

| Variable Name | Example Value |
|--------------|---------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `BASE_URL` | `https://signage.logicalvalleys.in` |
| `DB_HOST` | `localhost` |
| `DB_NAME` | `logicalv_dsscreen` |
| `DB_USER` | `logicalv_dsuser` |
| `DB_PASSWORD` | `your_password` |
| `JWT_SECRET` | `your_secret` |
| `JWT_REFRESH_SECRET` | `your_refresh_secret` |
| `SESSION_SECRET` | `your_session_secret` |

4. Click **"Save"** after each
5. Click **"Restart"**

### **Step 2: Verify Restart Actually Happened**

```bash
# SSH to server
ssh logicalv@your-server.com

# Check process IDs before restart
ps aux | grep "lsnode.*SignageBackend" | grep -v grep | awk '{print $2}'
# Note the PIDs

# Force restart
cd /home/logicalv/repositories/SignageBackend
pkill -f "lsnode.*SignageBackend"

# Wait
sleep 10

# Check PIDs again - should be DIFFERENT
ps aux | grep "lsnode.*SignageBackend" | grep -v grep | awk '{print $2}'
```

### **Step 3: Test Environment Variables**

```bash
# Test the debug endpoint
curl http://localhost:3000/debug-env

# Should show:
# {
#   "BASE_URL": "https://signage.logicalvalleys.in",
#   "NODE_ENV": "production",
#   "PORT": "3000",
#   ...
# }
```

### **Step 4: Test Your App**

```bash
# Health check
curl https://signage.logicalvalleys.in/health

# Test actual functionality
# (login, database connection, etc.)
```

---

## 🐛 Debugging Commands

### **Check if .env file exists:**
```bash
ls -la /home/logicalv/repositories/SignageBackend/.env
```

### **Check environment variables in running process:**
```bash
# Get PID of your app
PID=$(ps aux | grep "lsnode.*SignageBackend" | grep -v grep | head -1 | awk '{print $2}')

# Check environment of that process
cat /proc/$PID/environ | tr '\0' '\n' | grep -E "BASE_URL|NODE_ENV|DB_"
```

### **Check if dotenv is installed:**
```bash
cd /home/logicalv/repositories/SignageBackend
npm list dotenv
```

### **Check logs for errors:**
```bash
tail -50 /home/logicalv/repositories/SignageBackend/stderr.log | grep -i env
```

---

## 🔄 Nuclear Option: Complete Restart

If nothing works, try this complete restart:

```bash
# SSH to server
ssh logicalv@your-server.com

cd /home/logicalv/repositories/SignageBackend

# 1. Kill all processes
pkill -9 -f "lsnode.*SignageBackend"

# 2. Remove restart trigger
rm -f tmp/restart.txt

# 3. Wait
sleep 5

# 4. Verify .env exists and is correct
cat .env

# 5. Check dotenv is loaded in index.js
head -3 index.js | grep dotenv

# 6. Trigger fresh start
mkdir -p tmp
touch tmp/restart.txt

# 7. Wait for startup
sleep 15

# 8. Check if running
ps aux | grep "lsnode.*SignageBackend" | grep -v grep

# 9. Test env variables
curl http://localhost:3000/debug-env
```

---

## 🎯 Quick Checklist

Before saying "it's not working":

- [ ] Environment variables added in cPanel Node.js interface
- [ ] Clicked "Save" after each variable
- [ ] Clicked "Restart" button
- [ ] Waited 30+ seconds after restart
- [ ] Process IDs changed (old processes killed, new ones started)
- [ ] Tested with `/debug-env` endpoint
- [ ] Cleared browser cache / tested with curl
- [ ] Checked stderr.log for errors

---

## 🔒 After Fixing

**Remove the debug endpoint!** It exposes your configuration.

```javascript
// Delete this from routes/index.js:
router.get('/debug-env', ...);
```

Or restrict it to localhost only:
```javascript
router.get('/debug-env', (req, res) => {
    // Only allow from localhost
    if (req.ip !== '127.0.0.1' && req.ip !== '::1') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    // ... rest of code
});
```

---

## 📞 Still Not Working?

Share the output of:
```bash
curl http://localhost:3000/debug-env
ps aux | grep lsnode
cat /home/logicalv/repositories/SignageBackend/.env
head -5 /home/logicalv/repositories/SignageBackend/index.js
```

This will help diagnose the exact issue!


