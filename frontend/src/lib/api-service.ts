// API Service for ML Platform Backend Integration

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// NEW Backend API format (v2)
export interface BackendTrainingJobRequest {
  jobName: string;
  priority?: number;
  algorithm: {
    source: string;
    algorithmName: string;
  };
  resources: {
    instanceResources: {
      cpuCores: number;
      memoryGiB: number;
      gpuCount: number;
    };
    instanceCount: number;
    volumeSizeGB: number;
  };
  stoppingCondition?: {
    maxRuntimeSeconds: number;
  };
  inputDataConfig?: Array<{
    id: string;
    channelName: string;
    sourceType: string;
    storageProvider: string;
    endpoint: string;
    bucket: string;
    prefix: string;
  }>;
  outputDataConfig?: {
    artifactUri: string;
  };
  hyperparameters?: any; // Can contain xgboost, tensorflow, etc.
  customHyperparameters?: Record<string, any>;
  targetClusters?: string[];
  namespace?: string;
  entrypoint?: string;
  headImage?: string;
  workerImage?: string;
  pvcName?: string;
}

export interface BackendTrainingJobResponse {
  id: string;
  jobName: string;
  namespace: string;
  algorithm: string;
  priority: number;
  request?: BackendTrainingJobRequest;
  status: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobStatus {
  phase: string;
  reason?: string;
  message?: string;
  active?: number;
  succeeded?: number;
  failed?: number;
  startTime?: string;
  completionTime?: string;
  clusterDistribution?: Record<string, number>;
}

export interface ClusterInfo {
  name: string;
  ready: boolean;
  region?: string;
  zone?: string;
}

export interface ClustersResponse {
  clusters: ClusterInfo[];
}

class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      throw new APIError(
        `API request failed: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

export const jobsApi = {
  /**
   * Create a new training job
   */
  create: async (
    job: BackendTrainingJobRequest
  ): Promise<BackendTrainingJobResponse> => {
    return fetchAPI<BackendTrainingJobResponse>('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
  },

  /**
   * List all training jobs
   */
  list: async (
    namespace?: string
  ): Promise<BackendTrainingJobResponse[]> => {
    const query = namespace ? `?namespace=${namespace}` : '';
    return fetchAPI<BackendTrainingJobResponse[]>(`/jobs${query}`);
  },

  /**
   * Get a specific training job by ID
   */
  get: async (id: string): Promise<BackendTrainingJobResponse> => {
    return fetchAPI<BackendTrainingJobResponse>(`/jobs/${id}`);
  },

  /**
   * Delete a training job
   */
  delete: async (id: string): Promise<{ message: string }> => {
    return fetchAPI<{ message: string }>(`/jobs/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get the status of a training job
   */
  getStatus: async (id: string): Promise<JobStatus> => {
    return fetchAPI<JobStatus>(`/jobs/${id}/status`);
  },

  /**
   * Get logs for a training job
   */
  getLogs: async (id: string): Promise<{ message: string; hint?: string }> => {
    return fetchAPI<{ message: string; hint?: string }>(`/jobs/${id}/logs`);
  },
};

export const clustersApi = {
  /**
   * List all member clusters
   */
  list: async (): Promise<ClustersResponse> => {
    return fetchAPI<ClustersResponse>('/proxy/clusters');
  },

  /**
   * Get resources from a specific cluster
   */
  getResources: async (
    cluster: string,
    namespace: string = 'default',
    type: string = 'pods'
  ): Promise<{
    cluster: string;
    namespace: string;
    type: string;
    count: number;
    resources: unknown[];
  }> => {
    return fetchAPI(
      `/proxy/clusters/${cluster}/resources?namespace=${namespace}&type=${type}`
    );
  },
};

export const healthApi = {
  /**
   * Check backend health
   */
  check: async (): Promise<{ status: string }> => {
    return fetchAPI<{ status: string }>('/health', {}, );
  },
};

// Export the error class for error handling
export { APIError };
