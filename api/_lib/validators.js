/**
 * Input validation helpers for API endpoints.
 */

const { ONBOARDING_STATUS, ONBOARDING_FIELDS } = require('./constants');

/**
 * Validate login request body.
 * @param {any} body
 * @returns {{ valid: boolean, username?: string, password?: string, error?: string }}
 */
function validateLoginInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username) {
    return { valid: false, error: 'Username is required' };
  }
  if (username.length > 50) {
    return { valid: false, error: 'Username is too long' };
  }
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length > 100) {
    return { valid: false, error: 'Password is too long' };
  }

  return { valid: true, username, password };
}

/**
 * Validate onboarding update request body.
 * @param {any} body
 * @returns {{ valid: boolean, field?: string, status?: string, version?: number, remarks?: string, error?: string }}
 */
function validateOnboardingUpdate(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const field = typeof body.field === 'string' ? body.field.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  const version = body.version;
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim().slice(0, 500) : '';

  if (!ONBOARDING_FIELDS.includes(field)) {
    return { valid: false, error: `Field must be one of: ${ONBOARDING_FIELDS.join(', ')}` };
  }

  if (status !== ONBOARDING_STATUS.YES && status !== ONBOARDING_STATUS.NO) {
    return { valid: false, error: `Status must be "${ONBOARDING_STATUS.YES}" or "${ONBOARDING_STATUS.NO}"` };
  }

  if (version === undefined || version === null || typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { valid: false, error: 'Version must be a non-negative integer' };
  }

  return { valid: true, field, status, version, remarks };
}

/**
 * Validate a beneficiary sr_no parameter.
 * @param {string|number} srNo
 * @returns {{ valid: boolean, srNo?: number, error?: string }}
 */
function validateSrNo(srNo) {
  const num = parseInt(srNo, 10);
  if (isNaN(num) || num < 1 || num > 9999) {
    return { valid: false, error: 'Invalid beneficiary ID' };
  }
  return { valid: true, srNo: num };
}

/**
 * Sanitize a string input: trim and limit length.
 * @param {string} str
 * @param {number} [maxLength=200]
 * @returns {string}
 */
function sanitize(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

module.exports = {
  validateLoginInput,
  validateOnboardingUpdate,
  validateSrNo,
  sanitize,
};
