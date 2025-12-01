// Kubeflow API Integration for user/namespace information

export interface NamespaceBinding {
  namespace: string;
  role: string;
  user: string;
}

export interface KubeflowEnvInfo {
  user: string;
  namespaces: NamespaceBinding[];
  isClusterAdmin: boolean;
  platform?: {
    provider: string;
    providerName: string;
    kubeflowVersion: string;
  };
}

/**
 * Get current user and namespace from Kubeflow central dashboard
 */
export async function getKubeflowEnvInfo(): Promise<KubeflowEnvInfo> {
  try {
    const response = await fetch('/api/workgroup/env-info');
    if (!response.ok) {
      console.warn('Failed to fetch Kubeflow env info, falling back to URL params');
      return getEnvInfoFromURL();
    }
    
    const data = await response.json();
    return {
      user: data.user || 'anonymous@kubeflow.org',
      namespaces: data.namespaces || [],
      isClusterAdmin: data.isClusterAdmin || false,
      platform: data.platform
    };
  } catch (error) {
    console.warn('Error fetching Kubeflow env info:', error);
    return getEnvInfoFromURL();
  }
}

/**
 * Get the default namespace using Kubeflow's selection logic:
 * 1. Check localStorage for user's previous selection
 * 2. Find namespace with 'owner' role
 * 3. Fall back to 'kubeflow' namespace if it exists
 * 4. Use first available namespace
 * 5. Fall back to URL parameter or hardcoded default
 */
export function getDefaultNamespace(envInfo: KubeflowEnvInfo): string {
  // 1. Check localStorage (same key pattern as centraldashboard)
  const localStorageKey = `/centraldashboard/selectedNamespace/${envInfo.user || ''}`;
  const previousNamespace = localStorage.getItem(localStorageKey);
  if (previousNamespace && envInfo.namespaces.some(ns => ns.namespace === previousNamespace)) {
    return previousNamespace;
  }

  // 2. Find namespace with 'owner' role
  const ownedNamespace = envInfo.namespaces.find(ns => ns.role === 'owner');
  if (ownedNamespace) {
    return ownedNamespace.namespace;
  }

  // 3. Fall back to 'kubeflow' namespace
  if (envInfo.namespaces.some(ns => ns.namespace === 'kubeflow')) {
    return 'kubeflow';
  }

  // 4. Use first available namespace
  if (envInfo.namespaces.length > 0) {
    return envInfo.namespaces[0].namespace;
  }

  // 5. Fall back to URL parameter or hardcoded default
  const params = new URLSearchParams(window.location.search);
  return params.get('ns') || 'kubeflow-user-example-com';
}

/**
 * Fallback: Get namespace from URL query parameter
 */
function getNamespaceFromURL(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('ns') || 'kubeflow-user-example-com';
}

/**
 * Get environment info from URL (fallback method)
 */
function getEnvInfoFromURL(): KubeflowEnvInfo {
  const namespace = getNamespaceFromURL();
  return {
    user: 'anonymous@kubeflow.org',
    namespaces: [{
      namespace,
      role: 'contributor',
      user: 'anonymous@kubeflow.org'
    }],
    isClusterAdmin: false
  };
}

/**
 * Get current namespace (prefer env-info, fallback to URL)
 */
export async function getCurrentNamespace(): Promise<string> {
  const envInfo = await getKubeflowEnvInfo();
  return getDefaultNamespace(envInfo);
}

/**
 * Get current user (prefer env-info, fallback to default)
 */
export async function getCurrentUser(): Promise<string> {
  const envInfo = await getKubeflowEnvInfo();
  return envInfo.user;
}
