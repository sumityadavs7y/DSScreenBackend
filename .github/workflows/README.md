# GitHub Actions Workflows

## 🚀 EC2 Auto-Deployment Workflow

**File**: `ec2-deploy.yml`

### Triggers
- Push to `master` branch
- Push to `main` branch  
- Manual trigger (workflow_dispatch)

### What It Does
1. Connects to your EC2 instance via SSH
2. Pulls the latest code from GitHub
3. Installs/updates dependencies
4. Restarts the application using PM2

### Required Secrets
Configure these in GitHub Repository Settings → Secrets and Variables → Actions:

| Secret Name | Description |
|-------------|-------------|
| `EC2_HOST` | EC2 public IP or domain |
| `EC2_USERNAME` | SSH username (ubuntu/ec2-user) |
| `EC2_SSH_KEY` | Private SSH key (.pem file content) |
| `EC2_PROJECT_PATH` | Project directory path on EC2 |
| `EC2_SSH_PORT` | SSH port (optional, defaults to 22) |

### Viewing Deployment Status
1. Go to your GitHub repository
2. Click on the **Actions** tab
3. See the deployment workflow running in real-time
4. Click on any workflow run to see detailed logs

### Manual Trigger
To manually trigger a deployment:
1. Go to Actions tab
2. Select "Deploy to EC2" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

### Deployment Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Developer pushes code to master/main branch                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions workflow triggers automatically             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Checkout code from repository                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Connect to EC2 instance via SSH                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Navigate to project directory                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Fetch and pull latest changes                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Install/update npm dependencies                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Reload/restart PM2 process                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Save PM2 process list                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ Deployment complete - Application is live!              │
└─────────────────────────────────────────────────────────────┘
```

### Troubleshooting

**Workflow fails at SSH connection:**
- Verify `EC2_HOST` is correct and accessible
- Check Security Group allows SSH (port 22)
- Verify `EC2_SSH_KEY` is the complete private key

**Workflow fails at git pull:**
- SSH into EC2 manually and check git status
- Ensure no conflicting local changes
- Verify correct branch exists

**Workflow succeeds but app doesn't work:**
- SSH into EC2 and check PM2 logs: `pm2 logs dsinfra`
- Verify `.env` file exists with correct values
- Check if port is available: `sudo lsof -i :3000`

### Best Practices

✅ **Do:**
- Test deployment with a small change first
- Monitor the Actions tab after pushing
- Keep secrets secure and rotated regularly
- Review workflow logs for any warnings

❌ **Don't:**
- Commit secrets or .env files to repository
- Push directly to master without testing
- Ignore failed workflow notifications
- Use production credentials in development

### Additional Resources

- [Full Deployment Guide](../../DEPLOYMENT.md)
- [Quick Reference](../../QUICK_REFERENCE.md)
- [EC2 Setup Script](../../ec2-setup.sh)
- [Deployment Script](../../deploy.sh)

