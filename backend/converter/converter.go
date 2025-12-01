package converter

import (
	"encoding/json"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/loiht2/ml-platform-training-job/backend/models"
)

const (
	DefaultRayVersion      = "2.46.0"
	DefaultHeadImage       = "kiepdoden123/iris-training-ray:v1.2"
	DefaultWorkerImage     = "kiepdoden123/iris-training-ray:v1.2"
	DefaultEntrypoint      = "python /home/ray/xgboost_train.py"
	DefaultStoragePath     = "/home/ray/result-storage"
	DefaultLabelColumn     = "target"
	DefaultS3Region        = "us-east-1"
	DefaultS3AccessKey     = "loiht2"
	DefaultS3SecretKey     = "E4XWyvYtlS6E9Q92DPq7sJBoJhaa1j7pbLHhgfeZ"
	DefaultPVCName         = "kham-pv-for-xgboost"
	DefaultMountPath       = "/home/ray/result-storage"
)

// Converter handles conversion from frontend models to K8s resources
type Converter struct{}

// NewConverter creates a new converter instance
func NewConverter() *Converter {
	return &Converter{}
}

// ConvertToRayJobV2 converts the new TrainingJobRequest format to RayJob
func (c *Converter) ConvertToRayJobV2(req *models.TrainingJobRequest, jobID string) (map[string]interface{}, error) {
	namespace := req.Namespace
	if namespace == "" {
		namespace = "default"
	}

	// Determine entrypoint
	entrypoint := req.Entrypoint
	if entrypoint == "" {
		entrypoint = DefaultEntrypoint
	}

	// Determine images
	headImage := req.HeadImage
	if headImage == "" {
		headImage = DefaultHeadImage
	}
	workerImage := req.WorkerImage
	if workerImage == "" {
		workerImage = DefaultWorkerImage
	}

	// Determine PVC name
	pvcName := req.PVCName
	if pvcName == "" {
		pvcName = DefaultPVCName
	}

	// Build runtime environment YAML
	runtimeEnvYAML := c.buildRuntimeEnvYAML(req)

	// Build Ray cluster spec
	rayJob := map[string]interface{}{
		"apiVersion": "ray.io/v1",
		"kind":       "RayJob",
		"metadata": map[string]interface{}{
			"name":      req.JobName,
			"namespace": namespace,
			"labels": map[string]string{
				"app":             req.JobName,
				"training-job-id": jobID,
				"algorithm":       req.Algorithm.AlgorithmName,
			},
			"annotations": map[string]string{
				"training-job-id": jobID,
			},
		},
		"spec": map[string]interface{}{
			"entrypoint":       entrypoint,
			"runtimeEnvYAML":   runtimeEnvYAML,
			"rayClusterSpec": map[string]interface{}{
				"rayVersion":      DefaultRayVersion,
				"headGroupSpec":   c.buildRayHeadGroupSpecV2(req, headImage, pvcName),
				"workerGroupSpecs": []interface{}{
					c.buildRayWorkerGroupSpecV2(req, workerImage, pvcName),
				},
			},
		},
	}

	return rayJob, nil
}

// buildRuntimeEnvYAML creates the runtime environment YAML with TUNING_CONFIG as JSON
func (c *Converter) buildRuntimeEnvYAML(req *models.TrainingJobRequest) string {
	// Build the complete configuration as a map
	config := c.buildTrainingConfig(req)
	
	// Convert to JSON
	configJSON, err := json.Marshal(config)
	if err != nil {
		// Fallback to empty config if marshal fails
		configJSON = []byte("{}")
	}
	
	// Escape the JSON string for YAML (indent for readability)
	var jsonStr strings.Builder
	jsonStr.WriteString("|\n")
	
	// Pretty print the JSON with indentation
	var prettyJSON map[string]interface{}
	json.Unmarshal(configJSON, &prettyJSON)
	prettyBytes, _ := json.MarshalIndent(prettyJSON, "        ", "  ")
	
	// Add each line with proper indentation
	lines := strings.Split(string(prettyBytes), "\n")
	for _, line := range lines {
		jsonStr.WriteString("        ")
		jsonStr.WriteString(line)
		jsonStr.WriteString("\n")
	}
	
	// Build YAML with TUNING_CONFIG
	return fmt.Sprintf("env_vars:\n  TUNING_CONFIG: %s", jsonStr.String())
}

// buildTrainingConfig creates the complete training configuration map
func (c *Converter) buildTrainingConfig(req *models.TrainingJobRequest) map[string]interface{} {
	config := make(map[string]interface{})
	
	// Training control
	config["num_worker"] = req.Resources.InstanceCount
	config["use_gpu"] = req.Resources.InstanceResources.GPUCount > 0
	config["label_column"] = DefaultLabelColumn
	config["run_name"] = req.JobName
	config["storage_path"] = c.deriveStoragePath(req.OutputDataConfig.ArtifactURI)
	
	// S3/MinIO configuration
	if len(req.InputDataConfig) > 0 {
		inputConfig := req.InputDataConfig[0]
		s3Config := map[string]interface{}{
			"endpoint":   inputConfig.Endpoint,
			"access_key": DefaultS3AccessKey,
			"secret_key": DefaultS3SecretKey,
			"region":     DefaultS3Region,
			"bucket":     inputConfig.Bucket,
			"train_key":  inputConfig.Prefix,
		}
		
		// If there's a second channel for validation
		if len(req.InputDataConfig) > 1 {
			s3Config["val_key"] = req.InputDataConfig[1].Prefix
		}
		
		config["s3"] = s3Config
	}
	
	// Algorithm-specific hyperparameters
	if req.Hyperparameters.XGBoost != nil {
		config["xgboost"] = c.buildXGBoostConfig(req.Hyperparameters.XGBoost)
	}
	
	// Custom hyperparameters
	if len(req.CustomHyperparameters) > 0 {
		config["custom"] = req.CustomHyperparameters
	}
	
	return config
}

// buildXGBoostConfig creates the XGBoost configuration map
func (c *Converter) buildXGBoostConfig(xgb *models.XGBoostHyperparameters) map[string]interface{} {
	config := make(map[string]interface{})
	
	// Training parameters
	config["num_boost_round"] = xgb.NumRound
	if xgb.EarlyStoppingRounds != nil {
		config["early_stopping_rounds"] = *xgb.EarlyStoppingRounds
	}
	config["csv_weight"] = xgb.CSVWeights
	
	// Basic parameters
	config["booster"] = xgb.Booster
	config["verbosity"] = xgb.Verbosity
	
	// Learning parameters
	config["eta"] = xgb.Eta
	config["gamma"] = xgb.Gamma
	config["max_depth"] = xgb.MaxDepth
	config["min_child_weight"] = xgb.MinChildWeight
	config["max_delta_step"] = xgb.MaxDeltaStep
	config["subsample"] = xgb.Subsample
	config["sampling_method"] = xgb.SamplingMethod
	config["colsample_bytree"] = xgb.ColsampleBytree
	config["colsample_bylevel"] = xgb.ColsampleBylevel
	config["colsample_bynode"] = xgb.ColsampleBynode
	config["lambda"] = xgb.Lambda
	config["alpha"] = xgb.Alpha
	config["tree_method"] = xgb.TreeMethod
	config["sketch_eps"] = xgb.SketchEps
	config["scale_pos_weight"] = xgb.ScalePosWeight
	
	// Updater (only if not "auto")
	if xgb.Updater != "" && xgb.Updater != "auto" {
		config["updater"] = xgb.Updater
	}
	
	// Advanced parameters
	config["dsplit"] = xgb.Dsplit
	config["refresh_leaf"] = xgb.RefreshLeaf
	config["process_type"] = xgb.ProcessType
	config["grow_policy"] = xgb.GrowPolicy
	config["max_leaves"] = xgb.MaxLeaves
	config["max_bin"] = xgb.MaxBin
	config["num_parallel_tree"] = xgb.NumParallelTree
	config["sample_type"] = xgb.SampleType
	config["normalize_type"] = xgb.NormalizeType
	config["rate_drop"] = xgb.RateDrop
	config["one_drop"] = xgb.OneDrop
	config["skip_drop"] = xgb.SkipDrop
	config["lambda_bias"] = xgb.LambdaBias
	config["tweedie_variance_power"] = xgb.TweedieVariancePower
	
	// Objective and metrics
	config["objective"] = xgb.Objective
	config["base_score"] = xgb.BaseScore
	
	// Eval metric
	if len(xgb.EvalMetric) > 0 {
		config["eval_metric"] = xgb.EvalMetric
	}
	
	return config
}

// deriveStoragePath determines the storage path from output config
func (c *Converter) deriveStoragePath(artifactURI string) string {
	// If starts with file://, extract the path
	if strings.HasPrefix(artifactURI, "file://") {
		return strings.TrimPrefix(artifactURI, "file://")
	}
	// Otherwise use default
	return DefaultStoragePath
}

// buildRayHeadGroupSpecV2 creates the Ray head group spec
func (c *Converter) buildRayHeadGroupSpecV2(req *models.TrainingJobRequest, image, pvcName string) map[string]interface{} {
	// Build resource requirements
	cpuStr := fmt.Sprintf("%d", req.Resources.InstanceResources.CPUCores)
	memoryStr := fmt.Sprintf("%dGi", req.Resources.InstanceResources.MemoryGiB)
	
	resources := map[string]interface{}{
		"limits": map[string]string{
			"cpu": cpuStr,
		},
		"requests": map[string]string{
			"cpu": cpuStr,
		},
	}
	
	// Add memory if specified
	if req.Resources.InstanceResources.MemoryGiB > 0 {
		resources["limits"].(map[string]string)["memory"] = memoryStr
		resources["requests"].(map[string]string)["memory"] = memoryStr
	}
	
	// Build container
	container := map[string]interface{}{
		"name":  "ray-head",
		"image": image,
		"ports": []interface{}{
			map[string]interface{}{
				"containerPort": 6379,
				"name":          "gcs-server",
			},
			map[string]interface{}{
				"containerPort": 8265,
				"name":          "dashboard",
			},
			map[string]interface{}{
				"containerPort": 10001,
				"name":          "client",
			},
		},
		"resources": resources,
		"volumeMounts": []interface{}{
			map[string]interface{}{
				"mountPath": DefaultMountPath,
				"name":      "result-storage",
			},
		},
	}
	
	return map[string]interface{}{
		"rayStartParams": map[string]string{},
		"template": map[string]interface{}{
			"metadata": map[string]interface{}{
				"annotations": map[string]string{
					"sidecar.istio.io/inject": "false",
				},
			},
			"spec": map[string]interface{}{
				"containers": []interface{}{container},
				"volumes": []interface{}{
					map[string]interface{}{
						"name": "result-storage",
						"persistentVolumeClaim": map[string]interface{}{
							"claimName": pvcName,
						},
					},
				},
			},
		},
	}
}

// buildRayWorkerGroupSpecV2 creates the Ray worker group spec
func (c *Converter) buildRayWorkerGroupSpecV2(req *models.TrainingJobRequest, image, pvcName string) map[string]interface{} {
	replicas := req.Resources.InstanceCount
	if replicas == 0 {
		replicas = 1
	}
	
	maxReplicas := replicas * 5
	if maxReplicas < 5 {
		maxReplicas = 5
	}
	
	// Build resource requirements
	cpuStr := fmt.Sprintf("%d", req.Resources.InstanceResources.CPUCores)
	memoryStr := fmt.Sprintf("%dGi", req.Resources.InstanceResources.MemoryGiB)
	
	resources := map[string]interface{}{
		"limits": map[string]string{
			"cpu": cpuStr,
		},
		"requests": map[string]string{
			"cpu": cpuStr,
		},
	}
	
	// Add memory
	if req.Resources.InstanceResources.MemoryGiB > 0 {
		resources["limits"].(map[string]string)["memory"] = memoryStr
		resources["requests"].(map[string]string)["memory"] = memoryStr
	}
	
	// Add GPU if specified
	if req.Resources.InstanceResources.GPUCount > 0 {
		gpuStr := fmt.Sprintf("%d", req.Resources.InstanceResources.GPUCount)
		resources["limits"].(map[string]string)["nvidia.com/gpu"] = gpuStr
		resources["requests"].(map[string]string)["nvidia.com/gpu"] = gpuStr
	}
	
	// Build container
	container := map[string]interface{}{
		"name":      "ray-worker",
		"image":     image,
		"resources": resources,
		"volumeMounts": []interface{}{
			map[string]interface{}{
				"mountPath": DefaultMountPath,
				"name":      "result-storage",
			},
		},
	}
	
	return map[string]interface{}{
		"replicas":       replicas,
		"minReplicas":    1,
		"maxReplicas":    maxReplicas,
		"groupName":      "small-group",
		"rayStartParams": map[string]string{},
		"template": map[string]interface{}{
			"metadata": map[string]interface{}{
				"annotations": map[string]string{
					"sidecar.istio.io/inject": "false",
				},
			},
			"spec": map[string]interface{}{
				"containers": []interface{}{container},
				"volumes": []interface{}{
					map[string]interface{}{
						"name": "result-storage",
						"persistentVolumeClaim": map[string]interface{}{
							"claimName": pvcName,
						},
					},
				},
			},
		},
	}
}

// CreatePVC creates a PersistentVolumeClaim for the training job
func (c *Converter) CreatePVC(req *models.TrainingJobRequest, jobID string) *corev1.PersistentVolumeClaim {
	namespace := req.Namespace
	if namespace == "" {
		namespace = "default"
	}
	
	pvcName := req.PVCName
	if pvcName == "" {
		pvcName = fmt.Sprintf("%s-pvc", req.JobName)
	}
	
	storageSize := fmt.Sprintf("%dGi", req.Resources.VolumeSizeGB)
	
	pvc := &corev1.PersistentVolumeClaim{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "PersistentVolumeClaim",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":             req.JobName,
				"training-job-id": jobID,
			},
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{
				corev1.ReadWriteMany,
			},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse(storageSize),
				},
			},
		},
	}
	
	return pvc
}
