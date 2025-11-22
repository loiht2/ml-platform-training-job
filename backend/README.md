# ML Platform Training Job Backend

Go backend service for ML Platform that integrates with Karmada for multi-cluster Kubernetes resource management.

## Overview

This backend service receives REST API requests from the frontend, converts user input forms into Kubernetes resources (Jobs, RayJobs, etc.), and deploys them to member clusters through Karmada's control plane with PropagationPolicy. It also provides proxy access to member cluster resources through Karmada's aggregated API server.

## Features

- **REST API**: Comprehensive API for training job management
- **Karmada Integration**: Deploy workloads to multiple clusters with PropagationPolicy
- **Multi-Framework Support**: Supports standard K8s Jobs and Ray Jobs
- **Database Persistence**: PostgreSQL for job metadata storage
- **Aggregated API Proxy**: Query resources from member clusters through Karmada
- **Resource Conversion**: Transform frontend forms into K8s manifests

## Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Karmada cluster with kubeconfig
- Management cluster kubeconfig
- Docker (optional, for containerized deployment)

## Configuration

The backend requires three main configuration parameters:

1. **Karmada Kubeconfig**: Path to Karmada control plane kubeconfig
2. **MGMT Kubeconfig**: Path to management cluster kubeconfig
3. **Database URL**: PostgreSQL connection string

These can be provided via command-line flags or environment variables:

```bash
# Command-line flags
./main --karmada-kubeconfig=/path/to/karmada-config \
       --mgmt-kubeconfig=/path/to/mgmt-config \
       --database-url="postgresql://user:pass@localhost:5432/dbname"

# Environment variables
export KARMADA_KUBECONFIG=/path/to/karmada-config
export MGMT_KUBECONFIG=/path/to/mgmt-config
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
export PORT=8080
```

## Project Structure

```
backend/
├── main.go                 # Application entry point
├── go.mod                  # Go module definition
├── config/                 # Configuration and initialization
│   ├── config.go          # Config management
│   └── models.go          # Database models
├── handlers/              # HTTP request handlers
│   └── handlers.go        # REST API handlers
├── karmada/               # Karmada client wrapper
│   └── client.go          # Karmada operations
├── converter/             # Resource conversion
│   └── converter.go       # Form to K8s resource converter
├── models/                # API models
│   └── models.go          # Request/response models
├── repository/            # Database operations
│   └── repository.go      # CRUD operations
├── Dockerfile             # Container image definition
├── docker-compose.yml     # Local development setup
└── k8s-deployment.yaml    # Kubernetes deployment manifests
```

## Installation

### Local Development

1. **Initialize Go modules**:
```bash
cd backend
go mod download
go mod tidy
```

2. **Set up PostgreSQL**:
```bash
# Using Docker
docker run -d \
  --name ml-platform-postgres \
  -e POSTGRES_USER=mlplatform \
  -e POSTGRES_PASSWORD=mlplatform123 \
  -e POSTGRES_DB=training_jobs \
  -p 5432:5432 \
  postgres:15-alpine
```

3. **Run the backend**:
```bash
go run main.go \
  --karmada-kubeconfig=$HOME/.kube/karmada-config \
  --mgmt-kubeconfig=$HOME/.kube/config \
  --database-url="postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs?sslmode=disable"
```

### Using Docker Compose

1. **Update docker-compose.yml** with your kubeconfig paths
2. **Run**:
```bash
docker-compose up -d
```

### Kubernetes Deployment

1. **Update k8s-deployment.yaml** with your kubeconfig content in the Secret
2. **Build and push Docker image**:
```bash
docker build -t your-registry/ml-platform-backend:latest .
docker push your-registry/ml-platform-backend:latest
```

3. **Deploy**:
```bash
kubectl apply -f k8s-deployment.yaml
```

## API Endpoints

### Training Jobs

- `POST /api/v1/jobs` - Create a new training job
- `GET /api/v1/jobs` - List all training jobs
- `GET /api/v1/jobs/:id` - Get training job details
- `DELETE /api/v1/jobs/:id` - Delete a training job
- `GET /api/v1/jobs/:id/status` - Get job status
- `GET /api/v1/jobs/:id/logs` - Get job logs

### Member Clusters (Proxy)

- `GET /api/v1/proxy/clusters` - List member clusters
- `GET /api/v1/proxy/clusters/:cluster/resources` - Get cluster resources

### Health Check

- `GET /health` - Service health status

## API Examples

### Create a Training Job

```bash
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pytorch-training",
    "namespace": "default",
    "jobType": "pytorch",
    "framework": "pytorch",
    "image": "pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime",
    "command": "python train.py --epochs 10",
    "replicas": 4,
    "cpuRequest": "2",
    "memoryRequest": "4Gi",
    "gpuRequest": 1,
    "hyperparameters": {
      "learning_rate": "0.001",
      "batch_size": "32"
    },
    "targetClusters": ["cluster-1", "cluster-2"]
  }'
```

### List Training Jobs

```bash
curl http://localhost:8080/api/v1/jobs
```

### Get Job Status

```bash
curl http://localhost:8080/api/v1/jobs/{job-id}/status
```

### List Member Clusters

```bash
curl http://localhost:8080/api/v1/proxy/clusters
```

## How It Works

1. **Frontend Submission**: User submits training job form from frontend
2. **API Reception**: Backend receives POST request at `/api/v1/jobs`
3. **Database Storage**: Job metadata saved to PostgreSQL
4. **Resource Conversion**: Form data converted to K8s Job/RayJob manifest
5. **Karmada Deployment**: 
   - Resource created in Karmada control plane
   - PropagationPolicy created with target cluster configuration
   - Karmada propagates resource to specified member clusters
6. **Status Tracking**: Backend monitors job status through Karmada
7. **Aggregated Queries**: Frontend can query member cluster resources via proxy API

## Karmada PropagationPolicy

The backend automatically creates PropagationPolicy for each job:

```yaml
apiVersion: policy.karmada.io/v1alpha1
kind: PropagationPolicy
metadata:
  name: {job-name}-propagation
  namespace: {namespace}
spec:
  resourceSelectors:
    - apiVersion: batch/v1
      kind: Job
      name: {job-name}
  placement:
    clusterAffinity:
      clusterNames:
        - cluster-1
        - cluster-2
    replicaScheduling:
      replicaSchedulingType: Divided
```

## Database Schema

```sql
CREATE TABLE training_jobs (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  namespace VARCHAR,
  job_type VARCHAR,
  framework VARCHAR,
  image VARCHAR,
  command TEXT,
  replicas INTEGER,
  workers_per_node INTEGER,
  cpu_request VARCHAR,
  cpu_limit VARCHAR,
  memory_request VARCHAR,
  memory_limit VARCHAR,
  gpu_request INTEGER,
  storage_class VARCHAR,
  storage_size VARCHAR,
  hyperparameters TEXT,
  target_clusters TEXT,
  status VARCHAR,
  message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

## Development

### Adding Support for New Job Types

1. Add converter logic in `converter/converter.go`
2. Update `handlers.CreateTrainingJob()` switch case
3. Add any custom CRD handling in `karmada/client.go`

### Testing

```bash
# Run tests
go test ./...

# Run with race detection
go test -race ./...

# Run with coverage
go test -cover ./...
```

## Troubleshooting

### Connection Issues

- Verify kubeconfig files are accessible and valid
- Check network connectivity to Karmada and member clusters
- Ensure PostgreSQL is running and accessible

### Job Creation Failures

- Check Karmada control plane logs
- Verify PropagationPolicy was created
- Ensure target clusters are registered and ready
- Check resource quotas in target clusters

### Database Errors

- Verify DATABASE_URL connection string
- Check PostgreSQL logs
- Ensure database migrations ran successfully

## License

[Your License]

## Contributing

[Your Contributing Guidelines]
