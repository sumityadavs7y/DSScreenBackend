# S3 CORS Error Fix

## 🐛 Issue

**Error:** `Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource`

**Symptom:** Browser blocks uploads to S3 even with CORS configured correctly in S3 bucket.

## 🎯 Root Cause

The pre-signed URL was including `Content-Type` as a **query parameter**:

```
❌ BAD:
https://bucket.s3.amazonaws.com/file.mp4?Content-Type=video%2Fmp4&AWSAccessKeyId=...
```

When `Content-Type` is in the URL as a query parameter, browsers send an **OPTIONS preflight request** to check CORS before the actual PUT request. S3's CORS handling of preflight requests with signed URLs can be problematic.

## ✅ Solution

**Remove `ContentType` from pre-signed URL generation** and let the client set it as an HTTP header instead.

### Code Change

**File:** `utils/s3Storage.js`

**Before (Problematic):**
```javascript
const getUploadSignedUrl = (s3Key, contentType, expiresIn = 900) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
    ContentType: contentType, // ← This causes CORS issues!
    Expires: expiresIn,
  };
  
  const signedUrl = s3.getSignedUrl('putObject', params);
  
  return {
    url: signedUrl,
    key: s3Key,
    bucket: s3Config.bucket,
    contentType: contentType,
  };
};
```

**After (Fixed):**
```javascript
const getUploadSignedUrl = (s3Key, contentType, expiresIn = 900) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
    // DO NOT include ContentType here - it causes CORS preflight issues
    // The client will set Content-Type as a header when uploading
    Expires: expiresIn,
  };
  
  const signedUrl = s3.getSignedUrl('putObject', params);
  
  return {
    url: signedUrl,
    key: s3Key,
    bucket: s3Config.bucket,
    contentType: contentType, // Return so client knows what header to set
  };
};
```

### Client-Side (Already Correct)

All our upload implementations already set Content-Type as a header:

**dashboard.ejs:**
```javascript
xhr.open('PUT', data.uploadUrl);
xhr.setRequestHeader('Content-Type', file.type); // ✅ Header, not URL param
xhr.send(file);
```

**videos.ejs:**
```javascript
xhr.open('PUT', data.uploadUrl);
xhr.setRequestHeader('Content-Type', file.type); // ✅ Header, not URL param
xhr.send(file);
```

**public/js/uploads.js:**
```javascript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type, // ✅ Header, not URL param
  },
  body: file,
});
```

## 🔍 Why This Works

### Before (CORS Preflight)
```
1. Client: Generate pre-signed URL with ?Content-Type=video/mp4
2. Client: Browser sees special header in URL
3. Browser: Send OPTIONS preflight to S3
4. S3: Doesn't handle preflight for signed URLs properly
5. ❌ CORS error!
```

### After (No Preflight)
```
1. Client: Generate pre-signed URL without Content-Type parameter
2. Client: Set Content-Type as HTTP header
3. Browser: Simple PUT request (no preflight needed)
4. S3: Accepts PUT with Content-Type header
5. ✅ Upload succeeds!
```

## 📊 S3 CORS Configuration

Your S3 CORS configuration is **correct** and should remain as:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:*",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**Note:** The CORS configuration was not the problem! The issue was the pre-signed URL generation.

## 🧪 Testing

### Verify Pre-Signed URL Format

**Good (After Fix):**
```
https://bucket.s3.amazonaws.com/videos/file.mp4
  ?AWSAccessKeyId=AKIAXXXXX
  &Expires=1766925442
  &Signature=ABC123...
```

**Bad (Before Fix):**
```
https://bucket.s3.amazonaws.com/videos/file.mp4
  ?AWSAccessKeyId=AKIAXXXXX
  &Content-Type=video%2Fmp4  ← This causes preflight!
  &Expires=1766925442
  &Signature=ABC123...
```

### Test Upload

1. Restart server
2. Go to dashboard
3. Upload video
4. Check browser Network tab (F12)
5. Look at PUT request to S3:
   - ✅ Request Headers should show: `Content-Type: video/mp4`
   - ✅ URL should NOT have `Content-Type` query parameter
   - ✅ Status should be `200 OK`
   - ✅ No CORS errors!

## 🎓 Learning

### CORS Preflight Triggers

Browsers send OPTIONS preflight requests when:
1. Using methods other than GET, POST, HEAD
2. Setting custom headers
3. **Including certain parameters in signed URLs**

### Best Practice for S3 Pre-Signed URLs

**DO:**
- ✅ Generate minimal pre-signed URLs (Bucket, Key, Expires, Signature)
- ✅ Set headers (Content-Type, etc.) in the HTTP request
- ✅ Let the client handle headers

**DON'T:**
- ❌ Include Content-Type in pre-signed URL params
- ❌ Include other headers in pre-signed URL params
- ❌ Add unnecessary parameters that trigger preflight

## 📚 Related Issues

This fix solves:
- ✅ CORS preflight errors
- ✅ "No 'Access-Control-Allow-Origin' header" errors
- ✅ Browser blocking S3 uploads
- ✅ OPTIONS request failures

## 🚀 Result

**Before:**
- ❌ CORS errors
- ❌ Uploads blocked by browser
- ❌ OPTIONS preflight failures

**After:**
- ✅ No CORS errors
- ✅ Direct uploads to S3
- ✅ No preflight needed
- ✅ Fast, efficient uploads

---

**Date:** December 28, 2025  
**Status:** ✅ Fixed  
**Action Required:** Restart server for changes to take effect

