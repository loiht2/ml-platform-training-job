package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/loiht2/ml-platform-training-job/backend/config"
	"github.com/loiht2/ml-platform-training-job/backend/handlers"
	"github.com/loiht2/ml-platform-training-job/backend/k8s"
	"github.com/loiht2/ml-platform-training-job/backend/middleware"
)

func main() {
	// Parse command line arguments
	kubeconfig := flag.String("kubeconfig", os.Getenv("KUBECONFIG"), "Path to kubeconfig file (optional, uses in-cluster config if not provided)")
	port := flag.String("port", getEnvOrDefault("PORT", "8080"), "Server port")
	flag.Parse()

	log.Println("Starting ML Platform Training Job Backend (Single-Cluster Kubeflow Edition - No Database)")
	
	// Initialize configuration
	cfg, err := config.New(*kubeconfig)
	if err != nil {
		log.Fatalf("Failed to initialize configuration: %v", err)
	}
	defer cfg.Close()

	// Initialize Kubernetes client
	k8sClient := k8s.NewClient(cfg.K8sClient, cfg.DynamicClient)

	// Initialize handlers
	handler := handlers.NewHandler(cfg, k8sClient)

	// Setup Gin router
	router := gin.Default()

	// Enable CORS (must be first)
	router.Use(middleware.CORSMiddleware())
	
	// Add Kubeflow authentication middleware (extracts user from headers)
	router.Use(middleware.KubeflowAuthMiddleware())
	
	// Add namespace access validation
	router.Use(middleware.NamespaceAccessMiddleware())

	// Health check (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy", 
			"mode":   "kubeflow-integrated",
			"user":   middleware.GetUserEmail(c),
		})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Training job routes
		jobs := api.Group("/jobs")
		{
			jobs.POST("", handler.CreateTrainingJob)
			jobs.GET("", handler.ListTrainingJobs)
			jobs.GET("/:id", handler.GetTrainingJob)
			jobs.DELETE("/:id", handler.DeleteTrainingJob)
			jobs.GET("/:id/status", handler.GetTrainingJobStatus)
			jobs.GET("/:id/logs", handler.GetTrainingJobLogs)
		}
		
		// Namespace management (Kubeflow integration)
		api.GET("/namespaces", handler.ListNamespaces)
		
		// File upload to MinIO
		api.POST("/upload", handler.UploadFileToMinIO)
	}

	// Create HTTP server with proper configuration
	srv := &http.Server{
		Addr:         ":" + *port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on port %s", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with 10-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Close config
	cfg.Close()
	log.Println("Server stopped gracefully")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
