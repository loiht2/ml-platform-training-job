package converter

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/loiht2/ml-platform-training-job/backend/models"
)

func TestBuildRuntimeEnvYAML(t *testing.T) {
	converter := NewConverter()
	
	// Create a sample request
	earlyStop := 10
	req := &models.TrainingJobRequest{
		JobName: "test-job",
		Algorithm: models.Algorithm{
			Source:        "builtin",
			AlgorithmName: "xgboost",
		},
		Resources: models.Resources{
			InstanceCount: 2,
			InstanceResources: models.InstanceResources{
				CPUCores:  4,
				MemoryGiB: 16,
				GPUCount:  1,
			},
		},
		InputDataConfig: []models.InputDataConfig{
			{
				ChannelName: "train",
				Endpoint:    "http://minio.example.com",
				Bucket:      "training-data",
				Prefix:      "iris/train.csv",
			},
		},
		OutputDataConfig: models.OutputDataConfig{
			ArtifactURI: "file:///home/ray/results",
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
	}
	
	// Build the YAML
	yaml := converter.buildRuntimeEnvYAML(req)
	
	fmt.Println("Generated YAML:")
	fmt.Println("================")
	fmt.Println(yaml)
	fmt.Println("================")
	
	// Verify it contains TRAINING_CONFIG
	if !containsString(yaml, "TRAINING_CONFIG") {
		t.Error("YAML should contain TRAINING_CONFIG")
	}
	
	// Verify it contains JSON structure
	if !containsString(yaml, "{") || !containsString(yaml, "}") {
		t.Error("YAML should contain JSON structure")
	}
	
	// Test that we can extract and parse the JSON
	config := converter.buildTrainingConfig(req)
	configJSON, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}
	
	fmt.Println("\nExtracted JSON config:")
	fmt.Println("================")
	fmt.Println(string(configJSON))
	fmt.Println("================")
	
	// Verify key fields are present in config
	if config["num_worker"] != 2 {
		t.Errorf("Expected num_worker=2, got %v", config["num_worker"])
	}
	
	if config["use_gpu"] != true {
		t.Errorf("Expected use_gpu=true, got %v", config["use_gpu"])
	}
	
	if config["run_name"] != "test-job" {
		t.Errorf("Expected run_name=test-job, got %v", config["run_name"])
	}
	
	// Verify XGBoost config
	xgbConfig, ok := config["xgboost"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected xgboost config to be present")
	}
	
	if xgbConfig["num_boost_round"] != 100 {
		t.Errorf("Expected num_boost_round=100, got %v", xgbConfig["num_boost_round"])
	}
	
	if xgbConfig["eta"] != 0.3 {
		t.Errorf("Expected eta=0.3, got %v", xgbConfig["eta"])
	}
	
	// Verify S3 config
	s3Config, ok := config["s3"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected s3 config to be present")
	}
	
	if s3Config["bucket"] != "training-data" {
		t.Errorf("Expected bucket=training-data, got %v", s3Config["bucket"])
	}
}

func containsString(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && s != substr && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
