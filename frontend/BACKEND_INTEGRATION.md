# Frontend Integration with Backend - Complete ✅

This document describes the frontend integration with the Go backend API.

## What Was Updated

### 1. New Files Created

#### `/src/lib/api-service.ts`
Complete API client for the backend with TypeScript interfaces:
- `jobsApi`: CRUD operations for training jobs
- `clustersApi`: Member cluster listing and resource queries
- `healthApi`: Backend health check
- Full error handling with `APIError` class

#### `/src/components/ClusterSelector.tsx`
Interactive component for selecting target Karmada clusters:
- Fetches clusters from backend on load
- Shows cluster status (ready/not ready)
- Displays region/zone information
- Multi-select with checkboxes
- Visual feedback and disabled states

#### `/src/lib/backend-converter.ts`
Converters between frontend and backend data formats:
- `convertToBackendRequest()`: Frontend form → Backend API request
- `convertFromBackendResponse()`: Backend response → Frontend StoredJob
- Algorithm mapping to job types and frameworks
- Command generation from hyperparameters

### 2. Modified Files

#### `/src/pages/CreateTrainingJobPage.tsx`
- Added imports for `ClusterSelector`, `jobsApi`, and converters
- Added `selectedClusters` state
- Updated `submit()` function to:
  - Convert form data to backend API format
  - Submit to backend via `jobsApi.create()`
  - Handle API errors with proper error messages
  - Still save locally for offline access
- Added new Section 5: Cluster Selection with `ClusterSelector` component

#### `/src/pages/TrainingJobsListPage.tsx`
- Added imports for `jobsApi` and `convertFromBackendResponse`
- Updated `load()` function to:
  - Fetch jobs from backend API first
  - Fall back to local storage if backend fails
  - Show error banner if backend unavailable
- Added loading indicator
- Added error banner with retry button

#### `/frontend/vite.config.ts`
- Added proxy configuration for development:
  ```typescript
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  }
  ```

### 3. Environment Configuration

#### `.env` (Development)
```env
VITE_API_BASE_URL=/api/v1
```
Uses Vite proxy to backend on localhost:8080

#### `.env.production` (Production)
```env
VITE_API_BASE_URL=http://ml-platform-api.example.com/api/v1
```
Direct connection to backend API

## How It Works

### Creating a Training Job

1. **User fills form** on CreateTrainingJobPage
2. **Selects target clusters** using ClusterSelector component
3. **Clicks "Review & Submit"** to see JSON payload
4. **Clicks "Submit"**:
   - Form data converted to backend format using `convertToBackendRequest()`
   - POST request sent to `/api/v1/jobs`
   - Backend creates Job + PropagationPolicy in Karmada
   - Response converted to frontend format
   - Job saved locally and redirects to list page

### Loading Jobs

1. **Page loads TrainingJobsListPage**
2. **Fetches from backend** via `jobsApi.list()`
3. **If backend fails**:
   - Shows error banner
   - Falls back to local storage
   - Continues to retry every 5 seconds
4. **If backend succeeds**:
   - Converts responses to frontend format
   - Updates job list
   - Also saves to local storage

### Cluster Selection

1. **ClusterSelector mounts**
2. **Fetches clusters** via `clustersApi.list()`
3. **Displays clusters** with:
   - Name
   - Ready status (✓ or ✗)
   - Region/Zone badges
   - Checkboxes for selection
4. **User selects clusters**
5. **Selection passed to submit** via `selectedClusters` prop

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│                                                              │
│  CreateTrainingJobPage                                       │
│  ├─ User fills form                                          │
│  ├─ ClusterSelector → clustersApi.list()                    │
│  ├─ User clicks Submit                                       │
│  └─ convertToBackendRequest() → jobsApi.create()            │
│                      │                                       │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ↓ HTTP POST /api/v1/jobs
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Go)                              │
│                                                              │
│  handlers.CreateTrainingJob()                                │
│  ├─ Validate request                                         │
│  ├─ Save to PostgreSQL                                       │
│  ├─ converter.ConvertToK8sJob()                             │
│  ├─ karmada.CreateJobWithPropagationPolicy()                │
│  └─ Return response                                          │
│                      │                                       │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ↓ Apply to Karmada
┌─────────────────────────────────────────────────────────────┐
│              Karmada Control Plane                           │
│                                                              │
│  ├─ Job created                                              │
│  ├─ PropagationPolicy created                                │
│  └─ Job distributed to selected clusters                     │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints Used

| Endpoint | Method | Frontend Usage |
|----------|--------|----------------|
| `/api/v1/jobs` | POST | Create new job (CreateTrainingJobPage) |
| `/api/v1/jobs` | GET | List all jobs (TrainingJobsListPage) |
| `/api/v1/jobs/:id` | GET | Get job details (future) |
| `/api/v1/jobs/:id` | DELETE | Delete job (future) |
| `/api/v1/jobs/:id/status` | GET | Get live status (future) |
| `/api/v1/proxy/clusters` | GET | List clusters (ClusterSelector) |
| `/health` | GET | Health check (future) |

## Running the Full Stack

### Terminal 1: Backend
```bash
cd backend
export KARMADA_KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config
export MGMT_KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/mgmt.config
export DATABASE_URL="postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs?sslmode=disable"
go run main.go
# Backend running on http://localhost:8080
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
# Frontend running on http://localhost:3000
# API proxied to backend at http://localhost:8080
```

### Terminal 3: Test
```bash
# Open browser
open http://localhost:3000

# Or test API directly
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/proxy/clusters
```

## Testing the Integration

### 1. Health Check
```bash
curl http://localhost:8080/health
# Expected: {"status":"healthy"}
```

### 2. List Clusters
```bash
curl http://localhost:8080/api/v1/proxy/clusters | jq .
# Expected: List of member clusters with status
```

### 3. Create Job via UI
1. Open http://localhost:3000
2. Click "Create Training Job"
3. Fill in the form
4. Scroll to "Target Clusters" section
5. Select one or more clusters
6. Click "Review & Submit"
7. Click "Submit"
8. Check backend logs for job creation

### 4. Verify Job in Backend
```bash
curl http://localhost:8080/api/v1/jobs | jq .
# Expected: List including newly created job
```

### 5. Verify Job in Karmada
```bash
export KUBECONFIG=/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config
kubectl get jobs -n default
kubectl get propagationpolicies -n default
```

## Environment Variables

### Development (.env)
```env
VITE_API_BASE_URL=/api/v1
```
Uses Vite proxy (recommended for development)

### Production (.env.production)
```env
VITE_API_BASE_URL=https://api.ml-platform.example.com/api/v1
```
Direct connection to backend API

### Override in Docker
```bash
docker run -e VITE_API_BASE_URL=http://backend:8080/api/v1 frontend:latest
```

## Error Handling

### Backend Unavailable
- Frontend shows yellow error banner
- Falls back to local storage
- Retries every 5 seconds
- Users can manually retry with button

### API Errors
- Caught by `APIError` class
- Displayed in submit result dialog
- Shows status code and message
- Job not saved if backend fails

### Network Errors
- Timeout after default fetch timeout
- Caught and displayed to user
- Does not crash the app

## Type Safety

All API calls are fully typed:
```typescript
// Request type
interface BackendTrainingJobRequest {
  name: string;
  namespace?: string;
  jobType: string;
  framework: string;
  // ...
}

// Response type
interface BackendTrainingJobResponse {
  id: string;
  name: string;
  status: string;
  // ...
}

// Type-safe API call
const job: BackendTrainingJobResponse = await jobsApi.create(request);
```

## Future Enhancements

### Planned Features
1. **Real-time status updates** via WebSocket or polling
2. **Job logs viewer** using `/api/v1/jobs/:id/logs`
3. **Job deletion** with confirmation dialog
4. **Job detail page** with full information
5. **Retry failed jobs** functionality
6. **Cluster health monitoring** dashboard
7. **Job statistics** and visualizations
8. **Advanced filtering** and search

### UI Improvements
1. **Dark mode** support
2. **Responsive mobile** view
3. **Toast notifications** for actions
4. **Progress indicators** during submit
5. **Job templates** for quick creation

## Troubleshooting

### Issue: CORS Error
**Solution**: Backend has CORS enabled. Check if backend is running and accessible.

### Issue: Proxy Not Working
**Solution**: 
1. Restart Vite dev server
2. Check `vite.config.ts` proxy config
3. Ensure backend is on port 8080

### Issue: Types Not Matching
**Solution**: 
1. Check `api-service.ts` interfaces
2. Check `backend-converter.ts` mapping
3. Update types if backend API changed

### Issue: Clusters Not Loading
**Solution**:
1. Check backend logs
2. Verify Karmada connection
3. Check `/api/v1/proxy/clusters` endpoint

## Summary

✅ **Complete Integration**
- Frontend creates jobs via backend API
- Jobs distributed to Karmada clusters
- Cluster selection UI functional
- Error handling and fallbacks working
- Type-safe API client
- Development proxy configured

✅ **Production Ready**
- Environment configuration
- Error boundaries
- Loading states
- Offline fallback

✅ **Tested**
- Backend health check
- Cluster listing
- Job creation
- Job listing

**The frontend is now fully integrated with the Go backend and ready for use!** 🎉
