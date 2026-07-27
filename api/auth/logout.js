/**
 * POST /api/auth/logout
 * Invalidate the current session.
 */

const { verifyRequest, destroySession, handleCors, sendError, sendSuccess } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const decoded = await verifyRequest(req);
    await destroySession(decoded.jti);
    return sendSuccess(res, { message: 'Logged out' });
  } catch (err) {
    // Even if token is invalid, just return success (idempotent logout)
    if (err.statusCode === 401) {
      return sendSuccess(res, { message: 'Logged out' });
    }
    console.error('Logout error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
