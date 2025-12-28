/**
 * Cleanup Orphaned Upload Records
 * 
 * This script deletes inactive video records from the database.
 * These are typically left behind when uploads fail or are interrupted.
 */

require('dotenv').config();
const { Video } = require('./models');

async function cleanupOrphanedUploads() {
  try {
    console.log('🧹 Starting cleanup of orphaned upload records...\n');

    // Find all inactive videos
    const inactiveVideos = await Video.findAll({
      where: {
        isActive: false,
      },
      attributes: ['id', 'fileName', 'companyId', 'createdAt'],
    });

    console.log(`Found ${inactiveVideos.length} inactive video record(s)\n`);

    if (inactiveVideos.length === 0) {
      console.log('✅ No orphaned records to clean up!');
      process.exit(0);
    }

    // Show what will be deleted
    console.log('Records to be deleted:');
    console.log('═'.repeat(80));
    inactiveVideos.forEach((video, index) => {
      console.log(`${index + 1}. ID: ${video.id}`);
      console.log(`   Name: ${video.fileName}`);
      console.log(`   Company: ${video.companyId}`);
      console.log(`   Created: ${video.createdAt}`);
      console.log('─'.repeat(80));
    });

    // Delete them
    const deleted = await Video.destroy({
      where: {
        isActive: false,
      },
      force: true, // Hard delete
    });

    console.log(`\n✅ Successfully deleted ${deleted} orphaned record(s)!`);
    console.log('\n💡 Tip: These records are automatically cleaned up when new uploads use the same filename.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupOrphanedUploads();

