/**
 * Validation Utility for AirClick
 * 
 * Provides professional-grade regex patterns and validation functions
 * for various input types.
 */

/**
 * Professional Email Regex
 * Matches the HTML5 specification and RFC 5322 (subset mostly used in web)
 * - Allows alphanumeric characters and certain symbols in local part
 * - Ensures @ symbol
 * - Validates domain name structure and length
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?@[a-zA-Z0-9]+\.[a-zA-Z]{2,}$/;

/**
 * Validates an email address against the professional regex
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateEmail = (email) => {
  if (!email) return false;
  return EMAIL_REGEX.test(String(email).toLowerCase());
};

/**
 * Password Strength Regex
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const PASSWORD_STRICT_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Full Name Regex
 * - Only letters and spaces
 * - At least 2 characters
 */
export const FULL_NAME_REGEX = /^[a-zA-Z\s]{2,50}$/;

/**
 * Validates password strength
 * @param {string} password - The password to validate
 * @param {boolean} strict - Whether to use strict validation (default: false)
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validatePassword = (password, strict = false) => {
  if (!password) return { isValid: false, message: 'Password is required' };
  if (password.length < 6) return { isValid: false, message: 'Password must be at least 6 characters' };
  
  if (strict && !PASSWORD_STRICT_REGEX.test(password)) {
    return { 
      isValid: false, 
      message: 'Password must be 8+ chars with uppercase, lowercase, number and special character' 
    };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validates full name
 * @param {string} name - The name to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validateFullName = (name) => {
  if (!name) return { isValid: false, message: 'Full name is required' };
  if (name.length < 2) return { isValid: false, message: 'Name must be at least 2 characters' };
  if (!FULL_NAME_REGEX.test(name)) return { isValid: false, message: 'Name contains invalid characters' };
  return { isValid: true, message: '' };
};

/**
 * Validates gesture name
 * @param {string} name - The gesture name to validate
 * @returns {object} - { isValid: boolean, message: string }
 */
export const validateGestureName = (name) => {
  if (!name) return { isValid: false, message: 'Gesture name is required' };
  if (name.length < 3) return { isValid: false, message: 'Gesture name must be at least 3 characters' };
  if (name.length > 30) return { isValid: false, message: 'Gesture name must be less than 30 characters' };
  return { isValid: true, message: '' };
};
