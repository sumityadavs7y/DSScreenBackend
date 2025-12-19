/**
 * Generate a random short name for devices
 * Format: "Device-XXXX" where X is alphanumeric
 */

const ADJECTIVES = [
  'Blue', 'Red', 'Green', 'Gold', 'Silver', 'Swift', 'Bright', 'Smart',
  'Cool', 'Fast', 'Bold', 'Calm', 'Warm', 'Clear', 'Fresh', 'Quick'
];

const NOUNS = [
  'Screen', 'Display', 'Panel', 'Monitor', 'Viewer', 'Board', 'Sign',
  'Kiosk', 'Terminal', 'Device', 'Player', 'Unit', 'Station', 'Hub'
];

/**
 * Generate a random device name
 * Format: "Adjective Noun" (e.g., "Blue Screen", "Swift Display")
 * @returns {string} Random device name
 */
function generateDeviceName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

/**
 * Generate a simple random string (alternative)
 * Format: "Device-XXXX" where X is alphanumeric
 * @param {number} length - Length of random part (default: 4)
 * @returns {string} Random device name
 */
function generateSimpleDeviceName(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'Device-';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  generateDeviceName,
  generateSimpleDeviceName,
};

