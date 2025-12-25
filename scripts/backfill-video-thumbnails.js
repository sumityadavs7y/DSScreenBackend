/**
 * Backfill Video Thumbnails Script
 * Generates thumbnails for existing videos that don't have them
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Video } = require('../models');
const { generateThumbnailAtPercentage } = require('../utils/videoMetadata');
const fs = require('fs').promises;

async function backfillVideoThumbnails() {
  try {
    console.log('🖼️  Starting video thumbnail backfill...\n');

    // Find all videos without thumbnails
    const videosWithoutThumbnails = await Video.findAll({
      where: {
        isActive: true,
        thumbnailPath: null,
      },
    });

    console.log(`📊 Found ${videosWithoutThumbnails.length} videos without thumbnails\n`);

    if (videosWithoutThumbnails.length === 0) {
      console.log('✅ All videos already have thumbnails!\n');
      process.exit(0);
    }

    let generated = 0;
    let failed = 0;

    for (const video of videosWithoutThumbnails) {
      try {
        // Check if video file exists
        const videoFullPath = path.join(process.cwd(), video.filePath);
        try {
          await fs.access(videoFullPath);
        } catch (err) {
          console.log(`❌ Video file not found: "${video.fileName}" at ${video.filePath}`);
          failed++;
          continue;
        }

        // Generate thumbnail filename and path
        const videoFilename = path.basename(video.filePath);
        const thumbnailFilename = `${path.basename(videoFilename, path.extname(videoFilename))}_thumb.jpg`;
        
        // Extract company ID from file path (videos/companyId/filename)
        const pathParts = video.filePath.split(path.sep);
        const companyId = pathParts[1];
        
        const thumbnailFullPath = path.join(process.cwd(), 'videos', companyId, 'thumbnails', thumbnailFilename);
        const thumbnailRelativePath = path.join('videos', companyId, 'thumbnails', thumbnailFilename);

        // Generate thumbnail at 10% of video duration
        console.log(`🔄 Generating thumbnail for: "${video.fileName}"...`);
        await generateThumbnailAtPercentage(videoFullPath, thumbnailFullPath, 10);

        // Update video record
        await video.update({
          thumbnailPath: thumbnailRelativePath,
        });

        console.log(`   ✅ Thumbnail generated: ${thumbnailFilename}`);
        generated++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failed++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`   ✅ Generated: ${generated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (generated > 0) {
      console.log('✅ Video thumbnail backfill completed successfully!\n');
    } else {
      console.log('ℹ️  No thumbnails were generated.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during thumbnail backfill:', error);
    process.exit(1);
  }
}

// Run backfill
backfillVideoThumbnails();



