# CheckPoint API

> Backend API for CheckPoint - A "Letterboxd for videogames" platform to catalog, review, and share your gaming journey.

![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)

---

## 📋 Features

### Core Features
- ✅ **User Authentication** - Register, login, JWT tokens, password reset
- ✅ **Game Library Management** - Add games with status (playing, completed, backlog, etc)
- ✅ **Reviews System** - Rate and review games (1-5 stars + text)
- ✅ **Social Features** - Follow/unfollow users, activity feed
- ✅ **Platform Sync** - Auto-sync libraries from Steam, Xbox, PSN, Nintendo, Epic

### Platform Integration Status
| Platform | Status | Type | Playtime Support |
|----------|--------|------|------------------|
| Steam | ✅ Stable | Official API | ✅ Yes |
| Xbox | ✅ Stable | Official API | ✅ Yes |
| PSN | 🧪 Experimental | Unofficial | ❌ No |
| Nintendo | 🚧 Planned | Unofficial | - |
| Epic | 🚧 Planned | Unofficial | - |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 20.x
- **Docker** & **Docker Compose**
- **PostgreSQL** 15+ (or use Docker)

### 1. Clone & Install

```bash
cd checkpoint-api
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
DATABASE_URL=postgresql://checkpoint:checkpoint@localhost:5432/checkpoint

# JWT
JWT_SECRET=your-super-secret-key

# IGDB (Required - Get from https://dev.twitch.tv/console/apps)
TWITCH_CLIENT_ID=your-client-id
TWITCH_CLIENT_SECRET=your-client-secret

# Steam (Required - Get from https://steamcommunity.com/dev/apikey)
STEAM_API_KEY=your-steam-api-key

# Xbox (Optional - Azure AD App)
XBOX_CLIENT_ID=your-xbox-client-id
XBOX_CLIENT_SECRET=your-xbox-client-secret
XBOX_REDIRECT_URI=https://api.checkpoints.cc/api/sync/callback/xbox
```

### 3. Database Setup

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d db
npx prisma migrate deploy
npx prisma generate
```

**Option B: Local PostgreSQL**

```bash
# Create database
createdb checkpoint

# Run migrations
npx prisma migrate deploy
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
```

Server will be running at: **http://localhost:3000**

---

## 🐳 Docker Deployment

### Development

```bash
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
docker-compose up -d
```

Includes:
- PostgreSQL database with persistent volume
- API with auto-restart
- Health checks
- Network isolation

---

## 📁 Project Structure

```
checkpoint-api/
├── src/
│   ├── config/           # Database, IGDB, platform configs
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   │   ├── auth.service.js
│   │   ├── game.service.js
│   │   ├── library.service.js
│   │   ├── review.service.js
│   │   ├── steam.service.js
│   │   ├── xbox.service.js
│   │   └── sync.service.js
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, validation, error handling
│   ├── utils/            # Constants, errors
│   └── app.js            # Express app entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── .github/workflows/    # CI/CD pipelines
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register          - Create account
POST   /api/auth/login             - Login
POST   /api/auth/refresh           - Refresh JWT token
POST   /api/auth/forgot-password   - Request password reset
POST   /api/auth/reset-password    - Reset password
```

### Users
```
GET    /api/users/me               - Get current user profile
PUT    /api/users/me               - Update profile
GET    /api/users/me/stats         - Get user statistics
GET    /api/users/:username        - Get user by username
GET    /api/users/:id/followers    - Get followers
GET    /api/users/:id/following    - Get following
```

### Games
```
GET    /api/games/search?q=        - Search games (IGDB)
GET    /api/games/:id              - Get game details
GET    /api/games/popular          - Get popular games
GET    /api/games/genre/:genre     - Get games by genre
```

### Library
```
POST   /api/library                - Add game to library
GET    /api/library                - Get user's library
GET    /api/library/:id            - Get library item
PUT    /api/library/:id            - Update library item
DELETE /api/library/:id            - Remove from library
```

### Reviews
```
POST   /api/reviews                - Create review
PUT    /api/reviews/:id            - Update review
DELETE /api/reviews/:id            - Delete review
GET    /api/reviews/game/:gameId   - Get reviews for game
GET    /api/reviews/user/:userId   - Get user's reviews
POST   /api/reviews/:id/like       - Like review
DELETE /api/reviews/:id/like       - Unlike review
```

### Social
```
POST   /api/follow/:id             - Follow user
DELETE /api/follow/:id             - Unfollow user
GET    /api/follow/:id/check       - Check if following
```

### Activity Feed
```
GET    /api/feed                   - Get activity feed
GET    /api/feed/now-playing       - Get friends playing now
```

### Platform Sync
```
GET    /api/sync/status            - Get sync status
POST   /api/sync/connect/:platform - Initiate connection
GET    /api/sync/callback/:platform - OAuth callback
POST   /api/sync/:platform         - Manual connect (PSN)
DELETE /api/sync/disconnect/:platform - Disconnect
POST   /api/sync/:platform/sync    - Sync platform
POST   /api/sync/all               - Sync all platforms
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

---

## 🚢 Deployment

### GitHub Actions CI/CD

The project includes automated CI/CD pipelines:

**On Pull Request:**
- ✅ Lint code
- ✅ Run tests
- ✅ Validate Prisma schema

**On Push to Main:**
- ✅ Build Docker image
- ✅ Push to Docker Hub
- ✅ Deploy to EC2
- ✅ Run migrations
- ✅ Health check

### Required GitHub Secrets

```
DOCKER_USERNAME          - Docker Hub username
DOCKER_PASSWORD          - Docker Hub password/token
EC2_HOST                 - EC2 instance IP
EC2_USERNAME             - SSH username (usually ubuntu)
EC2_SSH_KEY              - Private SSH key for EC2
API_URL                  - Production API URL for health check
```

### Manual EC2 Setup

```bash
# 1. SSH into EC2
ssh ubuntu@your-ec2-ip

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Clone repository
git clone https://github.com/your-username/checkpoint-api.git
cd checkpoint-api

# 4. Create .env file
cp .env.example .env
nano .env  # Add production credentials

# 5. Start with Docker Compose
docker-compose up -d

# 6. Run migrations
docker-compose exec api npx prisma migrate deploy
```

---

## 🔧 Database Management

### Prisma Studio (GUI)

```bash
npx prisma studio
```

Opens at: **http://localhost:5555**

### Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Deploy to production
npx prisma migrate deploy

# Reset database (⚠️ DESTRUCTIVE)
npx prisma migrate reset
```

---

## 🌐 Platform Integration Guides

### Steam Integration

1. Get Steam API Key: https://steamcommunity.com/dev/apikey
2. Add to `.env`: `STEAM_API_KEY=your-key`
3. User flow:
   - Call `POST /api/sync/connect/steam`
   - Redirect user to returned `authUrl`
   - Steam redirects back to callback
   - Auto-creates platform connection

### Xbox Integration

1. Create Azure AD App: https://portal.azure.com
2. Enable Xbox Live API access
3. Add redirect URI: `http://localhost:3000/sync/callback/xbox`
4. Add credentials to `.env`
5. Similar OAuth flow to Steam

### PSN Integration (Experimental)

1. User must manually provide NPSSO token
2. Instructions:
   - Login to https://my.playstation.com
   - Open DevTools > Application > Cookies
   - Copy `npsso` cookie value
3. Call `POST /api/sync/psn` with `{ npsso, accountId }`

---

## 📊 Database Schema

### Main Models
- **User** - Account, profile, stats
- **Game** - IGDB cache
- **UserGame** - User's library entries
- **Review** - Game reviews
- **PlatformConnection** - External platform links
- **Follow** - User relationships
- **ReviewLike** - Review likes
- **Activity** - Social activity feed

See [prisma/schema.prisma](prisma/schema.prisma) for full schema.

---

## 🛡️ Security

- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on all endpoints
- ✅ Helmet.js security headers
- ✅ Input validation with Joi
- ✅ SQL injection protection (Prisma)
- ✅ CORS configuration

---

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `JWT_EXPIRES_IN` | No | JWT expiration (default: 7d) |
| `TWITCH_CLIENT_ID` | Yes | IGDB/Twitch app ID |
| `TWITCH_CLIENT_SECRET` | Yes | IGDB/Twitch app secret |
| `STEAM_API_KEY` | Yes | Steam Web API key |
| `XBOX_CLIENT_ID` | No | Azure AD app client ID |
| `XBOX_CLIENT_SECRET` | No | Azure AD app secret |
| `APP_URL` | Yes | Backend URL for callbacks |
| `FRONTEND_URL` | Yes | Frontend URL for redirects |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🆘 Support & Issues

- 📧 Email: support@checkpoint.app
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/checkpoint-api/issues)
- 📖 Docs: [API Documentation](https://docs.checkpoint.app)

---

**Built with ❤️ for gamers by gamers**
