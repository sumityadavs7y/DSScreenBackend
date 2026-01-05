# 🧪 Testing Deployment on test_host Branch

All deployment configurations have been set to trigger on the `test_host` branch for safe testing.

## 🚀 Quick Test Steps

### 1. Create and Push the test_host Branch

```bash
# Create the test_host branch from your current branch
git checkout -b test_host

# Add all the deployment files
git add .cpanel.yml deploy.sh webhook.php .github/workflows/deploy.yml
git add DEPLOYMENT_GUIDE.md QUICK_DEPLOY_SETUP.md TEST_DEPLOYMENT.md
git add README.md

# Commit the changes
git commit -m "Add auto-deployment configuration for test_host branch"

# Push to GitHub
git push -u origin test_host
```

### 2. Set Up Your Chosen Deployment Method

Choose one method based on your preference:

#### Option A: cPanel Git (Recommended for Testing)
1. Login to cPanel → **Git™ Version Control**
2. Click **Create**
3. Enter:
   - **Clone URL**: Your repository URL
   - **Repository Path**: Path for testing (e.g., `apps/dsscreen-test`)
   - **Branch**: `test_host` ⚠️ **Important!**
4. Click **Manage** → Copy webhook URL
5. Go to GitHub → Settings → Webhooks → Add webhook
6. Paste URL, set Content-type: `application/json`
7. Save

#### Option B: GitHub Actions
1. Add secrets to GitHub (if not already):
   - `CPANEL_HOST`
   - `CPANEL_USERNAME`
   - `CPANEL_SSH_KEY`
   - `CPANEL_DEPLOY_PATH`
2. The workflow will automatically trigger on push to `test_host`
3. Check the **Actions** tab on GitHub to see deployment progress

#### Option C: Custom Webhook
1. Update `webhook.php` with your actual paths
2. Upload to cPanel public directory
3. Update `deploy.sh` with your paths
4. Upload to cPanel and make executable: `chmod +x deploy.sh`
5. Add webhook in GitHub pointing to your webhook.php URL
6. Set secret key (match in both webhook.php and GitHub)

### 3. Test the Deployment

Make a small test change:

```bash
# Make sure you're on test_host branch
git checkout test_host

# Make a small change
echo "// Test deployment - $(date)" >> index.js

# Commit and push
git add index.js
git commit -m "Test auto-deployment"
git push origin test_host
```

### 4. Verify Deployment

Check if it worked:

**For cPanel Git:**
- Go to cPanel → Git™ Version Control → Manage
- Check "Last Deployment" timestamp
- Look for deployment logs

**For GitHub Actions:**
- Go to GitHub → Actions tab
- Click on the latest workflow run
- Check the logs for each step

**For Custom Webhook:**
- SSH to your cPanel server
- Check deployment log: `cat ~/deployment.log`
- Check application log: `tail -f ~/apps/dsscreen-test/app.log`

**Verify App is Running:**
```bash
# SSH to cPanel
ssh username@your-server.com

# Check if Node process is running
ps aux | grep node

# Or if using PM2
pm2 list

# View logs
tail -f ~/apps/dsscreen-test/app.log
# or
pm2 logs dsscreen-backend
```

## 🔍 Troubleshooting

### Deployment not triggering?
- Check webhook "Recent Deliveries" on GitHub
- Verify webhook URL is correct
- Check webhook secret matches (if using)
- Ensure branch name is exactly `test_host`

### App not starting?
```bash
# Check for errors
tail -50 ~/apps/dsscreen-test/app.log

# Test manually
cd ~/apps/dsscreen-test
npm install
node index.js
```

### Dependencies failing?
```bash
# Check Node version (needs 18+)
node -v

# Use correct Node version
nvm use 18
npm install
```

## ✅ When Testing is Complete

Once you've verified everything works on `test_host`, you can:

### Option 1: Keep Separate Branches
- Keep `test_host` for testing
- Create another set of configs for `master` production deploys
- Merge features to `test_host` first, then to `master`

### Option 2: Switch to Master
Update all configs to use `master` instead of `test_host`:

```bash
# In .github/workflows/deploy.yml
branches:
  - master

# In webhook.php
$ALLOWED_BRANCH = 'refs/heads/master';

# In deploy.sh (update the git pull command)
git pull origin master
```

Then:
```bash
# Merge test_host into master
git checkout master
git merge test_host
git push origin master
```

## 📊 Monitoring Your Deployment

### Real-time logs:
```bash
# Application logs
tail -f ~/apps/dsscreen-test/app.log

# PM2 logs (if using PM2)
pm2 logs dsscreen-backend --lines 100

# Deployment logs (custom webhook)
tail -f ~/deployment.log
```

### Check process status:
```bash
# Standard process
ps aux | grep "node.*index.js"

# PM2 process
pm2 status
pm2 info dsscreen-backend
```

## 🎉 Success Checklist

After a successful deployment, you should see:

- ✅ Webhook triggered (check GitHub webhook deliveries)
- ✅ Code pulled to cPanel server
- ✅ Dependencies installed
- ✅ Migrations run successfully
- ✅ Node.js process restarted
- ✅ Application accessible via browser
- ✅ No errors in logs

## 🚀 Next Steps

1. Test multiple deployments to ensure consistency
2. Test with actual code changes (add a feature, fix a bug)
3. Test error scenarios (bad code, missing dependencies)
4. Set up PM2 for better process management
5. Configure environment variables properly
6. Set up SSL certificate if not already done
7. Consider setting up staging → production pipeline

---

Happy testing! 🧪✨

When you're confident, update configs to point to `master` for production deployments.



