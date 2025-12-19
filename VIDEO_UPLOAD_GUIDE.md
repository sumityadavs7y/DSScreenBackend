# Video Upload System Guide

This guide explains the video upload system implementation with company-specific folders and access control.

## Overview

The video upload system allows users to:
- Upload video files to their company-specific folder
- List and view videos in their company
- Update video metadata (file name, custom metadata)
- Delete videos they uploaded or have permission to delete
- **Company isolation**: Each company has its own folder, and users cannot access videos from other companies

## Features

✅ **Company-Specific Folders**: Videos are stored in `videos/{companyId}/` directories
✅ **Automatic Folder Creation**: Company folders are created automatically on first upload
✅ **File Isolation**: Companies can only access their own videos
✅ **Smart Duplicate Handling**: Automatically numbers duplicate filenames (e.g., "Video (1)", "Video (2)")
✅ **File Metadata Storage**: All file information is stored in the database
✅ **Automatic Cleanup**: When a video is deleted, both the file and database record are removed
✅ **Role-Based Access Control**: Different roles have different permissions
✅ **File Explorer**: List and browse videos like a file explorer (single level only)
✅ **Video File Validation**: Only video MIME types are allowed
✅ **File Size Limit**: Maximum 500MB per video file

## Database Schema

### Videos Table

```sql
videos (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL (Foreign Key → companies.id),
  uploaded_by UUID NOT NULL (Foreign Key → users.id),
  file_name VARCHAR NOT NULL (Display name),
  original_file_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL (Relative path in filesystem),
  file_size BIGINT NOT NULL (Bytes),
  mime_type VARCHAR NOT NULL,
  duration FLOAT (Optional - video duration in seconds),
  resolution VARCHAR (Optional - e.g., "1920x1080"),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT {},
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(company_id, file_name) -- Prevents duplicate names in same company
)
```

## API Endpoints

### 1. Upload Video

**POST** `/api/videos/upload`

Upload a new video file to your company's folder.

**Authentication**: Required (Bearer Token)
**Roles**: `owner`, `admin`, `manager`, `member`
**Content-Type**: `multipart/form-data`

**Request Body**:
- `video` (file, required): The video file
- `displayName` (string, optional): Custom display name for the file
- `metadata` (JSON string, optional): Custom metadata as JSON string

**Example Request** (cURL):
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "video=@/path/to/video.mp4" \
  -F "displayName=My Presentation Video" \
  -F "metadata={\"category\":\"training\",\"tags\":[\"demo\",\"tutorial\"]}"
```

**Example Request** (JavaScript/Fetch):
```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);
formData.append('displayName', 'My Presentation Video');
formData.append('metadata', JSON.stringify({
  category: 'training',
  tags: ['demo', 'tutorial']
}));

const response = await fetch('http://localhost:3000/api/videos/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
  },
  body: formData
});

const data = await response.json();
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Video uploaded successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fileName": "My Presentation Video",
    "originalName": "My Presentation Video",
    "fileSize": 52428800,
    "mimeType": "video/mp4",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "wasRenamed": false
  }
}
```

**Success Response with Auto-Numbering** (201):
```json
{
  "success": true,
  "message": "Video uploaded successfully. Name was changed to \"My Presentation Video (1)\" to avoid duplicates.",
  "data": {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "fileName": "My Presentation Video (1)",
    "originalName": "My Presentation Video",
    "fileSize": 52428800,
    "mimeType": "video/mp4",
    "uploadedAt": "2024-01-15T10:35:00.000Z",
    "wasRenamed": true
  }
}
```

**Error Responses**:
- `400`: Invalid file type, file too large, validation error, or unable to generate unique filename
- `401`: Unauthorized (invalid or missing token)
- `403`: Insufficient permissions

### 2. List All Videos

**GET** `/api/videos`

Get a list of all videos in your company.

**Authentication**: Required (Bearer Token)
**Roles**: All authenticated users

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/videos \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "fileName": "My Presentation Video",
        "originalFileName": "presentation_final.mp4",
        "fileSize": 52428800,
        "mimeType": "video/mp4",
        "duration": 300.5,
        "resolution": "1920x1080",
        "metadata": {
          "category": "training",
          "tags": ["demo", "tutorial"]
        },
        "uploadedBy": {
          "id": "user-uuid",
          "email": "john@example.com",
          "name": "John Doe"
        },
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

### 3. Get Single Video Details

**GET** `/api/videos/:videoId`

Get detailed information about a specific video.

**Authentication**: Required (Bearer Token)
**Roles**: All authenticated users

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/videos/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fileName": "My Presentation Video",
    "originalFileName": "presentation_final.mp4",
    "filePath": "videos/company-uuid/presentation_final_1234567890.mp4",
    "fileSize": 52428800,
    "mimeType": "video/mp4",
    "duration": 300.5,
    "resolution": "1920x1080",
    "metadata": {
      "category": "training"
    },
    "uploadedBy": {
      "id": "user-uuid",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `400`: Invalid video ID format
- `404`: Video not found (or belongs to different company)

### 4. Download/Stream Video

**GET** `/api/videos/:videoId/download`

Download or stream a video file. Supports HTTP range requests for video streaming.

**Authentication**: Required (Bearer Token)
**Roles**: All authenticated users

**Example Request** (Download):
```bash
curl http://localhost:3000/api/videos/123e4567-e89b-12d3-a456-426614174000/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o video.mp4
```

**Example Request** (Stream with Range):
```bash
curl http://localhost:3000/api/videos/123e4567-e89b-12d3-a456-426614174000/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Range: bytes=0-1048576"
```

**Example HTML5 Video Player**:
```html
<video controls width="800">
  <source 
    src="http://localhost:3000/api/videos/VIDEO_ID/download" 
    type="video/mp4">
</video>

<script>
// Add authorization header for video requests
const video = document.querySelector('video');
fetch('http://localhost:3000/api/videos/VIDEO_ID/download', {
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
  }
})
.then(response => response.blob())
.then(blob => {
  video.src = URL.createObjectURL(blob);
});
</script>
```

**Success Response** (200 or 206):
- Returns the video file with appropriate headers
- Status 200: Full file download
- Status 206: Partial content (range request)
- Headers include:
  - `Content-Type`: Video MIME type
  - `Content-Length`: File size
  - `Accept-Ranges`: bytes
  - `Content-Disposition`: inline with filename
  - `Content-Range`: (for range requests)

**Error Responses**:
- `400`: Invalid video ID format
- `404`: Video not found or file missing on server

**Features**:
- ✅ HTTP Range requests support (for video streaming)
- ✅ Browser video player compatible
- ✅ Download with original filename
- ✅ Inline playback support
- ✅ Company access control

### 5. Update Video Metadata

**PUT** `/api/videos/:videoId`

Update the display name or metadata of a video.

**Authentication**: Required (Bearer Token)
**Roles**: `owner`, `admin`, `manager`, `member`
**Permissions**: Only the uploader or owner/admin can update

**Request Body**:
```json
{
  "fileName": "Updated Video Name",
  "metadata": {
    "category": "tutorial",
    "tags": ["advanced", "demo"]
  }
}
```

**Example Request**:
```bash
curl -X PUT http://localhost:3000/api/videos/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "Updated Video Name",
    "metadata": {"category": "tutorial"}
  }'
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Video updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fileName": "Updated Video Name",
    "metadata": {
      "category": "tutorial"
    },
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses**:
- `403`: You don't have permission to update this video
- `409`: A video with this name already exists

### 6. Delete Video

**DELETE** `/api/videos/:videoId`

Delete a video (removes both file and database record).

**Authentication**: Required (Bearer Token)
**Roles**: `owner`, `admin`, `manager`, `member`
**Permissions**: Only the uploader or owner/admin/manager can delete

**Example Request**:
```bash
curl -X DELETE http://localhost:3000/api/videos/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Video deleted successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fileName": "My Presentation Video",
    "fileDeleted": true,
    "deletedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

**Error Responses**:
- `403`: You don't have permission to delete this video
- `404`: Video not found

### 7. Bulk Delete Videos

**POST** `/api/videos/bulk-delete`

Delete multiple videos in one request.

**Authentication**: Required (Bearer Token)
**Roles**: `owner`, `admin`, `manager`, `member`
**Permissions**: Only the uploader or owner/admin/manager can delete videos

**Request Body**:
```json
{
  "videoIds": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174001",
    "323e4567-e89b-12d3-a456-426614174002"
  ]
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/videos/bulk-delete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoIds": [
      "123e4567-e89b-12d3-a456-426614174000",
      "223e4567-e89b-12d3-a456-426614174001"
    ]
  }'
```

**Success Response** (200 or 207):
```json
{
  "success": true,
  "message": "Deleted 2 video(s), 1 failed",
  "data": {
    "deleted": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "fileName": "Video 1",
        "fileDeleted": true
      },
      {
        "id": "223e4567-e89b-12d3-a456-426614174001",
        "fileName": "Video 2",
        "fileDeleted": true
      }
    ],
    "failed": [
      {
        "id": "323e4567-e89b-12d3-a456-426614174002",
        "fileName": "Video 3",
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

**Error Responses**:
- `400`: Invalid request (not an array, invalid UUIDs, too many IDs)
- `404`: No videos found
- `207`: Partial success (some deleted, some failed)

**Limits**:
- Maximum 100 videos per request
- Each video is checked for permissions individually
- Returns detailed results for each video

**Failure Reasons**:
- `Insufficient permissions` - User doesn't have permission to delete that video
- `Video not found or already deleted` - Video doesn't exist in company
- Other error messages from file system operations

## Permissions Matrix

| Action | Owner | Admin | Manager | Member | Viewer |
|--------|-------|-------|---------|--------|--------|
| Upload Video | ✅ | ✅ | ✅ | ✅ | ❌ |
| List Videos | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Video Details | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download/Stream Video | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update Own Video | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Any Video | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Own Video | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete Any Video | ✅ | ✅ | ✅ | ❌ | ❌ |
| Bulk Delete Own Videos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bulk Delete Any Videos | ✅ | ✅ | ✅ | ❌ | ❌ |

## Security Features

### 1. Company Isolation
- Users can only access videos from their current company
- The `companyId` is extracted from the JWT token
- Database queries are automatically scoped to the user's company

### 2. Smart Duplicate Handling
- Automatically numbers duplicate filenames
- Format: `Original Name (1)`, `Original Name (2)`, etc.
- Works with both active and deleted videos
- Database enforces unique constraint on `(company_id, file_name)`
- Users are notified when a name is auto-numbered

### 3. File Type Validation
- Only video MIME types are allowed
- Validated both by multer and business logic
- Supported types: mp4, mpeg, quicktime, avi, wmv, webm, ogg, 3gpp, flv, mkv

### 4. File Size Limit
- Maximum file size: 500MB per video
- Can be adjusted in `/routes/video.js` (multer configuration)

### 5. Path Traversal Prevention
- All file operations use absolute paths
- Company folders are isolated by UUID
- No user input is used directly in file paths

## File Storage Structure

```
/workspaces/dsScreenBackend/
└── videos/
    ├── .gitkeep
    ├── {company-uuid-1}/
    │   ├── video1_timestamp.mp4
    │   ├── video2_timestamp.mp4
    │   └── ...
    ├── {company-uuid-2}/
    │   ├── video1_timestamp.mp4
    │   └── ...
    └── ...
```

- Each company gets its own folder named by their UUID
- Files are stored with timestamp suffix to avoid immediate conflicts
- Display names are stored in the database separately
- Folders are created automatically on first upload

## Frontend Integration Example

### React Upload Component

```javascript
import React, { useState } from 'react';

function VideoUpload({ accessToken }) {
  const [file, setFile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('video', file);
    if (displayName) {
      formData.append('displayName', displayName);
    }

    try {
      const response = await fetch('http://localhost:3000/api/videos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        alert('Video uploaded successfully!');
        setFile(null);
        setDisplayName('');
      } else {
        alert(`Upload failed: ${data.message}`);
      }
    } catch (error) {
      alert(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload}>
      <div>
        <label>Select Video File:</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          disabled={uploading}
        />
      </div>
      
      <div>
        <label>Display Name (optional):</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My Video"
          disabled={uploading}
        />
      </div>

      <button type="submit" disabled={uploading || !file}>
        {uploading ? 'Uploading...' : 'Upload Video'}
      </button>
    </form>
  );
}

export default VideoUpload;
```

### React Video List Component

```javascript
import React, { useEffect, useState } from 'react';

function VideoList({ accessToken }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/videos', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setVideos(data.data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('Video deleted successfully');
        fetchVideos(); // Refresh list
      } else {
        alert(`Delete failed: ${data.message}`);
      }
    } catch (error) {
      alert(`Delete error: ${error.message}`);
    }
  };

  if (loading) {
    return <div>Loading videos...</div>;
  }

  return (
    <div>
      <h2>Company Videos ({videos.length})</h2>
      
      {videos.length === 0 ? (
        <p>No videos uploaded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Uploaded By</th>
              <th>Upload Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr key={video.id}>
                <td>{video.fileName}</td>
                <td>{(video.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                <td>{video.uploadedBy.name}</td>
                <td>{new Date(video.uploadedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => handleDelete(video.id, video.fileName)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default VideoList;
```

## Testing the API

### 1. Get Access Token

First, login and select a company to get an access token:

```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# Select company (use tempToken from login response)
curl -X POST http://localhost:3000/api/auth/select-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEMP_TOKEN" \
  -d '{
    "companyId": "YOUR_COMPANY_ID"
  }'
```

### 2. Upload a Video

```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "video=@./test-video.mp4" \
  -F "displayName=Test Video"
```

### 3. List Videos

```bash
curl -X GET http://localhost:3000/api/videos \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Download a Video

```bash
curl http://localhost:3000/api/videos/VIDEO_ID/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o my-video.mp4
```

### 5. Delete a Video

```bash
curl -X DELETE http://localhost:3000/api/videos/VIDEO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### "File size too large" Error
- The maximum file size is 500MB
- To increase: Edit `routes/video.js` and change the `limits.fileSize` value in multer configuration

### "Only video files are allowed" Error
- Make sure your file has a valid video MIME type
- Check `utils/fileStorage.js` `isValidVideoMimeType()` for supported types

### "A video with this name already exists" Error
- Choose a different display name
- Or delete the existing video first
- Display names must be unique within each company

### Database Migration Not Running
- Ensure database is running and accessible
- Run manually: `npm run migrate:run`
- Check database connection settings in `.env` file

## Files Modified/Created

### New Files
- `/models/Video.js` - Video model
- `/migrations/20240101000004-create-videos.js` - Database migration
- `/routes/video.js` - Video API routes
- `/utils/fileStorage.js` - File storage utilities
- `/videos/.gitkeep` - Ensures videos directory exists
- `/VIDEO_UPLOAD_GUIDE.md` - This documentation

### Modified Files
- `/models/index.js` - Added Video model and associations
- `/index.js` - Added video routes
- `/.gitignore` - Updated to exclude video files
- `/package.json` - Added multer dependency

## Next Steps

1. **Start the database** if not already running
2. **Run migrations**: `npm run migrate:run`
3. **Start the server**: `npm run dev`
4. **Test the API** using the examples above
5. **Build your frontend** using the React examples as a starting point

## Support

For issues or questions, refer to:
- Main README: `/README.md`
- Authentication Guide: `/AUTHENTICATION.md`
- Postman Collection: `/postman_collection.json`

