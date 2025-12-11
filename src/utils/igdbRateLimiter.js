/**
 * IGDB Rate Limiter
 * IGDB allows 4 requests per second on free tier
 * This limiter ensures we don't exceed that limit
 */
class IGDBRateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestsPerSecond = 4;
    this.intervalMs = 1000; // 1 second
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Function that returns a Promise
   * @returns {Promise} - Resolves with the request result
   */
  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the queue with rate limiting
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Reset counter if more than 1 second has passed
      if (timeSinceLastRequest >= this.intervalMs) {
        this.requestCount = 0;
        this.lastRequestTime = now;
      }

      // If we've hit the limit, wait until the next second
      if (this.requestCount >= this.requestsPerSecond) {
        const waitTime = this.intervalMs - timeSinceLastRequest;
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }

      // Process next request
      const { requestFn, resolve, reject } = this.queue.shift();
      this.requestCount++;

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Minimal delay between requests (100ms for safety, still under 4 req/s limit)
      if (this.queue.length > 0) {
        await this.sleep(100);
      }
    }

    this.processing = false;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new IGDBRateLimiter();
