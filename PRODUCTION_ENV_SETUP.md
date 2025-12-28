# Production Environment Setup for S3 Uploads

## 🚨 Critical Issue Found

Your production server is missing AWS S3 configuration in the `.env` file!

### Evidence:
The error shows an **incomplete S3 URL**: `https://s3.amazonaws.com/`

A valid URL should look like:
```
https://signagelogicalvalley.s3.us-east-1.amazonaws.com/videos/dev_test_...mp4
```

This proves that `AWS_S3_BUCKET` is not set on your production server.

## ✅ Solution: Add AWS Configuration to Production `.env`

### Step 1: SSH into Production Server

```bash
ssh your-ec2-user@your-server-ip
```

### Step 2: Navigate to Project Directory

```bash
cd ~/digitalsignage  # or wherever your project is deployed
```

### Step 3: Check Current Environment Variables

```bash
cat .env | grep AWS
```

**Expected output (if configured correctly):**
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY=AKIAUBXTMC5EL3UZFPXA
AWS_SECRET=your_secret_key_here
AWS_S3_BUCKET=signagelogicalvalley
```

**If you see nothing** → AWS vars are missing! Proceed to Step 4.

### Step 4: Edit `.env` File

```bash
nano .env
```

Add these lines at the end:

```bash
# AWS S3 Configuration for Video Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY=AKIAUBXTMC5EL3UZFPXA
AWS_SECRET=your_actual_secret_key_here
AWS_S3_BUCKET=signagelogicalvalley
```

**Important:** 
- Replace `your_actual_secret_key_here` with your real AWS secret key
- Verify the bucket name: `signagelogicalvalley`
- Verify the region (based on where your bucket is located)

Save and exit:
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

### Step 5: Deploy Latest Code

```bash
# Pull latest code from GitHub
git pull origin master

# Install any new dependencies (if needed)
npm install --production

# Reload the application
pm2 reload digitalsignage
```

### Step 6: Verify Configuration Loaded

```bash
pm2 logs digitalsignage --lines 50
```

**Look for this in the logs:**

✅ **Success:**
```
✅ S3 Configuration: {
  region: 'us-east-1',
  bucket: 'signagelogicalvalley',
  hasAccessKey: true,
  hasSecretKey: true
}
```

❌ **Error (means .env not configured):**
```
❌ S3 Configuration Error: AWS_S3_BUCKET is not set!
Please set AWS_S3_BUCKET in your .env file
```

## 📊 What Changed in the Code

### Commits to Deploy:

1. **de79fc7** - Enhanced S3 upload error logging
   - Added detailed console logging for S3 responses
   - Removed Content-Type header to fix CORS preflight

2. **4773274** - Added AWS Signature Version 4
   - Required for modern AWS regions
   - Fixes "InvalidRequest" 400 error

3. **f731493** - Added S3 configuration validation
   - Checks if AWS environment variables are set
   - Logs configuration on startup
   - Throws clear errors if config is missing

### Files Modified:

- `utils/s3Storage.js` - S3 client initialization and validation
- `views/dashboard.ejs` - Enhanced error logging
- `views/videos.ejs` - Enhanced error logging  
- `public/js/uploads.js` - Enhanced error logging

## 🧪 Testing After Deployment

### 1. Check Server Logs

```bash
pm2 logs digitalsignage --lines 50
```

Should show:
```
✅ S3 Configuration: { region: 'us-east-1', bucket: 'signagelogicalvalley', ... }
```

### 2. Test Upload from Browser

1. Open: `https://signage.logicalvalley.in/dashboard/videos`
2. Open browser console (F12)
3. Click "Upload Video"
4. Select a video file
5. Click "Upload"

### 3. Expected Console Output

**✅ Success:**
```
🔑 Generating pre-signed URL: { bucket: 'signagelogicalvalley', key: 'videos/...', ... }
✅ Pre-signed URL generated: https://signagelogicalvalley.s3.us-east-1.amazonaws.com/videos/...
S3 Response Status: 200
✅ Successfully uploaded to S3
✅ Upload complete!
```

**❌ Failure (config missing):**
```
❌ Error: S3 bucket name is not configured. Please set AWS_S3_BUCKET environment variable.
```

**❌ Failure (wrong signature):**
```
S3 Response Status: 400
InvalidRequest: The authorization mechanism you have provided is not supported.
```

**❌ Failure (CORS):**
```
Access to XMLHttpRequest at 'https://s3.amazonaws.com/' blocked by CORS policy
```

## 🔧 Troubleshooting

### Issue 1: AWS Variables Not Loading

**Symptoms:**
- Logs show "S3 Configuration Error"
- URL is incomplete: `https://s3.amazonaws.com/`

**Solution:**
1. Verify .env file has AWS variables
2. Ensure no typos in variable names (must be exact)
3. Restart PM2: `pm2 reload digitalsignage`
4. Check logs again: `pm2 logs digitalsignage`

### Issue 2: Signature Version Error (400 Bad Request)

**Symptoms:**
```
InvalidRequest: The authorization mechanism you have provided is not supported. 
Please use AWS4-HMAC-SHA256.
```

**Solution:**
- This is fixed in commit `4773274`
- Make sure you've run `git pull origin master`
- Restart: `pm2 reload digitalsignage`

### Issue 3: CORS Error

**Symptoms:**
```
Response to preflight request doesn't pass access control check
```

**Solution:**
1. This is fixed by removing Content-Type header (commit `de79fc7`)
2. Verify S3 CORS configuration (see below)
3. Make sure code is deployed: `git pull origin master`

### Issue 4: Access Denied (403)

**Symptoms:**
```
S3 Response Status: 403
AccessDenied
```

**Solution:**
- Check AWS IAM user has `s3:PutObject` permission
- Check S3 bucket policy allows uploads
- Verify AWS credentials are correct

## 🌐 S3 Bucket CORS Configuration

Your S3 bucket CORS should be:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "https://signage.logicalvalley.in",
            "http://localhost:3000"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
    }
]
```

To update:
1. Go to AWS S3 Console
2. Select bucket: `signagelogicalvalley`
3. Permissions → CORS
4. Paste the JSON above
5. Save

## 📋 Complete Deployment Checklist

- [ ] SSH into production server
- [ ] Navigate to project directory
- [ ] Check if AWS variables exist in .env
- [ ] Add AWS variables if missing (AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET, AWS_S3_BUCKET)
- [ ] Pull latest code: `git pull origin master`
- [ ] Install dependencies (if needed): `npm install --production`
- [ ] Reload application: `pm2 reload digitalsignage`
- [ ] Check logs for S3 configuration: `pm2 logs digitalsignage`
- [ ] Verify S3 CORS configuration in AWS Console
- [ ] Test upload from browser
- [ ] Check browser console for success messages

## 🎯 Summary

**Problem:** Production .env missing AWS S3 configuration  
**Solution:** Add AWS_REGION, AWS_ACCESS_KEY, AWS_SECRET, AWS_S3_BUCKET to .env  
**Deploy:** git pull + pm2 reload  
**Verify:** Check logs and test upload  

Once all steps are complete, S3 uploads should work! 🎉

---

**Last Updated:** December 28, 2025  
**Status:** Awaiting production deployment  
**Required Action:** Add AWS vars to production .env and deploy code

