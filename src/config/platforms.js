const PLATFORM_CONFIG = {
  steam: {
    name: 'Steam',
    official: true,
    experimental: false,
    authType: 'openid',
    syncSupported: true,
    playtimeSupported: true,
    requiresUserToken: false,
  },
  xbox: {
    name: 'Xbox',
    official: true,
    experimental: false,
    authType: 'oauth2',
    syncSupported: true,
    playtimeSupported: true,
    requiresUserToken: false,
  },
  psn: {
    name: 'PlayStation Network',
    official: false,
    experimental: true,
    authType: 'npsso',
    syncSupported: true,
    playtimeSupported: false, // PSN API doesn't provide playtime
    requiresUserToken: true, // User must provide NPSSO token
    warning: 'Experimental: Requires NPSSO token from your PlayStation account cookies',
  },
  nintendo: {
    name: 'Nintendo Switch',
    official: false,
    experimental: true,
    authType: 'custom',
    syncSupported: true,
    playtimeSupported: true,
    requiresUserToken: true,
    warning: 'Experimental: Requires Nintendo Switch Online subscription',
  },
  epic: {
    name: 'Epic Games',
    official: false,
    experimental: true,
    authType: 'custom',
    syncSupported: true,
    playtimeSupported: false,
    requiresUserToken: true,
    warning: 'Experimental: Uses unofficial API - may be unstable',
  },
};

function getPlatformConfig(platform) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return config;
}

function isSyncSupported(platform) {
  const config = PLATFORM_CONFIG[platform];
  return config && config.syncSupported;
}

function isPlaytimeSupported(platform) {
  const config = PLATFORM_CONFIG[platform];
  return config && config.playtimeSupported;
}

module.exports = {
  PLATFORM_CONFIG,
  getPlatformConfig,
  isSyncSupported,
  isPlaytimeSupported,
};
