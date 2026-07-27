/**
 * Audit log helpers — write and read action logs to Redis.
 */

const { lPushAndTrim, lRange } = require('./redis');
const { KEYS, CONFIG } = require('./constants');

/**
 * Log an audit event for a user.
 * @param {string} userId
 * @param {{ action: string, sr_no?: number, beneficiaryName?: string, field?: string, oldStatus?: string, newStatus?: string, remarks?: string, ip?: string }} event
 */
async function logAudit(userId, event) {
  const entry = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  await lPushAndTrim(KEYS.AUDIT(userId), entry, CONFIG.AUDIT_MAX_ENTRIES);
}

/**
 * Get recent audit events for a user.
 * @param {string} userId
 * @param {number} [limit=20]
 * @returns {Promise<any[]>}
 */
async function getRecentAudit(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(1, limit), CONFIG.AUDIT_MAX_ENTRIES);
  return lRange(KEYS.AUDIT(userId), 0, safeLimit - 1);
}

module.exports = {
  logAudit,
  getRecentAudit,
};
