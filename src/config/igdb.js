const axios = require('axios');
const rateLimiter = require('../utils/igdbRateLimiter');

class IGDBClient {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiration to 5 minutes before actual expiry
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

      console.log('[IGDB] Access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('[IGDB] Failed to get access token:', error.message);
      throw new Error('Failed to authenticate with IGDB');
    }
  }

  async makeRequest(endpoint, body) {
    const token = await this.getAccessToken();

    // Use rate limiter to avoid exceeding 4 requests per second
    return rateLimiter.enqueue(async () => {
      try {
        const response = await axios.post(`https://api.igdb.com/v4/${endpoint}`, body, {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
          }
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
    return name
      // Remove platform indicators
      .replace(/\s*(PS[345]|Xbox|PC|Nintendo|Switch|Steam|Epic)™?\s*/gi, '')
      // Remove "e PS5", "and Xbox", etc
      .replace(/\s*e\s+(PS[345]|Xbox|PC|Nintendo|Switch)™?\s*/gi, '')
      .replace(/\s*and\s+(PS[345]|Xbox|PC|Nintendo|Switch)™?\s*/gi, '')
      // Remove trademark symbols
      .replace(/[™®©]/g, '')
      // Remove edition info (Standard, Deluxe, etc)
      .replace(/\s*-?\s*(Standard|Deluxe|Ultimate|Gold|Premium|Complete|GOTY|Game of the Year)\s*Edition\s*/gi, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  async searchGames(query, limit = 10) {
    const normalizedQuery = this.normalizeGameName(query);

    if (normalizedQuery !== query) {
      console.log(`[IGDB] Normalized "${query}" -> "${normalizedQuery}"`);
    }

    const body = `
      search "${normalizedQuery}";
      fields id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating;
      limit ${limit};
    `;
    return this.makeRequest('games', body);
  }

  async searchMultipleGames(gameNames) {
    // Search games in parallel batches to respect rate limits
    // IGDB allows 4 requests per second, so we batch in groups of 4
    const allResults = [];
    const batchSize = 4;

    for (let i = 0; i < gameNames.length; i += batchSize) {
      const batch = gameNames.slice(i, i + batchSize);

      // Search all games in this batch in parallel
      const promises = batch.map(name =>
        this.searchGames(name, 10) // Search top 10 results to get better matches
          .then(results => {
            if (results.length === 0) {
              console.log(`[IGDB] No results for "${name}"`);
              return null;
            }

            console.log(`[IGDB] Found ${results.length} results for "${name}":`, results.map(r => r.name).join(', '));

            // Find the best match - prefer exact name match
            const exactMatch = results.find(r =>
              r.name.toLowerCase() === name.toLowerCase()
            );

            return exactMatch || results[0]; // Return exact match or first result
          })
          .catch(error => {
            console.error(`[IGDB] Failed to search for "${name}":`, error.message);
            return null;
          })
      );

      const results = await Promise.all(promises);
      allResults.push(...results.filter(r => r !== null));

      // Add delay between batches to respect rate limits (1 second between batches)
      if (i + batchSize < gameNames.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allResults;
  }

  async getGameById(igdbId) {
    const body = `
      fields id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating, screenshots.url;
      where id = ${igdbId};
    `;
    const result = await this.makeRequest('games', body);
    return result[0] || null;
  }

  async getPopularGames(limit = 20) {
    const body = `
      fields id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating;
      where aggregated_rating != null & aggregated_rating_count > 5;
      sort aggregated_rating desc;
      limit ${limit};
    `;
    return this.makeRequest('games', body);
  }

  async getGamesByGenre(genreName, limit = 20) {
    const body = `
      fields id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating;
      where genres.name = "${genreName}";
      sort aggregated_rating desc;
      limit ${limit};
    `;
    return this.makeRequest('games', body);
  }
}

module.exports = new IGDBClient();
