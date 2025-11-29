const axios = require('axios');
const { BadRequestError } = require('../utils/errors');

class SteamService {
  constructor() {
    this.apiKey = process.env.STEAM_API_KEY;
    this.baseUrl = 'http://api.steampowered.com';
  }

  async getOwnedGames(steamId) {
    try {
      const response = await axios.get(`${this.baseUrl}/IPlayerService/GetOwnedGames/v1/`, {
        params: {
          key: this.apiKey,
          steamid: steamId,
          include_appinfo: 1,
          include_played_free_games: 1,
          format: 'json',
        },
      });

      const games = response.data.response?.games || [];

      return games.map(game => ({
        externalId: game.appid.toString(),
        name: game.name,
        playtime: Math.round(game.playtime_forever || 0), // Convert minutes to minutes
        platform: 'steam',
      }));
    } catch (error) {
      console.error('[Steam] Error fetching owned games:', error.message);
      throw new BadRequestError('Failed to fetch Steam library');
    }
  }

  // Steam uses OpenID for authentication
  // The flow is:
  // 1. Redirect user to Steam login
  // 2. Steam redirects back with claimed_id in the URL
  // 3. Extract SteamID64 from claimed_id
  getAuthUrl(returnUrl) {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': process.env.APP_URL,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    return `https://steamcommunity.com/openid/login?${params.toString()}`;
  }

  extractSteamId(claimedId) {
    // Claimed ID format: https://steamcommunity.com/openid/id/STEAMID64
    const match = claimedId.match(/\/id\/(\d+)/);
    return match ? match[1] : null;
  }
}

module.exports = new SteamService();
