/**
 * GET /api/beneficiaries/[srNo]
 * Return a single beneficiary's full profile with onboarding status.
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('../../_lib/auth');
const { getJSON } = require('../../_lib/redis');
const { validateSrNo } = require('../../_lib/validators');
const { KEYS } = require('../../_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await verifyRequest(req);

    // Validate sr_no from URL
    const srNoValidation = validateSrNo(req.query.srNo);
    if (!srNoValidation.valid) {
      return sendError(res, 400, srNoValidation.error);
    }
    const { srNo } = srNoValidation;

    // Fetch base beneficiary data
    const base = await getJSON(KEYS.BENEFICIARY(srNo));
    if (!base) {
      return sendError(res, 404, 'Beneficiary not found');
    }

    // Merge onboarding override if exists
    const override = await getJSON(KEYS.ONBOARDING(srNo));
    const merged = { ...base };

    if (override) {
      if (override.onboarded !== undefined) merged.onboarded = override.onboarded;
      if (override.rc_onboarded !== undefined) merged.rc_onboarded = override.rc_onboarded;
      merged.version = override.version || 0;
      merged.updatedAt = override.updatedAt || null;
      merged.updatedBy = override.updatedBy || null;
      merged.remarks = override.remarks || '';
    } else {
      merged.version = 0;
      merged.updatedAt = null;
      merged.updatedBy = null;
      merged.remarks = '';
    }

    return sendSuccess(res, merged);

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Beneficiary detail error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
