#!/usr/bin/env bash
set -e

echo "=== Textboard Build (Linux/Mac) ==="

if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed"
  exit 1
fi

echo "Building Docker image..."
docker build -t textboard:latest .

echo ""
echo "Build complete."
echo ""
echo "Run with docker-compose (recommended):"
echo "  docker-compose up -d"
echo ""
echo "Or with docker run:"
echo "  docker run -p 3000:3000 -v ./data:/app/data -e DB_PATH=/app/data/textboard.db textboard:latest"
echo ""
echo "Database will be stored in ./data/textboard.db"
