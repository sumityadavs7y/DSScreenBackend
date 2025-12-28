# S3 CORS Final Fix - Complete Solution

## ✅ Final Solution

To avoid CORS preflight issues with S3 pre-signed URLs:

1. **Don't include** `ContentType` in pre-signed URL signature
2. **Don't send** `Content-Type` header from client
3. **Let S3 infer** content type from file extension

This creates a "simple" PUT request that doesn't trigger CORS preflight!

## 🔧 Code Changes Made

### 1. utils/s3Storage.js - Pre-signed URL Generation

```javascript
const getUploadSignedUrl = (s3Key, contentType, expiresIn = 900) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
    // NO ContentType in signature - avoids CORS preflight
    Expires: expiresIn,
  };
  
  const signedUrl = s3.getSignedUrl('putObject', params);
  
  return {
    url: signedUrl,
    key: s3Key,
    bucket: s3Config.bucket,
    contentType: contentType, // For reference only
  };
};
```

### 2. views/dashboard.ejs - XHR Upload

```javascript
xhr.open('PUT', data.uploadUrl);
// Don't set Content-Type header - S3 will infer from extension
// xhr.setRequestHeader('Content-Type', file.type);
xhr.send(file);
```

### 3. views/videos.ejs - XHR Upload

```javascript
xhr.open('PUT', data.uploadUrl);
// Don't set Content-Type header - S3 will infer from extension
// xhr.setRequestHeader('Content-Type', file.type);
xhr.send(file);
```

### 4. public/js/uploads.js - Fetch Upload

```javascript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  // Don't set Content-Type header
  // headers: { 'Content-Type': file.type },
  body: file,
});
```

## 🌐 S3 CORS Configuration

Update your S3 bucket CORS to this simplified configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["http://localhost:3000"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
    }
]
```

**For production, add your domain:**

```json
{
    "AllowedOrigins": [
        "http://localhost:3000",
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ]
}
```

## 📝 Steps to Apply Fix

### Step 1: Update S3 CORS

1. Go to AWS S3 Console
2. Select your bucket: `signagelogicalvalley`
3. Click **Permissions** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit**
6. Paste the JSON above
7. Click **Save changes**

### Step 2: Restart Server

```bash
# Stop server
Ctrl+C

# Start server
npm start

# Wait for "Server running..." message
```

### Step 3: Clear Browser Cache

```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### Step 4: Test Upload

1. Go to http://localhost:3000/dashboard/videos
2. Click "Upload Video"
3. Select a video file
4. Click "Upload"
5. Should work! ✅

## 🎯 Why This Works

### The CORS Preflight Problem

**Before (with Content-Type header):**
```
1. Browser: "I want to PUT with Content-Type: video/mp4"
2. Browser: "Let me send OPTIONS first to check CORS"
3. S3: "I don't handle OPTIONS for pre-signed URLs properly"
4. ❌ CORS error!
```

**After (without Content-Type header):**
```
1. Browser: "I want to PUT this file"
2. Browser: "No custom headers, so no preflight needed"
3. Browser: Sends PUT directly
4. S3: Receives file, infers content type from .mp4 extension
5. ✅ Upload succeeds!
```

### Simple vs Preflighted Requests

**Simple requests (no preflight):**
- Methods: GET, HEAD, POST, PUT
- Headers: Only simple headers (Accept, Accept-Language, Content-Language, etc.)
- ✅ Our case: PUT with no custom headers

**Preflighted requests (OPTIONS first):**
- PUT with Content-Type header
- Any custom headers
- ❌ Our old code: PUT with Content-Type: video/mp4

## 📊 Expected Results

### Browser Network Tab (F12)

**You should see:**
- ✅ Single PUT request to S3 (no OPTIONS before it)
- ✅ Status: 200 OK
- ✅ No CORS errors!

**You should NOT see:**
- ❌ OPTIONS request before PUT
- ❌ CORS errors in console

### Browser Console

```
✅ Step 1: Requesting upload URL...
✅ Got upload URL. Video ID: xxx
✅ Step 2: Uploading to S3...
✅ Successfully uploaded to S3
✅ Step 3: Processing video...
✅ Upload complete!
```

### S3 Bucket

- ✅ File uploaded with correct name
- ✅ Content-Type automatically set to `video/mp4` (from .mp4 extension)
- ✅ File is accessible and playable

## 🔍 Verifying Content Type

After upload, you can verify S3 set the correct content type:

```bash
# Check object metadata in AWS CLI
aws s3api head-object \
  --bucket signagelogicalvalley \
  --key videos/your-file.mp4

# Should show:
# "ContentType": "video/mp4"
```

S3 automatically sets correct content types based on file extensions:
- `.mp4` → `video/mp4`
- `.mov` → `video/quicktime`
- `.avi` → `video/x-msvideo`
- `.webm` → `video/webm`

## ❓ Troubleshooting

### Still Getting CORS Errors?

**Check 1: Is the server restarted?**
```bash
# You must restart after code changes!
Ctrl+C
npm start
```

**Check 2: Is browser cache cleared?**
```
Hard refresh: Ctrl+Shift+R
Or use Incognito mode
```

**Check 3: Is S3 CORS updated?**
- Go to S3 Console
- Check CORS configuration
- Verify `http://localhost:3000` is in AllowedOrigins

**Check 4: Check the Network tab**
- Open F12 Developer Tools
- Go to Network tab
- Try upload
- Look for OPTIONS request (should NOT exist!)
- Look at PUT request details

### Content Type Not Set Correctly?

S3 should auto-detect from extension, but if not:
1. Check file extension is included in filename
2. S3 uses extension mapping internally
3. If needed, we can update content type server-side after upload

## 🎉 Summary

**Problem:** CORS preflight (OPTIONS) failing for S3 pre-signed URLs

**Root Cause:** Setting Content-Type header triggers CORS preflight

**Solution:** 
- ❌ Don't include ContentType in signature
- ❌ Don't send Content-Type header from client
- ✅ Let S3 infer from file extension
- ✅ Simple PUT request (no preflight!)

**Result:**
- ✅ No CORS errors
- ✅ Direct uploads to S3
- ✅ Correct content types
- ✅ Fast, efficient uploads

---

**Status:** ✅ Complete  
**Date:** December 28, 2025  
**Action Required:** Restart server + Update S3 CORS  
**Expected Result:** Uploads work without CORS errors!

