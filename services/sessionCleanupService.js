/**
 * Session Cleanup Service
 * 
 * Automatically cleans up expired registration sessions
 * Runs periodically in the background (every 5 minutes by default)
 */

const { RegistrationSession } = require('../models');
const { Op } = require('sequelize');

class SessionCleanupService {
  constructor(intervalMinutes = 5) {
    this.intervalMinutes = intervalMinutes;
    this.intervalId = null;
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      totalExpiredMarked: 0,
      totalDeleted: 0,
      lastRun: null,
      lastRunDuration: 0,
    };
  }

  /**
   * Start the cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Session cleanup service is already running');
      return;
    }

    console.log('🧹 Starting session cleanup service...');
    console.log(`⏱️  Cleanup interval: ${this.intervalMinutes} minutes`);

    // Run cleanup immediately on start
    this.runCleanup();

    // Set up interval for periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.intervalMinutes * 60 * 1000);

    this.isRunning = true;
    console.log('✅ Session cleanup service started');
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Session cleanup service is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 Session cleanup service stopped');
  }

  /**
   * Run cleanup process
   */
  async runCleanup() {
    const startTime = Date.now();
    
    try {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🧹 Running session cleanup...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const now = new Date();

      // 1. Mark expired pending sessions as 'expired'
      const expiredCount = await this.markExpiredSessions(now);

      // 2. Delete old completed/expired/cancelled sessions (older than 24 hours)
      const deletedCount = await this.deleteOldSessions(now);

      // Update stats
      this.stats.totalRuns++;
      this.stats.totalExpiredMarked += expiredCount;
      this.stats.totalDeleted += deletedCount;
      this.stats.lastRun = now;
      this.stats.lastRunDuration = Date.now() - startTime;

      console.log(`✅ Cleanup completed in ${this.stats.lastRunDuration}ms`);
      console.log(`📊 Expired: ${expiredCount} | Deleted: ${deletedCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
      console.error('❌ Error during session cleanup:', error);
    }
  }

  /**
   * Mark expired pending sessions
   */
  async markExpiredSessions(now) {
    try {
      const [updateCount] = await RegistrationSession.update(
        { status: 'expired' },
        {
          where: {
            status: 'pending',
            expiresAt: {
              [Op.lt]: now,
            },
          },
        }
      );

      if (updateCount > 0) {
        console.log(`📝 Marked ${updateCount} expired session(s) as 'expired'`);
      }

      return updateCount;
    } catch (error) {
      console.error('❌ Error marking expired sessions:', error);
      return 0;
    }
  }

  /**
   * Delete old sessions (completed, expired, cancelled) older than 24 hours
   */
  async deleteOldSessions(now) {
    try {
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

      const deleteCount = await RegistrationSession.destroy({
        where: {
          status: {
            [Op.in]: ['completed', 'expired', 'cancelled'],
          },
          updatedAt: {
            [Op.lt]: oneDayAgo,
          },
        },
      });

      if (deleteCount > 0) {
        console.log(`🗑️  Deleted ${deleteCount} old session(s) (>24h)`);
      }

      return deleteCount;
    } catch (error) {
      console.error('❌ Error deleting old sessions:', error);
      return 0;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      nextRun: this.isRunning && this.stats.lastRun 
        ? new Date(this.stats.lastRun.getTime() + this.intervalMinutes * 60 * 1000)
        : null,
    };
  }

  /**
   * Get formatted stats string
   */
  getStatsString() {
    const stats = this.getStats();
    
    return `
Session Cleanup Service Stats:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${stats.isRunning ? '✅ Running' : '🛑 Stopped'}
Interval: ${stats.intervalMinutes} minutes
Total Runs: ${stats.totalRuns}
Total Expired Marked: ${stats.totalExpiredMarked}
Total Deleted: ${stats.totalDeleted}
Last Run: ${stats.lastRun ? stats.lastRun.toLocaleString() : 'Never'}
Last Run Duration: ${stats.lastRunDuration}ms
Next Run: ${stats.nextRun ? stats.nextRun.toLocaleString() : 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

// Create singleton instance
const cleanupService = new SessionCleanupService(5); // 5 minutes interval

module.exports = cleanupService;

