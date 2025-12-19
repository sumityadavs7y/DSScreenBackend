# Postman Collection Update - Schedule Module

## ✅ What Was Added

The Postman collection has been updated with the complete **Schedule Management** section containing 13 endpoints.

---

## 📥 Import Instructions

1. Open Postman
2. Click **Import** button
3. Select `postman_collection.json` from the project root
4. The collection will include all endpoints including the new Schedule Management section

---

## 🆕 New Collection Variables

The following variables have been added for schedule testing:

| Variable | Description | Auto-Set By |
|----------|-------------|-------------|
| `scheduleId` | UUID of created schedule | Create Schedule |
| `scheduleCode` | 5-char public code | Create Schedule |
| `scheduleItemId` | UUID of schedule item | Add Video to Schedule |

---

## 📋 Schedule Management Endpoints

### Section: Schedule Management (13 endpoints)

#### 1. Create Schedule
**POST** `/api/schedules`
- Creates schedule with unique code
- Auto-saves `scheduleId` and `scheduleCode` to variables
- Shows public URL in console

```json
{
  "name": "Main Display Schedule",
  "description": "Schedule for lobby digital signage",
  "timezone": "America/New_York",
  "settings": {
    "loop": true,
    "autoStart": true
  }
}
```

#### 2. List All Schedules
**GET** `/api/schedules`
- Lists all company schedules
- Shows item counts
- Includes creator info

#### 3. Get Schedule by ID
**GET** `/api/schedules/:scheduleId`
- Detailed schedule with all items
- Uses `{{scheduleId}}` variable

#### 4. Get Schedule by Code (Public) ⭐
**GET** `/api/schedules/public/:code`
- **NO AUTHENTICATION REQUIRED**
- Uses `{{scheduleCode}}` variable
- Perfect for testing public access

#### 5. Get Storage Usage
**GET** `/api/videos/storage`
- Company storage statistics
- Shows usage percentage
- Lists available space

#### 6. Update Schedule
**PUT** `/api/schedules/:scheduleId`
- Updates name, description, settings
- All fields optional

#### 7. Delete Schedule
**DELETE** `/api/schedules/:scheduleId`
- Soft deletes schedule
- Removes from active lists

#### 8. Add Video to Schedule
**POST** `/api/schedules/:scheduleId/items`
- Adds video to timeline
- Auto-saves `scheduleItemId`
- Full featured example

```json
{
  "videoId": "{{videoId}}",
  "startTime": "09:00:00",
  "duration": 30,
  "dayOfWeek": [1, 2, 3, 4, 5],
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "order": 0,
  "metadata": {
    "transition": "fade",
    "volume": 80
  }
}
```

#### 9. Add Video to Schedule (Weekdays Only)
**POST** `/api/schedules/:scheduleId/items`
- Example: Monday-Friday playback
- Simplified request

#### 10. Add Video to Schedule (Weekends Only)
**POST** `/api/schedules/:scheduleId/items`
- Example: Saturday-Sunday playback
- Evening schedule

#### 11. Add Video to Schedule (Every Day)
**POST** `/api/schedules/:scheduleId/items`
- Example: Daily playback
- No `dayOfWeek` restriction

#### 12. Update Schedule Item
**PUT** `/api/schedules/:scheduleId/items/:itemId`
- Updates timeline item
- All fields optional

#### 13. Delete Schedule Item
**DELETE** `/api/schedules/:scheduleId/items/:itemId`
- Removes video from timeline

---

## 🚀 Testing Workflow

### Complete End-to-End Test

Follow these steps in order:

1. **Authentication**
   ```
   1. Register User (Creates Company)
   2. Login
   3. Select Company
   ```
   ✅ You now have `accessToken` and `companyId` set

2. **Upload Video**
   ```
   Upload Video → Select a video file
   ```
   ✅ You now have `videoId` set

3. **Create Schedule**
   ```
   Create Schedule
   ```
   ✅ You now have `scheduleId` and `scheduleCode` set
   ✅ Console shows: "Public URL: /api/schedules/public/Ab3Xy"

4. **Add Videos to Timeline**
   ```
   Add Video to Schedule (Weekdays Only)
   Add Video to Schedule (Weekends Only)
   Add Video to Schedule (Every Day)
   ```
   ✅ Schedule now has 3 videos at different times

5. **View Schedule**
   ```
   Get Schedule by ID → See all items
   Get Schedule by Code (Public) → Test public access
   ```

6. **Share Publicly**
   ```
   Use the code from {{scheduleCode}} variable
   Share: http://localhost:3000/api/schedules/public/{{scheduleCode}}
   ```

---

## 📊 Example Schedule Timeline

After running the example requests, your schedule will look like:

```
Schedule: "Main Display Schedule" (Code: Ab3Xy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

09:00 - Video 1 (30s) [Mon-Fri]
12:00 - Video 2 (60s) [Mon-Fri]  
14:00 - Video 3 (45s) [Every day]
19:00 - Video 4 (90s) [Sat-Sun]

Total: 4 items
Public URL: /api/schedules/public/Ab3Xy
```

---

## 🎯 Day of Week Reference

Quick reference for `dayOfWeek` field:

```javascript
// Weekdays only
"dayOfWeek": [1, 2, 3, 4, 5]

// Weekends only
"dayOfWeek": [0, 6]

// Monday, Wednesday, Friday
"dayOfWeek": [1, 3, 5]

// Every day (omit field or set to null)
"dayOfWeek": null
// or simply don't include the field
```

---

## 🔑 Schedule Code Examples

The collection includes several examples:

| Example | Time | Duration | Days | Description |
|---------|------|----------|------|-------------|
| Weekdays | 12:00:00 | 60s | Mon-Fri | Lunch time ad |
| Weekends | 19:00:00 | 90s | Sat-Sun | Evening special |
| Every Day | 14:00:00 | 45s | All | Afternoon promo |
| Custom | 09:00:00 | 30s | Mon-Fri | Morning greeting |

---

## 📝 Testing Tips

### 1. Use Console Logs
After creating schedules, check the Postman console for:
- Schedule ID
- Schedule Code
- Public URL

### 2. Variable Inspection
Click the eye icon (👁️) to see current variable values:
- `scheduleId`
- `scheduleCode`
- `scheduleItemId`
- `videoId`

### 3. Test Public Access
The public endpoint doesn't require authentication:
- No `Authorization` header needed
- Share code with anyone
- Perfect for digital displays

### 4. Order of Operations
Always follow this order:
1. Auth (get token)
2. Upload video (get videoId)
3. Create schedule (get scheduleId)
4. Add items (requires both videoId and scheduleId)

---

## 🔒 Authentication Notes

| Endpoint | Auth Required | Notes |
|----------|---------------|-------|
| Create Schedule | ✅ Yes | Bearer token |
| List Schedules | ✅ Yes | Bearer token |
| Get by ID | ✅ Yes | Bearer token |
| **Get by Code** | ❌ **No** | **Public access!** |
| Update Schedule | ✅ Yes | Bearer token |
| Delete Schedule | ✅ Yes | Bearer token |
| Add Item | ✅ Yes | Bearer token |
| Update Item | ✅ Yes | Bearer token |
| Delete Item | ✅ Yes | Bearer token |

---

## 🎨 Customization Examples

### Example 1: Holiday Schedule
```json
{
  "videoId": "holiday-video-uuid",
  "startTime": "10:00:00",
  "duration": 120,
  "startDate": "2024-12-01",
  "endDate": "2024-12-31",
  "metadata": {
    "campaign": "Holiday 2024",
    "volume": 85
  }
}
```

### Example 2: Rotating Ads (Same Time, Different Videos)
```json
// Morning slot - Video 1
{
  "videoId": "video-1-uuid",
  "startTime": "09:00:00",
  "duration": 30,
  "order": 0
}

// Morning slot - Video 2
{
  "videoId": "video-2-uuid",
  "startTime": "09:00:00",
  "duration": 30,
  "order": 1
}
```

### Example 3: Time-Limited Promotion
```json
{
  "videoId": "flash-sale-uuid",
  "startTime": "17:00:00",
  "duration": 60,
  "dayOfWeek": [5, 6],  // Friday & Saturday
  "startDate": "2024-02-01",
  "endDate": "2024-02-14"
}
```

---

## 📦 Collection Structure

```
dsScreen Backend - Complete API Collection
├── Public Endpoints (2)
├── Authentication (8)
├── User Management (2)
├── Company Management (8)
├── Video Management (7)
└── Schedule Management (13) ⭐ NEW
    ├── Create Schedule
    ├── List All Schedules
    ├── Get Schedule by ID
    ├── Get Schedule by Code (Public) ⭐
    ├── Get Storage Usage
    ├── Update Schedule
    ├── Delete Schedule
    ├── Add Video to Schedule
    ├── Add Video (Weekdays)
    ├── Add Video (Weekends)
    ├── Add Video (Every Day)
    ├── Update Schedule Item
    └── Delete Schedule Item
```

**Total Endpoints**: 40 (13 new)

---

## 🎬 Quick Test Script

Copy this into Postman Pre-request Script for automated testing:

```javascript
// Get current time for dynamic testing
const now = new Date();
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const currentTime = `${hours}:${minutes}:00`;

pm.collectionVariables.set('currentTime', currentTime);
console.log('Current Time:', currentTime);
```

Then use `{{currentTime}}` in your requests!

---

## 🐛 Troubleshooting

### Issue: "Schedule not found"
**Solution**: Make sure you created a schedule first. Check `{{scheduleId}}` variable.

### Issue: "Video not found"
**Solution**: Upload a video first. Check `{{videoId}}` variable.

### Issue: "Invalid time format"
**Solution**: Use 24-hour format: `09:00:00` or `09:00`

### Issue: Public endpoint returns 404
**Solution**: Check that you're using the correct code from `{{scheduleCode}}`

### Issue: Can't update schedule
**Solution**: Members can only update their own schedules. Owner/admin can update any.

---

## 📚 Related Documentation

- **Full API Guide**: `SCHEDULE_MODULE_GUIDE.md`
- **Quick Reference**: `SCHEDULE_QUICK_REFERENCE.md`
- **Implementation**: `SCHEDULE_IMPLEMENTATION_SUMMARY.md`

---

## ✨ Summary

✅ **13 new endpoints** added to Postman collection  
✅ **3 new variables** for schedule testing  
✅ **Multiple examples** for different use cases  
✅ **Public endpoint** for testing without auth  
✅ **Auto-save scripts** for easy workflow  
✅ **Comprehensive descriptions** for each request  

**Ready to test!** Import the collection and start with the Authentication flow.

---

**Happy Testing! 🎬**

