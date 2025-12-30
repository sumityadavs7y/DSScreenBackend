// /**
//  * Cleanup Registration Sessions Script
//  * 
//  * This script cleans up expired registration sessions from the database.
//  * Run this periodically via cron job or scheduler.
//  * 
//  * Usage:
//  *   node scripts/cleanup-registration-sessions.js
//  *   node scripts/cleanup-registration-sessions.js --dry-run
//  */

// require('dotenv').config();
// const { RegistrationSession, sequelize } = require('../models');
// const { Op } = require('sequelize');

// const isDryRun = process.argv.includes('--dry-run');

// async function cleanupExpiredSessions() {
//   try {
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('🧹 Registration Sessions Cleanup Script');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '✅ LIVE'}`);
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

//     const now = new Date();

//     // Find expired sessions
//     const expiredSessions = await RegistrationSession.findAll({
//       where: {
//         status: 'pending',
//         expiresAt: {
//           [Op.lt]: now,
//         },
//       },
//     });

//     console.log(`📊 Found ${expiredSessions.length} expired pending sessions\n`);

//     if (expiredSessions.length === 0) {
//       console.log('✅ No expired sessions to clean up');
//       return;
//     }

//     // Display sessions to be cleaned
//     console.log('📋 Sessions to be marked as expired:');
//     expiredSessions.forEach((session, index) => {
//       const expiredAgo = Math.floor((now - new Date(session.expiresAt)) / 1000 / 60);
//       console.log(`  ${index + 1}. Session: ${session.sessionToken}`);
//       console.log(`     Device: ${session.deviceId}`);
//       console.log(`     Expired: ${expiredAgo} minutes ago`);
//       console.log(`     Created: ${session.createdAt}`);
//       console.log('');
//     });

//     if (isDryRun) {
//       console.log('🔍 DRY RUN - No changes made to database');
//       console.log(`\nTo actually clean up these sessions, run without --dry-run flag`);
//       return;
//     }

//     // Update expired sessions
//     const [updateCount] = await RegistrationSession.update(
//       { status: 'expired' },
//       {
//         where: {
//           status: 'pending',
//           expiresAt: {
//             [Op.lt]: now,
//           },
//         },
//       }
//     );

//     console.log(`✅ Successfully marked ${updateCount} sessions as expired\n`);

//     // Optionally delete old completed/expired sessions (older than 24 hours)
//     const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
//     const oldSessions = await RegistrationSession.findAll({
//       where: {
//         status: {
//           [Op.in]: ['completed', 'expired', 'cancelled'],
//         },
//         updatedAt: {
//           [Op.lt]: oneDayAgo,
//         },
//       },
//     });

//     console.log(`📊 Found ${oldSessions.length} old sessions (>24h) to delete\n`);

//     if (oldSessions.length > 0) {
//       console.log('📋 Old sessions to be deleted:');
//       oldSessions.forEach((session, index) => {
//         const ageInHours = Math.floor((now - new Date(session.updatedAt)) / 1000 / 60 / 60);
//         console.log(`  ${index + 1}. Session: ${session.sessionToken}`);
//         console.log(`     Status: ${session.status}`);
//         console.log(`     Age: ${ageInHours} hours`);
//         console.log('');
//       });

//       const deleteCount = await RegistrationSession.destroy({
//         where: {
//           status: {
//             [Op.in]: ['completed', 'expired', 'cancelled'],
//           },
//           updatedAt: {
//             [Op.lt]: oneDayAgo,
//           },
//         },
//       });

//       console.log(`✅ Successfully deleted ${deleteCount} old sessions\n`);
//     }

//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('✅ Cleanup completed successfully');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

//   } catch (error) {
//     console.error('❌ Error during cleanup:', error);
//     throw error;
//   }
// }

// // Run cleanup
// cleanupExpiredSessions()
//   .then(() => {
//     console.log('\n✅ Script completed');
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error('\n❌ Script failed:', error);
//     process.exit(1);
//   });

