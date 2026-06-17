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
echo "Build complete. Run with:"
echo "  docker run -p 3000:3000 textboard:latest"
echo ""
echo "Or with docker-compose:"
echo "  docker-compose up -d"
