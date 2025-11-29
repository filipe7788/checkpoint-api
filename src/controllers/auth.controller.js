const authService = require('../services/auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, username, password } = req.body;

      const result = await authService.register(email, username, password);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const result = await authService.forgotPassword(email);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req, res, next) {
    try {
      const result = await authService.oauthLogin('google', req.user);

      // Redirect to app with tokens in URL params (or use deep linking)
      const redirectUrl = `${process.env.APP_DEEP_LINK || 'checkpoint://'}auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;

      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  }

  async appleCallback(req, res, next) {
    try {
      const result = await authService.oauthLogin('apple', req.user);

      // Redirect to app with tokens in URL params (or use deep linking)
      const redirectUrl = `${process.env.APP_DEEP_LINK || 'checkpoint://'}auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;

      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
