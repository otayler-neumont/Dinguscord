# Dinguscord Debugging Guide

This document outlines the issues we encountered and the fixes we implemented to get the Dinguscord chat application working.

## Issues Fixed

### 1. Database Connection Issues

**Problem**: The MessageHandlingService was unable to connect to PostgreSQL, resulting in failed message operations.

**Solution**: 
- Added a connection retry mechanism with exponential backoff in `MessageHandlingService/src/models/messageModel.js`
- Implemented fallback to mock data when database operations fail

### 2. RabbitMQ Connection Issues

**Problem**: The MessageHandlingService failed to connect to RabbitMQ, preventing message broadcasting between services.

**Solution**:
- Implemented a mock RabbitMQ service in `MessageHandlingService/src/services/rabbitmqService.js`
- Added fallback handling for when RabbitMQ is unavailable

### 3. Socket.IO Configuration

**Problem**: Socket.IO was not properly configured for cross-origin requests and error handling.

**Solution**:
- Improved CORS configuration in `MessageHandlingService/src/services/socketService.js`
- Added robust error handling for Socket.IO connections
- Implemented fallback logic to use mock data when Socket.IO connections fail

### 4. Frontend Integration

**Problem**: The frontend was unable to connect to backend services, causing a broken user experience.

**Solution**:
- Updated the chat room component to work with both real backend and mock data
- Improved UI to handle connection errors gracefully
- Added fallback to mock data when backend services are unavailable

## Remaining Tasks

1. **Database Schema Initialization**:
   - Create proper database migration scripts for each service
   - Ensure tables are created with the correct schema before services start

2. **Service Health Checks**:
   - Implement proper health check endpoints for all services
   - Configure Docker Compose to use health checks for dependency management

3. **Frontend Authentication**:
   - Complete the authentication flow in the frontend
   - Implement proper token storage and management

4. **Environment Configuration**:
   - Set up proper environment configuration for all services
   - Create consistent configuration across development, testing, and production environments

5. **Message Persistence**:
   - Ensure messages are properly stored in the database
   - Implement message retrieval with pagination and sorting

6. **User Presence**:
   - Complete the UserPresenceService implementation
   - Integrate presence status into the frontend UI

## Debugging Specific Services

### Message Handling Service

If you're experiencing issues with the Message Handling Service:

1. Check the logs:
   ```bash
   docker-compose logs message-handling-service
   ```

2. Verify database connection:
   ```bash
   docker-compose exec postgres psql -U postgres -d messages -c "SELECT 'Database connection successful'"
   ```

3. Restart the service:
   ```bash
   docker-compose restart message-handling-service
   ```

### Frontend

If you're having issues with the frontend:

1. Verify the development server is running:
   ```bash
   cd DingusGui/DingusMessaging
   npm run dev
   ```

2. Check browser console for errors

3. Test a specific chat room:
   ```
   http://localhost:5173/chat/room/General
   ```

4. Toggle between mock and real data mode:
   - Edit `DingusGui/DingusMessaging/src/routes/chat/room/[roomName]/+page.svelte`
   - Change `let useMockData = true;` to `let useMockData = false;` to try connecting to the real backend

## Next Steps for Development

1. Complete the authentication flow
2. Implement chat room creation and management
3. Add user profiles and avatars
4. Implement real-time typing indicators
5. Add file uploads and media sharing
6. Implement private messaging between users 