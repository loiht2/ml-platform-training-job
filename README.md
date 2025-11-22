# ML Platform Training Job Management System

> A comprehensive Kubernetes-native platform for managing distributed machine learning training jobs on multi-cluster environments with Karmada.

[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.19+-blue.svg)](https://kubernetes.io/)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 Features

### Core Capabilities
- ✅ **Multi-Cluster Training Job Management** - Deploy and manage ML training jobs across Karmada member clusters
- ✅ **Real-time Job Monitoring** - Automatic job status tracking (1-second polling interval)
- ✅ **Multiple ML Frameworks** - Support for TensorFlow, PyTorch, XGBoost, LightGBM, JAX, Horovod, DeepSpeed
- ✅ **Custom Hyperparameters** - Framework-specific hyperparameter configuration
- ✅ **Resource Management** - Flexible CPU, Memory, GPU allocation per job
- ✅ **Persistent Storage** - Job metadata and configuration stored in PostgreSQL
- ✅ **RESTful API** - Clean HTTP API for job lifecycle management

### Technical Stack
- **Backend:** Go 1.21, Gin Framework, GORM, Karmada Client
- **Frontend:** React 19, TypeScript 5, Vite 4.5, Tailwind CSS 4, Radix UI
- **Database:** PostgreSQL 15
- **Container Runtime:** Docker
- **Orchestration:** Kubernetes with Karmada for multi-cluster federation

---

## 🚀 Quick Start

### Prerequisites
```bash
# Required
- Kubernetes cluster (1.19+)
- kubectl configured and connected
- Docker for building images
- Karmada control plane deployed
- Access to karmada-apiserver and management cluster kubeconfigs

# Optional
- Docker registry access for pushing images
```

### Deploy in 3 Commands

```bash
# 1. Clone repository
git clone https://github.com/loiht2/ml-platform-training-job.git
cd ml-platform-training-job

# 2. Build Docker images (optional - pre-built images available)
./build-images.sh

# 3. Deploy to Kubernetes
./deploy.sh
```

**That's it! Your ML Platform is now running! 🎉**

---

## 📊 Access Your Platform

After successful deployment:

### Frontend Web UI
```
http://<NODE_IP>:30181
```

### Backend API
```
http://<NODE_IP>:30180
```

### Health Check
```bash
curl http://<NODE_IP>:30180/health
# Expected: {"status":"healthy"}
```

Get your node IP:
```bash
kubectl get nodes -o wide
```

---

## 📁 Project Structure

```
ml-platform-training-job/
├── backend/                    # Go backend service
│   ├── cmd/main.go            # Application entry point
│   ├── internal/              # Business logic
│   │   ├── config/            # Configuration management
│   │   ├── converter/         # Job spec conversion
│   │   ├── handlers/          # HTTP request handlers
│   │   ├── karmada/           # Karmada client integration
│   │   ├── models/            # Data models
│   │   ├── monitor/           # Job status monitoring
│   │   └── repository/        # Database operations
│   ├── go.mod                 # Go dependencies
│   └── Dockerfile             # Backend container image
│
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── pages/             # Main page components
│   │   │   ├── CreateTrainingJobPage.tsx
│   │   │   └── TrainingJobsListPage.tsx
│   │   ├── components/        # Reusable UI components
│   │   ├── app/create/hyperparameters/  # Framework forms
│   │   └── lib/               # Utilities
│   ├── package.json           # Node dependencies
│   └── Dockerfile             # Frontend container image
│
├── k8s-deployment.yaml         # Kubernetes deployment manifests
├── build-images.sh            # Docker image build script
├── deploy.sh                  # Automated K8s deployment script
├── USER_GUIDE.md              # Comprehensive user documentation
└── README.md                  # This file
```

---

## 🎯 Usage Examples

### Create a Training Job

#### Using Web UI
1. Navigate to `http://<NODE_IP>:30081`
2. Click "Create New Training Job"
3. Fill in job details:
   - Job name, namespace, algorithm
   - Resources (CPU, memory, GPU)
   - Hyperparameters
   - Target clusters
4. Click "Submit Job"

#### Using API
```bash
curl -X POST http://<NODE_IP>:30180/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobName": "xgboost-training",
    "namespace": "default",
    "algorithm": {
      "source": "default",
      "algorithmName": "xgboost"
    },
    "resources": {
      "instanceResources": {
        "cpuCores": 4,
        "memoryGiB": 8,
        "gpuCount": 0
      },
      "instanceCount": 1,
      "volumeSizeGB": 20
    },
    "hyperparameters": {
      "xgboost": {
        "num_round": 100,
        "eta": 0.3,
        "max_depth": 6,
        "objective": "binary:logistic"
      }
    },
    "targetClusters": ["member-cluster-1"]
  }'
```

### List All Jobs
```bash
curl http://<NODE_IP>:30180/api/v1/jobs | jq
```

### Get Job Status
```bash
curl http://<NODE_IP>:30180/api/v1/jobs/<job-id>/status
```

### Delete a Job
```bash
curl -X DELETE http://<NODE_IP>:30180/api/v1/jobs/<job-id>
```

---

## 🔧 Configuration

### Environment Variables

#### Backend (k8s-deployment.yaml)
```yaml
DATABASE_URL: "host=postgres user=mlplatform password=changeme dbname=training_jobs sslmode=disable"
KARMADA_KUBECONFIG_PATH: "/etc/kubeconfig/karmada-kubeconfig"
MGMT_KUBECONFIG_PATH: "/etc/kubeconfig/mgmt-kubeconfig"
JOB_MONITOR_INTERVAL: "1s"
```

#### Frontend
```yaml
VITE_API_BASE_URL: "http://ml-platform-backend:8080"
```

### Customizing Deployment

Edit `deploy.sh` environment variables:
```bash
export K8S_NAMESPACE=my-namespace
export BACKEND_IMAGE=my-registry/backend:v2
export FRONTEND_IMAGE=my-registry/frontend:v2
export KARMADA_KUBECONFIG=/path/to/karmada.config
export MGMT_KUBECONFIG=/path/to/mgmt.config
./deploy.sh
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [USER_GUIDE.md](USER_GUIDE.md) | Complete user guide with troubleshooting |
| [backend/README.md](backend/README.md) | Backend development documentation |
| [frontend/README.md](frontend/README.md) | Frontend development documentation |

---

## 🛠️ Development

### Backend Development
```bash
cd backend

# Install dependencies
go mod download

# Run locally
go run cmd/main.go

# Build binary
go build -o main cmd/main.go

# Run tests
go test ./...
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔍 Monitoring & Operations

### Check System Status
```bash
kubectl get pods -n ml-platform
kubectl get svc -n ml-platform
kubectl get pvc -n ml-platform
```

### View Logs
```bash
# Backend logs
kubectl logs -f -l app=ml-platform-backend -n ml-platform

# Frontend logs
kubectl logs -f -l app=ml-platform-frontend -n ml-platform

# Database logs
kubectl logs -f -l app=postgres -n ml-platform
```

### Scale Services
```bash
# Scale backend
kubectl scale deployment ml-platform-backend --replicas=3 -n ml-platform

# Scale frontend
kubectl scale deployment ml-platform-frontend --replicas=3 -n ml-platform
```

---

## 🐛 Troubleshooting

### Backend Pod Not Starting

**Check logs:**
```bash
kubectl logs -l app=ml-platform-backend -n ml-platform --tail=50
```

**Common issues:**
- Database not ready → Wait 1-2 minutes for PostgreSQL initialization
- Kubeconfig secrets missing → Verify secrets exist: `kubectl get secret backend-kubeconfig -n ml-platform`
- Image pull errors → Check image name and registry access

### Can't Access NodePort

**Verify services:**
```bash
kubectl get svc -n ml-platform
```

**Test from within cluster:**
```bash
kubectl run -it --rm test --image=alpine --restart=Never -- sh
wget -O- http://ml-platform-backend.ml-platform:8080/health
```

### Database Connection Issues

**Check PostgreSQL:**
```bash
kubectl get pod -l app=postgres -n ml-platform
kubectl logs -l app=postgres -n ml-platform

# Connect to database
kubectl exec -it <postgres-pod> -n ml-platform -- \
  psql -U mlplatform -d training_jobs
```

For more troubleshooting, see [USER_GUIDE.md](USER_GUIDE.md#-troubleshooting)

---

## 🧹 Cleanup

### Remove Everything
```bash
kubectl delete namespace ml-platform
```

### Remove Specific Components
```bash
# Delete deployments only
kubectl delete deployment --all -n ml-platform

# Delete services
kubectl delete service --all -n ml-platform

# Delete data (PVC)
kubectl delete pvc --all -n ml-platform
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│                  NodePort: 30081                         │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTP API
┌─────────────────────▼────────────────────────────────────┐
│                 Backend (Go + Gin)                        │
│                  NodePort: 30080                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ REST API │ Job Monitor │ Karmada Client            │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   PostgreSQL     │    │  Karmada API     │
│   (Job Metadata) │    │  Server          │
└──────────────────┘    └────────┬─────────┘
                                 │
                      ┌──────────┴──────────┐
                      ▼                     ▼
              ┌───────────────┐    ┌───────────────┐
              │ Member        │    │ Member        │
              │ Cluster 1     │    │ Cluster 2     │
              │ (Training)    │    │ (Training)    │
              └───────────────┘    └───────────────┘
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Karmada](https://karmada.io/) - Multi-cluster orchestration
- [Gin](https://gin-gonic.com/) - Go web framework
- [React](https://reactjs.org/) - Frontend library
- [Radix UI](https://www.radix-ui.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

## 📧 Contact

For questions or support, please open an issue in the GitHub repository.

---

**Built with ❤️ for the ML community**