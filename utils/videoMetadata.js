/**
 * Video Metadata Extraction Utility
 * Extracts duration, resolution, and other metadata from video files
 * Generates video thumbnails
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('@ffmpeg-installer/ffmpeg');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs').promises;

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extract video metadata including duration and resolution
 * @param {string} filePath - Path to the video file
 * @returns {Promise<Object>} Video metadata
 */
async function extractVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error extracting video metadata:', err);
        return reject(err);
      }

      try {
        // Extract duration (in seconds)
        const duration = metadata.format.duration 
          ? Math.round(metadata.format.duration) 
          : null;

        // Extract video stream information
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        // Extract resolution
        let resolution = null;
        if (videoStream && videoStream.width && videoStream.height) {
          resolution = `${videoStream.width}x${videoStream.height}`;
        }

        // Extract additional metadata
        const result = {
          duration: duration,
          resolution: resolution,
          codec: videoStream?.codec_name || null,
          bitrate: metadata.format.bit_rate ? Math.round(metadata.format.bit_rate / 1000) : null, // in kbps
          fps: videoStream?.r_frame_rate || null,
          format: metadata.format.format_name || null,
        };

        resolve(result);
      } catch (error) {
        console.error('Error parsing video metadata:', error);
        reject(error);
      }
    });
  });
}

/**
 * Format duration in seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "1m 30s", "45s")
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Generate thumbnail from video at a specific timestamp
 * @param {string} videoPath - Path to the video file
 * @param {string} thumbnailPath - Path where thumbnail will be saved
 * @param {Object} options - Options for thumbnail generation
 * @param {string} options.timestamp - Timestamp to capture (e.g., '00:00:02')
 * @param {string} options.size - Thumbnail size (e.g., '320x240')
 * @returns {Promise<string>} Path to generated thumbnail
 */
async function generateThumbnail(videoPath, thumbnailPath, options = {}) {
  const {
    timestamp = '00:00:02', // Default: 2 seconds into video
    size = '320x?', // Width 320, height auto-calculated to maintain aspect ratio
  } = options;

  return new Promise((resolve, reject) => {
    // Ensure thumbnail directory exists
    const thumbnailDir = path.dirname(thumbnailPath);
    
    fs.mkdir(thumbnailDir, { recursive: true })
      .then(() => {
        ffmpeg(videoPath)
          .screenshots({
            timestamps: [timestamp],
            filename: path.basename(thumbnailPath),
            folder: thumbnailDir,
            size: size,
          })
          .on('end', () => {
            console.log('✅ Thumbnail generated:', thumbnailPath);
            resolve(thumbnailPath);
          })
          .on('error', (err) => {
            console.error('❌ Thumbnail generation error:', err);
            reject(err);
          });
      })
      .catch(reject);
  });
}

/**
 * Generate thumbnail from video at percentage of duration
 * @param {string} videoPath - Path to the video file
 * @param {string} thumbnailPath - Path where thumbnail will be saved
 * @param {number} percentage - Percentage of video duration (0-100)
 * @returns {Promise<string>} Path to generated thumbnail
 */
async function generateThumbnailAtPercentage(videoPath, thumbnailPath, percentage = 10) {
  try {
    // First extract duration
    const metadata = await extractVideoMetadata(videoPath);
    const duration = metadata.duration || 10;
    
    // Calculate timestamp (e.g., 10% into the video)
    const seconds = Math.max(1, Math.floor((duration * percentage) / 100));
    const timestamp = formatTimestamp(seconds);

    return await generateThumbnail(videoPath, thumbnailPath, { timestamp });
  } catch (error) {
    console.error('Error generating thumbnail at percentage:', error);
    throw error;
  }
}

/**
 * Format seconds to timestamp format (HH:MM:SS)
 * @param {number} seconds - Seconds
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
  extractVideoMetadata,
  formatDuration,
  generateThumbnail,
  generateThumbnailAtPercentage,
};

