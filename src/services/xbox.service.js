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
   * Search for user by gamertag and get their XUID
   */
  async searchGamertag(gamertag) {
    try {
      const response = await axios.get(`${this.baseUrl}/search/${encodeURIComponent(gamertag)}`, {
        headers: {
          'X-Authorization': this.apiKey,
          'Accept': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[Xbox] Error searching gamertag:', error.response?.data || error.message);
      throw new BadRequestError('Gamertag not found. Please check the spelling.');
    }
  }

  /**
   * Get user profile by XUID
   */
  async getProfileByXuid(xuid) {
    try {
      const response = await axios.get(`${this.baseUrl}/account/${xuid}`, {
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
    // Search for gamertag to get XUID and basic info
    const searchResult = await this.searchGamertag(gamertag);

    // Search result has a 'people' array with results
    if (!searchResult.people || searchResult.people.length === 0) {
      throw new BadRequestError('Gamertag not found. Please check the spelling.');
    }

    const person = searchResult.people[0];
    const xuid = person.xuid;

    if (!xuid) {
      throw new BadRequestError('Could not find XUID for this gamertag');
    }

    console.log('[Xbox] Found XUID:', xuid, 'for gamertag:', person.modernGamertag || person.gamertag);

    // Return info from search (no need for extra profile call to save API quota)
    return {
      xuid: xuid,
      gamertag: person.modernGamertag || person.gamertag || gamertag,
      gamerscore: parseInt(person.gamerScore) || 0,
    };
  }
}

module.exports = new XboxService();
