const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const { s3Config } = require('../config');

/**
 * Initialize S3 client with Signature Version 4
 * Required for regions like ap-south-1, eu-central-1, etc.
 */
const s3 = new AWS.S3({
  region: s3Config.region,
  accessKeyId: s3Config.accessKeyId,
  secretAccessKey: s3Config.secretAccessKey,
  signatureVersion: 'v4', // Use AWS Signature Version 4 (required for newer regions)
});

/**
 * Generate S3 key for video file
 * Format: <env>_<company_name>_<company_id>_<video_id>.<ext>
 * @param {string} env - Environment (prod/dev)
 * @param {string} companyName - Company name (sanitized)
 * @param {string} companyId - Company UUID
 * @param {string} videoId - Video UUID
 * @param {string} ext - File extension (with dot)
 * @returns {string} S3 key
 */
const generateS3Key = (env, companyName, companyId, videoId, ext) => {
  // Sanitize company name for S3 key
  const sanitizedCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return `videos/${env}_${sanitizedCompanyName}_${companyId}_${videoId}${ext}`;
};

/**
 * Generate S3 key for thumbnail
 * Format: thumbnails/<env>_<company_name>_<company_id>_<video_id>_thumb.jpg
 * @param {string} env - Environment (prod/dev)
 * @param {string} companyName - Company name (sanitized)
 * @param {string} companyId - Company UUID
 * @param {string} videoId - Video UUID
 * @returns {string} S3 key for thumbnail
 */
const generateThumbnailS3Key = (env, companyName, companyId, videoId) => {
  const sanitizedCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return `thumbnails/${env}_${sanitizedCompanyName}_${companyId}_${videoId}_thumb.jpg`;
};

/**
 * Upload file to S3
 * @param {string} localFilePath - Path to local file
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} S3 upload result
 */
const uploadToS3 = async (localFilePath, s3Key, contentType) => {
  try {
    const fileContent = fs.readFileSync(localFilePath);
    
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    };
    
    const result = await s3.upload(params).promise();
    console.log(`✅ Uploaded to S3: ${s3Key}`);
    return result;
  } catch (error) {
    console.error(`❌ S3 upload failed for ${s3Key}:`, error);
    throw error;
  }
};

/**
 * Upload buffer to S3
 * @param {Buffer} buffer - File buffer
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} S3 upload result
 */
const uploadBufferToS3 = async (buffer, s3Key, contentType) => {
  try {
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    };
    
    const result = await s3.upload(params).promise();
    console.log(`✅ Uploaded buffer to S3: ${s3Key}`);
    return result;
  } catch (error) {
    console.error(`❌ S3 buffer upload failed for ${s3Key}:`, error);
    throw error;
  }
};

/**
 * Delete file from S3
 * @param {string} s3Key - S3 key (path in bucket)
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteFromS3 = async (s3Key) => {
  try {
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
    };
    
    await s3.deleteObject(params).promise();
    console.log(`✅ Deleted from S3: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`❌ S3 delete failed for ${s3Key}:`, error);
    return false;
  }
};

/**
 * Get signed URL for video streaming/download
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {string} Signed URL
 */
const getSignedUrl = (s3Key, expiresIn = 3600) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
    Expires: expiresIn,
  };
  
  return s3.getSignedUrl('getObject', params);
};

/**
 * Generate pre-signed URL for direct upload to S3
 * CORS Workaround: Don't include ContentType in signature to avoid preflight issues
 * S3 will infer content type from file extension or we can update it server-side after upload
 * @param {string} s3Key - S3 key (path in bucket)  
 * @param {string} contentType - MIME type of the file (for reference, not used in signature)
 * @param {number} expiresIn - URL expiration time in seconds (default: 15 minutes)
 * @returns {Object} Pre-signed URL and fields
 */
const getUploadSignedUrl = (s3Key, contentType, expiresIn = 900) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
    // DO NOT include ContentType - it causes CORS preflight issues with browsers
    // S3 will infer content type from file extension (.mp4 -> video/mp4)
    Expires: expiresIn,
  };
  
  const signedUrl = s3.getSignedUrl('putObject', params);
  
  return {
    url: signedUrl,
    key: s3Key,
    bucket: s3Config.bucket,
    contentType: contentType, // Return for reference only
  };
};

/**
 * Generate pre-signed POST for direct upload to S3 (alternative method)
 * This method is more flexible and allows setting additional conditions
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {string} contentType - MIME type of the file
 * @param {number} maxSizeBytes - Maximum file size in bytes
 * @param {number} expiresIn - URL expiration time in seconds (default: 15 minutes)
 * @returns {Promise<Object>} Pre-signed POST data
 */
const getUploadPresignedPost = (s3Key, contentType, maxSizeBytes, expiresIn = 900) => {
  const params = {
    Bucket: s3Config.bucket,
    Fields: {
      key: s3Key,
      'Content-Type': contentType,
    },
    Expires: expiresIn,
    Conditions: [
      ['content-length-range', 0, maxSizeBytes],
      ['eq', '$Content-Type', contentType],
    ],
  };
  
  return new Promise((resolve, reject) => {
    s3.createPresignedPost(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

/**
 * Download file from S3 to local path
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {string} localFilePath - Local path to save file
 * @returns {Promise<void>}
 */
const downloadFromS3 = async (s3Key, localFilePath) => {
  try {
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
    };
    
    const data = await s3.getObject(params).promise();
    fs.writeFileSync(localFilePath, data.Body);
    console.log(`✅ Downloaded from S3: ${s3Key} to ${localFilePath}`);
  } catch (error) {
    console.error(`❌ S3 download failed for ${s3Key}:`, error);
    throw error;
  }
};

/**
 * Get file stream from S3
 * @param {string} s3Key - S3 key (path in bucket)
 * @returns {Stream} Readable stream
 */
const getS3Stream = (s3Key) => {
  const params = {
    Bucket: s3Config.bucket,
    Key: s3Key,
  };
  
  return s3.getObject(params).createReadStream();
};

/**
 * Get file metadata from S3
 * @param {string} s3Key - S3 key (path in bucket)
 * @returns {Promise<Object>} File metadata
 */
const getS3Metadata = async (s3Key) => {
  try {
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
    };
    
    const metadata = await s3.headObject(params).promise();
    return metadata;
  } catch (error) {
    console.error(`❌ Failed to get S3 metadata for ${s3Key}:`, error);
    throw error;
  }
};

/**
 * Check if file exists in S3
 * @param {string} s3Key - S3 key (path in bucket)
 * @returns {Promise<boolean>} True if file exists
 */
const s3FileExists = async (s3Key) => {
  try {
    await getS3Metadata(s3Key);
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Get S3 object with range support for streaming
 * @param {string} s3Key - S3 key (path in bucket)
 * @param {string} range - Range header value (e.g., "bytes=0-1023")
 * @returns {Promise<Object>} S3 object data with range
 */
const getS3ObjectRange = async (s3Key, range) => {
  try {
    const params = {
      Bucket: s3Config.bucket,
      Key: s3Key,
      Range: range,
    };
    
    return await s3.getObject(params).promise();
  } catch (error) {
    console.error(`❌ Failed to get S3 object range for ${s3Key}:`, error);
    throw error;
  }
};

module.exports = {
  generateS3Key,
  generateThumbnailS3Key,
  uploadToS3,
  uploadBufferToS3,
  deleteFromS3,
  getSignedUrl,
  getUploadSignedUrl,
  getUploadPresignedPost,
  downloadFromS3,
  getS3Stream,
  getS3Metadata,
  s3FileExists,
  getS3ObjectRange,
};

