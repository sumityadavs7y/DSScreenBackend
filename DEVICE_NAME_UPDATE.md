# Device Name Feature - Update

## ✅ Overview

Devices now have friendly names that are **auto-generated** during registration and can be **updated** by admins. This makes it easier to identify and manage devices.

---

## 🎯 What's New

### 1. Auto-Generated Device Names
When a device registers to a schedule, it automatically receives a friendly name like:
- "Blue Screen"
- "Swift Display"
- "Gold Monitor"
- "Fresh Kiosk"

**Format**: `{Adjective} {Noun}`

### 2. Update Device Name API
Admins can update device names to make them more meaningful:
- "Front Window Display"
- "Checkout Counter 1"
- "Mall Entrance Kiosk"

---

## 📊 Database Schema

### Added Field to `devices` Table

```sql
ALTER TABLE devices ADD COLUMN name VARCHAR(255);
-- Friendly name for the device (auto-generated or user-defined)
```

**Migration**: `20240101000008-add-device-name.js` ✅ Applied

---

## 🌍 API Endpoints

### 1. Register Device (Enhanced)
```http
POST /api/schedules/device/register
Content-Type: application/json

{
  "scheduleCode": "Ab3Xy",
  "uid": "DEVICE-001",
  "deviceInfo": {
    "location": "Lobby Display"
  }
}
```

**Response** (Now includes `name`):
```json
{
  "success": true,
  "message": "Device registered successfully",
  "device": {
    "id": "device-uuid",
    "uid": "DEVICE-001",
    "name": "Blue Screen",  // ← AUTO-GENERATED!
    "lastSeen": "2024-01-15T10:00:00Z",
    "registered": true
  },
  "schedule": { ... }
}
```

### 2. Update Device Name (NEW)
```http
PUT /api/schedules/device/:deviceId/name
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Front Window Display"
}
```

**Request Parameters**:
- `deviceId` (path, required) - Device UUID
- `name` (body, required) - New device name (1-100 characters)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Device name updated successfully",
  "data": {
    "id": "device-uuid",
    "uid": "DEVICE-001",
    "name": "Front Window Display",
    "lastSeen": "2024-01-15T10:00:00Z",
    "schedule": {
      "id": "schedule-uuid",
      "name": "Main Schedule"
    }
  }
}
```

**Error Responses**:

**400 Bad Request** - Invalid device ID or validation error:
```json
{
  "success": false,
  "message": "Invalid device ID format"
}
```

**404 Not Found** - Device not found or doesn't belong to your company:
```json
{
  "success": false,
  "message": "Device not found or does not belong to your company"
}
```

---

## 🎯 How It Works

### Auto-Generation on Registration

```javascript
// When device registers
POST /api/schedules/device/register
{
  "scheduleCode": "Ab3Xy",
  "uid": "MAC-ADDRESS"
}

// System auto-generates name
device.name = generateDeviceName(); // "Swift Display"

// Returns in response
{
  "device": {
    "name": "Swift Display"  // Auto-generated
  }
}
```

### Update by Admin

```javascript
// Admin updates name
PUT /api/schedules/device/{deviceId}/name
{
  "name": "Lobby Main Display"
}

// System verifies ownership
- Device must belong to a schedule
- Schedule must belong to admin's company
- Only then update is allowed

// Returns updated device
{
  "data": {
    "name": "Lobby Main Display"  // Updated
  }
}
```

---

## 💡 Name Generation Algorithm

### Adjectives (16 options)
```
Blue, Red, Green, Gold, Silver, Swift, Bright, Smart,
Cool, Fast, Bold, Calm, Warm, Clear, Fresh, Quick
```

### Nouns (14 options)
```
Screen, Display, Panel, Monitor, Viewer, Board, Sign,
Kiosk, Terminal, Device, Player, Unit, Station, Hub
```

### Total Combinations
16 × 14 = **224 possible names**

### Examples
- "Blue Screen"
- "Swift Display"
- "Gold Kiosk"
- "Fresh Terminal"
- "Bold Monitor"
- "Quick Player"

**Note**: Names are **not unique** by design. Multiple devices can have the same auto-generated name, which is why admins can update them.

---

## 🧪 Testing

### Test 1: Auto-Generated Name on Registration
```bash
curl -X POST http://localhost:3000/api/schedules/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleCode": "Ab3Xy",
    "uid": "TEST-001"
  }'
```

**Expected**:
- Status: 201 Created
- Response includes `device.name` with auto-generated value
- Example: "Blue Screen", "Swift Display", etc.

### Test 2: Update Device Name
```bash
curl -X PUT http://localhost:3000/api/schedules/device/{deviceId}/name \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Front Window Display"
  }'
```

**Expected**:
- Status: 200 OK
- Response shows updated name

### Test 3: Invalid Device ID
```bash
curl -X PUT http://localhost:3000/api/schedules/device/invalid-id/name \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test"
  }'
```

**Expected**:
- Status: 400 Bad Request
- Error: "Invalid device ID format"

### Test 4: Device from Another Company
```bash
# Try to update device belonging to another company
curl -X PUT http://localhost:3000/api/schedules/device/{other-device-id}/name \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test"
  }'
```

**Expected**:
- Status: 404 Not Found
- Error: "Device not found or does not belong to your company"

---

## 💻 Usage Examples

### JavaScript - Display Device Names
```javascript
// Register device
const response = await fetch('/api/schedules/device/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleCode: "Ab3Xy",
    uid: "DEVICE-001"
  })
});

const { device } = await response.json();
console.log(`Device registered as: ${device.name}`);
// Output: "Device registered as: Blue Screen"
```

### Admin - Update Device Name
```javascript
// Admin updates device name
async function updateDeviceName(deviceId, newName) {
  const response = await fetch(
    `/api/schedules/device/${deviceId}/name`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    }
  );
  
  const result = await response.json();
  console.log(`Device renamed to: ${result.data.name}`);
}

// Usage
updateDeviceName("device-uuid", "Lobby Main Display");
// Output: "Device renamed to: Lobby Main Display"
```

### React Component Example
```jsx
function DeviceList({ devices }) {
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  
  const updateName = async (deviceId) => {
    const response = await fetch(
      `/api/schedules/device/${deviceId}/name`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      }
    );
    
    if (response.ok) {
      // Refresh device list
      fetchDevices();
      setEditingId(null);
    }
  };
  
  return (
    <div>
      {devices.map(device => (
        <div key={device.id}>
          {editingId === device.id ? (
            <input 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={() => updateName(device.id)}
            />
          ) : (
            <span onClick={() => {
              setEditingId(device.id);
              setNewName(device.name);
            }}>
              {device.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 Use Cases

### 1. Device Dashboard
```
Display all devices with their friendly names:
- "Lobby Main Display"
- "Checkout Counter 1"
- "Checkout Counter 2"
- "Front Window Display"
```

### 2. Device Identification
```
Instead of: "AA:BB:CC:DD:EE:FF"
Show: "Lobby Main Display"
```

### 3. Auto-Generated Names for Quick Setup
```
Device registers → Gets "Blue Screen"
Admin can keep it or change to "Store Entrance"
```

### 4. Location-Based Naming
```
Auto: "Swift Display"
Updated: "Mall - Level 2 - East Wing"
```

---

## 🔒 Security & Validation

### Update Endpoint Security
✅ **Authentication Required** - Must have valid access token  
✅ **Company Verification** - Device must belong to your company's schedule  
✅ **Role-Based Access** - owner, admin, manager, member roles allowed  

### Validation Rules
- **Name Length**: 1-100 characters
- **Name Required**: Cannot be empty
- **Device ID**: Must be valid UUID
- **Ownership**: Device must belong to user's company

---

## 📁 Files Created/Modified

### New Files
- ✅ `utils/deviceName.js` - Name generation utility
- ✅ `migrations/20240101000008-add-device-name.js` - Migration
- ✅ `DEVICE_NAME_UPDATE.md` - This documentation

### Modified Files
- ✅ `models/Device.js` - Added `name` field
- ✅ `routes/schedule.js` - Updated registration, added update endpoint
- ✅ `postman_collection.json` - Added update device name request

---

## 📊 Postman Collection

### New Request
**Name**: "Update Device Name"  
**Method**: PUT  
**URL**: `{{baseUrl}}/api/schedules/device/{{deviceId}}/name`  
**Auth**: Bearer Token  
**Body**:
```json
{
  "name": "Lobby Display - Main"
}
```

### Variables Used
- `{{baseUrl}}` - API base URL
- `{{deviceId}}` - Device UUID (auto-captured from registration)
- `{{accessToken}}` - Authentication token

---

## ✨ Benefits

### For Devices
✅ **Immediate Identity** - Get friendly name on registration  
✅ **No Manual Setup** - Auto-generated, no extra API call needed  
✅ **Works Without Update** - Name is optional, device works either way  

### For Admins
✅ **Easy Identification** - Meaningful names instead of UIDs  
✅ **Flexible Naming** - Update names anytime  
✅ **Location Tracking** - Name devices by location  
✅ **Better Management** - Organize devices by name  

### For System
✅ **No Breaking Changes** - Existing devices work without names  
✅ **Simple Algorithm** - Fast name generation  
✅ **Non-Unique** - No need for uniqueness checks  
✅ **Updateable** - Flexible naming scheme  

---

## 🔄 Workflow

### Device Registration with Auto-Name
```
1. Device calls /device/register
2. System generates random name: "Blue Screen"
3. Device gets name in response
4. Device can display: "Registered as Blue Screen"
```

### Admin Updates Name
```
1. Admin views device list
2. Sees device: "Blue Screen" (UID: AA:BB:CC:DD:EE:FF)
3. Updates name to: "Lobby Main Display"
4. Device keeps working, now identified as "Lobby Main Display"
```

---

## 📚 Related Documentation

- **Device Registration**: `DEVICE_REGISTRATION.md`
- **Device Module**: `DEVICE_MODULE_COMPLETE.md`
- **Schedule Module**: `SCHEDULE_MODULE_GUIDE.md`

---

## ✅ Summary

**Feature**: Device Name (Auto-Generated & Updateable)  
**Auto-Generation**: On device registration  
**Format**: "{Adjective} {Noun}" (e.g., "Blue Screen")  
**Update Endpoint**: `PUT /api/schedules/device/:deviceId/name`  
**Access**: Admin only (authenticated)  
**Validation**: 1-100 characters, non-empty  
**Uniqueness**: Not required (multiple devices can have same name)  

**Your devices now have friendly names! 🎉**

