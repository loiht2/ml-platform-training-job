package karmada

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	batchv1 "k8s.io/api/batch/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"

	policyv1alpha1 "github.com/karmada-io/karmada/pkg/apis/policy/v1alpha1"
	karmadaclientset "github.com/karmada-io/karmada/pkg/generated/clientset/versioned"
)

// Client handles Karmada operations
type Client struct {
	karmadaClient    *karmadaclientset.Clientset
	karmadaK8sClient *kubernetes.Clientset
}

// NewClient creates a new Karmada client
func NewClient(karmadaClient *karmadaclientset.Clientset, k8sClient *kubernetes.Clientset) *Client {
	return &Client{
		karmadaClient:    karmadaClient,
		karmadaK8sClient: k8sClient,
	}
}

// CreateJobWithPropagationPolicy creates a Kubernetes Job and PropagationPolicy in Karmada
func (c *Client) CreateJobWithPropagationPolicy(ctx context.Context, job *batchv1.Job, targetClusters []string) error {
	// Create the Job in Karmada control plane
	createdJob, err := c.karmadaK8sClient.BatchV1().Jobs(job.Namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create job in Karmada: %w", err)
	}

	log.Printf("Created job %s/%s in Karmada control plane", createdJob.Namespace, createdJob.Name)

	// Create PropagationPolicy
	policy := c.buildPropagationPolicy(job.Name, job.Namespace, targetClusters)
	_, err = c.karmadaClient.PolicyV1alpha1().PropagationPolicies(job.Namespace).Create(ctx, policy, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create propagation policy: %w", err)
	}

	log.Printf("Created propagation policy %s/%s", policy.Namespace, policy.Name)
	return nil
}

// CreateRayJobWithPropagationPolicy creates a Ray Job and PropagationPolicy in Karmada
func (c *Client) CreateRayJobWithPropagationPolicy(ctx context.Context, rayJob map[string]interface{}, targetClusters []string) error {
	// Convert map to unstructured
	unstructuredObj := &unstructured.Unstructured{
		Object: rayJob,
	}

	namespace := unstructuredObj.GetNamespace()
	if namespace == "" {
		namespace = "default"
		unstructuredObj.SetNamespace(namespace)
	}

	// Create the RayJob using dynamic client
	gvr := metav1.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	dynamicClient := c.karmadaK8sClient.Discovery().RESTClient()
	data, err := json.Marshal(unstructuredObj)
	if err != nil {
		return fmt.Errorf("failed to marshal RayJob: %w", err)
	}

	result := dynamicClient.Post().
		AbsPath("/apis", gvr.Group, gvr.Version, "namespaces", namespace, gvr.Resource).
		Body(data).
		Do(ctx)

	if err := result.Error(); err != nil {
		return fmt.Errorf("failed to create RayJob in Karmada: %w", err)
	}

	log.Printf("Created RayJob %s/%s in Karmada control plane", namespace, unstructuredObj.GetName())

	// Create PropagationPolicy
	policy := c.buildPropagationPolicy(unstructuredObj.GetName(), namespace, targetClusters)
	policy.Spec.ResourceSelectors = []policyv1alpha1.ResourceSelector{
		{
			APIVersion: "ray.io/v1",
			Kind:       "RayJob",
			Name:       unstructuredObj.GetName(),
		},
	}

	_, err = c.karmadaClient.PolicyV1alpha1().PropagationPolicies(namespace).Create(ctx, policy, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create propagation policy: %w", err)
	}

	log.Printf("Created propagation policy %s/%s", policy.Namespace, policy.Name)
	return nil
}

// buildPropagationPolicy creates a PropagationPolicy for distributing resources
func (c *Client) buildPropagationPolicy(resourceName, namespace string, targetClusters []string) *policyv1alpha1.PropagationPolicy {
	clusterAffinity := &policyv1alpha1.ClusterAffinity{}

	if len(targetClusters) > 0 {
		// Target specific clusters
		clusterNames := make([]string, len(targetClusters))
		copy(clusterNames, targetClusters)
		clusterAffinity.ClusterNames = clusterNames
	} else {
		// Target all clusters
		clusterAffinity.ClusterNames = []string{}
	}

	return &policyv1alpha1.PropagationPolicy{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "policy.karmada.io/v1alpha1",
			Kind:       "PropagationPolicy",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-propagation", resourceName),
			Namespace: namespace,
		},
		Spec: policyv1alpha1.PropagationSpec{
			ResourceSelectors: []policyv1alpha1.ResourceSelector{
				{
					APIVersion: "batch/v1",
					Kind:       "Job",
					Name:       resourceName,
				},
			},
			Placement: policyv1alpha1.Placement{
				ClusterAffinity: clusterAffinity,
				ReplicaScheduling: &policyv1alpha1.ReplicaSchedulingStrategy{
					ReplicaSchedulingType: policyv1alpha1.ReplicaSchedulingTypeDivided,
				},
			},
		},
	}
}

// GetJobStatus retrieves job status from Karmada control plane
func (c *Client) GetJobStatus(ctx context.Context, name, namespace string) (*batchv1.Job, error) {
	job, err := c.karmadaK8sClient.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return job, nil
}

// DeleteJob deletes a job and its propagation policy
func (c *Client) DeleteJob(ctx context.Context, name, namespace string) error {
	// Delete the job
	err := c.karmadaK8sClient.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		log.Printf("Warning: failed to delete job: %v", err)
	}

	// Delete the propagation policy
	policyName := fmt.Sprintf("%s-propagation", name)
	err = c.karmadaClient.PolicyV1alpha1().PropagationPolicies(namespace).Delete(ctx, policyName, metav1.DeleteOptions{})
	if err != nil {
		log.Printf("Warning: failed to delete propagation policy: %v", err)
	}

	return nil
}

// ListMemberClusters lists all member clusters registered in Karmada
func (c *Client) ListMemberClusters(ctx context.Context) ([]map[string]interface{}, error) {
	clusterList, err := c.karmadaClient.ClusterV1alpha1().Clusters().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list member clusters: %w", err)
	}

	clusters := make([]map[string]interface{}, 0, len(clusterList.Items))
	for _, cluster := range clusterList.Items {
		clusterInfo := map[string]interface{}{
			"name":  cluster.Name,
			"ready": false,
		}

		// Check if cluster is ready
		for _, condition := range cluster.Status.Conditions {
			if condition.Type == "Ready" && condition.Status == "True" {
				clusterInfo["ready"] = true
				break
			}
		}

		// Add labels if available
		if cluster.Labels != nil {
			if region, ok := cluster.Labels["region"]; ok {
				clusterInfo["region"] = region
			}
			if zone, ok := cluster.Labels["zone"]; ok {
				clusterInfo["zone"] = zone
			}
		}

		clusters = append(clusters, clusterInfo)
	}

	return clusters, nil
}

// GetClusterResources gets resources from a specific member cluster via Karmada aggregated API
func (c *Client) GetClusterResources(ctx context.Context, clusterName, namespace, resourceType string) ([]runtime.Object, error) {
	// Use Karmada's cluster proxy to access member cluster resources
	// Path format: /apis/cluster.karmada.io/v1alpha1/clusters/{cluster}/proxy/api/v1/namespaces/{namespace}/{resourceType}
	
	restClient := c.karmadaK8sClient.Discovery().RESTClient()
	
	path := fmt.Sprintf("/apis/cluster.karmada.io/v1alpha1/clusters/%s/proxy/api/v1/namespaces/%s/%s", 
		clusterName, namespace, resourceType)
	
	result := restClient.Get().AbsPath(path).Do(ctx)
	
	if err := result.Error(); err != nil {
		return nil, fmt.Errorf("failed to get resources from cluster %s: %w", clusterName, err)
	}

	data, err := result.Raw()
	if err != nil {
		return nil, fmt.Errorf("failed to get raw data: %w", err)
	}

	// Parse the response
	var objList unstructured.UnstructuredList
	if err := json.Unmarshal(data, &objList); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	objects := make([]runtime.Object, len(objList.Items))
	for i := range objList.Items {
		objects[i] = &objList.Items[i]
	}

	return objects, nil
}

// CreatePVC creates a PersistentVolumeClaim in Karmada control plane
func (c *Client) CreatePVC(ctx context.Context, pvc interface{}) error {
	// Handle both *corev1.PersistentVolumeClaim and map types
	var namespace, name string
	var data []byte
	var err error
	
	switch v := pvc.(type) {
	case map[string]interface{}:
		// Unstructured format
		metadata := v["metadata"].(map[string]interface{})
		namespace = metadata["namespace"].(string)
		name = metadata["name"].(string)
		data, err = json.Marshal(v)
	default:
		// Assume it's a typed PVC, marshal it
		data, err = json.Marshal(pvc)
		if err != nil {
			return fmt.Errorf("failed to marshal PVC: %w", err)
		}
		
		// Parse to get namespace and name
		var obj map[string]interface{}
		if err := json.Unmarshal(data, &obj); err != nil {
			return fmt.Errorf("failed to unmarshal PVC: %w", err)
		}
		metadata := obj["metadata"].(map[string]interface{})
		namespace = metadata["namespace"].(string)
		name = metadata["name"].(string)
	}
	
	if err != nil {
		return fmt.Errorf("failed to prepare PVC: %w", err)
	}
	
	// Create PVC using REST client
	restClient := c.karmadaK8sClient.Discovery().RESTClient()
	result := restClient.Post().
		AbsPath("/api/v1/namespaces", namespace, "persistentvolumeclaims").
		Body(data).
		Do(ctx)
	
	if err := result.Error(); err != nil {
		return fmt.Errorf("failed to create PVC in Karmada: %w", err)
	}
	
	log.Printf("Created PVC %s/%s in Karmada control plane", namespace, name)
	return nil
}

// GetRayJobStatusFromMembers gets RayJob status from member clusters via Karmada aggregated API
func (c *Client) GetRayJobStatusFromMembers(ctx context.Context, name, namespace string) (map[string]interface{}, error) {
	// First, get the list of clusters where this job is deployed
	clusters, err := c.getJobDeploymentClusters(ctx, name, namespace)
	if err != nil || len(clusters) == 0 {
		return nil, fmt.Errorf("failed to find deployment clusters for job %s: %w", name, err)
	}

	// Query the first cluster for job status (all replicas should have same status)
	clusterName := clusters[0]
	
	restClient := c.karmadaK8sClient.Discovery().RESTClient()
	path := fmt.Sprintf("/apis/cluster.karmada.io/v1alpha1/clusters/%s/proxy/apis/ray.io/v1/namespaces/%s/rayjobs/%s",
		clusterName, namespace, name)
	
	result := restClient.Get().AbsPath(path).Do(ctx)
	
	if err := result.Error(); err != nil {
		return nil, fmt.Errorf("failed to get RayJob status from cluster %s: %w", clusterName, err)
	}

	data, err := result.Raw()
	if err != nil {
		return nil, fmt.Errorf("failed to get raw data: %w", err)
	}

	// Parse the response
	var rayJob map[string]interface{}
	if err := json.Unmarshal(data, &rayJob); err != nil {
		return nil, fmt.Errorf("failed to unmarshal RayJob: %w", err)
	}

	// Extract status
	if status, ok := rayJob["status"].(map[string]interface{}); ok {
		return status, nil
	}

	return map[string]interface{}{}, nil
}

// getJobDeploymentClusters gets the list of clusters where a job is deployed
func (c *Client) getJobDeploymentClusters(ctx context.Context, name, namespace string) ([]string, error) {
	// Get the propagation policy
	policyName := fmt.Sprintf("%s-propagation", name)
	policy, err := c.karmadaClient.PolicyV1alpha1().PropagationPolicies(namespace).Get(ctx, policyName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get propagation policy: %w", err)
	}

	// Extract target clusters
	clusters := policy.Spec.Placement.ClusterAffinity.ClusterNames
	if len(clusters) == 0 {
		// If no specific clusters, get all ready clusters
		allClusters, err := c.ListMemberClusters(ctx)
		if err != nil {
			return nil, err
		}
		for _, cluster := range allClusters {
			if ready, ok := cluster["ready"].(bool); ok && ready {
				if name, ok := cluster["name"].(string); ok {
					clusters = append(clusters, name)
				}
			}
		}
	}

	return clusters, nil
}
