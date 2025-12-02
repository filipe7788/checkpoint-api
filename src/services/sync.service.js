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
      // For Xbox, credentials should contain the OAuth code from callback
      const xboxProfile = await xboxService.connectAccount(credentials.code);
      platformData = {
        platformUserId: xboxProfile.externalId,
        platformUsername: xboxProfile.username,
        accessToken: xboxProfile.accessToken, // Secret key from xbl.io
        refreshToken: null,
        tokenExpiresAt: null, // xbl.io tokens don't expire (user can revoke)
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

    // Delete all games from this platform in user's library
    await prisma.userGame.deleteMany({
      where: {
        userId,
        platform,
      },
    });

    // Delete the platform connection
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
        // Usar XUID e secret key para buscar jogos
        externalGames = await xboxService.syncLibrary(
          connection.platformUserId,
          connection.accessToken
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

      // Helper function to normalize game names for matching
      const normalizeGameName = (name) => {
        return name
          .toLowerCase()
          .replace(/[™®©]/g, '') // Remove trademark symbols
          .replace(/[:\-–—]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+(open beta|beta|alpha|demo|early access|na|eu|us|playtest)$/gi, '') // Remove suffixes
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      };

      // Search games in IGDB using batch search
      const gameNames = externalGames.map(g => g.name);
      const igdbGames = await igdbClient.searchMultipleGames(gameNames);

      // Create a map for faster lookups
      const igdbGameMap = new Map();
      igdbGames.forEach(game => {
        if (game) {
          const normalized = normalizeGameName(game.name);
          igdbGameMap.set(normalized, game);
        }
      });

      // Sync games to library
      let added = 0;
      let updated = 0;
      let failed = 0;

      for (const externalGame of externalGames) {
        try {
          // Try to find matching IGDB game using normalized names
          const normalizedExternalName = normalizeGameName(externalGame.name);
          let igdbGame = igdbGameMap.get(normalizedExternalName);

          // If no exact match, try fuzzy matching
          if (!igdbGame) {
            for (const [normalizedName, game] of igdbGameMap.entries()) {
              // Check if one name contains the other (handles cases like "The Witcher 3: Wild Hunt" vs "The Witcher 3")
              if (normalizedName.includes(normalizedExternalName) || normalizedExternalName.includes(normalizedName)) {
                igdbGame = game;
                break;
              }
            }
          }

          if (!igdbGame) {
            console.log(`[Sync] No IGDB match for "${externalGame.name}" (normalized: "${normalizedExternalName}"), skipping...`);
            failed++;
            continue;
          }

          // Create or find game by IGDB ID
          let game = await gameService.findOrCreateByIgdbId(igdbGame.id);

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
        } catch (error) {
          // Log error for individual game but continue with others
          console.error(`[Sync] Failed to sync game "${externalGame.name}":`, error.message);
          failed++;
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
        failed,
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
