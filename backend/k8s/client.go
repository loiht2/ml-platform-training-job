package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// Client handles Kubernetes operations
type Client struct {
	clientset     *kubernetes.Clientset
	dynamicClient dynamic.Interface
}

// NewClient creates a new Kubernetes client
func NewClient(clientset *kubernetes.Clientset, dynamicClient dynamic.Interface) *Client {
	return &Client{
		clientset:     clientset,
		dynamicClient: dynamicClient,
	}
}

// CreateJob creates a Kubernetes Job
func (c *Client) CreateJob(ctx context.Context, job *batchv1.Job) (*batchv1.Job, error) {
	createdJob, err := c.clientset.BatchV1().Jobs(job.Namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create job: %w", err)
	}

	log.Printf("Created job %s/%s", createdJob.Namespace, createdJob.Name)
	return createdJob, nil
}

// CreateRayJob creates a Ray Job using dynamic client
func (c *Client) CreateRayJob(ctx context.Context, rayJob map[string]interface{}) error {
	// Convert map to unstructured
	unstructuredObj := &unstructured.Unstructured{
		Object: rayJob,
	}

	namespace := unstructuredObj.GetNamespace()
	if namespace == "" {
		namespace = "default"
		unstructuredObj.SetNamespace(namespace)
	}

	// Define RayJob GroupVersionResource
	gvr := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	// Create the RayJob
	_, err := c.dynamicClient.Resource(gvr).Namespace(namespace).Create(ctx, unstructuredObj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create RayJob: %w", err)
	}

	log.Printf("Created RayJob %s/%s", namespace, unstructuredObj.GetName())
	return nil
}

// GetJobStatus retrieves job status
func (c *Client) GetJobStatus(ctx context.Context, name, namespace string) (*batchv1.Job, error) {
	job, err := c.clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return job, nil
}

// GetRayJobStatus retrieves RayJob status using dynamic client
func (c *Client) GetRayJob(ctx context.Context, name, namespace string) (map[string]interface{}, error) {
	gvr := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	unstructuredObj, err := c.dynamicClient.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get RayJob: %w", err)
	}

	return unstructuredObj.Object, nil
}

func (c *Client) GetRayJobStatus(ctx context.Context, name, namespace string) (map[string]interface{}, error) {
	gvr := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	unstructuredObj, err := c.dynamicClient.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get RayJob: %w", err)
	}

	// Extract status
	status, found, err := unstructured.NestedMap(unstructuredObj.Object, "status")
	if err != nil || !found {
		return map[string]interface{}{}, nil
	}

	return status, nil
}

// DeleteJob deletes a job
func (c *Client) DeleteJob(ctx context.Context, name, namespace string) error {
	// Try to delete as RayJob first
	gvr := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	err := c.dynamicClient.Resource(gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		log.Printf("RayJob deletion failed (might not exist): %v", err)
		
		// Try regular Job deletion
		err = c.clientset.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		if err != nil {
			return fmt.Errorf("failed to delete job: %w", err)
		}
	}

	log.Printf("Deleted job %s/%s", namespace, name)
	return nil
}

// CreatePVC creates a PersistentVolumeClaim
func (c *Client) CreatePVC(ctx context.Context, pvc *corev1.PersistentVolumeClaim) error {
	_, err := c.clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Create(ctx, pvc, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create PVC: %w", err)
	}

	log.Printf("Created PVC %s/%s", pvc.Namespace, pvc.Name)
	return nil
}

// ListActiveJobs lists all jobs in a namespace
func (c *Client) ListActiveJobs(ctx context.Context, namespace string) ([]batchv1.Job, error) {
	jobList, err := c.clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}

	return jobList.Items, nil
}

// ListActiveRayJobs lists all RayJobs in a namespace
func (c *Client) ListActiveRayJobs(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	gvr := schema.GroupVersionResource{
		Group:    "ray.io",
		Version:  "v1",
		Resource: "rayjobs",
	}

	unstructuredList, err := c.dynamicClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list RayJobs: %w", err)
	}

	rayJobs := make([]map[string]interface{}, 0, len(unstructuredList.Items))
	for _, item := range unstructuredList.Items {
		rayJobs = append(rayJobs, item.Object)
	}

	return rayJobs, nil
}

// GetPodLogs retrieves logs from a pod
func (c *Client) GetPodLogs(ctx context.Context, namespace, podName, containerName string) (string, error) {
	podLogOpts := corev1.PodLogOptions{
		Container: containerName,
		TailLines: int64Ptr(100),
	}

	req := c.clientset.CoreV1().Pods(namespace).GetLogs(podName, &podLogOpts)
	logs, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get pod logs: %w", err)
	}
	defer logs.Close()

	buf := new([]byte)
	_, err = logs.Read(*buf)
	if err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}

	return string(*buf), nil
}

// ListPodsForJob lists pods for a specific job
func (c *Client) ListPodsForJob(ctx context.Context, namespace, jobName string) (*corev1.PodList, error) {
	labelSelector := fmt.Sprintf("job-name=%s", jobName)
	pods, err := c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	return pods, nil
}

// GetNamespace gets namespace details
func (c *Client) GetNamespace(ctx context.Context, name string) (*corev1.Namespace, error) {
	ns, err := c.clientset.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace: %w", err)
	}
	return ns, nil
}

// ListNamespaces lists all namespaces (useful for Kubeflow profile detection)
func (c *Client) ListNamespaces(ctx context.Context) ([]corev1.Namespace, error) {
	nsList, err := c.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}
	return nsList.Items, nil
}

// Helper functions
func int64Ptr(i int64) *int64 {
	return &i
}

// MarshalRayJob marshals RayJob to JSON for storage
func MarshalRayJob(rayJob map[string]interface{}) (string, error) {
	data, err := json.Marshal(rayJob)
	if err != nil {
		return "", fmt.Errorf("failed to marshal RayJob: %w", err)
	}
	return string(data), nil
}

// UnmarshalRayJob unmarshals RayJob from JSON
func UnmarshalRayJob(data string) (map[string]interface{}, error) {
	var rayJob map[string]interface{}
	if err := json.Unmarshal([]byte(data), &rayJob); err != nil {
		return nil, fmt.Errorf("failed to unmarshal RayJob: %w", err)
	}
	return rayJob, nil
}
