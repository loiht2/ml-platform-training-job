#!/bin/bash
set -e

# Test script to submit a training job and verify JSON config format
# This tests the v1.2 backend update

BACKEND_URL="http://192.168.40.246:32269/ml-platform/api"
NAMESPACE="admin"
JOB_NAME="test-json-config-$(date +%Y%m%d%H%M%S)"

echo "=========================================="
echo "Testing Backend v1.2 - JSON Config Format"
echo "=========================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Namespace: $NAMESPACE"
echo "Job Name: $JOB_NAME"
echo ""

# Create a test job payload
cat > /tmp/test-job-payload.json <<'EOF'
{
  "name": "TEST_JOB_NAME",
  "namespace": "admin",
  "algorithm": "xgboost",
  "image": "loihoangthanh1411/ml-platform-xgboost-ray:v1.0",
  "numWorkers": 1,
  "cpuPerWorker": "1",
  "memoryPerWorker": "2Gi",
  "gpuPerWorker": "0",
  "workerGroupSpecs": [
    {
      "groupName": "worker-group",
      "replicas": 1,
      "minReplicas": 1,
      "maxReplicas": 1,
      "rayStartParams": {}
    }
  ],
  "dataSource": {
    "type": "s3",
    "s3": {
      "endpoint": "http://minio.kubeflow.svc.cluster.local:9000",
      "accessKey": "loiht2",
      "secretKey": "E4XWyvYtlS6E9Q92DPq7sJBoJhaa1j7pbLHhgfeZ",
      "region": "us-east-1",
      "bucket": "datasets",
      "trainDataKey": "iris/train.csv",
      "valDataKey": ""
    }
  },
  "labelColumn": "target",
  "hyperparameters": {
    "num_boost_round": 50,
    "early_stopping_rounds": 10
  },
  "xgboostHyperparameters": {
    "booster": "gbtree",
    "eta": 0.3,
    "gamma": 0.0,
    "max_depth": 6,
    "min_child_weight": 1.0,
    "subsample": 1.0,
    "colsample_bytree": 1.0,
    "lambda": 1.0,
    "alpha": 0.0,
    "tree_method": "auto",
    "objective": "reg:squarederror",
    "eval_metric": ["rmse", "mae"],
    "num_parallel_tree": 1,
    "max_leaves": 0,
    "max_bin": 256
  }
}
EOF

# Replace job name in payload
sed -i "s/TEST_JOB_NAME/$JOB_NAME/g" /tmp/test-job-payload.json

echo "Step 1: Submitting training job..."
echo ""

# Note: We need to add Kubeflow auth headers, but for testing let's see the error first
RESPONSE=$(curl -s -X POST "$BACKEND_URL/training-jobs" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-job-payload.json)

echo "Response from backend:"
echo "$RESPONSE" | jq -C '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if job was created
if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Job submission failed. This might be due to authentication."
  echo "   You can test manually through the UI at: http://192.168.40.246:32269"
  echo ""
  echo "   To test manually:"
  echo "   1. Login as admin@dcn.com"
  echo "   2. Navigate to Training Jobs"
  echo "   3. Click 'Create Training Job'"
  echo "   4. Fill in the form and submit"
  echo "   5. Run this command to check the job:"
  echo "      kubectl get rayjob <job-name> -n admin -o yaml | grep -A 100 'TUNING_CONFIG'"
  exit 1
fi

# Extract job name from response
JOB_NAME_FROM_RESPONSE=$(echo "$RESPONSE" | jq -r '.name' 2>/dev/null || echo "$JOB_NAME")

echo "Step 2: Waiting for RayJob to be created..."
sleep 3

echo ""
echo "Step 3: Checking RayJob configuration..."
echo ""

if kubectl get rayjob "$JOB_NAME_FROM_RESPONSE" -n "$NAMESPACE" &>/dev/null; then
  echo "✅ RayJob created successfully: $JOB_NAME_FROM_RESPONSE"
  echo ""
  
  echo "Step 4: Extracting TUNING_CONFIG..."
  echo ""
  
  CONFIG=$(kubectl get rayjob "$JOB_NAME_FROM_RESPONSE" -n "$NAMESPACE" -o yaml | grep -A 100 "TUNING_CONFIG" | head -80)
  
  if echo "$CONFIG" | grep -q "TUNING_CONFIG"; then
    echo "✅ TUNING_CONFIG found in RayJob!"
    echo ""
    echo "Configuration:"
    echo "----------------------------------------"
    echo "$CONFIG"
    echo "----------------------------------------"
    echo ""
    
    # Validate JSON structure
    JSON_CONFIG=$(echo "$CONFIG" | sed -n '/TUNING_CONFIG: |/,/^[^ ]/p' | grep -v "TUNING_CONFIG" | grep -v "^[^ ]" | sed 's/^        //')
    
    if echo "$JSON_CONFIG" | jq '.' &>/dev/null; then
      echo "✅ JSON configuration is valid!"
      echo ""
      echo "Parsed configuration:"
      echo "$JSON_CONFIG" | jq -C '.'
      echo ""
      echo "=========================================="
      echo "✅ SUCCESS: Backend v1.2 JSON Config Works!"
      echo "=========================================="
      echo ""
      echo "Key verification:"
      echo "  - TUNING_CONFIG env var present: ✅"
      echo "  - Valid JSON structure: ✅"
      echo "  - Contains num_worker: $(echo "$JSON_CONFIG" | jq -r '.num_worker')"
      echo "  - Contains s3 config: $(echo "$JSON_CONFIG" | jq -r '.s3.endpoint' | head -c 30)..."
      echo "  - Contains xgboost params: $(echo "$JSON_CONFIG" | jq -r '.xgboost.eta')"
      echo ""
    else
      echo "⚠️  Warning: Could not parse JSON (might be formatting issue)"
      echo "$JSON_CONFIG"
    fi
    
  else
    echo "❌ TUNING_CONFIG not found!"
    echo ""
    echo "RayJob runtimeEnvYAML:"
    kubectl get rayjob "$JOB_NAME_FROM_RESPONSE" -n "$NAMESPACE" -o yaml | grep -A 50 "runtimeEnvYAML"
  fi
  
else
  echo "❌ RayJob not found: $JOB_NAME_FROM_RESPONSE"
  echo ""
  echo "Available RayJobs in namespace $NAMESPACE:"
  kubectl get rayjobs -n "$NAMESPACE"
fi

echo ""
echo "Cleanup: Do you want to delete the test job? (y/N)"
read -r -t 10 CLEANUP || CLEANUP="n"
if [ "$CLEANUP" = "y" ] || [ "$CLEANUP" = "Y" ]; then
  kubectl delete rayjob "$JOB_NAME_FROM_RESPONSE" -n "$NAMESPACE" || true
  echo "✅ Test job deleted"
fi
