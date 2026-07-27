/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 * Used for session restore on page reload.
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('../_lib/auth');
const { getJSON } = require('../_lib/redis');
const { KEYS } = require('../_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const decoded = await verifyRequest(req);

    // Fetch full user profile from Redis
    const user = await getJSON(KEYS.USER(decoded.userId));
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return sendSuccess(res, {
      id: user.id,
      username: user.username,
      role: user.role,
      district: user.district || '',
      sessionValid: true,
    });

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Auth/me error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
