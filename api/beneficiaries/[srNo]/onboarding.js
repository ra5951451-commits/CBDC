/**
 * PATCH /api/beneficiaries/[srNo]/onboarding
 * Update onboarding status (onboarded or rc_onboarded) with version conflict detection.
 */

const { verifyRequest, handleCors, sendError, sendSuccess } = require('../../_lib/auth');
const { getJSON, setJSON, deleteKey, incrementCounter } = require('../../_lib/redis');
const { validateSrNo, validateOnboardingUpdate } = require('../../_lib/validators');
const { logAudit } = require('../../_lib/audit');
const { KEYS, CONFIG } = require('../../_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'PATCH') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const decoded = await verifyRequest(req);

    // ── Rate limiting ────────────────────────────────────────────────────────
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rateLimitKey = KEYS.RATE_LIMIT('update', clientIp);
    const { UPDATE } = CONFIG.RATE_LIMITS;

    try {
      const count = await incrementCounter(rateLimitKey, UPDATE.windowSeconds);
      if (count > UPDATE.max) {
        return sendError(res, 429, 'Too many updates. Please slow down.');
      }
    } catch (e) {
      console.error('Rate limit check failed:', e.message);
    }

    // ── Validate sr_no from URL ──────────────────────────────────────────────
    const srNoValidation = validateSrNo(req.query.srNo);
    if (!srNoValidation.valid) {
      return sendError(res, 400, srNoValidation.error);
    }
    const { srNo } = srNoValidation;

    // ── Validate request body ────────────────────────────────────────────────
    const bodyValidation = validateOnboardingUpdate(req.body);
    if (!bodyValidation.valid) {
      return sendError(res, 400, bodyValidation.error);
    }
    const { field, status, version: clientVersion, remarks } = bodyValidation;

    // ── Check beneficiary exists ─────────────────────────────────────────────
    const base = await getJSON(KEYS.BENEFICIARY(srNo));
    if (!base) {
      return sendError(res, 404, 'Beneficiary not found');
    }

    // ── Fetch current override ───────────────────────────────────────────────
    const currentOverride = await getJSON(KEYS.ONBOARDING(srNo));
    const currentVersion = currentOverride ? (currentOverride.version || 0) : 0;

    // ── Version conflict check ───────────────────────────────────────────────
    if (clientVersion !== currentVersion) {
      const currentOnboarded = currentOverride ? (currentOverride.onboarded || base.onboarded) : base.onboarded;
      const currentRcOnboarded = currentOverride ? (currentOverride.rc_onboarded || base.rc_onboarded) : base.rc_onboarded;

      return res.status(409).json({
        error: 'Version conflict',
        currentVersion,
        yourVersion: clientVersion,
        currentData: {
          onboarded: currentOnboarded,
          rc_onboarded: currentRcOnboarded,
        },
      });
    }

    // ── Build new override ───────────────────────────────────────────────────
    const oldStatus = currentOverride ? (currentOverride[field] || base[field]) : base[field];
    const now = new Date().toISOString();
    const newVersion = currentVersion + 1;

    const newOverride = {
      onboarded: currentOverride?.onboarded || base.onboarded,
      rc_onboarded: currentOverride?.rc_onboarded || base.rc_onboarded,
      [field]: status,
      updatedBy: decoded.userId,
      updatedAt: now,
      remarks: remarks || '',
      version: newVersion,
    };

    // ── Write to Redis ───────────────────────────────────────────────────────
    await setJSON(KEYS.ONBOARDING(srNo), newOverride);

    // ── Invalidate dashboard cache ───────────────────────────────────────────
    await deleteKey(KEYS.DASHBOARD_CACHE);

    // ── Write audit log ──────────────────────────────────────────────────────
    await logAudit(decoded.userId, {
      action: 'onboarding_update',
      sr_no: srNo,
      beneficiaryName: base.name || '',
      field,
      oldStatus,
      newStatus: status,
      remarks: remarks || '',
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    });

    // ── Return updated record ────────────────────────────────────────────────
    return sendSuccess(res, {
      sr_no: srNo,
      onboarded: newOverride.onboarded,
      rc_onboarded: newOverride.rc_onboarded,
      version: newVersion,
      updatedBy: decoded.userId,
      updatedAt: now,
    });

  } catch (err) {
    if (err.statusCode === 401) {
      return sendError(res, 401, err.message);
    }
    console.error('Onboarding update error:', err.message);
    return sendError(res, 500, 'Internal server error');
  }
};
