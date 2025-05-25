require('dotenv').config();

module.exports = {
  // Server configuration
  node_env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  
  // Database configuration
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'messages',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  },
  
  // RabbitMQ configuration
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
    exchanges: {
      messageEvents: 'message.events'
    },
    queues: {
      messageBroadcast: 'message.broadcast',
      messageNotification: 'message.notification'
    }
  },

  // JWT configuration for message authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_for_development_only',
    expiresIn: '24h'
  }
}; 