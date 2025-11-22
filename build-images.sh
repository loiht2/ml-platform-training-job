#!/bin/bash

# ML Platform - Build Docker Images
# This script builds both backend and frontend Docker images

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Building ML Platform Images${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
REGISTRY="${DOCKER_REGISTRY:-docker.io/loihoangthanh1411}"
BACKEND_IMAGE="${BACKEND_IMAGE_NAME:-ml-platform-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE_NAME:-ml-platform-frontend}"
VERSION="${VERSION:-v0.3}"

# Full image names
BACKEND_IMAGE_FULL="${REGISTRY}/${BACKEND_IMAGE}:${VERSION}"
FRONTEND_IMAGE_FULL="${REGISTRY}/${FRONTEND_IMAGE}:${VERSION}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Registry: $REGISTRY"
echo "  Backend Image: $BACKEND_IMAGE_FULL"
echo "  Frontend Image: $FRONTEND_IMAGE_FULL"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Build Backend
echo -e "${GREEN}Building Backend...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}Error: Backend Dockerfile not found${NC}"
    exit 1
fi

docker build -t "$BACKEND_IMAGE_FULL" .
echo -e "${GREEN}✓ Backend image built: $BACKEND_IMAGE_FULL${NC}"
echo ""

# Build Frontend
echo -e "${GREEN}Building Frontend...${NC}"
cd "$SCRIPT_DIR/frontend"

# Create optimized nginx.conf if it doesn't exist
if [ ! -f "nginx.conf" ]; then
    echo -e "${YELLOW}Creating optimized nginx.conf...${NC}"
    cat > nginx.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINX_EOF
fi

# Create optimized frontend Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
    echo -e "${YELLOW}Creating optimized frontend Dockerfile...${NC}"
    cat > Dockerfile << 'DOCKER_EOF'
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
DOCKER_EOF
fi

docker build -t "$FRONTEND_IMAGE_FULL" .
echo -e "${GREEN}✓ Frontend image built: $FRONTEND_IMAGE_FULL${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Backend:  $BACKEND_IMAGE_FULL"
echo "  Frontend: $FRONTEND_IMAGE_FULL"
echo ""
echo -e "${GREEN}✓ All images built successfully!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "  1. Push images to registry:"
echo "     docker push $BACKEND_IMAGE_FULL"
echo "     docker push $FRONTEND_IMAGE_FULL"
echo ""
echo "  2. Or deploy directly:"
echo "     ./deploy.sh"
echo ""
