# 🔧 cPanel Git Setup - Detailed Guide

## Method 1: cPanel Git with Manual Pull (Simpler)

If you don't see a webhook URL in cPanel, use this method:

### Step 1: Set Up Git Repository in cPanel

1. **Login to cPanel**
2. **Search for**: `Git™ Version Control` or `Git Version Control`
3. **Click**: `Create`
4. **Fill in**:
   ```
   Clone URL: https://github.com/YOUR_USERNAME/DSScreenBackend.git
   Repository Path: apps/dsscreen-test
   Repository Name: DSScreenBackend-Test
   ```
5. ⚠️ **Important**: If there's a branch dropdown, select `test_host`
6. **Click**: `Create`

### Step 2: Set Up Initial Deployment

```bash
# SSH into your cPanel server
ssh your-username@your-server.com

# Navigate to the repository
cd ~/apps/dsscreen-test

# Make sure you're on test_host branch
git checkout test_host

# Install dependencies
npm install --production

# Create .env file (copy from your local or create manually)
nano .env
# Add your production environment variables

# Run migrations
npm run migrate:run

# Start the application (using PM2 recommended)
npm install -g pm2
pm2 start index.js --name dsscreen-backend
pm2 save
pm2 startup  # Follow the instructions shown
```

### Step 3: Manual Pull (For Now)

When you push changes to `test_host`, manually pull them:

```bash
# SSH to cPanel
ssh your-username@your-server.com

# Navigate to repo and pull
cd ~/apps/dsscreen-test
git pull origin test_host

# Install new dependencies (if any)
npm install --production

# Run migrations (if any)
npm run migrate:run

# Restart app
pm2 restart dsscreen-backend
```

### Step 4: Set Up Auto-Pull (Choose One)

#### Option A: If cPanel Shows "Pull or Deploy" Section

1. In cPanel Git interface, click **Manage** next to your repository
2. Look for **"Pull or Deploy"** section
3. You might see:
   - A **webhook URL** (copy this!)
   - Or a **"Generate Webhook URL"** button (click it)
   - Or **"Enable automatic deployment"** checkbox

4. If you see the webhook URL:
   - Copy it (looks like: `https://your-domain.com:2083/cpsess###/execute/VersionControl/pull?...`)
   - Go to GitHub → Settings → Webhooks → Add webhook
   - Paste the URL
   - Content type: `application/json`
   - Select "Just the push event"
   - Save

#### Option B: Use GitHub Actions Instead (Recommended)

Since GitHub Actions is more reliable, let's set that up:

**On your cPanel server:**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "github-deploy"

# Add it to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# Copy the private key (you'll need this for GitHub)
cat ~/.ssh/id_ed25519
```

**On GitHub:**
1. Go to your repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets one by one:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `CPANEL_HOST` | Your server hostname or IP | `server123.yourhostingprovider.com` |
| `CPANEL_USERNAME` | Your cPanel username | `youruser` |
| `CPANEL_SSH_KEY` | The private key you copied | Paste entire key including headers |
| `CPANEL_DEPLOY_PATH` | Path to your app | `/home/youruser/apps/dsscreen-test` |
| `CPANEL_SSH_PORT` | SSH port (usually 22) | `22` |

5. **Save** each secret

**Test it:**
```bash
# Make a change
git checkout test_host
echo "// Test GitHub Actions deployment" >> index.js
git add .
git commit -m "Test GitHub Actions auto-deploy"
git push origin test_host

# Watch the deployment in GitHub
# Go to: https://github.com/YOUR_USERNAME/DSScreenBackend/actions
```

#### Option C: Use Custom Webhook (Most Control)

If neither of the above work, use the custom webhook:

**1. Upload webhook.php to cPanel:**
- Edit `webhook.php` and update these lines:
  ```php
  $SECRET_KEY = 'your-random-secret-key-12345';  // Create a strong secret
  $DEPLOY_SCRIPT = '/home/YOUR_USERNAME/deploy.sh';
  $LOG_FILE = '/home/YOUR_USERNAME/deployment.log';
  ```
- Upload to: `/home/YOUR_USERNAME/public_html/webhook.php`
  - Or if you have a subdomain: `/home/YOUR_USERNAME/subdomain/webhook.php`

**2. Upload and configure deploy.sh:**
- Edit `deploy.sh` and update:
  ```bash
  APP_DIR="/home/YOUR_USERNAME/apps/dsscreen-test"
  APP_NAME="dsscreen-backend"
  ```
- Upload to: `/home/YOUR_USERNAME/deploy.sh`
- Make it executable:
  ```bash
  chmod +x /home/YOUR_USERNAME/deploy.sh
  ```

**3. Test the webhook manually:**
```bash
# SSH to cPanel and run
/home/YOUR_USERNAME/deploy.sh

# Check if it worked
pm2 list
```

**4. Set up GitHub webhook:**
- Go to GitHub → Settings → Webhooks → Add webhook
- **Payload URL**: `https://yourdomain.com/webhook.php`
  - Replace `yourdomain.com` with your actual domain
- **Content type**: `application/json`
- **Secret**: Use the same secret you put in webhook.php
- **Which events**: Select "Just the push event"
- **Active**: ✓ checked
- Click **Add webhook**

**5. Test it:**
```bash
git checkout test_host
echo "// Test webhook" >> index.js
git add .
git commit -m "Test webhook deployment"
git push origin test_host

# Check GitHub webhook deliveries
# GitHub → Settings → Webhooks → Click your webhook → Recent Deliveries

# Check deployment log on cPanel
ssh your-username@your-server.com
cat ~/deployment.log
```

---

## 🎯 Which Method Should You Use?

### ✅ **GitHub Actions** (RECOMMENDED)
- **Pros**: Most reliable, visible logs, works everywhere
- **Cons**: Requires SSH key setup (5 min)
- **Best for**: Production use, team projects

### ✅ **Custom Webhook**
- **Pros**: Full control, detailed logs
- **Cons**: Manual file uploads, more setup
- **Best for**: Advanced users who want full control

### ⚠️ **cPanel Git Webhook**
- **Pros**: Built-in, easy if available
- **Cons**: Not all cPanel versions have it, less visible
- **Best for**: Quick setup if webhook URL is available

---

## 🔍 Finding cPanel Git Webhook (Visual Guide)

When you click **Manage** in cPanel Git, look for these sections:

```
┌─────────────────────────────────────┐
│ Repository Management               │
├─────────────────────────────────────┤
│ Basic Information                   │
│ - Clone URL: https://...            │
│ - Path: /home/user/repo             │
│                                     │
│ Pull or Deploy                      │ ← LOOK HERE!
│ ┌─────────────────────────────┐    │
│ │ □ Automatically pull        │    │
│ │                             │    │
│ │ Webhook URL:                │    │
│ │ https://domain:2083/...     │ ← COPY THIS!
│ └─────────────────────────────┘    │
│                                     │
│ [Update] [Pull/Deploy Now]          │
└─────────────────────────────────────┘
```

**If you don't see "Pull or Deploy" section**, your cPanel version doesn't support automatic webhooks. Use **GitHub Actions** or **Custom Webhook** instead.

---

## 🆘 Still Can't Find It?

Contact your hosting provider's support and ask:
> "Does my cPanel version support Git webhooks for automatic deployment? If yes, where can I find the webhook URL?"

Or simply use **GitHub Actions** - it works on all servers with SSH access!

---

## 📞 Need Help?

**Check your cPanel version:**
- Look at bottom of cPanel dashboard
- Version 11.102+ usually has Git webhooks
- Older versions might not

**Alternative:** Use `cron` to auto-pull every few minutes:
```bash
# Add to cPanel Cron Jobs:
*/5 * * * * cd /home/YOUR_USERNAME/apps/dsscreen-test && git pull origin test_host && npm install --production && pm2 restart dsscreen-backend
```

This checks for updates every 5 minutes!

---

Let me know which method you'd like to use, and I can help you set it up! 🚀



