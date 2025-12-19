# Device Registration Feature

## ✅ Feature Overview

Devices (digital signage displays, kiosks, tablets, etc.) can now register to schedules using the unique 5-character schedule code. This enables automatic content delivery and device tracking.

---

## 🎯 How It Works

### Registration Flow

1. **Device has schedule code** (e.g., "Ab3Xy")
2. **Device calls registration endpoint** with UID and optional info
3. **System registers device** and returns full schedule details
4. **Device plays content** from the schedule
5. **System tracks** device activity (last seen)

---

## 📊 Database Schema

### Devices Table

```sql
devices (
  id UUID PRIMARY KEY,
  schedule_id UUID NOT NULL (Foreign Key → schedules.id),
  uid VARCHAR NOT NULL (Unique device identifier),
  device_info JSONB DEFAULT {} (Flexible device information),
  last_seen TIMESTAMP NOT NULL (Last check-in time),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(schedule_id, uid) -- One device per schedule
)
```

### Device Info (JSONB)

The `device_info` field is flexible and can store any device-specific information:

```json
{
  "resolution": "1920x1080",
  "os": "Android 12",
  "browser": "Chrome 98",
  "location": "Lobby Display 1",
  "model": "Samsung Smart Display",
  "ip": "192.168.1.100",
  "version": "1.0.5",
  "custom_field": "any value"
}
```

---

## 🌍 API Endpoint

### POST `/api/schedules/device/register`

**PUBLIC ENDPOINT** - No authentication required

Register a device to a schedule and get schedule details.

**Request Body**:
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "device-mac-address-or-serial",
  "deviceInfo": {
    "resolution": "1920x1080",
    "os": "Android 12",
    "location": "Lobby Display",
    "model": "Samsung Smart Display"
  }
}
```

**Parameters**:
- `scheduleCode` (required, string, 5 chars) - Schedule code
- `uid` (required, string) - Unique device identifier
- `deviceInfo` (optional, object) - Any device information

**Success Response** (201 Created - First Registration):
```json
{
  "success": true,
  "message": "Device registered successfully",
  "device": {
    "id": "device-uuid",
    "uid": "device-mac-address",
    "lastSeen": "2024-01-15T10:00:00Z",
    "registered": true
  },
  "schedule": {
    "id": "schedule-uuid",
    "name": "Lobby Display Schedule",
    "description": "Main lobby content",
    "code": "Ab3Xy",
    "timezone": "America/New_York",
    "settings": {},
    "company": {
      "name": "Acme Corp",
      "logo": "https://example.com/logo.png"
    },
    "items": [
      {
        "id": "item-uuid",
        "startTime": "09:00:00",
        "duration": 1800,
        "dayOfWeek": [1,2,3,4,5],
        "startDate": null,
        "endDate": null,
        "order": 0,
        "metadata": {},
        "video": {
          "id": "video-uuid",
          "fileName": "Morning Ad",
          "fileSize": 5242880,
          "mimeType": "video/mp4",
          "duration": 30,
          "resolution": "1920x1080"
        }
      }
    ],
    "createdAt": "2024-01-15T09:00:00Z",
    "updatedAt": "2024-01-15T09:00:00Z"
  }
}
```

**Success Response** (200 OK - Update Existing):
```json
{
  "success": true,
  "message": "Device updated successfully",
  "device": {
    "id": "device-uuid",
    "uid": "device-mac-address",
    "lastSeen": "2024-01-15T10:05:00Z",
    "registered": false
  },
  "schedule": { ... }
}
```

---

## 🧪 Usage Examples

### Example 1: Simple Device Registration

```javascript
// Device startup code
const scheduleCode = "Ab3Xy"; // From QR code or config
const deviceUID = "AA:BB:CC:DD:EE:FF"; // MAC address

const response = await fetch('http://localhost:3000/api/schedules/device/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scheduleCode: scheduleCode,
    uid: deviceUID
  })
});

const { device, schedule } = await response.json();
console.log('Registered to:', schedule.name);
console.log('Videos to play:', schedule.items.length);
```

### Example 2: Registration with Device Info

```javascript
// Collect device information
const deviceInfo = {
  resolution: `${screen.width}x${screen.height}`,
  os: navigator.platform,
  browser: navigator.userAgent,
  location: "Store Front Display",
  version: "1.0.0"
};

const response = await fetch('http://localhost:3000/api/schedules/device/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scheduleCode: "Ab3Xy",
    uid: "DEVICE-12345",
    deviceInfo: deviceInfo
  })
});

const { schedule } = await response.json();

// Play videos from schedule
schedule.items.forEach(item => {
  const videoUrl = `/api/videos/${item.video.id}/download`;
  scheduleVideo(item.startTime, videoUrl, item.duration);
});
```

### Example 3: Periodic Check-In

```javascript
// Update device status every 5 minutes
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/schedules/device/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scheduleCode: "Ab3Xy",
      uid: deviceUID,
      deviceInfo: {
        lastUpdate: new Date().toISOString(),
        status: "playing"
      }
    })
  });
  
  const { schedule } = await response.json();
  // Check for schedule updates
  updatePlaylist(schedule.items);
}, 5 * 60 * 1000); // Every 5 minutes
```

### Example 4: Android Device

```java
// Android device registration
JSONObject requestBody = new JSONObject();
requestBody.put("scheduleCode", "Ab3Xy");
requestBody.put("uid", Settings.Secure.getString(
    getContentResolver(), 
    Settings.Secure.ANDROID_ID
));

JSONObject deviceInfo = new JSONObject();
deviceInfo.put("os", "Android " + Build.VERSION.RELEASE);
deviceInfo.put("model", Build.MODEL);
deviceInfo.put("manufacturer", Build.MANUFACTURER);
requestBody.put("deviceInfo", deviceInfo);

// Make HTTP POST request...
```

---

## 📊 Device Count in Schedule

Schedule endpoints now include device count:

### GET `/api/schedules/:scheduleId` (Authenticated)

```json
{
  "success": true,
  "data": {
    "id": "schedule-uuid",
    "name": "Lobby Display",
    "code": "Ab3Xy",
    "deviceCount": 5,  // ← NEW FIELD
    "items": [...],
    ...
  }
}
```

### GET `/api/schedules/public/:code` (Public)

```json
{
  "success": true,
  "data": {
    "id": "schedule-uuid",
    "name": "Lobby Display",
    "code": "Ab3Xy",
    "deviceCount": 5,  // ← NEW FIELD
    "items": [...],
    ...
  }
}
```

---

## 🎯 Use Cases

### 1. Digital Signage Network

```
Admin creates schedule → Gets code "Ab3Xy"
↓
Installs displays in 10 locations
↓
Each display registers with code "Ab3Xy"
↓
All displays show same content
↓
Admin sees "10 devices connected"
```

### 2. Retail Store Displays

```javascript
// Each display has unique UID
const displays = [
  { uid: "FRONT-WINDOW", location: "Front Window" },
  { uid: "CHECKOUT-1", location: "Checkout Counter 1" },
  { uid: "CHECKOUT-2", location: "Checkout Counter 2" }
];

displays.forEach(display => {
  registerDevice("Ab3Xy", display.uid, {
    location: display.location
  });
});
```

### 3. Mobile Kiosks

```javascript
// Tablet or mobile device
const deviceUID = await getDeviceId();
const location = await getCurrentLocation();

registerDevice("Ab3Xy", deviceUID, {
  type: "mobile",
  location: location,
  battery: await getBatteryLevel()
});
```

---

## 🔄 Device Lifecycle

### Registration
```
Device → POST /device/register
  ↓
System creates device record
  ↓
Returns schedule details
```

### Check-In (Heartbeat)
```
Device → POST /device/register (same UID)
  ↓
System updates lastSeen timestamp
  ↓
System updates deviceInfo
  ↓
Returns updated schedule
```

### Deactivation
```
Device doesn't check in for X days
  ↓
Admin can manually deactivate
  ↓
Device no longer counted
```

---

## 🔒 Security Considerations

### What's Required

✅ **Schedule Code** - 5-character code (hard to guess, but shareable)  
✅ **Device UID** - Unique identifier per device  

### What's Protected

✅ **Schedule must be active** - Inactive schedules can't be accessed  
✅ **One device per UID per schedule** - Prevents duplicates  
✅ **Device info is flexible** - Can store any JSON data  

### Best Practices

1. **Use unique UIDs** - MAC address, serial number, UUID
2. **Include location** - Helps identify devices
3. **Regular check-ins** - Update lastSeen periodically
4. **Version tracking** - Include app version in deviceInfo
5. **Error handling** - Handle network failures gracefully

---

## 📱 Device Info Examples

### Minimal (Required Only)
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "DEVICE-001"
}
```

### Basic
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "AA:BB:CC:DD:EE:FF",
  "deviceInfo": {
    "location": "Lobby Display"
  }
}
```

### Detailed
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "ANDROID-12345",
  "deviceInfo": {
    "resolution": "1920x1080",
    "os": "Android 12",
    "browser": "Chrome 98",
    "location": "Store Front - Display 1",
    "model": "Samsung Smart Display",
    "manufacturer": "Samsung",
    "ip": "192.168.1.100",
    "version": "1.0.5",
    "orientation": "landscape",
    "touchscreen": true
  }
}
```

### With Status
```json
{
  "scheduleCode": "Ab3Xy",
  "uid": "KIOSK-789",
  "deviceInfo": {
    "location": "Mall Kiosk 3",
    "status": "playing",
    "currentVideo": "video-uuid",
    "uptime": 86400,
    "battery": 85,
    "lastError": null
  }
}
```

---

## 🧪 Testing

### Test 1: First Registration
```bash
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleCode": "Ab3Xy",
    "uid": "TEST-DEVICE-001",
    "deviceInfo": {
      "location": "Test Display"
    }
  }'

# Response: 201 Created
# Message: "Device registered successfully"
# device.registered: true
```

### Test 2: Update Existing
```bash
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleCode": "Ab3Xy",
    "uid": "TEST-DEVICE-001",
    "deviceInfo": {
      "location": "Test Display",
      "status": "updated"
    }
  }'

# Response: 200 OK
# Message: "Device updated successfully"
# device.registered: false
# lastSeen: updated timestamp
```

### Test 3: Invalid Code
```bash
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleCode": "INVALID",
    "uid": "TEST-DEVICE-001"
  }'

# Response: 404 Not Found
# Message: "Schedule not found or inactive"
```

---

## 📊 Monitoring Devices

### Check Device Count

```bash
# Get schedule with device count
GET /api/schedules/:scheduleId
# Response includes: "deviceCount": 5
```

### Future: Device List Endpoint (Not Implemented)

Potential future endpoint:
```
GET /api/schedules/:scheduleId/devices
```

Would return:
```json
{
  "devices": [
    {
      "id": "device-uuid",
      "uid": "DEVICE-001",
      "deviceInfo": {...},
      "lastSeen": "2024-01-15T10:00:00Z",
      "isActive": true
    }
  ]
}
```

---

## ✨ Benefits

### For Administrators
✅ **Track connected devices** - See how many displays are active  
✅ **Monitor activity** - Last seen timestamps  
✅ **Flexible device info** - Store any relevant data  
✅ **Easy deployment** - Just share the code  

### For Devices
✅ **Simple registration** - One API call  
✅ **No authentication** - Public endpoint  
✅ **Get schedule immediately** - One response with everything  
✅ **Update anytime** - Re-register to update info  

### For System
✅ **Automatic tracking** - Devices self-register  
✅ **Scalable** - Handle unlimited devices  
✅ **Flexible** - JSONB supports any device type  
✅ **Efficient** - Unique constraint prevents duplicates  

---

## 🎬 Complete Workflow

### Setup
```
1. Admin creates schedule
2. Admin gets code: "Ab3Xy"
3. Admin shares code with devices
```

### Device Side
```javascript
// Device startup
const schedule = await registerDevice("Ab3Xy", deviceUID, deviceInfo);

// Play videos
schedule.items.forEach(item => {
  playVideo(item.video.id, item.startTime, item.duration);
});

// Periodic check-in
setInterval(() => {
  registerDevice("Ab3Xy", deviceUID, { status: "active" });
}, 5 * 60 * 1000);
```

### Admin Side
```
1. View schedule
2. See "5 devices connected"
3. Monitor device activity
```

---

## 📚 Related Documentation

- **Schedule Module**: `SCHEDULE_MODULE_GUIDE.md`
- **Public Video Access**: `PUBLIC_VIDEO_ACCESS.md`
- **Schedule Quick Reference**: `SCHEDULE_QUICK_REFERENCE.md`

---

## ✅ Summary

**Feature**: Device Registration  
**Endpoint**: `POST /api/schedules/device/register`  
**Access**: Public (no auth)  
**Purpose**: Register devices to schedules  
**Returns**: Full schedule details  
**Tracking**: Device count, last seen, device info  

**Your devices can now self-register and play content! 🎬**

