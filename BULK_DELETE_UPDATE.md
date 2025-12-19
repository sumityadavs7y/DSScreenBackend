# Bulk Delete Videos - Feature Update

## ✅ Feature Added

A bulk delete endpoint has been successfully added to the video management system, allowing users to delete multiple videos in a single request.

## 🎯 What's New

### New Endpoint: POST `/api/videos/bulk-delete`

Delete multiple videos in one request with detailed results for each video.

**Key Features:**
- Delete up to 100 videos per request
- Individual permission checks for each video
- Detailed success/failure reporting
- Atomic operations (each video processed independently)
- Returns which videos were deleted and which failed (with reasons)

## 📋 API Specification

### Request

**Endpoint**: `POST /api/videos/bulk-delete`

**Authentication**: Required (Bearer Token)

**Roles**: `owner`, `admin`, `manager`, `member`

**Headers**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "videoIds": [
    "video-uuid-1",
    "video-uuid-2",
    "video-uuid-3"
  ]
}
```

**Validation Rules**:
- `videoIds` must be a non-empty array
- Each ID must be a valid UUID
- Maximum 100 videos per request

### Response

**Success Response** (200):
```json
{
  "success": true,
  "message": "Deleted 3 video(s), 0 failed",
  "data": {
    "deleted": [
      {
        "id": "video-uuid-1",
        "fileName": "Presentation Video",
        "fileDeleted": true
      },
      {
        "id": "video-uuid-2",
        "fileName": "Training Video",
        "fileDeleted": true
      },
      {
        "id": "video-uuid-3",
        "fileName": "Demo Video",
        "fileDeleted": true
      }
    ],
    "failed": [],
    "summary": {
      "total": 3,
      "deletedCount": 3,
      "failedCount": 0
    }
  }
}
```

**Partial Success Response** (207):
```json
{
  "success": true,
  "message": "Deleted 2 video(s), 1 failed",
  "data": {
    "deleted": [
      {
        "id": "video-uuid-1",
        "fileName": "My Video",
        "fileDeleted": true
      },
      {
        "id": "video-uuid-2",
        "fileName": "Another Video",
        "fileDeleted": true
      }
    ],
    "failed": [
      {
        "id": "video-uuid-3",
        "fileName": "Protected Video",
        "reason": "Insufficient permissions"
      }
    ],
    "summary": {
      "total": 3,
      "deletedCount": 2,
      "failedCount": 1
    }
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "videoIds must be a non-empty array",
      "param": "videoIds"
    }
  ]
}
```

**Error Response** (404):
```json
{
  "success": false,
  "message": "No videos found"
}
```

## 🔐 Permissions

The bulk delete endpoint follows the same permission rules as single delete:

- **Member**: Can only delete their own videos
- **Manager**: Can delete any video in the company
- **Admin**: Can delete any video in the company
- **Owner**: Can delete any video in the company

Each video in the request is checked individually. Videos the user doesn't have permission to delete will be listed in the `failed` array with reason "Insufficient permissions".

## 📝 Usage Examples

### cURL

```bash
curl -X POST http://localhost:3000/api/videos/bulk-delete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoIds": [
      "123e4567-e89b-12d3-a456-426614174000",
      "223e4567-e89b-12d3-a456-426614174001",
      "323e4567-e89b-12d3-a456-426614174002"
    ]
  }'
```

### JavaScript/Fetch

```javascript
const deleteVideos = async (videoIds) => {
  const response = await fetch('http://localhost:3000/api/videos/bulk-delete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ videoIds })
  });
  
  const result = await response.json();
  
  console.log(`Deleted: ${result.data.summary.deletedCount}`);
  console.log(`Failed: ${result.data.summary.failedCount}`);
  
  if (result.data.failed.length > 0) {
    result.data.failed.forEach(f => {
      console.log(`Failed to delete ${f.fileName}: ${f.reason}`);
    });
  }
  
  return result;
};

// Usage
deleteVideos(['id1', 'id2', 'id3']);
```

### React Component

```javascript
import React, { useState } from 'react';

function BulkDeleteVideos({ selectedVideoIds, onComplete }) {
  const [deleting, setDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedVideoIds.length === 0) {
      alert('No videos selected');
      return;
    }

    if (!confirm(`Delete ${selectedVideoIds.length} video(s)?`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch('/api/videos/bulk-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoIds: selectedVideoIds })
      });

      const result = await response.json();

      if (result.success || result.data.deletedCount > 0) {
        alert(`Deleted ${result.data.summary.deletedCount} video(s)`);
        
        if (result.data.failed.length > 0) {
          console.warn('Some deletions failed:', result.data.failed);
        }
        
        onComplete();
      } else {
        alert('Failed to delete videos: ' + result.message);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleBulkDelete} 
      disabled={deleting || selectedVideoIds.length === 0}
    >
      {deleting ? 'Deleting...' : `Delete ${selectedVideoIds.length} Video(s)`}
    </button>
  );
}
```

## 🧪 Postman Testing

The Postman collection has been updated with the bulk delete endpoint.

**To test in Postman:**

1. Ensure you're authenticated (run Login → Select Company)
2. Upload multiple test videos (or note existing video IDs)
3. Open **Video Management** → **Bulk Delete Videos**
4. Update the `videoIds` array in the request body
5. Click **Send**
6. Review the detailed response showing successes and failures

**Sample Request Body in Postman:**
```json
{
  "videoIds": [
    "{{videoId}}",
    "another-video-id",
    "yet-another-video-id"
  ]
}
```

## ⚠️ Important Notes

### Limits
- **Maximum**: 100 videos per request
- Requests with more than 100 videos will be rejected with a 400 error

### Behavior
- Each video is processed independently
- Failure to delete one video doesn't stop others
- Both file and database record are deleted for each successful deletion
- Returns HTTP 207 (Multi-Status) when some succeed and some fail
- Returns HTTP 200 when all succeed
- Returns HTTP 404 when none are found

### Common Failure Reasons
1. **"Insufficient permissions"**: User doesn't have permission to delete that video
2. **"Video not found or already deleted"**: Video doesn't exist or is already inactive
3. **File system errors**: Issues deleting the physical file

### Performance
- Each video is deleted sequentially (not parallel)
- Large batches may take time depending on file system performance
- Consider breaking very large deletions into multiple requests

## 📁 Files Updated

### Core Implementation
1. ✅ `/routes/video.js` - Added bulk delete endpoint

### Documentation
2. ✅ `/postman_collection.json` - Added bulk delete request
3. ✅ `/VIDEO_API_QUICK_REFERENCE.md` - Added endpoint reference
4. ✅ `/VIDEO_UPLOAD_GUIDE.md` - Added detailed documentation
5. ✅ `/POSTMAN_GUIDE.md` - Added endpoint to table
6. ✅ `/POSTMAN_VIDEO_UPDATE.md` - Updated count and descriptions
7. ✅ `/README.md` - Added quick example
8. ✅ `/public/video-upload-test.html` - Added bulk delete UI

### New Documentation
9. ✅ `/BULK_DELETE_UPDATE.md` - This file

## 🎨 Web Interface Update

The test HTML page (`video-upload-test.html`) now includes:
- Checkboxes for each video
- Bulk selection counter
- "Delete Selected" button
- Clear selection option
- Detailed result display

## 🔄 API Endpoint Summary

| Endpoint | Method | Purpose | Max Items |
|----------|--------|---------|-----------|
| `/api/videos/:videoId` | DELETE | Delete single video | 1 |
| `/api/videos/bulk-delete` | POST | Delete multiple videos | 100 |

## ✨ Use Cases

### 1. Cleanup Old Content
```javascript
// Get videos older than 30 days
const oldVideos = videos.filter(v => {
  const uploadDate = new Date(v.uploadedAt);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return uploadDate < thirtyDaysAgo;
});

// Delete them in bulk
await bulkDelete(oldVideos.map(v => v.id));
```

### 2. Category-Based Deletion
```javascript
// Delete all videos in a specific category
const trainingVideos = videos.filter(v => 
  v.metadata?.category === 'training'
);

await bulkDelete(trainingVideos.map(v => v.id));
```

### 3. User Content Cleanup
```javascript
// Delete all videos uploaded by a specific user
const userVideos = videos.filter(v => 
  v.uploadedBy.id === specificUserId
);

await bulkDelete(userVideos.map(v => v.id));
```

## 🐛 Error Handling

The endpoint includes comprehensive error handling:

```javascript
try {
  const result = await bulkDeleteVideos(videoIds);
  
  // Check summary
  console.log(`Total: ${result.data.summary.total}`);
  console.log(`Deleted: ${result.data.summary.deletedCount}`);
  console.log(`Failed: ${result.data.summary.failedCount}`);
  
  // Handle failures
  if (result.data.failed.length > 0) {
    result.data.failed.forEach(failure => {
      console.error(`❌ ${failure.fileName}: ${failure.reason}`);
      
      // Handle specific failure reasons
      if (failure.reason === 'Insufficient permissions') {
        // User doesn't have permission
      } else if (failure.reason.includes('not found')) {
        // Video doesn't exist
      }
    });
  }
  
  // Handle successes
  result.data.deleted.forEach(success => {
    console.log(`✅ Deleted ${success.fileName}`);
  });
  
} catch (error) {
  console.error('Bulk delete failed:', error);
}
```

## 📊 Response Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | All videos deleted successfully |
| 207 | Multi-Status | Some succeeded, some failed |
| 400 | Bad Request | Invalid input (not array, invalid UUIDs, too many) |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Wrong company context |
| 404 | Not Found | No videos found at all |
| 500 | Server Error | Unexpected error |

## 🎉 Summary

The bulk delete feature provides:
- ✅ Efficient multi-video deletion
- ✅ Detailed per-video results
- ✅ Proper permission checking
- ✅ Error handling and reporting
- ✅ Complete documentation
- ✅ Postman integration
- ✅ Web UI support

This feature is production-ready and follows the same security and permission model as the rest of the video management system!

