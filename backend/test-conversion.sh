#!/bin/bash

# Test script to demonstrate the JSON to RayJob conversion

echo "==================================="
echo "Testing ML Platform Backend"
echo "JSON to RayJob Conversion"
echo "==================================="
echo ""

# Backend URL
BACKEND_URL="http://localhost:8080"

echo "1. Health Check"
echo "   curl $BACKEND_URL/health"
curl -s $BACKEND_URL/health | jq .
echo ""
echo ""

echo "2. List Available Clusters"
echo "   curl $BACKEND_URL/api/v1/proxy/clusters"
curl -s $BACKEND_URL/api/v1/proxy/clusters | jq .
echo ""
echo ""

echo "3. Submit Training Job (XGBoost)"
echo "   Reading from sample/params.json"
echo "   POST $BACKEND_URL/api/v1/jobs"
echo ""

# Read the params.json and add target clusters
PAYLOAD=$(cat /home/ubuntu/loiht2/ml-platform-training-job/backend/sample/params.json | jq '. + {targetClusters: ["cluster-gpu-0", "cluster-gpu-1"]}')

echo "Payload:"
echo "$PAYLOAD" | jq .
echo ""

# Submit the job
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  $BACKEND_URL/api/v1/jobs)

echo "Response:"
echo "$RESPONSE" | jq .
echo ""

# Extract job ID
JOB_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$JOB_ID" != "null" ] && [ -n "$JOB_ID" ]; then
  echo ""
  echo "4. Get Job Status"
  echo "   Job ID: $JOB_ID"
  echo "   curl $BACKEND_URL/api/v1/jobs/$JOB_ID/status"
  sleep 2
  curl -s $BACKEND_URL/api/v1/jobs/$JOB_ID/status | jq .
  echo ""
  echo ""

  echo "5. List All Jobs"
  echo "   curl $BACKEND_URL/api/v1/jobs"
  curl -s $BACKEND_URL/api/v1/jobs | jq '.jobs | length' | xargs -I {} echo "   Total jobs: {}"
  echo ""
  echo ""

  echo "6. Verify RayJob Created in Karmada"
  echo "   kubectl get rayjobs -n default"
  export KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config
  kubectl get rayjobs -n default --no-headers | tail -3
  echo ""
  echo ""

  echo "7. Check PropagationPolicy"
  echo "   kubectl get propagationpolicies -n default"
  kubectl get propagationpolicies -n default --no-headers | tail -3
  echo ""
else
  echo "Failed to create job. Check backend logs."
fi

echo "==================================="
echo "Test Complete"
echo "==================================="
