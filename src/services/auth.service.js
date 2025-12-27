const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');
const { UnauthorizedError, ConflictError, BadRequestError } = require('../utils/errors');
const { ErrorCode } = require('../utils/errorCodes');
const { SuccessMessages } = require('../utils/constants');
const emailService = require('./email.service');

class AuthService {
  async register(email, username, password) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictError(ErrorCode.EMAIL_ALREADY_REGISTERED);
      }
      throw new ConflictError(ErrorCode.USERNAME_ALREADY_TAKEN);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(email, password) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // Check if banned
    if (user.isBanned) {
      throw new UnauthorizedError(ErrorCode.AUTH_ACCOUNT_BANNED, { reason: user.banReason });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Return user without password
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isBanned: true },
      });

      if (!user) {
        throw new UnauthorizedError(ErrorCode.AUTH_USER_NOT_FOUND);
      }

      if (user.isBanned) {
        throw new UnauthorizedError(ErrorCode.AUTH_ACCOUNT_BANNED);
      }

      // Generate new tokens
      const tokens = this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new UnauthorizedError(ErrorCode.AUTH_INVALID_REFRESH_TOKEN);
      }
      throw error;
    }
  }

  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: SuccessMessages.PASSWORD_RESET_EMAIL_SENT };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed token in user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: resetTokenExpiry,
      },
    });

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Continue even if email fails - user can still use the token if in development
    }

    return {
      message: SuccessMessages.PASSWORD_RESET_EMAIL_SENT,
      // In development, return the token
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    };
  }

  async resetPassword(token, newPassword) {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestError(ErrorCode.AUTH_RESET_TOKEN_INVALID);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    return { message: SuccessMessages.PASSWORD_RESET_SUCCESS };
  }

  async oauthLogin(provider, profile) {
    const { id, displayName, photos } = profile;

    const email =
      profile.emails && profile.emails.length > 0 ? profile.emails[0].value : profile.email;

    if (!email) {
      throw new BadRequestError(ErrorCode.AUTH_EMAIL_NOT_PROVIDED);
    }

    // Try to find existing user by OAuth provider ID
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ [`${provider}Id`]: id }, { email }],
      },
    });

    if (user) {
      // Update OAuth ID if user exists but doesn't have it linked
      if (!user[`${provider}Id`]) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { [`${provider}Id`]: id },
        });
      }

      // Check if banned
      if (user.isBanned) {
        throw new UnauthorizedError(ErrorCode.AUTH_ACCOUNT_BANNED, { reason: user.banReason });
      }
    } else {
      // Create new user
      const username = await this.generateUniqueUsername(displayName || email.split('@')[0]);

      user = await prisma.user.create({
        data: {
          email,
          username,
          [`${provider}Id`]: id,
          profileImageUrl: photos && photos.length > 0 ? photos[0].value : null,
          // No password needed for OAuth users
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        },
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Return user without password
    const { passwordHash: _passwordHash2, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  async generateUniqueUsername(baseUsername) {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (!existingUser) {
        return username;
      }

      username = `${baseUsername}${counter}`;
      counter++;
    }
  }

  generateTokens(userId) {
    const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

    return { accessToken, refreshToken };
  }
}

module.exports = new AuthService();
