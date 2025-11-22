package converter

import (
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

// buildRuntimeEnvYAML creates the runtime environment YAML with all environment variables
func (c *Converter) buildRuntimeEnvYAML(req *models.TrainingJobRequest) string {
	var sb strings.Builder
	
	sb.WriteString("env_vars:\n")
	sb.WriteString("  # ==== TRAINING CONTROL ====\n")
	
	// NUM_WORKER
	sb.WriteString(fmt.Sprintf("  NUM_WORKER: \"%d\"\n", req.Resources.InstanceCount))
	
	// USE_GPU
	useGPU := "false"
	if req.Resources.InstanceResources.GPUCount > 0 {
		useGPU = "true"
	}
	sb.WriteString(fmt.Sprintf("  USE_GPU: \"%s\"\n", useGPU))
	
	// LABEL_COLUMN
	sb.WriteString(fmt.Sprintf("  LABEL_COLUMN: \"%s\"\n", DefaultLabelColumn))
	
	// RUN_NAME
	sb.WriteString(fmt.Sprintf("  RUN_NAME: \"%s\"\n", req.JobName))
	
	// STORAGE_PATH
	storagePath := c.deriveStoragePath(req.OutputDataConfig.ArtifactURI)
	sb.WriteString(fmt.Sprintf("  STORAGE_PATH: \"%s\"\n", storagePath))
	
	// S3/MinIO configuration
	if len(req.InputDataConfig) > 0 {
		inputConfig := req.InputDataConfig[0]
		sb.WriteString("\n  # ==== S3/MinIO Configuration ====\n")
		sb.WriteString(fmt.Sprintf("  S3_ENDPOINT: \"%s\"\n", inputConfig.Endpoint))
		sb.WriteString(fmt.Sprintf("  S3_ACCESS_KEY: \"%s\"\n", DefaultS3AccessKey))
		sb.WriteString(fmt.Sprintf("  S3_SECRET_KEY: \"%s\"\n", DefaultS3SecretKey))
		sb.WriteString(fmt.Sprintf("  S3_REGION: \"%s\"\n", DefaultS3Region))
		sb.WriteString(fmt.Sprintf("  S3_BUCKET: \"%s\"\n", inputConfig.Bucket))
		sb.WriteString(fmt.Sprintf("  S3_TRAIN_KEY: \"%s\"\n", inputConfig.Prefix))
		
		// If there's a second channel for validation
		if len(req.InputDataConfig) > 1 {
			sb.WriteString(fmt.Sprintf("  S3_VAL_KEY: \"%s\"\n", req.InputDataConfig[1].Prefix))
		}
	}
	
	// XGBoost hyperparameters
	if req.Hyperparameters.XGBoost != nil {
		sb.WriteString("\n  # ==== XGBoost Hyperparameters ====\n")
		c.appendXGBoostHyperparameters(&sb, req.Hyperparameters.XGBoost)
	}
	
	// Custom hyperparameters
	if len(req.CustomHyperparameters) > 0 {
		sb.WriteString("\n  # ==== Custom Hyperparameters ====\n")
		for key, value := range req.CustomHyperparameters {
			sb.WriteString(fmt.Sprintf("  %s: \"%v\"\n", strings.ToUpper(key), value))
		}
	}
	
	return sb.String()
}

// appendXGBoostHyperparameters adds all XGBoost parameters to the string builder
func (c *Converter) appendXGBoostHyperparameters(sb *strings.Builder, xgb *models.XGBoostHyperparameters) {
	// NUM_BOOST_ROUND
	sb.WriteString(fmt.Sprintf("  NUM_BOOST_ROUND: \"%d\"\n", xgb.NumRound))
	
	// EARLY_STOPPING_ROUNDS
	if xgb.EarlyStoppingRounds != nil {
		sb.WriteString(fmt.Sprintf("  EARLY_STOPPING_ROUNDS: \"%d\"\n", *xgb.EarlyStoppingRounds))
	} else {
		sb.WriteString("  EARLY_STOPPING_ROUNDS: \"\"\n")
	}
	
	// CSV_WEIGHT
	sb.WriteString(fmt.Sprintf("  CSV_WEIGHT: \"%d\"\n", xgb.CSVWeights))
	
	// Basic parameters
	sb.WriteString(fmt.Sprintf("  BOOSTER: \"%s\"\n", xgb.Booster))
	sb.WriteString(fmt.Sprintf("  VERBOSITY: \"%d\"\n", xgb.Verbosity))
	
	// Learning parameters
	sb.WriteString(fmt.Sprintf("  ETA: \"%.10g\"\n", xgb.Eta))
	sb.WriteString(fmt.Sprintf("  GAMMA: \"%.10g\"\n", xgb.Gamma))
	sb.WriteString(fmt.Sprintf("  MAX_DEPTH: \"%d\"\n", xgb.MaxDepth))
	sb.WriteString(fmt.Sprintf("  MIN_CHILD_WEIGHT: \"%.10g\"\n", xgb.MinChildWeight))
	sb.WriteString(fmt.Sprintf("  MAX_DELTA_STEP: \"%.10g\"\n", xgb.MaxDeltaStep))
	sb.WriteString(fmt.Sprintf("  SUBSAMPLE: \"%.10g\"\n", xgb.Subsample))
	sb.WriteString(fmt.Sprintf("  SAMPLING_METHOD: \"%s\"\n", xgb.SamplingMethod))
	sb.WriteString(fmt.Sprintf("  COLSAMPLE_BYTREE: \"%.10g\"\n", xgb.ColsampleBytree))
	sb.WriteString(fmt.Sprintf("  COLSAMPLE_BYLEVEL: \"%.10g\"\n", xgb.ColsampleBylevel))
	sb.WriteString(fmt.Sprintf("  COLSAMPLE_BYNODE: \"%.10g\"\n", xgb.ColsampleBynode))
	sb.WriteString(fmt.Sprintf("  LAMBDA: \"%.10g\"\n", xgb.Lambda))
	sb.WriteString(fmt.Sprintf("  ALPHA: \"%.10g\"\n", xgb.Alpha))
	sb.WriteString(fmt.Sprintf("  TREE_METHOD: \"%s\"\n", xgb.TreeMethod))
	sb.WriteString(fmt.Sprintf("  SKETCH_EPS: \"%.10g\"\n", xgb.SketchEps))
	sb.WriteString(fmt.Sprintf("  SCALE_POS_WEIGHT: \"%.10g\"\n", xgb.ScalePosWeight))
	
	// Updater (only if not "auto" to keep it clean)
	if xgb.Updater != "" && xgb.Updater != "auto" {
		sb.WriteString(fmt.Sprintf("  UPDATER: \"%s\"\n", xgb.Updater))
	}
	
	// Advanced parameters
	sb.WriteString(fmt.Sprintf("  DSPLIT: \"%s\"\n", xgb.Dsplit))
	sb.WriteString(fmt.Sprintf("  REFRESH_LEAF: \"%d\"\n", xgb.RefreshLeaf))
	sb.WriteString(fmt.Sprintf("  PROCESS_TYPE: \"%s\"\n", xgb.ProcessType))
	sb.WriteString(fmt.Sprintf("  GROW_POLICY: \"%s\"\n", xgb.GrowPolicy))
	sb.WriteString(fmt.Sprintf("  MAX_LEAVES: \"%d\"\n", xgb.MaxLeaves))
	sb.WriteString(fmt.Sprintf("  MAX_BIN: \"%d\"\n", xgb.MaxBin))
	sb.WriteString(fmt.Sprintf("  NUM_PARALLEL_TREE: \"%d\"\n", xgb.NumParallelTree))
	sb.WriteString(fmt.Sprintf("  SAMPLE_TYPE: \"%s\"\n", xgb.SampleType))
	sb.WriteString(fmt.Sprintf("  NORMALIZE_TYPE: \"%s\"\n", xgb.NormalizeType))
	sb.WriteString(fmt.Sprintf("  RATE_DROP: \"%.10g\"\n", xgb.RateDrop))
	sb.WriteString(fmt.Sprintf("  ONE_DROP: \"%d\"\n", xgb.OneDrop))
	sb.WriteString(fmt.Sprintf("  SKIP_DROP: \"%.10g\"\n", xgb.SkipDrop))
	sb.WriteString(fmt.Sprintf("  LAMBDA_BIAS: \"%.10g\"\n", xgb.LambdaBias))
	sb.WriteString(fmt.Sprintf("  TWEEDIE_VARIANCE_POWER: \"%.10g\"\n", xgb.TweedieVariancePower))
	
	// Objective and metrics
	sb.WriteString(fmt.Sprintf("  OBJECTIVE: \"%s\"\n", xgb.Objective))
	sb.WriteString(fmt.Sprintf("  BASE_SCORE: \"%.10g\"\n", xgb.BaseScore))
	
	// EVAL_METRIC - join array with commas
	if len(xgb.EvalMetric) > 0 {
		sb.WriteString(fmt.Sprintf("  EVAL_METRIC: \"%s\"\n", strings.Join(xgb.EvalMetric, ",")))
	}
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
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: resource.MustParse(storageSize),
				},
			},
		},
	}
	
	return pvc
}
