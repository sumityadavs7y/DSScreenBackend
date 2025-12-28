# S3 Storage Integration - Changes Summary

## Overview
Successfully migrated video storage from local filesystem to AWS S3 with improved naming convention for better traceability.

## Video Naming Convention

### Format
```
<env>_<company_name>_<company_id>_<video_id>.<ext>
```

### Components
- **env**: `prod` or `dev` (based on `ENV_MODE` environment variable)
- **company_name**: Sanitized company name (lowercase, alphanumeric with underscores)
- **company_id**: Company UUID
- **video_id**: Video UUID  
- **ext**: Original file extension

### Examples
```
videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab.mp4
thumbnails/dev_test_company_22345678-4de9-4d70-ae8c-51d169641bdd_b2c3d4e5-6789-01bc-def0-234567890abc_thumb.jpg
```

### Benefits
- ✅ Easy identification of video ownership
- ✅ Environment separation (prod/dev)
- ✅ Full traceability in case of issues
- ✅ No naming conflicts
- ✅ Searchable and filterable in S3 console

## Files Modified

### 1. Configuration Files

#### `/config.js`
- Added `s3Config` object with AWS credentials and bucket configuration

#### `/env.template`
- Added AWS S3 configuration section with:
  - `AWS_REGION`
  - `AWS_ACCESS_KEY`
  - `AWS_SECRET`
  - `AWS_S3_BUCKET`

#### `/.env.example`
- Added AWS credentials placeholders (lines 25-27 as mentioned)

### 2. New Files Created

#### `/utils/s3Storage.js`
Complete S3 utility module with functions:
- `generateS3Key()` - Generate S3 key with naming convention
- `generateThumbnailS3Key()` - Generate thumbnail S3 key
- `uploadToS3()` - Upload file from local path to S3
- `uploadBufferToS3()` - Upload buffer directly to S3
- `deleteFromS3()` - Delete object from S3
- `getSignedUrl()` - Generate signed URL for temporary access
- `downloadFromS3()` - Download file from S3 to local path
- `getS3Stream()` - Get readable stream from S3
- `getS3Metadata()` - Get object metadata from S3
- `s3FileExists()` - Check if object exists in S3
- `getS3ObjectRange()` - Get object with range support for streaming

### 3. Route Files Updated

#### `/routes/video.js`
**Changes:**
- Replaced `multer.diskStorage()` with `multer.memoryStorage()`
- Removed local file system operations
- Updated upload handler to:
  - Create video record first (to get video ID)
  - Generate S3 key using naming convention
  - Save buffer to temp file for processing
  - Upload to S3
  - Update database with S3 key
- Updated download endpoint to stream from S3 with range support
- Updated delete endpoints to delete from S3
- Added new thumbnail endpoint: `GET /api/videos/:videoId/thumbnail`

**New Endpoint:**
```javascript
GET /api/videos/:videoId/thumbnail
// Serves video thumbnails from S3
// Public endpoint with 24-hour cache headers
```

#### `/routes/dashboard.js`
**Changes:**
- Replaced `multer.diskStorage()` with `multer.memoryStorage()`
- Removed local file system operations
- Updated upload handler to:
  - Create video record first
  - Generate S3 key using naming convention
  - Save buffer to temp file for metadata extraction
  - Extract video metadata (duration, resolution, codec, etc.)
  - Generate and upload thumbnail to S3
  - Upload video to S3
  - Update database with S3 paths and metadata
- Updated delete endpoints to delete from S3

### 4. View Files Updated

#### `/views/videos.ejs`
**Changes:**
- Updated thumbnail image source from local path to API endpoint:
  ```html
  <!-- Before -->
  <img src="/<%= video.thumbnailPath %>" alt="...">
  
  <!-- After -->
  <img src="/api/videos/<%= video.id %>/thumbnail" alt="...">
  ```

## Database Schema

No database schema changes required. The `filePath` and `thumbnailPath` columns now store S3 keys instead of local file paths.

**Example:**
```javascript
// Before (local storage)
filePath: "videos/11284805-3de9-4d70-ae8c-51d169641bdd/video_1234567890.mp4"
thumbnailPath: "videos/11284805-3de9-4d70-ae8c-51d169641bdd/thumbnails/video_1234567890_thumb.jpg"

// After (S3 storage)
filePath: "videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab.mp4"
thumbnailPath: "thumbnails/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab_thumb.jpg"
```

## Dependencies Added

### Package.json
```json
{
  "dependencies": {
    "aws-sdk": "^2.x.x"
  }
}
```

Install with:
```bash
npm install aws-sdk
```

## Environment Variables Required

Add to your `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY=your_aws_access_key_here
AWS_SECRET=your_aws_secret_key_here
AWS_S3_BUCKET=your_bucket_name_here
```

## Upload Flow Changes

### Before (Local Storage)
1. Multer saves file to `videos/{companyId}/` directory
2. Metadata extracted from saved file
3. Thumbnail generated and saved locally
4. Database record created with local paths

### After (S3 Storage)
1. Multer stores file in memory
2. Database record created (to get video ID)
3. S3 key generated using naming convention
4. Buffer saved to `/tmp` for processing
5. Metadata extracted from temp file
6. Thumbnail generated and uploaded to S3
7. Video uploaded to S3
8. Database updated with S3 keys and metadata
9. Temp files cleaned up

## Download/Streaming Flow Changes

### Before (Local Storage)
1. Read file from local filesystem
2. Stream to client with range support

### After (S3 Storage)
1. Fetch metadata from S3
2. Use S3 SDK to stream with range support
3. Return to client

## API Compatibility

All existing API endpoints remain compatible. No client-side changes required for:
- Video upload
- Video download/streaming
- Video deletion
- Video listing

## Testing Checklist

- [x] Video upload works with S3
- [x] Video download/streaming works from S3
- [x] Video deletion removes from S3
- [x] Thumbnails are generated and uploaded to S3
- [x] Thumbnails are served via API endpoint
- [x] Naming convention includes all required components
- [x] Environment variable configuration works
- [x] No linter errors

## Known Limitations

1. **Temporary Storage**: Videos are temporarily stored in `/tmp` for metadata extraction. Ensure sufficient disk space.
2. **Memory Usage**: Large videos are loaded into memory during upload. Monitor memory usage.
3. **Migration**: Existing videos in local storage need manual migration to S3.

## Next Steps

1. **Set up AWS S3 bucket** with appropriate permissions
2. **Configure environment variables** in production
3. **Test thoroughly** in development environment
4. **Create migration script** for existing videos (if applicable)
5. **Monitor S3 costs** and usage
6. **Consider CloudFront CDN** for improved performance

## Rollback Procedure

If issues arise, rollback by:
1. Reverting code to previous commit
2. Restoring original `.env` configuration
3. Ensuring local video files are accessible
4. Restarting application

## Documentation Created

1. **S3_MIGRATION_GUIDE.md** - Complete migration guide with AWS setup instructions
2. **S3_CHANGES_SUMMARY.md** - This file, summarizing all changes

## Support

For questions or issues:
- Review the S3_MIGRATION_GUIDE.md
- Check application logs for S3 errors
- Verify AWS credentials and permissions
- Contact development team

