const axios = require('axios');
const { BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { SteamAPI, SteamImageURLs, Platform } = require('../utils/constants');

class SteamService {
  constructor() {
    this.apiKey = process.env.STEAM_API_KEY;
    this.baseUrl = SteamAPI.BASE_URL;
  }

  async getOwnedGames(steamId) {
    try {
      const response = await axios.get(`${this.baseUrl}${SteamAPI.OWNED_GAMES}`, {
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
        playtime: Math.round(game.playtime_forever || 0),
        lastPlayedAt: game.rtime_last_played ? new Date(game.rtime_last_played * 1000) : null,
        platform: Platform.STEAM,
        coverUrl: SteamImageURLs.getCoverUrl(game.appid),
        iconUrl: game.img_icon_url
          ? SteamImageURLs.getIconUrl(game.appid, game.img_icon_url)
          : null,
        logoUrl: game.img_logo_url
          ? SteamImageURLs.getLogoUrl(game.appid, game.img_logo_url)
          : null,
      }));
    } catch (error) {
      console.error('[Steam] Error fetching owned games:', error.message);
      throw new BadRequestError(ErrorCode.STEAM_LIBRARY_FAILED);
    }
  }
}

module.exports = new SteamService();
