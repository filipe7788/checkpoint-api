const {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getUserTitles,
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

      console.log('[PSN] Authorization object:', JSON.stringify(authorization, null, 2));

      // Decode idToken to get account_id (sub field)
      const idTokenPayload = JSON.parse(
        Buffer.from(authorization.idToken.split('.')[1], 'base64').toString()
      );

      console.log('[PSN] Account ID from idToken:', idTokenPayload.sub);

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

  async getOwnedGames(authorization, accountId) {
    try {
      console.log('[PSN] Fetching games for accountId:', accountId);
      console.log('[PSN] Authorization:', JSON.stringify(authorization, null, 2));

      const response = await getUserTitles({ accountId }, authorization);

      console.log('[PSN] getUserTitles response:', JSON.stringify(response, null, 2));

      const titles = response.trophyTitles || [];

      console.log('[PSN] Found', titles.length, 'games with trophies');

      if (titles.length > 0) {
        console.log('[PSN] First 3 games:', titles.slice(0, 3).map(t => t.titleName));
      }

      // Note: PSN API doesn't provide playtime
      const games = titles.map(title => ({
        externalId: title.npCommunicationId,
        name: title.titleName,
        playtime: 0, // Not available
        platform: 'psn',
        metadata: {
          trophies: {
            bronze: title.definedTrophies?.bronze || 0,
            silver: title.definedTrophies?.silver || 0,
            gold: title.definedTrophies?.gold || 0,
            platinum: title.definedTrophies?.platinum || 0,
          },
        },
      }));

      console.log('[PSN] Returning', games.length, 'games');
      return games;
    } catch (error) {
      console.error('[PSN] Error fetching owned games:', error.message);
      console.error('[PSN] Error stack:', error.stack);
      console.error('[PSN] Error details:', JSON.stringify(error, null, 2));
      throw new BadRequestError('Failed to fetch PSN library');
    }
  }
}

module.exports = new PSNService();
