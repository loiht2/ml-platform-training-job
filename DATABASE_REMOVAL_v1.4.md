# Backend v1.4 - Database Removal (Stateless Architecture)

**Date**: November 30, 2025  
**Version**: Backend v1.4  
**Status**: ✅ Complete

## Overview

Removed PostgreSQL database from the ML Platform Training Job backend to create a stateless architecture. The backend now queries RayJobs directly from Kubernetes API, using the cluster as the source of truth.

## Changes Made

### 1. Kubernetes Resources Deleted

```bash
# PostgreSQL StatefulSet
kubectl delete statefulset ml-platform-postgres -n kubeflow

# PostgreSQL Service
kubectl delete service ml-platform-postgres -n kubeflow

# PostgreSQL Secret
kubectl delete secret ml-platform-postgres-secret -n kubeflow
```

### 2. Backend Code Changes

#### `backend/config/config.go`
- ❌ Removed: `DatabaseURL string`, `DB *gorm.DB` fields from Config struct
- ❌ Removed: `initDatabase()` method (GORM/PostgreSQL setup)
- ❌ Removed: Database imports (`gorm.io/gorm`, `gorm.io/driver/postgres`)
- ✅ Updated: `New()` signature - removed `databaseURL` parameter
- ✅ Simplified: `Close()` method (no database connections to close)

#### `backend/main.go`
- ❌ Removed: `--database-url` CLI flag
- ❌ Removed: Repository and monitor package imports
- ❌ Removed: Repository initialization (`repository.NewRepository`)
- ❌ Removed: Job monitor initialization and lifecycle (`monitor.NewJobMonitor`)
- ✅ Updated: `config.New(*kubeconfig)` - single parameter
- ✅ Updated: `handlers.NewHandler(cfg, k8sClient)` - no repo parameter
- ✅ Updated: Log message: "Starting... (No Database)"
- ✅ Simplified: Graceful shutdown (removed monitor.Stop())

#### `backend/handlers/handlers.go`
- ❌ Removed: `repo *repository.Repository` field from Handler struct
- ❌ Removed: Repository import
- ✅ Updated: All handler methods rewritten to use Kubernetes API directly

**Handler Methods Updated**:

1. **CreateTrainingJob** (`POST /api/v1/jobs`)
   - ❌ Removed: `h.repo.CreateTrainingJob(&req, jobID)`
   - ✅ Changed: Only creates RayJob in Kubernetes
   - ✅ Changed: Returns job metadata from RayJob creation timestamp

2. **ListTrainingJobs** (`GET /api/v1/jobs`)
   - ❌ Removed: `h.repo.ListTrainingJobs(namespace)`
   - ✅ Changed: Uses `h.k8sClient.ListActiveRayJobs(ctx, namespace)`
   - ✅ Changed: Extracts metadata from RayJob objects (name, namespace, status, createdAt)

3. **GetTrainingJob** (`GET /api/v1/jobs/:id`)
   - ❌ Removed: `h.repo.GetTrainingJob(id)`
   - ✅ Changed: Uses `h.k8sClient.GetRayJob(ctx, id, namespace)`
   - ✅ Changed: Extracts full job details from RayJob spec/status

4. **DeleteTrainingJob** (`DELETE /api/v1/jobs/:id`)
   - ❌ Removed: `h.repo.GetTrainingJob(id)` and `h.repo.DeleteTrainingJob(id)`
   - ✅ Changed: Uses `h.k8sClient.DeleteJob(ctx, id, namespace)` only
   - ✅ Simplified: Direct K8s deletion without database cleanup

5. **GetTrainingJobStatus** (`GET /api/v1/jobs/:id/status`)
   - ❌ Removed: `h.repo.GetTrainingJob(id)` and `h.repo.UpdateTrainingJobStatus()`
   - ✅ Changed: Uses `h.k8sClient.GetRayJobStatus(ctx, id, namespace)`
   - ✅ Changed: Maps RayJob status ("RUNNING", "SUCCEEDED", "FAILED") to response format

6. **GetTrainingJobLogs** (`GET /api/v1/jobs/:id/logs`)
   - ❌ Removed: `h.repo.GetTrainingJob(id)`
   - ✅ Changed: Uses namespace from middleware, ID as RayJob name
   - ✅ Updated: kubectl hint uses `ray.io/job-name` label

#### `backend/k8s/client.go`
- ✅ Added: `GetRayJob(ctx, name, namespace)` method - returns full RayJob object
- ✅ Existing: `ListActiveRayJobs(ctx, namespace)` - already supported
- ✅ Existing: `GetRayJobStatus(ctx, name, namespace)` - already supported
- ✅ Existing: `DeleteJob(ctx, name, namespace)` - supports RayJob deletion

#### Packages Deleted
- ❌ `backend/repository/` - entire directory deleted
- ❌ `backend/monitor/` - entire directory deleted

### 3. Deployment Manifest Changes

#### `manifests/deployment.yaml`
- ❌ Removed: PostgreSQL StatefulSet definition
- ❌ Removed: PostgreSQL Service definition
- ❌ Removed: PostgreSQL Secret definition
- ❌ Removed: `DATABASE_URL` environment variable from backend
- ✅ Updated: Backend image tag to `kubeflow-v1.4`
- ✅ Kept: Backend ServiceAccount, RBAC, and other configurations

## Architecture Changes

### Before (v1.3)
```
User Request → Backend → Database (PostgreSQL)
                     ↓
                Kubernetes API (RayJobs)
                     ↓
                Job Monitor → Database (updates)
```

### After (v1.4)
```
User Request → Backend → Kubernetes API (RayJobs)
                            ↓
                    (K8s is source of truth)
```

## Benefits

1. **Stateless Architecture**: No persistent state in backend, easier scaling
2. **Simplified Deployment**: No PostgreSQL StatefulSet, Service, or PVC to manage
3. **Real-time Status**: Job status always reflects current RayJob state in Kubernetes
4. **No Sync Issues**: Database can't become out-of-sync with actual K8s resources
5. **Resource Savings**: No PostgreSQL pod consuming resources
6. **Faster Queries**: Direct K8s API queries, no database round trip

## API Response Format (Unchanged)

The frontend API remains compatible. Response format for list/get operations:

```json
{
  "id": "test-job-18348596",
  "jobName": "test-job",
  "namespace": "kubeflow-user-example-com",
  "algorithm": "xgboost",
  "priority": 0,
  "status": "Pending",
  "message": "Initializing",
  "createdAt": "2025-11-30T10:25:36Z",
  "updatedAt": "2025-11-30T10:25:36Z"
}
```

**Status Values** (from RayJob):
- `Pending` - RayJob created, not yet running
- `Running` - RayJob status = "RUNNING"
- `Succeeded` - RayJob status = "SUCCEEDED"
- `Failed` - RayJob status = "FAILED"

## Testing Results

✅ **Create Job**: Successfully creates RayJob in Kubernetes  
✅ **List Jobs**: Returns all RayJobs from user's namespace  
✅ **Get Job**: Retrieves specific RayJob details  
✅ **Delete Job**: Removes RayJob from Kubernetes  
✅ **Get Status**: Returns real-time status from RayJob  

### Test Output

```bash
# Create test job
$ curl -X POST http://localhost:8080/api/v1/jobs \
  -H "kubeflow-userid: user@example.com" \
  -d '{"jobName":"test-job","namespace":"kubeflow-user-example-com",...}'

{"id":"test-job-18348596","status":"Pending","message":"Job created successfully",...}

# List jobs
$ curl http://localhost:8080/api/v1/jobs \
  -H "kubeflow-userid: user@example.com"

[{"id":"test-job","status":"Pending","createdAt":"2025-11-30T10:25:36Z",...}]

# Verify in Kubernetes
$ kubectl get rayjobs -n kubeflow-user-example-com
NAME       JOB STATUS   DEPLOYMENT STATUS   AGE
test-job                Running             34s
```

## Deployment Steps

```bash
# 1. Build and push backend v1.4
cd backend
docker build -t loihoangthanh1411/ml-platform-backend:kubeflow-v1.4 .
docker push loihoangthanh1411/ml-platform-backend:kubeflow-v1.4

# 2. Apply updated manifest
kubectl apply -f manifests/deployment.yaml

# 3. Verify deployment
kubectl get pods -n kubeflow -l component=backend
kubectl logs -n kubeflow -l component=backend --tail=20

# 4. Clean up old resources (if still exist)
kubectl delete statefulset ml-platform-postgres -n kubeflow
kubectl delete service ml-platform-postgres -n kubeflow
kubectl delete secret ml-platform-postgres-secret -n kubeflow
```

## Migration Notes

**No data migration needed**: The database only stored metadata that can be reconstructed from Kubernetes RayJob resources. Existing RayJobs in the cluster are automatically visible through the new API.

**Job ID = RayJob Name**: In the new architecture, the job ID returned by the API is the actual RayJob name in Kubernetes. This simplifies lookups and ensures consistency.

**Namespace Isolation**: Each user can only see RayJobs in their namespace (from `kubeflow-userid` header → env-info mapping).

## Version History

- **v1.0-v1.1**: Initial Kubeflow integration with namespace fixes
- **v1.2**: JSON config format (TRAINING_CONFIG)
- **v1.3**: MinIO upload integration
- **v1.4**: Database removal (stateless architecture) ✅ **Current**

## Next Steps

Consider future enhancements:
- [ ] Add caching layer for frequently accessed RayJobs
- [ ] Implement pagination for large job lists
- [ ] Add filtering/sorting options for job queries
- [ ] Enhance log retrieval (direct pod log streaming)
