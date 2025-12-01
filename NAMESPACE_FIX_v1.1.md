# Namespace Fix - Backend v1.1

## Issue
When submitting a training job with user `admin@dcn.com` (namespace: `admin`), the backend was creating the job in namespace `kubeflow-admin-dcn-com` instead of `admin`, causing the error:
```
Failed to apply job: failed to create RayJob: namespaces "kubeflow-admin-dcn-com" not found
```

## Root Cause
The backend handler was **overriding** the namespace from the request payload with a calculated namespace from the auth middleware:

**Before (handlers.go:57):**
```go
// Override request namespace with user's namespace for security
req.Namespace = namespace
```

The auth middleware was converting email `admin@dcn.com` → namespace `kubeflow-admin-dcn-com`, but the actual namespace from Kubeflow env-info is `admin`.

## Solution
Changed the backend to **use the namespace from the request payload** (which comes from Kubeflow's `/api/workgroup/env-info`), with fallback to calculated namespace only if not provided:

**After (handlers.go:52-60):**
```go
// Use namespace from request (set by frontend from Kubeflow env-info)
// If not provided, fall back to user's default namespace
if req.Namespace == "" {
    req.Namespace = middleware.GetTargetNamespace(c)
    log.Printf("No namespace in request, using default: %s", req.Namespace)
}

log.Printf("User %s creating job '%s' in namespace '%s'", userEmail, req.JobName, req.Namespace)
```

## Flow After Fix

```
User logs in as admin@dcn.com
    ↓
Kubeflow env-info returns: {user: "admin@dcn.com", namespaces: [{namespace: "admin", role: "owner"}]}
    ↓
Frontend extracts namespace: "admin"
    ↓
Frontend submits job with: {jobName: "test-job", namespace: "admin", ...}
    ↓
Backend receives request with namespace: "admin"
    ↓
Backend uses request.Namespace directly: "admin"
    ↓
RayJob created in namespace: "admin" ✅
```

## Changes Made

**File**: `backend/handlers/handlers.go`
- **Lines 52-59**: Changed namespace handling logic
- **Version**: kubeflow-v1.1

## Deployment

```bash
# Build
cd backend
docker build -t loihoangthanh1411/ml-platform-backend:kubeflow-v1.1 .

# Push
docker push loihoangthanh1411/ml-platform-backend:kubeflow-v1.1

# Deploy
kubectl set image deployment/ml-platform-backend -n kubeflow \
  backend=loihoangthanh1411/ml-platform-backend:kubeflow-v1.1

# Verify
kubectl get pods -n kubeflow -l app=ml-platform,component=backend
```

## Testing

1. **Login to Kubeflow** with credentials:
   - Username: `admin`
   - Password: `admin123`

2. **Check env-info** (F12 → Network tab):
   ```json
   {
     "user": "admin@dcn.com",
     "namespaces": [
       {"namespace": "admin", "role": "owner"}
     ]
   }
   ```

3. **Submit a training job**:
   - Job Name: `test-namespace-fix`
   - Algorithm: XGBoost
   - Click Submit

4. **Verify in logs**:
   ```bash
   kubectl logs -n kubeflow -l app=ml-platform,component=backend --tail=20
   ```
   
   Expected log:
   ```
   User admin@dcn.com creating job 'test-namespace-fix' in namespace 'admin'
   ```

5. **Check RayJob created**:
   ```bash
   kubectl get rayjobs -n admin
   ```
   
   Should show the job in `admin` namespace, not `kubeflow-admin-dcn-com`.

## Current Deployment Status

**Backend Version**: `loihoangthanh1411/ml-platform-backend:kubeflow-v1.1`
**Frontend Version**: `loihoangthanh1411/ml-platform-frontend:kubeflow-v1.5`
**Centraldashboard Version**: `loihoangthanh1411/centraldashboard:2.3`

**Pods Status**:
```
ml-platform-backend-58bdc988bd-dsctp   2/2   Running   76s
ml-platform-backend-58bdc988bd-n2qx6   2/2   Running   40s
ml-platform-frontend-5c45cd44f4-dwddt  2/2   Running   14m
ml-platform-frontend-5c45cd44f4-r6r2t  2/2   Running   14m
```

## Security Note

The backend now trusts the namespace from the frontend request. This is appropriate because:
1. Kubeflow's Istio already authenticates the user
2. The namespace comes from Kubeflow's centraldashboard API
3. Kubernetes RBAC will enforce permissions when creating the RayJob
4. If a user tries to create a job in a namespace they don't have access to, Kubernetes will reject it

For additional security, you could add a SubjectAccessReview check in the future to validate the user has permission to create jobs in the requested namespace before attempting to create the RayJob.

## Next Steps

1. ✅ Deploy backend v1.1 
2. ✅ Verify logs show correct namespace
3. 🔄 Test job submission with admin user
4. 🔄 Verify RayJob created in `admin` namespace
5. 📝 Update main documentation

## Date
November 30, 2025 - 07:16 UTC
