# Makefile for ML Platform Backend

.PHONY: help build run test clean docker-build docker-run deps

# Variables
BINARY_NAME=backend
DOCKER_IMAGE=ml-platform-backend
DOCKER_TAG=latest


help: ## Display this help message
	@echo "ML Platform Backend - Available Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

deps: ## Download Go dependencies
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

build: deps ## Build the backend binary
	@echo "Building $(BINARY_NAME)..."
	go build -o $(BINARY_NAME) main.go
	@echo "Build complete: ./$(BINARY_NAME)"

run: ## Run the backend (env vars will be validated by the app)
	@echo "Running $(BINARY_NAME)..."
	go run main.go

run-check: ## Run the backend with env var validation
	@echo "Running $(BINARY_NAME)..."
	@if [ -z "$$KARMADA_KUBECONFIG" ]; then \
		echo "Error: KARMADA_KUBECONFIG not set"; \
		exit 1; \
	fi
	@if [ -z "$$MGMT_KUBECONFIG" ]; then \
		echo "Error: MGMT_KUBECONFIG not set"; \
		exit 1; \
	fi
	@if [ -z "$$DATABASE_URL" ]; then \
		echo "Error: DATABASE_URL not set"; \
		exit 1; \
	fi
	go run main.go

test: ## Run tests
	@echo "Running tests..."
	go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

fmt: ## Format Go code
	@echo "Formatting code..."
	go fmt ./...

lint: ## Run linter
	@echo "Running linter..."
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Install: https://golangci-lint.run/usage/install/"; \
	fi

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	go clean

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-run: ## Run backend with docker-compose
	@echo "Starting services with docker-compose..."
	docker-compose up -d

docker-stop: ## Stop docker-compose services
	@echo "Stopping services..."
	docker-compose down

docker-logs: ## View docker-compose logs
	docker-compose logs -f backend

db-setup: ## Setup PostgreSQL with Docker
	@echo "Setting up PostgreSQL..."
	docker run -d \
		--name ml-platform-postgres \
		-e POSTGRES_USER=mlplatform \
		-e POSTGRES_PASSWORD=mlplatform123 \
		-e POSTGRES_DB=training_jobs \
		-p 5432:5432 \
		postgres:15-alpine

db-stop: ## Stop PostgreSQL container
	docker stop ml-platform-postgres || true
	docker rm ml-platform-postgres || true

install: build ## Install binary to $GOPATH/bin
	@echo "Installing $(BINARY_NAME) to $(GOPATH)/bin..."
	go install

dev: ## Run in development mode with hot reload (requires air)
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not installed. Install: go install github.com/cosmtrek/air@latest"; \
		echo "Running without hot reload..."; \
		$(MAKE) run; \
	fi

k8s-deploy: ## Deploy to Kubernetes
	@echo "Deploying to Kubernetes..."
	./deploy-k8s.sh

k8s-build-push: ## Build and push Docker image
	@echo "Building and pushing Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	docker push $(DOCKER_IMAGE):$(DOCKER_TAG)

k8s-status: ## Check Kubernetes deployment status
	@echo "Checking deployment status..."
	kubectl get all -n ml-platform
	kubectl get ingress -n ml-platform
