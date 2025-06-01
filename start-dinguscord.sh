#!/bin/bash

# Start Dinguscord Microservices
echo "Starting Dinguscord microservices..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start backend services using Docker Compose
echo "Starting backend services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check service health
echo "Checking service health..."
curl -s http://localhost:8080/health || { echo "API Gateway is not healthy"; exit 1; }
echo " - API Gateway is healthy"

# Set up environment variables for frontend
echo "Setting up environment variables for frontend..."
if [ ! -f "./DingusGui/DingusMessaging/.env.development" ]; then
  echo "Creating .env.development file..."
  echo "VITE_API_URL=http://localhost:8080" > ./DingusGui/DingusMessaging/.env.development
  echo "VITE_SOCKET_URL=http://localhost:3003" >> ./DingusGui/DingusMessaging/.env.development
fi

# Start frontend in development mode
echo "Starting frontend in development mode..."
cd DingusGui/DingusMessaging && npm run dev

echo "Dinguscord is now running!" 