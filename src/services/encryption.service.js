const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // Get encryption key from environment or generate one
    // IMPORTANT: In production, this MUST be a secure, consistent key stored in env
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits

    // Get key from env or throw error
    const envKey = process.env.OAUTH_ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error('OAUTH_ENCRYPTION_KEY must be set in environment variables');
    }

    // Ensure key is exactly 32 bytes
    this.key = crypto.scryptSync(envKey, 'salt', this.keyLength);
  }

  /**
   * Encrypt sensitive OAuth data
   * @param {Object} data - Data to encrypt (will be JSON stringified)
   * @returns {string} Encrypted data in format: iv:authTag:encryptedData (all base64)
   */
  encrypt(data) {
    try {
      const iv = crypto.randomBytes(16); // Initialization vector
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      const jsonData = JSON.stringify(data);
      let encrypted = cipher.update(jsonData, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      console.error('[Encryption] Failed to encrypt data:', error.message);
      throw new Error('Failed to encrypt OAuth data');
    }
  }

  /**
   * Decrypt OAuth data
   * @param {string} encryptedData - Data in format: iv:authTag:encryptedData
   * @returns {Object} Decrypted data (parsed from JSON)
   */
  decrypt(encryptedData) {
    try {
      const [ivB64, authTagB64, encrypted] = encryptedData.split(':');

      if (!ivB64 || !authTagB64 || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[Encryption] Failed to decrypt data:', error.message);
      throw new Error('Failed to decrypt OAuth data');
    }
  }

  /**
   * Generate a random encryption key (for setup)
   * @returns {string} Random hex string suitable for OAUTH_ENCRYPTION_KEY
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new EncryptionService();
