const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple');
const SteamStrategy = require('passport-steam').Strategy;

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/api/auth/google/callback`,
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: ['profile', 'email'],
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

// Apple OAuth Strategy
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      callbackURL: `${process.env.API_URL}/api/auth/apple/callback`,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY,
      scope: ['email', 'name'],
    },
    (accessToken, refreshToken, idToken, profile, done) => {
      return done(null, profile);
    }
  )
);

// Steam OAuth Strategy (OpenID) - for auth (login/register)
passport.use(
  'steam-auth',
  new SteamStrategy(
    {
      returnURL: `${process.env.API_URL}/api/auth/steam/callback`,
      realm: process.env.API_URL,
      apiKey: process.env.STEAM_API_KEY,
    },
    (identifier, profile, done) => {
      // identifier is the full OpenID URL
      // Extract Steam ID from identifier (e.g., "https://steamcommunity.com/openid/id/76561198012345678")
      const steamId = identifier.match(/\/id\/(\d+)$/)?.[1];

      // Enrich profile with Steam ID
      profile.steamId = steamId;
      profile.id = steamId;

      return done(null, profile);
    }
  )
);

// Steam OAuth Strategy - for connection (linking existing account)
// Note: returnURL will be dynamic (includes state query param) but we configure base URL
passport.use(
  'steam',
  new SteamStrategy(
    {
      // Base returnURL - actual URL will include ?state=... but passport-steam
      // validates against this base, and the full URL is in openid.return_to
      returnURL: `${process.env.API_URL}/api/oauth/steam/callback`,
      realm: process.env.API_URL,
      apiKey: process.env.STEAM_API_KEY,
      passReqToCallback: true,  // Pass req to callback to access query params
    },
    (req, identifier, profile, done) => {
      console.log('[PASSPORT STEAM] Request URL:', req.url);
      console.log('[PASSPORT STEAM] Query params:', req.query);
      console.log('[PASSPORT STEAM] Identifier:', identifier);
      console.log('[PASSPORT STEAM] Profile:', profile);

      // identifier is the full OpenID URL
      // Extract Steam ID from identifier (e.g., "https://steamcommunity.com/openid/id/76561198012345678")
      const steamId = identifier.match(/\/id\/(\d+)$/)?.[1];

      console.log('[PASSPORT STEAM] Extracted Steam ID:', steamId);

      // Enrich profile with Steam ID
      profile.steamId = steamId;
      profile.id = steamId;

      return done(null, profile);
    }
  )
);

module.exports = passport;
