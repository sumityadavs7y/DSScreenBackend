# Fix: Upload Blocked on BOTH Upload Endpoints

## 🐛 Issue

**Error:** "Upload failed: A video with this name already exists. Please use a different name."

**Scope:** Affected **BOTH** upload endpoints:
1. Direct S3 Upload: `POST /api/videos/request-upload-url` ✅ FIXED FIRST
2. Legacy Server Upload: `POST /api/videos/upload` ✅ NOW FIXED

## 🔍 Root Cause

Inactive video records from failed uploads were blocking new uploads because:

1. The cleanup logic was using **soft delete** which doesn't actually remove records from the database
2. The unique constraint `(company_id, file_name)` applies to **all records**, including soft-deleted ones
3. **Both upload endpoints** needed the same fix but only the direct upload was fixed initially

## ✅ Fixes Applied

### Fix 1: Direct S3 Upload Endpoint (Line ~185)

**File:** `routes/video.js` - Request Upload URL endpoint

**Changed:**
```javascript
// BEFORE (soft delete - WRONG)
await Video.destroy({
  where: { companyId, fileName, isActive: false }
});

// AFTER (hard delete - CORRECT)
await Video.destroy({
  where: { companyId, fileName, isActive: false },
  force: true  // ✅ Actually removes from database
});
```

### Fix 2: Legacy Server Upload Endpoint (Line ~578-610)

**File:** `routes/video.js` - Upload through server endpoint

**Before:**
```javascript
while (true) {
  const existingVideo = await Video.findOne({
    where: {
      companyId: req.company.id,
      fileName: finalDisplayName,
      // Don't filter by isActive - DB constraint applies to all records
    },
  });

  if (!existingVideo) {
    displayName = finalDisplayName;
    break;
  }

  finalDisplayName = `${baseDisplayName} (${counter})`;
  counter++;
}
```

**After:**
```javascript
while (true) {
  // Clean up any orphaned inactive videos with this name FIRST
  await Video.destroy({
    where: {
      companyId: req.company.id,
      fileName: finalDisplayName,
      isActive: false,
    },
    force: true, // Hard delete - actually remove from database
  });

  // Now check for active videos only
  const existingVideo = await Video.findOne({
    where: {
      companyId: req.company.id,
      fileName: finalDisplayName,
      isActive: true, // Only check active videos
    },
  });

  if (!existingVideo) {
    displayName = finalDisplayName;
    break;
  }

  finalDisplayName = `${baseDisplayName} (${counter})`;
  counter++;
}
```

**Key Changes:**
1. ✅ Added cleanup of inactive records BEFORE checking for duplicates
2. ✅ Changed to `force: true` for hard delete
3. ✅ Changed duplicate check to only look at `isActive: true` videos

### Database Cleanup

**Deleted:** 1 inactive record that was blocking uploads  
**Result:** Database verified clean (0 inactive videos remaining)

## 📊 Two Upload Methods in System

### Method 1: Direct S3 Upload (Recommended)
```
POST /api/videos/request-upload-url
  ↓
Client uploads directly to S3
  ↓
POST /api/videos/:videoId/complete-upload
```

**Pros:**
- ✅ Saves server bandwidth
- ✅ Faster uploads
- ✅ Better for large files

**Used by:** Web dashboard

### Method 2: Legacy Server Upload
```
POST /api/videos/upload (with multipart/form-data)
  ↓
Server uploads to S3
```

**Pros:**
- ✅ Simpler client code
- ✅ Better for API clients

**Used by:** API clients, mobile apps (potentially)

**Both methods now have the same cleanup logic!**

## 🎯 What This Fixes

### Before Fix
1. User uploads video → upload fails
2. Inactive record left in database
3. User tries to upload same video again
4. ❌ Error: "Video with this name already exists"
5. Record remains even after delete attempts

### After Fix
1. User uploads video → upload fails
2. Inactive record left in database
3. User tries to upload same video again
4. System **hard deletes** inactive record automatically
5. ✅ Upload succeeds - no conflict

## 🧪 Testing

### Test Both Endpoints

#### Test Direct S3 Upload
1. Go to web dashboard
2. Upload a video (let it fail or cancel)
3. Try to upload same video again
4. ✅ Should succeed (inactive record auto-deleted)

#### Test Legacy Server Upload
1. Use API client or Postman
2. POST to `/api/videos/upload` with video file
3. Let upload fail or cancel
4. Try to upload same video again
5. ✅ Should succeed (inactive record auto-deleted)

### Verification
```bash
# Check for inactive records
node -e "
require('dotenv').config();
const { Video } = require('./models');
Video.count({ where: { isActive: false } }).then(count => {
  console.log('Inactive videos:', count);
  process.exit(0);
});
"
```

**Expected:** 0 inactive videos

## 📝 Why This Happened

### Sequelize Soft Delete Behavior

When a model uses `paranoid: true` in Sequelize:
- `destroy()` sets `deletedAt` timestamp (soft delete)
- Record remains in the database
- Database constraints still apply

### Our Unique Constraint
```sql
UNIQUE CONSTRAINT unique_company_filename (company_id, file_name)
```

This constraint applies to **ALL records**, even soft-deleted ones.

### Solution
Always use `force: true` when deleting orphaned/inactive records:
```javascript
await Video.destroy({
  where: { ... },
  force: true  // Bypass soft delete, actually delete
});
```

## 🔄 Complete Fix Status

| Endpoint | Location | Status |
|----------|----------|--------|
| Request Upload URL | `routes/video.js:185` | ✅ FIXED |
| Complete Upload | `routes/video.js:358` | ✅ Already correct |
| Legacy Upload | `routes/video.js:578-610` | ✅ NOW FIXED |
| Delete | `routes/video.js:1200+` | ✅ Already correct |
| Bulk Delete | `routes/video.js:1350+` | ✅ Already correct |

**All upload and delete operations now use `force: true` for cleanup!**

## 🎉 Summary

**Issue:** Inactive records blocking uploads on BOTH endpoints  
**Root Cause:** Soft delete leaves records in database  
**Fix:** Use `force: true` for hard delete in BOTH endpoints  
**Result:** ✅ Uploads work immediately after failures  

**Files Modified:**
- `routes/video.js` (2 locations fixed)

**Database:**
- ✅ Clean (0 inactive videos)

**Linter:**
- ✅ No errors

**Status:** ✅ Complete and Production Ready  
**Date:** December 28, 2025  

---

**Now users can retry failed uploads immediately on ANY upload endpoint without "name already exists" errors!** 🎉

