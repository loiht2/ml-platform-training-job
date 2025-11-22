#!/bin/bash

# ML Platform Backend Setup Script

set -e

echo "==================================="
echo "ML Platform Backend Setup"
echo "==================================="

# Check prerequisites
check_prereqs() {
    echo "Checking prerequisites..."
    
    if ! command -v go &> /dev/null; then
        echo "Error: Go is not installed. Please install Go 1.21 or later."
        exit 1
    fi
    
    echo "Go version: $(go version)"
}

# Initialize Go modules
init_modules() {
    echo ""
    echo "Initializing Go modules..."
    go mod download
    go mod tidy
    echo "✓ Go modules initialized"
}

# Setup database
setup_database() {
    echo ""
    echo "Setting up PostgreSQL..."
    
    if command -v docker &> /dev/null; then
        echo "Starting PostgreSQL container..."
        docker run -d \
            --name ml-platform-postgres \
            -e POSTGRES_USER=mlplatform \
            -e POSTGRES_PASSWORD=mlplatform123 \
            -e POSTGRES_DB=training_jobs \
            -p 5432:5432 \
            postgres:15-alpine || echo "Container may already exist"
        
        echo "✓ PostgreSQL container started"
        echo "  Connection: postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs"
    else
        echo "Docker not found. Please install PostgreSQL manually."
        echo "  Required database: training_jobs"
        echo "  Required user: mlplatform"
    fi
}

# Build binary
build_binary() {
    echo ""
    echo "Building backend binary..."
    go build -o backend main.go
    echo "✓ Binary built: ./backend"
}

# Display usage
show_usage() {
    echo ""
    echo "==================================="
    echo "Setup Complete!"
    echo "==================================="
    echo ""
    echo "To run the backend, use:"
    echo ""
    echo "  ./backend \\"
    echo "    --karmada-kubeconfig=/path/to/karmada-config \\"
    echo "    --mgmt-kubeconfig=/path/to/mgmt-config \\"
    echo "    --database-url=\"postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs?sslmode=disable\""
    echo ""
    echo "Or set environment variables:"
    echo ""
    echo "  export KARMADA_KUBECONFIG=/path/to/karmada-config"
    echo "  export MGMT_KUBECONFIG=/path/to/mgmt-config"
    echo "  export DATABASE_URL=\"postgresql://mlplatform:mlplatform123@localhost:5432/training_jobs?sslmode=disable\""
    echo "  ./backend"
    echo ""
    echo "Or use Docker Compose:"
    echo ""
    echo "  docker-compose up -d"
    echo ""
}

# Main execution
main() {
    check_prereqs
    init_modules
    
    read -p "Do you want to setup PostgreSQL with Docker? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_database
    fi
    
    read -p "Do you want to build the binary? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_binary
    fi
    
    show_usage
}

main
