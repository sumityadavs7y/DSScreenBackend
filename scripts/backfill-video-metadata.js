/**
 * Backfill Video Metadata Script
 * Extracts and updates metadata for existing videos that don't have duration/resolution
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Video } = require('../models');
const { extractVideoMetadata } = require('../utils/videoMetadata');
const fs = require('fs').promises;

async function backfillVideoMetadata() {
  try {
    console.log('🎬 Starting video metadata backfill...\n');

    // Find all videos without duration
    const videosWithoutMetadata = await Video.findAll({
      where: {
        isActive: true,
      },
    });

    console.log(`📊 Found ${videosWithoutMetadata.length} videos to process\n`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const video of videosWithoutMetadata) {
      try {
        // Skip if video already has duration
        if (video.duration !== null) {
          console.log(`⏭️  Skipping "${video.fileName}" - already has metadata`);
          skipped++;
          continue;
        }

        // Check if file exists
        const fullPath = path.join(process.cwd(), video.filePath);
        try {
          await fs.access(fullPath);
        } catch (err) {
          console.log(`❌ File not found: "${video.fileName}" at ${video.filePath}`);
          failed++;
          continue;
        }

        // Extract metadata
        console.log(`🔄 Processing: "${video.fileName}"...`);
        const metadata = await extractVideoMetadata(fullPath);

        // Update video record
        await video.update({
          duration: metadata.duration,
          resolution: metadata.resolution,
          metadata: {
            ...video.metadata,
            codec: metadata.codec,
            bitrate: metadata.bitrate,
            fps: metadata.fps,
            format: metadata.format,
          },
        });

        console.log(`   ✅ Updated: ${metadata.duration}s, ${metadata.resolution || 'N/A'}`);
        updated++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failed++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (updated > 0) {
      console.log('✅ Video metadata backfill completed successfully!\n');
    } else {
      console.log('ℹ️  No videos needed metadata updates.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during metadata backfill:', error);
    process.exit(1);
  }
}

// Run backfill
backfillVideoMetadata();










