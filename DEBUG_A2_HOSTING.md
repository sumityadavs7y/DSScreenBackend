# 🐛 Debugging A2 Hosting - Changes Not Showing

## Step 1: Verify Git Actually Updated the Files

SSH into your server and check:

```bash
ssh your-username@your-server.com

# Navigate to your app directory
cd ~/your-app-directory

# Check the last commit
git log -1

# Check if the file has the changes
grep -A 5 "Health check endpoint" routes/index.js

# You should see:
# router.get('/health', (req, res) => {
#     res.json({
#         status: 'healthy',
#         message: 'hello',  <-- THIS LINE SHOULD BE THERE
#         timestamp: new Date().toISOString()
#     });
# });
```

**If you DON'T see `message: 'hello'`**, the git pull didn't work. Try:
```bash
git fetch origin
git reset --hard origin/test_host
```

---

## Step 2: Check Which Directory Node.js Setup Is Using

A2 Hosting's Node.js Setup might be pointing to a different directory!

### Via cPanel:
1. Go to **Setup Node.js App**
2. Look at the **Application Root** field
3. Make sure it matches where you did the git pull

### Via SSH:
```bash
# Find all Node processes
ps aux | grep node

# This will show you which directory the app is running from
```

**Common Issue**: Git repo is in `~/repositories/app` but Node.js is running from `~/public_html/app`

---

## Step 3: Force Stop and Start (Not Just Restart)

Sometimes "Restart" doesn't fully reload the code.

### Via cPanel:
1. **Setup Node.js App**
2. Click **"Stop App"** button
3. Wait 10 seconds (important!)
4. Click **"Start App"** button
5. Wait 30 seconds before testing

### Via SSH:
```bash
# Kill all Node processes
pkill -9 -f node

# Wait a few seconds
sleep 5

# Touch restart file (Passenger will auto-start)
cd ~/your-app-directory
mkdir -p tmp
touch tmp/restart.txt

# Wait 10 seconds
sleep 10

# Test
curl http://localhost:PORT/health
```

---

## Step 4: Check If Multiple Node Processes Are Running

```bash
# SSH to server
ps aux | grep node

# You should see only ONE node process
# If you see multiple, kill them all:
pkill -9 -f node

# Then restart via cPanel Node.js Setup
```

---

## Step 5: Clear All Caches

### Browser Cache:
- **Hard refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or try in **Incognito/Private mode**
- Or try a different browser

### Test with curl (bypasses browser cache):
```bash
curl https://yourdomain.com/health

# Or from SSH on server
curl http://localhost:PORT/health
```

---

## Step 6: Check Node.js Setup Configuration

In cPanel Node.js Setup, verify:

1. **Application Mode**: Should be "production"
2. **Application Root**: Should match your git directory
3. **Application URL**: Should be correct
4. **Application Startup File**: Should be `index.js`
5. **Environment Variables**: Check if they're set correctly

---

## Step 7: Check Error Logs

Look for errors that might prevent the app from starting:

### Via cPanel:
- File Manager → Navigate to your app folder
- Look for `stderr.log` or `nodejs.log`
- Check for error messages

### Via SSH:
```bash
cd ~/your-app-directory

# Check various log files
tail -50 stderr.log
tail -50 nodejs.log  
tail -50 app.log

# Check Passenger logs (A2 uses Passenger)
tail -50 ~/logs/*.log
```

---

## Step 8: Manually Test the Code

```bash
# SSH to server
cd ~/your-app-directory

# Stop the app first
pkill -f node

# Try running it manually to see errors
node index.js

# You should see:
# "Server is running on port 3000"
# 
# If you see errors, they'll show here!
# Press Ctrl+C to stop
```

---

## Step 9: Check if Git and App Are in Same Directory

This is a VERY common issue:

```bash
# Where is your git repo?
find ~ -name ".git" -type d

# Where is Node.js running from?
ps aux | grep node

# They should be in the SAME directory!
```

**If different directories:**

Option A: Move git to correct location
```bash
cd ~/correct-app-directory
rm -rf .git
git init
git remote add origin YOUR_REPO_URL
git fetch
git checkout test_host
```

Option B: Update Node.js Setup to point to git directory
- cPanel → Setup Node.js App
- Click "Edit" (pencil icon)
- Update "Application Root" to your git directory
- Save and restart

---

## Step 10: Nuclear Option - Full Reinstall

If nothing works, try this:

```bash
# SSH to server
cd ~/your-app-directory

# Backup .env
cp .env .env.backup

# Remove node_modules and package-lock
rm -rf node_modules package-lock.json

# Make sure code is latest
git fetch origin
git reset --hard origin/test_host

# Reinstall dependencies
npm install --production

# Restore .env
cp .env.backup .env

# Force restart
pkill -9 -f node
sleep 5
mkdir -p tmp && touch tmp/restart.txt

# Wait and test
sleep 10
curl http://localhost:PORT/health
```

---

## Quick Diagnostic Script

Run this to get all info at once:

```bash
#!/bin/bash
echo "=== Git Status ==="
cd ~/your-app-directory
git log -1
echo ""

echo "=== File Content ==="
grep -A 5 "Health check" routes/index.js
echo ""

echo "=== Node Processes ==="
ps aux | grep node
echo ""

echo "=== Test Endpoint ==="
curl http://localhost:3000/health
echo ""

echo "=== Recent Logs ==="
tail -20 app.log 2>/dev/null || echo "No app.log found"
```

Save as `diagnostic.sh`, make executable with `chmod +x diagnostic.sh`, then run `./diagnostic.sh`

---

## Most Common Solutions (Try These First!)

### Solution 1: Git and App in Different Directories
```bash
# Check where git is
cd ~ && find . -name ".git" -type d | head -5

# Update Node.js Setup to point there
```

### Solution 2: Old Process Still Running
```bash
pkill -9 -f node
sleep 5
# Then restart via cPanel
```

### Solution 3: Browser Cache
```bash
# Test with curl instead
curl https://yourdomain.com/health

# Or hard refresh browser: Ctrl+Shift+R
```

### Solution 4: Wrong Branch
```bash
cd ~/your-app-directory
git branch  # Should show * test_host
git checkout test_host
git pull origin test_host
```

---

## ✅ Verification Checklist

After fixing, verify:

- [ ] `grep "message: 'hello'" routes/index.js` shows the line
- [ ] `ps aux | grep node` shows only ONE process
- [ ] `curl http://localhost:PORT/health` shows "hello"
- [ ] Browser (after hard refresh) shows "hello"
- [ ] Git directory = Node.js Application Root directory

---

## Still Not Working?

Share these details:

1. Output of: `cd ~/app-dir && git log -1 --oneline`
2. Output of: `grep -A 3 "Health check" routes/index.js`
3. Output of: `ps aux | grep node`
4. Node.js Setup "Application Root" path
5. Any error messages from logs

This will help pinpoint the exact issue!

