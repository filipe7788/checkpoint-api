const prisma = require('../config/database');
const gameService = require('./game.service');
const igdbClient = require('../config/igdb');
const steamService = require('./steam.service');
const xboxService = require('./xbox.service');
const psnService = require('./psn.service');
const nintendoService = require('./nintendo.service');
const epicService = require('./epic.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { distance } = require('fastest-levenshtein');

class SyncService {
  /**
   * Find best fuzzy match using Levenshtein distance
   * Returns the best matching game if similarity is above threshold (60%)
   */
  findBestFuzzyMatch(psnName, igdbGames) {
    let bestMatch = null;
    let bestScore = 0;

    // Clean the PSN name (remove special chars, normalize spaces)
    const cleanPSN = psnName
      .toLowerCase()
      .replace(/[™®©&:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    igdbGames.forEach(game => {
      // Clean IGDB name the same way
      const cleanIGDB = game.name
        .toLowerCase()
        .replace(/[™®©&:\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Calculate Levenshtein distance
      const lev = distance(cleanPSN, cleanIGDB);
      const maxLen = Math.max(cleanPSN.length, cleanIGDB.length);

      // Convert to similarity score (0-1, higher is better)
      const similarity = 1 - (lev / maxLen);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = game;
      }
    });

    // Only return if confidence is above 60% threshold
    if (bestScore >= 0.6) {
      console.log(`[Sync] Fuzzy match: "${psnName}" -> "${bestMatch.name}" (${(bestScore * 100).toFixed(1)}% similarity)`);
      return bestMatch;
    }

    return null;
  }

  /**
   * Extract core title from game name by removing common suffixes and platform indicators
   */
  extractCoreTitle(name) {
    return name
      // Remove everything after common separators
      .split(/\s+(-|–|—|:|\|)\s+/)[0]
      // Remove platform indicators and everything after
      .replace(/\s+(PS[345]|Xbox|PC|Nintendo|Switch).*$/gi, '')
      // Remove trademark symbols
      .replace(/[™®©&]/g, '')
      .trim();
  }

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
      // For Xbox, credentials should contain gamertag (manual connection)
      const xboxProfile = await xboxService.connectByGamertag(credentials.gamertag);
      platformData = {
        platformUserId: xboxProfile.xuid,
        platformUsername: xboxProfile.gamertag,
        accessToken: process.env.OPENXBL_API_KEY, // OpenXBL uses server API key
        refreshToken: null,
        tokenExpiresAt: null,
      };
      break;

    case 'psn':
      // For PSN, credentials should contain NPSSO token
      const psnTokens = await psnService.authenticateWithNpsso(credentials.npsso);
      // Store the full authorization object as JSON in accessToken field
      // getUserTitles needs the complete auth object with all fields
      platformData = {
        platformUserId: psnTokens.accountId,
        platformUsername: null,
        accessToken: JSON.stringify(psnTokens), // Full auth object as JSON
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
        platform,
        ...platformData,
        user: {
          connect: { id: userId },
        },
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

  async syncPlatform(userId, platform, onProgress = null) {
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
      // Send initial progress
      if (onProgress) {
        onProgress({ type: 'status', message: `Fetching games from ${platform}...`, progress: 0 });
      }

      let externalGames = [];

      switch (platform) {
      case 'steam':
        externalGames = await steamService.getOwnedGames(connection.platformUserId);
        break;

      case 'xbox':
        externalGames = await xboxService.getOwnedGames(connection.platformUserId);
        break;

      case 'psn':
        // Parse the full authorization object from JSON
        const psnAuth = JSON.parse(connection.accessToken);

        // Pass the full authorization object to getUserTitles
        // PSN API uses "me" for the authenticated user
        externalGames = await psnService.getOwnedGames(psnAuth, "me");
        break;

      case 'nintendo':
      case 'epic':
        throw new BadRequestError(`${platform} sync not yet implemented`);

      default:
        throw new BadRequestError('Unknown platform');
      }

      console.log(`[Sync] Received ${externalGames.length} games from ${platform}`);

      if (onProgress) {
        onProgress({ type: 'status', message: `Found ${externalGames.length} games. Searching IGDB...`, progress: 10 });
      }

      // Extract core titles for IGDB search
      const coreTitles = externalGames.map(g => {
        const coreTitle = this.extractCoreTitle(g.name);
        if (coreTitle !== g.name) {
          console.log(`[Sync] Extracted core title: "${g.name}" -> "${coreTitle}"`);
        }
        return coreTitle;
      });

      // Get unique core titles for searching
      const uniqueCoreTitles = [...new Set(coreTitles)];

      // Check if games already exist in our database (cache)
      console.log(`[Sync] Checking cache for ${uniqueCoreTitles.length} unique games...`);
      const cachedGames = await prisma.game.findMany({
        where: {
          OR: uniqueCoreTitles.map(name => ({
            name: { contains: name, mode: 'insensitive' }
          }))
        },
        select: {
          id: true,
          igdbId: true,
          name: true,
          slug: true,
        }
      });

      console.log(`[Sync] Found ${cachedGames.length} games in cache`);

      // Search IGDB for all games (we'll use fuzzy matching to find best results)
      console.log(`[Sync] Searching ${uniqueCoreTitles.length} games in IGDB...`);
      if (onProgress) {
        onProgress({ type: 'status', message: `Buscando ${uniqueCoreTitles.length} jogos no IGDB...`, progress: 15 });
      }

      const igdbGames = await igdbClient.searchMultipleGames(uniqueCoreTitles);
      console.log(`[Sync] IGDB returned ${igdbGames.length} games`);

      // Combine cached games and IGDB results for fuzzy matching
      const allAvailableGames = [
        ...cachedGames,
        ...igdbGames.map(g => ({ ...g, fromIGDB: true }))
      ];

      // Sync games to library
      let added = 0;
      let updated = 0;
      let failed = 0;
      const notRecognized = [];
      const totalGames = externalGames.length;

      if (onProgress) {
        onProgress({ type: 'status', message: `Processing ${totalGames} games...`, progress: 20 });
      }

      for (let i = 0; i < externalGames.length; i++) {
        const externalGame = externalGames[i];

        // Send progress update every 10 games or on last game
        if (onProgress && (i % 10 === 0 || i === totalGames - 1)) {
          const progress = 20 + Math.floor((i / totalGames) * 70); // 20-90%
          onProgress({
            type: 'progress',
            message: `Processing game ${i + 1}/${totalGames}...`,
            progress,
            current: i + 1,
            total: totalGames,
          });
        }

        try {
          // Use fuzzy matching to find the best match from available games
          let igdbGame = this.findBestFuzzyMatch(externalGame.name, allAvailableGames);

          // If no match found, try with simplified name (before colon)
          if (!igdbGame) {
            const simplifiedName = externalGame.name.split(':')[0].trim();
            if (simplifiedName !== externalGame.name) {
              console.log(`[Sync] Trying simplified name: "${simplifiedName}"`);
              igdbGame = this.findBestFuzzyMatch(simplifiedName, allAvailableGames);
            }
          }

          if (!igdbGame) {
            console.log(`[Sync] No match found for "${externalGame.name}", skipping...`);
            notRecognized.push({
              originalName: externalGame.name,
              normalizedName: this.extractCoreTitle(externalGame.name),
            });
            failed++;
            continue;
          }

          // Create or find game by IGDB ID
          let game;
          if (igdbGame.fromIGDB) {
            // This came from IGDB, needs to be created in DB
            game = await gameService.findOrCreateByIgdbId(igdbGame.id);
          } else {
            // This is already in our DB (from cache)
            game = igdbGame;
          }

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
            // Update playtime and lastPlayedAt if changed
            const needsUpdate =
              externalGame.playtime > (existingUserGame.playtime || 0) ||
              (externalGame.lastPlayedAt && (!existingUserGame.lastPlayedAt ||
                new Date(externalGame.lastPlayedAt) > new Date(existingUserGame.lastPlayedAt)));

            if (needsUpdate) {
              await prisma.userGame.update({
                where: { id: existingUserGame.id },
                data: {
                  playtime: Math.max(externalGame.playtime || 0, existingUserGame.playtime || 0),
                  lastPlayedAt: externalGame.lastPlayedAt || existingUserGame.lastPlayedAt,
                },
              });
              updated++;
            }
          } else {
            // Add new game
            console.log(`[Sync] Adding "${game.name}" to platform: ${platform}`);
            await prisma.userGame.create({
              data: {
                userId,
                gameId: game.id,
                status: externalGame.playtime > 0 ? 'playing' : 'owned',
                platform,
                playtime: externalGame.playtime || 0,
                lastPlayedAt: externalGame.lastPlayedAt || null,
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
        notRecognized, // Lista de jogos não reconhecidos
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
