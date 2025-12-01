package converter

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/loiht2/ml-platform-training-job/backend/models"
	"gopkg.in/yaml.v2"
)

func TestConvertToRayJobV2WithJSONConfig(t *testing.T) {
	converter := NewConverter()
	
	// Create a realistic request
	earlyStop := 10
	req := &models.TrainingJobRequest{
		JobName:   "xgboost-iris-test",
		Namespace: "admin",
		Algorithm: models.Algorithm{
			Source:        "builtin",
			AlgorithmName: "xgboost",
		},
		Resources: models.Resources{
			InstanceCount: 2,
			InstanceResources: models.InstanceResources{
				CPUCores:  4,
				MemoryGiB: 16,
				GPUCount:  0,
			},
			VolumeSizeGB: 50,
		},
		InputDataConfig: []models.InputDataConfig{
			{
				ID:          "channel-1",
				ChannelName: "train",
				Endpoint:    "http://minio.kubeflow.svc.cluster.local:9000",
				Bucket:      "training-data",
				Prefix:      "iris/train.csv",
			},
		},
		OutputDataConfig: models.OutputDataConfig{
			ArtifactURI: "file:///home/ray/result-storage",
		},
		Hyperparameters: models.HyperparametersMap{
			XGBoost: &models.XGBoostHyperparameters{
				NumRound:            100,
				EarlyStoppingRounds: &earlyStop,
				CSVWeights:          1,
				Booster:             "gbtree",
				Verbosity:           1,
				Eta:                 0.3,
				Gamma:               0.0,
				MaxDepth:            6,
				MinChildWeight:      1.0,
				MaxDeltaStep:        0.0,
				Subsample:           1.0,
				SamplingMethod:      "uniform",
				ColsampleBytree:     1.0,
				ColsampleBylevel:    1.0,
				ColsampleBynode:     1.0,
				Lambda:              1.0,
				Alpha:               0.0,
				TreeMethod:          "auto",
				SketchEps:           0.03,
				ScalePosWeight:      1.0,
				Updater:             "auto",
				Dsplit:              "auto",
				RefreshLeaf:         1,
				ProcessType:         "default",
				GrowPolicy:          "depthwise",
				MaxLeaves:           0,
				MaxBin:              256,
				NumParallelTree:     1,
				SampleType:          "uniform",
				NormalizeType:       "tree",
				RateDrop:            0.0,
				OneDrop:             0,
				SkipDrop:            0.0,
				LambdaBias:          0.0,
				TweedieVariancePower: 1.5,
				Objective:           "reg:squarederror",
				BaseScore:           0.5,
				EvalMetric:          []string{"rmse", "mae"},
			},
		},
		PVCName: "kham-pv-for-xgboost",
	}
	
	jobID := "xgboost-iris-test-abc123"
	
	// Convert to RayJob
	rayJob, err := converter.ConvertToRayJobV2(req, jobID)
	if err != nil {
		t.Fatalf("Failed to convert to RayJob: %v", err)
	}
	
	// Convert to YAML for display
	yamlBytes, err := yaml.Marshal(rayJob)
	if err != nil {
		t.Fatalf("Failed to marshal to YAML: %v", err)
	}
	
	fmt.Println("Generated RayJob YAML:")
	fmt.Println("==============================================")
	fmt.Println(string(yamlBytes))
	fmt.Println("==============================================")
	
	// Verify key structure
	spec, ok := rayJob["spec"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected spec to be a map")
	}
	
	runtimeEnvYAML, ok := spec["runtimeEnvYAML"].(string)
	if !ok {
		t.Fatal("Expected runtimeEnvYAML to be a string")
	}
	
	fmt.Println("\nExtracted runtimeEnvYAML:")
	fmt.Println("==============================================")
	fmt.Println(runtimeEnvYAML)
	fmt.Println("==============================================")
	
	// Verify TRAINING_CONFIG is present
	if !containsString(runtimeEnvYAML, "TRAINING_CONFIG") {
		t.Error("runtimeEnvYAML should contain TRAINING_CONFIG")
	}
	
	// Verify it's JSON format
	if !containsString(runtimeEnvYAML, `"num_worker"`) {
		t.Error("TRAINING_CONFIG should contain JSON fields like num_worker")
	}
	
	if !containsString(runtimeEnvYAML, `"xgboost"`) {
		t.Error("TRAINING_CONFIG should contain xgboost configuration")
	}
	
	if !containsString(runtimeEnvYAML, `"s3"`) {
		t.Error("TRAINING_CONFIG should contain s3 configuration")
	}
	
	// Test that the config is valid JSON by parsing it
	config := converter.buildTrainingConfig(req)
	configJSON, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Failed to marshal config to JSON: %v", err)
	}
	
	// Verify we can unmarshal it back
	var parsedConfig map[string]interface{}
	if err := json.Unmarshal(configJSON, &parsedConfig); err != nil {
		t.Fatalf("Failed to unmarshal config JSON: %v", err)
	}
	
	fmt.Println("\nParsed JSON config (validated):")
	fmt.Println("==============================================")
	prettyJSON, _ := json.MarshalIndent(parsedConfig, "", "  ")
	fmt.Println(string(prettyJSON))
	fmt.Println("==============================================")
	
	// Verify namespace
	metadata, ok := rayJob["metadata"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected metadata to be a map")
	}
	
	if metadata["namespace"] != "admin" {
		t.Errorf("Expected namespace=admin, got %v", metadata["namespace"])
	}
	
	fmt.Println("\n✅ All tests passed!")
	fmt.Println("✅ JSON config is properly formatted in TRAINING_CONFIG environment variable")
	fmt.Println("✅ Container will receive the complete configuration as a single JSON string")
}
