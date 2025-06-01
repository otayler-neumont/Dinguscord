# Dinguscord

Dinguscord is a microservice-based chat room application providing real-time messaging capabilities.

## Services

- **Authentication Service**: Manages user authentication, registration, and authorization
- **Chat Room Service**: Handles chat room creation, deletion, and management
- **Message Handling Service**: Processes message sending, storage, and retrieval
- **User Presence Service**: Tracks online/offline status of users
- **Notification Service**: Manages system-wide and user-specific notifications
- **Frontend (DingusGui)**: SvelteKit-based user interface

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for development)

### Running the Application

#### Quick Start (Development)

The easiest way to start the entire application is using the provided script:

```bash
# Make script executable
chmod +x start-dinguscord.sh

# Run the script
./start-dinguscord.sh
```

This will:
1. Start all backend services with Docker Compose
2. Start the frontend in development mode

#### Manual Startup

If you prefer to start services individually:

1. **Start backend services**:
   ```bash
   docker-compose up -d
   ```

2. **Start frontend in development mode**:
   ```bash
   cd DingusGui/DingusMessaging
   npm install
   npm run dev
   ```

### Using the Chat Application

1. **Access the application**:
   - The frontend will be available at `http://localhost:5173`

2. **Chat Rooms**:
   - Navigate to `http://localhost:5173/chat/room/{roomName}` to join a chat room
   - Replace `{roomName}` with any room name (e.g., General, Random, Support)
   - Example: `http://localhost:5173/chat/room/General`

3. **Testing with Mock Data**:
   - The application is configured to use mock data if the backend services are not available
   - This allows you to test the UI without requiring all backend services to be functional

### Development Notes

- The frontend is configured to fallback to mock data if it cannot connect to the backend services
- To use real backend services:
  - Set `useMockData = false` in the chat room component
  - Ensure all backend services are running properly

## Project Structure

```
Dinguscord/
├── ApiGateway/                # API Gateway service
├── AuthenticationService/     # User authentication service
├── ChatRoomService/           # Chat room management service
├── DingusGui/                 # Frontend application
│   └── DingusMessaging/       # SvelteKit application
├── MessageHandlingService/    # Message processing service
├── NotificationService/       # Notification service
├── UserPresenceService/       # User presence tracking service
├── docker-compose.yml         # Docker Compose configuration
├── docker-scripts/            # Docker helper scripts
├── start-dinguscord.sh        # Startup script
└── restart-services.sh        # Service restart script
```

## Troubleshooting

### Backend Services

If you encounter issues with the backend services:

1. Check service status:
   ```bash
   docker-compose ps
   ```

2. View service logs:
   ```bash
   docker-compose logs -f <service-name>
   ```

3. Restart services:
   ```bash
   ./restart-services.sh
   ```

### Frontend

If you encounter issues with the frontend:

1. Check the browser console for error messages
2. Ensure environment variables are set correctly in `.env.development`
3. Restart the development server:
   ```bash
   cd DingusGui/DingusMessaging
   npm run dev
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

- Node.js & Express for backend services
- SvelteKit for frontend
- PostgreSQL for persistent storage
- Redis for caching and presence tracking
- RabbitMQ for message queuing
- Socket.IO for real-time communication
- Docker for containerization
