# Kubeflow Integration Fix - ML Platform Training Job UI

## Problem Summary
The ML Platform Training Job UI failed to load when embedded in Kubeflow's centraldashboard. The page appeared blank with no network activity when clicking "Training Jobs" in the menu.

---

## Root Causes & Solutions

### **1. X-Frame-Options Header Blocking Iframe** ❌→✅

**Problem:** The nginx configuration included `X-Frame-Options: SAMEORIGIN` header, which prevented the page from loading inside centraldashboard's iframe (cross-origin restriction).

**Fix:** Removed the header from `frontend/nginx.conf`:

```nginx
# Before
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# After
# X-Frame-Options removed to allow embedding in Kubeflow centraldashboard iframe
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

**File:** `kubeflow/components/crud-web-apps/ml-platform-training-job/frontend/nginx.conf`

---

### **2. Wrong Service Naming Convention** ❌→✅

**Problem:** The service was named `ml-platform-frontend`, but Kubeflow's centraldashboard uses convention-based service discovery. It expects services to follow the pattern: `<menu-link-name>-web-app-service`.

For a menu link `/training-job/`, centraldashboard looks for a service named `training-job-web-app-service`.

**Fix:** Renamed the service in deployment manifest:

```yaml
# Before
metadata:
  name: ml-platform-frontend
  namespace: kubeflow
  labels:
    app: ml-platform
    component: frontend

# After  
metadata:
  name: training-job-web-app-service
  namespace: kubeflow
  labels:
    app: ml-platform
    component: frontend
```

**Also updated VirtualService routing:**

```yaml
# Before
route:
  - destination:
      host: ml-platform-frontend.kubeflow.svc.cluster.local
      port:
        number: 80

# After
route:
  - destination:
      host: training-job-web-app-service.kubeflow.svc.cluster.local
      port:
        number: 80
```

**Files:**
- `kubeflow/components/crud-web-apps/ml-platform-training-job/manifests/deployment.yaml`
- `kubeflow/components/crud-web-apps/ml-platform-training-job/manifests/istio.yaml`

---

### **3. Missing Whitelist Entry in Centraldashboard** ❌→✅

**Problem:** Centraldashboard has a hardcoded whitelist in its JavaScript code that controls which applications can be loaded in iframes with namespace support. The original whitelist only included:

```javascript
const ALL_NAMESPACES_ALLOWED_LIST = ['jupyter', 'volumes', 'tensorboards', 'katib', 'models'];
```

Without `'training-job'` in this list, centraldashboard wouldn't create the iframe at all, resulting in no network requests.

**Fix:** Added `'training-job'` to the whitelist:

```javascript
// Before
export const ALL_NAMESPACES_ALLOWED_LIST = ['jupyter', 'volumes', 'tensorboards', 'katib', 'models'];

// After
export const ALL_NAMESPACES_ALLOWED_LIST = ['jupyter', 'volumes', 'tensorboards', 'katib', 'models', 'training-job'];
```

**Rebuild centraldashboard:**
```bash
cd ~/loiht2/dcn-kubeflow/kubeflow/components/centraldashboard
docker build -t loihoangthanh1411/centraldashboard:2.3 -f Dockerfile .
docker push loihoangthanh1411/centraldashboard:2.3
kubectl set image deployment/centraldashboard -n kubeflow centraldashboard=loihoangthanh1411/centraldashboard:2.3
```

**File:** `kubeflow/components/centraldashboard/public/components/namespace-selector.js`

---

### **4. Incorrect Vite Base Path (Critical!)** ❌→✅

**Problem:** The most critical issue - the frontend was built with `base: "/"` in the Vite configuration. This caused all asset paths in the generated HTML to be absolute root paths:

```html
<!-- Generated HTML with base: "/" -->
<script src="/assets/js/index-4a61853a.js"></script>
<link href="/assets/css/index-e41487c8.css" rel="stylesheet">
```

When the page was served at `/training-job/`, the browser requested:
- ❌ `http://192.168.40.246:32269/assets/js/index-4a61853a.js` (404 - Not Found)
- ❌ `http://192.168.40.246:32269/assets/css/index-e41487c8.css` (404 - Not Found)

Instead of the correct paths:
- ✅ `http://192.168.40.246:32269/training-job/assets/js/index-4a61853a.js`
- ✅ `http://192.168.40.246:32269/training-job/assets/css/index-e41487c8.css`

Result: The HTML loaded successfully, but all JavaScript and CSS returned 404 errors, leaving a blank white page.

**Fix:** Updated Vite configuration to use correct base path:

```typescript
// Before
export default defineConfig({
  base: "/",
  plugins: [react()],
  // ... rest of config
});

// After
export default defineConfig({
  base: "/training-job/",
  plugins: [react()],
  // ... rest of config
});
```

This generates correct asset paths:

```html
<!-- Generated HTML with base: "/training-job/" -->
<script src="/training-job/assets/js/index-b74cefa0.js"></script>
<link href="/training-job/assets/css/index-e41487c8.css" rel="stylesheet">
```

**Rebuild frontend:**
```bash
cd ~/loiht2/dcn-kubeflow/kubeflow/components/crud-web-apps/ml-platform-training-job/frontend
docker build -t loihoangthanh1411/ml-platform-frontend:kubeflow-v1.2 .
docker push loihoangthanh1411/ml-platform-frontend:kubeflow-v1.2
kubectl set image deployment/ml-platform-frontend -n kubeflow frontend=loihoangthanh1411/ml-platform-frontend:kubeflow-v1.2
```

**File:** `kubeflow/components/crud-web-apps/ml-platform-training-job/frontend/vite.config.ts`

---

## How Kubeflow Centraldashboard Works

Understanding the architecture is key to troubleshooting:

### **1. Menu Configuration**
In centraldashboard ConfigMap, menu links are defined:
```json
{
  "icon": "assignment",
  "link": "/training-job/",
  "text": "Training Jobs",
  "type": "item"
}
```

### **2. URL Routing**
- User clicks "Training Jobs" in menu
- URL changes to: `http://192.168.40.246:32269/_/training-job/?ns=kubeflow-user-example-com`
- Note the `/_/` prefix - this is centraldashboard's internal iframe routing

### **3. Iframe Creation**
Centraldashboard's frontend JavaScript:
- Checks if `'training-job'` is in `ALL_NAMESPACES_ALLOWED_LIST`
- If yes, creates iframe with src: `/training-job/?ns=kubeflow-user-example-com`
- If no, doesn't create iframe (blank page, no network activity)

### **4. Service Discovery**
Centraldashboard proxies iframe requests to backend services using convention:
- Menu link: `/training-job/`
- Expected service name: `training-job-web-app-service`
- Service lookup: `training-job-web-app-service.kubeflow.svc.cluster.local`

### **5. Istio VirtualService Routing**
```yaml
http:
  - match:
    - uri:
        prefix: /training-job/
    rewrite:
      uri: /
    route:
      - destination:
          host: training-job-web-app-service.kubeflow.svc.cluster.local
          port:
            number: 80
```

Routes `/training-job/*` requests to the service, rewriting paths (e.g., `/training-job/assets/js/app.js` → `/assets/js/app.js`).

---

## Verification Steps

### **1. Check Service Exists**
```bash
kubectl get svc training-job-web-app-service -n kubeflow
```

Expected output:
```
NAME                           TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
training-job-web-app-service   ClusterIP   10.107.146.103   <none>        80/TCP    1h
```

### **2. Check VirtualService**
```bash
kubectl get virtualservice kf-training-job-ui -n kubeflow -o yaml
```

Verify routes to correct service.

### **3. Check Centraldashboard Image**
```bash
kubectl get deployment centraldashboard -n kubeflow -o jsonpath='{.spec.template.spec.containers[0].image}'
```

Expected: `loihoangthanh1411/centraldashboard:2.3` (or your custom version with whitelist fix)

### **4. Check Frontend Image**
```bash
kubectl get deployment ml-platform-frontend -n kubeflow -o jsonpath='{.spec.template.spec.containers[0].image}'
```

Expected: `loihoangthanh1411/ml-platform-frontend:kubeflow-v1.2` (or later with correct Vite base path)

### **5. Verify Asset Paths**
```bash
kubectl exec -n kubeflow $(kubectl get pod -n kubeflow -l app=ml-platform,component=frontend -o name | head -1) -c frontend -- cat /usr/share/nginx/html/index.html | grep -E "href=|src="
```

Expected output (note `/training-job/` prefix):
```html
<link rel="icon" href="/training-job/favicon.ico" />
<script type="module" crossorigin src="/training-job/assets/js/index-b74cefa0.js"></script>
<link rel="stylesheet" href="/training-job/assets/css/index-e41487c8.css">
```

### **6. Test in Browser**
1. Navigate to: `http://192.168.40.246:32269`
2. Log in with Kubeflow credentials
3. Open F12 Developer Tools → Network tab
4. Enable "Disable cache"
5. Click "Training Jobs" in menu
6. Verify:
   - URL changes to `/_/training-job/?ns=<your-namespace>`
   - Network tab shows successful requests for HTML, JS, CSS
   - UI loads correctly

---

## Deployment Manifest Updates

Final deployment configuration ensures all images are correct:

```yaml
# Frontend Deployment
spec:
  template:
    spec:
      containers:
        - name: frontend
          image: loihoangthanh1411/ml-platform-frontend:kubeflow-v1.2
          # ... rest of spec

# Centraldashboard Deployment (update separately)
spec:
  template:
    spec:
      containers:
        - name: centraldashboard
          image: loihoangthanh1411/centraldashboard:2.3
          # ... rest of spec
```

---

## Common Debugging Tips

### **Symptom: Blank page, no network requests**
- **Cause:** App not in centraldashboard whitelist
- **Fix:** Add to `ALL_NAMESPACES_ALLOWED_LIST` and rebuild centraldashboard

### **Symptom: 404 errors for JS/CSS assets**
- **Cause:** Wrong Vite `base` path
- **Fix:** Set `base: "/training-job/"` in `vite.config.ts` and rebuild frontend

### **Symptom: 403 Forbidden**
- **Cause:** Wrong service name or missing AuthorizationPolicy
- **Fix:** Rename service to `<app>-web-app-service` pattern

### **Symptom: Iframe not loading (X-Frame-Options error in console)**
- **Cause:** Security headers blocking iframe
- **Fix:** Remove `X-Frame-Options` from nginx config

---

## Summary

All four fixes were necessary for the integration to work:

| Issue | Impact | Fix |
|-------|--------|-----|
| X-Frame-Options | Blocks iframe embedding | Remove header from nginx.conf |
| Service naming | Centraldashboard can't discover service | Rename to `training-job-web-app-service` |
| Whitelist missing | Centraldashboard doesn't create iframe | Add `'training-job'` to whitelist |
| Wrong base path | Assets return 404 errors | Set Vite `base: "/training-job/"` |

**Final Result:** ✅ ML Platform Training Job UI successfully embedded in Kubeflow at:
```
http://192.168.40.246:32269/_/training-job/?ns=kubeflow-user-example-com
```

---

## References

- Centraldashboard service discovery: Convention-based `<link>-web-app-service`
- Namespace-aware apps whitelist: `public/components/namespace-selector.js`
- Vite base path: https://vitejs.dev/config/shared-options.html#base
- Kubeflow architecture: https://www.kubeflow.org/docs/components/central-dash/overview/
