#!/bin/bash

# Complete Deployment Script for ML Platform Training Job
# This script handles everything: building images, creating secrets, and deploying to K8s

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  ML Platform Training Job - Complete Deployment${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""

# ============================================================================
# Configuration - CHANGE THESE VALUES
# ============================================================================

# Docker Registry
REGISTRY="${DOCKER_REGISTRY:-your-registry.example.com}"
BACKEND_IMAGE="${BACKEND_IMAGE_NAME:-ml-platform-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE_NAME:-ml-platform-frontend}"
VERSION="${VERSION:-latest}"

# Kubernetes Configuration
K8S_NAMESPACE="${K8S_NAMESPACE:-ml-platform}"
INGRESS_DOMAIN="${INGRESS_DOMAIN:-ml-platform-api.example.com}"

# Kubeconfig files - REQUIRED
KARMADA_KUBECONFIG="${KARMADA_KUBECONFIG:-}"
MGMT_KUBECONFIG="${MGMT_KUBECONFIG:-}"
KARMADA_KUBECONFIG=/home/ubuntu/loiht2/karmada.config
MGMT_KUBECONFIG=/home/ubuntu/loiht2/mgmt.config

# Database password
DB_PASSWORD="${DB_PASSWORD:-mlplatform123}"

# Build images? (yes/no)
BUILD_IMAGES="${BUILD_IMAGES:-yes}"

# Push images? (yes/no)
PUSH_IMAGES="${PUSH_IMAGES:-yes}"

# ============================================================================
# Helper Functions
# ============================================================================

print_step() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    local missing=0
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        missing=1
    else
        print_success "kubectl is installed"
    fi
    
    # Check docker (only if building)
    if [ "$BUILD_IMAGES" == "yes" ]; then
        if ! command -v docker &> /dev/null; then
            print_error "Docker is not installed"
            missing=1
        else
            print_success "Docker is installed"
        fi
    fi
    
    # Check kubeconfig files
    if [ -z "$KARMADA_KUBECONFIG" ] || [ ! -f "$KARMADA_KUBECONFIG" ]; then
        print_error "KARMADA_KUBECONFIG is not set or file does not exist"
        print_warning "Set it with: export KARMADA_KUBECONFIG=/path/to/karmada-kubeconfig"
        missing=1
    else
        print_success "Karmada kubeconfig found: $KARMADA_KUBECONFIG"
    fi
    
    if [ -z "$MGMT_KUBECONFIG" ] || [ ! -f "$MGMT_KUBECONFIG" ]; then
        print_error "MGMT_KUBECONFIG is not set or file does not exist"
        print_warning "Set it with: export MGMT_KUBECONFIG=/path/to/mgmt-kubeconfig"
        missing=1
    else
        print_success "Management kubeconfig found: $MGMT_KUBECONFIG"
    fi
    
    if [ $missing -eq 1 ]; then
        print_error "Prerequisites check failed. Please fix the issues above."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# ============================================================================
# Main Deployment Steps
# ============================================================================

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Full image names
BACKEND_IMAGE_FULL="${REGISTRY}/${BACKEND_IMAGE}:${VERSION}"
FRONTEND_IMAGE_FULL="${REGISTRY}/${FRONTEND_IMAGE}:${VERSION}"

# Display configuration
echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Namespace: $K8S_NAMESPACE"
echo "  Backend Image: $BACKEND_IMAGE_FULL"
echo "  Frontend Image: $FRONTEND_IMAGE_FULL"
echo "  Ingress Domain: $INGRESS_DOMAIN"
echo "  Build Images: $BUILD_IMAGES"
echo "  Push Images: $PUSH_IMAGES"
echo ""

# Check prerequisites
check_prerequisites

# Step 1: Build Docker images
if [ "$BUILD_IMAGES" == "yes" ]; then
    print_step "Building Docker images..."
    
    # Build backend
    print_step "Building backend image..."
    cd "$SCRIPT_DIR"
    docker build -t "$BACKEND_IMAGE_FULL" .
    print_success "Backend image built"
    
    # Build frontend
    print_step "Building frontend image..."
    cd "$PROJECT_ROOT/frontend"
    
    # Create Dockerfile if needed
    if [ ! -f "Dockerfile" ]; then
        print_warning "Creating frontend Dockerfile..."
        cat > Dockerfile << 'DOCKER_EOF'
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKER_EOF
    fi
    
    # Create nginx.conf if needed
    if [ ! -f "nginx.conf" ]; then
        print_warning "Creating nginx.conf..."
        cat > nginx.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://ml-platform-backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINX_EOF
    fi
    
    docker build -t "$FRONTEND_IMAGE_FULL" .
    print_success "Frontend image built"
fi

# Step 2: Push images to registry
if [ "$PUSH_IMAGES" == "yes" ]; then
    print_step "Pushing images to registry..."
    
    docker push "$BACKEND_IMAGE_FULL"
    print_success "Backend image pushed"
    
    docker push "$FRONTEND_IMAGE_FULL"
    print_success "Frontend image pushed"
fi

# Step 3: Create namespace
print_step "Creating Kubernetes namespace..."
cd "$SCRIPT_DIR"

kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
print_success "Namespace $K8S_NAMESPACE ready"

# Step 4: Create secrets from kubeconfig files
print_step "Creating secrets from kubeconfig files..."

# Create backend-kubeconfig secret from files
kubectl create secret generic backend-kubeconfig \
    --from-file=karmada-kubeconfig="$KARMADA_KUBECONFIG" \
    --from-file=mgmt-kubeconfig="$MGMT_KUBECONFIG" \
    --namespace="$K8S_NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

print_success "Kubeconfig secrets created"

# Step 5: Create PostgreSQL password secret
print_step "Creating PostgreSQL secret..."

kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
    --namespace="$K8S_NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

print_success "PostgreSQL secret created"

# Step 6: Update deployment YAML with actual values
print_step "Preparing deployment manifests..."

# Create temporary deployment file with substituted values
TEMP_DEPLOY="$SCRIPT_DIR/k8s-deployment-temp.yaml"

sed -e "s|your-registry/ml-platform-backend:latest|${BACKEND_IMAGE_FULL}|g" \
    -e "s|your-registry/ml-platform-frontend:latest|${FRONTEND_IMAGE_FULL}|g" \
    -e "s|ml-platform-api.example.com|${INGRESS_DOMAIN}|g" \
    "$SCRIPT_DIR/k8s-complete-deployment.yaml" > "$TEMP_DEPLOY"

print_success "Deployment manifests prepared"

# Step 7: Deploy to Kubernetes
print_step "Deploying to Kubernetes..."

# Apply namespace first
kubectl apply -f "$SCRIPT_DIR/k8s-namespace.yaml"

# Apply main deployment
kubectl apply -f "$TEMP_DEPLOY"

print_success "Kubernetes resources applied"

# Clean up temp file
rm -f "$TEMP_DEPLOY"

# Step 8: Wait for deployments to be ready
print_step "Waiting for deployments to be ready..."

echo "Waiting for PostgreSQL..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/postgres -n "$K8S_NAMESPACE" 2>/dev/null || print_warning "Timeout waiting for PostgreSQL (may still be starting)"

echo "Waiting for Backend..."
kubectl wait --for=condition=available --timeout=180s \
    deployment/ml-platform-backend -n "$K8S_NAMESPACE" 2>/dev/null || print_warning "Timeout waiting for Backend (may still be starting)"

print_success "Deployments are rolling out"

# Step 9: Display status
print_step "Deployment Status:"
echo ""
kubectl get all -n "$K8S_NAMESPACE"
echo ""
kubectl get ingress -n "$K8S_NAMESPACE"
echo ""

# Step 10: Display access information
echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${YELLOW}Access Information:${NC}"
echo ""
echo "  API Endpoint: http://$INGRESS_DOMAIN"
echo "  Health Check: http://$INGRESS_DOMAIN/health"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo ""
echo "  # Check pod status"
echo "  kubectl get pods -n $K8S_NAMESPACE"
echo ""
echo "  # View backend logs"
echo "  kubectl logs -f -l app=ml-platform-backend -n $K8S_NAMESPACE"
echo ""
echo "  # View PostgreSQL logs"
echo "  kubectl logs -f -l app=postgres -n $K8S_NAMESPACE"
echo ""
echo "  # Port forward for local testing"
echo "  kubectl port-forward svc/ml-platform-backend 8080:8080 -n $K8S_NAMESPACE"
echo ""
echo "  # Access database"
echo "  kubectl exec -it -n $K8S_NAMESPACE \$(kubectl get pod -n $K8S_NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U mlplatform -d training_jobs"
echo ""
echo -e "${GREEN}Setup complete! 🚀${NC}"
echo ""
