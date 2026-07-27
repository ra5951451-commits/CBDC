/**
 * Constants — Redis key prefixes, status enums, and config values.
 * Shared by all API functions.
 */

// ── Redis Key Prefixes ──────────────────────────────────────────────────────

const KEYS = {
  /** User profile: user:{userId} → JSON */
  USER: (userId) => `user:${userId}`,

  /** Login index: user:login:{username} → userId string */
  USER_LOGIN: (username) => `user:login:${username}`,

  /** Session: session:{jti} → JSON (has TTL) */
  SESSION: (jti) => `session:${jti}`,

  /** Base beneficiary data: beneficiary:{srNo} → JSON */
  BENEFICIARY: (srNo) => `beneficiary:${srNo}`,

  /** Onboarding override: onboarding:{srNo} → JSON */
  ONBOARDING: (srNo) => `onboarding:${srNo}`,

  /** Set of all beneficiary sr_no values */
  BENEFICIARIES_ALL: 'beneficiaries:all',

  /** Audit log list: audit:{userId} → List of JSON strings */
  AUDIT: (userId) => `audit:${userId}`,

  /** Cached dashboard stats: dashboard:cache → JSON (has TTL) */
  DASHBOARD_CACHE: 'dashboard:cache',

  /** App metadata */
  METADATA: 'metadata:app',

  /** Rate limit counter: ratelimit:{action}:{identifier} → integer (has TTL) */
  RATE_LIMIT: (action, identifier) => `ratelimit:${action}:${identifier}`,
};

// ── Status Enums ─────────────────────────────────────────────────────────────

const ONBOARDING_STATUS = {
  YES: 'Yes',
  NO: 'No',
};

const ONBOARDING_FIELDS = ['onboarded', 'rc_onboarded'];

const USER_ROLES = {
  TALATI: 'talati',
};

// ── Config Values ────────────────────────────────────────────────────────────

const CONFIG = {
  /** Max audit log entries to keep per user */
  AUDIT_MAX_ENTRIES: 100,

  /** Dashboard cache TTL in seconds */
  DASHBOARD_CACHE_TTL: 30,

  /** Session TTL in seconds (30 minutes) */
  SESSION_TTL: 1800,

  /** Rate limits */
  RATE_LIMITS: {
    LOGIN: { max: 5, windowSeconds: 900 },       // 5 per 15 min
    UPDATE: { max: 30, windowSeconds: 60 },       // 30 per minute
    READ: { max: 100, windowSeconds: 60 },        // 100 per minute
  },
};

// ── Default user ID (single-user system) ─────────────────────────────────────

const DEFAULT_USER_ID = 'talati_001';

module.exports = {
  KEYS,
  ONBOARDING_STATUS,
  ONBOARDING_FIELDS,
  USER_ROLES,
  CONFIG,
  DEFAULT_USER_ID,
};
