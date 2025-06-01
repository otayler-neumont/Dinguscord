FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY DingusMessaging/package*.json ./

# Install dependencies
RUN npm install

# Copy app files
COPY DingusMessaging/ ./

# Build the app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets from the build stage
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./

# Install production dependencies only
RUN npm install --only=production

EXPOSE 3000

CMD ["node", "build"] 