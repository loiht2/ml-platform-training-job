package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/loiht2/ml-platform-training-job/backend/config"
	"github.com/loiht2/ml-platform-training-job/backend/converter"
	"github.com/loiht2/ml-platform-training-job/backend/k8s"
	"github.com/loiht2/ml-platform-training-job/backend/middleware"
	"github.com/loiht2/ml-platform-training-job/backend/models"
	"github.com/loiht2/ml-platform-training-job/backend/storage"
)

// Handler handles HTTP requests
type Handler struct {
	cfg       *config.Config
	converter *converter.Converter
	k8sClient *k8s.Client
}

// NewHandler creates a new handler instance
func NewHandler(cfg *config.Config, k8sClient *k8s.Client) *Handler {
	return &Handler{
		cfg:       cfg,
		converter: converter.NewConverter(),
		k8sClient: k8sClient,
	}
}

// CreateTrainingJob handles POST /api/v1/jobs
func (h *Handler) CreateTrainingJob(c *gin.Context) {
	var req models.TrainingJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Invalid request payload: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request payload",
			"details": err.Error(),
		})
		return
	}

	// Get user info from authenticated context
	userEmail := middleware.GetUserEmail(c)
	
	// Use namespace from request (set by frontend from Kubeflow env-info)
	// If not provided, fall back to user's default namespace
	if req.Namespace == "" {
		req.Namespace = middleware.GetTargetNamespace(c)
		log.Printf("No namespace in request, using default: %s", req.Namespace)
	}
	
	log.Printf("User %s creating job '%s' in namespace '%s'", userEmail, req.JobName, req.Namespace)

	// Validate job name
	if req.JobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job name is required"})
		return
	}

	// Generate unique job ID
	jobID := fmt.Sprintf("%s-%s", req.JobName, uuid.New().String()[:8])
	log.Printf("Creating training job: %s (ID: %s)", req.JobName, jobID)

	// Convert to K8s resource and create
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Determine job type from algorithm
	jobType := req.Algorithm.AlgorithmName
	
	// For XGBoost and similar algorithms, create RayJob
	if jobType != "xgboost" && jobType != "ray" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported algorithm. Only 'xgboost' and 'ray' are supported currently."})
		return
	}

	// Create PVC first (optional, only if needed)
	if req.Resources.VolumeSizeGB > 0 && req.PVCName == "" {
		pvc := h.converter.CreatePVC(&req, jobID)
		if err := h.k8sClient.CreatePVC(ctx, pvc); err != nil {
			log.Printf("Warning: Failed to create PVC: %v", err)
			// Continue anyway - PVC might already exist
		}
	}
	
	// Create RayJob using converter
	rayJob, err := h.converter.ConvertToRayJobV2(&req, jobID)
	if err != nil {
		log.Printf("Failed to convert to RayJob: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to convert to RayJob",
			"details": err.Error(),
		})
		return
	}

	if err := h.k8sClient.CreateRayJob(ctx, rayJob); err != nil {
		log.Printf("Failed to create RayJob in Kubernetes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create RayJob",
			"details": err.Error(),
		})
		return
	}

	// Build response from created job
	response := &models.TrainingJobResponse{
		ID:        jobID,
		JobName:   req.JobName,
		Namespace: req.Namespace,
		Algorithm: req.Algorithm.AlgorithmName,
		Priority:  req.Priority,
		Request:   &req,
		Status:    "Pending",
		Message:   "Job created successfully",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	log.Printf("Successfully created RayJob %s in namespace %s", jobID, req.Namespace)
	c.JSON(http.StatusCreated, response)
}

// ListTrainingJobs handles GET /api/v1/jobs
func (h *Handler) ListTrainingJobs(c *gin.Context) {
	// Use authenticated user's namespace
	namespace := middleware.GetTargetNamespace(c)
	userEmail := middleware.GetUserEmail(c)
	
	log.Printf("User %s listing jobs in namespace %s", userEmail, namespace)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rayJobs, err := h.k8sClient.ListActiveRayJobs(ctx, namespace)
	if err != nil {
		log.Printf("Failed to list RayJobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list training jobs"})
		return
	}

	responses := make([]*models.TrainingJobResponse, 0, len(rayJobs))
	for _, rayJob := range rayJobs {
		// Extract metadata from RayJob
		metadata, ok := rayJob["metadata"].(map[string]interface{})
		if !ok {
			continue
		}

		name, _ := metadata["name"].(string)
		namespace, _ := metadata["namespace"].(string)
		
		// Parse creation timestamp
		createdAt := time.Now()
		if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, creationTimestamp); err == nil {
				createdAt = parsed
			}
		}

		// Extract status and times
		jobStatus := ""
		deploymentStatus := ""
		var startTime, endTime *time.Time
		
		if statusMap, ok := rayJob["status"].(map[string]interface{}); ok {
			// Job Status (RUNNING, SUCCEEDED, FAILED, etc.)
			if js, ok := statusMap["jobStatus"].(string); ok {
				jobStatus = js
			}
			// Deployment Status (Initializing, Running, Complete, Failed)
			if ds, ok := statusMap["jobDeploymentStatus"].(string); ok {
				deploymentStatus = ds
			}
			// Start Time
			if st, ok := statusMap["startTime"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, st); err == nil {
					startTime = &parsed
				}
			}
			// End Time
			if et, ok := statusMap["endTime"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, et); err == nil {
					endTime = &parsed
				}
			}
		}

		// Extract algorithm from labels
		algorithm := "xgboost"
		if labels, ok := metadata["labels"].(map[string]interface{}); ok {
			if algo, ok := labels["algorithm"].(string); ok {
				algorithm = algo
			}
		}

		response := &models.TrainingJobResponse{
			ID:               name,
			JobName:          name,
			Namespace:        namespace,
			Algorithm:        algorithm,
			JobStatus:        jobStatus,
			DeploymentStatus: deploymentStatus,
			CreatedAt:        createdAt,
			UpdatedAt:        createdAt,
		}
		
		if startTime != nil {
			response.StartTime = startTime
		}
		if endTime != nil {
			response.EndTime = endTime
		}

		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, responses)
}

// GetTrainingJob handles GET /api/v1/jobs/:id
func (h *Handler) GetTrainingJob(c *gin.Context) {
	id := c.Param("id")
	userNamespace := middleware.GetUserNamespace(c)
	userEmail := middleware.GetUserEmail(c)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get RayJob from Kubernetes (ID is the RayJob name)
	rayJob, err := h.k8sClient.GetRayJob(ctx, id, userNamespace)
	if err != nil {
		log.Printf("Failed to get RayJob: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	// Extract metadata
	metadata, ok := rayJob["metadata"].(map[string]interface{})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid RayJob metadata"})
		return
	}

	name, _ := metadata["name"].(string)
	namespace, _ := metadata["namespace"].(string)

	// Validate namespace access
	if namespace != userNamespace {
		log.Printf("User %s in namespace %s attempted to access job in namespace %s", 
			userEmail, userNamespace, namespace)
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to job in different namespace"})
		return
	}

	// Parse creation timestamp
	createdAt := time.Now()
	if creationTimestamp, ok := metadata["creationTimestamp"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, creationTimestamp); err == nil {
			createdAt = parsed
		}
	}

	// Extract status
	status := "Pending"
	message := ""
	if statusMap, ok := rayJob["status"].(map[string]interface{}); ok {
		if jobStatus, ok := statusMap["jobStatus"].(string); ok {
			status = jobStatus
		}
		if jobDeploymentStatus, ok := statusMap["jobDeploymentStatus"].(string); ok {
			message = jobDeploymentStatus
		}
	}

	// Extract algorithm from labels
	algorithm := "xgboost"
	if labels, ok := metadata["labels"].(map[string]interface{}); ok {
		if algo, ok := labels["algorithm"].(string); ok {
			algorithm = algo
		}
	}

	response := &models.TrainingJobResponse{
		ID:        name,
		JobName:   name,
		Namespace: namespace,
		Algorithm: algorithm,
		Status:    status,
		Message:   message,
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteTrainingJob handles DELETE /api/v1/jobs/:id
func (h *Handler) DeleteTrainingJob(c *gin.Context) {
	id := c.Param("id")
	userNamespace := middleware.GetUserNamespace(c)
	userEmail := middleware.GetUserEmail(c)

	log.Printf("User %s deleting job %s in namespace %s", userEmail, id, userNamespace)

	// Delete from Kubernetes (ID is the RayJob name)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := h.k8sClient.DeleteJob(ctx, id, userNamespace); err != nil {
		log.Printf("Failed to delete job from Kubernetes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete training job",
			"details": err.Error(),
		})
		return
	}

	log.Printf("Successfully deleted RayJob %s in namespace %s", id, userNamespace)
	c.JSON(http.StatusOK, gin.H{"message": "Training job deleted successfully"})
}

// GetTrainingJobStatus handles GET /api/v1/jobs/:id/status
func (h *Handler) GetTrainingJobStatus(c *gin.Context) {
	id := c.Param("id")
	userNamespace := middleware.GetUserNamespace(c)

	// Get live status from Kubernetes (ID is the RayJob name)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rayJobStatus, err := h.k8sClient.GetRayJobStatus(ctx, id, userNamespace)
	if err != nil {
		log.Printf("Failed to get RayJob status: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	// Extract status information
	jobStatus := "Pending"
	message := ""
	
	if status, ok := rayJobStatus["jobStatus"].(string); ok {
		jobStatus = status
	}
	if deploymentStatus, ok := rayJobStatus["jobDeploymentStatus"].(string); ok {
		message = deploymentStatus
	}

	// Parse timestamps
	var startTime, completionTime time.Time
	if startTimeStr, ok := rayJobStatus["startTime"].(string); ok {
		startTime, _ = time.Parse(time.RFC3339, startTimeStr)
	}
	if completionTimeStr, ok := rayJobStatus["endTime"].(string); ok {
		completionTime, _ = time.Parse(time.RFC3339, completionTimeStr)
	}

	// Build status response
	status := models.JobStatus{
		Phase:          jobStatus,
		Message:        message,
		StartTime:      startTime,
		CompletionTime: completionTime,
	}

	// RayJob doesn't have Active/Succeeded/Failed counts like K8s Jobs
	// Set based on status
	if jobStatus == "SUCCEEDED" {
		status.Succeeded = 1
		status.Phase = "Succeeded"
	} else if jobStatus == "FAILED" {
		status.Failed = 1
		status.Phase = "Failed"
	} else if jobStatus == "RUNNING" {
		status.Active = 1
		status.Phase = "Running"
	} else {
		status.Phase = "Pending"
	}

	c.JSON(http.StatusOK, status)
}

// GetTrainingJobLogs handles GET /api/v1/jobs/:id/logs
func (h *Handler) GetTrainingJobLogs(c *gin.Context) {
	id := c.Param("id")
	userNamespace := middleware.GetUserNamespace(c)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Log retrieval for job %s/%s - use kubectl logs", userNamespace, id),
		"hint":    "kubectl logs -n " + userNamespace + " -l ray.io/job-name=" + id,
	})
}

// ListNamespaces handles GET /api/v1/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	namespaces, err := h.k8sClient.ListNamespaces(ctx)
	if err != nil {
		log.Printf("Failed to list namespaces: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list namespaces"})
		return
	}

	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		// Filter to show only Kubeflow profile namespaces or default
		if strings.HasPrefix(ns.Name, "kubeflow-") || ns.Name == "default" || ns.Name == "kubeflow" {
			nsNames = append(nsNames, ns.Name)
		}
	}

	c.JSON(http.StatusOK, gin.H{"namespaces": nsNames})
}

// UploadFileToMinIO handles POST /api/v1/upload
// Uploads a file to MinIO bucket (bucket name = namespace)
func (h *Handler) UploadFileToMinIO(c *gin.Context) {
	// Get namespace from query parameter or use default
	namespace := c.Query("namespace")
	if namespace == "" {
		namespace = middleware.GetTargetNamespace(c)
	}
	
	log.Printf("Uploading file to namespace: %s", namespace)

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		log.Printf("Failed to get file from request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
		return
	}
	defer file.Close()

	// Get optional object key (path in bucket), default to filename
	objectKey := c.PostForm("objectKey")
	if objectKey == "" {
		objectKey = header.Filename
	}

	log.Printf("Uploading file: %s (size: %d bytes) as object: %s", header.Filename, header.Size, objectKey)

	// Initialize MinIO client from Kubernetes secret
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	minioClient, err := h.getMinIOClient(ctx, namespace)
	if err != nil {
		log.Printf("Failed to initialize MinIO client: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to initialize storage client",
			"details": err.Error(),
		})
		return
	}

	// Use namespace as bucket name
	bucketName := namespace

	// Upload file to MinIO
	uploadInfo, err := minioClient.UploadFile(ctx, bucketName, objectKey, file, header.Size, header.Header.Get("Content-Type"))
	if err != nil {
		log.Printf("Failed to upload file to MinIO: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to upload file to storage",
			"details": err.Error(),
		})
		return
	}

	log.Printf("File uploaded successfully: %s/%s (etag: %s)", bucketName, objectKey, uploadInfo.ETag)

	c.JSON(http.StatusOK, gin.H{
		"message":    "File uploaded successfully",
		"bucket":     bucketName,
		"objectKey":  objectKey,
		"size":       uploadInfo.Size,
		"etag":       uploadInfo.ETag,
		"endpoint":   fmt.Sprintf("minio.minio.svc.cluster.local:9000"),
	})
}

// getMinIOClient creates a MinIO client for the specified namespace
func (h *Handler) getMinIOClient(ctx context.Context, namespace string) (*storage.MinIOClient, error) {
	return storage.NewMinIOClientFromK8s(ctx, h.cfg.K8sClient, namespace)
}
