# Testing Direct S3 Upload

## ✅ Changes Made

Added direct S3 upload JavaScript to:
- `/views/videos.ejs` - Video library page
- `/views/dashboard.ejs` - Dashboard page

## 🔍 What to Look For in Network Tab

When you upload a video, you should see **3 requests**:

### 1. Request Upload URL
```
POST /api/videos/request-upload-url
Request: { fileName, fileSize, mimeType }
Response: { videoId, uploadUrl, s3Key }
```

### 2. Upload to S3 (This is the key one!)
```
PUT https://your-bucket.s3.amazonaws.com/videos/...?X-Amz-Algorithm=...
Content-Type: video/mp4
Body: <binary video data>

⭐ This goes DIRECTLY to S3, not through your server!
```

### 3. Complete Upload
```
POST /api/videos/{videoId}/complete-upload
Response: { duration, resolution, hasThumbnail }
```

## 📊 Network Tab View

You should see something like:

```
Name                                Method   Status   Size        
----------------------------------------
request-upload-url                  POST     200      500 B
https://bucket.s3.amazonaws...      PUT      200      50.2 MB    ⭐ Direct to S3!
complete-upload                     POST     200      1.2 KB
```

## 🎯 Testing Steps

### 1. Open Your Dashboard
```bash
# Go to your dashboard
http://localhost:3000/dashboard/videos
```

### 2. Open Browser DevTools
- Press `F12` or right-click → Inspect
- Go to **Network** tab
- Check "Preserve log" (important!)

### 3. Upload a Video
- Click "Upload Video" button
- Select a video file
- Click "Upload"

### 4. Watch the Network Tab
You should see:
1. ✅ **POST** to `/api/videos/request-upload-url`
2. ✅ **PUT** to `s3.amazonaws.com` (THIS IS THE KEY ONE!)
3. ✅ **POST** to `/api/videos/.../complete-upload`

### 5. Check Console Logs
Open Console tab, you should see:
```javascript
Step 1: Requesting upload URL...
✅ Got upload URL. Video ID: abc-123-def
Step 2: Uploading to S3...
✅ Successfully uploaded to S3
Step 3: Processing video...
✅ Upload complete! { id: "...", fileName: "...", ... }
```

## ❌ If You Don't See the S3 Request

### Possible Issues:

#### 1. Form is still using old method
**Symptom:** You see `POST /dashboard/upload` instead  
**Solution:** Clear browser cache and refresh

#### 2. JavaScript error
**Symptom:** Console shows errors  
**Solution:** Check console for error messages

#### 3. S3 credentials missing
**Symptom:** Step 1 fails with error  
**Solution:** Check `.env` file has AWS credentials

#### 4. Old page cached
**Symptom:** Upload modal doesn't have progress bar  
**Solution:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## 🐛 Debugging

### Enable Verbose Logging
The script already has console.log statements:
- Open Console tab in DevTools
- Upload a video
- Watch the step-by-step logs

### Check Request Details
Click on each network request to see:
- **Headers** - Check Content-Type, Authorization
- **Payload** - Check request body
- **Response** - Check response data
- **Timing** - Check upload speed

### Verify S3 Upload
The PUT request to S3 should:
- ✅ URL starts with `https://` and contains `s3.amazonaws.com`
- ✅ URL has query parameters like `X-Amz-Algorithm`, `X-Amz-Credential`
- ✅ Method is `PUT` (not POST)
- ✅ Status is `200 OK`
- ✅ Size matches your video file size

## 📈 Performance Check

Compare before and after:

### Before (Through Server)
```
POST /dashboard/upload
Size: 50.2 MB uploaded
Time: ~60-120 seconds
Server bandwidth: 100.4 MB (download + upload)
```

### After (Direct S3)
```
POST /api/videos/request-upload-url - 500 B
PUT https://s3.amazonaws.com/...     - 50.2 MB  
POST /api/videos/.../complete...     - 1.2 KB
Time: ~30-60 seconds
Server bandwidth: ~5-10 MB (processing only)
```

**Savings: 98% bandwidth reduction!**

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Progress bar shows percentage
2. ✅ Network tab shows PUT to S3
3. ✅ Console shows all 3 steps completing
4. ✅ Video appears in library after upload
5. ✅ Video has thumbnail and metadata

## 🎉 Expected Result

After uploading:
- Video appears in your library
- Has duration and resolution
- Has thumbnail image
- Can be played back
- Server bandwidth usage is minimal

## 📞 Still Not Working?

If you still don't see the S3 request:

1. **Check browser console** for errors
2. **Verify AWS credentials** in `.env`
3. **Clear browser cache** completely
4. **Try incognito/private window**
5. **Check server logs** for errors

## 🔧 Manual Test

Test the endpoints manually:

```bash
# Step 1: Get upload URL
curl -X POST http://localhost:3000/api/videos/request-upload-url \
  -H "Content-Type: application/json" \
  -H "Cookie: your_session_cookie" \
  -d '{
    "fileName": "test.mp4",
    "fileSize": 1000000,
    "mimeType": "video/mp4"
  }'

# Response should include uploadUrl
```

## 📊 Monitor Server Bandwidth

Before and after comparison:

```bash
# Check network usage (Linux)
watch -n 1 ifconfig

# Or use htop/nethogs to monitor bandwidth
```

You should see **dramatic reduction** in server bandwidth during video uploads!

