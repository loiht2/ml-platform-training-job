package config

import (
	"fmt"
	"log"
	"os"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Config holds all configuration for the backend
type Config struct {
	Kubeconfig   string
	UseInCluster bool

	// Kubernetes clients
	K8sClient     *kubernetes.Clientset
	DynamicClient dynamic.Interface
	RestConfig    *rest.Config
}

// New creates a new configuration instance
func New(kubeconfig string) (*Config, error) {
	cfg := &Config{
		Kubeconfig:   kubeconfig,
		UseInCluster: kubeconfig == "",
	}

	// Initialize Kubernetes client
	if err := cfg.initK8sClient(); err != nil {
		return nil, fmt.Errorf("failed to initialize Kubernetes client: %w", err)
	}

	log.Println("Configuration initialized successfully")
	return cfg, nil
}

// initK8sClient initializes the Kubernetes client
func (c *Config) initK8sClient() error {
	var config *rest.Config
	var err error

	if c.UseInCluster {
		// Use in-cluster configuration (for pods running in Kubernetes)
		config, err = rest.InClusterConfig()
		if err != nil {
			return fmt.Errorf("failed to get in-cluster config: %w", err)
		}
		log.Println("Using in-cluster Kubernetes configuration")
	} else {
		// Use kubeconfig file
		config, err = clientcmd.BuildConfigFromFlags("", c.Kubeconfig)
		if err != nil {
			return fmt.Errorf("failed to build kubeconfig: %w", err)
		}
		log.Printf("Using kubeconfig from: %s", c.Kubeconfig)
	}

	c.RestConfig = config

	// Create standard Kubernetes clientset
	k8sClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create Kubernetes clientset: %w", err)
	}
	c.K8sClient = k8sClient

	// Create dynamic client for CRDs like RayJob
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}
	c.DynamicClient = dynamicClient

	log.Println("Kubernetes client initialized successfully")
	return nil
}

// Close closes all connections
func (c *Config) Close() {
	// No resources to close currently
}

// GetNamespaceFromContext extracts namespace from Kubeflow context headers
// If not found, returns "default"
func GetNamespaceFromContext(namespace string) string {
	if namespace != "" {
		return namespace
	}
	
	// Check for Kubeflow namespace environment variable
	if ns := os.Getenv("KUBEFLOW_NAMESPACE"); ns != "" {
		return ns
	}
	
	return "default"
}
