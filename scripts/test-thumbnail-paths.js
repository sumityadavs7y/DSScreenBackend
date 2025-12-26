/**
 * Test Thumbnail Paths
 * Verifies that thumbnails are accessible
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Video } = require('../models');

async function testThumbnailPaths() {
  try {
    console.log('🖼️  Testing thumbnail paths...\n');

    const videos = await Video.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });

    console.log(`Found ${videos.length} videos\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const video of videos) {
      console.log(`📄 ${video.fileName}`);
      console.log(`   DB Path: ${video.thumbnailPath || 'N/A'}`);
      
      if (video.thumbnailPath) {
        const fullPath = path.join(process.cwd(), video.thumbnailPath);
        const exists = fs.existsSync(fullPath);
        const urlPath = `/${video.thumbnailPath}`;
        
        console.log(`   File Exists: ${exists ? '✅' : '❌'}`);
        console.log(`   URL Path: ${urlPath}`);
        
        if (exists) {
          const stats = fs.statSync(fullPath);
          console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`);
        }
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Thumbnail path test complete!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testThumbnailPaths();








