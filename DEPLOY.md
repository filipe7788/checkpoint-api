# Deploy CheckPoint API no EC2 com api.checkpoints.cc

## 🚀 Guia Completo de Deploy

### Pré-requisitos
- ✅ Instância EC2 rodando Ubuntu
- ✅ Domínio `api.checkpoints.cc` apontando para o IP da EC2
- ✅ Docker instalado no EC2
- ✅ GitHub repository configurado

---

## 1️⃣ Configurar DNS

Certifique-se que o domínio está apontando para o EC2:

```bash
# Testar DNS
nslookup api.checkpoints.cc
```

Deve retornar o IP da sua instância EC2.

---

## 2️⃣ Configurar EC2

### SSH na instância

```bash
ssh ubuntu@api.checkpoints.cc
# ou
ssh ubuntu@SEU_IP_EC2
```

### Instalar Docker (se ainda não tiver)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker ubuntu

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Relogar para aplicar permissões
exit
ssh ubuntu@api.checkpoints.cc
```

### Instalar Git e clonar projeto

```bash
# Instalar Git
sudo apt install git -y

# Clonar repositório
cd ~
git clone https://github.com/SEU_USERNAME/checkpoint-api.git
cd checkpoint-api
```

---

## 3️⃣ Configurar Variáveis de Ambiente

```bash
# Copiar template
cp .env.example .env

# Editar com variáveis de produção
nano .env
```

**Configuração de produção:**

```env
# Server
PORT=3000
NODE_ENV=production

# Database (será criado pelo Docker Compose)
DATABASE_URL=postgresql://checkpoint:SENHA_FORTE_AQUI@db:5432/checkpoint

# JWT (gere um secret forte)
JWT_SECRET=GERE_UM_SECRET_MUITO_FORTE_AQUI
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# IGDB (Twitch)
TWITCH_CLIENT_ID=seu-client-id
TWITCH_CLIENT_SECRET=seu-client-secret

# Steam
STEAM_API_KEY=sua-steam-api-key

# Xbox
XBOX_CLIENT_ID=seu-xbox-client-id
XBOX_CLIENT_SECRET=seu-xbox-client-secret
XBOX_REDIRECT_URI=https://api.checkpoints.cc/api/sync/callback/xbox

# URLs
APP_URL=https://api.checkpoints.cc
FRONTEND_URL=https://checkpoints.cc

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Gerar secrets fortes:**

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Database password
openssl rand -base64 32
```

---

## 4️⃣ Configurar Nginx como Reverse Proxy

### Instalar Nginx

```bash
sudo apt install nginx -y
```

### Criar configuração do site

```bash
sudo nano /etc/nginx/sites-available/checkpoint
```

**Conteúdo:**

```nginx
server {
    listen 80;
    server_name api.checkpoints.cc;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.checkpoints.cc;

    # Certificados SSL (serão gerados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/api.checkpoints.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.checkpoints.cc/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Logs
    access_log /var/log/nginx/checkpoint-access.log;
    error_log /var/log/nginx/checkpoint-error.log;

    # Proxy para API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }

    # Limite de upload (para futuras features de imagem)
    client_max_body_size 10M;
}
```

### Ativar site

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/checkpoint /etc/nginx/sites-enabled/

# Remover site padrão
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t
```

---

## 5️⃣ Configurar SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificado SSL
sudo certbot --nginx -d api.checkpoints.cc

# Seguir instruções:
# - Fornecer email
# - Aceitar termos
# - Escolher opção 2 (redirecionar HTTP para HTTPS)
```

**Renovação automática:**

```bash
# Testar renovação
sudo certbot renew --dry-run

# Certbot já configura cron automático
# Verificar:
sudo systemctl status certbot.timer
```

---

## 6️⃣ Iniciar Aplicação

```bash
cd ~/checkpoint-api

# Build e start com Docker Compose
docker-compose up -d

# Rodar migrations
docker-compose exec api npx prisma migrate deploy

# Verificar logs
docker-compose logs -f api
```

---

## 7️⃣ Configurar GitHub Actions

### Adicionar secrets no GitHub

Vá em: **Settings > Secrets and variables > Actions > New repository secret**

Adicione os seguintes secrets:

```
DOCKER_USERNAME       → seu username do Docker Hub
DOCKER_PASSWORD       → token do Docker Hub
EC2_HOST             → api.checkpoints.cc (ou IP)
EC2_USERNAME         → ubuntu
EC2_SSH_KEY          → chave SSH privada completa
API_URL              → https://api.checkpoints.cc
```

**Gerar chave SSH para CI/CD:**

```bash
# Na sua máquina local
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/checkpoint-deploy

# Copiar chave pública para EC2
ssh-copy-id -i ~/.ssh/checkpoint-deploy.pub ubuntu@api.checkpoints.cc

# Copiar chave PRIVADA e adicionar como secret EC2_SSH_KEY no GitHub
cat ~/.ssh/checkpoint-deploy
```

### Testar deploy automático

```bash
# Na sua máquina local
git add .
git commit -m "Configure production deploy"
git push origin main
```

GitHub Actions vai automaticamente:
1. ✅ Rodar testes e lint
2. ✅ Build Docker image
3. ✅ Push para Docker Hub
4. ✅ SSH no EC2
5. ✅ Pull código e imagem
6. ✅ Rodar migrations
7. ✅ Restart containers
8. ✅ Health check

---

## 8️⃣ Verificar Deploy

```bash
# Testar API
curl https://api.checkpoints.cc/api/health

# Deve retornar:
{
  "success": true,
  "message": "CheckPoint API is running",
  "timestamp": "..."
}
```

**Testar endpoints:**

```bash
# Registrar usuário
curl -X POST https://api.checkpoints.cc/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'

# Login
curl -X POST https://api.checkpoints.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## 9️⃣ Monitoramento e Logs

### Ver logs da aplicação

```bash
# Logs em tempo real
docker-compose logs -f api

# Logs do Nginx
sudo tail -f /var/log/nginx/checkpoint-access.log
sudo tail -f /var/log/nginx/checkpoint-error.log

# Status dos containers
docker-compose ps
```

### Restart containers

```bash
cd ~/checkpoint-api
docker-compose restart api
```

### Atualizar código manualmente

```bash
cd ~/checkpoint-api
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose exec api npx prisma migrate deploy
```

---

## 🔒 Security Checklist

- [x] Firewall configurado (apenas portas 80, 443, 22)
- [x] SSL/HTTPS ativo
- [x] Secrets fortes no .env
- [x] Rate limiting ativo
- [x] Helmet.js configurado
- [x] CORS restrito ao frontend
- [x] Database password forte
- [x] SSH com chave (não senha)
- [x] Auto-renovação SSL

### Configurar Firewall (UFW)

```bash
# Ativar firewall
sudo ufw enable

# Permitir apenas portas necessárias
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Verificar
sudo ufw status
```

---

## 📊 Backup do Banco

### Backup manual

```bash
# Exportar banco
docker-compose exec db pg_dump -U checkpoint checkpoint > backup-$(date +%Y%m%d).sql

# Restaurar
docker-compose exec -T db psql -U checkpoint checkpoint < backup-20240128.sql
```

### Backup automático (cron)

```bash
# Criar script de backup
nano ~/backup-db.sh
```

**Conteúdo:**

```bash
#!/bin/bash
cd ~/checkpoint-api
docker-compose exec -T db pg_dump -U checkpoint checkpoint > ~/backups/checkpoint-$(date +%Y%m%d-%H%M%S).sql
# Manter apenas últimos 7 dias
find ~/backups -name "checkpoint-*.sql" -mtime +7 -delete
```

```bash
# Tornar executável
chmod +x ~/backup-db.sh

# Criar pasta de backups
mkdir -p ~/backups

# Adicionar ao cron (diário às 3am)
crontab -e
# Adicionar:
0 3 * * * /home/ubuntu/backup-db.sh
```

---

## 🔄 Rollback em caso de problema

```bash
cd ~/checkpoint-api

# Ver imagens disponíveis
docker images

# Rollback para versão anterior
docker-compose down
docker tag checkpoint-api:latest checkpoint-api:backup
docker pull SEU_USUARIO/checkpoint-api:VERSAO_ANTERIOR
docker-compose up -d
```

---

## 📈 Próximos Passos

- [ ] Configurar monitoramento (Grafana/Prometheus)
- [ ] Configurar alertas (email/Slack)
- [ ] CDN para assets estáticos (CloudFront)
- [ ] Database scaling (read replicas)
- [ ] Redis para caching
- [ ] Backup automático para S3

---

**🎉 API deployada com sucesso em https://api.checkpoints.cc!**
