# ⚡ Quick cPanel Auto-Deployment Setup

Choose the method that works best for you:

---

## 🥇 Method 1: cPanel Git (Easiest - 5 minutes)

⚠️ **Note**: Not all cPanel versions show a webhook URL. If you can't find it, use **Method 2 (GitHub Actions)** instead.

### On cPanel:
1. Login → **Git™ Version Control** → **Create**
2. Enter your repo URL: `https://github.com/YOUR_USERNAME/DSScreenBackend.git`
3. Choose deployment path: `/home/USERNAME/apps/dsscreen`
4. Select branch: `test_host` (for testing)
5. Click **Create**

### Find Webhook URL (if available):
1. Click **Manage** next to your repository
2. Look for **"Pull or Deploy"** section
3. If you see a **webhook URL**, copy it
4. If you DON'T see it → **Use Method 2 instead** ⬇️

### If Webhook URL Found:
1. Go to GitHub → **Settings** → **Webhooks** → **Add webhook**
2. Paste webhook URL
3. Set Content-type: `application/json`
4. Select "Just the push event"
5. Click **Add webhook**

**✅ Done! Every push to test_host will auto-deploy.**

**📚 Can't find webhook URL?** See **[CPANEL_GIT_SETUP.md](./CPANEL_GIT_SETUP.md)** for detailed help!

---

## 🥈 Method 2: GitHub Actions (Most Control - 10 minutes)

### On cPanel (SSH):
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "deploy"
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_ed25519  # Copy this
```

### On GitHub:
1. **Settings** → **Secrets and variables** → **Actions** → **New secret**

Add these secrets:
- `CPANEL_HOST`: Your server IP/hostname
- `CPANEL_USERNAME`: Your SSH username  
- `CPANEL_SSH_KEY`: The private key you copied
- `CPANEL_DEPLOY_PATH`: `/home/username/apps/dsscreen`

### Setup Git on cPanel:
```bash
cd /home/username/apps/dsscreen
git clone https://github.com/YOUR_USERNAME/DSScreenBackend.git .
npm install --production
cp .env.example .env  # Create your .env file
npm run migrate:run
```

### Push & Test:
```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deployment"
git push origin master
```

Check **Actions** tab on GitHub to see deployment progress.

**✅ Done! GitHub Actions will deploy on every push.**

---

## 🥉 Method 3: Custom Webhook (Advanced - 15 minutes)

### Upload Files to cPanel:
1. Upload `webhook.php` to: `/public_html/webhook.php`
2. Upload `deploy.sh` to: `/home/username/deploy.sh`
3. Make it executable:
   ```bash
   chmod +x /home/username/deploy.sh
   ```

### Configure Files:

**webhook.php** - Update:
```php
$SECRET_KEY = 'your-random-secret-key-here';
$DEPLOY_SCRIPT = '/home/YOUR_USERNAME/deploy.sh';
$LOG_FILE = '/home/YOUR_USERNAME/deployment.log';
```

**deploy.sh** - Update:
```bash
APP_DIR="/home/YOUR_USERNAME/apps/dsscreen"
APP_NAME="dsscreen-backend"
```

### On GitHub:
1. **Settings** → **Webhooks** → **Add webhook**
2. URL: `https://yourdomain.com/webhook.php`
3. Secret: Same as `$SECRET_KEY` in webhook.php
4. Content type: `application/json`
5. Events: **Just the push event**

### Test:
```bash
# Make any change and push
git add .
git commit -m "Test webhook"
git push origin master

# Check logs on cPanel
cat /home/username/deployment.log
```

**✅ Done! Webhook will trigger deployment.**

---

## 🎯 Install PM2 (Recommended for All Methods)

PM2 makes process management much easier:

```bash
# On cPanel via SSH
npm install -g pm2

# Start your app
cd /home/username/apps/dsscreen
pm2 start index.js --name dsscreen-backend --env production

# Save PM2 config
pm2 save

# Set up startup script
pm2 startup
# Follow the command it shows

# Useful commands
pm2 list          # See all processes
pm2 logs          # View logs
pm2 restart all   # Restart app
pm2 stop all      # Stop app
pm2 delete all    # Remove from PM2
```

---

## 🧪 Test Your Setup

After setup, make a test change:

```bash
# In your local repo
echo "// Test deployment" >> index.js
git add index.js
git commit -m "Test auto-deployment"
git push origin master
```

Then check:
1. **cPanel Git interface** - See if it updated
2. **Application logs** - `tail -f app.log` or `pm2 logs`
3. **Your website** - Verify it's running

---

## 🆘 Troubleshooting

### App not restarting?
```bash
# Check if it's running
ps aux | grep node
# or
pm2 list

# View logs
tail -f /home/username/apps/dsscreen/app.log
# or
pm2 logs dsscreen-backend
```

### Deploy script not running?
```bash
# Check permissions
ls -la /home/username/deploy.sh

# Make executable
chmod +x /home/username/deploy.sh

# Test manually
/home/username/deploy.sh
```

### Webhook not triggering?
- Check GitHub webhook "Recent Deliveries"
- Check `/home/username/deployment.log`
- Verify webhook URL is accessible

### Dependencies not installing?
```bash
# Check Node version (need 18+)
node -v

# Use nvm to switch versions
nvm use 18
```

---

## 📚 Full Documentation

For detailed explanations, see **DEPLOYMENT_GUIDE.md**

---

## 🎉 You're All Set!

Your deployment is now automated. Every push to master will:
- ✅ Pull latest code
- ✅ Install dependencies
- ✅ Run migrations
- ✅ Restart application

Happy deploying! 🚀

