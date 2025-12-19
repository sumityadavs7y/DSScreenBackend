# Postman Collection - Video Upload Update

## ✅ Update Complete

The Postman collection has been successfully updated to include all video upload and management endpoints.

## 📦 What's New

### New Collection Variable
- **`videoId`** - Automatically saved after uploading a video for use in subsequent requests

### New Folder: "Video Management"
A complete set of 7 video-related endpoints has been added:

#### 1. Upload Video
- **Method**: POST `/api/videos/upload`
- **Type**: multipart/form-data
- **Fields**:
  - `video` (file) - Required
  - `displayName` (text) - Optional
  - `metadata` (JSON text) - Optional
- **Auto-saves**: `videoId` from response

#### 2. List All Videos
- **Method**: GET `/api/videos`
- **Returns**: Array of all company videos with metadata

#### 3. Get Video Details
- **Method**: GET `/api/videos/:videoId`
- **Uses**: Saved `videoId` variable
- **Returns**: Detailed video information

#### 4. Download/Stream Video
- **Method**: GET `/api/videos/:videoId/download`
- **Uses**: Saved `videoId` variable
- **Returns**: Video file (supports streaming)

#### 5. Update Video Metadata
- **Method**: PUT `/api/videos/:videoId`
- **Body**: JSON with `fileName` and/or `metadata`
- **Uses**: Saved `videoId` variable

#### 6. Delete Video
- **Method**: DELETE `/api/videos/:videoId`
- **Uses**: Saved `videoId` variable
- **Effect**: Removes file and database record

#### 7. Bulk Delete Videos
- **Method**: POST `/api/videos/bulk-delete`
- **Body**: JSON array of video IDs
- **Returns**: Detailed results (success/failures)
- **Limit**: Maximum 100 videos per request

## 🔄 Updated Files

1. **`postman_collection.json`**
   - Added `videoId` variable
   - Added "Video Management" folder with 5 requests
   - Added automated test scripts for video upload
   - Updated collection name and description

2. **`POSTMAN_GUIDE.md`**
   - Added video management endpoints table
   - Added Scenario 4: Video Upload and Management
   - Added video upload instructions for Postman
   - Added video metadata example
   - Added video-specific error codes
   - Added video features section

## 📖 How to Use

### Step 1: Import Updated Collection

**If you haven't imported yet:**
1. Open Postman
2. Click **Import**
3. Select `postman_collection.json`
4. Click **Import**

**If you already have the collection:**
1. Delete the old collection in Postman
2. Re-import `postman_collection.json`
3. Your variables will be preserved if using environments

### Step 2: Authenticate

Run the authentication flow:
1. **Register User** or **Login**
2. **Select Company**
3. Verify `accessToken` is saved

### Step 3: Upload a Video

1. Open **Video Management** → **Upload Video**
2. Go to **Body** tab
3. Ensure **form-data** is selected
4. Click on the `video` field dropdown → select **File**
5. Click **Select Files** → choose your video file
6. (Optional) Update the `displayName` field
7. Click **Send**

The response will include the video ID, which is automatically saved to the `videoId` variable.

### Step 4: Manage Videos

Use the other endpoints with the saved `videoId`:
- **List All Videos** - See all company videos
- **Get Video Details** - View specific video info
- **Download/Stream Video** - Download or play the video
- **Update Video Metadata** - Change display name
- **Delete Video** - Remove the video

## 🎯 Testing Workflow

### Complete Video Workflow in Postman

1. **Authentication**
   ```
   Login → Select Company
   ```

2. **Upload Video**
   ```
   Upload Video (saves videoId)
   ```

3. **View Videos**
   ```
   List All Videos
   Get Video Details
   ```

4. **Download Video**
   ```
   Download/Stream Video
   ```

5. **Update Video**
   ```
   Update Video Metadata
   Get Video Details (verify changes)
   ```

6. **Delete Video**
   ```
   Delete Video
   List All Videos (verify deletion)
   ```

## 📝 Request Examples

### Upload Video Request

**Body (form-data):**
```
video: [Select File]
displayName: "Demo Presentation Video"
metadata: {"category":"training","tags":["demo","tutorial"]}
```

**Response:**
```json
{
  "success": true,
  "message": "Video uploaded successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fileName": "Demo Presentation Video",
    "fileSize": 52428800,
    "mimeType": "video/mp4",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Update Video Request

**Body (raw JSON):**
```json
{
  "fileName": "Updated Video Name",
  "metadata": {
    "category": "tutorial",
    "tags": ["advanced", "demo"],
    "description": "Updated description"
  }
}
```

## 🔐 Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
|--------|-------|-------|---------|--------|--------|
| Upload | ✅ | ✅ | ✅ | ✅ | ❌ |
| List/View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download/Stream | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update Own | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Any | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Own | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete Any | ✅ | ✅ | ✅ | ❌ | ❌ |

## ⚠️ Important Notes

### File Upload in Postman

When uploading files in Postman:
1. The `video` field **must** be set to type "File" (not "Text")
2. Click the field type dropdown on the right side of the row
3. Select "File"
4. Then click "Select Files"

### File Size Limit

- Maximum file size: **500MB**
- Files larger than this will be rejected with a 400 error

### Supported Video Formats

- mp4, mpeg, mov, avi, wmv, webm, ogg, 3gpp, flv, mkv
- Only video MIME types are accepted

### Unique File Names

- Display names must be unique within each company
- Attempting to upload a video with an existing name will return a 409 error
- Change the `displayName` field if you get a conflict

## 🐛 Troubleshooting

### "video field is required"
- Make sure you selected a file in the `video` field
- Verify the field type is set to "File" (not "Text")

### "Only video files are allowed"
- Check your file is actually a video file
- Verify the file extension (.mp4, .mov, etc.)
- Some files may have incorrect MIME types

### "File size too large"
- Your file exceeds 500MB
- Try a smaller video or compress it

### "A video with this name already exists"
- Change the `displayName` to something unique
- Or delete the existing video first
- Check the "List All Videos" response for existing names

### Variables Not Saving
- Check the **Tests** tab in requests
- Open Postman Console (View → Show Postman Console)
- Verify scripts are executing without errors
- Manually check: Collection → Variables tab

## 📚 Related Documentation

- **[VIDEO_UPLOAD_GUIDE.md](./VIDEO_UPLOAD_GUIDE.md)** - Complete video API documentation
- **[VIDEO_API_QUICK_REFERENCE.md](./VIDEO_API_QUICK_REFERENCE.md)** - Quick reference
- **[POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md)** - Complete Postman guide
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Authentication details

## ✨ Collection Features

### Automated Scripts

The collection includes automated test scripts that:
- Extract and save `videoId` after upload
- Log important information to console
- Set up variables for subsequent requests
- Validate responses

### Variable Chaining

The collection uses variable chaining:
```
Upload Video → saves videoId
  ↓
Get Video Details → uses videoId
  ↓
Download/Stream Video → uses videoId
  ↓
Update Video → uses videoId
  ↓
Delete Video → uses videoId
```

### Descriptions

Each request includes detailed descriptions explaining:
- What the endpoint does
- What parameters are required
- What permissions are needed
- What the response looks like

## 🎉 You're Ready!

The Postman collection is fully updated and ready to test all video upload functionality. Just:

1. Import the collection
2. Authenticate with your account
3. Start uploading and managing videos!

**Happy Testing! 🚀**

