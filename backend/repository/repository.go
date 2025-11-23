package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/loiht2/ml-platform-training-job/backend/config"
	"github.com/loiht2/ml-platform-training-job/backend/models"
)

// Repository handles database operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new repository instance
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateTrainingJob creates a new training job record
func (r *Repository) CreateTrainingJob(req *models.TrainingJobRequest, id string) (*config.TrainingJob, error) {
	// Marshal entire request as JSON
	requestJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request payload: %w", err)
	}

	targetClustersJSON, err := json.Marshal(req.TargetClusters)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal target clusters: %w", err)
	}
	
	namespace := req.Namespace
	if namespace == "" {
		namespace = "default"
	}

	job := &config.TrainingJob{
		ID:             id,
		JobName:        req.JobName,
		Namespace:      namespace,
		Algorithm:      req.Algorithm.AlgorithmName,
		RequestPayload: string(requestJSON),
		TargetClusters: string(targetClustersJSON),
		Status:         "Pending",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := r.db.Create(job).Error; err != nil {
		return nil, fmt.Errorf("failed to create training job: %w", err)
	}

	return job, nil
}

// GetTrainingJob retrieves a training job by ID
func (r *Repository) GetTrainingJob(id string) (*config.TrainingJob, error) {
	var job config.TrainingJob
	if err := r.db.Where("id = ?", id).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

// ListTrainingJobs lists all training jobs
func (r *Repository) ListTrainingJobs(namespace string) ([]config.TrainingJob, error) {
	var jobs []config.TrainingJob
	query := r.db.Order("created_at DESC")
	
	if namespace != "" {
		query = query.Where("namespace = ?", namespace)
	}
	
	if err := query.Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

// UpdateTrainingJobStatus updates the status of a training job
func (r *Repository) UpdateTrainingJobStatus(id, status, message string) error {
	return r.db.Model(&config.TrainingJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":     status,
			"message":    message,
			"updated_at": time.Now(),
		}).Error
}

// DeleteTrainingJob soft deletes a training job
func (r *Repository) DeleteTrainingJob(id string) error {
	return r.db.Where("id = ?", id).Delete(&config.TrainingJob{}).Error
}

// ToResponse converts a database TrainingJob to API response
func (r *Repository) ToResponse(job *config.TrainingJob) (*models.TrainingJobResponse, error) {
	// Reconstruct the original request
	var req models.TrainingJobRequest
	if err := json.Unmarshal([]byte(job.RequestPayload), &req); err != nil {
		return nil, fmt.Errorf("failed to unmarshal request payload: %w", err)
	}

	var targetClusters []string
	if err := json.Unmarshal([]byte(job.TargetClusters), &targetClusters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal target clusters: %w", err)
	}

	return &models.TrainingJobResponse{
		ID:          job.ID,
		JobName:     job.JobName,
		Namespace:   job.Namespace,
		Algorithm:   job.Algorithm,
		Request:     &req,
		Status:      job.Status,
		Message:     job.Message,
		CreatedAt:   job.CreatedAt,
		UpdatedAt:   job.UpdatedAt,
	}, nil
}

// ListActiveJobs lists all jobs that are not in terminal state (Succeeded or Failed)
func (r *Repository) ListActiveJobs() ([]config.TrainingJob, error) {
	var jobs []config.TrainingJob
	err := r.db.Where("status NOT IN (?)", []string{"Succeeded", "Failed"}).
		Order("created_at DESC").
		Find(&jobs).Error
	if err != nil {
		return nil, err
	}
	return jobs, nil
}
