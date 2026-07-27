/**
 * GET /api/sync/latest
 * Return a lightweight map of all onboarding overrides.
 * Frontend can merge these locally without fetching 270 full records.
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('./_lib/auth');
const { getJSON, sMembers } = require('./_lib/redis');
const { KEYS } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await verifyRequest(req);

    const allSrNos = await sMembers(KEYS.BENEFICIARIES_ALL);
    const overrides = {};

    for (const srNoStr of allSrNos) {
      const srNo = Number(srNoStr);
      const override = await getJSON(KEYS.ONBOARDING(srNo));
      if (override) {
        overrides[srNo] = {
          onboarded: override.onboarded,
          rc_onboarded: override.rc_onboarded,
          version: override.version || 0,
        };
      }
    }

    return sendSuccess(res, {
      overrides,
      syncedAt: new Date().toISOString(),
    });

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Sync error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
