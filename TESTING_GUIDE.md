# Testing Guide: Namespace Integration

## Version: v1.5

### Changes in v1.5
- Updated `kubeflow-api.ts` to match centraldashboard's env-info API structure
- env-info returns `{user, namespaces[], isClusterAdmin, platform}` where each namespace has `{namespace, role, user}`
- Implemented Kubeflow's namespace selection logic:
  1. Check localStorage for user's previous selection
  2. Find namespace with 'owner' role
  3. Fall back to 'kubeflow' namespace
  4. Use first available namespace
  5. Fall back to URL `?ns=` parameter
- Removed direct access to `envInfo.namespace` and use `getDefaultNamespace(envInfo)` helper

### Testing Steps

#### 1. Access the UI
Navigate to: `http://192.168.40.246:32269/_/training-job/`

**Login credentials:**
- If authentication is enabled, use your Kubeflow account

#### 2. Verify Namespace Detection (Browser DevTools)

1. Open Browser DevTools (F12)
2. Go to Console tab
3. You should see:
   ```
   Kubeflow namespace: <your-namespace>
   ```

4. To inspect the full env-info response, run in console:
   ```javascript
   fetch('/api/workgroup/env-info')
     .then(r => r.json())
     .then(data => console.log('Env Info:', data))
   ```

Expected response structure:
```json
{
  "user": "user@example.com",
  "namespaces": [
    {
      "namespace": "kubeflow-user-example-com",
      "role": "owner",
      "user": "user@example.com"
    }
  ],
  "isClusterAdmin": false,
  "platform": {
    "provider": "onprem",
    "providerName": "onprem",
    "kubeflowVersion": "1.0.0"
  }
}
```

#### 3. Test Job Submission

1. Fill in the training job form:
   - **Job Name**: `test-namespace-integration`
   - **Training Source**: Select "Use built-in training algorithm"
   - **Built-in Algorithm**: `xgboost`
   - **Instance Type**: `ml.m5.large`
   - **Instance Count**: `1`

2. Click "Submit Training Job"

3. Check Network tab in DevTools:
   - Look for POST request to `/api/training-job/v1/jobs`
   - Click on the request → Payload tab
   - Verify the `namespace` field matches your expected namespace

Expected payload:
```json
{
  "jobName": "test-namespace-integration",
  "namespace": "kubeflow-user-example-com",  // <-- Should be your namespace
  "algorithm": "xgboost",
  ...
}
```

#### 4. Verify Job Created in Correct Namespace

```bash
# Check RayJob was created in the correct namespace
kubectl get rayjobs -n <your-namespace>

# Example:
kubectl get rayjobs -n kubeflow-user-example-com

# Check logs
kubectl logs -n kubeflow -l app=ml-platform,component=backend --tail=20
```

Expected output should show job creation in your namespace.

#### 5. Test Namespace Switching (If Multiple Namespaces)

If you have access to multiple namespaces:

1. Open the namespace selector in Kubeflow centraldashboard (top menu)
2. Switch to a different namespace
3. Navigate back to Training Jobs UI
4. Verify console shows the new namespace
5. Submit a test job
6. Verify it's created in the new namespace

#### 6. Test Fallback Behavior

Test URL parameter fallback:
```
http://192.168.40.246:32269/_/training-job/create?ns=test-namespace
```

In console, verify:
```
Kubeflow namespace: test-namespace
```

### Troubleshooting

#### Issue: Empty namespace or "kubeflow-user-example-com" hardcoded

**Check 1: Verify env-info endpoint works**
```bash
# From a pod with curl
kubectl exec -it -n kubeflow <any-pod> -- curl http://centraldashboard.kubeflow.svc.cluster.local:8082/api/workgroup/env-info
```

If it returns `{}`, the centraldashboard may not be configured correctly for your environment.

**Check 2: Verify frontend can reach env-info**
In browser console:
```javascript
fetch('/api/workgroup/env-info')
  .then(r => r.text())
  .then(text => console.log('Raw response:', text))
```

**Check 3: Verify authentication headers**
```bash
kubectl logs -n kubeflow -l app=centraldashboard --tail=50 | grep "env-info"
```

#### Issue: Job created in wrong namespace

**Check backend logs:**
```bash
kubectl logs -n kubeflow -l app=ml-platform,component=backend --tail=50
```

Look for the namespace value being used in job creation.

**Check VirtualService routing:**
```bash
kubectl get virtualservice -n kubeflow kf-training-job-ui -o yaml
```

Verify the rewrite rules are correct.

#### Issue: Cannot access /_/training-job/

**Check Istio routing:**
```bash
kubectl get virtualservice -n kubeflow -o yaml | grep -A5 training-job
```

**Check service:**
```bash
kubectl get svc -n kubeflow training-job-web-app-service
```

**Check pods:**
```bash
kubectl get pods -n kubeflow -l app=ml-platform,component=frontend
```

### Expected Behavior Summary

1. ✅ Frontend loads at `/_/training-job/`
2. ✅ Console shows: `Kubeflow namespace: <your-namespace>`
3. ✅ env-info API returns namespaces array
4. ✅ Default namespace selected using Kubeflow's logic (owner role → kubeflow → first)
5. ✅ Job submission sends correct namespace to backend
6. ✅ Backend creates RayJob in the specified namespace
7. ✅ Backend logs show: `Creating training job <name> in namespace <namespace>`

### Files Modified in v1.5

1. **frontend/src/lib/kubeflow-api.ts**
   - Updated `KubeflowEnvInfo` interface to match centraldashboard API
   - Added `getDefaultNamespace()` function with proper selection logic
   - Fixed `getCurrentNamespace()` to use the helper function

2. **frontend/src/pages/CreateTrainingJobPage.tsx**
   - Changed import from `getKubeflowEnvInfo` to `getCurrentNamespace`
   - Updated useEffect to call `getCurrentNamespace()` directly

### Success Criteria

- [ ] UI loads without errors
- [ ] Console shows correct namespace
- [ ] env-info API returns valid namespace array
- [ ] Job submission includes correct namespace in payload
- [ ] RayJob created in correct namespace
- [ ] Namespace switching works (if applicable)
- [ ] URL fallback works for direct access

### Next Steps if All Tests Pass

1. Document the namespace integration in main README
2. Create examples for multi-namespace deployments
3. Add namespace validation in backend
4. Implement namespace-scoped job listing in frontend
