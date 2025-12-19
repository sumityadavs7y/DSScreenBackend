/**
 * Cleanup Orphaned Video Files
 * 
 * This script finds and removes video files that exist on the filesystem
 * but don't have corresponding active records in the database.
 * 
 * Usage: node scripts/cleanup-orphaned-videos.js [--dry-run]
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Video } = require('../models');
const { sequelize } = require('../models/sequelize');

const VIDEO_BASE_DIR = path.join(__dirname, '..', 'videos');

async function getAllVideoFiles() {
  const videoFiles = [];
  
  try {
    const companies = await fs.readdir(VIDEO_BASE_DIR);
    
    for (const companyId of companies) {
      if (companyId.startsWith('.')) continue; // Skip hidden files
      
      const companyDir = path.join(VIDEO_BASE_DIR, companyId);
      const stat = await fs.stat(companyDir);
      
      if (!stat.isDirectory()) continue;
      
      const files = await fs.readdir(companyDir);
      
      for (const file of files) {
        if (file.startsWith('.')) continue;
        
        const filePath = path.join('videos', companyId, file);
        const fullPath = path.join(VIDEO_BASE_DIR, companyId, file);
        const fileStats = await fs.stat(fullPath);
        
        videoFiles.push({
          companyId,
          fileName: file,
          relativePath: filePath,
          fullPath,
          size: fileStats.size,
        });
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Videos directory does not exist yet.');
      return [];
    }
    throw error;
  }
  
  return videoFiles;
}

async function getActiveVideosFromDB() {
  const videos = await Video.findAll({
    where: { isActive: true },
    attributes: ['id', 'companyId', 'fileName', 'filePath'],
  });
  
  return videos;
}

async function cleanupOrphanedFiles(dryRun = false) {
  console.log('🔍 Scanning for orphaned video files...\n');
  
  // Connect to database
  await sequelize.authenticate();
  console.log('✅ Database connected\n');
  
  // Get all files from filesystem
  const filesOnDisk = await getAllVideoFiles();
  console.log(`📁 Found ${filesOnDisk.length} video files on disk\n`);
  
  if (filesOnDisk.length === 0) {
    console.log('✨ No video files found. Nothing to clean up.');
    return;
  }
  
  // Get all active videos from database
  const videosInDB = await getActiveVideosFromDB();
  console.log(`📊 Found ${videosInDB.length} active videos in database\n`);
  
  // Create a Set of file paths that should exist
  const validFilePaths = new Set(
    videosInDB.map(v => v.filePath.replace(/\\/g, '/'))
  );
  
  // Find orphaned files
  const orphanedFiles = filesOnDisk.filter(file => {
    const normalizedPath = file.relativePath.replace(/\\/g, '/');
    return !validFilePaths.has(normalizedPath);
  });
  
  if (orphanedFiles.length === 0) {
    console.log('✨ No orphaned files found. Everything is clean!');
    return;
  }
  
  console.log(`⚠️  Found ${orphanedFiles.length} orphaned file(s):\n`);
  
  let totalSize = 0;
  orphanedFiles.forEach((file, index) => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    totalSize += file.size;
    console.log(`${index + 1}. ${file.relativePath}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Company: ${file.companyId}\n`);
  });
  
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`💾 Total size of orphaned files: ${totalSizeMB} MB\n`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files were deleted');
    console.log('   Run without --dry-run to actually delete these files');
    return;
  }
  
  // Delete orphaned files
  console.log('🗑️  Deleting orphaned files...\n');
  
  let deletedCount = 0;
  let failedCount = 0;
  
  for (const file of orphanedFiles) {
    try {
      await fs.unlink(file.fullPath);
      console.log(`✅ Deleted: ${file.relativePath}`);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Failed to delete ${file.relativePath}: ${error.message}`);
      failedCount++;
    }
  }
  
  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   Total orphaned files: ${orphanedFiles.length}`);
  console.log(`   Successfully deleted: ${deletedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Space freed: ${totalSizeMB} MB`);
}

// Run the script
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode\n');
}

cleanupOrphanedFiles(dryRun)
  .then(() => {
    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  });

