# Schedule Auto-Adjustment Feature

## ✅ Feature Overview

When you add or update a video in a schedule, the system **automatically adjusts existing videos** to make room for the new one. **Newer videos always have priority** - existing videos are shortened, moved, or removed as needed.

---

## 🎯 How It Works

### Priority Rule

**NEWEST VIDEO = HIGHEST PRIORITY**

When a new video overlaps with existing ones, the system:
1. ✅ **Keeps the new video** exactly as requested
2. 🔧 **Automatically adjusts** existing videos to make room
3. 📊 **Reports** what was changed in the response

---

## 🔄 Adjustment Scenarios

### Scenario 1: Complete Overlap → Remove Existing

**When:** New video completely covers an existing video

```
Before:
  Video A: 09:00-09:30 (30 min)

Add:
  Video B: 08:45-09:45 (60 min)

After:
  Video B: 08:45-09:45 (60 min)
  Video A: REMOVED ❌
```

**Result:** Video A is completely overlapped, so it's removed.

---

### Scenario 2: Overlap Beginning → Trim Start

**When:** New video overlaps the beginning of an existing video

```
Before:
  Video A: 09:00-09:30 (30 min)

Add:
  Video B: 08:45-09:15 (30 min)

After:
  Video B: 08:45-09:15 (30 min)
  Video A: 09:15-09:30 (15 min) ✂️ TRIMMED
```

**Result:** Video A's start time is moved forward, duration shortened.

---

### Scenario 3: Overlap End → Shorten Duration

**When:** New video overlaps the end of an existing video

```
Before:
  Video A: 09:00-09:30 (30 min)

Add:
  Video B: 09:10-09:40 (30 min)

After:
  Video A: 09:00-09:10 (10 min) ✂️ SHORTENED
  Video B: 09:10-09:40 (30 min)
```

**Result:** Video A's duration is shortened to end before Video B starts.

---

### Scenario 4: Overlap Middle → Keep First Part

**When:** New video is inserted in the middle of an existing video

```
Before:
  Video A: 09:00-10:00 (60 min)

Add:
  Video B: 09:15-09:45 (30 min)

After:
  Video A: 09:00-09:15 (15 min) ✂️ SHORTENED
  Video B: 09:15-09:45 (30 min)
  [Part after 09:45 is REMOVED] ❌
```

**Result:** Video A is shortened to the part before Video B. The part after Video B is discarded.

---

## 📊 Response Format

When you add/update a video, you get detailed information about adjustments:

```json
{
  "success": true,
  "message": "Schedule item added successfully. 2 existing video(s) adjusted, 1 video(s) removed to make room.",
  "data": {
    "id": "new-video-id",
    "startTime": "09:10:00",
    "duration": 1800,
    ...
  },
  "adjustments": {
    "adjusted": [
      {
        "id": "video-a-id",
        "videoName": "Morning Ad",
        "oldStart": "09:00:00",
        "oldDuration": 1800,
        "newStart": "09:00:00",
        "newDuration": 600,
        "adjustment": "Duration shortened"
      }
    ],
    "removed": [
      {
        "id": "video-b-id",
        "videoName": "Corporate Video",
        "reason": "Completely overlapped by new video"
      }
    ]
  }
}
```

---

## 🧪 Test Examples

### Example 1: Add Video That Overlaps Two Existing

```bash
# Initial schedule
Video A: 09:00-09:30
Video B: 09:30-10:00

# Add overlapping video
POST /api/schedules/{id}/items
{
  "videoId": "video-c",
  "startTime": "09:10:00",
  "duration": 2400  # 40 minutes (ends at 09:50)
}

# Result
Video A: 09:00-09:10 ✂️ Shortened
Video C: 09:10-09:50 ✅ New
Video B: 09:50-10:00 ✂️ Start moved
```

### Example 2: Add Video That Removes Everything

```bash
# Initial schedule
Video A: 09:00-09:30
Video B: 09:30-10:00

# Add video covering both
POST /api/schedules/{id}/items
{
  "videoId": "video-c",
  "startTime": "09:00:00",
  "duration": 3600  # 60 minutes (ends at 10:00)
}

# Result
Video A: REMOVED ❌
Video B: REMOVED ❌
Video C: 09:00-10:00 ✅ New
```

### Example 3: Update Video That Causes Overlap

```bash
# Initial schedule
Video A: 09:00-09:30
Video B: 10:00-10:30

# Move Video B to overlap with Video A
PUT /api/schedules/{id}/items/{video-b-id}
{
  "startTime": "09:15:00"
}

# Result
Video A: 09:00-09:15 ✂️ Shortened
Video B: 09:15-09:45 ✅ Updated (moved earlier)
```

---

## 🎬 Real-World Example

### Scenario: Emergency Announcement

You have a schedule with various videos, but need to add an urgent announcement immediately.

**Before:**
```
09:00 - Corporate Welcome (30 min)
09:30 - Product Demo (60 min)
10:30 - Q&A Session (30 min)
```

**Add Emergency Announcement:**
```bash
POST /api/schedules/{id}/items
{
  "videoId": "emergency-alert",
  "startTime": "09:45:00",
  "duration": 900  # 15 minutes
}
```

**After:**
```
09:00 - Corporate Welcome (30 min)        [Unchanged]
09:30 - Product Demo (45 min) ✂️          [Shortened from 60 to 45]
09:45 - EMERGENCY ALERT (15 min) ✅       [New - takes priority]
10:00 - Q&A Session (30 min)             [Unchanged]
```

**Response:**
```json
{
  "message": "Schedule item added successfully. 1 existing video(s) adjusted, 0 video(s) removed to make room.",
  "adjustments": {
    "adjusted": [
      {
        "videoName": "Product Demo",
        "oldDuration": 3600,
        "newDuration": 2700,
        "adjustment": "Duration shortened"
      }
    ],
    "removed": []
  }
}
```

---

## 📅 Day & Date Range Handling

Adjustments respect day-of-week and date range filters:

### Different Days = No Adjustment

```bash
# Existing
Video A: 09:00-09:30 [Mon-Fri]

# Add
Video B: 09:00-09:30 [Sat-Sun]

# Result
Video A: 09:00-09:30 [Mon-Fri] ✅ Unchanged
Video B: 09:00-09:30 [Sat-Sun] ✅ Added
```

### Different Date Ranges = No Adjustment

```bash
# Existing
Video A: 09:00-09:30 [Jan 1-31]

# Add
Video B: 09:00-09:30 [Feb 1-28]

# Result
Video A: 09:00-09:30 [Jan 1-31] ✅ Unchanged
Video B: 09:00-09:30 [Feb 1-28] ✅ Added
```

---

## 🔒 Transaction Safety

All adjustments happen within a database transaction:

```
BEGIN TRANSACTION
  ↓
1. Find overlapping videos
  ↓
2. Adjust each one (trim, move, or remove)
  ↓
3. Add new video
  ↓
COMMIT (all or nothing!)
```

**Benefits:**
- ✅ Atomic operation
- ✅ If any step fails, everything rolls back
- ✅ No partial updates
- ✅ Database always consistent

---

## 💡 Best Practices

### 1. Review Adjustment Reports

Always check the `adjustments` object in the response to see what changed.

### 2. Use Descriptive Names

Name your videos clearly so adjustment reports are easy to understand.

### 3. Plan Major Changes

For large schedule reorganizations, consider removing old items first, then adding new ones.

### 4. Leverage Day/Date Filters

Use different days or date ranges when you want videos at the same time without conflicts.

### 5. Back Up Important Schedules

Before major changes, note down existing schedule items in case you need to recreate them.

---

## 🔄 Comparison: Old vs New Behavior

### Old Behavior (Collision Detection)

```
Add overlapping video → ❌ 409 Error
User sees: "Schedule conflict detected"
User must: Manually adjust existing videos first
```

### New Behavior (Auto-Adjustment)

```
Add overlapping video → ✅ 201 Created
System: Automatically adjusts existing videos
User sees: "1 video adjusted, 0 removed"
User gets: Detailed report of changes
```

---

## 📊 Adjustment Types Summary

| Type | When | Existing Video | New Video |
|------|------|----------------|-----------|
| **Remove** | New covers old | Removed (inactive) | Added |
| **Trim Start** | New overlaps beginning | Start moved forward | Added |
| **Shorten End** | New overlaps end | Duration shortened | Added |
| **Split** | New in middle | Keep first part only | Added |

---

## 🎯 Key Points

✅ **Newer = Higher Priority** - New videos always win  
✅ **Automatic** - No manual adjustment needed  
✅ **Transparent** - Full report of changes  
✅ **Safe** - Database transactions ensure consistency  
✅ **Smart** - Respects day/date filters  
✅ **Flexible** - Different scenarios handled intelligently  

---

## 🚀 Quick Test

```bash
# 1. Add first video
POST /api/schedules/{id}/items
{"videoId": "...", "startTime": "09:00:00", "duration": 1800}
# Response: 201 Created

# 2. Add overlapping video
POST /api/schedules/{id}/items
{"videoId": "...", "startTime": "09:10:00", "duration": 1800}
# Response: 201 Created
# Message: "1 existing video(s) adjusted..."
# Adjustments: [{ videoName, oldDuration, newDuration }]
```

---

## 📚 Related Documentation

- **Schedule Module Guide**: `SCHEDULE_MODULE_GUIDE.md`
- **Quick Reference**: `SCHEDULE_QUICK_REFERENCE.md`
- **Postman Collection**: `POSTMAN_COLLECTION_UPDATE.md`

---

**Your schedules now automatically adapt to new content! 🎬**

