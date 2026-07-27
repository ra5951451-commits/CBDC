/**
 * POST /api/auth/login
 * Authenticate a Talati user with username + password.
 * Returns JWT token and user profile.
 */

const { getJSON, incrementCounter } = require('../_lib/redis');
const { generateToken, comparePassword, createSession, handleCors, sendError, sendSuccess } = require('../_lib/auth');
const { validateLoginInput } = require('../_lib/validators');
const { KEYS, CONFIG } = require('../_lib/constants');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rateLimitKey = KEYS.RATE_LIMIT('login', clientIp);
  const { LOGIN } = CONFIG.RATE_LIMITS;

  try {
    const count = await incrementCounter(rateLimitKey, LOGIN.windowSeconds);
    if (count > LOGIN.max) {
      return sendError(res, 429, 'Too many login attempts. Please try again later.');
    }
  } catch (e) {
    console.error('Rate limit check failed:', e.message);
    // Continue — don't block login if rate limit check fails
  }

  // ── Validate input ─────────────────────────────────────────────────────────
  const validation = validateLoginInput(req.body);
  if (!validation.valid) {
    return sendError(res, 400, validation.error);
  }

  const { username, password } = validation;

  try {
    // ── Lookup user by username ────────────────────────────────────────────
    const userId = await getJSON(KEYS.USER_LOGIN(username));
    if (!userId) {
      return sendError(res, 401, 'Invalid username or password');
    }

    // ── Fetch user profile ─────────────────────────────────────────────────
    const user = await getJSON(KEYS.USER(userId));
    if (!user || !user.passwordHash) {
      return sendError(res, 401, 'Invalid username or password');
    }

    // ── Verify password ────────────────────────────────────────────────────
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid username or password');
    }

    // ── Generate token + create session ────────────────────────────────────
    const { token, jti, expiresIn } = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    await createSession(jti, user.id, req);

    // ── Return response ────────────────────────────────────────────────────
    return sendSuccess(res, {
      token,
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        district: user.district || '',
      },
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return sendError(res, 500, err.message || 'Internal server error');
  }
};
