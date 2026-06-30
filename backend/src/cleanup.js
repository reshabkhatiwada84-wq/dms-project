const cron = require('node-cron');
const fs = require('fs');
const Version = require('./models/Version');
const Document = require('./models/Document');
const { cloudinary } = require('./config/cloudinary');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');

const TRASH_RETENTION_DAYS = 15;
let cleanupStats = { totalDeleted: 0, totalTrashPurged: 0, lastRun: null };

/**
 * Runs every day at 2:00 AM.
 * Finds all NON-CURRENT version documents whose expiryDate has passed,
 * deletes their physical files, and removes them from MongoDB.
 * Current versions are NEVER auto-deleted.
 */
const startCleanupScheduler = () => {
  // Run daily at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cleanup] Running expired version cleanup...');
    try {
      // Only delete non-current versions that have expired
      const expired = await Version.find({
        expiryDate: { $lt: new Date() },
        isCurrentVersion: false,
      });

      let deleted = 0;
      for (const version of expired) {
        try {
          if (version.cloudinaryId) {
            await cloudinary.uploader.destroy(version.cloudinaryId, { resource_type: 'raw' });
          } else {
            const fullPath = version.filename ? path.join(uploadDir, version.filename) : version.filePath;
            if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          }
          await Version.findByIdAndDelete(version._id);
          deleted++;
        } catch (err) {
          console.error(`[Cleanup] Failed to delete version ${version._id}:`, err.message);
        }
      }

      cleanupStats.totalDeleted += deleted;
      cleanupStats.lastRun = new Date();
      console.log(`[Cleanup] Done. Deleted ${deleted} expired version(s). Total ever: ${cleanupStats.totalDeleted}`);

      // Run trash purge
      await runTrashPurge();
    } catch (err) {
      console.error('[Cleanup] Scheduler error:', err.message);
    }
  });

  console.log('[Cleanup] Daily version cleanup scheduler started (runs at 02:00).');
};

/**
 * Permanently delete items that have been in the trash for more than
 * TRASH_RETENTION_DAYS days. Runs once per day from startCleanupScheduler.
 */
const runTrashPurge = async () => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[TrashPurge] Running trash purge (cutoff: ${cutoff.toISOString()})...`);

  let purgedDocs = 0;
  let purgedVersions = 0;

  try {
    // ── 1. Purge documents soft-deleted before the cutoff ───────────────────
    const expiredDocs = await Document.find({
      isDeleted: true,
      deletedAt: { $lt: cutoff },
    });

    for (const doc of expiredDocs) {
      try {
        // Delete all associated versions' physical files and records
        const versions = await Version.find({ documentId: doc._id });
        for (const version of versions) {
          if (version.cloudinaryId) {
            try { await cloudinary.uploader.destroy(version.cloudinaryId, { resource_type: 'raw' }); } catch (e) { /* ignore */ }
          } else {
            const fullPath = version.filename ? path.join(uploadDir, version.filename) : version.filePath;
            if (fullPath && fs.existsSync(fullPath)) {
              try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
            }
          }
          await Version.findByIdAndDelete(version._id);
          purgedVersions++;
        }
        // Delete the document's physical file
        if (doc.cloudinaryId) {
          try { await cloudinary.uploader.destroy(doc.cloudinaryId, { resource_type: 'raw' }); } catch (e) { /* ignore */ }
        } else {
          const fullPath = doc.filename ? path.join(uploadDir, doc.filename) : doc.filePath;
          if (fullPath && fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
          }
        }
        // Delete the document record
        await Document.findByIdAndDelete(doc._id);
        purgedDocs++;
      } catch (err) {
        console.error(`[TrashPurge] Failed to purge document ${doc._id}:`, err.message);
      }
    }

    // ── 2. Purge individual versions soft-deleted before the cutoff ─────────
    const expiredVersions = await Version.find({
      isDeleted: true,
      deletedAt: { $lt: cutoff },
    });

    for (const version of expiredVersions) {
      try {
        if (version.cloudinaryId) {
          try { await cloudinary.uploader.destroy(version.cloudinaryId, { resource_type: 'raw' }); } catch (e) { /* ignore */ }
        } else {
          const fullPath = version.filename ? path.join(uploadDir, version.filename) : version.filePath;
          if (fullPath && fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
          }
        }
        await Version.findByIdAndDelete(version._id);
        purgedVersions++;
      } catch (err) {
        console.error(`[TrashPurge] Failed to purge version ${version._id}:`, err.message);
      }
    }

    cleanupStats.totalTrashPurged += purgedDocs + purgedVersions;
    console.log(
      `[TrashPurge] Done. Permanently deleted ${purgedDocs} document(s) and ${purgedVersions} version(s) older than ${TRASH_RETENTION_DAYS} days.`
    );
  } catch (err) {
    console.error('[TrashPurge] Error:', err.message);
  }
};

const getCleanupStats = () => cleanupStats;

module.exports = { startCleanupScheduler, getCleanupStats, runTrashPurge, TRASH_RETENTION_DAYS };

