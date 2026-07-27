/**
 * GET /api/beneficiaries
 * Return all beneficiaries with onboarding status merged from Redis.
 * Query param: ?status=pending|onboarded|all (default: all)
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('../_lib/auth');
const { getJSON, sMembers } = require('../_lib/redis');
const { KEYS } = require('../_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await verifyRequest(req);

    // Get all beneficiary sr_no values from the set
    const allSrNos = await sMembers(KEYS.BENEFICIARIES_ALL);
    if (!allSrNos || allSrNos.length === 0) {
      return sendSuccess(res, { metadata: {}, beneficiaries: [], stats: { total: 0, onboarded: 0, rcOnboarded: 0, pending: 0 } });
    }

    // Fetch metadata
    const metadata = await getJSON(KEYS.METADATA) || {};

    // Fetch all beneficiaries + their onboarding overrides in parallel
    const sortedSrNos = allSrNos.map(Number).sort((a, b) => a - b);

    const beneficiaryPromises = sortedSrNos.map(async (srNo) => {
      const [base, override] = await Promise.all([
        getJSON(KEYS.BENEFICIARY(srNo)),
        getJSON(KEYS.ONBOARDING(srNo)),
      ]);

      if (!base) return null;

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
      return merged;
    });

    const rawBeneficiaries = await Promise.all(beneficiaryPromises);

    const beneficiaries = [];
    let onboardedCount = 0;
    let rcOnboardedCount = 0;

    for (const merged of rawBeneficiaries) {
      if (!merged) continue;
      beneficiaries.push(merged);
      if (merged.onboarded === 'Yes') onboardedCount++;
      if (merged.rc_onboarded === 'Yes') rcOnboardedCount++;
    }

    // Apply optional status filter
    const statusFilter = (req.query?.status || 'all').toLowerCase();
    let filtered = beneficiaries;
    if (statusFilter === 'pending') {
      filtered = beneficiaries.filter(b => b.onboarded !== 'Yes');
    } else if (statusFilter === 'onboarded') {
      filtered = beneficiaries.filter(b => b.onboarded === 'Yes');
    }

    const total = beneficiaries.length;

    return sendSuccess(res, {
      metadata,
      beneficiaries: filtered,
      stats: {
        total,
        onboarded: onboardedCount,
        onboardedPercent: total > 0 ? ((onboardedCount / total) * 100).toFixed(1) : '0',
        rcOnboarded: rcOnboardedCount,
        rcOnboardedPercent: total > 0 ? ((rcOnboardedCount / total) * 100).toFixed(1) : '0',
        pending: total - onboardedCount,
      },
    });

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Beneficiaries list error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
