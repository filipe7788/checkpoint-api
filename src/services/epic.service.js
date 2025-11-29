const { BadRequestError } = require('../utils/errors');

class EpicService {
  // Epic Games has no official public API for user libraries
  // Would require unofficial/undocumented GraphQL endpoints

  constructor() {
    console.warn('[Epic] Service is experimental and uses unofficial APIs');
  }

  async authenticate(credentials) {
    // Would use Epic's undocumented OAuth
    throw new BadRequestError('Epic sync not yet implemented - experimental feature');
  }

  async getOwnedGames(accessToken) {
    // Would query Epic's GraphQL API
    // Endpoint: https://graphql.epicgames.com/graphql
    throw new BadRequestError('Epic sync not yet implemented - experimental feature');
  }

  // Placeholder for future implementation
  // Note: Epic's unofficial APIs can break at any time
  // Consider using browser automation (Puppeteer) as alternative
}

module.exports = new EpicService();
