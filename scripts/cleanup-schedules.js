/**
 * Cleanup Script: Remove all schedules from database
 * This script deletes all schedules and schedule items from the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize, Schedule, ScheduleItem } = require('../models');

async function cleanupSchedules() {
  try {
    console.log('🧹 Starting schedule cleanup...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Count existing records
    const scheduleCount = await Schedule.count();
    const scheduleItemCount = await ScheduleItem.count();

    console.log(`📊 Current database state:`);
    console.log(`   - Schedules: ${scheduleCount}`);
    console.log(`   - Schedule Items: ${scheduleItemCount}\n`);

    if (scheduleCount === 0 && scheduleItemCount === 0) {
      console.log('✅ Database is already clean. No schedules to remove.\n');
      process.exit(0);
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete all schedules and schedule items!');
    console.log('⚠️  This action cannot be undone!\n');

    // Delete all schedule items first (due to foreign key constraints)
    console.log('🗑️  Deleting schedule items...');
    const deletedItems = await ScheduleItem.destroy({
      where: {},
      force: true, // Hard delete (bypass soft delete)
    });
    console.log(`   ✅ Deleted ${deletedItems} schedule items\n`);

    // Delete all schedules
    console.log('🗑️  Deleting schedules...');
    const deletedSchedules = await Schedule.destroy({
      where: {},
      force: true, // Hard delete (bypass soft delete)
    });
    console.log(`   ✅ Deleted ${deletedSchedules} schedules\n`);

    // Verify cleanup
    const remainingSchedules = await Schedule.count();
    const remainingItems = await ScheduleItem.count();

    console.log('📊 Final database state:');
    console.log(`   - Schedules: ${remainingSchedules}`);
    console.log(`   - Schedule Items: ${remainingItems}\n`);

    if (remainingSchedules === 0 && remainingItems === 0) {
      console.log('✅ Schedule cleanup completed successfully!\n');
    } else {
      console.log('⚠️  Warning: Some records may still remain in the database.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupSchedules();

