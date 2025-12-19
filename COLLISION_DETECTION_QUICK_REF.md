# Collision Detection - Quick Reference

## 🎯 When Does It Check?

✅ **Adding** a new schedule item  
✅ **Updating** an existing schedule item  
❌ **NOT** when deleting items

---

## 🔍 What Does It Check?

### Three Dimensions (ALL must overlap for conflict):

1. **⏰ Time** - Start/end times overlap
2. **📅 Days** - Videos play on same days of week
3. **📆 Dates** - Active date ranges intersect

---

## ⚠️ Conflict Examples

### ❌ Time Overlap
```
Video 1: 09:00 for 30min (ends 09:30)
Video 2: 09:10 for 30min (ends 09:40)
→ CONFLICT (9:10-9:30 overlaps)
```

### ❌ End Time Overlap
```
Video 1: 09:00 for 30min (ends 09:30)
Video 2: 08:45 for 30min (ends 09:15)
→ CONFLICT (9:00-9:15 overlaps)
```

### ❌ Every Day Overlap
```
Video 1: 09:00 [Mon, Wed, Fri]
Video 2: 09:00 [null = every day]
→ CONFLICT (includes Mon, Wed, Fri)
```

---

## ✅ No Conflict Examples

### ✅ Back-to-Back
```
Video 1: 09:00-09:30
Video 2: 09:30-10:00
→ OK (no overlap)
```

### ✅ Different Days
```
Video 1: 09:00 [Mon-Fri]
Video 2: 09:00 [Sat-Sun]
→ OK (different days)
```

### ✅ Different Dates
```
Video 1: 09:00 [Jan 1-31]
Video 2: 09:00 [Feb 1-28]
→ OK (different months)
```

---

## 🚫 Error Response

```json
HTTP 409 Conflict

{
  "success": false,
  "message": "Schedule conflict detected...",
  "conflict": {
    "newItem": { ... },
    "conflictingItems": [ ... ]
  }
}
```

---

## 🧪 Quick Tests

### Test Collision
```bash
# Add video at 9:00
POST /api/schedules/{id}/items
{ "videoId": "...", "startTime": "09:00:00", "duration": 1800 }

# Try to add at 9:10 (should fail)
POST /api/schedules/{id}/items
{ "videoId": "...", "startTime": "09:10:00", "duration": 1800 }
# → 409 Conflict
```

### Test Different Days
```bash
# Add weekday video
POST /api/schedules/{id}/items
{ "videoId": "...", "startTime": "09:00:00", "duration": 1800, "dayOfWeek": [1,2,3,4,5] }

# Add weekend video (should succeed)
POST /api/schedules/{id}/items
{ "videoId": "...", "startTime": "09:00:00", "duration": 1800, "dayOfWeek": [0,6] }
# → 201 Created
```

---

## 💡 Tips

✅ **Plan time slots** before adding videos  
✅ **Use day filters** for same-time different-day content  
✅ **Use date ranges** for seasonal campaigns  
✅ **Back-to-back is OK** (9:00-9:30, then 9:30-10:00)  
✅ **Check error details** when you get 409  

---

## 🔒 Database Safety

All operations use **transactions**:
- ✅ Atomic operations
- ✅ Auto-rollback on conflict
- ✅ No partial updates
- ✅ Consistent state guaranteed

---

## 📚 Full Documentation

See `SCHEDULE_COLLISION_DETECTION.md` for:
- Detailed examples
- Algorithm explanation
- Testing scenarios
- Troubleshooting guide

---

**Collision detection is automatic - no configuration needed!** 🎬

