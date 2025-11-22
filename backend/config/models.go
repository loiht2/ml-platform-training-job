package config

import (
	"time"

	"gorm.io/gorm"
)

// TrainingJob represents a training job in the database
type TrainingJob struct {
	ID             string `gorm:"primaryKey"`
	JobName        string `gorm:"index"`
	Namespace      string `gorm:"index"`
	Algorithm      string `gorm:"index"` // algorithmName from request
	Priority       int
	RequestPayload string `gorm:"type:jsonb"` // Full request as JSON for reconstruction
	TargetClusters string `gorm:"type:text"`  // JSON array of target cluster names
	Status         string `gorm:"index"`
	Message        string `gorm:"type:text"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

// TableName overrides the table name
func (TrainingJob) TableName() string {
	return "training_jobs"
}
