package models

import "time"

// TrainingJobRequest represents the NEW request payload from frontend
type TrainingJobRequest struct {
	JobName            string              `json:"jobName" binding:"required"`
	Priority           int                 `json:"priority"`
	Algorithm          Algorithm           `json:"algorithm" binding:"required"`
	Resources          Resources           `json:"resources" binding:"required"`
	StoppingCondition  StoppingCondition   `json:"stoppingCondition"`
	InputDataConfig    []InputDataConfig   `json:"inputDataConfig"`
	OutputDataConfig   OutputDataConfig    `json:"outputDataConfig"`
	Hyperparameters    HyperparametersMap  `json:"hyperparameters"`
	CustomHyperparameters map[string]interface{} `json:"customHyperparameters"`
	TargetClusters     []string            `json:"targetClusters"` // From frontend
	Namespace          string              `json:"namespace"`      // Optional override
	Entrypoint         string              `json:"entrypoint"`     // Optional override
	HeadImage          string              `json:"headImage"`      // Optional override
	WorkerImage        string              `json:"workerImage"`    // Optional override
	PVCName            string              `json:"pvcName"`        // Optional PVC name
}

type Algorithm struct {
	Source        string `json:"source"`        // "builtin" or "custom"
	AlgorithmName string `json:"algorithmName"` // "xgboost", "tensorflow", etc.
}

type Resources struct {
	InstanceResources InstanceResources `json:"instanceResources"`
	InstanceCount     int               `json:"instanceCount"`
	VolumeSizeGB      int               `json:"volumeSizeGB"`
}

type InstanceResources struct {
	CPUCores  int `json:"cpuCores"`
	MemoryGiB int `json:"memoryGiB"`
	GPUCount  int `json:"gpuCount"`
}

type StoppingCondition struct {
	MaxRuntimeSeconds int `json:"maxRuntimeSeconds"`
}

type InputDataConfig struct {
	ID              string `json:"id"`
	ChannelName     string `json:"channelName"`
	SourceType      string `json:"sourceType"`
	StorageProvider string `json:"storageProvider"`
	Endpoint        string `json:"endpoint"`
	Bucket          string `json:"bucket"`
	Prefix          string `json:"prefix"`
}

type OutputDataConfig struct {
	ArtifactURI string `json:"artifactUri"`
}

type HyperparametersMap struct {
	XGBoost *XGBoostHyperparameters `json:"xgboost,omitempty"`
	// Add other algorithm hyperparameters here as needed
}

type XGBoostHyperparameters struct {
	EarlyStoppingRounds  *int     `json:"early_stopping_rounds"`
	CSVWeights           int      `json:"csv_weights"`
	NumRound             int      `json:"num_round"`
	Booster              string   `json:"booster"`
	Verbosity            int      `json:"verbosity"`
	Nthread              string   `json:"nthread"`
	Eta                  float64  `json:"eta"`
	Gamma                float64  `json:"gamma"`
	MaxDepth             int      `json:"max_depth"`
	MinChildWeight       float64  `json:"min_child_weight"`
	MaxDeltaStep         float64  `json:"max_delta_step"`
	Subsample            float64  `json:"subsample"`
	SamplingMethod       string   `json:"sampling_method"`
	ColsampleBytree      float64  `json:"colsample_bytree"`
	ColsampleBylevel     float64  `json:"colsample_bylevel"`
	ColsampleBynode      float64  `json:"colsample_bynode"`
	Lambda               float64  `json:"lambda"`
	Alpha                float64  `json:"alpha"`
	TreeMethod           string   `json:"tree_method"`
	SketchEps            float64  `json:"sketch_eps"`
	ScalePosWeight       float64  `json:"scale_pos_weight"`
	Updater              string   `json:"updater"`
	Dsplit               string   `json:"dsplit"`
	RefreshLeaf          int      `json:"refresh_leaf"`
	ProcessType          string   `json:"process_type"`
	GrowPolicy           string   `json:"grow_policy"`
	MaxLeaves            int      `json:"max_leaves"`
	MaxBin               int      `json:"max_bin"`
	NumParallelTree      int      `json:"num_parallel_tree"`
	SampleType           string   `json:"sample_type"`
	NormalizeType        string   `json:"normalize_type"`
	RateDrop             float64  `json:"rate_drop"`
	OneDrop              int      `json:"one_drop"`
	SkipDrop             float64  `json:"skip_drop"`
	LambdaBias           float64  `json:"lambda_bias"`
	TweedieVariancePower float64  `json:"tweedie_variance_power"`
	Objective            string   `json:"objective"`
	BaseScore            float64  `json:"base_score"`
	EvalMetric           []string `json:"eval_metric"`
}

// TrainingJobResponse represents the response sent to frontend
type TrainingJobResponse struct {
	ID        string                 `json:"id"`
	JobName   string                 `json:"jobName"`
	Namespace string                 `json:"namespace"`
	Algorithm string                 `json:"algorithm"`
	Priority  int                    `json:"priority"`
	Request   *TrainingJobRequest    `json:"request,omitempty"` // Full original request
	Status    string                 `json:"status"`
	Message   string                 `json:"message"`
	CreatedAt time.Time              `json:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt"`
}

// JobStatus represents the status of a training job
type JobStatus struct {
	Phase              string    `json:"phase"`
	Reason             string    `json:"reason"`
	Message            string    `json:"message"`
	Active             int32     `json:"active"`
	Succeeded          int32     `json:"succeeded"`
	Failed             int32     `json:"failed"`
	StartTime          time.Time `json:"startTime,omitempty"`
	CompletionTime     time.Time `json:"completionTime,omitempty"`
	ClusterDistribution map[string]int32 `json:"clusterDistribution,omitempty"` // Pods per cluster
}

// ClusterInfo represents member cluster information
type ClusterInfo struct {
	Name   string `json:"name"`
	Ready  bool   `json:"ready"`
	Region string `json:"region,omitempty"`
	Zone   string `json:"zone,omitempty"`
}

// ClusterResourcesResponse represents resources in a member cluster
type ClusterResourcesResponse struct {
	Cluster   string                 `json:"cluster"`
	Namespace string                 `json:"namespace"`
	Resources []map[string]interface{} `json:"resources"`
}
