# Schedule Module - Quick Reference

## 📋 Quick API Reference

### Create Schedule
```bash
POST /api/schedules
Authorization: Bearer {token}
Body: { "name": "Schedule Name", "description": "Optional" }
Response: { code: "Ab3Xy", ... }
```

### Add Video to Timeline
```bash
POST /api/schedules/{scheduleId}/items
Authorization: Bearer {token}
Body: {
  "videoId": "video-uuid",
  "startTime": "09:00:00",
  "duration": 30,
  "dayOfWeek": [1,2,3,4,5]  // Optional: Mon-Fri
}
```

### View Schedule (PUBLIC - No Auth!)
```bash
GET /api/schedules/public/{code}
No Authorization needed!
```

### List All Schedules
```bash
GET /api/schedules
Authorization: Bearer {token}
```

### Update Schedule
```bash
PUT /api/schedules/{scheduleId}
Authorization: Bearer {token}
Body: { "name": "New Name", ... }
```

### Delete Schedule
```bash
DELETE /api/schedules/{scheduleId}
Authorization: Bearer {token}
```

### Update Schedule Item
```bash
PUT /api/schedules/{scheduleId}/items/{itemId}
Authorization: Bearer {token}
Body: { "startTime": "10:00:00", ... }
```

### Delete Schedule Item
```bash
DELETE /api/schedules/{scheduleId}/items/{itemId}
Authorization: Bearer {token}
```

---

## 🔑 Key Concepts

### Schedule Code
- **5 characters** (e.g., `Ab3Xy`)
- **Alphanumeric** (A-Z, a-z, 2-9)
- **Unique** across all schedules
- **Public access** - anyone with code can view

### Time Format
- **24-hour**: `09:00:00` or `09:00`
- Stored as: `HH:MM:SS`

### Day of Week
- **0** = Sunday
- **1** = Monday
- **2** = Tuesday
- **3** = Wednesday
- **4** = Thursday
- **5** = Friday
- **6** = Saturday
- **null** = Every day

### Duration
- Measured in **seconds**
- Example: `30` = 30 seconds, `120` = 2 minutes

---

## 🚀 Quick Start

### 1. Create Your First Schedule
```javascript
const response = await fetch('http://localhost:3000/api/schedules', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My First Schedule',
    timezone: 'America/New_York'
  })
});

const { data } = await response.json();
console.log('Code:', data.code); // Save this code!
```

### 2. Add a Video
```javascript
await fetch(`http://localhost:3000/api/schedules/${data.id}/items`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'YOUR_VIDEO_UUID',
    startTime: '09:00',
    duration: 30
  })
});
```

### 3. Share Publicly
```
Share this URL: http://localhost:3000/api/schedules/public/{code}
Anyone can view it - no login required!
```

---

## 📊 Common Patterns

### Weekday Only (Mon-Fri)
```json
{
  "dayOfWeek": [1, 2, 3, 4, 5]
}
```

### Weekend Only (Sat-Sun)
```json
{
  "dayOfWeek": [0, 6]
}
```

### Seasonal Campaign
```json
{
  "startDate": "2024-11-01",
  "endDate": "2024-12-31"
}
```

### All Day, Every Day
```json
{
  "dayOfWeek": null,
  "startDate": null,
  "endDate": null
}
```

---

## 🎯 Example Schedule

**Name**: "Lobby Display"  
**Code**: `Ab3Xy`

| Time | Video | Duration | Days |
|------|-------|----------|------|
| 09:00 | Morning Ad | 30s | Mon-Fri |
| 12:00 | Lunch Special | 60s | Every day |
| 17:00 | Evening Promo | 45s | Mon-Fri |
| 19:00 | Weekend Sale | 90s | Sat-Sun |

---

## 🔒 Permissions

| Role | Create | View | Edit Own | Edit All | Delete Own | Delete All |
|------|--------|------|----------|----------|------------|------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Member** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Viewer** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Public** | ❌ | ✅* | ❌ | ❌ | ❌ | ❌ |

\* Only via code: `/api/schedules/public/{code}`

---

## 💡 Tips

1. **Test with curl first** - Verify endpoints before building UI
2. **Save schedule codes** - They're the public access key
3. **Use descriptive names** - Make schedules easy to identify
4. **Set correct timezone** - Matches your display location
5. **Order matters** - Use `order` field for same-time items
6. **Date ranges are optional** - Leave null for permanent items
7. **Soft deletes** - Deleted items can be recovered from DB

---

## 🐛 Common Errors

### 400: Invalid time format
```json
{ "startTime": "09:00:00" }  // ✅ Correct
{ "startTime": "9:00" }      // ❌ Wrong (missing leading zero)
{ "startTime": "25:00:00" }  // ❌ Wrong (invalid hour)
```

### 404: Video not found
- Video must exist and belong to your company
- Video must be active (not deleted)

### 403: Permission denied
- Members can only edit their own schedules
- Ensure you have the correct role

### 400: Invalid schedule code
- Code must be exactly 5 characters
- Only use returned codes from creation

---

## 📝 Testing Checklist

- [ ] Create schedule → Get unique code
- [ ] Add video item → Verify it appears
- [ ] View via code → No auth required
- [ ] Update schedule → Changes reflected
- [ ] Delete item → Removed from list
- [ ] Test weekday filter → Only shows on specified days
- [ ] Test date range → Only active in range
- [ ] Share code → Others can view

---

## 🔗 Related Documentation

- **Full Guide**: `SCHEDULE_MODULE_GUIDE.md`
- **Implementation**: `SCHEDULE_IMPLEMENTATION_SUMMARY.md`
- **Video API**: `VIDEO_UPLOAD_GUIDE.md`
- **Auth System**: `AUTHENTICATION.md`

---

## 📞 Support

For issues or questions:
1. Check `SCHEDULE_MODULE_GUIDE.md` for detailed docs
2. Verify database migrations ran: `npx sequelize-cli db:migrate:status`
3. Check server logs for errors
4. Test with curl before implementing in frontend

---

**Happy Scheduling! 🎬**

