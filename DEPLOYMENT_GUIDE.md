# 🚀 cPanel Auto-Deployment Setup Guide

This guide will help you set up automatic deployment from GitHub to cPanel with automatic application restart.

## 📋 Prerequisites

- cPanel account with SSH access
- Git installed on cPanel server
- Node.js installed on cPanel server
- Your repository on GitHub/GitLab/Bitbucket

---

## 🎯 Method 1: Using cPanel Git Version Control (Recommended)

### Step 1: Set Up Git Repository in cPanel

1. **Login to cPanel**
2. **Navigate to**: `Git™ Version Control`
3. **Click**: `Create`
4. **Fill in the details**:
   - **Clone URL**: Your repository URL (e.g., `https://github.com/username/DSScreenBackend.git`)
   - **Repository Path**: The path where you want to deploy (e.g., `public_html/dsscreen` or `apps/dsscreen`)
   - **Repository Name**: Give it a name (e.g., `DSScreenBackend`)
5. **Click**: `Create`

### Step 2: Configure SSH Key for Private Repositories (If needed)

If your repository is private:

1. In cPanel Git interface, click **"Manage"** next to your repository
2. Copy the **Public Key** provided by cPanel
3. Go to your GitHub repository settings → **Deploy Keys**
4. Add the public key there
5. Give it a descriptive name like "cPanel Production Server"

### Step 3: Update the .cpanel.yml File

Before pushing, update the `.cpanel.yml` file in your repository:

```yaml
---
deployment:
  tasks:
    - export DEPLOYPATH=/home/YOUR_CPANEL_USERNAME/YOUR_APP_PATH
    - /bin/cp -r * $DEPLOYPATH
    - cd $DEPLOYPATH
    - npm install --production
    - npm run migrate:run
    - /usr/bin/pkill -f "node.*index.js" || true
    - sleep 2
    - cd $DEPLOYPATH && NODE_ENV=production nohup node index.js > app.log 2>&1 &
```

**Replace**:
- `YOUR_CPANEL_USERNAME` with your actual cPanel username
- `YOUR_APP_PATH` with your deployment path

### Step 4: Enable Automatic Deployment

1. In cPanel Git interface, click **"Manage"** next to your repository
2. Under **"Pull or Deploy"**, enable **"Automatically pull changes"**
3. Copy the **webhook URL** provided
4. Go to your GitHub repository → **Settings** → **Webhooks**
5. Click **"Add webhook"**
6. Paste the webhook URL
7. Set **Content type**: `application/json`
8. Select **"Just the push event"**
9. Click **"Add webhook"**

### Step 5: Test the Deployment

1. Make a change in your code
2. Commit and push to master branch:
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push origin master
   ```
3. Check cPanel Git interface to see if it pulled the changes
4. Check if your application restarted successfully

---

## 🎯 Method 2: Using GitHub Actions (More Control)

### Step 1: Set Up SSH Access

On your cPanel server, generate an SSH key (if not already done):

```bash
ssh-keygen -t ed25519 -C "deployment@dsscreen"
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_ed25519  # Copy this private key
```

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `CPANEL_HOST`: Your cPanel server IP/hostname
   - `CPANEL_USERNAME`: Your cPanel SSH username
   - `CPANEL_SSH_KEY`: The private key you copied
   - `CPANEL_DEPLOY_PATH`: Path to your application (e.g., `/home/username/apps/dsscreen`)

### Step 3: Create GitHub Actions Workflow

Create this file: `.github/workflows/deploy.yml`

```yaml
name: Deploy to cPanel

on:
  push:
    branches:
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: 🚀 Deploy to cPanel
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.CPANEL_HOST }}
          username: ${{ secrets.CPANEL_USERNAME }}
          key: ${{ secrets.CPANEL_SSH_KEY }}
          script: |
            cd ${{ secrets.CPANEL_DEPLOY_PATH }}
            git pull origin master
            npm install --production
            npm run migrate:run
            
            # Restart using PM2 (if installed)
            if command -v pm2 &> /dev/null; then
              pm2 restart dsscreen-backend || pm2 start index.js --name dsscreen-backend
              pm2 save
            else
              # Restart using pkill/nohup
              pkill -f "node.*index.js" || true
              sleep 2
              NODE_ENV=production nohup node index.js > app.log 2>&1 &
            fi
            
            echo "✅ Deployment completed!"
```

---

## 🎯 Method 3: Manual Webhook Handler (Advanced)

### Step 1: Create Webhook Handler

Upload `webhook.php` to your cPanel (I'll create this file):

```php
<?php
// webhook.php - Place this in your cPanel public directory
$secret = 'YOUR_SECRET_KEY_HERE'; // Match this with GitHub webhook secret

// Verify GitHub signature
$headers = getallheaders();
$signature = $headers['X-Hub-Signature-256'] ?? '';
$payload = file_get_contents('php://input');
$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expected, $signature)) {
    http_response_code(403);
    die('Invalid signature');
}

// Execute deployment script
$output = shell_exec('/home/YOUR_USERNAME/deploy.sh 2>&1');
echo $output;

// Log the deployment
file_put_contents('deployment.log', date('Y-m-d H:i:s') . "\n" . $output . "\n\n", FILE_APPEND);
?>
```

### Step 2: Upload deploy.sh to cPanel

The `deploy.sh` file is included in your repository. Upload it to your cPanel home directory and make it executable:

```bash
chmod +x /home/YOUR_USERNAME/deploy.sh
```

### Step 3: Configure GitHub Webhook

1. Go to GitHub repository → **Settings** → **Webhooks**
2. Add webhook URL: `https://yourdomain.com/webhook.php`
3. Set **Content type**: `application/json`
4. Set a **Secret** (match it in webhook.php)
5. Select **"Just the push event"**

---

## 🔧 Using PM2 for Better Process Management (Highly Recommended)

### Install PM2 on cPanel

```bash
npm install -g pm2
```

### Start Your Application with PM2

```bash
cd /home/YOUR_USERNAME/YOUR_APP_PATH
pm2 start index.js --name "dsscreen-backend" --env production
pm2 save
pm2 startup  # Follow the instructions shown
```

### Update deploy.sh to use PM2

The `deploy.sh` script already includes PM2 support!

---

## 📝 Important Notes

1. **Environment Variables**: Make sure to set up your `.env` file on the cPanel server
2. **Database**: Ensure your database credentials are correct in production
3. **File Permissions**: Make sure your deploy script has execute permissions (`chmod +x deploy.sh`)
4. **Logs**: Check logs at `app.log` or `pm2 logs` if using PM2
5. **Node Version**: Verify cPanel is using the correct Node.js version (18+)

---

## 🐛 Troubleshooting

### Check if application is running:
```bash
ps aux | grep node
# or
pm2 list
```

### View application logs:
```bash
tail -f app.log
# or
pm2 logs dsscreen-backend
```

### Manually test deployment:
```bash
cd /home/YOUR_USERNAME/YOUR_APP_PATH
./deploy.sh
```

### Check webhook logs:
Look at `deployment.log` in your webhook directory

---

## 🎉 You're Done!

Now whenever you push to the master branch, your cPanel server will:
1. ✅ Pull the latest code
2. ✅ Install/update dependencies
3. ✅ Run database migrations
4. ✅ Restart the Node.js application

Need help? Check the logs or contact your hosting provider!

