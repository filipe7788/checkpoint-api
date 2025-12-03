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

      return {
        accessToken: authorization.accessToken,
        refreshToken: authorization.refreshToken,
        expiresIn: authorization.expiresIn,
        accountId: idTokenPayload.sub, // Account ID from JWT sub claim
      };
    } catch (error) {
      console.error('[PSN] Error authenticating:', error.message);
      throw new BadRequestError('Invalid NPSSO token or authentication failed');
    }
  }

  async getOwnedGames(authorization, accountId) {
    try {
      const response = await getUserTitles({ accountId }, authorization);

      const titles = response.trophyTitles || [];

      // Note: PSN API doesn't provide playtime
      return titles.map(title => ({
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
    } catch (error) {
      console.error('[PSN] Error fetching owned games:', error.message);
      throw new BadRequestError('Failed to fetch PSN library');
    }
  }
}

module.exports = new PSNService();
