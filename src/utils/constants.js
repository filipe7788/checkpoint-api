// Game Status Constants
const GameStatus = {
  PLAYING: 'playing',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  WANT_TO_PLAY: 'want_to_play',
};

// Helper to get all valid status values
const VALID_GAME_STATUSES = Object.values(GameStatus);

// Platform Constants
const Platform = {
  STEAM: 'steam',
  XBOX: 'xbox',
  PSN: 'psn',
  NINTENDO: 'nintendo',
  EPIC: 'epic',
};

// API Endpoints
const SteamAPI = {
  BASE_URL: 'http://api.steampowered.com',
  OWNED_GAMES: '/IPlayerService/GetOwnedGames/v1/',
  CDN_BASE: 'https://steamcdn-a.akamaihd.net/steam/apps',
  MEDIA_BASE: 'http://media.steampowered.com/steamcommunity/public/images/apps',
};

const XboxAPI = {
  BASE_URL: 'https://xbl.io/api/v2',
  SEARCH: '/search',
  ACCOUNT: '/account',
  TITLE_HISTORY: '/player/titleHistory',
  ACHIEVEMENTS: '/achievements/player',
};

const IGDBAPI = {
  BASE_URL: 'https://api.igdb.com/v4',
  TOKEN_URL: 'https://id.twitch.tv/oauth2/token',
  ENDPOINTS: {
    GAMES: 'games',
  },
};

// Steam Image URL Templates
const SteamImageURLs = {
  getCoverUrl: appid => `${SteamAPI.CDN_BASE}/${appid}/library_600x900.jpg`,
  getIconUrl: (appid, iconHash) => `${SteamAPI.MEDIA_BASE}/${appid}/${iconHash}.jpg`,
  getLogoUrl: (appid, logoHash) => `${SteamAPI.MEDIA_BASE}/${appid}/${logoHash}.jpg`,
};

// Success Messages
const SuccessMessages = {
  PLATFORM_DISCONNECTED: 'Platform disconnected successfully',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  PASSWORD_RESET_EMAIL_SENT: 'If the email exists, a reset link has been sent',
  MAPPING_DELETED: 'Game title mapping deleted successfully',
};

// IGDB Field Templates
const IGDBFields = {
  BASIC_GAME:
    'id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating',
  GAME_WITH_ALTERNATIVES:
    'id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating, alternative_names.name',
  GAME_WITH_SCREENSHOTS:
    'id, name, slug, summary, cover.url, first_release_date, genres.name, platforms.name, aggregated_rating, screenshots.url',
};

module.exports = {
  GameStatus,
  VALID_GAME_STATUSES,
  Platform,
  SteamAPI,
  XboxAPI,
  IGDBAPI,
  SteamImageURLs,
  SuccessMessages,
  IGDBFields,
};
