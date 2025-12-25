const axios = require('axios');
const rateLimiter = require('../utils/igdbRateLimiter');
const { IGDBAPI, IGDBFields, ErrorMessages } = require('../utils/constants');

class IGDBClient {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.baseUrl = IGDBAPI.BASE_URL;
    this.tokenUrl = IGDBAPI.TOKEN_URL;
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(this.tokenUrl, null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        },
      });

      this.accessToken = response.data.access_token;
      // Set expiration to 5 minutes before actual expiry
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('[IGDB] Failed to get access token:', error.message);
      throw new Error(ErrorMessages.IGDB_AUTH_FAILED);
    }
  }

  async makeRequest(endpoint, body) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/${endpoint}`;

    // Use rate limiter to avoid exceeding 4 requests per second
    return rateLimiter.enqueue(async () => {
      try {
        const response = await axios.post(url, body, {
          headers: {
            'Client-ID': this.clientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
        });

        return response.data;
      } catch (error) {
        console.error(`[IGDB] Request to ${endpoint} failed:`, error.message);
        throw error;
      }
    });
  }

  // Normalize game name for better IGDB search results
  normalizeGameName(name) {
    return (
      name
        // Remove platform indicators
        .replace(/\s*(PS[345]|Xbox|PC|Nintendo|Switch|Steam|Epic)™?\s*/gi, '')
        // Remove "e PS5", "and Xbox", etc
        .replace(/\s*e\s+(PS[345]|Xbox|PC|Nintendo|Switch)™?\s*/gi, '')
        .replace(/\s*and\s+(PS[345]|Xbox|PC|Nintendo|Switch)™?\s*/gi, '')
        // Remove trademark symbols
        .replace(/[™®©]/g, '')
        // Remove edition info (Standard, Deluxe, etc)
        .replace(
          /\s*-?\s*(Standard|Deluxe|Ultimate|Gold|Premium|Complete|GOTY|Game of the Year)\s*Edition\s*/gi,
          ''
        )
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  async searchGames(query, limit = 10) {
    const normalizedQuery = this.normalizeGameName(query);

    const body = `
      search "${normalizedQuery}";
      fields ${IGDBFields.BASIC_GAME};
      limit ${limit};
    `;
    return this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);
  }

  async searchGamesWithAlternatives(gameName) {
    // Use the new best match system instead of returning all results
    const bestMatch = await this.searchGameWithBestMatch(gameName, 15);

    if (bestMatch) {
      return [bestMatch];
    }

    return [];
  }

  /**
   * Check if a game is a DLC, expansion, bundle, or other non-main game
   */
  isDLCOrExpansion(game) {
    const name = game.name.toLowerCase();
    const dlcKeywords = [
      'dlc',
      'expansion',
      'season pass',
      'bundle',
      'pack',
      'edition',
      'content',
      ' - ',
      ': ',
    ];

    // Check if game category indicates it's a DLC/expansion
    // IGDB categories: 0=main_game, 1=dlc_addon, 2=expansion, 3=bundle, etc.
    if (game.category && [1, 2, 3, 4, 10, 11].includes(game.category)) {
      return true;
    }

    // Check name for DLC indicators
    const hasDLCKeyword = dlcKeywords.some(keyword => name.includes(keyword));
    return hasDLCKeyword;
  }

  /**
   * Calculate match score between search query and IGDB result
   */
  calculateMatchScore(searchName, igdbGame) {
    const searchLower = searchName.toLowerCase().trim();
    const gameLower = igdbGame.name.toLowerCase().trim();

    let score = 0;

    // Exact match (highest priority)
    if (searchLower === gameLower) {
      score += 100;
    }

    // Check if one contains the other
    if (gameLower.includes(searchLower)) {
      score += 50;
    } else if (searchLower.includes(gameLower)) {
      score += 40;
    }

    // Word overlap bonus
    const searchWords = searchLower.split(/\s+/);
    const gameWords = gameLower.split(/\s+/);
    const commonWords = searchWords.filter(word => gameWords.includes(word));
    score += commonWords.length * 10;

    // Penalty for DLC/expansion
    if (this.isDLCOrExpansion(igdbGame)) {
      score -= 200;
    }

    // Bonus for having a rating (indicates it's a main game)
    if (igdbGame.aggregated_rating && igdbGame.aggregated_rating > 0) {
      score += 5;
    }

    // Length similarity bonus (prefer similar length names)
    const lengthDiff = Math.abs(searchLower.length - gameLower.length);
    if (lengthDiff < 5) {
      score += 10;
    }

    return score;
  }

  /**
   * Search for a single game and return the best match
   * Filters out DLCs and uses scoring to find the most relevant result
   */
  async searchGameWithBestMatch(gameName, limit = 15) {
    const normalizedQuery = this.normalizeGameName(gameName);

    const body = `
      search "${normalizedQuery}";
      fields ${IGDBFields.GAME_WITH_ALTERNATIVES}, category;
      limit ${limit};
    `;

    try {
      const results = await this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);

      if (!results || results.length === 0) {
        return null;
      }

      // Filter out DLCs/expansions and calculate scores
      const scoredResults = results
        .map(game => ({
          game,
          score: this.calculateMatchScore(gameName, game),
        }))
        .filter(result => result.score > 0) // Filter out negative scores (DLCs)
        .sort((a, b) => b.score - a.score); // Sort by score descending

      if (scoredResults.length === 0) {
        return null;
      }

      const bestMatch = scoredResults[0];
      return bestMatch.game;
    } catch (error) {
      return null;
    }
  }

  async searchMultipleGames(gameNames) {
    const allResults = [];

    // Process games individually to ensure best match for each
    for (const gameName of gameNames) {
      const bestMatch = await this.searchGameWithBestMatch(gameName);

      if (bestMatch) {
        allResults.push(bestMatch);
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allResults;
  }

  async getGameById(igdbId) {
    const body = `
      fields ${IGDBFields.GAME_WITH_SCREENSHOTS};
      where id = ${igdbId};
    `;
    const result = await this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);
    return result[0] || null;
  }

  async getPopularGames(limit = 20) {
    const body = `
      fields ${IGDBFields.BASIC_GAME};
      where aggregated_rating != null & aggregated_rating_count > 5;
      sort aggregated_rating desc;
      limit ${limit};
    `;
    return this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);
  }

  async getGamesByGenre(genreName, limit = 20) {
    const body = `
      fields ${IGDBFields.BASIC_GAME};
      where genres.name = "${genreName}";
      sort aggregated_rating desc;
      limit ${limit};
    `;
    return this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);
  }
}

module.exports = new IGDBClient();
