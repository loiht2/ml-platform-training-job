import type { JobPayload } from '@/types/training-job';
import type { BackendTrainingJobRequest } from './api-service';

/**
 * Converts frontend JobPayload to NEW backend API request format (v2)
 */
export function convertToBackendRequest(
  payload: JobPayload,
  selectedClusters: string[] = []
): BackendTrainingJobRequest {
  const algorithmName = payload.algorithm.algorithmName || 'xgboost';
  
  // Convert hyperparameters to the backend format
  const hyperparameters: any = {};
  
  // Extract XGBoost hyperparameters if they exist
  if (payload.hyperparameters?.xgboost) {
    const xgb = payload.hyperparameters.xgboost;
    hyperparameters.xgboost = {
      early_stopping_rounds: xgb.early_stopping_rounds === 'null' || xgb.early_stopping_rounds === null ? null : Number(xgb.early_stopping_rounds),
      csv_weights: Number(xgb.csv_weights || 0),
      num_round: Number(xgb.num_round || 100),
      booster: String(xgb.booster || 'gbtree'),
      verbosity: Number(xgb.verbosity || 1),
      nthread: String(xgb.nthread || 'auto'),
      eta: Number(xgb.eta || 0.3),
      gamma: Number(xgb.gamma || 0),
      max_depth: Number(xgb.max_depth || 6),
      min_child_weight: Number(xgb.min_child_weight || 1),
      max_delta_step: Number(xgb.max_delta_step || 0),
      subsample: Number(xgb.subsample || 1),
      sampling_method: String(xgb.sampling_method || 'uniform'),
      colsample_bytree: Number(xgb.colsample_bytree || 1),
      colsample_bylevel: Number(xgb.colsample_bylevel || 1),
      colsample_bynode: Number(xgb.colsample_bynode || 1),
      lambda: Number(xgb.lambda || 1),
      alpha: Number(xgb.alpha || 0),
      tree_method: String(xgb.tree_method || 'auto'),
      sketch_eps: Number(xgb.sketch_eps || 0.03),
      scale_pos_weight: Number(xgb.scale_pos_weight || 1),
      updater: String(xgb.updater || 'auto'),
      dsplit: String(xgb.dsplit || 'row'),
      refresh_leaf: Number(xgb.refresh_leaf || 1),
      process_type: String(xgb.process_type || 'default'),
      grow_policy: String(xgb.grow_policy || 'depthwise'),
      max_leaves: Number(xgb.max_leaves || 0),
      max_bin: Number(xgb.max_bin || 256),
      num_parallel_tree: Number(xgb.num_parallel_tree || 1),
      sample_type: String(xgb.sample_type || 'uniform'),
      normalize_type: String(xgb.normalize_type || 'tree'),
      rate_drop: Number(xgb.rate_drop || 0),
      one_drop: Number(xgb.one_drop || 0),
      skip_drop: Number(xgb.skip_drop || 0),
      lambda_bias: Number(xgb.lambda_bias || 0),
      tweedie_variance_power: Number(xgb.tweedie_variance_power || 1.5),
      objective: String(xgb.objective || 'reg:squarederror'),
      base_score: Number(xgb.base_score || 0.5),
      eval_metric: Array.isArray(xgb.eval_metric) 
        ? xgb.eval_metric 
        : typeof xgb.eval_metric === 'string' 
          ? [xgb.eval_metric] 
          : ['rmse']
    };
  }
  
  // Build inputDataConfig
  const inputDataConfig = (payload.inputDataConfig || []).map(channel => ({
    id: channel.id || `channel-${Math.random().toString(36).substr(2, 9)}`,
    channelName: channel.channelName || 'train',
    sourceType: channel.sourceType || 'object-storage',
    storageProvider: channel.storageProvider || 'minio',
    endpoint: channel.endpoint || 'http://minio:9000',
    bucket: channel.bucket || 'datasets',
    prefix: channel.prefix || ''
  }));
  
  // Build the NEW backend request format
  return {
    jobName: payload.jobName,
    priority: payload.priority || 100,
    algorithm: {
      source: payload.algorithm.source || 'builtin',
      algorithmName: algorithmName
    },
    resources: {
      instanceResources: {
        cpuCores: payload.resources.instanceResources.cpuCores,
        memoryGiB: payload.resources.instanceResources.memoryGiB,
        gpuCount: payload.resources.instanceResources.gpuCount
      },
      instanceCount: payload.resources.instanceCount,
      volumeSizeGB: payload.resources.volumeSizeGB || 50
    },
    stoppingCondition: {
      maxRuntimeSeconds: payload.stoppingCondition?.maxRuntimeSeconds || 14400
    },
    inputDataConfig,
    outputDataConfig: {
      artifactUri: payload.outputDataConfig?.artifactUri || 'storage://output/artifacts/'
    },
    hyperparameters,
    customHyperparameters: payload.customHyperparameters || {},
    targetClusters: selectedClusters.length > 0 ? selectedClusters : [],
    namespace: 'default'
  };
}



/**
 * Converts backend response to frontend StoredJob format
 */
export function convertFromBackendResponse(
  response: any
): {
  id: string;
  algorithm: string;
  createdAt: number;
  priority: number;
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed';
} {
  // Map backend status to frontend status
  const statusMap: Record<string, 'Pending' | 'Running' | 'Succeeded' | 'Failed'> = {
    Pending: 'Pending',
    Running: 'Running',
    Succeeded: 'Succeeded',
    Failed: 'Failed',
    Completed: 'Succeeded',
    Error: 'Failed',
  };
  
  return {
    id: response.id,
    algorithm: response.algorithm || response.jobName || 'unknown',
    createdAt: new Date(response.createdAt).getTime(),
    priority: response.priority || 100,
    status: statusMap[response.status] || 'Pending',
  };
}
