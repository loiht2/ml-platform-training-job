import type { HyperparameterValues } from "@/app/create/hyperparameters";

export type AlgorithmSource = "builtin" | "container";

export type StorageProvider = "aws" | "minio" | "gcs" | "azure" | "custom";

export type CustomHyperparameters = Record<string, string | number | boolean>;

export type Channel = {
  id: string;
  channelName: string;
  sourceType: "object-storage" | "upload";
  storageProvider?: StorageProvider;
  endpoint?: string;
  bucket?: string;
  prefix?: string;
  uploadFileName?: string;
  uploadedFile?: File; // Store the actual File object for upload
  channelType?: "train" | "validation" | "test";
  contentType?: "csv";
  csvColumns?: string[];
  featureNames?: string[];
  labelName?: string;
};

export type InstanceResources = {
  cpuCores: number;
  memoryGiB: number;
  gpuCount: number;
};

export type TrainingResources = {
  instanceResources: InstanceResources;
  instanceCount: number;
  volumeSizeGB: number;
  distributedTraining?: boolean;
};

export type OutputDataConfig = {
  artifactUri: string;
  configMode?: "default" | "custom";
  storageProvider?: StorageProvider;
  bucket?: string;
  prefix?: string;
  endpoint?: string;
};

export type TrainingJobForm = {
  jobName: string;
  priority: number;
  algorithm: {
    source: AlgorithmSource;
    algorithmName?: string;
    imageUri?: string;
  };
  resources: TrainingResources;
  stoppingCondition: { maxRuntimeSeconds: number };
  inputDataConfig: Channel[];
  outputDataConfig: OutputDataConfig;
  hyperparameters: Record<string, HyperparameterValues>;
  customHyperparameters?: CustomHyperparameters;
};

export type JobPayload = {
  jobName: string;
  priority: number;
  algorithm: {
    source: AlgorithmSource;
    algorithmName?: string;
    imageUri?: string;
  };
  resources: TrainingResources;
  stoppingCondition: { maxRuntimeSeconds: number };
  inputDataConfig: Channel[];
  outputDataConfig: OutputDataConfig;
  hyperparameters: Record<string, HyperparameterValues>;
  customHyperparameters?: CustomHyperparameters;
};

export type JobStatus = "Pending" | "Running" | "Succeeded" | "Failed" | "Stopped";

export type StoredJob = {
  id: string;
  algorithm: string;
  createdAt: number;
  priority: number;
  status: JobStatus;
  pendingUntil?: number;
  jobStatus?: string; // RayJob status: RUNNING, SUCCEEDED, FAILED, etc.
  deploymentStatus?: string; // Deployment status: Initializing, Running, Complete, Failed
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
};
