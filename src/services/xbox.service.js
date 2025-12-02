const axios = require('axios');
const { BadRequestError } = require('../utils/errors');
const xboxRateLimiter = require('../utils/xboxRateLimiter');

/**
 * Xbox Service usando xbl.io API (Application OAuth)
 * Documentação: https://xbl.io/getting-started
 *
 * Fluxo de autenticação:
 * 1. Usuário autoriza app em https://xbl.io/app/auth/{publicKey}
 * 2. xbl.io redireciona com código temporário
 * 3. Backend troca código por secret key em https://xbl.io/app/claim
 * 4. Secret key é usada para requisições com header X-Contract: 100
 *
 * Limites:
 * - Plano Free: 150 requests/hora (documentação atualizada)
 * - Rate limiter configurado para 120 requests/hora (margem de segurança)
 */
class XboxService {
  constructor() {
    this.publicKey = process.env.XBL_IO_PUBLIC_KEY?.trim();
    this.privateKey = process.env.XBL_IO_PRIVATE_KEY?.trim();
    this.baseUrl = 'https://xbl.io/api/v2';
    this.authUrl = 'https://xbl.io/app';

    if (!this.publicKey || !this.privateKey) {
      console.warn('[Xbox] XBL_IO_PUBLIC_KEY ou XBL_IO_PRIVATE_KEY não configuradas no .env');
    } else {
      console.log('[Xbox] Public Key carregada:', this.publicKey.substring(0, 8) + '...');
      console.log('[Xbox] Private Key carregada:', this.privateKey.substring(0, 8) + '...');
    }
  }

  /**
   * Gera URL de autenticação para o usuário
   * @returns {string} URL de autenticação
   */
  getAuthUrl() {
    if (!this.publicKey) {
      throw new BadRequestError('Xbox API não configurada no servidor');
    }
    return `${this.authUrl}/auth/${this.publicKey}`;
  }

  /**
   * Troca código temporário por secret key (access token)
   * @param {string} code - Código temporário recebido do callback
   * @returns {Promise<string>} Secret key do usuário
   */
  async claimSecretKey(code) {
    if (!this.publicKey || !this.privateKey) {
      throw new BadRequestError('Xbox API não configurada no servidor');
    }

    try {
      console.log('[Xbox] Trocando código por secret key...');

      const response = await axios.post(`${this.authUrl}/claim`, {
        code,
        key: this.publicKey,
      }, {
        headers: {
          'X-Authorization': this.privateKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const secretKey = response.data?.key;

      if (!secretKey) {
        throw new BadRequestError('Falha ao obter secret key do xbl.io');
      }

      console.log('[Xbox] Secret key obtida com sucesso:', secretKey.substring(0, 8) + '...');
      return secretKey;

    } catch (error) {
      console.error('[Xbox] Erro ao trocar código:', error.message);

      if (error.response?.status === 400) {
        throw new BadRequestError('Código de autenticação inválido ou expirado');
      }

      throw new BadRequestError('Erro ao autenticar com Xbox');
    }
  }

  /**
   * Faz requisição para a API do Xbox com proteção de rate limit
   * @param {string} endpoint - Endpoint da API
   * @param {string} secretKey - Secret key do usuário (access token)
   * @returns {Promise<any>} Dados da API
   */
  async makeRequest(endpoint, secretKey) {
    // Verifica se as keys estão configuradas
    if (!this.publicKey || !this.privateKey) {
      throw new BadRequestError('Xbox API não configurada no servidor');
    }

    if (!secretKey) {
      throw new BadRequestError('Secret key do usuário não fornecida');
    }

    // Verifica rate limit ANTES de fazer requisição
    const canMakeRequest = xboxRateLimiter.checkLimit();

    if (!canMakeRequest) {
      const waitMinutes = xboxRateLimiter.getMinutesUntilReset();
      const remaining = xboxRateLimiter.getRemainingRequests();

      throw new BadRequestError(
        `Limite de requisições excedido (${remaining}/120 por hora). ` +
        `Aguarde ${waitMinutes} minutos para sincronizar novamente.`
      );
    }

    try {
      const headers = {
        'X-Authorization': secretKey,
        'X-Contract': '100', // Indica que é uma consumer account
        'Accept': 'application/json',
      };

      console.log('[Xbox API] Request URL:', `${this.baseUrl}${endpoint}`);
      console.log('[Xbox API] Headers (secret oculta):', { 'X-Authorization': secretKey.substring(0, 8) + '...', 'X-Contract': '100' });

      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers,
        timeout: 15000, // 15 segundos
      });

      const remaining = xboxRateLimiter.getRemainingRequests();
      console.log(`[Xbox API] Requisição bem-sucedida. Requisições restantes: ${remaining}/120`);

      return response.data;

    } catch (error) {
      // Erro 429: Rate limit excedido pela API
      if (error.response?.status === 429) {
        throw new BadRequestError(
          'Limite de requisições da Xbox API excedido. Tente novamente em 1 hora.'
        );
      }

      // Erro 404: Recurso não encontrado
      if (error.response?.status === 404) {
        throw new BadRequestError(
          'Dados não encontrados ou perfil privado.'
        );
      }

      // Erro 401: Secret key inválida ou revogada
      if (error.response?.status === 401) {
        console.error('[Xbox API] Secret key inválida ou revogada');
        throw new BadRequestError('Sua conexão com Xbox expirou. Reconecte sua conta.');
      }

      console.error('[Xbox API] Erro na requisição:', error.message);
      throw new BadRequestError(
        error.response?.data?.message || 'Erro ao buscar dados do Xbox'
      );
    }
  }

  /**
   * Busca perfil do usuário autenticado
   * @param {string} secretKey - Secret key do usuário
   * @returns {Promise<Object>} Perfil do usuário com xuid, gamertag, etc.
   */
  async getProfile(secretKey) {
    console.log('[Xbox] Buscando perfil do usuário autenticado...');

    const profile = await this.makeRequest('/account', secretKey);

    if (!profile || !profile.xuid) {
      throw new BadRequestError(
        'Não foi possível obter perfil do Xbox. Tente reconectar sua conta.'
      );
    }

    return {
      xuid: profile.xuid,
      gamertag: profile.gamertag,
      gamerscore: profile.gamerScore || 0,
      accountTier: profile.accountTier || 'Free',
    };
  }

  /**
   * Busca jogos do usuário por XUID
   * @param {string} xuid - XUID do usuário
   * @param {string} secretKey - Secret key do usuário
   * @returns {Promise<Array>} Lista de jogos
   */
  async getOwnedGames(xuid, secretKey) {
    if (!xuid) {
      throw new BadRequestError('XUID é obrigatório');
    }

    console.log(`[Xbox] Buscando jogos para XUID: ${xuid}`);

    const gamesData = await this.makeRequest(`/${xuid}/titleHistory`, secretKey);

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
   * @param {string} secretKey - Secret key do usuário
   * @returns {Promise<Array>} Lista de conquistas
   */
  async getAchievements(xuid, titleId, secretKey) {
    console.log(`[Xbox] Buscando conquistas para XUID: ${xuid}, Title: ${titleId}`);

    const achievementsData = await this.makeRequest(`/${xuid}/achievements/${titleId}`, secretKey);

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
      total: 120,
      resetIn: xboxRateLimiter.getMinutesUntilReset(), // minutos
    };
  }

  /**
   * Conecta uma conta Xbox via OAuth (xbl.io app flow)
   * @param {string} code - Código temporário recebido do callback
   * @returns {Promise<Object>} Dados da conexão com secret key
   */
  async connectAccount(code) {
    // 1. Trocar código por secret key (access token)
    const secretKey = await this.claimSecretKey(code);

    // 2. Buscar perfil do usuário (1 request)
    const profile = await this.getProfile(secretKey);

    return {
      platform: 'xbox',
      externalId: profile.xuid,
      username: profile.gamertag,
      accessToken: secretKey, // Secret key do usuário
      metadata: {
        gamerscore: profile.gamerscore,
        accountTier: profile.accountTier,
      },
    };
  }

  /**
   * Sincroniza biblioteca de jogos do Xbox
   * @param {string} xuid - XUID do usuário
   * @param {string} secretKey - Secret key do usuário
   * @returns {Promise<Array>} Lista de jogos
   */
  async syncLibrary(xuid, secretKey) {
    // Buscar jogos (1 request)
    const games = await this.getOwnedGames(xuid, secretKey);

    console.log(`[Xbox] Sincronizado ${games.length} jogos`);
    console.log(`[Xbox] Requisições restantes: ${xboxRateLimiter.getRemainingRequests()}/120`);

    return games;
  }
}

module.exports = new XboxService();
