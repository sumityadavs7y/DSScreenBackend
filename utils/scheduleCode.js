/**
 * Schedule Code Generator Utility
 * Generates unique 5-character alphanumeric codes (uppercase, lowercase, numbers)
 */

const crypto = require('crypto');

/**
 * Characters allowed in schedule codes
 * Excludes confusing characters: 0, O, o, I, l, 1
 */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Generate a random 5-character code
 * @returns {string} 5-character alphanumeric code
 */
function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(5);
  
  for (let i = 0; i < 5; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  
  return code;
}

/**
 * Generate a unique schedule code that doesn't exist in the database
 * @param {Model} ScheduleModel - Sequelize Schedule model
 * @param {number} maxAttempts - Maximum number of generation attempts (default: 10)
 * @returns {Promise<string>} Unique schedule code
 * @throws {Error} If unable to generate unique code after maxAttempts
 */
async function generateUniqueCode(ScheduleModel, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateCode();
    
    // Check if code already exists
    const existing = await ScheduleModel.findOne({
      where: { code },
    });
    
    if (!existing) {
      return code;
    }
  }
  
  throw new Error('Unable to generate unique schedule code after multiple attempts');
}

/**
 * Validate schedule code format
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid
 */
function isValidCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Must be exactly 5 characters
  if (code.length !== 5) {
    return false;
  }
  
  // Must only contain allowed characters
  const validChars = new RegExp(`^[${CHARS}]{5}$`);
  return validChars.test(code);
}

module.exports = {
  generateCode,
  generateUniqueCode,
  isValidCode,
};

