const axios = require('axios');
const { BadRequestError } = require('../utils/errors');

/**
 * Xbox Service using OpenXBL API
 * Documentation: https://xbl.io/getting-started
 */
class XboxService {
  constructor() {
    this.apiKey = process.env.OPENXBL_API_KEY;
    this.baseUrl = 'https://xbl.io/api/v2';

    if (!this.apiKey) {
      console.warn('[Xbox] OPENXBL_API_KEY not configured in .env');
    }
  }

  /**
   * Get user profile by gamertag
   */
  async getProfileByGamertag(gamertag) {
    try {
      const response = await axios.get(`${this.baseUrl}/account/${gamertag}`, {
        headers: {
          'X-Authorization': this.apiKey,
          'Accept': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[Xbox] Error fetching profile:', error.response?.data || error.message);
      throw new BadRequestError('Failed to fetch Xbox profile');
    }
  }

  /**
   * Get user's game library
   */
  async getOwnedGames(xuid) {
    try {
      const response = await axios.get(`${this.baseUrl}/titlehub/titleHistory/${xuid}`, {
        headers: {
          'X-Authorization': this.apiKey,
          'Accept': 'application/json',
        },
      });

      const titles = response.data?.titles || [];

      return titles.map(title => ({
        externalId: title.titleId || title.pfn,
        name: title.name,
        playtime: 0,
        platform: 'xbox',
      }));
    } catch (error) {
      console.error('[Xbox] Error fetching games:', error.response?.data || error.message);
      throw new BadRequestError('Failed to fetch Xbox library');
    }
  }

  /**
   * Connect account by gamertag (manual connection)
   */
  async connectByGamertag(gamertag) {
    const profile = await this.getProfileByGamertag(gamertag);

    return {
      xuid: profile.xuid || profile.id,
      gamertag: profile.gamertag || gamertag,
      gamerscore: profile.gamerScore || 0,
    };
  }
}

module.exports = new XboxService();
