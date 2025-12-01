import type { JobPayload } from '@/types/training-job';
import type { BackendTrainingJobRequest } from './api-service';

/**
 * Converts frontend JobPayload to NEW backend API request format (v2)
 * Updated to match new JSON format with input/output structure
 */
export function convertToBackendRequest(
  payload: JobPayload,
  namespace?: string
): BackendTrainingJobRequest {
  const algorithmName = payload.algorithm.algorithmName || 'xgboost';
  const currentNamespace = namespace || 'kubeflow-user-example-com';
  
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
  
  // Build input array (new format)
  const input = (payload.inputDataConfig || []).map(channel => {
    const baseInput: any = {
      channelName: channel.channelName || 'train',
      channelType: channel.channelType || 'train',
      sourceType: channel.sourceType || 'object-storage',
      storageProvider: channel.storageProvider || 'minio',
      endpoint: channel.endpoint || 'http://minio.minio-system.svc.cluster.local:9000',
      bucket: channel.bucket || currentNamespace,
      path: channel.prefix || `training-data/${channel.channelType || 'train'}/${channel.uploadFileName || 'data'}`,
    };
    
    // Add upload-specific fields if sourceType is upload
    if (channel.sourceType === 'upload') {
      if (channel.featureNames && channel.featureNames.length > 0) {
        baseInput.featureNames = channel.featureNames;
      }
      if (channel.labelName) {
        baseInput.labelName = channel.labelName;
      }
      if (channel.uploadFileName) {
        baseInput.uploadFileName = channel.uploadFileName;
      }
    }
    
    return baseInput;
  });
  
  // Build output object (new format)
  const output: any = {
    storageProvider: payload.outputDataConfig?.storageProvider || 'minio',
    bucket: payload.outputDataConfig?.bucket || currentNamespace,
    path: payload.outputDataConfig?.prefix || `output/${payload.jobName}`,
    endpoint: payload.outputDataConfig?.endpoint || 'http://minio.minio-system.svc.cluster.local:9000',
  };
  
  // Build checkpoint object if enabled (new format)
  let checkpoint: any = undefined;
  if (payload.checkpointConfig?.enabled) {
    checkpoint = {
      storageProvider: payload.checkpointConfig.storageProvider || 'minio',
      bucket: payload.checkpointConfig.bucket || currentNamespace,
      path: payload.checkpointConfig.prefix || `checkpoint/${payload.jobName}`,
      endpoint: payload.checkpointConfig.endpoint || 'http://minio.minio-system.svc.cluster.local:9000',
    };
  }

  // Build the NEW backend request format
  const request: any = {
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
    input,
    output,
    hyperparameters,
    customHyperparameters: payload.customHyperparameters || {},
    currentNamespace: currentNamespace
  };
  
  // Add checkpoint if enabled
  if (checkpoint) {
    request.checkpoint = checkpoint;
  }
  
  return request;
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
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Stopped';
  jobStatus?: string;
  deploymentStatus?: string;
  startTime?: string;
  endTime?: string;
} {
  // Map backend status to frontend status
  const statusMap: Record<string, 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Stopped'> = {
    Pending: 'Pending',
    Running: 'Running',
    Succeeded: 'Succeeded',
    Failed: 'Failed',
    Stopped: 'Stopped',
    Completed: 'Succeeded',
    Error: 'Failed',
    RUNNING: 'Running',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
    STOPPED: 'Stopped',
    PENDING: 'Pending',
  };
  
  // Use jobStatus if available, fallback to status
  const backendStatus = response.jobStatus || response.status || 'Pending';
  
  return {
    id: response.id,
    algorithm: response.algorithm || response.jobName || 'unknown',
    createdAt: new Date(response.createdAt).getTime(),
    priority: response.priority || 100,
    status: statusMap[backendStatus] || 'Pending',
    jobStatus: response.jobStatus,
    deploymentStatus: response.deploymentStatus,
    startTime: response.startTime,
    endTime: response.endTime,
  };
}
