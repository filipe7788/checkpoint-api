const axios = require('axios');
const { BadRequestError } = require('../utils/errors');

class XboxService {
  constructor() {
    this.clientId = process.env.XBOX_CLIENT_ID;
    this.clientSecret = process.env.XBOX_CLIENT_SECRET;
    this.redirectUri = process.env.XBOX_REDIRECT_URI;
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'Xboxlive.signin Xboxlive.offline_access',
      state,
    });

    return `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;
  }

  async getTokenFromCode(code) {
    try {
      // Step 1: Get Microsoft Access Token
      const msTokenResponse = await axios.post('https://login.live.com/oauth20_token.srf', new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }));

      const msAccessToken = msTokenResponse.data.access_token;
      const refreshToken = msTokenResponse.data.refresh_token;

      // Step 2: Authenticate with Xbox Live
      const xblResponse = await axios.post('https://user.auth.xboxlive.com/user/authenticate', {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${msAccessToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      const xblToken = xblResponse.data.Token;
      const userHash = xblResponse.data.DisplayClaims.xui[0].uhs;

      // Step 3: Get XSTS Token
      const xstsResponse = await axios.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [xblToken],
        },
        RelyingParty: 'http://xboxlive.com',
        TokenType: 'JWT',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      const xstsToken = xstsResponse.data.Token;
      const xuid = xstsResponse.data.DisplayClaims.xui[0].xid;

      return {
        accessToken: xstsToken,
        refreshToken,
        userHash,
        xuid,
      };
    } catch (error) {
      console.error('[Xbox] Error getting token:', error.response?.data || error.message);
      throw new BadRequestError('Failed to authenticate with Xbox Live');
    }
  }

  async getOwnedGames(xuid, xstsToken, userHash) {
    try {
      const response = await axios.get(
        `https://titlehub.xboxlive.com/users/xuid(${xuid})/titles/titlehistory/decoration/details`,
        {
          headers: {
            'Authorization': `XBL3.0 x=${userHash};${xstsToken}`,
            'x-xbl-contract-version': '2',
          },
        }
      );

      const titles = response.data.titles || [];

      return titles.map(title => ({
        externalId: title.titleId,
        name: title.name,
        playtime: title.stats?.playtime || 0,
        platform: 'xbox',
      }));
    } catch (error) {
      console.error('[Xbox] Error fetching owned games:', error.response?.data || error.message);
      throw new BadRequestError('Failed to fetch Xbox library');
    }
  }
}

module.exports = new XboxService();
