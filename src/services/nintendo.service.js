const { BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class NintendoService {
  // Nintendo Switch Online API is complex and unofficial
  // Would require: nintendo-switch-online-api or similar package
  // For now, implementing placeholder

  constructor() {
    console.warn('[Nintendo] Service is experimental and not fully implemented');
  }

  async authenticate(_credentials) {
    // This would require complex OAuth flow with Nintendo
    // Including session token, service token, etc.
    throw new BadRequestError(ErrorCode.NINTENDO_NOT_IMPLEMENTED);
  }

  async getOwnedGames(_accessToken) {
    // Would fetch from Nintendo Switch Parental Controls API
    // or Nintendo Account API
    throw new BadRequestError(ErrorCode.NINTENDO_NOT_IMPLEMENTED);
  }

  // Placeholder for future implementation
  // Requirements:
  // 1. User must have Nintendo Switch Online subscription
  // 2. User must enable Parental Controls app
  // 3. Complex token exchange process
}

module.exports = new NintendoService();
