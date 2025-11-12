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
  outputDataConfig: { artifactUri: string };
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
  outputDataConfig: { artifactUri: string };
  hyperparameters: Record<string, HyperparameterValues>;
  customHyperparameters?: CustomHyperparameters;
};

export type JobStatus = "Pending" | "Running" | "Succeeded" | "Failed";

export type StoredJob = {
  id: string;
  algorithm: string;
  createdAt: number;
  priority: number;
  status: JobStatus;
  pendingUntil?: number;
};
