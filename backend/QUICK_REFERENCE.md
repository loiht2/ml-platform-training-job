# Quick Reference - JSON to RayJob Conversion

## 🚀 Quick Start

```bash
# Terminal 1: Start Backend
cd /home/ubuntu/loiht2/ml-platform-training-job/backend
export KARMADA_KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config
export MGMT_KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/mgmt.config
export DATABASE_URL="postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs?sslmode=disable"
make run

# Terminal 2: Test
./test-conversion.sh
```

## 📋 Mapping Cheat Sheet

### Basic Mappings
```
jobName              → metadata.name
algorithm.algorithmName → metadata.labels.algorithm
instanceCount        → workerGroupSpecs[0].replicas
cpuCores            → containers[*].resources.cpu
memoryGiB           → containers[*].resources.memory
gpuCount            → containers[*].resources.nvidia.com/gpu
volumeSizeGB        → PVC storage
```

### Environment Variables
```
jobName                     → RUN_NAME
instanceCount               → NUM_WORKER
gpuCount > 0               → USE_GPU="true"
inputDataConfig[0].endpoint → S3_ENDPOINT
inputDataConfig[0].bucket   → S3_BUCKET
inputDataConfig[0].prefix   → S3_TRAIN_KEY
```

### XGBoost Hyperparameters (40+ fields)
```
num_round          → NUM_BOOST_ROUND
eta                → ETA
max_depth          → MAX_DEPTH
gamma              → GAMMA
min_child_weight   → MIN_CHILD_WEIGHT
... (all others follow same pattern)
```

## 🧪 Test Commands

```bash
# Health check
curl http://localhost:8080/health

# List clusters
curl http://localhost:8080/api/v1/proxy/clusters | jq .

# Submit job
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d @sample/params.json | jq .

# List jobs
curl http://localhost:8080/api/v1/jobs | jq .

# Get job status
curl http://localhost:8080/api/v1/jobs/{JOB_ID}/status | jq .
```

## 🔍 Verify in Karmada

```bash
export KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config

# Check RayJobs
kubectl get rayjobs -n default

# Check PropagationPolicies
kubectl get propagationpolicies -n default

# Get RayJob details
kubectl get rayjob {JOB_NAME} -n default -o yaml

# Check distribution
kubectl get work -A
```

## 📦 Request Example

```json
{
  "jobName": "my-xgb-job",
  "priority": 500,
  "algorithm": {
    "algorithmName": "xgboost"
  },
  "resources": {
    "instanceResources": {
      "cpuCores": 4,
      "memoryGiB": 16,
      "gpuCount": 2
    },
    "instanceCount": 2,
    "volumeSizeGB": 50
  },
  "inputDataConfig": [{
    "endpoint": "http://minio:9000",
    "bucket": "datasets",
    "prefix": "train/iris.csv"
  }],
  "hyperparameters": {
    "xgboost": {
      "num_round": 100,
      "eta": 0.1,
      "max_depth": 6
    }
  },
  "targetClusters": ["cluster-gpu-0"]
}
```

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check environment variables
echo $KARMADA_KUBECONFIG
echo $DATABASE_URL

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Karmada connection
kubectl --kubeconfig=$KARMADA_KUBECONFIG get clusters
```

### Job creation fails
```bash
# Check backend logs
tail -f /tmp/ml-platform-backend.log

# Verify clusters available
curl http://localhost:8080/api/v1/proxy/clusters

# Test with minimal payload
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobName": "test-job",
    "algorithm": {"algorithmName": "xgboost"},
    "resources": {
      "instanceResources": {"cpuCores": 1, "memoryGiB": 2, "gpuCount": 0},
      "instanceCount": 1,
      "volumeSizeGB": 10
    },
    "hyperparameters": {"xgboost": {"num_round": 10}},
    "targetClusters": ["cluster-gpu-0"]
  }'
```

### RayJob not created in Karmada
```bash
# Check Karmada logs
kubectl --kubeconfig=$KARMADA_KUBECONFIG logs -n karmada-system -l app=karmada-controller-manager

# Verify PropagationPolicy
kubectl --kubeconfig=$KARMADA_KUBECONFIG get propagationpolicies -n default

# Check resourcebindings
kubectl --kubeconfig=$KARMADA_KUBECONFIG get resourcebindings -n default
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| `JSON_TO_RAYJOB_GUIDE.md` | Complete implementation guide |
| `UPDATE_SUMMARY.md` | What changed in this update |
| `QUICKSTART.md` | General backend quickstart |
| `test-conversion.sh` | Automated test script |
| `sample/params.json` | Sample input |
| `sample/job-sample.yaml` | RayJob template reference |

## 🎯 Key Files

```
backend/
├── models/models.go          # Request/Response structs
├── converter/converter.go    # JSON → RayJob conversion
├── handlers/handlers.go      # API endpoints
├── karmada/client.go         # Karmada operations
└── repository/repository.go  # Database operations
```

## ✅ Validation Checklist

- [ ] Backend builds successfully (`make build`)
- [ ] Backend starts without errors (`make run`)
- [ ] Health endpoint responds (`/health`)
- [ ] Clusters endpoint lists members (`/api/v1/proxy/clusters`)
- [ ] Job creation succeeds (`POST /api/v1/jobs`)
- [ ] RayJob appears in Karmada (`kubectl get rayjobs`)
- [ ] PropagationPolicy created (`kubectl get propagationpolicies`)
- [ ] Job distributed to target clusters (`kubectl get work`)

## 🔐 Default Values

```go
const (
  DefaultRayVersion   = "2.46.0"
  DefaultHeadImage    = "kiepdoden123/iris-training-ray:v1.2"
  DefaultWorkerImage  = "kiepdoden123/iris-training-ray:v1.2"
  DefaultEntrypoint   = "python /home/ray/xgboost_train.py"
  DefaultStoragePath  = "/home/ray/result-storage"
  DefaultLabelColumn  = "target"
  DefaultS3Region     = "us-east-1"
  DefaultPVCName      = "kham-pv-for-xgboost"
  DefaultMountPath    = "/home/ray/result-storage"
)
```

## 🎓 Common Patterns

### Override image
```json
{
  "headImage": "myregistry/ray-head:v2.0",
  "workerImage": "myregistry/ray-worker:v2.0"
}
```

### Custom entrypoint
```json
{
  "entrypoint": "python /app/my_train.py --config /app/config.yaml"
}
```

### Custom PVC
```json
{
  "pvcName": "my-existing-pvc"
}
```

### Custom namespace
```json
{
  "namespace": "ml-team"
}
```

---

**Need help?** Check the full guide: `JSON_TO_RAYJOB_GUIDE.md`
