# Video Upload Error Fix

## 🐛 Issue Fixed

### Problem
When uploading a video with a duplicate filename, the upload would fail with a `SequelizeUniqueConstraintError`, but the file would remain on the filesystem, creating orphaned files.

**Error Details:**
```
SequelizeUniqueConstraintError: duplicate key value violates unique constraint "unique_company_filename"
Key (company_id, file_name)=(e6a02765-dd0d-4ba0-b74b-b8b8735a0ca4, 33) already exists.
```

### Root Causes

1. **Incomplete duplicate check**: The code was checking only for `isActive: true` videos, but the database unique constraint applies to ALL videos (including soft-deleted ones with `isActive: false`).

2. **Missing specific error handling**: The catch block didn't specifically handle `SequelizeUniqueConstraintError`, so it returned a generic 500 error instead of a proper 409 Conflict error.

3. **Race condition**: In rare cases, two simultaneous uploads could both pass the check before either was inserted into the database.

## ✅ Solutions Implemented (Updated)

### Latest Update: Automatic Filename Numbering

Instead of rejecting duplicate filenames, the system now **automatically numbers them**:

- `Video.mp4` → exists
- Upload `Video.mp4` → becomes `Video (1)`
- Upload `Video.mp4` again → becomes `Video (2)`
- And so on...

This provides a much better user experience and prevents confusion.

## ✅ Solutions Implemented (Original)

### 1. Fixed Duplicate Check
**Before:**
```javascript
const existingVideo = await Video.findOne({
  where: {
    companyId: req.company.id,
    fileName: displayName,
    isActive: true,  // ❌ Only checked active videos
  },
});
```

**After:**
```javascript
const existingVideo = await Video.findOne({
  where: {
    companyId: req.company.id,
    fileName: displayName,
    // ✅ Check ALL videos (active and inactive) to match DB constraint
  },
});

if (existingVideo) {
  await deleteFile(path.join('videos', req.company.id, req.file.filename));
  
  if (existingVideo.isActive) {
    return res.status(409).json({
      success: false,
      message: 'A video with this name already exists. Please use a different name.',
    });
  } else {
    return res.status(409).json({
      success: false,
      message: 'A video with this name was previously deleted. Please use a different name or contact an administrator to permanently remove the old video.',
    });
  }
}
```

### 2. Added Specific Error Handling
**Before:**
```javascript
} catch (error) {
  console.error('Upload video error:', error);
  
  if (req.file) {
    await deleteFile(path.join('videos', req.company.id, req.file.filename));
  }

  res.status(500).json({  // ❌ Generic error
    success: false,
    message: 'An error occurred while uploading the video',
  });
}
```

**After:**
```javascript
} catch (error) {
  console.error('Upload video error:', error);
  
  // Clean up uploaded file if database insert fails
  if (req.file) {
    try {
      await deleteFile(path.join('videos', req.company.id, req.file.filename));
      console.log('Cleaned up orphaned file:', req.file.filename);  // ✅ Better logging
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
  }

  // ✅ Handle specific database errors
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'A video with this name already exists. Please use a different name.',
    });
  }

  res.status(500).json({
    success: false,
    message: 'An error occurred while uploading the video',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
```

### 3. Created Cleanup Utility
Added a script to find and remove orphaned video files:

**Location:** `/scripts/cleanup-orphaned-videos.js`

**Usage:**
```bash
# Dry run (see what would be deleted)
npm run cleanup:videos:dry-run

# Actually delete orphaned files
npm run cleanup:videos
```

**Features:**
- Scans all video files on disk
- Compares with active videos in database
- Identifies orphaned files
- Reports file sizes and locations
- Supports dry-run mode for safety
- Provides detailed summary

## 📊 Changes Made

### Files Modified
1. ✅ `/routes/video.js` - Fixed duplicate check and error handling
2. ✅ `/package.json` - Added cleanup scripts
3. ✅ `/scripts/cleanup-orphaned-videos.js` - New cleanup utility
4. ✅ `/VIDEO_ERROR_FIX.md` - This documentation

### Code Changes Summary
- **Lines changed in video.js**: ~30 lines
- **New utility script**: 200+ lines
- **Package.json**: Added 2 new scripts

## 🧪 Testing

### Test Scenario 1: Upload Duplicate File
**Steps:**
1. Upload a video with name "test.mp4"
2. Upload another video with the same name "test.mp4"

**Expected Result:**
- ✅ Second upload returns 409 Conflict
- ✅ Second file is deleted from filesystem
- ✅ Only one video record in database
- ✅ Only one file on disk

### Test Scenario 2: Upload Duplicate of Deleted Video
**Steps:**
1. Upload a video with name "test.mp4"
2. Delete the video (soft delete)
3. Try to upload another video with name "test.mp4"

**Expected Result:**
- ✅ Upload returns 409 Conflict
- ✅ Error message mentions the video was previously deleted
- ✅ New file is deleted from filesystem
- ✅ No orphaned files

### Test Scenario 3: Database Connection Failure
**Steps:**
1. Stop database
2. Try to upload a video

**Expected Result:**
- ✅ Upload fails with appropriate error
- ✅ Uploaded file is cleaned up
- ✅ No orphaned files

## 🔍 How to Check for Orphaned Files

### Method 1: Use the Cleanup Script
```bash
npm run cleanup:videos:dry-run
```

**Output Example:**
```
🔍 Running in DRY RUN mode

🔍 Scanning for orphaned video files...

✅ Database connected

📁 Found 2 video files on disk

📊 Found 1 active videos in database

⚠️  Found 1 orphaned file(s):

1. videos/company-uuid/orphaned_video.mp4
   Size: 5.25 MB
   Company: company-uuid

💾 Total size of orphaned files: 5.25 MB

🔍 DRY RUN MODE - No files were deleted
   Run without --dry-run to actually delete these files
```

### Method 2: Manual Check
```bash
# List all video files
find videos -type f -name "*.mp4"

# Check database records
psql -d your_database -c "SELECT file_path FROM videos WHERE is_active = true;"

# Compare the two lists
```

### Method 3: Node.js Script
```javascript
const { Video } = require('./models');
const fs = require('fs').promises;

async function checkOrphans() {
  const videos = await Video.findAll({ where: { isActive: true } });
  const dbPaths = new Set(videos.map(v => v.filePath));
  
  // Check each file on disk
  const files = await fs.readdir('videos/your-company-id/');
  const orphans = files.filter(f => !dbPaths.has(`videos/your-company-id/${f}`));
  
  console.log('Orphaned files:', orphans);
}
```

## 📝 Prevention Measures

### 1. Application-Level
- ✅ Check ALL videos (not just active) before upload
- ✅ Proper error handling with cleanup
- ✅ Detailed logging for debugging
- ✅ User-friendly error messages

### 2. Database-Level
- ✅ Unique constraint on (company_id, file_name)
- ✅ Ensures data integrity even if application check fails

### 3. Operational
- ✅ Cleanup script for periodic maintenance
- ✅ Monitoring for orphaned files
- ✅ Clear documentation

## 🚀 Best Practices Going Forward

### When Modifying Video Upload Code:

1. **Always clean up on error**:
```javascript
try {
  // Upload logic
} catch (error) {
  if (req.file) {
    await deleteFile(req.file.path);  // ✅ Always clean up
  }
  throw error;
}
```

2. **Check constraints before insert**:
```javascript
// ✅ Query should match database constraints
const existing = await Video.findOne({
  where: {
    companyId: req.company.id,
    fileName: displayName,
    // Don't filter by isActive if constraint doesn't
  },
});
```

3. **Handle specific errors**:
```javascript
if (error.name === 'SequelizeUniqueConstraintError') {
  // ✅ Specific handling for specific errors
}
```

4. **Log cleanup actions**:
```javascript
await deleteFile(filePath);
console.log('Cleaned up orphaned file:', fileName);  // ✅ Log it
```

### Periodic Maintenance:

Run cleanup monthly or after major issues:
```bash
npm run cleanup:videos:dry-run  # Check first
npm run cleanup:videos          # Then clean
```

## ⚠️ Important Notes

### Soft Delete Consideration
The current implementation uses soft deletes (`isActive: false`). This means:
- Deleted videos still have records in the database
- The unique constraint still applies to deleted videos
- Users can't reuse a filename of a deleted video

**Options to handle this:**

1. **Keep current behavior** (Recommended)
   - Prevents confusion with deleted content
   - Maintains audit trail
   - Can add "hard delete" feature for admins

2. **Exclude inactive from constraint**
   - Would allow reusing filenames
   - Requires migration to change constraint
   - Could cause confusion

3. **Add filename suffix on soft delete**
   - Automatically rename on delete
   - Example: "video.mp4" → "video.mp4.deleted.123456789"
   - Allows immediate filename reuse

## 📚 Related Documentation

- [VIDEO_UPLOAD_GUIDE.md](./VIDEO_UPLOAD_GUIDE.md) - Complete API documentation
- [VIDEO_API_QUICK_REFERENCE.md](./VIDEO_API_QUICK_REFERENCE.md) - Quick reference
- [README.md](./README.md) - Main documentation

## ✨ Summary

- ✅ Fixed duplicate filename check to match database constraints
- ✅ Added specific error handling for unique constraint violations
- ✅ Ensured orphaned files are always cleaned up
- ✅ Created utility script for finding and removing orphaned files
- ✅ Improved error messages for better user experience
- ✅ Added logging for better debugging
- ✅ Documented the issue and solution

**Result**: No more orphaned files! The system now properly handles duplicate uploads and cleans up automatically. 🎉

