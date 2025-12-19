const fs = require('fs').promises;
const path = require('path');

/**
 * Base directory for all video files
 */
const VIDEO_BASE_DIR = path.join(__dirname, '..', 'videos');

/**
 * Ensure the base videos directory exists
 */
const ensureVideoBaseDir = async () => {
  try {
    await fs.access(VIDEO_BASE_DIR);
  } catch (error) {
    await fs.mkdir(VIDEO_BASE_DIR, { recursive: true });
  }
};

/**
 * Get the directory path for a specific company
 * @param {string} companyId - UUID of the company
 * @returns {string} Full path to the company's video directory
 */
const getCompanyDir = (companyId) => {
  return path.join(VIDEO_BASE_DIR, companyId);
};

/**
 * Ensure a company's video directory exists
 * @param {string} companyId - UUID of the company
 * @returns {Promise<string>} Full path to the created directory
 */
const ensureCompanyDir = async (companyId) => {
  await ensureVideoBaseDir();
  const companyDir = getCompanyDir(companyId);
  
  try {
    await fs.access(companyDir);
  } catch (error) {
    await fs.mkdir(companyDir, { recursive: true });
  }
  
  return companyDir;
};

/**
 * Delete a file from the filesystem
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<boolean>} True if deleted, false if file didn't exist
 */
const deleteFile = async (filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  try {
    await fs.access(fullPath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false; // File doesn't exist
    }
    throw error;
  }
};

/**
 * Check if a file exists
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<boolean>} True if file exists
 */
const fileExists = async (filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  try {
    await fs.access(fullPath);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Generate a unique filename if the requested name already exists
 * @param {string} companyId - UUID of the company
 * @param {string} desiredFileName - The desired file name
 * @returns {Promise<string>} A unique filename
 */
const generateUniqueFileName = async (companyId, desiredFileName) => {
  const companyDir = getCompanyDir(companyId);
  const ext = path.extname(desiredFileName);
  const baseName = path.basename(desiredFileName, ext);
  
  let fileName = desiredFileName;
  let counter = 1;
  
  while (await fileExists(path.join('videos', companyId, fileName))) {
    fileName = `${baseName} (${counter})${ext}`;
    counter++;
  }
  
  return fileName;
};

/**
 * Get file size in bytes
 * @param {string} filePath - Relative path to the file
 * @returns {Promise<number>} File size in bytes
 */
const getFileSize = async (filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);
  const stats = await fs.stat(fullPath);
  return stats.size;
};

/**
 * List all files in a company's directory
 * @param {string} companyId - UUID of the company
 * @returns {Promise<string[]>} Array of file names
 */
const listCompanyFiles = async (companyId) => {
  const companyDir = getCompanyDir(companyId);
  
  try {
    const files = await fs.readdir(companyDir);
    return files.filter(file => {
      // Filter out directories and hidden files
      return !file.startsWith('.');
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // Directory doesn't exist yet
    }
    throw error;
  }
};

/**
 * Validate that a file is a video file based on MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} True if valid video MIME type
 */
const isValidVideoMimeType = (mimeType) => {
  const validTypes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/webm',
    'video/ogg',
    'video/3gpp',
    'video/x-flv',
    'video/x-matroska',
  ];
  
  // Check if it's a specific valid type or starts with 'video/'
  return validTypes.includes(mimeType) || (mimeType && mimeType.startsWith('video/'));
};

module.exports = {
  VIDEO_BASE_DIR,
  ensureVideoBaseDir,
  getCompanyDir,
  ensureCompanyDir,
  deleteFile,
  fileExists,
  generateUniqueFileName,
  getFileSize,
  listCompanyFiles,
  isValidVideoMimeType,
};

