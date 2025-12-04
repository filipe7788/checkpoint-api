const {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getUserTitles,
  getUserPlayedGames,
  makeUniversalSearch,
} = require('psn-api');
const { BadRequestError } = require('../utils/errors');

class PSNService {
  // PSN requires user to provide their NPSSO token manually
  // NPSSO can be obtained from cookies after logging in to playstation.com
  async authenticateWithNpsso(npsso) {
    try {
      const authCode = await exchangeNpssoForCode(npsso);
      const authorization = await exchangeCodeForAccessToken(authCode);

      // Decode idToken to get account_id (sub field)
      const idTokenPayload = JSON.parse(
        Buffer.from(authorization.idToken.split('.')[1], 'base64').toString()
      );

      // Return full authorization object + accountId
      // getUserTitles needs the complete authorization object, not just accessToken
      return {
        ...authorization, // Include all fields: accessToken, tokenType, expiresIn, idToken, refreshToken, refreshTokenExpiresIn, scope
        accountId: idTokenPayload.sub, // Account ID from JWT sub claim
      };
    } catch (error) {
      console.error('[PSN] Error authenticating:', error.message);
      throw new BadRequestError('Invalid NPSSO token or authentication failed');
    }
  }

  // Parse ISO 8601 duration format (PT7H4M29S) to minutes
  parsePlayDuration(duration) {
    if (!duration) return 0;

    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const match = duration.match(regex);

    if (!match) return 0;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    return hours * 60 + minutes + Math.floor(seconds / 60);
  }

  async getOwnedGames(authorization, accountId) {
    try {
      const authPayload = { accessToken: authorization.accessToken };

      // Fetch played games (broader list than trophy titles)
      const playedGamesResponse = await getUserPlayedGames(authPayload, accountId);
      const playedGames = playedGamesResponse.titles || [];

      // Fetch trophy titles to get trophy information
      const trophyResponse = await getUserTitles(authPayload, accountId);
      const trophyTitles = trophyResponse.trophyTitles || [];

      // Create a map of trophy data by npCommunicationId
      const trophyMap = new Map();
      trophyTitles.forEach(title => {
        trophyMap.set(title.npCommunicationId, {
          bronze: title.definedTrophies?.bronze || 0,
          silver: title.definedTrophies?.silver || 0,
          gold: title.definedTrophies?.gold || 0,
          platinum: title.definedTrophies?.platinum || 0,
        });
      });

      // Combine both lists, using played games as the base
      const games = playedGames.map(game => ({
        externalId: game.titleId,
        name: game.name,
        playtime: this.parsePlayDuration(game.playDuration), // Parse ISO 8601 duration to minutes
        platform: 'psn',
        metadata: {
          trophies: trophyMap.get(game.titleId) || null,
          category: game.category,
          imageUrl: game.imageUrl,
        },
      }));

      return games;
    } catch (error) {
      console.error('[PSN] Error fetching owned games:', error.message);
      throw new BadRequestError('Failed to fetch PSN library');
    }
  }
}

module.exports = new PSNService();
