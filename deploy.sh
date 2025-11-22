#!/bin/bash

# ML Platform Deployment Script
# This script deploys both backend and frontend to Kubernetes using NodePort

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ML Platform Deployment (NodePort)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
NAMESPACE="${K8S_NAMESPACE:-ml-platform}"
BACKEND_IMAGE="${BACKEND_IMAGE:-docker.io/loihoangthanh1411/ml-platform-backend:v0.2}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-docker.io/loihoangthanh1411/ml-platform-frontend:v0.2}"
KARMADA_KUBECONFIG="${KARMADA_KUBECONFIG:-/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config}"
MGMT_KUBECONFIG="${MGMT_KUBECONFIG:-/home/ubuntu/loiht2/kubeconfig/mgmt.config}"

echo -e "${BLUE}Configuration:${NC}"
echo "  Namespace: $NAMESPACE"
echo "  Backend Image: $BACKEND_IMAGE"
echo "  Frontend Image: $FRONTEND_IMAGE"
echo "  Karmada Kubeconfig: $KARMADA_KUBECONFIG"
echo "  Management Kubeconfig: $MGMT_KUBECONFIG"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} kubectl found"

if [ ! -f "$KARMADA_KUBECONFIG" ]; then
    echo -e "${RED}Error: Karmada kubeconfig not found at $KARMADA_KUBECONFIG${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Karmada kubeconfig found"

if [ ! -f "$MGMT_KUBECONFIG" ]; then
    echo -e "${RED}Error: Management kubeconfig not found at $MGMT_KUBECONFIG${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Management kubeconfig found"

# Create namespace
echo ""
echo -e "${BLUE}Creating namespace...${NC}"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓${NC} Namespace $NAMESPACE ready"

# Create kubeconfig secrets
echo ""
echo -e "${BLUE}Creating kubeconfig secrets...${NC}"
kubectl create secret generic backend-kubeconfig \
    --from-file=karmada-kubeconfig="$KARMADA_KUBECONFIG" \
    --from-file=mgmt-kubeconfig="$MGMT_KUBECONFIG" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓${NC} Kubeconfig secrets created"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create temporary deployment file with substituted values
echo ""
echo -e "${BLUE}Preparing deployment manifests...${NC}"
TEMP_DEPLOY="$SCRIPT_DIR/k8s-deployment-temp.yaml"

# Read base64 encoded kubeconfigs
KARMADA_BASE64=$(cat "$KARMADA_KUBECONFIG" | base64 -w 0)
MGMT_BASE64=$(cat "$MGMT_KUBECONFIG" | base64 -w 0)

# Substitute values in deployment YAML
sed -e "s|loiht2/ml-platform-backend:latest|${BACKEND_IMAGE}|g" \
    -e "s|loiht2/ml-platform-frontend:latest|${FRONTEND_IMAGE}|g" \
    -e "s|REPLACE_WITH_BASE64_ENCODED_KARMADA_KUBECONFIG|${KARMADA_BASE64}|g" \
    -e "s|REPLACE_WITH_BASE64_ENCODED_MGMT_KUBECONFIG|${MGMT_BASE64}|g" \
    "$SCRIPT_DIR/k8s-deployment.yaml" > "$TEMP_DEPLOY"

echo -e "${GREEN}✓${NC} Deployment manifests prepared"

# Apply deployment
echo ""
echo -e "${BLUE}Deploying to Kubernetes...${NC}"
kubectl apply -f "$TEMP_DEPLOY"
echo -e "${GREEN}✓${NC} Resources deployed"

# Clean up temp file
rm -f "$TEMP_DEPLOY"

# Wait for deployments
echo ""
echo -e "${BLUE}Waiting for deployments to be ready...${NC}"

echo "  Waiting for PostgreSQL..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/postgres -n "$NAMESPACE" 2>/dev/null || \
    echo -e "${YELLOW}⚠${NC} PostgreSQL is still starting (this is normal)"

echo "  Waiting for Backend..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/ml-platform-backend -n "$NAMESPACE" 2>/dev/null || \
    echo -e "${YELLOW}⚠${NC} Backend is still starting (this is normal)"

echo "  Waiting for Frontend..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/ml-platform-frontend -n "$NAMESPACE" 2>/dev/null || \
    echo -e "${YELLOW}⚠${NC} Frontend is still starting (this is normal)"

# Display status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Status${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
kubectl get all -n "$NAMESPACE"

# Get node IP
echo ""
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
if [ -z "$NODE_IP" ]; then
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
fi
if [ -z "$NODE_IP" ]; then
    NODE_IP="<NODE_IP>"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Access Information${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Backend API:${NC}"
echo "  URL: http://${NODE_IP}:30080"
echo "  Health: http://${NODE_IP}:30080/health"
echo "  Test: curl http://${NODE_IP}:30080/health"
echo ""
echo -e "${YELLOW}Frontend:${NC}"
echo "  URL: http://${NODE_IP}:30081"
echo "  Open in browser: http://${NODE_IP}:30081"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo ""
echo "  # Check pod logs"
echo "  kubectl logs -f -l app=ml-platform-backend -n $NAMESPACE"
echo "  kubectl logs -f -l app=ml-platform-frontend -n $NAMESPACE"
echo ""
echo "  # Check pod status"
echo "  kubectl get pods -n $NAMESPACE"
echo ""
echo "  # Describe pods (for troubleshooting)"
echo "  kubectl describe pod <pod-name> -n $NAMESPACE"
echo ""
echo "  # Access PostgreSQL"
echo "  kubectl exec -it -n $NAMESPACE \$(kubectl get pod -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- psql -U mlplatform -d training_jobs"
echo ""
echo -e "${GREEN}Deployment complete! 🚀${NC}"
echo ""
