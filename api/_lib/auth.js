/**
 * Authentication helpers — JWT sign/verify, bcrypt hash/compare, session management.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getJSON, setJSON, deleteKey, exists } = require('./redis');
const { KEYS, CONFIG } = require('./constants');

// ── JWT Helpers ──────────────────────────────────────────────────────────────

/**
 * Generate a signed JWT token.
 * @param {{ userId: string, username: string, role: string }} payload
 * @returns {{ token: string, jti: string, expiresIn: number }}
 */
function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');

  const expiresIn = parseInt(process.env.JWT_EXPIRES_IN, 10) || CONFIG.SESSION_TTL;
  const jti = uuidv4();

  const token = jwt.sign(
    { userId: payload.userId, username: payload.username, role: payload.role, jti },
    secret,
    { expiresIn }
  );

  return { token, jti, expiresIn };
}

/**
 * Verify a JWT token and return the decoded payload.
 * @param {string} token
 * @returns {{ userId: string, username: string, role: string, jti: string, iat: number, exp: number }}
 * @throws {Error} If token is invalid or expired
 */
function verifyTokenRaw(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.verify(token, secret);
}

/**
 * Full auth verification: extract Bearer token from request, verify JWT,
 * check session still exists in Redis.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ userId: string, username: string, role: string, jti: string }>}
 * @throws {Error} With message suitable for 401 response
 */
async function verifyRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    decoded = verifyTokenRaw(token);
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    throw err;
  }

  // Check session still exists in Redis (not logged out)
  const sessionExists = await exists(KEYS.SESSION(decoded.jti));
  if (!sessionExists) {
    const err = new Error('Session has been invalidated');
    err.statusCode = 401;
    throw err;
  }

  return decoded;
}

// ── Session Management ───────────────────────────────────────────────────────

/**
 * Create a session record in Redis.
 * @param {string} jti - Token unique ID
 * @param {string} userId
 * @param {import('http').IncomingMessage} req - For device/IP info
 */
async function createSession(jti, userId, req) {
  const sessionData = {
    userId,
    createdAt: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };

  await setJSON(KEYS.SESSION(jti), sessionData, CONFIG.SESSION_TTL);
}

/**
 * Destroy a session in Redis.
 * @param {string} jti
 */
async function destroySession(jti) {
  await deleteKey(KEYS.SESSION(jti));
}

// ── Password Helpers ─────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

// ── CORS + Method Helpers ────────────────────────────────────────────────────

/**
 * Set CORS headers and handle OPTIONS preflight.
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if this was a preflight request (already handled)
 */
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Send a JSON error response.
 * @param {import('http').ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 */
function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

/**
 * Send a JSON success response.
 * @param {import('http').ServerResponse} res
 * @param {any} data
 * @param {number} [statusCode=200]
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}

module.exports = {
  generateToken,
  verifyTokenRaw,
  verifyRequest,
  createSession,
  destroySession,
  hashPassword,
  comparePassword,
  handleCors,
  sendError,
  sendSuccess,
};
