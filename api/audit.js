/**
 * GET /api/audit
 * Return recent audit events for the logged-in user.
 * Query param: ?limit=20 (default: 20, max: 100)
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('./_lib/auth');
const { getRecentAudit } = require('./_lib/audit');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const decoded = await verifyRequest(req);

    const limit = Math.min(Math.max(1, parseInt(req.query?.limit, 10) || 20), 100);
    const events = await getRecentAudit(decoded.userId, limit);

    return sendSuccess(res, { events });

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Audit error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
