# S3 Direct Upload Implementation Guide

## Overview

The system now supports **direct upload to S3** using pre-signed URLs, eliminating the need for videos to pass through your server. This saves **50% of your bandwidth** and makes uploads much faster.

## Upload Methods

### Method 1: Direct S3 Upload (Recommended) ✅
**Bandwidth used:** Client → S3 only  
**Speed:** Fast (direct to cloud)  
**Use for:** API clients, mobile apps, production

```
Client → Request URL → Server (generates URL)
Client → Upload → S3 (directly)
Client → Notify → Server (process metadata)
```

### Method 2: Through-Server Upload (Legacy)
**Bandwidth used:** Client → Server → S3  
**Speed:** Slower (double transfer)  
**Use for:** Simple implementations, testing

```
Client → Upload → Server → S3
```

## Direct Upload Flow (3 Steps)

### Step 1: Request Upload URL

**Endpoint:** `POST /api/videos/request-upload-url`

**Request:**
```json
{
  "fileName": "my-video.mp4",
  "fileSize": 52428800,
  "mimeType": "video/mp4",
  "displayName": "My Awesome Video" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload URL generated successfully",
  "data": {
    "videoId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "uploadUrl": "https://bucket.s3.amazonaws.com/videos/...",
    "s3Key": "videos/prod_company_...",
    "fileName": "My Awesome Video",
    "expiresIn": 900,
    "wasRenamed": false
  }
}
```

**What happens:**
- Server validates file size and type
- Server checks company storage quota
- Server creates database record (inactive)
- Server generates S3 pre-signed URL (15 min expiry)
- Server returns URL to client

### Step 2: Upload to S3

**Request:**
```javascript
// Direct PUT request to S3
PUT <uploadUrl>
Content-Type: video/mp4
Body: <binary video data>
```

**Example (JavaScript):**
```javascript
const response = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': mimeType,
  },
  body: videoFile,
});

if (!response.ok) {
  throw new Error('S3 upload failed');
}
```

**What happens:**
- Client uploads directly to S3 (no server involvement)
- AWS S3 receives and stores the video
- Upload uses your client's bandwidth, not server's

### Step 3: Complete Upload

**Endpoint:** `POST /api/videos/:videoId/complete-upload`

**Request:**
```javascript
POST /api/videos/a1b2c3d4-5678-90ab-cdef-1234567890ab/complete-upload
```

**Response:**
```json
{
  "success": true,
  "message": "Upload completed successfully",
  "data": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "fileName": "My Awesome Video",
    "fileSize": 52428800,
    "duration": 120.5,
    "resolution": "1920x1080",
    "hasThumbnail": true,
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**What happens:**
- Server verifies video exists in S3
- Server downloads video temporarily for processing
- Server extracts metadata (duration, resolution, codec, bitrate, fps)
- Server generates thumbnail at 10% of duration
- Server uploads thumbnail to S3
- Server updates database with metadata
- Server activates video record
- Server updates company storage usage
- Server cleans up temporary files

## Complete Example

### JavaScript/TypeScript

```javascript
async function uploadVideoDirectly(file) {
  try {
    // Step 1: Request upload URL
    const urlResponse = await fetch('/api/videos/request-upload-url', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json();
      throw new Error(error.message);
    }

    const { data } = await urlResponse.json();
    const { videoId, uploadUrl } = data;

    // Step 2: Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    // Step 3: Complete upload
    const completeResponse = await fetch(
      `/api/videos/${videoId}/complete-upload`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      throw new Error(error.message);
    }

    const result = await completeResponse.json();
    console.log('Upload successful:', result.data);
    return result.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Usage
const fileInput = document.getElementById('videoFile');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const video = await uploadVideoDirectly(file);
      alert(`Video "${video.fileName}" uploaded successfully!`);
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  }
});
```

### With Progress Tracking

```javascript
async function uploadVideoWithProgress(file, onProgress) {
  try {
    // Step 1: Request upload URL
    onProgress({ step: 1, status: 'Requesting upload URL...' });
    
    const urlResponse = await fetch('/api/videos/request-upload-url', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });

    const { data } = await urlResponse.json();
    const { videoId, uploadUrl } = data;

    // Step 2: Upload to S3 with XMLHttpRequest for progress
    onProgress({ step: 2, status: 'Uploading to cloud...', progress: 0 });

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress({
            step: 2,
            status: 'Uploading to cloud...',
            progress: percentComplete,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error('S3 upload failed'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload error')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Step 3: Complete upload
    onProgress({ step: 3, status: 'Processing video...', progress: 100 });

    const completeResponse = await fetch(
      `/api/videos/${videoId}/complete-upload`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const result = await completeResponse.json();
    onProgress({ step: 3, status: 'Complete!', progress: 100 });
    
    return result.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Usage with progress
uploadVideoWithProgress(file, (progress) => {
  console.log(`Step ${progress.step}: ${progress.status}`);
  if (progress.progress !== undefined) {
    console.log(`Progress: ${progress.progress.toFixed(2)}%`);
    updateProgressBar(progress.progress);
  }
});
```

### React Example

```typescript
import React, { useState } from 'react';

interface UploadProgress {
  step: number;
  status: string;
  progress?: number;
}

export function VideoUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    
    try {
      // Step 1
      setProgress({ step: 1, status: 'Preparing upload...' });
      
      const urlRes = await fetch('/api/videos/request-upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      
      const { data } = await urlRes.json();
      
      // Step 2
      setProgress({ step: 2, status: 'Uploading...', progress: 0 });
      
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            setProgress({
              step: 2,
              status: 'Uploading...',
              progress: percent,
            });
          }
        };
        
        xhr.onload = () => xhr.status === 200 ? resolve(null) : reject();
        xhr.onerror = reject;
        
        xhr.open('PUT', data.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
      
      // Step 3
      setProgress({ step: 3, status: 'Processing...', progress: 100 });
      
      await fetch(`/api/videos/${data.videoId}/complete-upload`, {
        method: 'POST',
        credentials: 'include',
      });
      
      setProgress({ step: 3, status: 'Complete!', progress: 100 });
      alert('Upload successful!');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      
      {progress && (
        <div>
          <p>Step {progress.step}/3: {progress.status}</p>
          {progress.progress !== undefined && (
            <progress value={progress.progress} max="100" />
          )}
        </div>
      )}
    </div>
  );
}
```

## API Endpoints Summary

### POST /api/videos/request-upload-url
- **Auth:** Required (Bearer token)
- **Roles:** owner, admin, manager, member
- **Body:** `{ fileName, fileSize, mimeType, displayName? }`
- **Returns:** Pre-signed URL (15 min expiry)

### POST /api/videos/:videoId/complete-upload
- **Auth:** Required (Bearer token)
- **Roles:** owner, admin, manager, member
- **Returns:** Video metadata

### POST /api/videos/upload (Legacy)
- **Auth:** Required (Bearer token)
- **Roles:** owner, admin, manager, member
- **Body:** multipart/form-data
- **Note:** Uploads through server (uses double bandwidth)

## Error Handling

### Step 1 Errors (Request URL)
```json
{
  "success": false,
  "message": "Company storage limit exceeded...",
  "data": {
    "currentUsage": 524288000,
    "fileSize": 52428800,
    "limit": 524288000,
    "availableSpace": 0
  }
}
```

**Common errors:**
- `400` - Invalid file type, file too large
- `413` - Company storage limit exceeded
- `401` - Authentication required
- `403` - Insufficient permissions

### Step 2 Errors (S3 Upload)
- `403 Forbidden` - Pre-signed URL expired (>15 min)
- `400 Bad Request` - Content-Type mismatch
- Network errors - Check client internet connection

### Step 3 Errors (Complete)
```json
{
  "success": false,
  "message": "Video file not found in storage. Upload may have failed."
}
```

**Common errors:**
- `404` - Video not found or S3 file missing
- `400` - Video already completed
- `500` - Metadata extraction failed (video still saved)

## Best Practices

### 1. Validate Before Requesting URL
```javascript
// Check file type
const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
if (!validTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}

// Check file size
const maxSize = 500 * 1024 * 1024; // 500MB
if (file.size > maxSize) {
  throw new Error('File too large');
}
```

### 2. Handle URL Expiration
Pre-signed URLs expire after 15 minutes. If upload takes longer:
```javascript
// Store start time
const startTime = Date.now();

// Check before upload
if (Date.now() - startTime > 13 * 60 * 1000) { // 13 min
  // Request new URL
  console.warn('URL may expire soon, requesting new one');
}
```

### 3. Retry Logic
```javascript
async function uploadWithRetry(file, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadVideoDirectly(file);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, 2000)); // Wait 2s
    }
  }
}
```

### 4. Cleanup on Failure
If upload fails after Step 1, the database has an inactive video record. These can be cleaned up with a cron job or manually. They won't appear in video lists since `isActive = false`.

### 5. Show Progress
Always show upload progress for better UX, especially for large files.

## Performance Comparison

### Direct Upload (New)
- **Time for 500MB video:** ~30-60 seconds (depends on client internet)
- **Server bandwidth used:** ~5-10MB (for processing only)
- **Client bandwidth used:** ~500MB (upload to S3)

### Through-Server Upload (Legacy)
- **Time for 500MB video:** ~60-120 seconds (double transfer)
- **Server bandwidth used:** ~1000MB (download + upload)
- **Client bandwidth used:** ~500MB (upload to server)

### Bandwidth Savings
For 100 videos (500MB each):
- **Legacy method:** 50GB server bandwidth
- **Direct upload:** 0.5-1GB server bandwidth (98% reduction!)

## Migration from Legacy

If you have existing code using `/api/videos/upload`:

1. **Update gradually** - Both methods work simultaneously
2. **Test in development** - Verify direct upload works
3. **Update API clients** - Switch to 3-step flow
4. **Keep legacy for web** - Dashboard can still use form upload
5. **Monitor usage** - Check bandwidth savings

## Troubleshooting

### Upload URL returns 403
- Check AWS credentials in `.env`
- Verify S3 bucket permissions
- Ensure bucket exists and is accessible

### S3 upload fails with CORS error
- Enable CORS on S3 bucket
- Add your domain to allowed origins
- See S3_MIGRATION_GUIDE.md for CORS setup

### Video shows "processing_failed"
- Video is still saved in S3
- Metadata extraction failed (FFmpeg issue)
- Thumbnail generation failed
- Video is still playable

### Upload works but video doesn't appear
- Check `isActive` status in database
- Ensure Step 3 (complete-upload) was called
- Check for errors in Step 3 response

## Security Considerations

1. **Pre-signed URLs are temporary** (15 min)
2. **URLs are user-specific** (tied to their session)
3. **S3 bucket should be private** (not public)
4. **Videos served through API** (with authentication if needed)
5. **Validate file size/type** before generating URL

## Monitoring

Track these metrics:
- Upload success rate (Step 1 → Step 3)
- Average upload time
- Bandwidth savings
- Failed uploads (orphaned records)
- S3 costs

## Next Steps

1. Implement direct upload in your client
2. Test with various file sizes
3. Add progress indicators
4. Monitor bandwidth usage
5. Consider CloudFront CDN for downloads

## Support

For issues or questions:
- Check application logs
- Verify AWS credentials
- Test S3 access with AWS CLI
- Review network requests in browser DevTools

