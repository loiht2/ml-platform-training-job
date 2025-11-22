package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/loiht2/ml-platform-training-job/backend/config"
	"github.com/loiht2/ml-platform-training-job/backend/converter"
	"github.com/loiht2/ml-platform-training-job/backend/karmada"
	"github.com/loiht2/ml-platform-training-job/backend/models"
	"github.com/loiht2/ml-platform-training-job/backend/repository"
)

// Handler handles HTTP requests
type Handler struct {
	cfg       *config.Config
	repo      *repository.Repository
	converter *converter.Converter
	karmada   *karmada.Client
}

// NewHandler creates a new handler instance
func NewHandler(cfg *config.Config, repo *repository.Repository) *Handler {
	return &Handler{
		cfg:       cfg,
		repo:      repo,
		converter: converter.NewConverter(),
		karmada:   karmada.NewClient(cfg.KarmadaClient, cfg.KarmadaK8sClient),
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

	// Set default namespace
	if req.Namespace == "" {
		req.Namespace = "default"
	}

	// Validate job name
	if req.JobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job name is required"})
		return
	}

	// Generate unique job ID
	jobID := fmt.Sprintf("%s-%s", req.JobName, uuid.New().String()[:8])
	log.Printf("Creating training job: %s (ID: %s)", req.JobName, jobID)

	// Save to database
	dbJob, err := h.repo.CreateTrainingJob(&req, jobID)
	if err != nil {
		log.Printf("Failed to create training job in database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create training job in database",
			"details": err.Error(),
		})
		return
	}

	// Convert to K8s resource and apply to Karmada
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var applyErr error
	
	// Determine job type from algorithm
	jobType := req.Algorithm.AlgorithmName
	
	// For XGBoost and similar algorithms, create RayJob
	if jobType == "xgboost" || jobType == "ray" {
		// Create PVC first (optional, only if needed)
		if req.Resources.VolumeSizeGB > 0 && req.PVCName == "" {
			pvc := h.converter.CreatePVC(&req, jobID)
			if err := h.karmada.CreatePVC(ctx, pvc); err != nil {
				log.Printf("Warning: Failed to create PVC: %v", err)
				// Continue anyway - PVC might already exist
			}
		}
		
		// Create RayJob using new converter
		rayJob, err := h.converter.ConvertToRayJobV2(&req, jobID)
		if err != nil {
			applyErr = fmt.Errorf("failed to convert to RayJob: %w", err)
		} else {
			applyErr = h.karmada.CreateRayJobWithPropagationPolicy(ctx, rayJob, req.TargetClusters)
		}
	} else {
		// For other algorithms, create standard Kubernetes Job
		// Note: This uses old format, may need updating
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported algorithm. Only 'xgboost' and 'ray' are supported currently."})
		return
	}

	if applyErr != nil {
		log.Printf("Failed to apply job to Karmada: %v", applyErr)
		// Update database status
		h.repo.UpdateTrainingJobStatus(jobID, "Failed", applyErr.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to apply job: %v", applyErr)})
		return
	}

	// Update status to Running
	h.repo.UpdateTrainingJobStatus(jobID, "Running", "Job submitted to Karmada")

	// Convert to response
	response, err := h.repo.ToResponse(dbJob)
	if err != nil {
		log.Printf("Failed to convert to response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create response"})
		return
	}
	response.Status = "Running"

	c.JSON(http.StatusCreated, response)
}

// ListTrainingJobs handles GET /api/v1/jobs
func (h *Handler) ListTrainingJobs(c *gin.Context) {
	namespace := c.Query("namespace")

	jobs, err := h.repo.ListTrainingJobs(namespace)
	if err != nil {
		log.Printf("Failed to list training jobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list training jobs"})
		return
	}

	responses := make([]*models.TrainingJobResponse, 0, len(jobs))
	for i := range jobs {
		response, err := h.repo.ToResponse(&jobs[i])
		if err != nil {
			log.Printf("Failed to convert job to response: %v", err)
			continue
		}
		responses = append(responses, response)
	}

	c.JSON(http.StatusOK, responses)
}

// GetTrainingJob handles GET /api/v1/jobs/:id
func (h *Handler) GetTrainingJob(c *gin.Context) {
	id := c.Param("id")

	job, err := h.repo.GetTrainingJob(id)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	response, err := h.repo.ToResponse(job)
	if err != nil {
		log.Printf("Failed to convert to response: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get training job"})
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteTrainingJob handles DELETE /api/v1/jobs/:id
func (h *Handler) DeleteTrainingJob(c *gin.Context) {
	id := c.Param("id")

	// Get job from database
	job, err := h.repo.GetTrainingJob(id)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	// Delete from Karmada
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := h.karmada.DeleteJob(ctx, job.JobName, job.Namespace); err != nil {
		log.Printf("Failed to delete job from Karmada: %v", err)
		// Continue with database deletion even if Karmada deletion fails
	}

	// Delete from database
	if err := h.repo.DeleteTrainingJob(id); err != nil {
		log.Printf("Failed to delete training job from database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete training job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Training job deleted successfully"})
}

// GetTrainingJobStatus handles GET /api/v1/jobs/:id/status
func (h *Handler) GetTrainingJobStatus(c *gin.Context) {
	id := c.Param("id")

	// Get job from database
	job, err := h.repo.GetTrainingJob(id)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	// Get live status from Karmada
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	k8sJob, err := h.karmada.GetJobStatus(ctx, job.JobName, job.Namespace)
	if err != nil {
		log.Printf("Failed to get job status from Karmada: %v", err)
		// Return database status if Karmada query fails
		c.JSON(http.StatusOK, gin.H{
			"status":  job.Status,
			"message": job.Message,
		})
		return
	}

	// Build status response
	status := models.JobStatus{
		Active:    k8sJob.Status.Active,
		Succeeded: k8sJob.Status.Succeeded,
		Failed:    k8sJob.Status.Failed,
	}

	if k8sJob.Status.StartTime != nil {
		status.StartTime = k8sJob.Status.StartTime.Time
	}
	if k8sJob.Status.CompletionTime != nil {
		status.CompletionTime = k8sJob.Status.CompletionTime.Time
	}

	// Determine phase
	if status.Succeeded > 0 {
		status.Phase = "Succeeded"
		status.Message = "Job completed successfully"
	} else if status.Failed > 0 {
		status.Phase = "Failed"
		status.Message = "Job failed"
	} else if status.Active > 0 {
		status.Phase = "Running"
		status.Message = "Job is running"
	} else {
		status.Phase = "Pending"
		status.Message = "Job is pending"
	}

	// Update database with latest status
	h.repo.UpdateTrainingJobStatus(id, status.Phase, status.Message)

	c.JSON(http.StatusOK, status)
}

// GetTrainingJobLogs handles GET /api/v1/jobs/:id/logs
func (h *Handler) GetTrainingJobLogs(c *gin.Context) {
	id := c.Param("id")

	// Get job from database
	job, err := h.repo.GetTrainingJob(id)
	if err != nil {
		log.Printf("Failed to get training job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Training job not found"})
		return
	}

	// Note: Implementing log retrieval through Karmada requires more complex setup
	// This is a placeholder that returns a message
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Log retrieval for job %s/%s not yet implemented", job.Namespace, job.JobName),
		"hint":    "Use kubectl logs through Karmada proxy to access logs from member clusters",
	})
}

// ListMemberClusters handles GET /api/v1/proxy/clusters
func (h *Handler) ListMemberClusters(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clusters, err := h.karmada.ListMemberClusters(ctx)
	if err != nil {
		log.Printf("Failed to list member clusters: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list member clusters"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"clusters": clusters})
}

// GetClusterResources handles GET /api/v1/proxy/clusters/:cluster/resources
func (h *Handler) GetClusterResources(c *gin.Context) {
	clusterName := c.Param("cluster")
	namespace := c.DefaultQuery("namespace", "default")
	resourceType := c.DefaultQuery("type", "pods")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resources, err := h.karmada.GetClusterResources(ctx, clusterName, namespace, resourceType)
	if err != nil {
		log.Printf("Failed to get cluster resources: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get resources: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster":   clusterName,
		"namespace": namespace,
		"type":      resourceType,
		"count":     len(resources),
		"resources": resources,
	})
}
