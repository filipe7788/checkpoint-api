const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');
const {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError
} = require('../utils/errors');

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
        throw new ConflictError('Email already registered');
      }
      throw new ConflictError('Username already taken');
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
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if banned
    if (user.isBanned) {
      throw new UnauthorizedError(`Account banned: ${user.banReason || 'Violation of terms'}`);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);

    // Return user without password
    const { passwordHash, ...userWithoutPassword } = user;

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
        throw new UnauthorizedError('User not found');
      }

      if (user.isBanned) {
        throw new UnauthorizedError('Account banned');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Invalid or expired refresh token');
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
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed token in user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Note: You'll need to add these fields to the User model
        // resetPasswordToken: resetTokenHash,
        // resetPasswordExpiry: resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    // For now, just log it (in production, use a mailer service)
    console.log(`[AUTH] Password reset token for ${email}: ${resetToken}`);
    console.log(`[AUTH] Reset link: ${process.env.APP_URL}/reset-password?token=${resetToken}`);

    return {
      message: 'If the email exists, a reset link has been sent',
      // In development, return the token
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    };
  }

  async resetPassword(token, newPassword) {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        // resetPasswordToken: resetTokenHash,
        // resetPasswordExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // resetPasswordToken: null,
        // resetPasswordExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
  }
}

module.exports = new AuthService();
