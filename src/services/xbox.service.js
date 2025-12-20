const axios = require('axios');
const { BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { XboxAPI, Platform } = require('../utils/constants');

/**
 * Xbox Service using OpenXBL API
 * Documentation: https://xbl.io/getting-started
 */
class XboxService {
  constructor() {
    this.apiKey = process.env.OPENXBL_API_KEY;
    this.baseUrl = XboxAPI.BASE_URL;

    if (!this.apiKey) {
      console.warn('[Xbox] OPENXBL_API_KEY not configured in .env');
    }
  }

  /**
   * Search for user by gamertag and get their XUID
   */
  async searchGamertag(gamertag) {
    try {
      const response = await axios.get(
        `${this.baseUrl}${XboxAPI.SEARCH}/${encodeURIComponent(gamertag)}`,
        {
          headers: {
            'X-Authorization': this.apiKey,
            Accept: 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('[Xbox] Error searching gamertag:', error.response?.data || error.message);
      throw new BadRequestError(ErrorCode.XBOX_GAMERTAG_NOT_FOUND);
    }
  }

  /**
   * Get user profile by XUID
   */
  async getProfileByXuid(xuid) {
    try {
      const response = await axios.get(`${this.baseUrl}${XboxAPI.ACCOUNT}/${xuid}`, {
        headers: {
          'X-Authorization': this.apiKey,
          Accept: 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[Xbox] Error fetching profile:', error.response?.data || error.message);
      throw new BadRequestError(ErrorCode.XBOX_PROFILE_FAILED);
    }
  }

  /**
   * Get user's game library
   */
  async getOwnedGames(xuid) {
    try {
      // Try title history first
      const historyResponse = await axios.get(`${this.baseUrl}${XboxAPI.TITLE_HISTORY}/${xuid}`, {
        headers: {
          'X-Authorization': this.apiKey,
          Accept: 'application/json',
        },
      });

      let titles = historyResponse.data?.titles || [];

      // If title history is empty, try achievements endpoint as fallback
      if (titles.length === 0) {
        try {
          const achievementsResponse = await axios.get(
            `${this.baseUrl}${XboxAPI.ACHIEVEMENTS}/${xuid}`,
            {
              headers: {
                'X-Authorization': this.apiKey,
                Accept: 'application/json',
              },
            }
          );

          // Achievements endpoint returns titles in a different format
          titles = achievementsResponse.data?.titles || [];
        } catch (achievementError) {
          console.warn('[Xbox] Could not fetch achievements:', achievementError.message);
        }
      }

      return titles.map(title => ({
        externalId: title.titleId || title.pfn || title.id,
        name: title.name || title.titleName,
        playtime: 0,
        lastPlayedAt: title.lastUnlock ? new Date(title.lastUnlock) : null,
        platform: Platform.XBOX,
      }));
    } catch (error) {
      console.error('[Xbox] Error fetching games:', error.response?.data || error.message);
      throw new BadRequestError(ErrorCode.XBOX_LIBRARY_FAILED);
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
      throw new BadRequestError(ErrorCode.XBOX_GAMERTAG_NOT_FOUND);
    }

    const person = searchResult.people[0];
    const xuid = person.xuid;

    if (!xuid) {
      throw new BadRequestError(ErrorCode.XBOX_XUID_NOT_FOUND);
    }

    // Return info from search (no need for extra profile call to save API quota)
    return {
      xuid: xuid,
      gamertag: person.modernGamertag || person.gamertag || gamertag,
      gamerscore: parseInt(person.gamerScore) || 0,
    };
  }
}

module.exports = new XboxService();
