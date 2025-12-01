import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getDefaultHyperparameters, getHyperparameterConfig, type HyperparameterValues } from "@/app/create/hyperparameters";
import { persistJob } from "@/lib/jobs-storage";
import type { AlgorithmSource, Channel, JobPayload, StorageProvider, StoredJob, TrainingJobForm } from "@/types/training-job";
import { CustomHyperparametersEditor } from "@/components/CustomHyperparametersEditor";
import { jobsApi, uploadApi, APIError } from "@/lib/api-service";
import { convertToBackendRequest, convertFromBackendResponse } from "@/lib/backend-converter";
import { getCurrentNamespace } from "@/lib/kubeflow-api";

const builtinAlgorithms = [
  { id: "xgboost", name: "XGBoost" },
  { id: "lightgbm", name: "LightGBM" },
  { id: "tensorflow-cnn", name: "TensorFlow CNN" },
  { id: "tensorflow-transformer", name: "TensorFlow Transformer" },
  { id: "tf-distributed", name: "TensorFlow Distributed" },
  { id: "horovod-mpi", name: "Horovod (MPI)" },
  { id: "deepspeed-zero3", name: "DeepSpeed" },
  { id: "jax-pjit", name: "JAX PJIT" },
  { id: "torch-mpi", name: "PyTorch MPI" },
] as const;

const DEFAULT_STORAGE_PROVIDER: StorageProvider = "minio";

const storageProviders = [
  { id: "aws", label: "AWS Object Store" },
  { id: "minio", label: "MinIO" },
  { id: "gcs", label: "Google Cloud Storage" },
  { id: "azure", label: "Azure Blob Storage" },
  { id: "custom", label: "Custom Object Store" },
] as const;

const storageProviderLabels: Record<StorageProvider, string> = {
  aws: "AWS Object Store",
  minio: "MinIO",
  gcs: "Google Cloud Storage",
  azure: "Azure Blob Storage",
  custom: "Custom Object Store",
};

const LIST_ROUTE = "/";

function generateJobName(prefix = "train") {
  const dt = new Date();
  const stamp = dt.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp.toLowerCase()}-${random}`;
}

const JOB_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function secondsFromHM(h: number, m: number) {
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return Math.max(0, Math.floor(hh) * 3600 + Math.floor(mm) * 60);
}

function randomId(prefix = "id") {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function formToPayload(form: TrainingJobForm): JobPayload {
  const payload: JobPayload = {
    jobName: form.jobName,
    priority: form.priority,
    algorithm: {
      source: form.algorithm.source,
      ...(form.algorithm.algorithmName && { algorithmName: form.algorithm.algorithmName }),
      ...(form.algorithm.imageUri && { imageUri: form.algorithm.imageUri }),
    },
    resources: deepClone(form.resources),
    stoppingCondition: deepClone(form.stoppingCondition),
    inputDataConfig: deepClone(form.inputDataConfig),
    outputDataConfig: deepClone(form.outputDataConfig),
    hyperparameters: deepClone(form.hyperparameters),
  };

  // Only include customHyperparameters if it exists and has values
  if (form.customHyperparameters && Object.keys(form.customHyperparameters).length > 0) {
    payload.customHyperparameters = deepClone(form.customHyperparameters);
  }

  return payload;
}

function validateForm(form: TrainingJobForm) {
  const errors: string[] = [];
  if (!form.jobName || !JOB_NAME_REGEX.test(form.jobName)) {
    errors.push("[Job Configuration] Job name is required and must match ^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$");
  }
  if (!Number.isFinite(form.priority) || form.priority <= 0 || form.priority > 1000) {
    errors.push("[Job Configuration] Priority must be greater than 0 and at most 1000.");
  }
  const alg = form.algorithm;
  if (alg.source === "builtin" && !alg.algorithmName) errors.push("[Algorithm] Select a built-in algorithm.");
  if (alg.source === "container" && !alg.imageUri) errors.push("[Algorithm] Container image URI is required.");
  if (!form.inputDataConfig?.length) errors.push("[Input Data] At least one input channel is required.");
  const hasTrain = form.inputDataConfig.some((c) => c.channelName === "train");
  if (!hasTrain) errors.push("[Input Data] A 'train' channel is required.");
  form.inputDataConfig.forEach((c, idx) => {
    const sourceType = c.sourceType || "object-storage";
    if (!c.channelName) errors.push(`[Input Data - Channel #${idx + 1}] Channel name is required.`);
    if (sourceType === "object-storage") {
      if (!c.storageProvider) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Storage provider is required.`);
      if (!c.bucket) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Bucket is required.`);
      if (!c.prefix) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Prefix / Path is required.`);
    } else if (sourceType === "upload") {
      if (!c.uploadFileName) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Upload file is required. Please click 'Upload CSV File' button to select a file.`);
      if (c.uploadFileName) {
        if (!c.featureNames || c.featureNames.length === 0) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Feature name(s) is required when uploading a file.`);
        if (!c.labelName) errors.push(`[Input Data - Channel '${c.channelName || idx + 1}'] Label name is required when uploading a file.`);
      }
    }
  });
  
  // Validate output data configuration
  const outputMode = form.outputDataConfig.configMode || "default";
  if (outputMode === "custom") {
    if (!form.outputDataConfig.storageProvider) errors.push("[Output Data Configuration] Storage provider is required.");
    if (!form.outputDataConfig.bucket) errors.push("[Output Data Configuration] Bucket is required.");
    if (!form.outputDataConfig.prefix) errors.push("[Output Data Configuration] Prefix/path is required.");
  }
  
  // Validate checkpoint configuration
  if (form.checkpointConfig?.enabled) {
    const checkpointMode = form.checkpointConfig.configMode || "default";
    if (checkpointMode === "custom") {
      if (!form.checkpointConfig.storageProvider) errors.push("[Checkpoint Configuration] Storage provider is required.");
      if (!form.checkpointConfig.bucket) errors.push("[Checkpoint Configuration] Bucket is required.");
      if (!form.checkpointConfig.prefix) errors.push("[Checkpoint Configuration] Prefix/path is required.");
    }
  }
  
  // Validate channel name + type uniqueness
  const channelKeys = new Map<string, number>();
  form.inputDataConfig.forEach((channel, idx) => {
    const key = `${channel.channelName}:${channel.channelType || 'train'}`;
    if (channelKeys.has(key)) {
      errors.push(`[Input Data - Channel #${idx + 1}] Channel name '${channel.channelName}' with type '${channel.channelType || 'train'}' already exists at channel #${channelKeys.get(key)! + 1}.`);
    } else {
      channelKeys.set(key, idx);
    }
  });
  
  return errors;
}

// Helper to check if a field has errors
function hasFieldError(errors: string[], fieldKey: string): boolean {
  return errors.some(err => err.toLowerCase().includes(fieldKey.toLowerCase()));
}

// Helper to get error message for a specific field
function getFieldError(errors: string[], fieldKey: string): string | null {
  const error = errors.find(err => err.toLowerCase().includes(fieldKey.toLowerCase()));
  if (!error) return null;
  // Extract message after the section prefix
  const match = error.match(/\[.*?\]\s*(.+)/);
  return match ? match[1] : error;
}

type PersistResponse = { ok: true; filename: string } | { ok: false };

async function persistPayload(payload: JobPayload, job: StoredJob): Promise<PersistResponse> {
  const result = await persistJob(payload, job);
  if (result.ok) {
    return { ok: true, filename: result.filename };
  }
  return { ok: false };
}

function ChannelEditor({ value, onChange, hasError, bucketError, prefixError, featureError, labelError }: { value: Channel; onChange: (c: Channel) => void; hasError?: boolean; bucketError?: string; prefixError?: string; featureError?: string; labelError?: string }) {
  const sourceType = value.sourceType || "upload";
  const provider = value.storageProvider || DEFAULT_STORAGE_PROVIDER;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureDropdownOpen, setFeatureDropdownOpen] = useState(false);
  const featureDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (featureDropdownRef.current && !featureDropdownRef.current.contains(event.target as Node)) {
        setFeatureDropdownOpen(false);
      }
    }
    if (featureDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [featureDropdownOpen]);

  function updateChannel(partial: Partial<Channel>) {
    onChange({ ...value, ...partial });
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) {
      updateChannel({ 
        uploadFileName: "", 
        uploadedFile: undefined,
        csvColumns: [], 
        featureNames: [], 
        labelName: undefined 
      });
      setUploadError(null);
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File size exceeds 50 MB limit");
      return;
    }

    setUploadError(null);
    updateChannel({ uploadFileName: file.name, uploadedFile: file });

    if (value.contentType === "csv") {
      try {
        const text = await file.text();
        const lines = text.split("\n");
        if (lines.length > 0) {
          const headerLine = lines[0].trim();
          const columns = headerLine.split(",").map(col => col.trim()).filter(col => col.length > 0);
          updateChannel({ 
            uploadFileName: file.name,
            uploadedFile: file,
            csvColumns: columns,
            featureNames: [],
            labelName: undefined
          });
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        setUploadError("Failed to parse CSV file");
      }
    }
  }

  const availableColumns = value.csvColumns || [];
  const selectedFeatures = value.featureNames || [];
  const selectedLabel = value.labelName;

  const availableForFeatures = availableColumns.filter(col => col !== selectedLabel);
  const availableForLabel = availableColumns.filter(col => !selectedFeatures.includes(col));

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-y-3 gap-x-30 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <Label className="w-32 flex-shrink-0">Channel name</Label>
          <Input value={value.channelName} onChange={(e) => updateChannel({ channelName: e.target.value })} placeholder="train" className="flex-1" />
        </div>
        <div className="flex items-center gap-0">
          <Label className="w-25 flex-shrink-0">Channel type</Label>
          <Select 
            value={value.channelType || "train"} 
            onValueChange={(v) => updateChannel({ channelType: v as "train" | "validation" | "test" })}
          >
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="train">Train</SelectItem>
              <SelectItem value="validation">Validation</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Label className="w-32 flex-shrink-0">Source type</Label>
          <RadioGroup
            value={sourceType}
            onValueChange={(v) => {
              const nextSource = v as Channel["sourceType"];
              updateChannel({
                sourceType: nextSource,
                ...(nextSource === "upload"
                  ? { storageProvider: undefined, contentType: "csv" }
                  : { uploadFileName: "", csvColumns: [], featureNames: [], labelName: undefined, storageProvider: value.storageProvider || DEFAULT_STORAGE_PROVIDER }),
              });
            }}
            className="flex flex-wrap gap-2 flex-1"
          >
            <label htmlFor={`channel-source-upload-${value.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
              <RadioGroupItem value="upload" id={`channel-source-upload-${value.id}`} />
              <span className="font-normal">Upload file</span>
            </label>
            <label htmlFor={`channel-source-object-${value.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
              <RadioGroupItem value="object-storage" id={`channel-source-object-${value.id}`} />
              <span className="font-normal">Object storage</span>
            </label>
          </RadioGroup>
        </div>

        {sourceType === "object-storage" ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Label className="w-32 flex-shrink-0">Provider</Label>
              <Select value={provider} onValueChange={(v) => updateChannel({ storageProvider: v as StorageProvider })}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {storageProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-y-3 gap-x-30 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Label className="w-32 flex-shrink-0 pt-3">Bucket</Label>
                <div className="flex-1">
                  <Input 
                    value={value.bucket || ""} 
                    onChange={(e) => updateChannel({ bucket: e.target.value })} 
                    placeholder="storage://input" 
                    className={bucketError ? 'border-red-500' : ''}
                  />
                  {bucketError && (
                    <p className="text-sm text-red-600 mt-1">{getFieldError([bucketError], 'bucket')}</p>
                  )}
                </div>
              </div>
                <div className="flex items-start gap-0">
                  <Label className="w-25 flex-shrink-0 pt-3">Prefix / Path</Label>
                <div className="flex-1">
                  <Input 
                    value={value.prefix || ""} 
                    onChange={(e) => updateChannel({ prefix: e.target.value })} 
                    placeholder="datasets/default/" 
                    className={prefixError ? 'border-red-500' : ''}
                  />
                  {prefixError && (
                    <p className="text-sm text-red-600 mt-1">{getFieldError([prefixError], 'prefix')}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Label className="w-32 flex-shrink-0 pt-3">Endpoint (optional)</Label>
              <div className="flex-1">
                <Input value={value.endpoint || ""} onChange={(e) => updateChannel({ endpoint: e.target.value })} placeholder="http://minio.example.com" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Label className="w-32 flex-shrink-0 flex flex-col items-start leading-tight">
                <span>Upload file</span>
                <span className="text-xs text-slate-500">(max 50 MB)</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleFileUpload(file);
                }}
                className="hidden"
              />
              <div className={`flex flex-1 min-w-0 items-center justify-between rounded-md border bg-white px-3 py-2 shadow-sm ${
                hasError && !value.uploadFileName ? 'border-red-500' : 'border-slate-200'
              }`}>
                <span className={`text-sm truncate ${value.uploadFileName ? "text-slate-700" : "text-slate-400 italic"}`}>
                  {value.uploadFileName || "No file chosen"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-[94px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {value.uploadFileName ? "Change" : "Browse"}
                </Button>
              </div>
            </div>
            {uploadError && (
              <p className="text-sm text-red-600 ml-36 mt-1">{uploadError}</p>
            )}
            {hasError && !value.uploadFileName && (
              <p className="text-sm text-red-600 ml-36 mt-1">Upload file is required</p>
            )}

            {availableColumns.length > 0 && (
              <>
                <div className="flex items-start gap-4">
                  <Label className="w-30 flex-shrink-0 pt-2">Feature name(s)</Label>
                  <div className="relative flex-1" ref={featureDropdownRef}>
                    <div
                      className={`flex min-h-9 w-full items-center justify-between rounded-md border ${featureError ? 'border-red-600' : 'border-slate-200'} bg-white px-3 py-2 text-sm cursor-pointer`}
                      onClick={() => setFeatureDropdownOpen(!featureDropdownOpen)}
                    >
                      <span className={selectedFeatures.length === 0 ? "text-slate-400" : ""}>
                        {selectedFeatures.length === 0 ? "Select features" : `${selectedFeatures.length} selected`}
                      </span>
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.18179 6.18181C4.35753 6.00608 4.64245 6.00608 4.81819 6.18181L7.49999 8.86362L10.1818 6.18181C10.3575 6.00608 10.6424 6.00608 10.8182 6.18181C10.9939 6.35755 10.9939 6.64247 10.8182 6.81821L7.81819 9.81821C7.73379 9.9026 7.61933 9.95001 7.49999 9.95001C7.38064 9.95001 7.26618 9.9026 7.18179 9.81821L4.18179 6.81821C4.00605 6.64247 4.00605 6.35755 4.18179 6.18181Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                      </svg>
                    </div>
                    {featureDropdownOpen && availableForFeatures.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                        <div className="border-b p-2">
                          <Input
                            placeholder="Search columns..."
                            value={featureSearch}
                            onChange={(e) => setFeatureSearch(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {availableForFeatures.filter(col => 
                            col.toLowerCase().includes(featureSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-500">No columns found</div>
                          ) : (
                            availableForFeatures
                              .filter(col => col.toLowerCase().includes(featureSearch.toLowerCase()))
                              .map((col) => (
                                <div
                                  key={col}
                                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100"
                                  onClick={() => {
                                    if (selectedFeatures.includes(col)) {
                                      updateChannel({ featureNames: selectedFeatures.filter(f => f !== col) });
                                    } else {
                                      updateChannel({ featureNames: [...selectedFeatures, col] });
                                    }
                                    setFeatureDropdownOpen(false);
                                  }}
                                >
                                  <div className="flex h-4 w-4 items-center justify-center rounded border border-slate-300">
                                    {selectedFeatures.includes(col) && (
                                      <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span>{col}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                    {selectedFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedFeatures.map((feature) => (
                          <Badge key={feature} variant="secondary" className="flex items-center gap-1 pl-2 pr-1">
                            <span>{feature}</span>
                            <button
                              type="button"
                              onClick={() => {
                                updateChannel({ featureNames: selectedFeatures.filter(f => f !== feature) });
                              }}
                              className="ml-1 rounded-sm hover:bg-slate-300"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {featureError && (
                  <p className="text-sm text-red-600 ml-36 mt-1">Feature name(s) is required</p>
                )}

                <div className="flex items-center gap-2">
                  <Label className="w-32 flex-shrink-0">Label name</Label>
                  <Select 
                    value={selectedLabel || ""} 
                    onValueChange={(col) => updateChannel({ labelName: col })}
                    disabled={availableForLabel.length === 0}
                  >
                    <SelectTrigger className={labelError ? 'border-red-600' : ''}>
                      <SelectValue placeholder={availableForLabel.length === 0 ? "No columns available" : "Select label column"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForLabel.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {labelError && (
                  <p className="text-sm text-red-600 ml-36 mt-1">Label name is required</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateTrainingJobUI() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentNamespace, setCurrentNamespace] = useState<string>('');
  
  const defaultAlgorithmId = builtinAlgorithms[0].id;
  const [form, setForm] = useState<TrainingJobForm>(() => ({
    jobName: generateJobName(),
    priority: 500,
    algorithm: {
      source: "builtin" as const,
      algorithmName: defaultAlgorithmId,
    },
    resources: {
      instanceResources: { cpuCores: 4, memoryGiB: 16, gpuCount: 0 },
      instanceCount: 1,
      volumeSizeGB: 50,
      distributedTraining: false,
    },
    stoppingCondition: { maxRuntimeSeconds: 3600 * 4 },
    inputDataConfig: [
      {
        id: randomId("channel"),
        channelName: "train",
        sourceType: "upload",
        channelType: "train",
        contentType: "csv",
        csvColumns: [],
        featureNames: [],
        labelName: undefined,
      },
    ],
    outputDataConfig: {
      artifactUri: "",
      configMode: "default",
      storageProvider: "minio",
      bucket: "",
      prefix: "",
      endpoint: "",
    },
    checkpointConfig: {
      enabled: false,
      configMode: "default",
      storageProvider: "minio",
      bucket: "",
      prefix: "",
      endpoint: "",
    },
    hyperparameters: {
      [defaultAlgorithmId]: getDefaultHyperparameters(defaultAlgorithmId),
    },
    customHyperparameters: {},
  }));


  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<null | { ok: boolean; message: string }>(null);

  const errors = useMemo(() => validateForm(form), [form]);

  // Fetch Kubeflow environment info on mount
  useEffect(() => {
    getCurrentNamespace().then(namespace => {
      setCurrentNamespace(namespace);
      console.log('Kubeflow namespace:', namespace);
    }).catch(err => {
      console.error('Failed to get Kubeflow environment info:', err);
    });
  }, []);

  // Sync default output config when job name or namespace changes
  useEffect(() => {
    if (form.outputDataConfig.configMode === "default" && currentNamespace && form.jobName) {
      setForm((prev) => ({
        ...prev,
        outputDataConfig: {
          ...prev.outputDataConfig,
          storageProvider: "minio",
          bucket: currentNamespace,
          prefix: `output/${form.jobName}`,
          endpoint: "",
          artifactUri: `s3://${currentNamespace}/output/${form.jobName}`,
        },
      }));
    }
  }, [form.outputDataConfig.configMode, currentNamespace, form.jobName]);

  // Sync default checkpoint config when job name or namespace changes
  useEffect(() => {
    if (form.checkpointConfig?.enabled && form.checkpointConfig.configMode === "default" && currentNamespace && form.jobName) {
      setForm((prev) => ({
        ...prev,
        checkpointConfig: {
          ...prev.checkpointConfig!,
          storageProvider: "minio",
          bucket: currentNamespace,
          prefix: `checkpoint/${form.jobName}`,
          endpoint: "",
        },
      }));
    }
  }, [form.checkpointConfig?.enabled, form.checkpointConfig?.configMode, currentNamespace, form.jobName]);

  const update = useCallback(<K extends keyof TrainingJobForm>(key: K, value: TrainingJobForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateOutputDataConfig = useCallback((partial: Partial<typeof form.outputDataConfig>) => {
    setForm((prev) => ({
      ...prev,
      outputDataConfig: { ...prev.outputDataConfig, ...partial },
    }));
  }, []);

  const updateAlgorithm = useCallback((partial: Partial<TrainingJobForm["algorithm"]>) => {
    setForm((prev) => {
      const nextAlgorithm = { ...prev.algorithm, ...partial };
      const nextHyperparameters = { ...prev.hyperparameters };

      if (nextAlgorithm.source === "builtin") {
        const resolvedId = nextAlgorithm.algorithmName || defaultAlgorithmId;
        nextAlgorithm.algorithmName = resolvedId;
        if (!nextHyperparameters[resolvedId]) {
          nextHyperparameters[resolvedId] = getDefaultHyperparameters(resolvedId);
        }
      } else {
        nextAlgorithm.algorithmName = undefined;
      }

      return {
        ...prev,
        algorithm: nextAlgorithm,
        hyperparameters: nextHyperparameters,
      };
    });
  }, [defaultAlgorithmId]);

  const updateResources = useCallback((partial: Partial<TrainingJobForm["resources"]>) => {
    setForm((prev) => ({
      ...prev,
      resources: { ...prev.resources, ...partial },
    }));
  }, []);

  const updateHyperparameters = useCallback((algorithmId: string, value: HyperparameterValues) => {
    setForm((prev) => ({
      ...prev,
      hyperparameters: {
        ...prev.hyperparameters,
        [algorithmId]: value,
      },
    }));
  }, []);

  const resetHyperparameters = useCallback((algorithmId: string) => {
    updateHyperparameters(algorithmId, getDefaultHyperparameters(algorithmId));
  }, [updateHyperparameters]);

  const updateCustomHyperparameters = useCallback((value: Record<string, string | number | boolean>) => {
    setForm((prev) => ({
      ...prev,
      customHyperparameters: value,
    }));
  }, []);

  const addChannel = useCallback((template?: Partial<Channel>) => {
    const next: Channel = {
      id: randomId("channel"),
      channelName: template?.channelName || "",
      sourceType: template?.sourceType || "upload",
      channelType: template?.channelType || "train",
      contentType: template?.contentType || "csv",
      csvColumns: template?.csvColumns || [],
      featureNames: template?.featureNames || [],
      labelName: template?.labelName,
      storageProvider: template?.storageProvider,
      endpoint: template?.endpoint,
      bucket: template?.bucket,
      prefix: template?.prefix,
      uploadFileName: template?.uploadFileName || "",
    };
    setForm((prev) => ({
      ...prev,
      inputDataConfig: [...prev.inputDataConfig, next],
    }));
  }, []);

  const removeChannel = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      inputDataConfig: prev.inputDataConfig.filter((c) => c.id !== id),
    }));
  }, []);

  const duplicateChannel = useCallback((id: string) => {
    setForm((prev) => {
      const src = prev.inputDataConfig.find((c) => c.id === id);
      if (!src) return prev;
      const copy = { ...deepClone(src), id: randomId("channel"), channelName: `${src.channelName}-copy` };
      return {
        ...prev,
        inputDataConfig: [...prev.inputDataConfig, copy],
      };
    });
  }, []);

  const moveChannel = useCallback((id: string, dir: -1 | 1) => {
    setForm((prev) => {
      const idx = prev.inputDataConfig.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const arr = [...prev.inputDataConfig];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      const [item] = arr.splice(idx, 1);
      arr.splice(j, 0, item);
      return {
        ...prev,
        inputDataConfig: arr,
      };
    });
  }, []);

  const activeAlgorithmId = form.algorithm.source === "builtin" ? form.algorithm.algorithmName || defaultAlgorithmId : null;
  const activeHyperparameterConfig = activeAlgorithmId ? getHyperparameterConfig(activeAlgorithmId) : undefined;
  const activeHyperparameters = activeAlgorithmId
    ? form.hyperparameters[activeAlgorithmId] ?? getDefaultHyperparameters(activeAlgorithmId)
    : undefined;
  const HyperparameterFormComponent = activeHyperparameterConfig?.Form;

  useEffect(() => {
    if (!activeAlgorithmId) return;
    setForm((prev) => {
      if (prev.hyperparameters[activeAlgorithmId]) {
        return prev;
      }
      return {
        ...prev,
        hyperparameters: {
          ...prev.hyperparameters,
          [activeAlgorithmId]: getDefaultHyperparameters(activeAlgorithmId),
        },
      };
    });
  }, [activeAlgorithmId]);

  async function submit() {
    if (errors.length) {
      setSubmitResult({ ok: false, message: "Fix form errors and try again." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      
      // Get current namespace from Kubeflow (will use fallback if not available)
      const namespace = currentNamespace || 'kubeflow-user-example-com';
      
      // Upload files to MinIO before creating the job
      const uploadChannels = form.inputDataConfig.filter(
        (channel) => channel.sourceType === "upload" && channel.uploadedFile
      );
      
      if (uploadChannels.length > 0) {
        console.log(`Uploading ${uploadChannels.length} file(s) to MinIO...`);
        
        for (const channel of uploadChannels) {
          if (channel.uploadedFile) {
            const objectKey = `training-data/${channel.channelName}/${channel.uploadedFile.name}`;
            console.log(`Uploading file: ${channel.uploadedFile.name} to ${namespace}/${objectKey}`);
            
            try {
              const uploadResult = await uploadApi.uploadFile(
                channel.uploadedFile,
                namespace,
                objectKey
              );
              console.log(`File uploaded successfully: ${uploadResult.objectKey}`);
              
              // Update the channel to use object storage instead of upload
              channel.sourceType = "object-storage";
              channel.storageProvider = "minio";
              channel.endpoint = uploadResult.endpoint;
              channel.bucket = uploadResult.bucket;
              channel.prefix = uploadResult.objectKey;
              // Clear upload-specific fields
              delete channel.uploadFileName;
              delete channel.uploadedFile;
              delete channel.csvColumns;
              
            } catch (uploadError) {
              console.error(`Failed to upload file for channel ${channel.channelName}:`, uploadError);
              const fileName = channel.uploadedFile?.name || 'unknown file';
              throw new Error(`Failed to upload file ${fileName}: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
            }
          }
        }
        
        console.log("All files uploaded successfully");
      }
      
      // Convert frontend payload to backend API format with namespace
      const backendRequest = convertToBackendRequest(payload, namespace);
      
      // Submit to backend API
      const backendResponse = await jobsApi.create(backendRequest);
      
      // Convert backend response to StoredJob format for local storage
      const job: StoredJob = convertFromBackendResponse(backendResponse);
      
      // Also save locally for offline access
      await persistPayload(payload, job);
      
      setSubmitResult({
        ok: true,
        message: `Training job "${backendResponse.jobName}" created successfully! Job ID: ${backendResponse.id}.`,
      });
      
      // Navigate after a short delay
      setTimeout(() => {
        navigate({ pathname: LIST_ROUTE, search: location.search }, { replace: true });
      }, 1500);
      
    } catch (error) {
      console.error("Failed to submit job", error);
      let errorMessage = "Unexpected error while creating job.";
      
      if (error instanceof APIError) {
        errorMessage = `API Error: ${error.message}`;
        if (error.status) {
          errorMessage += ` (Status: ${error.status})`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setSubmitResult({ ok: false, message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  }

  const maxRuntimeHours = Math.floor(form.stoppingCondition.maxRuntimeSeconds / 3600);
  const maxRuntimeMinutes = Math.floor((form.stoppingCondition.maxRuntimeSeconds % 3600) / 60);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Modern Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                to={LIST_ROUTE} 
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors inline-flex items-center gap-2 mb-4 group"
              >
                <span className="group-hover:-translate-x-1 transition-transform">←</span>
                <span>Back to Jobs</span>
              </Link>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                Create Training Job
              </h1>
              <p className="mt-3 text-lg text-slate-600 max-w-2xl">
                Configure and submit a new machine learning training job with customizable hyperparameters
              </p>
            </div>
            {errors.length === 0 ? (
              <div className="text-sm">
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-semibold border border-emerald-200 shadow-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Ready to Submit
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 font-semibold border border-amber-200 shadow-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  {errors.length} Issue{errors.length === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="space-y-4">
          
          {/* Section 1: Basic Information */}
          <section>
            <div className="mb-2">
              <h2 className="text-xl font-bold text-slate-900">Basic Information</h2>
              <p className="mt-1 text-sm text-slate-600">Set the job name</p>
            </div>
            
            <Card className="shadow-md border-blue-100 bg-gradient-to-br from-white to-blue-50/30 hover:shadow-lg transition-shadow">
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold w-32 flex-shrink-0">Job Name</Label>
                  <div className="flex-1">
                    <Input 
                      value={form.jobName} 
                      onChange={(e) => update("jobName", e.target.value)} 
                      placeholder="train-2025…"
                      className={hasFieldError(errors, 'job name') ? 'border-red-500' : ''}
                    />
                    {hasFieldError(errors, 'job name') && (
                      <p className="text-sm text-red-600 mt-1">{getFieldError(errors, 'job name')}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 2: Algorithm */}
          <section>
            <div className="mb-2">
              <h2 className="text-xl font-bold text-slate-900">Algorithm Selection</h2>
              <p className="mt-1 text-sm text-slate-600">Choose your machine learning algorithm</p>
            </div>

          <Card className="shadow-md border-purple-100 bg-gradient-to-br from-white to-purple-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold w-32 flex-shrink-0">Source</Label>
                <RadioGroup
                  value={form.algorithm.source}
                  onValueChange={(v) => {
                    const next = v as AlgorithmSource;
                    const defaultBuiltin = form.algorithm.algorithmName || builtinAlgorithms[0].id;
                    updateAlgorithm({
                      source: next,
                      algorithmName: next === "builtin" ? defaultBuiltin : undefined,
                      imageUri: next === "container" ? form.algorithm.imageUri || "" : undefined,
                    });
                  }}
                  className="flex flex-wrap gap-2 flex-1"
                >
                  <label htmlFor="algorithm-source-builtin" className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="builtin" id="algorithm-source-builtin" />
                    <span className="font-medium text-sm">Built-in algorithm</span>
                  </label>
                  <label htmlFor="algorithm-source-container" className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="container" id="algorithm-source-container" />
                    <span className="font-medium text-sm">Custom algorithm</span>
                  </label>
                </RadioGroup>
              </div>
              {form.algorithm.source === "builtin" ? (
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold w-32 flex-shrink-0">Built-in algorithm</Label>
                  <div className="flex-1">
                    <Select
                      value={form.algorithm.algorithmName}
                      onValueChange={(value) => updateAlgorithm({ algorithmName: value, imageUri: undefined })}
                    >
                      <SelectTrigger className={hasFieldError(errors, 'algorithm') && form.algorithm.source === 'builtin' ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select algorithm" />
                      </SelectTrigger>
                      <SelectContent>
                        {builtinAlgorithms.map((algo) => (
                          <SelectItem key={algo.id} value={algo.id}>
                            {algo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasFieldError(errors, 'algorithm') && form.algorithm.source === 'builtin' && (
                      <p className="text-sm text-red-600 mt-1">{getFieldError(errors, 'algorithm')}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <Label className="text-sm font-semibold w-30 flex-shrink-0 pt-2">Container image URI</Label>
                  <div className="flex-1 space-y-1">
                    <Input
                      value={form.algorithm.imageUri || ""}
                      onChange={(e) => updateAlgorithm({ imageUri: e.target.value, algorithmName: undefined })}
                      placeholder="registry.example.com/ml/training:latest"
                      className={hasFieldError(errors, 'image uri') && form.algorithm.source === 'container' ? 'border-red-500' : ''}
                    />
                    {hasFieldError(errors, 'image uri') && form.algorithm.source === 'container' && (
                      <p className="text-sm text-red-600 mt-1">{getFieldError(errors, 'image uri')}</p>
                    )}
                    <p className="text-xs text-slate-500">Provide a fully qualified container image URI for your custom algorithm.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {form.algorithm.source === "builtin" && activeAlgorithmId && (
            <Card className="shadow-sm mt-3">
              <CardContent className="pt-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Hyperparameters</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Set hyperparameters for {activeHyperparameterConfig?.label ?? "the selected algorithm"}
                    </p>
                  </div>
                  {HyperparameterFormComponent && (
                    <Button type="button" variant="outline" size="sm" onClick={() => resetHyperparameters(activeAlgorithmId)}>
                      Reset to defaults
                    </Button>
                  )}
                </div>
                <div className="max-h-[600px] overflow-y-auto pr-2">
                  {HyperparameterFormComponent ? (
                    <HyperparameterFormComponent
                      value={activeHyperparameters as HyperparameterValues}
                      onChange={(next) => updateHyperparameters(activeAlgorithmId, next)}
                    />
                  ) : (
                    <p className="text-sm text-slate-600">
                      No hyperparameter form is registered yet. Update the files in <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">src/app/create/hyperparameters</code> to
                      define inputs.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {form.algorithm.source === "container" && (
            <Card className="shadow-sm mt-3 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
              <CardContent className="pt-2">
                <CustomHyperparametersEditor
                  value={form.customHyperparameters || {}}
                  onChange={updateCustomHyperparameters}
                />
              </CardContent>
            </Card>
          )}
          </section>

          {/* Section 3: Compute Resources - Temporarily Hidden */}
          {false && (<section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Compute Resources</h2>
              <p className="mt-1 text-sm text-slate-600">Allocate CPU, memory, GPU, and configure distributed training</p>
            </div>

          <Card className="shadow-md border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-200">
                <div>
                  <Label className="text-base font-semibold">Enable distributed training</Label>
                  <p className="text-sm text-slate-500 mt-1">Train across multiple instances simultaneously</p>
                </div>
                <Switch
                  checked={form.resources.distributedTraining || false}
                  onCheckedChange={(checked) => updateResources({ distributedTraining: checked })}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">CPUs per instance</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.instanceResources.cpuCores}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.instanceResources.cpuCores;
                      updateResources({
                        instanceResources: { ...form.resources.instanceResources, cpuCores: next },
                      });
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Memory (GiB) per instance</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.instanceResources.memoryGiB}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.instanceResources.memoryGiB;
                      updateResources({
                        instanceResources: { ...form.resources.instanceResources, memoryGiB: next },
                      });
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">GPUs per instance</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.resources.instanceResources.gpuCount}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : form.resources.instanceResources.gpuCount;
                      updateResources({
                        instanceResources: { ...form.resources.instanceResources, gpuCount: next },
                      });
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Instance count</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.instanceCount}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.instanceCount;
                      updateResources({ instanceCount: next });
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Volume size (GiB)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.volumeSizeGB}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.volumeSizeGB;
                      updateResources({ volumeSizeGB: next });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          </section>)}

          {/* Section 4: Data & Storage */}
          <section>
            <div className="mb-2">
              <h2 className="text-xl font-bold text-slate-900">Data & Storage</h2>
              <p className="mt-1 text-sm text-slate-600">Create a channel for each input dataset. For example, your algorithm might accept train, validation, and test input channels.</p>
            </div>

          <Card className="shadow-md border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-2">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Input Channels</h3>
              <p className="text-sm text-slate-600 mb-4">Configure training datasets from object storage or file uploads</p>
              
              <div className="space-y-3">
              {form.inputDataConfig.length === 0 && (
                <p className="text-sm text-slate-600 py-8 text-center bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg border border-dashed border-indigo-200">No channels configured yet. Add at least one to continue.</p>
              )}
              {form.inputDataConfig.map((channel, idx) => {
                const channelErrors = errors.filter(err => 
                  err.includes(`#${idx + 1}`) || (channel.channelName && err.includes(`'${channel.channelName}`))
                );
                const uploadFileError = channelErrors.find(err => err.includes('Upload file'));
                const bucketError = channelErrors.find(err => err.includes('Bucket'));
                const prefixError = channelErrors.find(err => err.includes('Prefix'));
                const featureError = channelErrors.find(err => err.includes('Feature name'));
                const labelError = channelErrors.find(err => err.includes('Label name'));
                return (
                <div key={channel.id} className="rounded-lg border border-indigo-200/50 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-3 hover:border-indigo-300 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{channel.channelName || `Channel ${idx + 1}`}</p>
                      <p className="text-sm text-slate-500">#{idx + 1}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="mr-2">
                        {channel.sourceType === "upload"
                          ? "Upload"
                          : storageProviderLabels[channel.storageProvider || DEFAULT_STORAGE_PROVIDER]}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveChannel(channel.id, -1)}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                        <span className="sr-only">Move up</span>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => moveChannel(channel.id, 1)}
                        disabled={idx === form.inputDataConfig.length - 1}
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                        <span className="sr-only">Move down</span>
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => duplicateChannel(channel.id)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Duplicate channel</span>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeChannel(channel.id)}
                        disabled={form.inputDataConfig.length === 1}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span className="sr-only">Remove channel</span>
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white rounded-md p-3">
                    <ChannelEditor
                      value={channel}
                      hasError={uploadFileError !== undefined}
                      bucketError={bucketError}
                      prefixError={prefixError}
                      featureError={featureError}
                      labelError={labelError}
                      onChange={(next) => {
                        const nextChannels = [...form.inputDataConfig];
                        nextChannels[idx] = next;
                        update("inputDataConfig", nextChannels);
                      }}
                    />
                  </div>
                </div>
              );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" onClick={() => addChannel({ channelName: `channel-${form.inputDataConfig.length + 1}`, channelType: "train" })} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" /> Add channel
                </Button>
              </div>
              </div>
            </CardContent>
          </Card>

          {false && (<Card className="shadow-md border-pink-100 bg-gradient-to-br from-white to-pink-50/30 hover:shadow-lg transition-shadow mt-4">
            <CardContent className="pt-4">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Stopping Condition</h3>
              <p className="text-sm text-slate-600 mb-3">Set maximum runtime limits to control training duration</p>
              
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Hours</Label>
                  <Input
                    type="number"
                    min={0}
                    value={maxRuntimeHours}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : maxRuntimeHours;
                      const total = secondsFromHM(next, maxRuntimeMinutes);
                      update("stoppingCondition", { maxRuntimeSeconds: total });
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm font-semibold">Minutes</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={maxRuntimeMinutes}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(0, Math.min(59, Math.floor(raw))) : maxRuntimeMinutes;
                      const total = secondsFromHM(maxRuntimeHours, next);
                      update("stoppingCondition", { maxRuntimeSeconds: total });
                    }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Total runtime limit: <span className="font-semibold">{Math.max(0, maxRuntimeHours)}h {Math.max(0, maxRuntimeMinutes)}m</span>
              </p>
            </CardContent>
          </Card>)}

          <Card className="shadow-md border-rose-100 bg-gradient-to-br from-white to-rose-50/30 hover:shadow-lg transition-shadow mt-4">
            <CardContent className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Checkpoint config - optional</h3>
                  <p className="text-sm text-slate-600">The algorithm is responsible for periodically generating checkpoints.</p>
                </div>
                <Switch
                  checked={form.checkpointConfig?.enabled || false}
                  onCheckedChange={(checked) => {
                    setForm((prev) => ({
                      ...prev,
                      checkpointConfig: {
                        enabled: checked,
                        configMode: "default",
                        storageProvider: "minio",
                        bucket: checked ? currentNamespace : "",
                        prefix: checked ? `checkpoint/${form.jobName}` : "",
                        endpoint: "",
                      },
                    }));
                  }}
                />
              </div>
              
              {form.checkpointConfig?.enabled && (
                <div className="grid gap-3 pt-3 border-t border-rose-200">
                  <div className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">Configuration</Label>
                    <RadioGroup
                      value={form.checkpointConfig.configMode || "default"}
                      onValueChange={(v) => {
                        const mode = v as "default" | "custom";
                        if (mode === "default") {
                          setForm((prev) => ({
                            ...prev,
                            checkpointConfig: {
                              ...prev.checkpointConfig!,
                              configMode: mode,
                              storageProvider: "minio",
                              bucket: currentNamespace,
                              prefix: `checkpoint/${form.jobName}`,
                              endpoint: "",
                            },
                          }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            checkpointConfig: {
                              ...prev.checkpointConfig!,
                              configMode: mode,
                              storageProvider: "minio",
                              bucket: "",
                              prefix: "",
                              endpoint: "",
                            },
                          }));
                        }
                      }}
                      className="flex flex-wrap gap-2 flex-1"
                    >
                      <label htmlFor="checkpoint-config-default" className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <RadioGroupItem value="default" id="checkpoint-config-default" />
                        <span className="font-normal">Default</span>
                      </label>
                      <label htmlFor="checkpoint-config-custom" className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <RadioGroupItem value="custom" id="checkpoint-config-custom" />
                        <span className="font-normal">Custom</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="w-32 shrink-0">Provider</Label>
                      <Select 
                        value={form.checkpointConfig.storageProvider || "minio"} 
                        onValueChange={(v) => setForm((prev) => ({
                          ...prev,
                          checkpointConfig: { ...prev.checkpointConfig!, storageProvider: v as StorageProvider },
                        }))}
                        disabled={form.checkpointConfig.configMode === "default"}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {storageProviders.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-y-3 gap-x-30 md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Label className="w-32 shrink-0">Bucket</Label>
                        <Input
                          value={form.checkpointConfig.bucket || ""}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            checkpointConfig: { ...prev.checkpointConfig!, bucket: e.target.value },
                          }))}
                          placeholder="my-bucket"
                          disabled={form.checkpointConfig.configMode === "default"}
                          className={`flex-1 ${form.checkpointConfig.configMode === "default" ? 'bg-slate-50 text-slate-700' : ''}`}
                        />
                      </div>
                      <div className="flex items-center gap-0">
                        <Label className="w-25 shrink-0">Prefix / Path</Label>
                        <Input
                          value={form.checkpointConfig.prefix || ""}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            checkpointConfig: { ...prev.checkpointConfig!, prefix: e.target.value },
                          }))}
                          placeholder="checkpoint/path"
                          disabled={form.checkpointConfig.configMode === "default"}
                          className={`flex-1 ${form.checkpointConfig.configMode === "default" ? 'bg-slate-50 text-slate-700' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 hover:shadow-lg transition-shadow mt-4">
            <CardContent className="pt-2">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Output data configuration</h3>
              <p className="text-sm text-slate-600 mb-3">Training outputs such as logs and metrics are stored, enabling visualization in tools like TensorBoard.</p>
              
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Label className="w-32 shrink-0">Configuration</Label>
                  <RadioGroup
                    value={form.outputDataConfig.configMode || "default"}
                    onValueChange={(v) => {
                      const mode = v as "default" | "custom";
                      if (mode === "default") {
                        updateOutputDataConfig({
                          configMode: mode,
                          storageProvider: "minio",
                          bucket: currentNamespace,
                          prefix: `output/${form.jobName}`,
                          endpoint: "",
                          artifactUri: `s3://${currentNamespace}/output/${form.jobName}`,
                        });
                      } else {
                        updateOutputDataConfig({
                          configMode: mode,
                          storageProvider: "minio",
                          bucket: "",
                          prefix: "",
                          endpoint: "",
                          artifactUri: "",
                        });
                      }
                    }}
                    className="flex flex-wrap gap-2 flex-1"
                  >
                    <label htmlFor="output-config-default" className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <RadioGroupItem value="default" id="output-config-default" />
                      <span className="font-normal">Default</span>
                    </label>
                    <label htmlFor="output-config-custom" className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <RadioGroupItem value="custom" id="output-config-custom" />
                      <span className="font-normal">Custom</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="w-32 shrink-0">Provider</Label>
                    <Select 
                      value={form.outputDataConfig.storageProvider || "minio"} 
                      onValueChange={(v) => updateOutputDataConfig({ storageProvider: v as StorageProvider })}
                      disabled={form.outputDataConfig.configMode === "default"}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {storageProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-y-3 gap-x-30 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Label className="w-32 flex-shrink-0">Bucket</Label>
                      <Input
                        value={form.outputDataConfig.bucket || ""}
                        onChange={(e) => updateOutputDataConfig({ bucket: e.target.value })}
                        placeholder="my-bucket"
                        disabled={form.outputDataConfig.configMode === "default"}
                        className={`flex-1 ${form.outputDataConfig.configMode === "default" ? 'bg-slate-50 text-slate-700' : ''}`}
                      />
                    </div>
                    <div className="flex items-center gap-0">
                      <Label className="w-25 flex-shrink-0">Prefix / Path</Label>
                      <Input
                        value={form.outputDataConfig.prefix || ""}
                        onChange={(e) => updateOutputDataConfig({ prefix: e.target.value })}
                        placeholder="output/path"
                        disabled={form.outputDataConfig.configMode === "default"}
                        className={`flex-1 ${form.outputDataConfig.configMode === "default" ? 'bg-slate-50 text-slate-700' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </section>

          {/* Section 5: Cluster Selection */}
        </div>

        {/* Submit Section */}
        <div className="mt-12 sticky bottom-0 bg-gradient-to-r from-white via-slate-50 to-white border-t border-slate-200 shadow-lg backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              {errors.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-amber-600 text-xl font-bold">!</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        {errors.length} validation issue{errors.length === 1 ? "" : "s"} found
                      </p>
                      <ul className="mt-2 space-y-1">
                        {errors.map((error, idx) => {
                          const match = error.match(/^\[([^\]]+)\]\s*(.+)$/);
                          if (match) {
                            const [, section, message] = match;
                            return (
                              <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>
                                  <span className="font-semibold">{section}:</span> {message}
                                </span>
                              </li>
                            );
                          }
                          return (
                            <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>{error}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-emerald-600 text-xl font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Configuration complete</p>
                    <p className="text-sm text-slate-600">Ready to submit training job</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={submit}
                disabled={errors.length > 0 || submitting} 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8"
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
              {submitResult && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${submitResult.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  <span className="text-sm font-medium">{submitResult.message}</span>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
