# Schedule Module Documentation

## Overview

The Schedule Module allows companies to create video playlists with timeline-based scheduling. Each schedule has a unique 5-character code that enables public viewing without authentication.

## Features

✅ **Timeline-based scheduling** - Schedule videos to play at specific times  
✅ **Multiple schedules per company** - Create unlimited schedules  
✅ **Public access via code** - Share schedules using unique 5-character codes  
✅ **Day-specific scheduling** - Set videos to play on specific days of the week  
✅ **Date range support** - Schedule items for specific date ranges  
✅ **Company isolation** - Each company's schedules are completely isolated  
✅ **Role-based access control** - Editing requires company membership  

---

## Database Schema

### Schedules Table
```sql
schedules (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL (Foreign Key → companies.id),
  created_by UUID NOT NULL (Foreign Key → users.id),
  name VARCHAR NOT NULL,
  description TEXT,
  code VARCHAR(5) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  timezone VARCHAR DEFAULT 'UTC',
  settings JSONB DEFAULT {},
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Schedule Items Table
```sql
schedule_items (
  id UUID PRIMARY KEY,
  schedule_id UUID NOT NULL (Foreign Key → schedules.id),
  video_id UUID NOT NULL (Foreign Key → videos.id),
  start_time TIME NOT NULL,
  duration INTEGER NOT NULL (seconds),
  day_of_week INTEGER[] (0=Sunday, 6=Saturday, null=every day),
  start_date DATE (optional),
  end_date DATE (optional),
  order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT {},
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## API Endpoints

### 1. Create Schedule

**POST** `/api/schedules`

Create a new schedule with a unique 5-character code.

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member`

**Request Body**:
```json
{
  "name": "Main Display Schedule",
  "description": "Schedule for lobby display",
  "timezone": "America/New_York",
  "settings": {
    "loop": true,
    "autoStart": true
  }
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Schedule created successfully",
  "data": {
    "id": "uuid",
    "name": "Main Display Schedule",
    "description": "Schedule for lobby display",
    "code": "Ab3Xy",
    "timezone": "America/New_York",
    "settings": { "loop": true, "autoStart": true },
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 2. List All Schedules

**GET** `/api/schedules`

Get all schedules for your company.

**Authentication**: Required (Bearer Token)  
**Roles**: All authenticated users

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "id": "uuid",
        "name": "Main Display Schedule",
        "description": "Schedule for lobby display",
        "code": "Ab3Xy",
        "timezone": "America/New_York",
        "settings": {},
        "isActive": true,
        "itemCount": 5,
        "creator": {
          "id": "uuid",
          "email": "user@example.com",
          "name": "John Doe"
        },
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "count": 1
  }
}
```

---

### 3. Get Schedule by ID

**GET** `/api/schedules/:scheduleId`

Get detailed information about a specific schedule including all items.

**Authentication**: Required (Bearer Token)  
**Roles**: All authenticated users

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Main Display Schedule",
    "description": "Schedule for lobby display",
    "code": "Ab3Xy",
    "timezone": "America/New_York",
    "settings": {},
    "isActive": true,
    "creator": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "items": [
      {
        "id": "uuid",
        "startTime": "09:00:00",
        "duration": 30,
        "dayOfWeek": [1, 2, 3, 4, 5],
        "startDate": null,
        "endDate": null,
        "order": 0,
        "metadata": {},
        "video": {
          "id": "uuid",
          "fileName": "Morning Ad",
          "fileSize": 5242880,
          "mimeType": "video/mp4",
          "duration": 30
        },
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 4. Get Schedule by Code (Public Access)

**GET** `/api/schedules/public/:code`

View a schedule using its public code. **NO AUTHENTICATION REQUIRED**.

**Authentication**: None  
**Roles**: Public access

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/schedules/public/Ab3Xy
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Main Display Schedule",
    "description": "Schedule for lobby display",
    "code": "Ab3Xy",
    "timezone": "America/New_York",
    "settings": {},
    "company": {
      "name": "Acme Corp",
      "logo": "https://example.com/logo.png"
    },
    "items": [
      {
        "id": "uuid",
        "startTime": "09:00:00",
        "duration": 30,
        "dayOfWeek": null,
        "startDate": null,
        "endDate": null,
        "order": 0,
        "metadata": {},
        "video": {
          "id": "uuid",
          "fileName": "Morning Ad",
          "fileSize": 5242880,
          "mimeType": "video/mp4",
          "duration": 30
        }
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 5. Update Schedule

**PUT** `/api/schedules/:scheduleId`

Update schedule details.

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member` (creator only for members)

**Request Body**:
```json
{
  "name": "Updated Schedule Name",
  "description": "Updated description",
  "timezone": "America/Los_Angeles",
  "settings": { "loop": false },
  "isActive": true
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Schedule updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Schedule Name",
    "description": "Updated description",
    "code": "Ab3Xy",
    "timezone": "America/Los_Angeles",
    "settings": { "loop": false },
    "isActive": true,
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### 6. Delete Schedule

**DELETE** `/api/schedules/:scheduleId`

Soft delete a schedule (sets `isActive` to false).

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member` (creator only for members)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Schedule deleted successfully",
  "data": {
    "id": "uuid",
    "name": "Main Display Schedule",
    "deletedAt": "2024-01-15T12:00:00Z"
  }
}
```

---

### 7. Add Item to Schedule

**POST** `/api/schedules/:scheduleId/items`

Add a video to the schedule timeline.

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member`

**Request Body**:
```json
{
  "videoId": "uuid",
  "startTime": "09:00:00",
  "duration": 30,
  "dayOfWeek": [1, 2, 3, 4, 5],
  "startDate": "2024-01-15",
  "endDate": "2024-12-31",
  "order": 0,
  "metadata": {
    "transition": "fade",
    "volume": 80
  }
}
```

**Field Descriptions**:
- `videoId` (required): UUID of the video to schedule
- `startTime` (required): Time in HH:MM or HH:MM:SS format (24-hour)
- `duration` (required): Duration in seconds
- `dayOfWeek` (optional): Array of days (0=Sunday, 6=Saturday). Null = every day
- `startDate` (optional): Start date for this item (YYYY-MM-DD)
- `endDate` (optional): End date for this item (YYYY-MM-DD)
- `order` (optional): Display order for items with same start time
- `metadata` (optional): Custom metadata object

**Success Response** (201):
```json
{
  "success": true,
  "message": "Schedule item added successfully",
  "data": {
    "id": "uuid",
    "startTime": "09:00:00",
    "duration": 30,
    "dayOfWeek": [1, 2, 3, 4, 5],
    "startDate": "2024-01-15",
    "endDate": "2024-12-31",
    "order": 0,
    "metadata": {
      "transition": "fade",
      "volume": 80
    },
    "video": {
      "id": "uuid",
      "fileName": "Morning Ad",
      "fileSize": 5242880,
      "mimeType": "video/mp4",
      "duration": 30
    },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 8. Update Schedule Item

**PUT** `/api/schedules/:scheduleId/items/:itemId`

Update a schedule item.

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member`

**Request Body** (all fields optional):
```json
{
  "videoId": "uuid",
  "startTime": "10:00:00",
  "duration": 45,
  "dayOfWeek": [1, 3, 5],
  "startDate": "2024-02-01",
  "endDate": null,
  "order": 1,
  "metadata": { "volume": 90 }
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Schedule item updated successfully",
  "data": {
    "id": "uuid",
    "startTime": "10:00:00",
    "duration": 45,
    "dayOfWeek": [1, 3, 5],
    "startDate": "2024-02-01",
    "endDate": null,
    "order": 1,
    "metadata": { "volume": 90 },
    "video": { ... },
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### 9. Delete Schedule Item

**DELETE** `/api/schedules/:scheduleId/items/:itemId`

Remove a video from the schedule (soft delete).

**Authentication**: Required (Bearer Token)  
**Roles**: `owner`, `admin`, `manager`, `member`

**Success Response** (200):
```json
{
  "success": true,
  "message": "Schedule item deleted successfully",
  "data": {
    "id": "uuid",
    "deletedAt": "2024-01-15T12:00:00Z"
  }
}
```

---

## Usage Examples

### Example 1: Create a Daily Schedule

```javascript
// 1. Create schedule
const scheduleResponse = await fetch('http://localhost:3000/api/schedules', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Daily Ads',
    description: 'Main advertising schedule',
    timezone: 'America/New_York'
  })
});

const { data: schedule } = await scheduleResponse.json();
console.log('Schedule Code:', schedule.code); // e.g., "Ab3Xy"

// 2. Add morning video (9 AM, 30 seconds)
await fetch(`http://localhost:3000/api/schedules/${schedule.id}/items`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'video-uuid-1',
    startTime: '09:00:00',
    duration: 30
  })
});

// 3. Add afternoon video (2 PM, 60 seconds, weekdays only)
await fetch(`http://localhost:3000/api/schedules/${schedule.id}/items`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'video-uuid-2',
    startTime: '14:00:00',
    duration: 60,
    dayOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
  })
});
```

### Example 2: View Schedule Publicly

```javascript
// Anyone can view the schedule using the code (no authentication)
const publicResponse = await fetch('http://localhost:3000/api/schedules/public/Ab3Xy');
const { data } = await publicResponse.json();

console.log('Schedule:', data.name);
console.log('Items:', data.items.length);
data.items.forEach(item => {
  console.log(`- ${item.video.fileName} at ${item.startTime} for ${item.duration}s`);
});
```

### Example 3: Weekend Special Schedule

```javascript
// Add a video that only plays on weekends
await fetch(`http://localhost:3000/api/schedules/${scheduleId}/items`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoId: 'weekend-video-uuid',
    startTime: '10:00:00',
    duration: 120,
    dayOfWeek: [0, 6], // Sunday and Saturday
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  })
});
```

---

## Schedule Code Format

- **Length**: Exactly 5 characters
- **Characters**: Alphanumeric (uppercase, lowercase, numbers)
- **Excluded**: Confusing characters (0, O, o, I, l, 1) are excluded
- **Example**: `Ab3Xy`, `Mn7Qw`, `Rt5Zk`

---

## Permission Model

### Creating/Listing Schedules
- **owner**, **admin**, **manager**, **member**: Can create and list schedules

### Editing Schedules
- **owner**, **admin**, **manager**: Can edit any schedule in the company
- **member**: Can only edit schedules they created

### Deleting Schedules
- **owner**, **admin**, **manager**: Can delete any schedule in the company
- **member**: Can only delete schedules they created

### Public Viewing
- **Anyone** with the code can view the schedule (no authentication required)

---

## Best Practices

1. **Use descriptive names** - Make schedule names clear and meaningful
2. **Set timezone correctly** - Ensure the timezone matches your display location
3. **Test schedules** - Use the public URL to verify schedule appearance
4. **Organize by purpose** - Create separate schedules for different screens/purposes
5. **Use day-specific scheduling** - Leverage `dayOfWeek` for weekday/weekend variations
6. **Set date ranges** - Use `startDate` and `endDate` for seasonal campaigns
7. **Keep codes secure** - Only share schedule codes with intended viewers

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Start time must be in HH:MM or HH:MM:SS format",
      "param": "startTime"
    }
  ]
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Schedule not found"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "You do not have permission to update this schedule"
}
```

---

## Frontend Integration Tips

### Display Public Schedule
```javascript
// Embed in a digital signage display
async function loadSchedule(code) {
  const response = await fetch(`/api/schedules/public/${code}`);
  const { data } = await response.json();
  
  // Get current time and find what should be playing
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 8);
  const currentDay = now.getDay();
  
  const activeItem = data.items.find(item => {
    // Check day of week (if specified)
    if (item.dayOfWeek && !item.dayOfWeek.includes(currentDay)) {
      return false;
    }
    
    // Check if current time matches
    return item.startTime <= currentTime;
  });
  
  if (activeItem) {
    playVideo(activeItem.video);
  }
}
```

---

## Summary

The Schedule Module provides a complete solution for managing video playlists with timeline-based scheduling. Key features include:

✅ Timeline-based video scheduling  
✅ Public access via unique codes  
✅ Day-specific and date-range scheduling  
✅ Company isolation and role-based access  
✅ RESTful API with comprehensive validation  

For support or questions, refer to the main API documentation.

