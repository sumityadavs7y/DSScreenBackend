# 🚨 Fixing 503 Service Unavailable Error

## What Happened
You killed the Node processes, and now Passenger (A2's app server) can't restart the app properly.

---

## ✅ QUICK FIX (Try This First!)

### Via cPanel:

1. **Go to Setup Node.js App**
2. Click **"Stop App"** (if it's not already stopped)
3. Wait 10 seconds
4. Click **"Start App"**
5. Wait 30 seconds
6. Check if it works

**Still 503?** The app has a startup error. Continue below.

---

## 🔍 Find Out Why It's Not Starting

### Option 1: Check Logs in cPanel

1. **File Manager** → Navigate to your app directory
2. Look for these log files:
   - `stderr.log`
   - `nodejs.log`
   - `app.log`
   - `passenger.log`
3. Open them and look at the **last 20-30 lines**
4. Look for **error messages**

### Option 2: Check Logs via SSH

```bash
ssh your-username@your-server.com

cd ~/your-app-directory

# Check all possible log files
tail -50 stderr.log 2>/dev/null
tail -50 nodejs.log 2>/dev/null
tail -50 app.log 2>/dev/null
tail -50 ~/logs/*.log 2>/dev/null

# Also check Passenger logs
tail -50 ~/logs/passenger.log 2>/dev/null
```

Common errors you might see:
- **"Cannot find module"** → Missing dependencies
- **"EADDRINUSE"** → Port already in use
- **"Syntax Error"** → Code has syntax error
- **"ENOENT"** → Missing file or wrong path
- **"ffmpeg"** → ffmpeg issue (from earlier)

---

## 🛠️ Common Fixes

### Fix 1: If You See "Cannot find module" Error

```bash
cd ~/your-app-directory
npm install --production
# Wait for it to complete
# Then restart via cPanel Node.js Setup
```

### Fix 2: If You See "Port Already in Use" (EADDRINUSE)

```bash
# Find what's using the port
lsof -i :3000  # Replace 3000 with your port

# Kill it
kill -9 PID  # Replace PID with the process ID shown

# Or kill all node processes
pkill -9 -f node

# Wait and let Passenger restart
sleep 5
cd ~/your-app-directory
mkdir -p tmp
touch tmp/restart.txt
```

### Fix 3: If You See ffmpeg Error

The ffmpeg issue from earlier might be causing startup failure.

**Quick workaround** - Comment out ffmpeg temporarily:

Via SSH or cPanel File Manager, edit files that use ffmpeg and comment them out.

Or if you have SSH:
```bash
cd ~/your-app-directory

# Check which files use ffmpeg
grep -r "ffmpeg" --include="*.js" .

# If it's in utils/videoMetadata.js or similar, 
# we need to fix or temporarily disable it
```

### Fix 4: If You See Syntax Error

Check the recent changes for typos. Via SSH:

```bash
cd ~/your-app-directory

# Run Node.js syntax check
node -c index.js
node -c routes/index.js

# If error found, fix the syntax
```

### Fix 5: Missing Environment Variables

```bash
cd ~/your-app-directory

# Check if .env exists
ls -la .env

# If missing, create it
nano .env
# Add your variables, then Ctrl+X, Y, Enter
```

---

## 🔄 Proper Restart Sequence

After fixing the issue:

```bash
# Method A: Using Passenger (Recommended for A2)
cd ~/your-app-directory
mkdir -p tmp
touch tmp/restart.txt
sleep 10

# Method B: Using Node.js Setup in cPanel
# 1. Stop App
# 2. Wait 10 seconds
# 3. Start App

# Method C: Manual restart (if others don't work)
cd ~/your-app-directory
nohup node index.js > app.log 2>&1 &
```

---

## 🧪 Test If App Starts Manually

This will show you the exact error:

```bash
ssh your-username@your-server.com
cd ~/your-app-directory

# Make sure no other node is running
pkill -f node
sleep 2

# Try starting manually
node index.js

# Watch for errors!
# If it shows "Server is running on port XXX" - that's good!
# Press Ctrl+C to stop
# Then restart via cPanel
```

---

## 🎯 Most Likely Causes & Fixes

### Cause 1: ffmpeg Error (From Your Earlier Issue)

If startup fails due to ffmpeg, temporarily bypass it:

**Option A:** Install ffmpeg on system
```bash
# If you have root/sudo access
sudo apt install ffmpeg
# or
sudo yum install ffmpeg
```

**Option B:** Disable ffmpeg check temporarily
Edit the file that imports ffmpeg and wrap it in try-catch.

### Cause 2: Missing node_modules

```bash
cd ~/your-app-directory
rm -rf node_modules package-lock.json
npm install --production
```

### Cause 3: Wrong Node Version

Check Node version in cPanel Node.js Setup:
- Should be **18.x or higher**
- If it's older, select a newer version and reinstall

---

## 📋 Emergency Recovery Steps

If nothing works, do a clean restart:

```bash
# SSH to server
cd ~/your-app-directory

# 1. Make sure we're on the right branch
git status
git checkout test_host

# 2. Get latest code
git pull origin test_host

# 3. Clean install
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --production

# 4. Check if .env exists
ls -la .env
# If missing, create it with required variables

# 5. Test manually first
node index.js
# Watch for errors, press Ctrl+C after it starts

# 6. Restart via cPanel
# Go to Setup Node.js App → Stop → Start
```

---

## 🆘 If Still Getting 503

### Check Node.js Setup Configuration:

In cPanel Setup Node.js App, verify:

1. **Application Root**: Correct path to your app
2. **Application URL**: Your domain
3. **Application Startup File**: `index.js`
4. **Node.js Version**: 18.x or higher
5. **Application Mode**: production

Click **Save** after any changes.

---

## 📞 Quick Diagnostic Command

Run this to get all info:

```bash
cd ~/your-app-directory && {
  echo "=== Git Status ===";
  git branch;
  echo "";
  echo "=== File Check ===";
  ls -la index.js;
  echo "";
  echo "=== Node Processes ===";
  ps aux | grep node | grep -v grep;
  echo "";
  echo "=== Recent Errors ===";
  tail -30 stderr.log 2>/dev/null || echo "No stderr.log";
  echo "";
  echo "=== Test Start ===";
  timeout 5 node index.js 2>&1;
}
```

---

## ✅ Once Working

After you get it running:

1. Test: `curl http://localhost:3000/health`
2. Should see the "hello" message
3. Check in browser (hard refresh: Ctrl+Shift+R)

---

## 💡 Prevention for Future

Instead of `pkill -f node`, use:

**For A2 Hosting (Passenger):**
```bash
cd ~/your-app-directory
touch tmp/restart.txt
```

**For PM2 (if installed):**
```bash
pm2 restart all
```

**Via cPanel:**
Setup Node.js App → Restart button

---

Need help? Share:
1. Last 30 lines of `stderr.log` or any error log
2. Output of `node index.js` when run manually
3. Node.js Setup configuration screenshot

