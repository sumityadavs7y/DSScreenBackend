/**
 * Cleanup Videos with Missing S3 Files
 * 
 * This script finds video records in the database where the S3 file is missing
 * and marks them as inactive or deletes them.
 */

require('dotenv').config();
const { Video } = require('./models');
const { s3FileExists } = require('./utils/s3Storage');

async function cleanupMissingS3Files() {
  try {
    console.log('🔍 Checking for videos with missing S3 files...\n');

    // Find all active videos
    const activeVideos = await Video.findAll({
      where: {
        isActive: true,
      },
      attributes: ['id', 'fileName', 'filePath', 'companyId'],
    });

    console.log(`Found ${activeVideos.length} active video(s) in database\n`);

    const missingFiles = [];
    let checked = 0;

    for (const video of activeVideos) {
      checked++;
      process.stdout.write(`\rChecking ${checked}/${activeVideos.length}...`);

      if (!video.filePath) {
        missingFiles.push(video);
        continue;
      }

      const exists = await s3FileExists(video.filePath);
      if (!exists) {
        missingFiles.push(video);
      }
    }

    console.log('\n');

    if (missingFiles.length === 0) {
      console.log('✅ All active videos have their S3 files!');
      process.exit(0);
    }

    console.log(`\n⚠️  Found ${missingFiles.length} video(s) with missing S3 files:\n`);
    console.log('═'.repeat(80));
    missingFiles.forEach((video, index) => {
      console.log(`${index + 1}. ID: ${video.id}`);
      console.log(`   Name: ${video.fileName}`);
      console.log(`   S3 Path: ${video.filePath || '(empty)'}`);
      console.log(`   Company: ${video.companyId}`);
      console.log('─'.repeat(80));
    });

    // Delete these orphaned records
    console.log('\n🗑️  Deleting orphaned records...\n');

    const deletedIds = missingFiles.map(v => v.id);
    const deleted = await Video.destroy({
      where: {
        id: deletedIds,
      },
      force: true, // Hard delete
    });

    console.log(`✅ Successfully deleted ${deleted} orphaned record(s)!\n`);
    console.log('💡 These videos had database records but no S3 files.');
    console.log('   This usually happens when:');
    console.log('   - S3 delete succeeded but database update failed');
    console.log('   - Files were manually deleted from S3');
    console.log('   - Upload failed after creating database record\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupMissingS3Files();

