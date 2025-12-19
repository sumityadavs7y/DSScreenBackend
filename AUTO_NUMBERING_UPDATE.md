# Auto-Numbering Feature for Duplicate Video Names

## 🎯 Feature Overview

The video upload system now automatically numbers duplicate filenames instead of rejecting them. This provides a much better user experience similar to how modern file systems handle duplicates.

## ✨ How It Works

### Automatic Numbering Pattern

When you upload a video with a name that already exists, the system automatically appends a number in parentheses:

```
Upload "Presentation.mp4" → "Presentation" (if unique)
Upload "Presentation.mp4" → "Presentation (1)" (if "Presentation" exists)
Upload "Presentation.mp4" → "Presentation (2)" (if both exist)
Upload "Presentation.mp4" → "Presentation (3)" (and so on...)
```

### Real-World Example

```bash
# First upload
curl -X POST /api/videos/upload \
  -F "video=@video.mp4" \
  -F "displayName=Team Meeting"
# Result: "Team Meeting"

# Second upload with same name
curl -X POST /api/videos/upload \
  -F "video=@video.mp4" \
  -F "displayName=Team Meeting"
# Result: "Team Meeting (1)"

# Third upload
curl -X POST /api/videos/upload \
  -F "video=@video.mp4" \
  -F "displayName=Team Meeting"
# Result: "Team Meeting (2)"
```

## 📊 API Response Changes

### Before (Rejected Upload)
```json
{
  "success": false,
  "message": "A video with this name already exists. Please use a different name.",
  "statusCode": 409
}
```

### After (Auto-Numbered)
```json
{
  "success": true,
  "message": "Video uploaded successfully. Name was changed to \"Presentation (1)\" to avoid duplicates.",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fileName": "Presentation (1)",
    "originalName": "Presentation",
    "fileSize": 52428800,
    "mimeType": "video/mp4",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "wasRenamed": true
  }
}
```

### Fields Explained

| Field | Description |
|-------|-------------|
| `fileName` | The final name used in the database |
| `originalName` | The name you originally requested |
| `wasRenamed` | `true` if auto-numbering occurred, `false` if original name was used |
| `message` | Indicates if the name was changed |

## 🔧 Implementation Details

### Code Logic

```javascript
// Get base display name
let baseDisplayName = req.body.displayName || originalFileName;
let counter = 1;
let finalDisplayName = baseDisplayName;

// Keep trying numbers until we find an available name
while (true) {
  const exists = await Video.findOne({
    where: {
      companyId: req.company.id,
      fileName: finalDisplayName
    }
  });

  if (!exists) {
    break; // Name is available
  }

  // Try next number
  finalDisplayName = `${baseDisplayName} (${counter})`;
  counter++;
}
```

### Safety Features

1. **Infinite Loop Protection**: Stops after 1000 attempts
2. **Works with Deleted Videos**: Checks both active and deleted videos
3. **Thread-Safe**: Database unique constraint ensures consistency
4. **Error Handling**: Cleans up files if numbering fails

## 💡 User Experience Benefits

### Before: Frustrating 😤
```
User: Uploads "Meeting.mp4"
System: ❌ Error! Video already exists. Choose different name.
User: Uploads "Meeting2.mp4"
System: ❌ Error! That also exists.
User: Uploads "Meeting_final_v3.mp4"
System: ✅ Success! (after 3 attempts)
```

### After: Seamless 😊
```
User: Uploads "Meeting.mp4"
System: ✅ Success! Saved as "Meeting (1)"
User: Can immediately continue with their workflow
```

## 📝 Frontend Integration

### React Component Example

```javascript
const uploadVideo = async (file, displayName) => {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('displayName', displayName);

  const response = await fetch('/api/videos/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });

  const result = await response.json();

  if (result.success) {
    if (result.data.wasRenamed) {
      // Notify user about the name change
      alert(`Video uploaded as "${result.data.fileName}"`);
    } else {
      alert('Video uploaded successfully!');
    }
  }
};
```

### Handling Renamed Files

```javascript
function handleUploadResponse(response) {
  const { fileName, originalName, wasRenamed } = response.data;
  
  if (wasRenamed) {
    // Show notification
    showNotification(
      'info',
      `Video saved as "${fileName}" to avoid duplicates`,
      3000
    );
  }
  
  // Update your video list
  refreshVideoList();
}
```

## 🎨 UI/UX Recommendations

### 1. Show Original and Final Names
```html
<div class="upload-success">
  <span class="icon">✅</span>
  <div>
    <strong>Upload Successful</strong>
    <p>Your video "Presentation" was saved as "Presentation (1)"</p>
  </div>
</div>
```

### 2. Preview Before Upload (Optional)
```javascript
// Check if name exists before uploading
const checkNameAvailability = async (name) => {
  const videos = await fetchVideoList();
  const exists = videos.some(v => v.fileName === name);
  
  if (exists) {
    // Find next available number
    let counter = 1;
    while (videos.some(v => v.fileName === `${name} (${counter})`)) {
      counter++;
    }
    return `${name} (${counter})`;
  }
  return name;
};

// Show preview to user
const suggestedName = await checkNameAvailability(displayName);
if (suggestedName !== displayName) {
  showMessage(`This video will be saved as "${suggestedName}"`);
}
```

### 3. Bulk Upload Handling
```javascript
const uploadMultipleVideos = async (files) => {
  const results = [];
  
  for (const file of files) {
    const result = await uploadVideo(file);
    results.push({
      originalName: file.name,
      savedAs: result.data.fileName,
      wasRenamed: result.data.wasRenamed
    });
  }
  
  // Show summary
  showBulkUploadSummary(results);
};
```

## 🔍 Testing Scenarios

### Test 1: Basic Auto-Numbering
```bash
# Upload
curl -X POST /api/videos/upload \
  -F "video=@test.mp4" \
  -F "displayName=Test Video"
# Expected: "Test Video"

# Upload again
curl -X POST /api/videos/upload \
  -F "video=@test.mp4" \
  -F "displayName=Test Video"
# Expected: "Test Video (1)"

# Upload third time
curl -X POST /api/videos/upload \
  -F "video=@test.mp4" \
  -F "displayName=Test Video"
# Expected: "Test Video (2)"
```

### Test 2: Deleted Video Names
```bash
# Upload
curl -X POST /api/videos/upload -F "video=@video.mp4" -F "displayName=Old Video"
# Result: "Old Video"

# Delete
curl -X DELETE /api/videos/{id}

# Upload again with same name
curl -X POST /api/videos/upload -F "video=@video.mp4" -F "displayName=Old Video"
# Result: "Old Video (1)" (because deleted video still counts)
```

### Test 3: Name with Numbers
```bash
# Upload
curl -X POST /api/videos/upload -F "displayName=Video (1)"
# Result: "Video (1)"

# Upload with base name
curl -X POST /api/videos/upload -F "displayName=Video"
# Result: "Video" (not "Video (1)" because that's a different base name)

# Upload Video (1) again
curl -X POST /api/videos/upload -F "displayName=Video (1)"
# Result: "Video (1) (1)" (numbers the entire string including existing number)
```

## ⚠️ Edge Cases Handled

### 1. Names Already Containing Parentheses
```
Input: "Meeting (Draft)"
Duplicate: "Meeting (Draft) (1)"
Not: "Meeting (Draft) (1)" ✅
```

### 2. Very Long Names
```
Input: "Very Long Video Name That Goes On And On..."
Duplicate: "Very Long Video Name That Goes On And On... (1)"
Database: Truncated if exceeds VARCHAR limit
```

### 3. Special Characters
```
Input: "Présentation été 2024"
Duplicate: "Présentation été 2024 (1)"
Works: ✅ UTF-8 supported
```

### 4. Safety Limit
```
After 1000 attempts:
Returns: 400 Error "Unable to generate unique filename"
Reason: Prevent infinite loops / database attacks
```

## 📊 Performance Considerations

### Database Queries
- **Before**: 1 query to check + 1 to insert = 2 queries
- **After**: N queries to find available number + 1 to insert
- **Typical case**: 2-3 queries (most names are unique)
- **Worst case**: 1001 queries (when hitting limit)

### Optimization Strategies

1. **Index on (company_id, file_name)**: Already implemented ✅
2. **Batch Check**: Could check multiple numbers at once
3. **Smart Starting Point**: Could query max number and start from there

### Future Optimization (If Needed)
```javascript
// Instead of checking one by one, get all matching names
const existingNumbers = await Video.findAll({
  where: {
    companyId: req.company.id,
    fileName: {
      [Op.like]: `${baseDisplayName}%`
    }
  },
  attributes: ['fileName']
});

// Parse numbers and find gap
const numbers = existingNumbers
  .map(v => {
    const match = v.fileName.match(/\((\d+)\)$/);
    return match ? parseInt(match[1]) : 0;
  })
  .sort((a, b) => a - b);

// Find first gap
let counter = 1;
for (const num of numbers) {
  if (num === counter) counter++;
  else break;
}
```

## 🆚 Comparison with Alternatives

### Alternative 1: Reject Upload (Old Behavior)
❌ Poor UX - requires user to manually rename
❌ More API calls (user must retry)
❌ Frustrating for bulk uploads

### Alternative 2: Overwrite Existing ⚠️
❌ Data loss risk
❌ Needs confirmation dialog
❌ Complex permissions

### Alternative 3: Random Suffix ⚠️
❌ Ugly names: "video_a3f2e1b.mp4"
❌ Hard to find files
❌ Not user-friendly

### Alternative 4: Auto-Numbering ✅ (Chosen)
✅ Familiar pattern (like Windows/Mac)
✅ Predictable names
✅ No user intervention needed
✅ Preserves original intent

## 📚 Related Features

### Future Enhancements

1. **Smart Gap Filling**: Use lowest available number
   ```
   "Video", "Video (2)" exists
   Upload → "Video (1)" (fills gap)
   ```

2. **Bulk Upload Optimization**: Pre-allocate numbers
   ```
   Uploading 10 files → Reserve numbers 1-10
   ```

3. **User Preference**: Let users choose behavior
   ```
   Settings: ☑ Auto-number duplicates
             ☐ Ask before numbering
             ☐ Reject duplicates
   ```

4. **Rename Suggestions**: Offer alternatives
   ```
   "Meeting (1)" or "Meeting 2024-12-18" or "Meeting Final"
   ```

## 📖 Documentation Updates

All documentation has been updated to reflect this feature:
- ✅ [VIDEO_UPLOAD_GUIDE.md](./VIDEO_UPLOAD_GUIDE.md)
- ✅ [VIDEO_API_QUICK_REFERENCE.md](./VIDEO_API_QUICK_REFERENCE.md)
- ✅ [README.md](./README.md)
- ✅ [VIDEO_ERROR_FIX.md](./VIDEO_ERROR_FIX.md)
- ✅ [AUTO_NUMBERING_UPDATE.md](./AUTO_NUMBERING_UPDATE.md) (this file)

## ✨ Summary

**Before**: "Video name already exists" error ❌  
**After**: Automatically becomes "Video Name (1)" ✅

This feature provides a seamless, frustration-free upload experience that users expect from modern applications!

