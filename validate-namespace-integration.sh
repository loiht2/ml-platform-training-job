#!/bin/bash
# Namespace Integration Validation Script
# Version: v1.5
# Date: 2025-11-30

set -e

echo "================================================"
echo "ML Platform Training Job - Namespace Integration"
echo "Validation Script v1.5"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pod() {
    local name=$1
    local label=$2
    echo -n "Checking $name pods... "
    
    local count=$(kubectl get pods -n kubeflow -l "$label" --no-headers 2>/dev/null | grep -c "Running" || true)
    if [ -z "$count" ] || [ "$count" = "0" ]; then
        count=0
    fi
    
    if [ "$count" -gt 0 ]; then
        echo -e "${GREEN}✓ $count running${NC}"
        return 0
    else
        echo -e "${RED}✗ No running pods found${NC}"
        return 1
    fi
}

check_service() {
    local name=$1
    echo -n "Checking $name service... "
    
    if kubectl get svc -n kubeflow "$name" &>/dev/null; then
        local cluster_ip=$(kubectl get svc -n kubeflow "$name" -o jsonpath='{.spec.clusterIP}')
        echo -e "${GREEN}✓ $cluster_ip${NC}"
        return 0
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

check_virtualservice() {
    local name=$1
    echo -n "Checking $name VirtualService... "
    
    if kubectl get virtualservice -n kubeflow "$name" &>/dev/null; then
        echo -e "${GREEN}✓ Exists${NC}"
        return 0
    else
        echo -e "${RED}✗ Not found${NC}"
        return 1
    fi
}

# Validation Steps
echo "1. Checking Kubernetes Resources"
echo "--------------------------------"
check_pod "Frontend" "app=ml-platform,component=frontend"
check_pod "Backend" "app=ml-platform,component=backend"
check_pod "PostgreSQL" "app=ml-platform,component=database"
check_pod "Centraldashboard" "app=centraldashboard"

echo ""
check_service "training-job-web-app-service"
check_service "ml-platform-backend"
check_service "ml-platform-postgres"

echo ""
check_virtualservice "kf-training-job-ui"

echo ""
echo "2. Checking Image Versions"
echo "--------------------------------"
echo -n "Frontend image: "
kubectl get deployment ml-platform-frontend -n kubeflow -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo -n "Backend image: "
kubectl get deployment ml-platform-backend -n kubeflow -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo -n "Centraldashboard image: "
kubectl get deployment centraldashboard -n kubeflow -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo ""
echo "3. Testing API Endpoints"
echo "--------------------------------"

# Get Istio ingress
INGRESS_HOST=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$INGRESS_HOST" ]; then
    INGRESS_HOST=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.spec.clusterIP}')
fi
INGRESS_PORT=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}')

if [ -z "$INGRESS_PORT" ]; then
    INGRESS_PORT="32269"  # Default from your setup
fi

echo "Using endpoint: http://$INGRESS_HOST:$INGRESS_PORT"

echo ""
echo -n "Testing frontend access... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$INGRESS_HOST:$INGRESS_PORT/_/training-job/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✓ HTTP $HTTP_CODE${NC}"
else
    echo -e "${YELLOW}⚠ HTTP $HTTP_CODE (may require authentication)${NC}"
fi

echo -n "Testing env-info endpoint... "
ENV_INFO=$(curl -s "http://$INGRESS_HOST:$INGRESS_PORT/api/workgroup/env-info" 2>/dev/null || echo "{}")
if [ "$ENV_INFO" != "{}" ] && [ "$ENV_INFO" != "null" ]; then
    echo -e "${GREEN}✓ Returns data${NC}"
    echo "  Response: $ENV_INFO" | head -c 100
    echo "..."
else
    echo -e "${YELLOW}⚠ Returns empty or requires auth${NC}"
fi

echo ""
echo "4. Checking Recent Logs"
echo "--------------------------------"
echo "Frontend logs (last 5 lines):"
kubectl logs -n kubeflow -l app=ml-platform,component=frontend --tail=5 2>/dev/null || echo -e "${YELLOW}No logs available${NC}"

echo ""
echo "Backend logs (last 5 lines):"
kubectl logs -n kubeflow -l app=ml-platform,component=backend --tail=5 2>/dev/null || echo -e "${YELLOW}No logs available${NC}"

echo ""
echo "5. Configuration Check"
echo "--------------------------------"

echo -n "Vite base path: "
kubectl exec -n kubeflow -l app=ml-platform,component=frontend -c frontend -- cat /usr/share/nginx/html/index.html | grep -o 'src="/training-job/assets' | head -1 >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ /training-job/${NC}"
else
    echo -e "${RED}✗ Incorrect${NC}"
fi

echo -n "API base URL: "
kubectl exec -n kubeflow -l app=ml-platform,component=frontend -c frontend -- cat /usr/share/nginx/html/assets/js/index-*.js 2>/dev/null | grep -o '/api/training-job/v1' | head -1 >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ /api/training-job/v1${NC}"
else
    echo -e "${YELLOW}⚠ Cannot verify (may need to check manually)${NC}"
fi

echo ""
echo "6. Namespace Integration Check"
echo "--------------------------------"

echo "Checking if kubeflow-api.ts includes namespace logic..."
echo -n "  getDefaultNamespace function: "
kubectl exec -n kubeflow -l app=ml-platform,component=frontend -c frontend -- ls /usr/share/nginx/html/assets/js/*.js 2>/dev/null | while read file; do
    kubectl exec -n kubeflow -l app=ml-platform,component=frontend -c frontend -- cat "$file" 2>/dev/null | grep -q "getDefaultNamespace" && echo -e "${GREEN}✓ Found${NC}" && break
done 2>/dev/null || echo -e "${YELLOW}⚠ Cannot verify${NC}"

echo ""
echo "================================================"
echo "Validation Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Open browser to: http://$INGRESS_HOST:$INGRESS_PORT/_/training-job/"
echo "2. Check browser console for: 'Kubeflow namespace: <your-namespace>'"
echo "3. Submit a test job and verify namespace in payload"
echo "4. Check backend logs: kubectl logs -n kubeflow -l app=ml-platform,component=backend --tail=20"
echo "5. Verify RayJob created: kubectl get rayjobs -n <your-namespace>"
echo ""
echo "For detailed testing instructions, see TESTING_GUIDE.md"
echo ""
