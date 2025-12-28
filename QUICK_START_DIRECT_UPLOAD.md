# Quick Start: Direct S3 Upload

## TL;DR

Videos now upload **directly to S3**, saving **98% of server bandwidth**. Use this 3-step flow:

## 3-Step Upload

### 1️⃣ Request URL
```javascript
const response = await fetch('/api/videos/request-upload-url', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  }),
});
const { data } = await response.json();
```

### 2️⃣ Upload to S3
```javascript
await fetch(data.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file, // Raw file, not FormData!
});
```

### 3️⃣ Complete
```javascript
await fetch(`/api/videos/${data.videoId}/complete-upload`, {
  method: 'POST',
  credentials: 'include',
});
```

## Complete Function

```javascript
async function uploadVideo(file) {
  // Step 1
  const { data } = await fetch('/api/videos/request-upload-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  }).then(r => r.json());

  // Step 2
  await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  // Step 3
  await fetch(`/api/videos/${data.videoId}/complete-upload`, {
    method: 'POST',
    credentials: 'include',
  });

  return data.videoId;
}
```

## Usage

```javascript
const fileInput = document.getElementById('video');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  try {
    const videoId = await uploadVideo(file);
    alert('Upload successful! Video ID: ' + videoId);
  } catch (error) {
    alert('Upload failed: ' + error.message);
  }
});
```

## Key Points

✅ **Step 2 is direct to S3** - No server bandwidth used  
✅ **URL expires in 15 minutes** - Start upload quickly  
✅ **Use PUT, not POST** - For S3 upload  
✅ **Raw file, not FormData** - Direct binary upload  
✅ **Step 3 processes metadata** - Extracts duration, resolution, generates thumbnail  

## Bandwidth Savings

| Method | Server Bandwidth (500MB video) |
|--------|-------------------------------|
| Legacy | 1000MB (download + upload) |
| Direct | 5-10MB (processing only) |
| **Savings** | **98% reduction!** |

## Error Handling

```javascript
try {
  const videoId = await uploadVideo(file);
} catch (error) {
  if (error.message.includes('storage limit')) {
    alert('Storage quota exceeded');
  } else if (error.message.includes('too large')) {
    alert('File too large (max 500MB)');
  } else {
    alert('Upload failed: ' + error.message);
  }
}
```

## With Progress

```javascript
async function uploadWithProgress(file, onProgress) {
  // Step 1
  onProgress('Preparing...');
  const { data } = await fetch('/api/videos/request-upload-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  }).then(r => r.json());

  // Step 2 with progress
  onProgress('Uploading...');
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        onProgress(`Uploading: ${percent.toFixed(0)}%`);
      }
    };
    xhr.onload = () => xhr.status === 200 ? resolve() : reject();
    xhr.onerror = reject;
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });

  // Step 3
  onProgress('Processing...');
  await fetch(`/api/videos/${data.videoId}/complete-upload`, {
    method: 'POST',
    credentials: 'include',
  });

  onProgress('Complete!');
  return data.videoId;
}

// Usage
uploadWithProgress(file, (status) => {
  document.getElementById('status').textContent = status;
});
```

## Legacy Method (Still Works)

If you prefer the old way:

```javascript
const formData = new FormData();
formData.append('video', file);

await fetch('/api/videos/upload', {
  method: 'POST',
  credentials: 'include',
  body: formData,
});
```

⚠️ **Note:** Legacy method uses 2x server bandwidth

## Need More Details?

See **S3_DIRECT_UPLOAD_GUIDE.md** for:
- React examples
- Retry logic
- Error handling
- Best practices
- Troubleshooting

## Environment Setup

Already configured! Just ensure `.env` has:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY=your_key
AWS_SECRET=your_secret
AWS_S3_BUCKET=your_bucket
```

## Testing

```bash
# Test with curl
curl -X POST http://localhost:3000/api/videos/request-upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fileName":"test.mp4","fileSize":1000000,"mimeType":"video/mp4"}'
```

## That's It! 🎉

Three simple steps, 98% bandwidth savings. Happy uploading!

