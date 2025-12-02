/**
 * Rate Limiter para Xbox API (xbl.io)
 * Limite: 100 requests/hora (margem de segurança - API permite 120/hora)
 */
class XboxRateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 100; // Margem de segurança (API real: 120/hora)
    this.windowMs = 60 * 60 * 1000; // 1 hora em ms
  }

  /**
   * Verifica se pode fazer uma requisição
   * @returns {boolean} true se pode fazer requisição, false se excedeu limite
   */
  checkLimit() {
    const now = Date.now();

    // Remove requisições antigas (fora da janela de 1 hora)
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // Verifica se atingiu o limite
    if (this.requests.length >= this.maxRequests) {
      return false; // Limite atingido
    }

    // Registra nova requisição
    this.requests.push(now);
    return true; // OK para fazer requisição
  }

  /**
   * Retorna quantas requisições ainda podem ser feitas
   * @returns {number} Número de requisições restantes
   */
  getRemainingRequests() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.maxRequests - this.requests.length;
  }

  /**
   * Retorna quando o limite será resetado
   * @returns {number} Timestamp (ms) de quando o limite reseta
   */
  getResetTime() {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + this.windowMs;
  }

  /**
   * Retorna quantos minutos faltam para resetar o limite
   * @returns {number} Minutos até resetar
   */
  getMinutesUntilReset() {
    const resetTime = this.getResetTime();
    if (resetTime === 0) return 0;
    return Math.ceil((resetTime - Date.now()) / 1000 / 60);
  }
}

// Singleton - uma única instância compartilhada
const xboxRateLimiter = new XboxRateLimiter();

module.exports = xboxRateLimiter;
