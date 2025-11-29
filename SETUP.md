# CheckPoint API - Setup Guide

## 🚀 Guia Rápido de Instalação

### Passo 1: Instalar Dependências

```bash
npm install
```

### Passo 2: Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

**Edite o arquivo `.env` e configure:**

#### Obrigatórios:
1. **IGDB/Twitch API** (para buscar jogos)
   - Acesse: https://dev.twitch.tv/console/apps
   - Crie um app
   - Copie `Client ID` e `Client Secret`

2. **Steam API** (para sync Steam)
   - Acesse: https://steamcommunity.com/dev/apikey
   - Copie a API Key

3. **JWT_SECRET**
   - Gere um secret forte: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### Opcionais:
- **Xbox** - Azure AD App (se quiser sync Xbox)
- **PSN** - Não precisa (usuário fornece NPSSO)

### Passo 3: Subir o Banco de Dados

**Com Docker (Recomendado):**
```bash
docker-compose up -d db
```

**Ou PostgreSQL local:**
```bash
createdb checkpoint
```

### Passo 4: Rodar Migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### Passo 5: Iniciar o Servidor

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm start
```

---

## ✅ Verificar Instalação

Acesse: http://localhost:3000/api/health

Deve retornar:
```json
{
  "success": true,
  "message": "CheckPoint API is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🧪 Testar Endpoints

### 1. Registrar Usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copie o `accessToken` da resposta.

### 3. Buscar Jogos

```bash
curl -X GET "http://localhost:3000/api/games/search?q=zelda" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

### 4. Adicionar à Biblioteca

```bash
curl -X POST http://localhost:3000/api/library \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -d '{
    "igdbId": 1234,
    "status": "playing",
    "platform": "steam"
  }'
```

---

## 🐳 Deploy com Docker

### Desenvolvimento

```bash
docker-compose -f docker-compose.dev.yml up
```

### Produção

```bash
docker-compose up -d
```

Verifica logs:
```bash
docker-compose logs -f api
```

---

## 🔧 Comandos Úteis

### Prisma

```bash
# Abrir Prisma Studio (GUI do banco)
npx prisma studio

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Resetar banco (CUIDADO!)
npx prisma migrate reset

# Visualizar schema
npx prisma format
```

### Docker

```bash
# Parar tudo
docker-compose down

# Resetar volumes (apaga dados!)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Ver logs
docker-compose logs -f
```

### NPM

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Testes (quando implementados)
npm test
```

---

## 🚨 Troubleshooting

### Erro: "Database connection failed"

**Solução:**
1. Verifique se PostgreSQL está rodando: `docker-compose ps`
2. Verifique `DATABASE_URL` no `.env`
3. Teste conexão: `npx prisma db pull`

### Erro: "IGDB authentication failed"

**Solução:**
1. Verifique `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`
2. Teste manualmente:
```bash
curl -X POST 'https://id.twitch.tv/oauth2/token' \
  -d "client_id=SEU_CLIENT_ID&client_secret=SEU_CLIENT_SECRET&grant_type=client_credentials"
```

### Erro: "Port 3000 already in use"

**Solução:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Erro: "Prisma Client not generated"

**Solução:**
```bash
npx prisma generate
```

---

## 📊 Estrutura do Banco

O Prisma criará automaticamente as seguintes tabelas:

- `User` - Usuários
- `Game` - Cache de jogos (IGDB)
- `UserGame` - Biblioteca pessoal
- `Review` - Reviews
- `PlatformConnection` - Conexões Steam/Xbox/etc
- `Follow` - Seguidores
- `ReviewLike` - Likes em reviews
- `Activity` - Feed de atividades

---

## 🎯 Próximos Passos

1. ✅ Backend rodando
2. 📱 Criar app mobile (React Native + Expo)
3. 🚀 Deploy no EC2
4. 🔐 Configurar SSL/HTTPS
5. 📧 Email service (reset de senha)
6. 🎨 Melhorias no feed social

---

**Precisa de ajuda?** Abra uma issue no GitHub ou consulte o README.md principal.
