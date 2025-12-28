# S3 Video Storage - Naming Convention Quick Reference

## Video Files

### Format
```
videos/<env>_<company_name>_<company_id>_<video_id>.<ext>
```

### Components
| Component | Description | Example |
|-----------|-------------|---------|
| `<env>` | Environment (prod/dev) | `prod` |
| `<company_name>` | Sanitized company name | `acme_corp` |
| `<company_id>` | Company UUID | `11284805-3de9-4d70-ae8c-51d169641bdd` |
| `<video_id>` | Video UUID | `a1b2c3d4-5678-90ab-cdef-1234567890ab` |
| `<ext>` | File extension | `.mp4` |

### Example
```
videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab.mp4
```

## Thumbnail Files

### Format
```
thumbnails/<env>_<company_name>_<company_id>_<video_id>_thumb.jpg
```

### Example
```
thumbnails/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab_thumb.jpg
```

## Company Name Sanitization Rules

The company name is sanitized as follows:
1. Convert to lowercase
2. Replace non-alphanumeric characters with underscore
3. Replace multiple consecutive underscores with single underscore
4. Remove leading/trailing underscores

### Examples

| Original Name | Sanitized Name |
|---------------|----------------|
| Acme Corp | `acme_corp` |
| ABC Company Ltd. | `abc_company_ltd` |
| Test & Demo Co. | `test_demo_co` |
| 123-Tech Solutions! | `123_tech_solutions` |
| My___Company | `my_company` |

## Environment Detection

The environment prefix is determined by the `ENV_MODE` environment variable:

```javascript
const env = process.env.ENV_MODE === 'production' ? 'prod' : 'dev';
```

| ENV_MODE | Prefix |
|----------|--------|
| `production` | `prod` |
| `development` | `dev` |
| (any other) | `dev` |

## Benefits of This Convention

### 1. Traceability
Easily identify which video belongs to which company just by looking at the filename.

### 2. Environment Separation
Clearly distinguish between production and development videos.

### 3. No Conflicts
UUIDs ensure no naming conflicts even if companies have similar names.

### 4. Searchable
Easy to search and filter in S3 console:
- All videos for a company: `videos/prod_acme_corp_*`
- All production videos: `videos/prod_*`
- All development videos: `videos/dev_*`

### 5. Debugging
When investigating issues, the filename provides immediate context about:
- Which environment the video is in
- Which company it belongs to
- The unique identifiers for both company and video

## S3 Console Search Examples

### Find all videos for a specific company
```
videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_
```

### Find all production videos
```
videos/prod_
```

### Find all videos for a specific video ID
```
_a1b2c3d4-5678-90ab-cdef-1234567890ab.
```

### Find all thumbnails for a company
```
thumbnails/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_
```

## Code Reference

The naming convention is implemented in `/utils/s3Storage.js`:

```javascript
const generateS3Key = (env, companyName, companyId, videoId, ext) => {
  const sanitizedCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return `videos/${env}_${sanitizedCompanyName}_${companyId}_${videoId}${ext}`;
};
```

## Database Storage

The S3 keys are stored in the database:

```javascript
// Video model
{
  filePath: "videos/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab.mp4",
  thumbnailPath: "thumbnails/prod_acme_corp_11284805-3de9-4d70-ae8c-51d169641bdd_a1b2c3d4-5678-90ab-cdef-1234567890ab_thumb.jpg"
}
```

## Migration Considerations

When migrating existing videos from local storage to S3:

1. **Preserve video IDs**: Use existing video UUIDs from the database
2. **Fetch company info**: Join with Company table to get company name
3. **Determine environment**: Use current `ENV_MODE` or specify explicitly
4. **Generate new S3 keys**: Use the naming convention
5. **Update database**: Store new S3 keys in `filePath` and `thumbnailPath`

## Best Practices

1. ✅ Always use the utility functions to generate S3 keys
2. ✅ Never hardcode S3 keys
3. ✅ Store S3 keys in database for reference
4. ✅ Use consistent environment naming (prod/dev)
5. ✅ Validate company names before sanitization
6. ✅ Log S3 operations for debugging

## Troubleshooting

### Video not found in S3
1. Check the S3 key in the database
2. Verify the key format matches the convention
3. Search S3 console using the pattern
4. Check if video was uploaded successfully

### Naming conflicts
This should never happen due to UUID usage, but if it does:
1. Verify video ID is unique
2. Check for duplicate database records
3. Review S3 upload logs

### Company name issues
If company name contains special characters:
1. Check sanitization logic
2. Verify underscores are properly handled
3. Ensure no leading/trailing underscores

