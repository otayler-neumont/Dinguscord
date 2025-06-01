# Dinguscord Message Handling Service

A high-performance message handling service for the Dinguscord chat application. This service handles real-time messaging using Socket.IO, with Redis for caching and RabbitMQ for inter-service communication.

## Features

- Real-time messaging using Socket.IO
- WebSocket support with Redis adapter for horizontal scaling
- Message persistence with PostgreSQL
- Caching with Redis for high-speed access to recent messages
- Inter-service communication using RabbitMQ
- REST API endpoints for message operations
- User presence tracking
- Typing indicators
- Read receipts
- Message delivery confirmation

## Architecture

The service follows a layered architecture:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic and orchestrate operations
- **Repositories/Models**: Handle data access and persistence
- **WebSockets**: Manage real-time communication with clients
- **Redis**: Provides caching and pub/sub capabilities
- **RabbitMQ**: Enables reliable inter-service messaging

## API Endpoints

### REST API

| Method | Endpoint                  | Description                              | Auth Required |
|--------|---------------------------|------------------------------------------|---------------|
| POST   | /messages                 | Create a new message                     | Yes           |
| GET    | /messages/room/:roomId    | Get messages for a room                  | Yes           |
| GET    | /messages/direct/:userId  | Get direct messages with another user    | Yes           |
| PUT    | /messages/delivered       | Mark messages as delivered               | Yes           |
| PUT    | /messages/read            | Mark messages as read                    | Yes           |
| DELETE | /messages/:messageId      | Delete a message                         | Yes           |
| GET    | /messages/unread/:roomId  | Get unread count for a room              | Yes           |
| GET    | /health                   | Service health check                     | No            |

### Socket.IO Events

#### Client to Server

| Event           | Data                                   | Description                         |
|-----------------|----------------------------------------|-------------------------------------|
| authenticate    | { userId, token }                      | Authenticate the socket connection  |
| join_room       | { roomId }                             | Join a chat room                    |
| leave_room      | { roomId }                             | Leave a chat room                   |
| send_message    | { room_id, receiver_id, content, ... } | Send a new message                  |
| typing          | { roomId }                             | Indicate user is typing             |
| mark_read       | { messageIds, roomId }                 | Mark messages as read               |
| delete_message  | { messageId, roomId }                  | Delete a message                    |
| get_typing_users| { roomId }                             | Get users typing in a room          |

#### Server to Client

| Event           | Data                                   | Description                         |
|-----------------|----------------------------------------|-------------------------------------|
| authenticated   | { success, error? }                    | Authentication result               |
| room_joined     | { roomId, messages, success }          | Joined room with recent messages    |
| room_left       | { roomId, success }                    | Left room confirmation              |
| user_joined     | { userId, roomId }                     | New user joined room                |
| user_left       | { userId, roomId }                     | User left room                      |
| new_message     | { message object }                     | New message received                |
| user_typing     | { userId, roomId }                     | User is typing                      |
| messages_read   | { userId, messageIds, roomId }         | User read messages                  |
| message_deleted | { messageId, roomId }                  | Message was deleted                 |
| error           | { message }                            | Error notification                  |

## Environment Variables

The service relies on the following environment variables:

```
NODE_ENV=development
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=messages
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
JWT_SECRET=your_jwt_secret_for_development_only
```

## Running the Service

### With Docker Compose

```bash
docker-compose up message-handling-service
```

### Standalone

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start
```

## Integration with other Dinguscord Services

The Message Handling Service integrates with:

- **Authentication Service**: For user authentication
- **Chat Room Service**: For room information and membership
- **User Presence Service**: For user online status
- **Notification Service**: For sending notifications about new messages
- **API Gateway**: For client access through a unified API

## Development

For local development, make sure you have the following services running:
- PostgreSQL
- Redis
- RabbitMQ

You can use the docker-compose.yml file to start these dependencies:

```bash
docker-compose up postgres redis rabbitmq
```

Then run the service in development mode:

```bash
npm run dev
``` 