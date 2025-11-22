package config

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	karmadaclientset "github.com/karmada-io/karmada/pkg/generated/clientset/versioned"
)

// Config holds all configuration for the backend
type Config struct {
	KarmadaKubeconfig string
	MgmtKubeconfig    string
	DatabaseURL       string

	// Kubernetes clients
	KarmadaClient    *karmadaclientset.Clientset
	KarmadaK8sClient *kubernetes.Clientset
	MgmtClient       *kubernetes.Clientset
	KarmadaConfig    *rest.Config
	MgmtConfig       *rest.Config

	// Database
	DB *gorm.DB
}

// New creates a new configuration instance
func New(karmadaKubeconfig, mgmtKubeconfig, databaseURL string) (*Config, error) {
	cfg := &Config{
		KarmadaKubeconfig: karmadaKubeconfig,
		MgmtKubeconfig:    mgmtKubeconfig,
		DatabaseURL:       databaseURL,
	}

	// Initialize Karmada client
	if err := cfg.initKarmadaClient(); err != nil {
		return nil, fmt.Errorf("failed to initialize Karmada client: %w", err)
	}

	// Initialize management cluster client
	if err := cfg.initMgmtClient(); err != nil {
		return nil, fmt.Errorf("failed to initialize MGMT client: %w", err)
	}

	// Initialize database
	if err := cfg.initDatabase(); err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	log.Println("Configuration initialized successfully")
	return cfg, nil
}

// initKarmadaClient initializes the Karmada Kubernetes client
func (c *Config) initKarmadaClient() error {
	config, err := clientcmd.BuildConfigFromFlags("", c.KarmadaKubeconfig)
	if err != nil {
		return fmt.Errorf("failed to build Karmada config: %w", err)
	}
	c.KarmadaConfig = config

	// Create Karmada-specific clientset
	karmadaClient, err := karmadaclientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create Karmada clientset: %w", err)
	}
	c.KarmadaClient = karmadaClient

	// Create standard Kubernetes clientset for Karmada
	k8sClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create Kubernetes clientset for Karmada: %w", err)
	}
	c.KarmadaK8sClient = k8sClient

	log.Println("Karmada client initialized successfully")
	return nil
}

// initMgmtClient initializes the management cluster Kubernetes client
func (c *Config) initMgmtClient() error {
	config, err := clientcmd.BuildConfigFromFlags("", c.MgmtKubeconfig)
	if err != nil {
		return fmt.Errorf("failed to build MGMT config: %w", err)
	}
	c.MgmtConfig = config

	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create MGMT clientset: %w", err)
	}
	c.MgmtClient = client

	log.Println("MGMT client initialized successfully")
	return nil
}

// initDatabase initializes the database connection with optimized settings
func (c *Config) initDatabase() error {
	db, err := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{
		// Optimize query performance
		PrepareStmt: true,
		// Skip default transaction for better performance
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pooling for better performance
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database handle: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)           // Maximum idle connections
	sqlDB.SetMaxOpenConns(100)          // Maximum open connections
	sqlDB.SetConnMaxLifetime(time.Hour) // Maximum connection lifetime

	// Auto-migrate database schema
	if err := db.AutoMigrate(&TrainingJob{}); err != nil {
		return fmt.Errorf("failed to auto-migrate database: %w", err)
	}

	c.DB = db
	log.Println("Database initialized successfully with optimized settings")
	return nil
}

// Close closes all connections
func (c *Config) Close() {
	if c.DB != nil {
		sqlDB, err := c.DB.DB()
		if err == nil {
			sqlDB.Close()
		}
	}
}
