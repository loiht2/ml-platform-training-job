import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { clustersApi, type ClusterInfo } from '@/lib/api-service';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ClusterSelectorProps {
  selectedClusters: string[];
  onSelectionChange: (clusters: string[]) => void;
  disabled?: boolean;
}

export function ClusterSelector({
  selectedClusters,
  onSelectionChange,
  disabled = false,
}: ClusterSelectorProps) {
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await clustersApi.list();
        setClusters(response.clusters);
      } catch (err) {
        console.error('Failed to fetch clusters:', err);
        setError(err instanceof Error ? err.message : 'Failed to load clusters');
      } finally {
        setLoading(false);
      }
    };

    fetchClusters();
  }, []);

  const toggleCluster = (clusterName: string) => {
    if (disabled) return;
    
    if (selectedClusters.includes(clusterName)) {
      onSelectionChange(selectedClusters.filter((c) => c !== clusterName));
    } else {
      onSelectionChange([...selectedClusters, clusterName]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Target Clusters</Label>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading clusters...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Target Clusters</Label>
        <div className="text-sm text-red-600">
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Target Clusters</Label>
        <div className="text-sm text-gray-500">
          No clusters available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        Target Clusters
        {selectedClusters.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({selectedClusters.length} selected)
          </span>
        )}
      </Label>
      
      <div className="space-y-2 rounded-md border border-gray-200 p-3 bg-gray-50/50">
        {clusters.map((cluster) => {
          const isSelected = selectedClusters.includes(cluster.name);
          const isDisabled = !cluster.ready || disabled;

          return (
            <div
              key={cluster.name}
              className={`flex items-center space-x-3 rounded-md p-2 transition-colors ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-gray-100'
              } ${isSelected ? 'bg-blue-50 border border-blue-200' : ''}`}
              onClick={() => !isDisabled && toggleCluster(cluster.name)}
            >
              <input
                type="checkbox"
                id={`cluster-${cluster.name}`}
                checked={isSelected}
                onChange={() => toggleCluster(cluster.name)}
                disabled={isDisabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              
              <label
                htmlFor={`cluster-${cluster.name}`}
                className="flex flex-1 items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {cluster.name}
                  </span>
                  
                  {cluster.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {cluster.region && (
                    <Badge variant="outline" className="text-xs">
                      {cluster.region}
                    </Badge>
                  )}
                  
                  {cluster.zone && (
                    <Badge variant="outline" className="text-xs">
                      {cluster.zone}
                    </Badge>
                  )}
                  
                  {!cluster.ready && (
                    <Badge variant="destructive" className="text-xs">
                      Not Ready
                    </Badge>
                  )}
                </div>
              </label>
            </div>
          );
        })}
      </div>

      {selectedClusters.length === 0 && (
        <p className="text-xs text-gray-500">
          💡 No clusters selected. Job will be scheduled to all available clusters by Karmada.
        </p>
      )}
      
      {selectedClusters.length > 0 && (
        <p className="text-xs text-gray-500">
          Job will be distributed to: <strong>{selectedClusters.join(', ')}</strong>
        </p>
      )}
    </div>
  );
}
