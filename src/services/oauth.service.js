const prisma = require('../config/database');
const encryptionService = require('./encryption.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');

class OAuthService {
  /**
   * Connect Steam account to user via OAuth
   */
  async connectSteamAccount(userId, steamProfile) {
    // Extract Steam profile data
    const steamId = steamProfile.steamId || steamProfile.id;
    const username = steamProfile.displayName || steamProfile._json?.personaname;
    const avatar = steamProfile._json?.avatarfull || steamProfile._json?.avatarmedium;

    if (!steamId) {
      throw new BadRequestError(ErrorCode.INVALID_INPUT);
    }

    // Prepare encrypted data (store full profile for future use)
    const sensitiveData = {
      steamId,
      profile: steamProfile._json || {},
      connectedAt: new Date().toISOString(),
    };

    const encryptedData = encryptionService.encrypt(sensitiveData);

    // Create or update OAuth connection
    const connection = await prisma.oAuthConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'steam',
        },
      },
      update: {
        providerUserId: steamId,
        providerUsername: username,
        providerAvatar: avatar,
        encryptedData,
        lastRefreshedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider: 'steam',
        providerUserId: steamId,
        providerUsername: username,
        providerAvatar: avatar,
        encryptedData,
        lastRefreshedAt: new Date(),
      },
      select: {
        id: true,
        provider: true,
        providerUsername: true,
        providerAvatar: true,
        lastRefreshedAt: true,
        createdAt: true,
      },
    });

    // Also update/create the PlatformConnection for backwards compatibility with sync
    await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: 'steam',
        },
      },
      update: {
        platformUserId: steamId,
        platformUsername: username,
        accessToken: 'oauth', // Placeholder to indicate OAuth is used
        isActive: true,
        lastSyncError: null,
      },
      create: {
        userId,
        platform: 'steam',
        platformUserId: steamId,
        platformUsername: username,
        accessToken: 'oauth', // Placeholder to indicate OAuth is used
        isActive: true,
      },
    });

    return connection;
  }

  /**
   * Disconnect an OAuth account
   */
  async disconnectAccount(userId, provider) {
    const connection = await prisma.oAuthConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: provider.toLowerCase(),
        },
      },
    });

    if (!connection) {
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
    }

    // Delete OAuth connection
    await prisma.oAuthConnection.delete({
      where: {
        userId_provider: {
          userId,
          provider: provider.toLowerCase(),
        },
      },
    });

    // Also delete PlatformConnection if it exists
    try {
      await prisma.platformConnection.delete({
        where: {
          userId_platform: {
            userId,
            platform: provider.toLowerCase(),
          },
        },
      });
    } catch (error) {
      // Platform connection might not exist, that's ok
    }

    // Delete all games from this platform
    await prisma.userGame.deleteMany({
      where: {
        userId,
        platform: provider.toLowerCase(),
      },
    });

    return { success: true };
  }

  /**
   * Get all OAuth connections for a user
   */
  async getUserConnections(userId) {
    const connections = await prisma.oAuthConnection.findMany({
      where: { userId },
      select: {
        provider: true,
        providerUsername: true,
        providerAvatar: true,
        lastRefreshedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return connections;
  }

  /**
   * Get decrypted OAuth data for a provider
   */
  async getDecryptedConnection(userId, provider) {
    const connection = await prisma.oAuthConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: provider.toLowerCase(),
        },
      },
    });

    if (!connection) {
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
    }

    // Decrypt sensitive data
    const decryptedData = encryptionService.decrypt(connection.encryptedData);

    return {
      ...connection,
      decryptedData,
    };
  }

  /**
   * Refresh connection data (update profile info)
   */
  async refreshConnection(userId, provider) {
    // For now, just return the existing connection
    // In the future, this could re-fetch data from the provider API
    const connection = await prisma.oAuthConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: provider.toLowerCase(),
        },
      },
      select: {
        provider: true,
        providerUsername: true,
        providerAvatar: true,
        lastRefreshedAt: true,
        createdAt: true,
      },
    });

    if (!connection) {
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
    }

    return connection;
  }
}

module.exports = new OAuthService();
