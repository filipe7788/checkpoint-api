const { BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class EpicService {
  // Epic Games has no official public API for user libraries
  // Would require unofficial/undocumented GraphQL endpoints

  constructor() {
    console.warn('[Epic] Service is experimental and uses unofficial APIs');
  }

  async authenticate(_credentials) {
    // Would use Epic's undocumented OAuth
    throw new BadRequestError(ErrorCode.EPIC_NOT_IMPLEMENTED);
  }

  async getOwnedGames(_accessToken) {
    // Would query Epic's GraphQL API
    // Endpoint: https://graphql.epicgames.com/graphql
    throw new BadRequestError(ErrorCode.EPIC_NOT_IMPLEMENTED);
  }

  // Placeholder for future implementation
  // Note: Epic's unofficial APIs can break at any time
  // Consider using browser automation (Puppeteer) as alternative
}

module.exports = new EpicService();
