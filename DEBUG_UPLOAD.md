# Debug Upload Issues

## ✅ Fixes Applied

1. Added `requireCompany` middleware to both endpoints
2. Added better error logging in frontend JavaScript
3. Added response status logging

## 🔍 Debug Steps

### 1. Check Browser Console

Open DevTools (F12) → Console tab and look for:

```javascript
Step 1: Requesting upload URL...
✅ Got upload URL. Video ID: xxx-xxx-xxx
Step 2: Uploading to S3...
✅ Successfully uploaded to S3
Step 3: Processing video...
Complete response status: XXX  ← Check this!
```

### 2. Common Issues & Solutions

#### Issue: "Complete response status: 401"
**Problem:** Authentication failed  
**Solution:**
- Make sure you're logged in
- Try refreshing the page
- Check if session cookie exists (DevTools → Application → Cookies)

#### Issue: "Complete response status: 403"
**Problem:** Missing company context or insufficient permissions  
**Solution:**
- Go to `/company-selection` and select your company
- Make sure you have upload permissions

#### Issue: "Complete response status: 404"
**Problem:** Video not found or S3 file missing  
**Solution:**
- Check if Step 2 (S3 upload) completed successfully
- Verify S3 bucket and credentials are correct

#### Issue: "Complete response status: 500"
**Problem:** Server error during processing  
**Solution:**
- Check server logs for detailed error
- May be FFmpeg issue (metadata extraction)
- Video might still be saved even if metadata extraction fails

### 3. Check Network Tab

Open DevTools (F12) → Network tab:

#### Request 1: request-upload-url
```
Status: 200 ✅
Response: { "success": true, "data": { "videoId": "...", "uploadUrl": "..." } }
```

#### Request 2: S3 Upload
```
URL: https://...s3.amazonaws.com/...
Method: PUT
Status: 200 ✅
Size: (your video size)
```

#### Request 3: complete-upload
```
URL: /api/videos/{videoId}/complete-upload
Method: POST
Status: Should be 200 ✅
Response: { "success": true, "data": { ... } }
```

### 4. Check Server Logs

In your terminal where the server is running, look for:

```bash
✅ Video metadata extracted: { duration: 120.5, resolution: '1920x1080' }
✅ Thumbnail generated and uploaded: thumbnails/...
✅ Upload to S3: videos/...
```

Or errors like:
```bash
❌ Failed to extract video metadata: ...
⚠️  Failed to generate thumbnail: ...
```

### 5. Manual API Test

Test the endpoints manually:

```bash
# Step 1: Get your session cookie
# (Copy from DevTools → Application → Cookies → session cookie)

# Step 2: Test request-upload-url
curl -X POST http://localhost:3000/api/videos/request-upload-url \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "fileName": "test.mp4",
    "fileSize": 1000000,
    "mimeType": "video/mp4"
  }'

# Should return: {"success":true,"data":{"videoId":"...","uploadUrl":"..."}}
```

## 🐛 Common Error Messages

### "Upload failed: Invalid video ID format"
- VideoId is not a valid UUID
- Check Step 1 response

### "Upload failed: Video not found"
- Video record not created in Step 1
- Or you're trying to complete someone else's upload
- Check if you're in the correct company

### "Upload failed: Video file not found in storage"
- S3 upload (Step 2) didn't complete
- Or S3 credentials are wrong
- Check S3 bucket for the file

### "Upload failed: Upload completed but with errors"
- Server responded but success=false
- Check server logs for detailed error

## 📊 Verify S3 Upload

Check if file exists in S3:

```bash
# Using AWS CLI
aws s3 ls s3://your-bucket/videos/ --recursive | grep your-video-id

# Or check S3 console
# https://s3.console.aws.amazon.com/s3/buckets/your-bucket/
```

## 🔧 Server-Side Debugging

Add this to your `.env` for more verbose logging:

```bash
NODE_ENV=development
DEBUG=*
```

Then restart your server and check logs during upload.

## ✅ Success Indicators

Upload is successful when:

1. ✅ All 3 steps complete in console
2. ✅ Progress bar reaches 100%
3. ✅ Video appears in library
4. ✅ Video has metadata (duration, resolution)
5. ✅ Video has thumbnail (if generated)
6. ✅ Video is playable

## 🆘 Still Having Issues?

### Quick Checklist:

- [ ] Are you logged in?
- [ ] Have you selected a company?
- [ ] Do you have upload permissions?
- [ ] Are AWS credentials in `.env` correct?
- [ ] Is S3 bucket accessible?
- [ ] Is FFmpeg installed (for metadata extraction)?
- [ ] Does `/tmp` directory exist and is writable?
- [ ] Check server logs for errors

### Get More Info:

1. Open browser console before upload
2. Upload a small test video (5-10MB)
3. Copy ALL console logs
4. Copy complete-upload response from Network tab
5. Check server terminal logs
6. Share these logs for debugging

## 💡 Workaround

If metadata extraction keeps failing but video uploads successfully:

The video **IS** saved in S3! It just doesn't have metadata or thumbnail. You can:
- Still play the video
- Manually add duration/resolution later
- Re-generate thumbnail with a script

The upload is NOT lost!

