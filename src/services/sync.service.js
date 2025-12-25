const prisma = require('../config/database');
const gameService = require('./game.service');
const igdbClient = require('../config/igdb');
const steamService = require('./steam.service');
const xboxService = require('./xbox.service');
const psnService = require('./psn.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { distance } = require('fastest-levenshtein');
const { GameStatus, Platform, SuccessMessages } = require('../utils/constants');

class SyncService {
  /**
   * LAYER 0: Normalize game name
   * Remove platform indicators, editions, special chars, etc.
   */
  normalizeGameName(name) {
    return (
      name
        .toLowerCase()
        // Remove parentheses with platform indicators: "(PlayStation®5)", "(PS5)", etc
        .replace(/\s*\([^)]*(playstation|ps[345]|xbox|pc|nintendo|switch|steam|epic)[^)]*\)/gi, '')
        // Remove "& PS5", "e PS5", "and Xbox", etc
        .replace(/\s+(&|e|and)\s+(ps[345]|xbox|pc|nintendo|switch)™?\s*/gi, ' ')
        // Remove platform indicators at end or beginning
        .replace(/\s+(ps[345]|xbox|pc|nintendo|switch|steam|epic)™?\s*$/gi, '')
        .replace(/^\s*(ps[345]|xbox|pc|nintendo|switch|steam|epic)™?\s+/gi, '')
        // Remove trademark symbols
        .replace(/[™®©&]/g, '')
        // Replace punctuation with spaces
        .replace(/[:\-–—]/g, ' ')
        // Remove beta/demo/region suffixes
        .replace(/\s+(open beta|beta|alpha|demo|early access|na|eu|us|playtest)$/gi, '')
        // Remove edition info
        .replace(
          /\s*-?\s*(standard|deluxe|ultimate|gold|premium|complete|goty|game of the year|digital)\s*edition\s*/gi,
          ''
        )
        // Normalize spaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * LAYER 1: Exact match
   * Check if game name matches exactly (case-insensitive)
   */
  findExactMatch(gameName, availableGames) {
    const normalized = gameName.toLowerCase().trim();

    for (const game of availableGames) {
      if (game.name.toLowerCase().trim() === normalized) {
        return game;
      }
    }

    return null;
  }

  /**
   * LAYER 2: Normalized match
   * Compare normalized versions of names
   */
  findNormalizedMatch(gameName, availableGames) {
    const normalizedSearch = this.normalizeGameName(gameName);

    for (const game of availableGames) {
      const normalizedGame = this.normalizeGameName(game.name);

      if (normalizedSearch === normalizedGame) {
        return game;
      }
    }

    return null;
  }

  /**
   * LAYER 3: IGDB alternative names search
   * Search IGDB including alternative_names field
   */
  async searchIGDBWithAlternativeNames(gameName) {
    try {
      const results = await igdbClient.searchGamesWithAlternatives(gameName);

      if (results && results.length > 0) {
        const topResult = results[0];
        return topResult;
      }
    } catch (error) {
      console.error(`[Sync] IGDB alternative names search failed:`, error.message);
    }

    return null;
  }

  /**
   * LAYER 4: Fuzzy matching with Levenshtein distance
   * Returns the best matching game if similarity is above threshold (75%)
   */
  findBestFuzzyMatch(gameName, availableGames, threshold = 0.75) {
    let bestMatch = null;
    let bestScore = 0;

    const cleanName = this.normalizeGameName(gameName);

    availableGames.forEach(game => {
      const cleanGame = this.normalizeGameName(game.name);

      // Calculate Levenshtein distance
      const lev = distance(cleanName, cleanGame);
      const maxLen = Math.max(cleanName.length, cleanGame.length);

      // Convert to similarity score (0-1, higher is better)
      const similarity = 1 - lev / maxLen;

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = game;
      }
    });

    // Only return if confidence is above threshold
    if (bestScore >= threshold) {
      return { game: bestMatch, score: bestScore };
    }

    return null;
  }

  /**
   * LAYER 0: Check if we have a manual mapping for this title
   * Returns the mapped game if found
   */
  async findMappedGame(gameName, platform) {
    const mapping = await prisma.gameTitleMapping.findUnique({
      where: {
        platform_originalTitle: {
          platform,
          originalTitle: gameName,
        },
      },
      include: {
        game: {
          select: {
            id: true,
            igdbId: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return mapping ? mapping.game : null;
  }

  /**
   * CASCADING SEARCH: Try all layers in order
   * Returns { game, confidence, method } or null
   */
  async findGameMatch(gameName, cachedGames, igdbGames, platform = null) {
    // Layer 0: Check manual mappings first (100% confidence)
    if (platform) {
      const mappedGame = await this.findMappedGame(gameName, platform);
      if (mappedGame) {
        return { game: mappedGame, confidence: 100, method: 'mapped' };
      }
    }

    const allGames = [...cachedGames, ...igdbGames];

    // Layer 1: Exact match
    let match = this.findExactMatch(gameName, allGames);
    if (match) {
      return { game: match, confidence: 100, method: 'exact' };
    }

    // Layer 2: Normalized match
    match = this.findNormalizedMatch(gameName, allGames);
    if (match) {
      return { game: match, confidence: 95, method: 'normalized' };
    }

    // Layer 3: IGDB with alternative names (skip if we already have IGDB results)
    if (igdbGames.length === 0) {
      match = await this.searchIGDBWithAlternativeNames(gameName);
      if (match) {
        return { game: { ...match, fromIGDB: true }, confidence: 90, method: 'alias' };
      }
    }

    // Layer 4: Fuzzy matching
    const fuzzyResult = this.findBestFuzzyMatch(gameName, allGames);
    if (fuzzyResult) {
      return {
        game: fuzzyResult.game,
        confidence: Math.round(fuzzyResult.score * 100),
        method: 'fuzzy',
      };
    }

    return null;
  }

  /**
   * Extract simplified name (text before colon)
   */
  extractSimplifiedName(name) {
    const simplified = name.split(':')[0].trim();
    return simplified !== name ? simplified : null;
  }

  /**
   * Extract core title from game name by removing common suffixes and platform indicators
   */
  extractCoreTitle(name) {
    return (
      name
        // Remove everything after common separators
        .split(/\s+(-|–|—|:|\|)\s+/)[0]
        // Remove platform indicators and everything after
        .replace(/\s+(PS[345]|Xbox|PC|Nintendo|Switch).*$/gi, '')
        // Remove trademark symbols
        .replace(/[™®©&]/g, '')
        .trim()
    );
  }

  async connectPlatform(userId, platform, credentials) {
    let platformData;

    switch (platform) {
      case Platform.STEAM: {
        // Steam now uses OAuth - redirect users to /api/oauth/steam instead
        throw new BadRequestError(
          'STEAM_OAUTH_REQUIRED',
          'Please use OAuth to connect your Steam account. Visit /api/oauth/steam'
        );
      }

      case Platform.XBOX: {
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
      }

      case Platform.PSN: {
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
      }

      case Platform.NINTENDO:
        throw new BadRequestError(ErrorCode.NINTENDO_NOT_IMPLEMENTED);

      case Platform.EPIC:
        throw new BadRequestError(ErrorCode.EPIC_NOT_IMPLEMENTED);

      default:
        throw new BadRequestError(ErrorCode.PLATFORM_UNKNOWN);
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
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
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

    return { message: SuccessMessages.PLATFORM_DISCONNECTED };
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
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
    }

    try {
      // Send initial progress
      if (onProgress) {
        onProgress({ type: 'status', message: `Fetching games from ${platform}...`, progress: 0 });
      }

      let externalGames = [];

      switch (platform) {
        case Platform.STEAM: {
          // For Steam, get the Steam ID from OAuthConnection
          const oauthConnection = await prisma.oAuthConnection.findUnique({
            where: {
              userId_provider: {
                userId,
                provider: 'steam',
              },
            },
          });

          if (!oauthConnection) {
            throw new NotFoundError(ErrorCode.PLATFORM_NOT_CONNECTED);
          }

          const steamId = oauthConnection.providerUserId;
          externalGames = await steamService.getOwnedGames(steamId);
          break;
        }

        case Platform.XBOX:
          externalGames = await xboxService.getOwnedGames(connection.platformUserId);
          break;

        case Platform.PSN: {
          // Parse the full authorization object from JSON
          const psnAuth = JSON.parse(connection.accessToken);

          // Pass the full authorization object to getUserTitles
          // PSN API uses "me" for the authenticated user
          externalGames = await psnService.getOwnedGames(psnAuth, 'me');
          break;
        }

        case Platform.NINTENDO:
          throw new BadRequestError(ErrorCode.NINTENDO_NOT_IMPLEMENTED);

        case Platform.EPIC:
          throw new BadRequestError(ErrorCode.EPIC_NOT_IMPLEMENTED);

        default:
          throw new BadRequestError(ErrorCode.PLATFORM_UNKNOWN);
      }

      if (onProgress) {
        onProgress({
          type: 'status',
          message: `Found ${externalGames.length} games. Searching IGDB...`,
          progress: 10,
        });
      }

      // Extract core titles for IGDB search
      const coreTitles = externalGames.map(g => this.extractCoreTitle(g.name));

      // Get unique core titles for searching
      const uniqueCoreTitles = [...new Set(coreTitles)];

      // Check if games already exist in our database (cache)
      const cachedGames = await prisma.game.findMany({
        where: {
          OR: uniqueCoreTitles.map(name => ({
            name: { contains: name, mode: 'insensitive' },
          })),
        },
        select: {
          id: true,
          igdbId: true,
          name: true,
          slug: true,
        },
      });

      // Search IGDB for all games (we'll use fuzzy matching to find best results)
      if (onProgress) {
        onProgress({
          type: 'status',
          message: `Buscando ${uniqueCoreTitles.length} jogos no IGDB...`,
          progress: 15,
        });
      }

      const igdbGames = await igdbClient.searchMultipleGames(uniqueCoreTitles);
      console.log(`[Sync] IGDB returned ${igdbGames.length} games`);

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
          // Try cascading search with all layers (including manual mappings)
          let matchResult = await this.findGameMatch(
            externalGame.name,
            cachedGames,
            igdbGames.map(g => ({ ...g, fromIGDB: true })),
            platform
          );

          // If no match found, try with simplified name (before colon)
          if (!matchResult) {
            const simplifiedName = this.extractSimplifiedName(externalGame.name);
            if (simplifiedName) {
              matchResult = await this.findGameMatch(
                simplifiedName,
                cachedGames,
                igdbGames.map(g => ({ ...g, fromIGDB: true })),
                platform
              );
            }
          }

          if (!matchResult) {
            notRecognized.push({
              title: externalGame.name, // Usar 'title' para compatibilidade com o frontend
              originalName: externalGame.name,
              normalizedName: this.normalizeGameName(externalGame.name),
              platform,
              image: externalGame.coverUrl || externalGame.iconUrl || null, // Incluir imagem se disponível
              // Incluir TODOS os dados originais para usar quando mapear
              platformData: {
                hoursPlayed: externalGame.hoursPlayed || 0,
                achievements: externalGame.achievements || [],
                totalAchievements: externalGame.totalAchievements || 0,
                lastPlayed: externalGame.lastPlayed || null,
                platformGameId: externalGame.id || null,
              },
            });
            failed++;
            continue;
          }

          const igdbGame = matchResult.game;

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
              (externalGame.lastPlayedAt &&
                (!existingUserGame.lastPlayedAt ||
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
            await prisma.userGame.create({
              data: {
                userId,
                gameId: game.id,
                status: externalGame.playtime > 0 ? GameStatus.PLAYING : GameStatus.WANT_TO_PLAY,
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

  async createTitleMapping(userId, platform, originalTitle, gameId, platformData = null) {
    console.log('[createTitleMapping] Creating mapping and adding to library:', {
      userId,
      platform,
      originalTitle,
      gameId,
      platformData,
    });

    // Verify game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundError(ErrorCode.GAME_NOT_FOUND);
    }

    // Create or update mapping
    const mapping = await prisma.gameTitleMapping.upsert({
      where: {
        platform_originalTitle: {
          platform,
          originalTitle,
        },
      },
      update: {
        gameId,
        normalizedTitle: this.normalizeGameName(originalTitle),
      },
      create: {
        platform,
        originalTitle,
        normalizedTitle: this.normalizeGameName(originalTitle),
        gameId,
      },
      include: {
        game: true,
      },
    });

    console.log('[createTitleMapping] Mapping created:', mapping.id);

    // Adicionar o jogo na biblioteca do usuário com os dados da plataforma
    const libraryEntry = await prisma.userGame.upsert({
      where: {
        userId_gameId_platform: {
          userId,
          gameId,
          platform,
        },
      },
      update: {
        // Se já existe, atualiza com novos dados se fornecidos
        ...(platformData?.hoursPlayed && { playtime: platformData.hoursPlayed }),
        updatedAt: new Date(),
      },
      create: {
        userId,
        gameId,
        platform,
        status: 'playing', // Default status quando vem de plataforma
        playtime: platformData?.hoursPlayed || 0,
      },
      include: {
        game: true,
      },
    });

    console.log('[createTitleMapping] Added to library:', libraryEntry.id);

    // Se tem achievements, adicionar também
    if (platformData?.achievements && platformData.achievements.length > 0) {
      console.log('[createTitleMapping] Processing achievements:', platformData.achievements.length);

      for (const achievement of platformData.achievements) {
        await prisma.achievement.upsert({
          where: {
            userId_gameId_achievementId: {
              userId,
              gameId,
              achievementId: achievement.id || achievement.name,
            },
          },
          update: {
            unlockedAt: achievement.unlocked ? new Date(achievement.unlockedAt) : null,
          },
          create: {
            userId,
            gameId,
            achievementId: achievement.id || achievement.name,
            name: achievement.name,
            description: achievement.description || null,
            iconUrl: achievement.icon || null,
            unlockedAt: achievement.unlocked ? new Date(achievement.unlockedAt) : null,
          },
        });
      }
    }

    return {
      mapping,
      libraryEntry,
      achievementsCount: platformData?.achievements?.length || 0,
    };
  }

  async deleteTitleMapping(platform, originalTitle) {
    const mapping = await prisma.gameTitleMapping.findUnique({
      where: {
        platform_originalTitle: {
          platform,
          originalTitle,
        },
      },
    });

    if (!mapping) {
      throw new NotFoundError(ErrorCode.MAPPING_NOT_FOUND);
    }

    await prisma.gameTitleMapping.delete({
      where: {
        platform_originalTitle: {
          platform,
          originalTitle,
        },
      },
    });

    return { message: SuccessMessages.MAPPING_DELETED };
  }

  async getTitleMappings(platform = null) {
    const where = platform ? { platform } : {};

    const mappings = await prisma.gameTitleMapping.findMany({
      where,
      include: {
        game: {
          select: {
            id: true,
            name: true,
            coverUrl: true,
            igdbId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return mappings;
  }
}

module.exports = new SyncService();
