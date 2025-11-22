package monitor

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/loiht2/ml-platform-training-job/backend/karmada"
	"github.com/loiht2/ml-platform-training-job/backend/repository"
)

// JobMonitor monitors job status in Karmada and updates database
type JobMonitor struct {
	repo          *repository.Repository
	karmadaClient *karmada.Client
	stopChan      chan struct{}
	wg            sync.WaitGroup
}

// NewJobMonitor creates a new job monitor
func NewJobMonitor(repo *repository.Repository, karmadaClient *karmada.Client) *JobMonitor {
	return &JobMonitor{
		repo:          repo,
		karmadaClient: karmadaClient,
		stopChan:      make(chan struct{}),
	}
}

// Start begins monitoring job status every 1 second
func (m *JobMonitor) Start() {
	m.wg.Add(1)
	go m.monitorLoop()
	log.Println("Job monitor started - polling every 1 second")
}

// Stop stops the job monitor gracefully
func (m *JobMonitor) Stop() {
	close(m.stopChan)
	m.wg.Wait()
	log.Println("Job monitor stopped")
}

// monitorLoop continuously monitors all jobs
func (m *JobMonitor) monitorLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.checkAllJobs()
		}
	}
}

// checkAllJobs checks status of all active jobs efficiently
func (m *JobMonitor) checkAllJobs() {
	// Get all jobs that are not in terminal state
	jobs, err := m.repo.ListActiveJobs()
	if err != nil {
		log.Printf("Failed to list active jobs: %v", err)
		return
	}

	if len(jobs) == 0 {
		return
	}

	// Log periodically (reduce noise)
	log.Printf("Monitoring %d active jobs", len(jobs))

	// Process jobs sequentially but efficiently
	// Note: Could be optimized with goroutines and semaphore if needed
	for _, job := range jobs {
		m.checkJobStatus(job.ID, job.JobName, job.Namespace)
	}
}

// checkJobStatus checks the status of a single job
func (m *JobMonitor) checkJobStatus(jobID, jobName, namespace string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get status from Karmada through aggregated API
	// First, try to get RayJob status (most common)
	rayJobStatus, err := m.karmadaClient.GetRayJobStatusFromMembers(ctx, jobName, namespace)
	if err != nil {
		// If RayJob not found, try regular Job
		k8sJob, err := m.karmadaClient.GetJobStatus(ctx, jobName, namespace)
		if err != nil {
			log.Printf("Failed to get status for job %s: %v", jobName, err)
			return
		}

		// Update status based on K8s Job
		m.updateJobStatusFromK8sJobTyped(jobID, k8sJob)
		return
	}

	// Update status based on RayJob
	m.updateJobStatusFromRayJob(jobID, rayJobStatus)
}

// updateJobStatusFromK8sJobTyped updates database from K8s Job status (typed)
func (m *JobMonitor) updateJobStatusFromK8sJobTyped(jobID string, job interface{}) {
	// This would need proper type assertion for batchv1.Job
	// For now, we'll primarily use RayJob status monitoring
	// This is a fallback that we can enhance later
	log.Printf("K8s Job status monitoring not fully implemented for job %s", jobID)
}

// updateJobStatusFromK8sJob updates database from K8s Job status
func (m *JobMonitor) updateJobStatusFromK8sJob(jobID string, status map[string]interface{}) {
	active := getInt32(status, "active")
	succeeded := getInt32(status, "succeeded")
	failed := getInt32(status, "failed")

	var newStatus, message string

	if succeeded > 0 {
		newStatus = "Succeeded"
		message = "Job completed successfully"
	} else if failed > 0 {
		newStatus = "Failed"
		message = "Job failed"
	} else if active > 0 {
		newStatus = "Running"
		message = "Job is running"
	} else {
		newStatus = "Pending"
		message = "Job is pending"
	}

	// Check if status changed
	currentJob, err := m.repo.GetTrainingJob(jobID)
	if err != nil {
		log.Printf("Failed to get current job status: %v", err)
		return
	}

	if currentJob.Status != newStatus {
		log.Printf("Job %s status changed: %s -> %s", jobID, currentJob.Status, newStatus)
		if err := m.repo.UpdateTrainingJobStatus(jobID, newStatus, message); err != nil {
			log.Printf("Failed to update job status: %v", err)
		}
	}
}

// updateJobStatusFromRayJob updates database from RayJob status
func (m *JobMonitor) updateJobStatusFromRayJob(jobID string, status map[string]interface{}) {
	// RayJob status has jobStatus and jobDeploymentStatus
	jobStatus := getString(status, "jobStatus")
	jobDeploymentStatus := getString(status, "jobDeploymentStatus")

	var newStatus, message string

	switch jobStatus {
	case "SUCCEEDED":
		newStatus = "Succeeded"
		message = "RayJob completed successfully"
	case "FAILED":
		newStatus = "Failed"
		message = "RayJob failed"
	case "RUNNING":
		newStatus = "Running"
		message = fmt.Sprintf("RayJob is running (deployment: %s)", jobDeploymentStatus)
	case "PENDING":
		newStatus = "Pending"
		message = "RayJob is pending"
	default:
		if jobDeploymentStatus == "Running" {
			newStatus = "Running"
			message = "RayJob cluster is running"
		} else {
			newStatus = "Pending"
			message = fmt.Sprintf("RayJob deployment status: %s", jobDeploymentStatus)
		}
	}

	// Check if status changed
	currentJob, err := m.repo.GetTrainingJob(jobID)
	if err != nil {
		log.Printf("Failed to get current job status: %v", err)
		return
	}

	if currentJob.Status != newStatus {
		log.Printf("Job %s status changed: %s -> %s", jobID, currentJob.Status, newStatus)
		if err := m.repo.UpdateTrainingJobStatus(jobID, newStatus, message); err != nil {
			log.Printf("Failed to update job status: %v", err)
		}
	}
}

// Helper functions
func getInt32(m map[string]interface{}, key string) int32 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case int32:
			return val
		case int:
			return int32(val)
		case int64:
			return int32(val)
		case float64:
			return int32(val)
		}
	}
	return 0
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}


