/**
 * security.js
 * -----------
 * Security and validation utilities for Expense Analyzer:
 *  - Input sanitization (XSS prevention)
 *  - CSV/Formula Injection prevention
 *  - Password strength verification
 *  - Amount and date bound checks
 */

/**
 * Sanitizes plain text input by stripping HTML tags and trimming.
 * @param {string} input - raw string
 * @returns {string} sanitized string
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[<>]/g, '')    // remove stray brackets
    .trim();
}

/**
 * Prevents CSV Formula Injection (CWE-1236)
 * Prefixes dangerous initial characters (=, +, -, @, tab, CR) with a single quote.
 * @param {string} value
 * @returns {string} safe value
 */
export function sanitizeForCSV(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Validates password strength:
 *  - Min 8 characters
 *  - At least 1 letter and 1 number
 * @param {string} password
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  return { valid: true, message: '' };
}

/**
 * Validates transaction amounts
 * @param {number|string} amount
 * @returns {{ valid: boolean, value: number, message: string }}
 */
export function validateAmount(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { valid: false, value: 0, message: 'Amount must be a positive number.' };
  }
  if (num > 10000000) {
    return { valid: false, value: 0, message: 'Amount exceeds the maximum limit (₹1 Crore).' };
  }
  return { valid: true, value: Math.round(num * 100) / 100, message: '' };
}

/**
 * Validates date string to ensure it is a real date within reasonable boundaries
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  const year = d.getFullYear();
  // Valid between year 2000 and 2100
  return year >= 2000 && year <= 2100;
}
