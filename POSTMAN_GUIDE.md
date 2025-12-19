# Postman Collection Guide

## Import the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `postman_collection.json` from this directory
5. Click **Import**

## Setup

### Collection Variables (Auto-configured)

The collection includes these variables that are automatically populated:
- `baseUrl` - API base URL (default: http://localhost:3000)
- `tempToken` - Temporary token after login/registration
- `accessToken` - Access token after company selection
- `refreshToken` - Refresh token for getting new access tokens
- `companyId` - Current company ID
- `userId` - User ID for operations
- `newUserEmail` - Email for new user registration
- `videoId` - Video ID for operations (auto-saved after upload)

### Manual Configuration (Optional)

If you want to use a different server:
1. Click on the collection name
2. Go to **Variables** tab
3. Update `baseUrl` to your server URL

## Usage Flow

### Complete Authentication Flow

Run these requests in order:

#### 1. Register User (Creates Company)
```
POST /api/auth/register
```
Creates a new user and a company (company name is required). Auto-saves `tempToken` and `companyId`.

#### 2. Select Company
```
POST /api/auth/select-company
```
Uses saved `tempToken` and `companyId`. Auto-saves `accessToken` and `refreshToken`.

#### 3. Get Current User Info
```
GET /api/auth/me
```
Shows your user info with company context.

### Alternative: Login Flow (for existing users)

#### 1. Login
```
POST /api/auth/login
```
Returns list of companies. Auto-saves `tempToken` and `companyId`.

#### 2. Select Company
```
POST /api/auth/select-company
```
Same as above.

## User & Company Management Flow

After authentication, you can manage users and company members:

### Option 1: Create User and Add to Company (Recommended)

#### 1. Create User and Add to Company
```
POST /api/users/create
```
Company admin creates a new user account and automatically adds them to the company. Auto-saves their email to `newUserEmail`.

### Option 2: Add Existing User to Company

#### 1. Search for User
```
GET /api/users/search?email=query
```
Search for existing users by email to find their user ID.

#### 2. Add Member to Company
```
POST /api/company/members/add
```
Uses the saved `newUserEmail` to add them to your company.

#### 4. Update Member Role
```
PUT /api/company/members/:userId/role
```
Changes a member's role (requires their userId).

#### 5. Update Member Permissions
```
PUT /api/company/members/:userId/permissions
```
Sets custom permissions for a member.

#### 6. Remove Member
```
DELETE /api/company/members/:userId
```
Removes a member from the company.

## Testing Scenarios

### Scenario 1: Complete Setup
1. **Register User (Creates Company)** - Creates admin user and company
2. **Select Company** - Gets access token
3. **Get Current User** - Verify you're logged in
4. **Get Company Info** - See company details
5. **Get All Members** - Should show just you

### Scenario 2: Add Team Member (Recommended Way)
1. **Create User and Add to Company** - Admin creates user and adds them in one step
2. **Get All Members** - Verify they're added
3. **Update Member Role** - Promote them to admin
4. **Get All Members** - Verify role changed

### Scenario 3: Add Existing User to Company
1. **Search Users by Email** - Find the user you want to add
2. **Add Member by User ID** - Add them using their ID from search results
3. **Get All Members** - Verify they're added

### Scenario 3: Multi-Company User
1. **Login** - Should show all companies
2. **Select Company** - Choose first company
3. **Get Current User** - Shows first company context
4. **Switch Company** - Change to different company
5. **Get Current User** - Shows second company context

### Scenario 4: Video Upload and Management
1. **Upload Video** - Select a video file (max 500MB)
2. **List All Videos** - See all company videos
3. **Get Video Details** - View specific video info
4. **Update Video Metadata** - Change display name or metadata
5. **Delete Video** - Remove video (file + DB record)

### Scenario 5: Token Refresh
1. **Login and Select Company**
2. Wait for access token to expire (24 hours by default)
3. **Refresh Token** - Get new access token
4. **Get Current User** - Should work with new token

## Automated Scripts

The collection includes automated test scripts that:
- Extract and save tokens automatically
- Save user IDs and company IDs
- Set up variables for subsequent requests
- Log important information to console

To see the logs:
1. Open Postman Console (View > Show Postman Console)
2. Run any request
3. See extracted values in console

## Tips

### Use Collection Runner
1. Click on collection name
2. Click **Run** button
3. Select requests to run
4. Click **Run [Collection Name]**
5. All requests run in sequence with saved variables

### Environment Variables
For multiple environments (dev, staging, prod):
1. Create environments in Postman
2. Add `baseUrl` variable to each
3. Switch environments as needed

### Variables Not Saving?
If variables aren't auto-saving:
1. Check **Tests** tab in each request
2. Ensure scripts are executing (check Console)
3. Manually set variables: Collection > Variables

### Common Issues

**401 Unauthorized**
- Token expired → Run **Refresh Token**
- Wrong token type → Run **Select Company** again
- Not logged in → Run **Login** flow

**403 Forbidden**
- Insufficient permissions → Check your role
- Trying to modify yourself → Use different account
- Wrong company context → Switch companies

**404 Not Found**
- User doesn't exist → Register them first
- Wrong userId → Check **Get All Members** for correct ID
- Wrong companyId → Check **Get User Companies**

**409 Conflict**
- Email already registered → Use different email
- User already in company → They're already a member
- Video name already exists → Choose different display name

**400 Bad Request**
- Invalid file type → Only video files allowed
- File too large → Maximum 500MB
- Missing required field → Check request body

## Request Details

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login existing user |
| POST | `/api/auth/select-company` | tempToken | Select company context |
| GET | `/api/auth/me` | accessToken | Get current user info |
| GET | `/api/auth/companies` | accessToken | Get all user's companies |
| POST | `/api/auth/switch-company` | accessToken | Switch to different company |
| POST | `/api/auth/refresh` | refreshToken | Refresh access token |
| POST | `/api/auth/logout` | accessToken | Logout |

### User Management Endpoints

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/api/users/create` | accessToken | owner, admin | Create user and optionally add to company |
| GET | `/api/users/search` | accessToken | owner, admin | Search users by email |

### Company Management Endpoints

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/company/info` | accessToken | All | Get company info |
| PUT | `/api/company/info` | accessToken | owner, admin | Update company info |
| GET | `/api/company/members` | accessToken | All | Get all members |
| POST | `/api/company/members/add` | accessToken | owner, admin | Add member by email |
| POST | `/api/company/members/add-by-id` | accessToken | owner, admin | Add member by ID |
| PUT | `/api/company/members/:userId/role` | accessToken | owner, admin | Update member role |
| PUT | `/api/company/members/:userId/permissions` | accessToken | owner, admin | Update permissions |
| DELETE | `/api/company/members/:userId` | accessToken | owner, admin | Remove member |

### Video Management Endpoints

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/api/videos/upload` | accessToken | owner, admin, manager, member | Upload video file |
| GET | `/api/videos` | accessToken | All | List all company videos |
| GET | `/api/videos/:videoId` | accessToken | All | Get video details |
| GET | `/api/videos/:videoId/download` | accessToken | All | Download/stream video |
| PUT | `/api/videos/:videoId` | accessToken | owner, admin, manager, member* | Update video metadata |
| DELETE | `/api/videos/:videoId` | accessToken | owner, admin, manager, member* | Delete video |
| POST | `/api/videos/bulk-delete` | accessToken | owner, admin, manager, member* | Delete multiple videos |

\*member can only update/delete their own videos

## Example Values

### Roles
- `owner` - Full control
- `admin` - Manage members and settings
- `manager` - Manage resources
- `member` - Standard access
- `viewer` - Read-only access

### Permissions Example
```json
{
  "canManageProducts": true,
  "canViewReports": true,
  "canExportData": false,
  "canManageUsers": false,
  "canViewAnalytics": true
}
```

### Company Info Update Example
```json
{
  "name": "Updated Company Name",
  "description": "New description",
  "website": "https://example.com",
  "email": "contact@example.com",
  "phoneNumber": "+1-555-0123",
  "address": "123 Main St, City, State 12345",
  "logo": "https://example.com/logo.png"
}
```

### Video Upload
**Important:** In Postman, to upload a video:
1. Go to the **Upload Video** request
2. Click on **Body** tab
3. Ensure **form-data** is selected
4. For the `video` field, change type to **File**
5. Click **Select Files** and choose your video
6. (Optional) Update `displayName` field
7. Click **Send**

### Video Metadata Update Example
```json
{
  "fileName": "Updated Video Name",
  "metadata": {
    "category": "tutorial",
    "tags": ["advanced", "demo"],
    "description": "This is an updated description",
    "duration": 300,
    "presenter": "John Doe"
  }
}
```

**Note:** Only video files are accepted. Supported formats: mp4, mpeg, mov, avi, wmv, webm, ogg, 3gpp, flv, mkv. Maximum file size: 500MB.

### Bulk Delete Videos
```json
{
  "videoIds": [
    "video-id-1",
    "video-id-2",
    "video-id-3"
  ]
}
```

**Response includes:**
- `deleted`: Array of successfully deleted videos
- `failed`: Array of failed deletions with reasons
- `summary`: Counts of total, deleted, and failed

**Note:** Maximum 100 videos per request. Each video's permissions are checked individually.

## Advanced Usage

### Chaining Requests
The collection uses test scripts to automatically pass data between requests:

1. **Register** → saves `tempToken`, `companyId`, `userId`
2. **Select Company** → uses `tempToken`, saves `accessToken`
3. **Add Member** → uses `accessToken`, uses `newUserEmail`

### Custom Variables
Add your own variables:
1. Click collection name → Variables
2. Add new variable
3. Use in requests: `{{myVariable}}`

### Pre-request Scripts
Add logic before requests run:
1. Go to request → Pre-request Script tab
2. Add JavaScript code
3. Example: Set dynamic timestamps

### Response Testing
Add assertions to verify responses:
1. Go to request → Tests tab
2. Add test code
3. Example:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});
```

## Video Upload Features

The video upload system includes:
- **Company Isolation**: Each company has its own folder (`videos/{companyId}/`)
- **Unique Names**: No duplicate display names within a company
- **File Validation**: Only video files, max 500MB
- **Automatic Cleanup**: File and DB record deleted together
- **Metadata Storage**: Store custom JSON metadata with videos
- **Role-Based Access**: Different permissions for different roles

### Testing Video Upload in Postman

1. **Ensure you're authenticated**:
   - Run Login → Select Company flow
   - Verify `accessToken` is set

2. **Upload a video**:
   - Open "Upload Video" request
   - Body → form-data
   - Click "video" row → change to "File" → Select video
   - Update "displayName" if desired
   - Send

3. **View uploaded videos**:
   - Run "List All Videos"
   - Copy a video ID from response
   - Paste into `videoId` variable

4. **Manage videos**:
   - Use saved `videoId` for Get/Update/Delete operations

## Support

For API documentation, see:
- `AUTHENTICATION.md` - Authentication system
- `VIDEO_UPLOAD_GUIDE.md` - Complete video upload guide
- `VIDEO_API_QUICK_REFERENCE.md` - Quick video API reference
- `QUICKSTART.md` - Setup guide
- `IMPLEMENTATION_SUMMARY.md` - Complete overview

## File Location

The collection JSON file is located at:
```
/workspaces/dsScreenBackend/postman_collection.json
```

Import this file directly into Postman to get started!

