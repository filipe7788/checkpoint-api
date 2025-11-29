const prisma = require('../config/database');
const gameService = require('./game.service');
const igdbClient = require('../config/igdb');
const steamService = require('./steam.service');
const xboxService = require('./xbox.service');
const psnService = require('./psn.service');
const nintendoService = require('./nintendo.service');
const epicService = require('./epic.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class SyncService {
  async connectPlatform(userId, platform, credentials) {
    let platformData;

    switch (platform) {
    case 'steam':
      // For Steam, credentials should contain steamId from OpenID
      platformData = {
        platformUserId: credentials.steamId,
        platformUsername: null,
        accessToken: 'steam_openid', // Steam doesn't use tokens
        refreshToken: null,
      };
      break;

    case 'xbox':
      // For Xbox, credentials should contain the auth code
      const xboxTokens = await xboxService.getTokenFromCode(credentials.code);
      platformData = {
        platformUserId: xboxTokens.xuid,
        platformUsername: null,
        accessToken: xboxTokens.accessToken,
        refreshToken: xboxTokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      };
      break;

    case 'psn':
      // For PSN, credentials should contain NPSSO token
      const psnTokens = await psnService.authenticateWithNpsso(credentials.npsso);
      platformData = {
        platformUserId: credentials.accountId,
        platformUsername: null,
        accessToken: psnTokens.accessToken,
        refreshToken: psnTokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + psnTokens.expiresIn * 1000),
      };
      break;

    case 'nintendo':
    case 'epic':
      throw new BadRequestError(`${platform} sync not yet implemented`);

    default:
      throw new BadRequestError('Unknown platform');
    }

    // Create or update platform connection
    const connection = await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
      update: {
        ...platformData,
        isActive: true,
        lastSyncError: null,
      },
      create: {
        userId,
        platform,
        ...platformData,
      },
    });

    return connection;
  }

  async disconnectPlatform(userId, platform) {
    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    if (!connection) {
      throw new NotFoundError('Platform not connected');
    }

    await prisma.platformConnection.delete({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    return { message: 'Platform disconnected successfully' };
  }

  async syncPlatform(userId, platform) {
    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    if (!connection) {
      throw new NotFoundError('Platform not connected');
    }

    try {
      let externalGames = [];

      switch (platform) {
      case 'steam':
        externalGames = await steamService.getOwnedGames(connection.platformUserId);
        break;

      case 'xbox':
        // Note: May need to refresh token if expired
        externalGames = await xboxService.getOwnedGames(
          connection.platformUserId,
          connection.accessToken,
          connection.platformUsername // userHash stored here
        );
        break;

      case 'psn':
        externalGames = await psnService.getOwnedGames(
          { accessToken: connection.accessToken },
          connection.platformUserId
        );
        break;

      case 'nintendo':
      case 'epic':
        throw new BadRequestError(`${platform} sync not yet implemented`);

      default:
        throw new BadRequestError('Unknown platform');
      }

      // Sync games to library
      let added = 0;
      let updated = 0;

      for (const externalGame of externalGames) {
        // Try to find game in IGDB by name
        const igdbGames = await igdbClient.searchGames(externalGame.name, 1);

        if (igdbGames.length === 0) {
          console.log(`[Sync] Game not found in IGDB: ${externalGame.name}`);
          continue;
        }

        // Cache game in database
        const game = await gameService.cacheGame(igdbGames[0]);

        // Check if already in user's library
        const existingUserGame = await prisma.userGame.findUnique({
          where: {
            userId_gameId_platform: {
              userId,
              gameId: game.id,
              platform,
            },
          },
        });

        if (existingUserGame) {
          // Update playtime if greater
          if (externalGame.playtime > (existingUserGame.playtime || 0)) {
            await prisma.userGame.update({
              where: { id: existingUserGame.id },
              data: { playtime: externalGame.playtime },
            });
            updated++;
          }
        } else {
          // Add new game
          await prisma.userGame.create({
            data: {
              userId,
              gameId: game.id,
              status: externalGame.playtime > 0 ? 'playing' : 'owned',
              platform,
              playtime: externalGame.playtime || 0,
            },
          });
          added++;
        }
      }

      // Update sync timestamp
      await prisma.platformConnection.update({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });

      return {
        success: true,
        added,
        updated,
        total: externalGames.length,
      };
    } catch (error) {
      // Log error to connection
      await prisma.platformConnection.update({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
        data: {
          lastSyncError: error.message,
        },
      });

      throw error;
    }
  }

  async getSyncStatus(userId) {
    const connections = await prisma.platformConnection.findMany({
      where: { userId },
      select: {
        platform: true,
        platformUsername: true,
        lastSyncAt: true,
        lastSyncError: true,
        isActive: true,
        createdAt: true,
      },
    });

    return connections;
  }
}

module.exports = new SyncService();
