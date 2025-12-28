# Fix: Upload Blocked by Inactive Records

## 🐛 Issue

**Error:** "Upload failed: A video with this name already exists. Please use a different name."

**Root Cause:** Inactive video records from failed uploads were not being properly cleaned up before creating new uploads. The cleanup logic was using **soft delete** (`destroy()`) instead of **hard delete** (`destroy({ force: true })`), which meant the records remained in the database with `deletedAt` set, but the unique constraint `(company_id, file_name)` still applied.

## ✅ Fix Applied

### Code Change

**File:** `routes/video.js` - Line 185-191

**Before:**
```javascript
await Video.destroy({
  where: {
    companyId: req.company.id,
    fileName: finalDisplayName,
    isActive: false,
  },
});
```

**After:**
```javascript
await Video.destroy({
  where: {
    companyId: req.company.id,
    fileName: finalDisplayName,
    isActive: false,
  },
  force: true, // Hard delete - actually remove from database
});
```

### Database Cleanup

**Deleted:** 1 inactive video record (`file_example_MP4_480_1_5MG`)

**Result:** Database verified clean (0 inactive videos remaining)

## 🎯 What This Fixes

### Before Fix
1. User uploads video → upload fails
2. Inactive record left in database (soft deleted)
3. User tries to upload same video again
4. ❌ Error: "Video with this name already exists"
5. Unique constraint violated even though record is inactive/soft-deleted

### After Fix
1. User uploads video → upload fails
2. Inactive record left in database
3. User tries to upload same video again
4. System **hard deletes** inactive record with same name
5. ✅ Upload succeeds - no conflict

## 🔍 Why This Happened

### Sequelize Soft Delete Behavior

By default, Sequelize models with `paranoid: true` use **soft deletes**:
- `destroy()` sets `deletedAt` timestamp
- Record remains in database
- **Database constraints still apply** to soft-deleted records

### Our Unique Constraint
```sql
UNIQUE CONSTRAINT (company_id, file_name)
```

This constraint applies to **all records**, including soft-deleted ones.

### Solution
Use `destroy({ force: true })` to **hard delete** (actually remove from database):
```javascript
await Video.destroy({
  where: { ... },
  force: true, // Bypass soft delete, actually delete
});
```

## 📊 Impact

### Before
- ❌ Users could not re-upload videos with same name after failed uploads
- ❌ Manual database cleanup required
- ❌ Poor user experience

### After
- ✅ Users can immediately retry failed uploads
- ✅ Automatic cleanup of inactive records
- ✅ Smooth user experience

## 🧪 Testing

### Test Scenario
1. Upload a video (let it fail or cancel)
2. Verify inactive record exists
3. Try to upload same video again
4. ✅ Should succeed (inactive record auto-deleted)

### Verification Commands

**Check for inactive records:**
```bash
node -e "
require('dotenv').config();
const { Video } = require('./models');
Video.count({ where: { isActive: false } }).then(count => {
  console.log('Inactive videos:', count);
  process.exit(0);
});
"
```

**Clean up inactive records manually (if needed):**
```bash
node cleanup-orphaned-uploads.js --delete
```

## 🔄 Related Changes

This fix is part of the atomic operations implementation:
- See: `ATOMIC_OPERATIONS.md`
- See: `IMPLEMENTATION_COMPLETE.md`
- See: `cleanup-orphaned-uploads.js`

### Consistency with Other Deletes

All delete operations now use `force: true`:
- ✅ Request-upload-url cleanup: `force: true` (FIXED)
- ✅ Complete-upload failure cleanup: `force: true` (already correct)
- ✅ Delete endpoint: `force: true` (already correct)
- ✅ Bulk delete endpoint: `force: true` (already correct)

## 📝 Best Practices Going Forward

### When to Use Hard Delete (`force: true`)

**Always use hard delete when:**
1. Cleaning up orphaned/inactive records
2. Deleting during rollback/error handling
3. Removing records that should not exist
4. Avoiding unique constraint conflicts

**Example:**
```javascript
// Good: Hard delete orphaned records
await Video.destroy({
  where: { isActive: false },
  force: true, // Actually remove
});

// Bad: Soft delete orphaned records
await Video.destroy({
  where: { isActive: false },
  // Leaves records in database!
});
```

### When to Use Soft Delete (default)

**Use soft delete (default) when:**
1. User explicitly deletes something (for audit trail)
2. Need to recover data later
3. Want to keep history

**Note:** In our current implementation, we use **hard delete everywhere** because:
- S3 files are permanently deleted (can't soft delete S3)
- Database should match S3 state
- Soft-deleted records cause unique constraint issues

## 🎉 Summary

**Issue:** Inactive records blocking uploads  
**Root Cause:** Soft delete leaves records in database  
**Fix:** Use `force: true` for hard delete  
**Result:** ✅ Uploads work immediately after failures  

**Status:** ✅ Fixed and Deployed  
**Date:** December 28, 2025  
**Breaking Changes:** None  
**Migration Required:** No (cleanup done automatically)

---

**Now users can retry failed uploads immediately without "name already exists" errors!** 🎉

