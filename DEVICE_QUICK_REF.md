# Device Registration - Quick Reference Card

## 📋 Quick Facts

- **Endpoint**: `POST /api/schedules/device/register`
- **Access**: Public (no auth)
- **Purpose**: Register device & get schedule
- **Database**: `devices` table with JSONB device_info
- **Tracking**: Device count, last seen, flexible info

---

## 🚀 Register Device

```bash
POST /api/schedules/device/register
Content-Type: application/json

{
  "scheduleCode": "Ab3Xy",        # Required, 5 chars
  "uid": "DEVICE-001",            # Required, unique ID
  "deviceInfo": {                 # Optional, any JSON
    "resolution": "1920x1080",
    "location": "Lobby Display"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device registered successfully",
  "device": {
    "id": "uuid",
    "uid": "DEVICE-001",
    "lastSeen": "2024-01-15T10:00:00Z",
    "registered": true  // true = new, false = updated
  },
  "schedule": {
    "id": "uuid",
    "name": "Main Schedule",
    "code": "Ab3Xy",
    "items": [...]  // Videos to play
  }
}
```

---

## 💻 JavaScript Client

```javascript
// Register and get schedule
const response = await fetch('/api/schedules/device/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleCode: "Ab3Xy",
    uid: "DEVICE-001",
    deviceInfo: {
      resolution: screen.width + 'x' + screen.height,
      location: "Lobby Display"
    }
  })
});

const { schedule } = await response.json();

// Play videos
schedule.items.forEach(item => {
  const videoUrl = `/api/videos/${item.video.id}/download`;
  playVideo(videoUrl, item.startTime, item.duration);
});

// Heartbeat every 5 minutes
setInterval(async () => {
  await fetch('/api/schedules/device/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduleCode: "Ab3Xy",
      uid: "DEVICE-001"
    })
  });
}, 5 * 60 * 1000);
```

---

## 📊 Device Count

Both schedule endpoints now include device count:

```bash
# Authenticated
GET /api/schedules/:scheduleId
Authorization: Bearer {token}

# Public
GET /api/schedules/public/:code
```

**Response includes**:
```json
{
  "data": {
    "deviceCount": 5,  // ← NEW FIELD
    ...
  }
}
```

---

## 🎯 Workflow

### Admin
1. Create schedule → Get code "Ab3Xy"
2. Share code with devices
3. View device count on schedule

### Device
1. Register with code
2. Get schedule details
3. Play videos
4. Heartbeat every 5 min

---

## 📁 Device Info Examples

**Minimal**:
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "DEVICE-001"
}
```

**Basic**:
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "DEVICE-001",
  "deviceInfo": {
    "location": "Lobby"
  }
}
```

**Detailed**:
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "DEVICE-001",
  "deviceInfo": {
    "resolution": "1920x1080",
    "os": "Android 12",
    "location": "Store Display 1",
    "model": "Samsung",
    "ip": "192.168.1.100"
  }
}
```

---

## 🧪 Test Commands

```bash
# First registration
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{"scheduleCode":"Ab3Xy","uid":"TEST-001"}'

# Update device
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{"scheduleCode":"Ab3Xy","uid":"TEST-001","deviceInfo":{"status":"updated"}}'

# Check device count
curl http://localhost:3000/api/schedules/public/Ab3Xy
```

---

## 🔑 Key Points

- ✅ **No auth required** - Public endpoint
- ✅ **One call** - Register & get schedule
- ✅ **Flexible info** - JSONB accepts any data
- ✅ **Auto-update** - Re-register updates device
- ✅ **Unique per schedule** - One UID per schedule
- ✅ **Track activity** - lastSeen timestamp
- ✅ **Device count** - Shown on schedule

---

## 📚 Full Docs

- `DEVICE_REGISTRATION.md` - Complete guide
- `DEVICE_REGISTRATION_SUMMARY.md` - Implementation summary
- `DEVICE_MODULE_COMPLETE.md` - Full overview
- `SCHEDULE_MODULE_GUIDE.md` - Schedule system

---

## ✅ Status Codes

- `201` - Device registered (first time)
- `200` - Device updated (existing)
- `400` - Invalid request
- `404` - Schedule not found

---

**Ready to deploy! 🚀**

