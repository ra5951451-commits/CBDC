/**
 * GET /api/dashboard
 * Return computed dashboard statistics with Redis caching.
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('./_lib/auth');
const { getJSON, setJSON, sMembers } = require('./_lib/redis');
const { getRecentAudit } = require('./_lib/audit');
const { KEYS, CONFIG } = require('./_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const decoded = await verifyRequest(req);

    // ── Check cache ──────────────────────────────────────────────────────────
    const cached = await getJSON(KEYS.DASHBOARD_CACHE);
    if (cached) {
      return sendSuccess(res, cached);
    }

    // ── Compute stats from Redis ─────────────────────────────────────────────
    const allSrNos = await sMembers(KEYS.BENEFICIARIES_ALL);
    const total = allSrNos.length;

    const itemsPromises = allSrNos.map(async (srNoStr) => {
      const srNo = Number(srNoStr);
      const [base, override] = await Promise.all([
        getJSON(KEYS.BENEFICIARY(srNo)),
        getJSON(KEYS.ONBOARDING(srNo)),
      ]);
      if (!base) return null;
      const onboarded = override?.onboarded || base.onboarded;
      const rcOnboarded = override?.rc_onboarded || base.rc_onboarded;
      return { rationCard: base.ration_card, onboarded, rcOnboarded };
    });

    const items = await Promise.all(itemsPromises);

    let onboardedCount = 0;
    let rcOnboardedCount = 0;
    const rationCards = new Set();

    for (const item of items) {
      if (!item) continue;
      if (item.rationCard) rationCards.add(item.rationCard);
      if (item.onboarded === 'Yes') onboardedCount++;
      if (item.rcOnboarded === 'Yes') rcOnboardedCount++;
    }

    // ── Get recent activity ──────────────────────────────────────────────────
    const recentActivity = await getRecentAudit(decoded.userId, 5);

    // ── Build response ───────────────────────────────────────────────────────
    const dashboard = {
      total,
      totalCards: rationCards.size,
      onboarded: onboardedCount,
      onboardedPercent: total > 0 ? ((onboardedCount / total) * 100).toFixed(1) : '0',
      rcOnboarded: rcOnboardedCount,
      rcOnboardedPercent: total > 0 ? ((rcOnboardedCount / total) * 100).toFixed(1) : '0',
      pending: total - onboardedCount,
      recentActivity,
      cachedAt: new Date().toISOString(),
    };

    // ── Cache the result ─────────────────────────────────────────────────────
    await setJSON(KEYS.DASHBOARD_CACHE, dashboard, CONFIG.DASHBOARD_CACHE_TTL);

    return sendSuccess(res, dashboard);

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Dashboard error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
