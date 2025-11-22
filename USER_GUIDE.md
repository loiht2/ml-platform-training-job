# ML Platform Training Job - User Guide

## 🚀 Quick Start

### Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured
- Docker (for building images)
- Karmada and Management cluster kubeconfigs

### Deploy in 3 Steps

```bash
# 1. Clone the repository
git clone https://github.com/loiht2/ml-platform-training-job.git
cd ml-platform-training-job

# 2. Build images (optional - use pre-built images)
./build-images.sh

# 3. Deploy to Kubernetes
./deploy.sh
```

**Done! Your ML Platform is running! 🎉**

---

## 📋 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Kubernetes Cluster (ml-platform namespace)          │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Frontend (React + Nginx)                      │ │
│  │  NodePort: 30181                               │ │
│  │  Replicas: 1                                   │ │
│  └────────────────────────────────────────────────┘ │
│                       │                              │
│                       ▼ HTTP API                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  Backend (Go + Gin)                            │ │
│  │  NodePort: 30180                               │ │
│  │  Replicas: 1                                   │ │
│  │  • REST API                                    │ │
│  │  • Job Monitor (1s polling)                    │ │
│  └────────────────────────────────────────────────┘ │
│                       │                              │
│                       ▼                              │
│  ┌────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                           │ │
│  │  PVC: 10Gi                                     │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                       │
                       ▼ Karmada API
             ┌─────────────────┐
             │  Karmada        │
             │  Control Plane  │
             └─────────────────┘
                       │
                       ▼
             ┌─────────────────┐
             │  Member         │
             │  Clusters       │
             └─────────────────┘
```

---

## 🔧 Configuration

### Environment Variables

#### build-images.sh
```bash
DOCKER_REGISTRY=loiht2            # Docker registry name
BACKEND_IMAGE_NAME=ml-platform-backend
FRONTEND_IMAGE_NAME=ml-platform-frontend
VERSION=latest                     # Image version tag
```

#### deploy.sh
```bash
K8S_NAMESPACE=ml-platform         # Kubernetes namespace
BACKEND_IMAGE=loiht2/ml-platform-backend:latest
FRONTEND_IMAGE=loiht2/ml-platform-frontend:latest
KARMADA_KUBECONFIG=/path/to/karmada.config
MGMT_KUBECONFIG=/path/to/mgmt.config
```

### Kubeconfig Files

The deployment script looks for kubeconfig files at:
- Karmada: `/home/ubuntu/loiht2/kubeconfig/karmada-api-server.config`
- Management: `/home/ubuntu/loiht2/kubeconfig/mgmt.config`

You can override these with environment variables:
```bash
export KARMADA_KUBECONFIG=/your/path/to/karmada.config
export MGMT_KUBECONFIG=/your/path/to/mgmt.config
./deploy.sh
```

---

## 📦 Building Images

### Build Both Images

```bash
./build-images.sh
```

### Build Custom Version

```bash
export VERSION=v1.0.0
export DOCKER_REGISTRY=your-registry
./build-images.sh
```

### Push to Registry

```bash
docker push loiht2/ml-platform-backend:latest
docker push loiht2/ml-platform-frontend:latest
```

### Build Manually

**Backend:**
```bash
cd backend
docker build -t loiht2/ml-platform-backend:latest .
docker push loiht2/ml-platform-backend:latest
```

**Frontend:**
```bash
cd frontend
docker build -t loiht2/ml-platform-frontend:latest .
docker push loiht2/ml-platform-frontend:latest
```

---

## 🚢 Deployment

### Quick Deploy

```bash
./deploy.sh
```

### Custom Deployment

```bash
export K8S_NAMESPACE=my-platform
export BACKEND_IMAGE=my-registry/backend:v1
export FRONTEND_IMAGE=my-registry/frontend:v1
./deploy.sh
```

### Manual Deployment

```bash
# 1. Create namespace
kubectl create namespace ml-platform

# 2. Create secrets
kubectl create secret generic backend-kubeconfig \
  --from-file=karmada-kubeconfig=/path/to/karmada.config \
  --from-file=mgmt-kubeconfig=/path/to/mgmt.config \
  -n ml-platform

# 3. Apply deployment
kubectl apply -f k8s-deployment.yaml
```

---

## 🔍 Accessing the Application

### After Deployment

The deployment script will display access information:

```
Backend API:
  URL: http://<NODE_IP>:30180
  Health: http://<NODE_IP>:30180/health

Frontend:
  URL: http://<NODE_IP>:30181
```

### Get Node IP

```bash
kubectl get nodes -o wide
```

### Test Backend

```bash
# Get node IP
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')

# Test health endpoint
curl http://$NODE_IP:30180/health

# Expected: {"status":"healthy"}
```

### Access Frontend

Open in browser: `http://<NODE_IP>:30181`

---

## 📊 Monitoring

### Check Pod Status

```bash
kubectl get pods -n ml-platform

# Expected output:
NAME                                    READY   STATUS    RESTARTS
postgres-xxx                            1/1     Running   0
ml-platform-backend-xxx                 1/1     Running   0
ml-platform-frontend-xxx                1/1     Running   0
```

### View Logs

**Backend:**
```bash
kubectl logs -f -l app=ml-platform-backend -n ml-platform
```

**Frontend:**
```bash
kubectl logs -f -l app=ml-platform-frontend -n ml-platform
```

**PostgreSQL:**
```bash
kubectl logs -f -l app=postgres -n ml-platform
```

### Check Job Monitoring

```bash
kubectl logs -f -l app=ml-platform-backend -n ml-platform | grep "Job monitor"

# Expected:
Job monitor started - polling every 1 second
Monitoring X active jobs
```

---

## 🔧 Operations

### Scale Deployments

```bash
# Scale backend
kubectl scale deployment ml-platform-backend --replicas=2 -n ml-platform

# Scale frontend
kubectl scale deployment ml-platform-frontend --replicas=2 -n ml-platform
```

### Update Images

```bash
# Update backend
kubectl set image deployment/ml-platform-backend \
  backend=loiht2/ml-platform-backend:v2 -n ml-platform

# Update frontend
kubectl set image deployment/ml-platform-frontend \
  frontend=loiht2/ml-platform-frontend:v2 -n ml-platform
```

### Restart Deployments

```bash
kubectl rollout restart deployment/ml-platform-backend -n ml-platform
kubectl rollout restart deployment/ml-platform-frontend -n ml-platform
```

### Access Database

```bash
kubectl exec -it -n ml-platform \
  $(kubectl get pod -n ml-platform -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U mlplatform -d training_jobs

# List tables
\dt

# Query jobs
SELECT id, job_name, status FROM training_jobs;
```

---

## 🐛 Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n ml-platform

# Describe pod for events
kubectl describe pod <pod-name> -n ml-platform

# Check logs
kubectl logs <pod-name> -n ml-platform

# Check events
kubectl get events -n ml-platform --sort-by='.lastTimestamp'
```

### Backend CrashLoopBackOff

**Common causes:**
1. Database not ready - wait 1-2 minutes
2. Kubeconfig secrets missing or invalid
3. Database connection issues

**Check:**
```bash
# Verify secrets exist
kubectl get secret backend-kubeconfig -n ml-platform

# Check secret content
kubectl describe secret backend-kubeconfig -n ml-platform

# View backend logs
kubectl logs -l app=ml-platform-backend -n ml-platform

# Check if files are mounted
kubectl exec -it <backend-pod> -n ml-platform -- ls -la /etc/kubeconfig/
```

### Can't Access via NodePort

```bash
# Check service
kubectl get svc -n ml-platform

# Verify NodePort
kubectl get svc ml-platform-backend -n ml-platform -o yaml | grep nodePort

# Test from within cluster
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside pod:
wget -O- http://ml-platform-backend.ml-platform:8080/health
```

### Database Issues

```bash
# Check PostgreSQL pod
kubectl get pod -l app=postgres -n ml-platform

# Check PostgreSQL logs
kubectl logs -l app=postgres -n ml-platform

# Check PVC
kubectl get pvc -n ml-platform

# Test database connection
kubectl exec -it <postgres-pod> -n ml-platform -- \
  psql -U mlplatform -d training_jobs -c "SELECT 1;"
```

---

## 🧹 Cleanup

### Delete Everything

```bash
kubectl delete namespace ml-platform
```

### Delete Specific Components

```bash
# Delete deployments
kubectl delete deployment --all -n ml-platform

# Delete services
kubectl delete service --all -n ml-platform

# Delete secrets
kubectl delete secret --all -n ml-platform

# Delete PVC (will delete data!)
kubectl delete pvc --all -n ml-platform
```

---

## 📚 API Reference

### Health Check

```bash
curl http://<NODE_IP>:30080/health
```

### Create Training Job

```bash
curl -X POST http://<NODE_IP>:30180/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobName": "test-job",
    "namespace": "default",
    "algorithm": {
      "source": "default",
      "algorithmName": "xgboost"
    },
    "resources": {
      "instanceResources": {
        "cpuCores": 2,
        "memoryGiB": 4,
        "gpuCount": 0
      },
      "instanceCount": 1,
      "volumeSizeGB": 10
    },
    "hyperparameters": {
      "xgboost": {
        "num_round": 100,
        "eta": 0.3,
        "max_depth": 6
      }
    },
    "targetClusters": ["cluster1"]
  }'
```

### List Jobs

```bash
curl http://<NODE_IP>:30080/api/v1/jobs
```

### Get Job Status

```bash
curl http://<NODE_IP>:30180/api/v1/jobs/<job-id>/status
```

### Delete Job

```bash
curl -X DELETE http://<NODE_IP>:30180/api/v1/jobs/<job-id>
```

### List Member Clusters

```bash
curl http://<NODE_IP>:30080/api/v1/proxy/clusters
```

---

## 🎯 Production Considerations

### Security

1. **Change default passwords:**
   - Edit `k8s-deployment.yaml` and change `POSTGRES_PASSWORD`

2. **Use image pull secrets:**
   ```bash
   kubectl create secret docker-registry regcred \
     --docker-server=<your-registry> \
     --docker-username=<username> \
     --docker-password=<password> \
     -n ml-platform
   ```
   Then add to deployment:
   ```yaml
   spec:
     imagePullSecrets:
     - name: regcred
   ```

3. **Enable TLS:**
   - Use Ingress with TLS certificates
   - Configure Let's Encrypt with cert-manager

### High Availability

1. **Increase replicas:**
   ```yaml
   spec:
     replicas: 3  # For backend and frontend
   ```

2. **Use external database:**
   - Replace PostgreSQL with managed database (AWS RDS, Cloud SQL)
   - Update `DATABASE_URL` in ConfigMap

3. **Add anti-affinity:**
   ```yaml
   spec:
     affinity:
       podAntiAffinity:
         preferredDuringSchedulingIgnoredDuringExecution:
         - podAffinityTerm:
             labelSelector:
               matchLabels:
                 app: ml-platform-backend
             topologyKey: kubernetes.io/hostname
   ```

### Monitoring

1. **Add Prometheus metrics:**
   - Instrument backend with Prometheus client
   - Add ServiceMonitor for Prometheus Operator

2. **Add health checks:**
   - Configure liveness and readiness probes (already included)

3. **Add logging:**
   - Use Fluent Bit or Fluentd for log aggregation
   - Send logs to Elasticsearch or Loki

---

## 📖 Additional Resources

- **Backend README:** `backend/README.md` - Backend-specific documentation
- **Frontend README:** `frontend/README.md` - Frontend development guide
- **API Reference:** `backend/QUICK_REFERENCE.md` - Detailed API documentation

---

## 🆘 Support

For issues or questions:

1. Check logs: `kubectl logs -n ml-platform <pod-name>`
2. Check events: `kubectl get events -n ml-platform`
3. Describe resources: `kubectl describe <resource> -n ml-platform`

Common issues and solutions are documented in the Troubleshooting section above.

---

## 📝 License

[Add your license information here]

---

**Version:** 1.0.0  
**Last Updated:** November 2025
