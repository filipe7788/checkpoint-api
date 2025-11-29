const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const { ConflictError } = require('../utils/errors');

class OAuthService {
  async findOrCreateUserFromGoogle(profile) {
    const email = profile.emails[0].value;
    const googleId = profile.id;

    // Check if user exists by Google ID or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          // Store Google ID in a metadata field (you'll need to add this to schema)
        ],
      },
    });

    if (!user) {
      // Create new user
      const username = this.generateUsernameFromEmail(email);
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

      user = await prisma.user.create({
        data: {
          email,
          username: await this.ensureUniqueUsername(username),
          passwordHash: randomPassword, // Random password for OAuth users
          avatar: profile.photos?.[0]?.value,
          // You can add a field like: googleId, appleId, etc
        },
      });
    }

    return user;
  }

  async findOrCreateUserFromApple(profile) {
    const email = profile.email;
    const appleId = profile.sub;

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      const username = this.generateUsernameFromEmail(email);
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

      user = await prisma.user.create({
        data: {
          email,
          username: await this.ensureUniqueUsername(username),
          passwordHash: randomPassword,
          // appleId: appleId,
        },
      });
    }

    return user;
  }

  generateUsernameFromEmail(email) {
    return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  }

  async ensureUniqueUsername(baseUsername) {
    let username = baseUsername;
    let counter = 1;

    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}

module.exports = new OAuthService();
