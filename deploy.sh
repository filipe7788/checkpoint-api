#!/bin/bash

# Deploy Script for CheckPoint API to EC2
# Usage: ./deploy.sh [production|staging]

set -e

ENV=${1:-production}
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   CheckPoint API - Deploy Script     ║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if environment is specified
if [ "$ENV" != "production" ] && [ "$ENV" != "staging" ]; then
    echo -e "${RED}❌ Invalid environment: $ENV${NC}"
    echo "Usage: ./deploy.sh [production|staging]"
    exit 1
fi

echo -e "${YELLOW}📦 Environment: ${BOLD}$ENV${NC}"
echo ""

# Load environment variables
if [ -f ".env.$ENV" ]; then
    echo -e "${GREEN}✓ Loading .env.$ENV${NC}"
    export $(cat .env.$ENV | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    echo -e "${YELLOW}⚠ Using default .env file${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ No .env file found!${NC}"
    exit 1
fi

# Check required variables
if [ -z "$EC2_HOST" ]; then
    echo -e "${RED}❌ EC2_HOST not set in .env${NC}"
    exit 1
fi

if [ -z "$EC2_USER" ]; then
    EC2_USER="ubuntu"
    echo -e "${YELLOW}⚠ EC2_USER not set, using default: ubuntu${NC}"
fi

if [ -z "$EC2_SSH_KEY" ]; then
    echo -e "${RED}❌ EC2_SSH_KEY not set in .env${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}📋 Deployment Summary:${NC}"
echo -e "  Host: ${GREEN}$EC2_HOST${NC}"
echo -e "  User: ${GREEN}$EC2_USER${NC}"
echo -e "  Path: ${GREEN}/home/$EC2_USER/checkpoint-api${NC}"
echo ""

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}🚀 Starting deployment...${NC}"
echo ""

# Step 1: Create deployment package
echo -e "${YELLOW}[1/6]${NC} Creating deployment package..."
tar -czf checkpoint-api.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='checkpoint-api.tar.gz' \
    .
echo -e "${GREEN}✓ Package created${NC}"

# Step 2: Upload to EC2
echo -e "${YELLOW}[2/6]${NC} Uploading to EC2..."
scp -i "$EC2_SSH_KEY" checkpoint-api.tar.gz $EC2_USER@$EC2_HOST:/tmp/
echo -e "${GREEN}✓ Upload complete${NC}"

# Step 3: Deploy on EC2
echo -e "${YELLOW}[3/6]${NC} Deploying on EC2..."
ssh -i "$EC2_SSH_KEY" $EC2_USER@$EC2_HOST << 'ENDSSH'
    set -e

    # Create directory if it doesn't exist
    mkdir -p /home/ubuntu/checkpoint-api
    cd /home/ubuntu/checkpoint-api

    # Extract new code
    tar -xzf /tmp/checkpoint-api.tar.gz
    rm /tmp/checkpoint-api.tar.gz

    echo "✓ Code extracted"
ENDSSH
echo -e "${GREEN}✓ Deployment complete${NC}"

# Step 4: Copy environment file
echo -e "${YELLOW}[4/6]${NC} Copying environment variables..."
if [ -f ".env.$ENV" ]; then
    scp -i "$EC2_SSH_KEY" .env.$ENV $EC2_USER@$EC2_HOST:/home/$EC2_USER/checkpoint-api/.env
else
    echo -e "${YELLOW}⚠ Warning: .env.$ENV not found, you'll need to configure .env manually on EC2${NC}"
fi
echo -e "${GREEN}✓ Environment variables copied${NC}"

# Step 5: Build and start containers
echo -e "${YELLOW}[5/6]${NC} Building and starting containers..."
ssh -i "$EC2_SSH_KEY" $EC2_USER@$EC2_HOST << 'ENDSSH'
    set -e
    cd /home/ubuntu/checkpoint-api

    # Stop existing containers
    docker-compose down || true

    # Build new images
    docker-compose build

    # Run migrations
    docker-compose run --rm api npx prisma migrate deploy

    # Start containers
    docker-compose up -d

    # Show status
    docker-compose ps

    echo "✓ Containers started"
ENDSSH
echo -e "${GREEN}✓ Containers running${NC}"

# Step 6: Health check
echo -e "${YELLOW}[6/6]${NC} Running health check..."
sleep 5
if curl -f "http://$EC2_HOST:3000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed!${NC}"
    echo -e "${YELLOW}Check logs with: ssh -i $EC2_SSH_KEY $EC2_USER@$EC2_HOST 'cd /home/ubuntu/checkpoint-api && docker-compose logs -f api'${NC}"
    exit 1
fi

# Cleanup
rm -f checkpoint-api.tar.gz

echo ""
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   🎉 Deployment Successful!           ║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}API URL:${NC} http://$EC2_HOST:3000"
echo -e "${BOLD}View logs:${NC} ssh -i $EC2_SSH_KEY $EC2_USER@$EC2_HOST 'cd /home/ubuntu/checkpoint-api && docker-compose logs -f api'"
echo ""
