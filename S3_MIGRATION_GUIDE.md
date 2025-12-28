# S3 Storage Migration Guide

## Overview

The video storage system has been migrated from local file storage to AWS S3. This provides better scalability, reliability, and enables distributed deployments.

## Changes Made

### 1. Video File Naming Convention

Videos are now stored in S3 with the following naming pattern:
```
videos/<env>_<company_name>_<company_id>_<video_id>.<ext>
```

Thumbnails follow this pattern:
```
thumbnails/<env>_<company_name>_<company_id>_<video_id>_thumb.jpg
```

Where:
- `<env>`: `prod` or `dev` (based on `ENV_MODE` environment variable)
- `<company_name>`: Sanitized company name (lowercase, alphanumeric with underscores)
- `<company_id>`: Company UUID
- `<video_id>`: Video UUID
- `<ext>`: Original file extension

**Example:**
```
videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab.mp4
thumbnails/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab_thumb.jpg
```

This naming convention ensures:
- Easy identification of which video belongs to which company
- Environment separation (prod/dev)
- Traceability in case of issues
- No naming conflicts

### 2. Configuration Changes

#### New Environment Variables

Add these to your `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY=your_aws_access_key_here
AWS_SECRET=your_aws_secret_key_here
AWS_S3_BUCKET=your_s3_bucket_name_here
```

#### Updated Files

1. **config.js** - Added S3 configuration
2. **utils/s3Storage.js** - New utility module for S3 operations
3. **routes/video.js** - Updated to use S3 for upload/download/delete
4. **routes/dashboard.js** - Updated to use S3 for upload/delete
5. **views/videos.ejs** - Updated thumbnail URLs to use API endpoint

### 3. API Changes

#### New Endpoint

**GET /api/videos/:videoId/thumbnail**
- Public endpoint to serve video thumbnails from S3
- Returns JPEG image with 24-hour cache headers

#### Modified Endpoints

**POST /api/videos/upload**
- Now uploads directly to S3 instead of local storage
- Generates S3 key based on naming convention
- Extracts metadata and generates thumbnails before S3 upload

**GET /api/videos/:videoId/download**
- Now streams from S3 instead of local filesystem
- Supports range requests for video streaming
- Uses S3 SDK for efficient streaming

**DELETE /api/videos/:videoId**
- Now deletes from S3 instead of local filesystem

### 4. Upload Flow

1. Video is uploaded via multipart form data
2. File is temporarily stored in memory (multer.memoryStorage)
3. Video record is created in database (to get video ID)
4. S3 key is generated using naming convention
5. File is saved to `/tmp` for metadata extraction
6. Video metadata (duration, resolution, codec, etc.) is extracted
7. Thumbnail is generated and uploaded to S3
8. Video file is uploaded to S3
9. Database record is updated with S3 key and metadata
10. Temporary files are cleaned up

### 5. Download/Streaming Flow

1. Client requests video via `/api/videos/:videoId/download`
2. Server fetches video metadata from S3
3. If range header is present (for streaming):
   - Server fetches requested byte range from S3
   - Returns 206 Partial Content response
4. If no range header:
   - Server fetches entire file from S3
   - Returns 200 OK response

## Migration Steps

### For New Deployments

1. Set up AWS S3 bucket
2. Configure IAM user with S3 permissions
3. Add AWS credentials to `.env` file
4. Deploy application
5. Videos will automatically be stored in S3

### For Existing Deployments

⚠️ **Important:** Existing videos stored locally will need to be migrated to S3.

#### Migration Script (To Be Created)

You'll need to create a migration script that:

1. Lists all videos in the database
2. For each video:
   - Read the file from local storage
   - Generate new S3 key based on naming convention
   - Upload to S3
   - Update database record with new S3 key
   - Optionally delete local file

Example migration script structure:

```javascript
const { Video, Company } = require('./models');
const { uploadToS3, generateS3Key, generateThumbnailS3Key } = require('./utils/s3Storage');
const fs = require('fs');
const path = require('path');

async function migrateVideosToS3() {
  const videos = await Video.findAll({
    where: { isActive: true },
    include: [{ model: Company, as: 'company' }]
  });

  for (const video of videos) {
    try {
      // Read local file
      const localPath = path.join(__dirname, video.filePath);
      if (!fs.existsSync(localPath)) {
        console.log(`Skipping ${video.id}: file not found`);
        continue;
      }

      // Generate S3 key
      const env = process.env.ENV_MODE === 'production' ? 'prod' : 'dev';
      const ext = path.extname(video.originalFileName);
      const s3Key = generateS3Key(env, video.company.name, video.companyId, video.id, ext);

      // Upload to S3
      await uploadToS3(localPath, s3Key, video.mimeType);

      // Migrate thumbnail if exists
      if (video.thumbnailPath) {
        const thumbnailLocalPath = path.join(__dirname, video.thumbnailPath);
        if (fs.existsSync(thumbnailLocalPath)) {
          const thumbnailS3Key = generateThumbnailS3Key(env, video.company.name, video.companyId, video.id);
          await uploadToS3(thumbnailLocalPath, thumbnailS3Key, 'image/jpeg');
          await video.update({ thumbnailPath: thumbnailS3Key });
        }
      }

      // Update database
      await video.update({ filePath: s3Key });

      console.log(`✅ Migrated: ${video.fileName}`);
    } catch (error) {
      console.error(`❌ Failed to migrate ${video.id}:`, error);
    }
  }
}

migrateVideosToS3().then(() => process.exit(0));
```

## AWS S3 Setup

### 1. Create S3 Bucket

```bash
aws s3 mb s3://your-bucket-name --region us-east-1
```

### 2. Configure Bucket Policy (Optional - for public read access)

If you want videos to be publicly accessible (not recommended for security):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 3. Create IAM User

Create an IAM user with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### 4. Enable CORS (if needed for direct browser uploads)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Testing

### 1. Test Video Upload

```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@test-video.mp4" \
  -F "displayName=Test Video"
```

### 2. Test Video Download

```bash
curl http://localhost:3000/api/videos/{VIDEO_ID}/download -o downloaded.mp4
```

### 3. Test Thumbnail

```bash
curl http://localhost:3000/api/videos/{VIDEO_ID}/thumbnail -o thumbnail.jpg
```

## Troubleshooting

### Videos not uploading

1. Check AWS credentials in `.env`
2. Verify S3 bucket exists and is accessible
3. Check IAM user permissions
4. Review application logs for S3 errors

### Videos not playing

1. Verify video exists in S3 bucket
2. Check S3 key in database matches actual S3 object
3. Test direct S3 access using AWS CLI
4. Check network connectivity to S3

### Thumbnails not displaying

1. Verify thumbnail was generated and uploaded
2. Check thumbnail endpoint: `/api/videos/{VIDEO_ID}/thumbnail`
3. Review S3 bucket for thumbnail objects

## Performance Considerations

1. **Bandwidth**: S3 transfers consume bandwidth. Monitor usage.
2. **Costs**: S3 storage and data transfer have costs. Review AWS pricing.
3. **Caching**: Implement CloudFront CDN for better performance and reduced costs.
4. **Temporary Files**: Ensure `/tmp` directory has sufficient space for video processing.

## Security Considerations

1. **Credentials**: Never commit AWS credentials to version control
2. **Bucket Access**: Keep S3 bucket private, serve via application
3. **Signed URLs**: Consider using S3 signed URLs for time-limited access
4. **Encryption**: Enable S3 server-side encryption (SSE-S3 or SSE-KMS)

## Rollback Plan

If you need to rollback to local storage:

1. Revert code changes to previous commit
2. Restore `.env` configuration
3. Ensure local video files are still available
4. Restart application

## Support

For issues or questions, please contact the development team or create an issue in the repository.

