# Dinguscord

Dinguscord is a microservice-based chat room application providing real-time messaging capabilities.

## Services

- **Authentication Service**: Manages user authentication, registration, and authorization
- **Chat Room Service**: Handles chat room creation, deletion, and management
- **Message Handling Service**: Processes message sending, storage, and retrieval
- **User Presence Service**: Tracks online/offline status of users
- **Notification Service**: Manages system-wide and user-specific notifications

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for development)

### Running the Application

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up authentication-service
```

## Development

Each service follows a similar structure with its own:
- API endpoints
- Database connections
- Health checks
- Dockerfile

### Health Checks

All services expose a `/health` endpoint returning status 200/503

## Tech Stack

- Node.js & Express
- PostgreSQL for persistent storage
- Redis for caching and presence tracking
- RabbitMQ for message queuing
- Docker for containerization
