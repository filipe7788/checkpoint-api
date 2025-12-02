const axios = require('axios');
const { BadRequestError } = require('../utils/errors');
const xboxRateLimiter = require('../utils/xboxRateLimiter');

/**
 * Xbox Service usando xbl.io API (API pública)
 * Documentação: https://xbl.io/
 *
 * Limites:
 * - Plano Free: 120 requests/hora
 * - Rate limiter configurado para 100 requests/hora (margem de segurança)
 */
class XboxService {
  constructor() {
    this.apiKey = process.env.XBL_IO_API_KEY;
    this.baseUrl = 'https://xbl.io/api/v2';

    if (!this.apiKey) {
      console.warn('[Xbox] XBL_IO_API_KEY não configurada no .env');
    }
  }

  /**
   * Faz requisição para a API do Xbox com proteção de rate limit
   * @param {string} endpoint - Endpoint da API
   * @returns {Promise<any>} Dados da API
   */
  async makeRequest(endpoint) {
    // Verifica se a API key está configurada
    if (!this.apiKey) {
      throw new BadRequestError('Xbox API key não configurada no servidor');
    }

    // Verifica rate limit ANTES de fazer requisição
    const canMakeRequest = xboxRateLimiter.checkLimit();

    if (!canMakeRequest) {
      const waitMinutes = xboxRateLimiter.getMinutesUntilReset();
      const remaining = xboxRateLimiter.getRemainingRequests();

      throw new BadRequestError(
        `Limite de requisições excedido (${remaining}/100 por hora). ` +
        `Aguarde ${waitMinutes} minutos para sincronizar novamente.`
      );
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Authorization': this.apiKey,
          'Accept': 'application/json',
        },
        timeout: 15000, // 15 segundos
      });

      const remaining = xboxRateLimiter.getRemainingRequests();
      console.log(`[Xbox API] Requisição bem-sucedida. Requisições restantes: ${remaining}/100`);

      return response.data;

    } catch (error) {
      // Erro 429: Rate limit excedido pela API
      if (error.response?.status === 429) {
        throw new BadRequestError(
          'Limite de requisições da Xbox API excedido. Tente novamente em 1 hora.'
        );
      }

      // Erro 404: Gamertag não encontrada
      if (error.response?.status === 404) {
        throw new BadRequestError(
          'Gamertag não encontrada. Verifique se digitou corretamente.'
        );
      }

      // Erro 401: API key inválida
      if (error.response?.status === 401) {
        console.error('[Xbox API] API key inválida ou expirada');
        throw new BadRequestError('Erro de autenticação com Xbox API');
      }

      console.error('[Xbox API] Erro na requisição:', error.message);
      throw new BadRequestError(
        error.response?.data?.message || 'Erro ao buscar dados do Xbox'
      );
    }
  }

  /**
   * Busca perfil do usuário por Gamertag
   * @param {string} gamertag - Gamertag do Xbox
   * @returns {Promise<Object>} Perfil do usuário com xuid, gamertag, etc.
   */
  async getProfileByGamertag(gamertag) {
    if (!gamertag || typeof gamertag !== 'string') {
      throw new BadRequestError('Gamertag inválida');
    }

    const cleanGamertag = gamertag.trim();
    if (cleanGamertag.length === 0) {
      throw new BadRequestError('Gamertag não pode estar vazia');
    }

    console.log(`[Xbox] Buscando perfil para Gamertag: ${cleanGamertag}`);

    const profile = await this.makeRequest(`/account/${encodeURIComponent(cleanGamertag)}`);

    if (!profile || !profile.xuid) {
      throw new BadRequestError(
        'Perfil não encontrado ou privado. Verifique se a Gamertag está correta e se o perfil é público.'
      );
    }

    return {
      xuid: profile.xuid,
      gamertag: profile.gamertag || cleanGamertag,
      gamerscore: profile.gamerScore || 0,
      accountTier: profile.accountTier || 'Free',
    };
  }

  /**
   * Busca jogos do usuário por XUID
   * @param {string} xuid - XUID do usuário
   * @returns {Promise<Array>} Lista de jogos
   */
  async getOwnedGames(xuid) {
    if (!xuid) {
      throw new BadRequestError('XUID é obrigatório');
    }

    console.log(`[Xbox] Buscando jogos para XUID: ${xuid}`);

    const gamesData = await this.makeRequest(`/${xuid}/titleHistory`);

    if (!gamesData || !gamesData.titles) {
      return [];
    }

    // Mapeia os jogos para o formato esperado
    return gamesData.titles.map(title => ({
      externalId: String(title.titleId),
      name: title.name,
      platform: 'xbox',
      playtime: this.parsePlaytime(title.stats),
      lastPlayed: title.lastTimePlayed ? new Date(title.lastTimePlayed) : null,
      achievementsEarned: title.achievement?.currentAchievements || 0,
      achievementsTotal: title.achievement?.totalAchievements || 0,
      gamerscore: title.achievement?.currentGamerscore || 0,
    }));
  }

  /**
   * Converte estatísticas de playtime para minutos
   * @param {Object} stats - Estatísticas do jogo
   * @returns {number} Playtime em minutos
   */
  parsePlaytime(stats) {
    if (!stats) return 0;

    // Se tiver playtime em segundos
    if (stats.playtime) {
      return Math.floor(stats.playtime / 60);
    }

    // Se tiver outro formato de tempo
    return 0;
  }

  /**
   * Busca conquistas de um jogo específico
   * @param {string} xuid - XUID do usuário
   * @param {string} titleId - ID do jogo
   * @returns {Promise<Array>} Lista de conquistas
   */
  async getAchievements(xuid, titleId) {
    console.log(`[Xbox] Buscando conquistas para XUID: ${xuid}, Title: ${titleId}`);

    const achievementsData = await this.makeRequest(`/${xuid}/achievements/${titleId}`);

    if (!achievementsData || !achievementsData.achievements) {
      return [];
    }

    return achievementsData.achievements;
  }

  /**
   * Retorna informações sobre quota de requisições
   * @returns {Object} Informações de quota
   */
  getQuotaInfo() {
    return {
      remaining: xboxRateLimiter.getRemainingRequests(),
      total: 100,
      resetIn: xboxRateLimiter.getMinutesUntilReset(), // minutos
    };
  }

  /**
   * Conecta uma conta Xbox manualmente via Gamertag
   * @param {string} gamertag - Gamertag do usuário
   * @returns {Promise<Object>} Dados da conexão
   */
  async connectAccount(gamertag) {
    // 1. Buscar perfil (1 request)
    const profile = await this.getProfileByGamertag(gamertag);

    return {
      platform: 'xbox',
      externalId: profile.xuid,
      username: profile.gamertag,
      metadata: {
        gamerscore: profile.gamerscore,
        accountTier: profile.accountTier,
      },
    };
  }

  /**
   * Sincroniza biblioteca de jogos do Xbox
   * @param {string} xuid - XUID do usuário
   * @returns {Promise<Array>} Lista de jogos
   */
  async syncLibrary(xuid) {
    // Buscar jogos (1 request)
    const games = await this.getOwnedGames(xuid);

    console.log(`[Xbox] Sincronizado ${games.length} jogos`);
    console.log(`[Xbox] Requisições restantes: ${xboxRateLimiter.getRemainingRequests()}/100`);

    return games;
  }
}

module.exports = new XboxService();
