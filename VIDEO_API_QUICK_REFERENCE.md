# Video API Quick Reference

## Base URL
```
http://localhost:3000/api/videos
```

## Authentication
All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Endpoints Summary

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/upload` | Upload a video | owner, admin, manager, member |
| GET | `/` | List all company videos | All |
| GET | `/:videoId` | Get video details | All |
| GET | `/:videoId/download` | Download/stream video | All |
| PUT | `/:videoId` | Update video metadata | owner, admin, manager, member* |
| DELETE | `/:videoId` | Delete a video | owner, admin, manager, member* |
| POST | `/bulk-delete` | Delete multiple videos | owner, admin, manager, member* |

*member can only update/delete their own videos

## Quick Examples

### Upload
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "video=@video.mp4" \
  -F "displayName=My Video"
```

### List
```bash
curl http://localhost:3000/api/videos \
  -H "Authorization: Bearer TOKEN"
```

### Download/Stream
```bash
curl http://localhost:3000/api/videos/VIDEO_ID/download \
  -H "Authorization: Bearer TOKEN" \
  -o video.mp4
```

### Delete
```bash
curl -X DELETE http://localhost:3000/api/videos/VIDEO_ID \
  -H "Authorization: Bearer TOKEN"
```

### Bulk Delete
```bash
curl -X POST http://localhost:3000/api/videos/bulk-delete \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoIds":["id1","id2","id3"]}'
```

## Key Features

✅ Company-specific storage (videos/{companyId}/)
✅ Automatic folder creation
✅ Duplicate name prevention
✅ Role-based access control
✅ File size limit: 500MB
✅ Video-only file validation
✅ Automatic file & DB cleanup on delete

## Common Response Codes

- `200` - Success
- `201` - Created (upload)
- `400` - Bad request (validation error, wrong file type)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `409` - Conflict (duplicate name)
- `500` - Server error

## Storage Structure

```
videos/
  └── {company-uuid}/
      ├── video1_timestamp.mp4
      ├── video2_timestamp.mp4
      └── ...
```

## Database

Videos metadata stored in `videos` table with:
- UUID primary key
- Company ID (isolated)
- File name (display name - unique per company)
- File path, size, MIME type
- Uploader info
- Timestamps

For full documentation, see: [VIDEO_UPLOAD_GUIDE.md](./VIDEO_UPLOAD_GUIDE.md)

