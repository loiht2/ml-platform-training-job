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
	"github.com/loiht2/ml-platform-training-job/backend/karmada"
	"github.com/loiht2/ml-platform-training-job/backend/monitor"
	"github.com/loiht2/ml-platform-training-job/backend/repository"
)

func main() {
	// Parse command line arguments
	karmadaKubeconfig := flag.String("karmada-kubeconfig", os.Getenv("KARMADA_KUBECONFIG"), "Path to Karmada kubeconfig file")
	mgmtKubeconfig := flag.String("mgmt-kubeconfig", os.Getenv("MGMT_KUBECONFIG"), "Path to management cluster kubeconfig file")
	databaseURL := flag.String("database-url", os.Getenv("DATABASE_URL"), "Database connection URL")
	port := flag.String("port", getEnvOrDefault("PORT", "8080"), "Server port")
	flag.Parse()

	// Validate required arguments
	if *karmadaKubeconfig == "" {
		log.Fatal("Karmada kubeconfig is required (use --karmada-kubeconfig or KARMADA_KUBECONFIG env)")
	}
	if *mgmtKubeconfig == "" {
		log.Fatal("MGMT kubeconfig is required (use --mgmt-kubeconfig or MGMT_KUBECONFIG env)")
	}
	if *databaseURL == "" {
		log.Fatal("Database URL is required (use --database-url or DATABASE_URL env)")
	}

	// Initialize configuration
	cfg, err := config.New(*karmadaKubeconfig, *mgmtKubeconfig, *databaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize configuration: %v", err)
	}
	defer cfg.Close()

	// Initialize database repository
	repo := repository.NewRepository(cfg.DB)

	// Initialize Karmada client
	karmadaClient := karmada.NewClient(cfg.KarmadaClient, cfg.KarmadaK8sClient)

	// Initialize and start job monitor (polls every 1 second)
	jobMonitor := monitor.NewJobMonitor(repo, karmadaClient)
	jobMonitor.Start()
	defer jobMonitor.Stop()

	// Initialize handlers
	handler := handlers.NewHandler(cfg, repo)

	// Setup Gin router
	router := gin.Default()

	// Enable CORS
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
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

		// Member cluster resources proxy
		proxy := api.Group("/proxy")
		{
			proxy.GET("/clusters", handler.ListMemberClusters)
			proxy.GET("/clusters/:cluster/resources", handler.GetClusterResources)
		}
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

	// Stop job monitor first
	log.Println("Stopping job monitor...")
	jobMonitor.Stop()

	// Shutdown HTTP server
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Close database connections
	cfg.Close()
	log.Println("Server stopped gracefully")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
