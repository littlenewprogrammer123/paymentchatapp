/**
 * Encryption Utility — AES-256-CBC
 * Uses Node's built-in crypto module.
 * encrypt(text) → encrypted hex string
 * decrypt(encryptedText) → original plain text
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8'); // 32 bytes
const IV = Buffer.from(process.env.ENCRYPTION_IV, 'utf8');   // 16 bytes

/**
 * Encrypts plain text using AES-256-CBC
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted hex string
 */
const encrypt = (text) => {
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
};

/**
 * Decrypts an encrypted hex string back to plain text
 * @param {string} encryptedText - Encrypted hex string
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedText) => {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
};

module.exports = { encrypt, decrypt };
