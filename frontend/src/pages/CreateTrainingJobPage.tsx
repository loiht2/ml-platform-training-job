import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Copy, FileJson2, Plus, Trash2 } from "lucide-react";
import { getDefaultHyperparameters, getHyperparameterConfig, type HyperparameterValues } from "@/app/create/hyperparameters";
import { persistJob } from "@/lib/jobs-storage";
import type { AlgorithmSource, Channel, JobPayload, StorageProvider, StoredJob, TrainingJobForm } from "@/types/training-job";
import { CustomHyperparametersEditor } from "@/components/CustomHyperparametersEditor";

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
  return {
    jobName: form.jobName,
    priority: form.priority,
    algorithm: {
      source: form.algorithm.source,
      algorithmName: form.algorithm.algorithmName,
      imageUri: form.algorithm.imageUri,
    },
    resources: deepClone(form.resources),
    stoppingCondition: deepClone(form.stoppingCondition),
    inputDataConfig: deepClone(form.inputDataConfig),
    outputDataConfig: deepClone(form.outputDataConfig),
    hyperparameters: deepClone(form.hyperparameters),
    customHyperparameters: form.customHyperparameters ? deepClone(form.customHyperparameters) : undefined,
  };
}

function validateForm(form: TrainingJobForm) {
  const errors: string[] = [];
  if (!form.jobName || !JOB_NAME_REGEX.test(form.jobName)) {
    errors.push("Job name is required and must match ^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$");
  }
  if (!Number.isFinite(form.priority) || form.priority <= 0 || form.priority > 1000) {
    errors.push("Priority must be greater than 0 and at most 1000.");
  }
  const alg = form.algorithm;
  if (alg.source === "builtin" && !alg.algorithmName) errors.push("Select a built-in algorithm.");
  if (alg.source === "container" && !alg.imageUri) errors.push("Container image URI is required.");
  if (!form.inputDataConfig?.length) errors.push("At least one input channel is required.");
  const hasTrain = form.inputDataConfig.some((c) => c.channelName === "train");
  if (!hasTrain) errors.push("A 'train' channel is required.");
  form.inputDataConfig.forEach((c, idx) => {
    const sourceType = c.sourceType || "object-storage";
    if (!c.channelName) errors.push(`Channel #${idx + 1}: name is required.`);
    if (sourceType === "object-storage") {
      if (!c.storageProvider) errors.push(`Channel '${c.channelName || idx + 1}': provider is required.`);
      if (!c.bucket) errors.push(`Channel '${c.channelName || idx + 1}': bucket/container is required.`);
      if (!c.prefix) errors.push(`Channel '${c.channelName || idx + 1}': prefix/path is required.`);
    } else if (sourceType === "upload") {
      if (!c.uploadFileName) errors.push(`Channel '${c.channelName || idx + 1}': upload file is required.`);
    }
  });
  if (!form.outputDataConfig.artifactUri) errors.push("Output artifact URI is required.");
  return errors;
}

type PersistResponse = { ok: true; filename: string } | { ok: false };

async function persistPayload(payload: JobPayload, job: StoredJob): Promise<PersistResponse> {
  const result = await persistJob(payload, job);
  if (result.ok) {
    return { ok: true, filename: result.filename };
  }
  return { ok: false };
}

function ChannelEditor({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  const sourceType = value.sourceType || "object-storage";
  const provider = value.storageProvider || DEFAULT_STORAGE_PROVIDER;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateChannel(partial: Partial<Channel>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Channel name</Label>
            <Input value={value.channelName} onChange={(e) => updateChannel({ channelName: e.target.value })} placeholder="train" />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Source type</Label>
          <RadioGroup
            value={sourceType}
            onValueChange={(v) => {
              const nextSource = v as Channel["sourceType"];
              updateChannel({
                sourceType: nextSource,
                ...(nextSource === "upload"
                  ? { storageProvider: undefined }
                  : { uploadFileName: "", storageProvider: value.storageProvider || DEFAULT_STORAGE_PROVIDER }),
              });
            }}
            className="flex flex-wrap gap-3"
          >
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <RadioGroupItem value="object-storage" id={`channel-source-object-${value.id}`} />
              <Label htmlFor={`channel-source-object-${value.id}`} className="font-normal">Object storage</Label>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <RadioGroupItem value="upload" id={`channel-source-upload-${value.id}`} />
              <Label htmlFor={`channel-source-upload-${value.id}`} className="font-normal">Upload file</Label>
            </div>
          </RadioGroup>
        </div>

        {sourceType === "object-storage" ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => updateChannel({ storageProvider: v as StorageProvider })}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {storageProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Bucket / Container</Label>
                <Input value={value.bucket || ""} onChange={(e) => updateChannel({ bucket: e.target.value })} placeholder="storage://input" />
              </div>
              <div className="grid gap-2">
                <Label>Prefix / Path</Label>
                <Input value={value.prefix || ""} onChange={(e) => updateChannel({ prefix: e.target.value })} placeholder="datasets/default/" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Endpoint (optional)</Label>
              <Input value={value.endpoint || ""} onChange={(e) => updateChannel({ endpoint: e.target.value })} placeholder="https://minio.example.com" />
              <p className="text-xs text-slate-500">Leave blank for managed services; specify an endpoint for self-hosted or custom object storage.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Upload file</Label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                updateChannel({ uploadFileName: file ? file.name : "" });
              }}
              className="hidden"
            />
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
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
        )}
      </div>
    </div>
  );
}

export default function CreateTrainingJobUI() {
  const navigate = useNavigate();
  const location = useLocation();
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
    },
    stoppingCondition: { maxRuntimeSeconds: 3600 * 4 },
    inputDataConfig: [
      {
        id: randomId("channel"),
        channelName: "train",
        sourceType: "object-storage",
        storageProvider: DEFAULT_STORAGE_PROVIDER,
        endpoint: "https://minio.local",
        bucket: "storage://input",
        prefix: "datasets/default/",
      },
    ],
    outputDataConfig: { artifactUri: "storage://output/artifacts/" },
    hyperparameters: {
      [defaultAlgorithmId]: getDefaultHyperparameters(defaultAlgorithmId),
    },
    customHyperparameters: {},
  }));

  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<null | { ok: boolean; message: string }>(null);

  const payload = useMemo(() => formToPayload(form), [form]);
  const errors = useMemo(() => validateForm(form), [form]);

  const update = useCallback(<K extends keyof TrainingJobForm>(key: K, value: TrainingJobForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      sourceType: template?.sourceType || "object-storage",
      storageProvider: template?.storageProvider || DEFAULT_STORAGE_PROVIDER,
      endpoint: template?.endpoint || "https://minio.local",
      bucket: template?.bucket || "storage://input",
      prefix: template?.prefix || "datasets/default/",
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
      const job: StoredJob = {
        id: form.jobName,
        algorithm:
          form.algorithm.source === "builtin"
            ? builtinAlgorithms.find((a) => a.id === form.algorithm.algorithmName)?.name || "Built-in"
            : form.algorithm.imageUri || "Custom Container",
        createdAt: Date.now(),
        priority: form.priority,
        status: "Pending",
        pendingUntil: Date.now() + 15000,
      };

      const persistenceResult = await persistPayload(payload, job);
      const serverMessage = persistenceResult.ok
        ? ` JSON stored locally as ${persistenceResult.filename}.`
        : " Local copy could not be saved (check logs).";
      setSubmitResult({
        ok: true,
        message: `Training job created.${serverMessage}`,
      });
      setReviewOpen(false);
      navigate({ pathname: LIST_ROUTE, search: location.search }, { replace: true });
    } catch (error) {
      console.error("Failed to submit job", error);
      setSubmitResult({ ok: false, message: "Unexpected error while creating job." });
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
              <p className="mt-3 text-lg text-slate-600 max-w-2xl">Configure and submit a new machine learning training job with customizable hyperparameters</p>
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
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-12">
          
          {/* Section 1: Basic Information */}
          <section>
            <div className="mb-6">
              <div className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full mb-3">
                STEP 1
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Basic Information</h2>
              <p className="mt-1 text-slate-600">Set the job name and execution priority</p>
            </div>
            
            <Card className="shadow-md border-blue-100 bg-gradient-to-br from-white to-blue-50/30 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
                <div>
                  <Label className="text-base font-semibold">Job Name</Label>
                  <div className="flex gap-3 mt-2">
                    <Input 
                      value={form.jobName} 
                      onChange={(e) => update("jobName", e.target.value)} 
                      placeholder="train-2025…"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => update("jobName", generateJobName("train"))}
                      className="whitespace-nowrap"
                    >
                      Generate
                    </Button>
                  </div>
                  {!JOB_NAME_REGEX.test(form.jobName || "") && (
                    <p className="text-sm text-red-600 mt-2">Must be lowercase alphanumerics and dashes; max 63 chars; cannot start/end with a dash.</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-base font-semibold">Priority</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={form.priority}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.min(1000, Math.max(1, raw)) : form.priority;
                      update("priority", next);
                    }}
                    className="mt-2"
                  />
                  <p className="text-sm text-slate-500 mt-2">Range: 1 (lowest) to 1000 (highest)</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 2: Algorithm */}
          <section>
            <div className="mb-6">
              <div className="inline-block px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-50 rounded-full mb-3">
                STEP 2
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Algorithm Selection</h2>
              <p className="mt-1 text-slate-600">Choose your machine learning algorithm</p>
            </div>

          <Card className="shadow-md border-purple-100 bg-gradient-to-br from-white to-purple-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-2">
                <Label className="text-base font-semibold">Source</Label>
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
                  className="flex flex-wrap gap-3"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="builtin" id="algorithm-source-builtin" />
                    <Label htmlFor="algorithm-source-builtin" className="font-medium cursor-pointer">
                      Built-in algorithm
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer">
                    <RadioGroupItem value="container" id="algorithm-source-container" />
                    <Label htmlFor="algorithm-source-container" className="font-medium cursor-pointer">
                      Custom container
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {form.algorithm.source === "builtin" ? (
                <div className="grid gap-2">
                  <Label>Built-in algorithm</Label>
                  <Select
                    value={form.algorithm.algorithmName}
                    onValueChange={(value) => updateAlgorithm({ algorithmName: value, imageUri: undefined })}
                  >
                    <SelectTrigger>
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
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Container image URI</Label>
                  <Input
                    value={form.algorithm.imageUri || ""}
                    onChange={(e) => updateAlgorithm({ imageUri: e.target.value, algorithmName: undefined })}
                    placeholder="registry.example.com/ml/training:latest"
                  />
                  <p className="text-xs text-slate-500">Provide a fully qualified container image URI.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {form.algorithm.source === "builtin" && activeAlgorithmId && (
            <Card className="shadow-sm mt-4">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Hyperparameters</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Fine-tune settings for {activeHyperparameterConfig?.label ?? "the selected algorithm"}
                    </p>
                  </div>
                  {HyperparameterFormComponent && (
                    <Button type="button" variant="outline" size="sm" onClick={() => resetHyperparameters(activeAlgorithmId)}>
                      Reset to defaults
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
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
            <Card className="shadow-sm mt-4 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
              <CardContent className="pt-6">
                <CustomHyperparametersEditor
                  value={form.customHyperparameters || {}}
                  onChange={updateCustomHyperparameters}
                />
              </CardContent>
            </Card>
          )}
          </section>

          {/* Section 3: Compute Resources */}
          <section>
            <div className="mb-6">
              <div className="inline-block px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full mb-3">
                STEP 3
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Compute Resources</h2>
              <p className="mt-1 text-slate-600">Allocate CPU, memory, GPU, and configure distributed training</p>
            </div>

          <Card className="shadow-md border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <Label className="text-base font-semibold">CPUs per instance</Label>
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
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold">Memory (GiB) per instance</Label>
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
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold">GPUs per instance</Label>
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
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label className="text-base font-semibold">Instance count</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.instanceCount}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.instanceCount;
                      updateResources({ instanceCount: next });
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold">Volume size (GiB)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.resources.volumeSizeGB}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : form.resources.volumeSizeGB;
                      updateResources({ volumeSizeGB: next });
                    }}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          </section>

          {/* Section 4: Data & Storage */}
          <section>
            <div className="mb-6">
              <div className="inline-block px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full mb-3">
                STEP 4
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Data & Storage</h2>
              <p className="mt-1 text-slate-600">Configure training datasets and output locations</p>
            </div>

          <Card className="shadow-md border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Input Channels</h3>
              <p className="text-sm text-slate-600 mb-6">Configure training datasets from object storage or file uploads</p>
              
              <div className="space-y-4">
              {form.inputDataConfig.length === 0 && (
                <p className="text-sm text-slate-600 py-8 text-center bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg border border-dashed border-indigo-200">No channels configured yet. Add at least one to continue.</p>
              )}
              {form.inputDataConfig.map((channel, idx) => (
                <div key={channel.id} className="rounded-lg border border-indigo-200/50 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-5 hover:border-indigo-300 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
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
                  <div className="bg-white rounded-md p-4">
                    <ChannelEditor
                      value={channel}
                      onChange={(next) => {
                        const nextChannels = [...form.inputDataConfig];
                        nextChannels[idx] = next;
                        update("inputDataConfig", nextChannels);
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" onClick={() => addChannel({ channelName: `channel-${form.inputDataConfig.length + 1}` })} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" /> Add channel
                </Button>
                <Button type="button" variant="outline" onClick={() => addChannel({ channelName: "validation" })} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-colors">
                  Quick add validation
                </Button>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-pink-100 bg-gradient-to-br from-white to-pink-50/30 hover:shadow-lg transition-shadow mt-6">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Stopping Condition</h3>
              <p className="text-sm text-slate-600 mb-6">Set maximum runtime limits to control training duration</p>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label className="text-base font-semibold">Hours</Label>
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
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-base font-semibold">Minutes</Label>
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
                    className="mt-2"
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-4">
                Total runtime limit: <span className="font-semibold">{Math.max(0, maxRuntimeHours)}h {Math.max(0, maxRuntimeMinutes)}m</span>
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-rose-100 bg-gradient-to-br from-white to-rose-50/30 hover:shadow-lg transition-shadow mt-6">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Output Configuration</h3>
              <p className="text-sm text-slate-600 mb-6">Specify where to save model artifacts, checkpoints, and logs</p>
              
              <div>
                <Label className="text-base font-semibold">Artifact URI</Label>
                <Input
                  value={form.outputDataConfig.artifactUri}
                  onChange={(e) => update("outputDataConfig", { artifactUri: e.target.value })}
                  placeholder="storage://output/artifacts/"
                  className="mt-2"
                />
                <p className="text-sm text-slate-500 mt-2">Provide a URI for an object store or shared filesystem where the job can write results.</p>
              </div>
            </CardContent>
          </Card>
          </section>
        </div>

        {/* Submit Section */}
        <div className="mt-12 sticky bottom-0 bg-gradient-to-r from-white via-slate-50 to-white border-t border-slate-200 shadow-lg backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              {errors.length > 0 ? (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-amber-600 text-xl font-bold">!</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {errors.length} validation issue{errors.length === 1 ? "" : "s"} found
                    </p>
                    <p className="text-sm text-slate-600">Please resolve all issues before submitting</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-emerald-600 text-xl font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Configuration complete</p>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{form.resources.instanceResources.cpuCores}</span> CPU ·{" "}
                      <span className="font-medium">{form.resources.instanceResources.memoryGiB}</span> GiB RAM ·{" "}
                      <span className="font-medium">{form.resources.instanceResources.gpuCount}</span> GPU ·{" "}
                      <span className="font-medium">{form.resources.instanceCount}</span> instance{form.resources.instanceCount > 1 ? "s" : ""} ·{" "}
                      <span className="font-medium">{form.resources.volumeSizeGB}</span> GiB storage
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={errors.length > 0} 
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8"
                  >
                    <FileJson2 className="mr-2 h-5 w-5" /> 
                    Review &amp; Submit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Review Job Configuration</DialogTitle>
                  </DialogHeader>
                <div className="space-y-6">
                  {errors.length > 0 && (
                    <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50 shadow-sm">
                      <CardContent className="pt-6">
                        <p className="text-base font-semibold text-red-900 mb-3">Please resolve the following:</p>
                        <ul className="list-disc ml-5 space-y-1 text-red-700 text-sm">
                          {errors.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-4">
                    <pre className="text-xs overflow-auto max-h-96 text-slate-700">
{JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(JSON.stringify(payload, null, 2))} className="border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors">
                      <Copy className="mr-2 h-4 w-4" /> Copy JSON
                    </Button>
                    <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all">
                      {submitting ? "Submitting…" : "Submit"}
                    </Button>
                  </div>
                  {submitResult && (
                    <div className={`p-4 rounded-lg ${submitResult.ok ? "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200" : "bg-gradient-to-br from-red-50 to-rose-50 border border-red-200"}`}>
                      <p className={`text-sm font-semibold ${submitResult.ok ? "text-emerald-700" : "text-red-700"}`}>{submitResult.message}</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
