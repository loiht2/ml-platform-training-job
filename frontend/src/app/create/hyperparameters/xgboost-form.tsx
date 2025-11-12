import type { FC } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Training strategy</p>
          <p className="text-xs text-slate-500">Control overall training length, logging, and resource usage.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="xgb-num-round">Boosting rounds (num_round)</Label>
            <Input
              id="xgb-num-round"
              type="number"
              min={1}
              step={1}
              value={typeof current.num_round === "number" ? current.num_round : DEFAULT_XGBOOST_HYPERPARAMETERS.num_round}
              onChange={(event) => updateNumber("num_round", event.target.value, { min: 1, isInteger: true })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Number of boosting iterations. Monitor validation metrics to avoid overfitting.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-early-stop">Early stopping rounds</Label>
            <Input
              id="xgb-early-stop"
              type="number"
              min={0}
              step={1}
              value={current.early_stopping_rounds ?? ""}
              onChange={(event) => updateNumber("early_stopping_rounds", event.target.value, { min: 0, allowNull: true, isInteger: true })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Stop training when the validation metric fails to improve for N rounds (leave blank to disable).</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-booster">Booster</Label>
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
            <p className="text-xs text-slate-500">Choose tree-based, linear, or dropout-based boosting.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-verbosity">Verbosity</Label>
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
            <p className="text-xs text-slate-500">Controls the amount of logging emitted during training.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Enable if the last CSV column supplies sample weights.</p>
          </div>
          <div className="grid gap-2">
            <Label>CPU threads (nthread)</Label>
            <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Set manual CPU thread count or leave on auto to follow runtime defaults.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-base-score">Base score</Label>
            <Input
              id="xgb-base-score"
              type="number"
              step={0.01}
              value={current.base_score}
              onChange={(event) => updateNumber("base_score", event.target.value, { min: -10, max: 10 })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Initial prediction bias before any boosting round.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Balances positive and negative classes for imbalanced datasets.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Learning rate & tree constraints</p>
          <p className="text-xs text-slate-500">Control shrinkage, depth, and node formation thresholds.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="xgb-eta">Learning rate (eta)</Label>
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
            <p className="text-xs text-slate-500">Step size shrinkage; lower values train slower but reduce overfitting risk.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-gamma">Min split loss (gamma)</Label>
            <Input
              id="xgb-gamma"
              type="number"
              min={0}
              step={0.1}
              value={current.gamma}
              onChange={(event) => updateNumber("gamma", event.target.value, { min: 0 })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Minimum loss reduction required to make a further partition on a leaf node.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-max-depth">Max depth</Label>
            <Input
              id="xgb-max-depth"
              type="number"
              min={0}
              step={1}
              value={current.max_depth}
              onChange={(event) => updateNumber("max_depth", event.target.value, { min: 0, max: 1024, isInteger: true })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Upper bound on tree depth. Higher values capture complex interactions but may overfit.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-min-child">Min child weight</Label>
            <Input
              id="xgb-min-child"
              type="number"
              min={0}
              step={0.1}
              value={current.min_child_weight}
              onChange={(event) => updateNumber("min_child_weight", event.target.value, { min: 0 })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Minimum sum of instance weights (Hessian) needed in a child node.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="xgb-max-delta">Max delta step</Label>
            <Input
              id="xgb-max-delta"
              type="number"
              min={0}
              step={0.1}
              value={current.max_delta_step}
              onChange={(event) => updateNumber("max_delta_step", event.target.value, { min: 0 })}
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">Limits the maximum weight change for each tree leaf. Useful for logistic objectives.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Sampling & column usage</p>
          <p className="text-xs text-slate-500">Control how rows and columns are sampled before building trees.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Fraction of rows used per boosting round. Lower values add randomness.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Choose uniform or gradient-based sampling (histogram tree method only).</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Fraction of features sampled for each tree.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Feature subsampling applied for each tree level.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Feature subsampling before each split candidate.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Approximation accuracy for histogram building.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Regularization & process settings</p>
          <p className="text-xs text-slate-500">Fine tune penalties, tree construction algorithms, and growth policies.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">L2 regularization on leaf weights.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">L1 regularization on leaf weights.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">L2 regularization for the model bias term.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Algorithm used to build trees.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Explicit sequence of tree updaters.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Choose row or column split mode for distributed training.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Control whether both leaf and node statistics are refreshed.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Create new trees or update existing ones.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Choose depth-wise or loss-guided growth.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Upper bound on the number of leaves; only used with lossguide.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Number of bins used for histogram-based splits.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Number of trees built in parallel (useful for random forest style models).</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">DART & advanced controls</p>
          <p className="text-xs text-slate-500">Fine tune dropout behavior and Tweedie-specific settings.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">DART: choose uniform or weighted sampling when dropping trees.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">DART weight normalization method.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Dropout rate for DART trees.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Guarantee that at least one tree is dropped each DART round.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Probability of skipping dropout during a boosting iteration.</p>
          </div>
          <div className="grid gap-2">
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
            <p className="text-xs text-slate-500">Controls the variance of Tweedie regression objectives.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Objective & evaluation</p>
          <p className="text-xs text-slate-500">Select the learning objective and the metrics to watch.</p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="xgb-objective">Objective</Label>
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
            <p className="text-xs text-slate-500">Learning task and loss function.</p>
          </div>
          <div className="grid gap-2">
            <Label>Evaluation metrics</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {evalMetricOptions.map((metric) => {
                const id = `xgb-metric-${metric.value.replace(/[^a-z0-9]+/gi, "-")}`;
                const checked = current.eval_metric.includes(metric.value);
                return (
                  <label key={metric.value} htmlFor={id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      checked={checked}
                      onChange={() => toggleEvalMetric(metric.value)}
                      disabled={disabled}
                    />
                    <span className="capitalize">{metric.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">Select one or more metrics to monitor during training.</p>
          </div>
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
