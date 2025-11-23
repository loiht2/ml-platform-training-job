import type { FC } from "react";
import { useState, useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

import type { HyperparameterConfig, HyperparameterFormProps } from "./types";

const boosterOptions = [
  { value: "gbtree", label: "Tree booster (gbtree)" },
  { value: "gblinear", label: "Linear booster (gblinear)" },
  { value: "dart", label: "Dropout trees (dart)" },
] as const;

type BoosterOption = (typeof boosterOptions)[number]["value"];

type VerbosityLevel = 0 | 1 | 2 | 3;

const samplingMethodOptions = [
  { value: "uniform", label: "Uniform sampling" },
  { value: "gradient_based", label: "Gradient-based sampling" },
] as const;

type SamplingMethod = (typeof samplingMethodOptions)[number]["value"];

const treeMethodOptions = [
  { value: "auto", label: "Auto" },
  { value: "exact", label: "Exact" },
  { value: "approx", label: "Approximate" },
  { value: "hist", label: "Histogram" },
] as const;

type TreeMethod = (typeof treeMethodOptions)[number]["value"];

type UpdaterOption = TreeMethod;

const dsplitOptions = [
  { value: "row", label: "Row" },
  { value: "col", label: "Column" },
] as const;

type DSplitOption = (typeof dsplitOptions)[number]["value"];

const processTypeOptions = [
  { value: "default", label: "Default" },
  { value: "update", label: "Update" },
] as const;

type ProcessType = (typeof processTypeOptions)[number]["value"];

const growPolicyOptions = [
  { value: "depthwise", label: "Depth-wise" },
  { value: "lossguide", label: "Loss-guide" },
] as const;

type GrowPolicy = (typeof growPolicyOptions)[number]["value"];

const sampleTypeOptions = [
  { value: "uniform", label: "Uniform" },
  { value: "weighted", label: "Weighted" },
] as const;

type SampleType = (typeof sampleTypeOptions)[number]["value"];

const normalizeTypeOptions = [
  { value: "tree", label: "Tree" },
  { value: "forest", label: "Forest" },
] as const;

type NormalizeType = (typeof normalizeTypeOptions)[number]["value"];

const objectiveOptions = [
  { value: "reg:squarederror", label: "reg:squarederror – L2 regression" },
  { value: "reg:squaredlogerror", label: "reg:squaredlogerror" },
  { value: "reg:logistic", label: "reg:logistic – Logistic regression" },
  { value: "reg:pseudohubererror", label: "reg:pseudohubererror" },
  { value: "reg:absoluteerror", label: "reg:absoluteerror – L1 regression" },
  { value: "reg:quantileerror", label: "reg:quantileerror" },
  { value: "binary:logistic", label: "binary:logistic" },
  { value: "binary:logitraw", label: "binary:logitraw" },
  { value: "binary:hinge", label: "binary:hinge" },
  { value: "count:poisson", label: "count:poisson" },
  { value: "survival:cox", label: "survival:cox" },
  { value: "survival:aft", label: "survival:aft" },
  { value: "multi:softmax", label: "multi:softmax" },
  { value: "multi:softprob", label: "multi:softprob" },
  { value: "rank:ndcg", label: "rank:ndcg" },
  { value: "rank:map", label: "rank:map" },
  { value: "rank:pairwise", label: "rank:pairwise" },
  { value: "reg:gamma", label: "reg:gamma" },
  { value: "reg:tweedie", label: "reg:tweedie" },
] as const;

type ObjectiveOption = (typeof objectiveOptions)[number]["value"];

const evalMetricOptions = [
  { value: "rmse", label: "rmse" },
  { value: "rmsle", label: "rmsle" },
  { value: "mae", label: "mae" },
  { value: "mape", label: "mape" },
  { value: "mphe", label: "mphe" },
  { value: "logloss", label: "logloss" },
  { value: "error", label: "error" },
  { value: "error@t", label: "error@t" },
  { value: "merror", label: "merror" },
  { value: "mlogloss", label: "mlogloss" },
  { value: "auc", label: "auc" },
  { value: "aucpr", label: "aucpr" },
  { value: "pre", label: "pre" },
  { value: "ndcg", label: "ndcg" },
  { value: "map", label: "map" },
  { value: "poisson-nloglik", label: "poisson-nloglik" },
  { value: "gamma-nloglik", label: "gamma-nloglik" },
  { value: "cox-nloglik", label: "cox-nloglik" },
  { value: "gamma-deviance", label: "gamma-deviance" },
  { value: "tweedie-nloglik", label: "tweedie-nloglik" },
  { value: "aft-nloglik", label: "aft-nloglik" },
  { value: "interval-regression-accuracy", label: "interval-regression-accuracy" },
] as const;

type EvalMetricOption = (typeof evalMetricOptions)[number]["value"];

export type XGBoostHyperparameters = {
  early_stopping_rounds: number | null;
  csv_weights: 0 | 1;
  num_round: number;
  booster: BoosterOption;
  verbosity: VerbosityLevel;
  nthread: number | "auto";
  eta: number;
  gamma: number;
  max_depth: number;
  min_child_weight: number;
  max_delta_step: number;
  subsample: number;
  sampling_method: SamplingMethod;
  colsample_bytree: number;
  colsample_bylevel: number;
  colsample_bynode: number;
  lambda: number;
  alpha: number;
  tree_method: TreeMethod;
  sketch_eps: number;
  scale_pos_weight: number;
  updater: UpdaterOption;
  dsplit: DSplitOption;
  refresh_leaf: 0 | 1;
  process_type: ProcessType;
  grow_policy: GrowPolicy;
  max_leaves: number;
  max_bin: number;
  num_parallel_tree: number;
  sample_type: SampleType;
  normalize_type: NormalizeType;
  rate_drop: number;
  one_drop: 0 | 1;
  skip_drop: number;
  lambda_bias: number;
  tweedie_variance_power: number;
  objective: ObjectiveOption;
  base_score: number;
  eval_metric: EvalMetricOption[];
};

export const DEFAULT_XGBOOST_HYPERPARAMETERS: XGBoostHyperparameters = {
  early_stopping_rounds: null,
  csv_weights: 0,
  num_round: 300,
  booster: "gbtree",
  verbosity: 1,
  nthread: "auto",
  eta: 0.3,
  gamma: 0,
  max_depth: 6,
  min_child_weight: 1,
  max_delta_step: 0,
  subsample: 1,
  sampling_method: "uniform",
  colsample_bytree: 1,
  colsample_bylevel: 1,
  colsample_bynode: 1,
  lambda: 1,
  alpha: 0,
  tree_method: "auto",
  sketch_eps: 0.03,
  scale_pos_weight: 1,
  updater: "auto",
  dsplit: "row",
  refresh_leaf: 1,
  process_type: "default",
  grow_policy: "depthwise",
  max_leaves: 0,
  max_bin: 256,
  num_parallel_tree: 1,
  sample_type: "uniform",
  normalize_type: "tree",
  rate_drop: 0,
  one_drop: 0,
  skip_drop: 0,
  lambda_bias: 0,
  tweedie_variance_power: 1.5,
  objective: "reg:squarederror",
  base_score: 0.5,
  eval_metric: ["rmse"],
};

type NumericKeys = {
  [K in keyof XGBoostHyperparameters]: XGBoostHyperparameters[K] extends number | null ? K : never;
}[keyof XGBoostHyperparameters];

function clampNumber(raw: string, fallback: number | null, options?: { min?: number; max?: number; allowNull?: boolean; isInteger?: boolean }) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return options?.allowNull ? null : fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  const { min = -Infinity, max = Infinity, isInteger = false } = options ?? {};
  const clamped = Math.min(max, Math.max(min, parsed));
  return isInteger ? Math.round(clamped) : clamped;
}

export const XGBoostHyperparametersForm: FC<HyperparameterFormProps<XGBoostHyperparameters>> = ({ value, onChange, disabled }) => {
  const current: XGBoostHyperparameters = {
    ...DEFAULT_XGBOOST_HYPERPARAMETERS,
    ...value,
    eval_metric: [...(value?.eval_metric ?? DEFAULT_XGBOOST_HYPERPARAMETERS.eval_metric)],
  };

  function updateValue<K extends keyof XGBoostHyperparameters>(key: K, nextValue: XGBoostHyperparameters[K]) {
    onChange({
      ...current,
      [key]: nextValue,
    });
  }

  function updateNumber<K extends NumericKeys>(key: K, rawValue: string, options?: { min?: number; max?: number; allowNull?: boolean; isInteger?: boolean }) {
    const fallbackValue = (current[key] ?? DEFAULT_XGBOOST_HYPERPARAMETERS[key]) as number | null;
    const nextValue = clampNumber(rawValue, fallbackValue, options);
    updateValue(key, nextValue as XGBoostHyperparameters[K]);
  }

  function toggleEvalMetric(metric: EvalMetricOption) {
    const next = current.eval_metric.includes(metric)
      ? current.eval_metric.filter((item) => item !== metric)
      : [...current.eval_metric, metric];
    updateValue("eval_metric", next);
  }

  const threadMode = current.nthread === "auto" ? "auto" : "manual";
  const manualThreadValue = typeof current.nthread === "number" ? current.nthread : 4;

  // State for searchable dropdowns
  const [evalMetricSearch, setEvalMetricSearch] = useState("");
  const [evalMetricOpen, setEvalMetricOpen] = useState(false);
  const evalMetricDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (evalMetricDropdownRef.current && !evalMetricDropdownRef.current.contains(event.target as Node)) {
        setEvalMetricOpen(false);
      }
    }
    if (evalMetricOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [evalMetricOpen]);

  const filteredEvalMetrics = evalMetricOptions.filter(option =>
    option.label.toLowerCase().includes(evalMetricSearch.toLowerCase())
  );

  return (
    <div className="grid gap-y-3 gap-x-20 md:grid-cols-2">
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-num-round" className="text-sm">Boosting rounds (num_round)</Label>
        <Input
          id="xgb-num-round"
          type="number"
          min={1}
          step={1}
          value={typeof current.num_round === "number" ? current.num_round : DEFAULT_XGBOOST_HYPERPARAMETERS.num_round}
          onChange={(event) => updateNumber("num_round", event.target.value, { min: 1, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-early-stop" className="text-sm">Early stopping rounds</Label>
        <Input
          id="xgb-early-stop"
          type="number"
          min={0}
          step={1}
          value={current.early_stopping_rounds ?? ""}
          onChange={(event) => updateNumber("early_stopping_rounds", event.target.value, { min: 0, allowNull: true, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-booster" className="text-sm">Booster</Label>
        <Select value={current.booster} onValueChange={(next) => updateValue("booster", next as BoosterOption)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue placeholder="Choose booster" />
          </SelectTrigger>
          <SelectContent>
            {boosterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-verbosity" className="text-sm">Verbosity</Label>
        <Select value={String(current.verbosity)} onValueChange={(next) => updateValue("verbosity", Number(next) as VerbosityLevel)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue placeholder="Select logging level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 – Silent</SelectItem>
            <SelectItem value="1">1 – Warning</SelectItem>
            <SelectItem value="2">2 – Info</SelectItem>
            <SelectItem value="3">3 – Debug</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-csv-weights">CSV sample weights</Label>
        <Select value={String(current.csv_weights)} onValueChange={(next) => updateValue("csv_weights", Number(next) as 0 | 1)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue placeholder="Use weights" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 – Ignore CSV weights</SelectItem>
            <SelectItem value="1">1 – Use last column as weights</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="w-44 flex-shrink-0">CPU threads (nthread)</Label>
        <div className="flex flex-1 items-center gap-1.5">
          <Select value={threadMode} onValueChange={(mode) => updateValue("nthread", mode === "auto" ? "auto" : manualThreadValue)} disabled={disabled}>
            <SelectTrigger className="w-full justify-between">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            step={1}
            value={threadMode === "manual" ? manualThreadValue : ""}
            onChange={(event) => {
              const nextThreads = clampNumber(event.target.value, manualThreadValue, { min: 1, isInteger: true }) ?? manualThreadValue;
              updateValue("nthread", nextThreads as number);
            }}
            disabled={disabled || threadMode === "auto"}
            placeholder="Auto"
          />
        </div>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-base-score">Base score</Label>
        <Input
          id="xgb-base-score"
          type="number"
          step={0.01}
          value={current.base_score}
          onChange={(event) => updateNumber("base_score", event.target.value, { min: -10, max: 10 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-scale-pos">Scale positive weight</Label>
        <Input
          id="xgb-scale-pos"
          type="number"
          min={0}
          step={0.1}
          value={current.scale_pos_weight}
          onChange={(event) => updateNumber("scale_pos_weight", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-eta" className="text-sm">Learning rate (eta)</Label>
        <Input
          id="xgb-eta"
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={current.eta}
          onChange={(event) => updateNumber("eta", event.target.value, { min: 0, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-gamma" className="text-sm">Min split loss (gamma)</Label>
        <Input
          id="xgb-gamma"
          type="number"
          min={0}
          step={0.1}
          value={current.gamma}
          onChange={(event) => updateNumber("gamma", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-max-depth" className="text-sm">Max depth</Label>
        <Input
          id="xgb-max-depth"
          type="number"
          min={0}
          step={1}
          value={current.max_depth}
          onChange={(event) => updateNumber("max_depth", event.target.value, { min: 0, max: 1024, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-min-child" className="text-sm">Min child weight</Label>
        <Input
          id="xgb-min-child"
          type="number"
          min={0}
          step={0.1}
          value={current.min_child_weight}
          onChange={(event) => updateNumber("min_child_weight", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-max-delta" className="text-sm">Max delta step</Label>
        <Input
          id="xgb-max-delta"
          type="number"
          min={0}
          step={0.1}
          value={current.max_delta_step}
          onChange={(event) => updateNumber("max_delta_step", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-subsample">Subsample</Label>
        <Input
          id="xgb-subsample"
          type="number"
          min={0.1}
          max={1}
          step={0.05}
          value={current.subsample}
          onChange={(event) => updateNumber("subsample", event.target.value, { min: 0.1, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-sampling-method">Sampling method</Label>
        <Select value={current.sampling_method} onValueChange={(next) => updateValue("sampling_method", next as SamplingMethod)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {samplingMethodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-colsample-tree">Colsample by tree</Label>
        <Input
          id="xgb-colsample-tree"
          type="number"
          min={0.1}
          max={1}
          step={0.05}
          value={current.colsample_bytree}
          onChange={(event) => updateNumber("colsample_bytree", event.target.value, { min: 0.1, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-colsample-level">Colsample by level</Label>
        <Input
          id="xgb-colsample-level"
          type="number"
          min={0.1}
          max={1}
          step={0.05}
          value={current.colsample_bylevel}
          onChange={(event) => updateNumber("colsample_bylevel", event.target.value, { min: 0.1, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-colsample-node">Colsample by node</Label>
        <Input
          id="xgb-colsample-node"
          type="number"
          min={0.1}
          max={1}
          step={0.05}
          value={current.colsample_bynode}
          onChange={(event) => updateNumber("colsample_bynode", event.target.value, { min: 0.1, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-sketch-eps">Sketch epsilon</Label>
        <Input
          id="xgb-sketch-eps"
          type="number"
          min={0}
          step={0.01}
          value={current.sketch_eps}
          onChange={(event) => updateNumber("sketch_eps", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-lambda">Lambda (L2)</Label>
        <Input
          id="xgb-lambda"
          type="number"
          min={0}
          step={0.1}
          value={current.lambda}
          onChange={(event) => updateNumber("lambda", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-alpha">Alpha (L1)</Label>
        <Input
          id="xgb-alpha"
          type="number"
          min={0}
          step={0.1}
          value={current.alpha}
          onChange={(event) => updateNumber("alpha", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-lambda-bias">Lambda bias</Label>
        <Input
          id="xgb-lambda-bias"
          type="number"
          min={0}
          step={0.1}
          value={current.lambda_bias}
          onChange={(event) => updateNumber("lambda_bias", event.target.value, { min: 0 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-tree-method">Tree method</Label>
        <Select value={current.tree_method} onValueChange={(next) => updateValue("tree_method", next as TreeMethod)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {treeMethodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-updater">Updater sequence</Label>
        <Select value={current.updater} onValueChange={(next) => updateValue("updater", next as UpdaterOption)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {treeMethodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-dsplit">Data split (dsplit)</Label>
        <Select value={current.dsplit} onValueChange={(next) => updateValue("dsplit", next as DSplitOption)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dsplitOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-refresh-leaf">Refresh leaf stats</Label>
        <Select value={String(current.refresh_leaf)} onValueChange={(next) => updateValue("refresh_leaf", Number(next) as 0 | 1)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 – Refresh leaf & nodes</SelectItem>
            <SelectItem value="0">0 – Refresh nodes only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-process-type">Process type</Label>
        <Select value={current.process_type} onValueChange={(next) => updateValue("process_type", next as ProcessType)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {processTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-grow-policy">Grow policy</Label>
        <Select value={current.grow_policy} onValueChange={(next) => updateValue("grow_policy", next as GrowPolicy)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {growPolicyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-max-leaves">Max leaves</Label>
        <Input
          id="xgb-max-leaves"
          type="number"
          min={0}
          step={1}
          value={current.max_leaves}
          onChange={(event) => updateNumber("max_leaves", event.target.value, { min: 0, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-max-bin">Max bin</Label>
        <Input
          id="xgb-max-bin"
          type="number"
          min={2}
          step={1}
          value={current.max_bin}
          onChange={(event) => updateNumber("max_bin", event.target.value, { min: 2, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-num-parallel">Num parallel tree</Label>
        <Input
          id="xgb-num-parallel"
          type="number"
          min={1}
          step={1}
          value={current.num_parallel_tree}
          onChange={(event) => updateNumber("num_parallel_tree", event.target.value, { min: 1, isInteger: true })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-sample-type">Sample type</Label>
        <Select value={current.sample_type} onValueChange={(next) => updateValue("sample_type", next as SampleType)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sampleTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-normalize-type">Normalize type</Label>
        <Select value={current.normalize_type} onValueChange={(next) => updateValue("normalize_type", next as NormalizeType)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {normalizeTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-rate-drop">Rate drop</Label>
        <Input
          id="xgb-rate-drop"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={current.rate_drop}
          onChange={(event) => updateNumber("rate_drop", event.target.value, { min: 0, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-one-drop">One drop</Label>
        <Select value={String(current.one_drop)} onValueChange={(next) => updateValue("one_drop", Number(next) as 0 | 1)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 – Allow zero drops</SelectItem>
            <SelectItem value="1">1 – Drop at least one tree</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-skip-drop">Skip drop</Label>
        <Input
          id="xgb-skip-drop"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={current.skip_drop}
          onChange={(event) => updateNumber("skip_drop", event.target.value, { min: 0, max: 1 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-tweedie">Tweedie variance power</Label>
        <Input
          id="xgb-tweedie"
          type="number"
          min={1.01}
          max={1.99}
          step={0.01}
          value={current.tweedie_variance_power}
          onChange={(event) => updateNumber("tweedie_variance_power", event.target.value, { min: 1.01, max: 1.99 })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-1.5 justify-items-start items-center">
        <Label htmlFor="xgb-objective" className="text-sm">Objective</Label>
        <Select value={current.objective} onValueChange={(next) => updateValue("objective", next as ObjectiveOption)} disabled={disabled}>
          <SelectTrigger className="w-full justify-between">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {objectiveOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="w-44 flex-shrink-0 text-sm">Evaluation metrics</Label>
        <div className="relative flex-1" ref={evalMetricDropdownRef}>
          <div
            className="flex min-h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer"
            onClick={() => setEvalMetricOpen(!evalMetricOpen)}
          >
            <span className={current.eval_metric.length === 0 ? "text-slate-400" : ""}>
              {current.eval_metric.length === 0 ? "Select metrics" : `${current.eval_metric.length} selected`}
            </span>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.18179 6.18181C4.35753 6.00608 4.64245 6.00608 4.81819 6.18181L7.49999 8.86362L10.1818 6.18181C10.3575 6.00608 10.6424 6.00608 10.8182 6.18181C10.9939 6.35755 10.9939 6.64247 10.8182 6.81821L7.81819 9.81821C7.73379 9.9026 7.61933 9.95001 7.49999 9.95001C7.38064 9.95001 7.26618 9.9026 7.18179 9.81821L4.18179 6.81821C4.00605 6.64247 4.00605 6.35755 4.18179 6.18181Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
            </svg>
          </div>
          {evalMetricOpen && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-white shadow-lg">
              <div className="border-b p-2">
                <Input
                  placeholder="Search metrics..."
                  value={evalMetricSearch}
                  onChange={(e) => setEvalMetricSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filteredEvalMetrics.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500">No metrics found</div>
                ) : (
                  filteredEvalMetrics.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100"
                      onClick={() => {
                        toggleEvalMetric(option.value);
                        setEvalMetricOpen(false);
                      }}
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded border border-slate-300">
                        {current.eval_metric.includes(option.value) && (
                          <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span>{option.label}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {current.eval_metric.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {current.eval_metric.map((metric) => (
                <Badge key={metric} variant="secondary" className="flex items-center gap-1 pl-2 pr-1">
                  <span>{metric}</span>
                  <button
                    type="button"
                    onClick={() => toggleEvalMetric(metric)}
                    disabled={disabled}
                    className="ml-1 rounded-sm hover:bg-sky-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const XGBOOST_HYPERPARAMETER_CONFIG: HyperparameterConfig<XGBoostHyperparameters> = {
  id: "xgboost",
  label: "XGBoost",
  Form: XGBoostHyperparametersForm,
  defaultValues: DEFAULT_XGBOOST_HYPERPARAMETERS,
};
