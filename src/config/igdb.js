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
    const normalizedQuery = this.normalizeGameName(gameName);

    const body = `
      search "${normalizedQuery}";
      fields ${IGDBFields.GAME_WITH_ALTERNATIVES};
      limit 5;
    `;

    try {
      const results = await this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);

      if (results && results.length > 0) {
        return results;
      }
    } catch (error) {
      console.error(`[IGDB] Alternative names search failed:`, error.message);
    }

    return [];
  }

  async searchMultipleGames(gameNames) {
    // Use IGDB batch search with OR operator to search multiple games in one request
    // Process in chunks of 50 games per request (IGDB limit is 500 results per request)
    const allResults = [];
    const chunkSize = 50;

    for (let i = 0; i < gameNames.length; i += chunkSize) {
      const chunk = gameNames.slice(i, i + chunkSize);

      // Create OR query for batch search
      const searchQuery = chunk.map(name => `"${name}"`).join(' | ');

      const body = `
        search ${searchQuery};
        fields ${IGDBFields.GAME_WITH_ALTERNATIVES};
        limit 500;
      `;

      try {
        const results = await this.makeRequest(IGDBAPI.ENDPOINTS.GAMES, body);

        // For each original game name, find the best match
        chunk.forEach(originalName => {
          const normalizedOriginal = originalName.toLowerCase();

          // Find exact match first
          let match = results.find(r => r.name.toLowerCase() === normalizedOriginal);

          // If no exact match, find closest match
          if (!match) {
            match = results.find(r => {
              const normalizedResult = r.name.toLowerCase();
              return (
                normalizedResult.includes(normalizedOriginal) ||
                normalizedOriginal.includes(normalizedResult)
              );
            });
          }

          if (match) {
            allResults.push(match);
          }
        });
      } catch (error) {
        console.error(`[IGDB] Batch search failed:`, error.message);
      }

      // Small delay between chunks to respect rate limits
      if (i + chunkSize < gameNames.length) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
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
