package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/loiht2/ml-platform-training-job/backend/converter"
	"github.com/loiht2/ml-platform-training-job/backend/models"
	"gopkg.in/yaml.v2"
)

func main() {
	// Create a sample training job request
	req := &models.TrainingJobRequest{
		Name:      "test-json-config",
		Namespace: "admin",
		Algorithm: "xgboost",
		Image:     "loihoangthanh1411/ml-platform-xgboost-ray:v1.0",
		DataSource: &models.DataSource{
			Type: "s3",
			S3: &models.S3Config{
				Endpoint:    "http://minio.kubeflow.svc.cluster.local:9000",
				AccessKey:   "loiht2",
				SecretKey:   "E4XWyvYtlS6E9Q92DPq7sJBoJhaa1j7pbLHhgfeZ",
				Region:      "us-east-1",
				Bucket:      "datasets",
				TrainDataKey: "iris/train.csv",
			},
		},
		NumWorkers:      1,
		CPUPerWorker:    "1",
		MemoryPerWorker: "2Gi",
		GPUPerWorker:    "0",
		LabelColumn:     "target",
		Hyperparameters: map[string]interface{}{
			"num_boost_round":        50,
			"early_stopping_rounds":  10,
		},
		XGBoostHyperparameters: &models.XGBoostHyperparameters{
			NumBoostRound:        50,
			EarlyStoppingRounds:  10,
			Booster:              "gbtree",
			Eta:                  0.3,
			Gamma:                0.0,
			MaxDepth:             6,
			MinChildWeight:       1.0,
			Subsample:            1.0,
			ColsampleBytree:      1.0,
			Lambda:               1.0,
			Alpha:                0.0,
			TreeMethod:           "auto",
			Objective:            "reg:squarederror",
			EvalMetric:           []string{"rmse", "mae"},
			NumParallelTree:      1,
			MaxLeaves:            0,
			MaxBin:               256,
		},
	}

	fmt.Println("========================================")
	fmt.Println("Testing JSON Config Converter")
	fmt.Println("========================================")
	fmt.Println()

	// Convert to RayJob
	rayJob, err := converter.ConvertToRayJobV2(req)
	if err != nil {
		fmt.Printf("❌ Error converting to RayJob: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ RayJob created successfully!")
	fmt.Println()

	// Marshal to YAML
	yamlBytes, err := yaml.Marshal(rayJob)
	if err != nil {
		fmt.Printf("❌ Error marshaling to YAML: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Complete RayJob YAML:")
	fmt.Println("========================================")
	fmt.Println(string(yamlBytes))
	fmt.Println("========================================")
	fmt.Println()

	// Extract and validate JSON config
	fmt.Println("Extracted runtimeEnvYAML:")
	fmt.Println("----------------------------------------")
	fmt.Println(rayJob.Spec.RuntimeEnvYAML)
	fmt.Println("----------------------------------------")
	fmt.Println()

	// Try to extract JSON from runtimeEnvYAML
	runtimeEnv := make(map[string]interface{})
	if err := yaml.Unmarshal([]byte(rayJob.Spec.RuntimeEnvYAML), &runtimeEnv); err != nil {
		fmt.Printf("⚠️  Could not parse runtimeEnvYAML: %v\n", err)
	} else {
		if envVars, ok := runtimeEnv["env_vars"].(map[interface{}]interface{}); ok {
			if tuningConfig, ok := envVars["TRAINING_CONFIG"].(string); ok {
				fmt.Println("✅ TRAINING_CONFIG found!")
				fmt.Println()
				fmt.Println("JSON Configuration:")
				fmt.Println("----------------------------------------")
				
				// Pretty print JSON
				var jsonConfig map[string]interface{}
				if err := json.Unmarshal([]byte(tuningConfig), &jsonConfig); err != nil {
					fmt.Printf("⚠️  Could not parse JSON: %v\n", err)
					fmt.Println(tuningConfig)
				} else {
					prettyJSON, _ := json.MarshalIndent(jsonConfig, "", "  ")
					fmt.Println(string(prettyJSON))
					
					fmt.Println("----------------------------------------")
					fmt.Println()
					fmt.Println("Verification:")
					fmt.Printf("  - num_worker: %v\n", jsonConfig["num_worker"])
					fmt.Printf("  - use_gpu: %v\n", jsonConfig["use_gpu"])
					fmt.Printf("  - run_name: %v\n", jsonConfig["run_name"])
					
					if s3, ok := jsonConfig["s3"].(map[string]interface{}); ok {
						fmt.Printf("  - s3.endpoint: %v\n", s3["endpoint"])
						fmt.Printf("  - s3.bucket: %v\n", s3["bucket"])
					}
					
					if xgb, ok := jsonConfig["xgboost"].(map[string]interface{}); ok {
						fmt.Printf("  - xgboost.eta: %v\n", xgb["eta"])
						fmt.Printf("  - xgboost.max_depth: %v\n", xgb["max_depth"])
						fmt.Printf("  - xgboost.num_boost_round: %v\n", xgb["num_boost_round"])
					}
					
					fmt.Println()
					fmt.Println("========================================")
					fmt.Println("✅ JSON Config Format Test PASSED!")
					fmt.Println("========================================")
				}
			} else {
				fmt.Println("❌ TRAINING_CONFIG not found in env_vars")
			}
		} else {
			fmt.Println("❌ env_vars not found in runtimeEnvYAML")
		}
	}
}
