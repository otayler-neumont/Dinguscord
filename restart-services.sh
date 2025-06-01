#!/bin/bash

# Script to restart the backend services
echo "Stopping all services..."
docker-compose down

echo "Rebuilding message-handling-service..."
docker-compose build message-handling-service

echo "Starting all services..."
docker-compose up -d

echo "Waiting for services to start..."
sleep 5

echo "Checking message-handling-service logs..."
docker-compose logs --tail=50 message-handling-service

echo "Services restarted! You can now connect from the frontend."
echo "To check logs use: docker-compose logs -f <service-name>"
echo "Available services: api-gateway, authentication-service, chat-room-service, message-handling-service, notification-service" 