# Schedule Collision Detection

## ✅ Feature Implemented

The Schedule module now includes **automatic collision detection** to prevent overlapping videos in the timeline. When adding or updating schedule items, the system verifies that the new time slot doesn't conflict with existing items.

---

## 🎯 How It Works

### Collision Detection Logic

When you add or update a schedule item, the system checks for overlaps on **three dimensions**:

1. **Time Overlap** - Start/end times conflict
2. **Day Overlap** - Videos play on the same days
3. **Date Range Overlap** - Active date ranges intersect

All three conditions must be true for a collision to be detected.

---

## 📊 Time Overlap Detection

### Formula
Two time ranges `[A_start, A_end]` and `[B_start, B_end]` overlap if:

```
A_start < B_end AND B_start < A_end
```

### Examples

#### Example 1: New video starts during existing video
```
Existing: 09:00 - 09:30 (30 minutes)
New:      09:10 - 09:40 (30 minutes)
         ↓
Conflict! New video starts at 9:10, before existing ends at 9:30
```

#### Example 2: New video ends during existing video
```
Existing: 09:00 - 09:30 (30 minutes)
New:      08:45 - 09:15 (30 minutes)
         ↓
Conflict! New video ends at 9:15, after existing starts at 9:00
```

#### Example 3: New video encompasses existing video
```
Existing: 09:15 - 09:30 (15 minutes)
New:      09:00 - 09:45 (45 minutes)
         ↓
Conflict! New video completely covers existing video
```

#### Example 4: No conflict (back-to-back is OK)
```
Existing: 09:00 - 09:30 (30 minutes)
New:      09:30 - 10:00 (30 minutes)
         ↓
OK! Videos play back-to-back with no overlap
```

---

## 📅 Day-of-Week Filtering

Videos only conflict if they play on the **same days**:

### Example 1: Different days - No conflict
```
Video 1: 09:00 for 30min [Mon, Tue, Wed, Thu, Fri]
Video 2: 09:00 for 30min [Sat, Sun]
         ↓
OK! Videos play at same time but on different days
```

### Example 2: Some shared days - Conflict
```
Video 1: 09:00 for 30min [Mon, Wed, Fri]
Video 2: 09:00 for 30min [Wed, Fri, Sat]
         ↓
Conflict! Both play on Wednesday and Friday at 9:00
```

### Example 3: One set to "every day" - Conflict
```
Video 1: 09:00 for 30min [Mon, Tue, Wed]
Video 2: 09:00 for 30min [null = every day]
         ↓
Conflict! Video 2 plays every day, including Mon-Wed
```

---

## 📆 Date Range Filtering

Videos only conflict if their **active date ranges overlap**:

### Example 1: Different date ranges - No conflict
```
Video 1: 09:00, Jan 1 - Jan 31
Video 2: 09:00, Feb 1 - Feb 28
         ↓
OK! Videos active in different months
```

### Example 2: Overlapping date ranges - Conflict
```
Video 1: 09:00, Jan 1 - Jan 31
Video 2: 09:00, Jan 15 - Feb 15
         ↓
Conflict! Both active Jan 15-31
```

### Example 3: No date range specified - Conflict
```
Video 1: 09:00, [no date range = always active]
Video 2: 09:00, Jan 1 - Jan 31
         ↓
Conflict! Video 1 is always active, including January
```

---

## 🔒 Database Transactions

All add/update operations use **database transactions** to ensure atomicity:

```javascript
const t = await Sequelize.transaction();

try {
  // 1. Validate inputs
  // 2. Check for overlaps
  // 3. If overlap found → ROLLBACK
  // 4. If no overlap → Create/Update item
  // 5. COMMIT transaction
  await t.commit();
} catch (error) {
  // Automatic ROLLBACK on any error
  await t.rollback();
}
```

**Benefits:**
- ✅ No partial updates
- ✅ No race conditions
- ✅ Database state remains consistent
- ✅ Automatic rollback on error

---

## 🚫 Error Response Format

When a collision is detected, you receive a `409 Conflict` response:

```json
{
  "success": false,
  "message": "Schedule conflict detected. The new video overlaps with existing schedule items.",
  "conflict": {
    "newItem": {
      "startTime": "09:10:00",
      "endTime": "09:40:00",
      "duration": 1800,
      "dayOfWeek": [1, 2, 3, 4, 5]
    },
    "conflictingItems": [
      {
        "id": "uuid-of-conflicting-item",
        "videoName": "Morning Ad",
        "startTime": "09:00:00",
        "duration": 1800,
        "endTime": "09:30:00",
        "dayOfWeek": [1, 2, 3, 4, 5],
        "startDate": null,
        "endDate": null
      }
    ]
  }
}
```

**Response includes:**
- Your attempted item's details
- List of all conflicting items
- Exact times and durations
- Day and date range information

---

## 🧪 Testing Examples

### Test 1: Simple Time Collision

```bash
# Add first video
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 1800  # 30 minutes (ends at 9:30)
}
# ✅ Success

# Try to add overlapping video
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-2-uuid",
  "startTime": "09:10:00",
  "duration": 1800  # 30 minutes (ends at 9:40)
}
# ❌ 409 Conflict - Overlaps with Video 1 (9:10-9:30)
```

### Test 2: End-Time Collision

```bash
# Add first video
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 1800  # 30 minutes
}
# ✅ Success

# Try to add video that starts before but ends during
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-2-uuid",
  "startTime": "08:45:00",
  "duration": 1800  # 30 minutes (ends at 9:15)
}
# ❌ 409 Conflict - Ends during Video 1's time
```

### Test 3: Different Days - No Collision

```bash
# Add weekday video
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 1800,
  "dayOfWeek": [1, 2, 3, 4, 5]  # Mon-Fri
}
# ✅ Success

# Add weekend video at same time
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-2-uuid",
  "startTime": "09:00:00",
  "duration": 1800,
  "dayOfWeek": [0, 6]  # Sat-Sun
}
# ✅ Success - Different days, no conflict!
```

### Test 4: Date Range - No Collision

```bash
# Add January video
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 1800,
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
# ✅ Success

# Add February video at same time
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-2-uuid",
  "startTime": "09:00:00",
  "duration": 1800,
  "startDate": "2024-02-01",
  "endDate": "2024-02-28"
}
# ✅ Success - Different months, no conflict!
```

### Test 5: Update Causing Collision

```bash
# Add two videos with no conflict
POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 1800
}
# ✅ Success - Video 1 at 9:00

POST /api/schedules/{scheduleId}/items
{
  "videoId": "video-2-uuid",
  "startTime": "10:00:00",
  "duration": 1800
}
# ✅ Success - Video 2 at 10:00

# Try to move Video 2 to overlap with Video 1
PUT /api/schedules/{scheduleId}/items/{video-2-id}
{
  "startTime": "09:15:00"  # Move to 9:15
}
# ❌ 409 Conflict - Would overlap with Video 1 (9:15-9:30)
```

---

## 📐 Collision Detection Algorithm

```javascript
function checkOverlap(newItem, existingItem) {
  // Step 1: Calculate end times
  const newEnd = newItem.startTime + newItem.duration;
  const existingEnd = existingItem.startTime + existingItem.duration;
  
  // Step 2: Check time overlap
  const timeOverlaps = 
    newItem.startTime < existingEnd && 
    existingItem.startTime < newEnd;
  
  if (!timeOverlaps) return false;  // No time overlap
  
  // Step 3: Check day overlap
  const daysOverlap = 
    (!newItem.dayOfWeek || !existingItem.dayOfWeek) ||  // One is "every day"
    (newItem.dayOfWeek.some(day => existingItem.dayOfWeek.includes(day)));  // Share days
  
  if (!daysOverlap) return false;  // Different days
  
  // Step 4: Check date range overlap
  const dateRangesOverlap = 
    (!newItem.startDate && !existingItem.startDate) ||  // Both always active
    (newItem.startDate <= existingItem.endDate && 
     existingItem.startDate <= newItem.endDate);
  
  if (!dateRangesOverlap) return false;  // Different date ranges
  
  // All three dimensions overlap = COLLISION!
  return true;
}
```

---

## 🎨 Use Cases

### Use Case 1: Morning Rotation

```javascript
// Add 3 morning videos that rotate
// Video 1: 9:00-9:30
// Video 2: 9:30-10:00  ✅ OK (back-to-back)
// Video 3: 10:00-10:30 ✅ OK (back-to-back)
```

### Use Case 2: Weekday vs Weekend Content

```javascript
// Weekday morning: Corporate video
// Weekend morning: Promotional video
// Same time, different days = ✅ No conflict
```

### Use Case 3: Seasonal Campaigns

```javascript
// Holiday campaign: Dec 1 - Dec 31
// New Year campaign: Jan 1 - Jan 31
// Same time slots, different months = ✅ No conflict
```

### Use Case 4: Preventing Errors

```javascript
// User accidentally tries to schedule two videos at 9:00
// System detects collision and rejects
// User is notified which video is already scheduled
// Database remains consistent (rollback)
```

---

## ⚙️ Configuration

No configuration needed! Collision detection is **always active** for:
- Adding new schedule items
- Updating existing schedule items

Collision detection does **NOT** apply to:
- Deleting items (deletion always succeeds)
- Soft-deleted items (inactive items are excluded from checks)

---

## 🔍 Helper Functions

### `timeToSeconds(timeStr)`
Converts "HH:MM:SS" to seconds since midnight.

```javascript
timeToSeconds("09:30:00") // Returns 34200
timeToSeconds("14:45:30") // Returns 53130
```

### `daysOverlap(days1, days2)`
Checks if two day-of-week arrays share common days.

```javascript
daysOverlap([1,2,3,4,5], [0,6])    // false (weekdays vs weekends)
daysOverlap([1,3,5], [3,5,6])      // true (share Wed & Fri)
daysOverlap(null, [1,2,3])         // true (null = every day)
```

### `dateRangesOverlap(start1, end1, start2, end2)`
Checks if two date ranges intersect.

```javascript
dateRangesOverlap(
  "2024-01-01", "2024-01-31",
  "2024-02-01", "2024-02-28"
)  // false (different months)

dateRangesOverlap(
  "2024-01-01", "2024-01-31",
  "2024-01-15", "2024-02-15"
)  // true (overlap Jan 15-31)
```

### `checkScheduleOverlap(scheduleId, startTime, duration, dayOfWeek, startDate, endDate, excludeItemId)`
Main collision detection function.

Returns:
```javascript
{
  hasOverlap: boolean,
  conflictingItems: [
    {
      id: "uuid",
      videoName: "Video Name",
      startTime: "09:00:00",
      duration: 1800,
      endTime: "09:30:00",
      dayOfWeek: [1,2,3,4,5],
      startDate: null,
      endDate: null
    }
  ]
}
```

---

## 🛡️ Benefits

### 1. Data Integrity
- Prevents overlapping videos in schedules
- Ensures consistent playback experience
- No conflicting content on displays

### 2. User Experience
- Clear error messages showing conflicts
- Lists all conflicting items
- Helps users resolve scheduling issues

### 3. Database Safety
- Transactions ensure atomic operations
- Automatic rollback on conflicts
- No partial updates or inconsistent state

### 4. Flexibility
- Allows same time on different days
- Allows same time in different date ranges
- Back-to-back videos are permitted

---

## 📝 Best Practices

### 1. Plan Your Schedule
Before adding items, plan out time slots to avoid conflicts.

### 2. Use Day Filters
Leverage `dayOfWeek` to run different content on different days at the same time.

### 3. Use Date Ranges
Use `startDate` and `endDate` for seasonal campaigns to reuse time slots.

### 4. Check Conflict Details
When you get a 409 error, examine `conflictingItems` to see what needs adjusting.

### 5. Back-to-Back is Fine
Videos can end and start at the exact same time (e.g., 9:00-9:30, then 9:30-10:00).

---

## 🐛 Troubleshooting

### Issue: "Schedule conflict detected" but I don't see why

**Solution**: Check all three dimensions:
1. Time ranges overlap?
2. Videos play on same days? (null = every day)
3. Date ranges overlap? (null = always active)

### Issue: I want videos to overlap (picture-in-picture)

**Current Status**: Overlaps are not supported. Each time slot can have only one video.

**Workaround**: Use the `order` field to suggest playback order if you implement custom player logic.

### Issue: Back-to-back videos are rejected

**Check**: Ensure end time of first video equals start time of second:
- Video 1: 9:00 + 1800s = 9:30 ✅
- Video 2: 9:30 start ✅
- No overlap! (9:00 < 9:30 AND 9:30 < 10:00 = false)

---

## ✨ Summary

✅ **Automatic collision detection** on add/update  
✅ **Three-dimensional checks** (time, day, date)  
✅ **Database transactions** for atomicity  
✅ **Detailed error messages** with conflict info  
✅ **Rollback on conflict** - no partial updates  
✅ **Flexible scheduling** (different days/dates at same time)  
✅ **No configuration needed** - works automatically  

Your schedules are now protected from overlapping videos! 🎬

---

## 📚 Related Documentation

- **Schedule Module Guide**: `SCHEDULE_MODULE_GUIDE.md`
- **Quick Reference**: `SCHEDULE_QUICK_REFERENCE.md`
- **Implementation Details**: `SCHEDULE_IMPLEMENTATION_SUMMARY.md`
- **Postman Collection**: `POSTMAN_COLLECTION_UPDATE.md`

