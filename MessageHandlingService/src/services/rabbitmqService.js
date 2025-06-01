const amqp = require('amqplib');
const config = require('../config/config');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.messageHandlers = new Map();
    
    // Exchange names
    this.exchanges = config.rabbitmq.exchanges;
    
    // Queue names
    this.queues = config.rabbitmq.queues;
    
    // Attempt to connect when service is instantiated
    this.connect();
  }
  
  // Connect to RabbitMQ
  async connect() {
    try {
      // Create connection
      this.connection = await amqp.connect(config.rabbitmq.url);
      
      // Handle connection close and try to reconnect
      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed, trying to reconnect...');
        this.connected = false;
        setTimeout(() => this.connect(), 5000);
      });
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.connected = false;
        
        // Close connection
        if (this.connection) {
          this.connection.close();
        }
      });
      
      // Create channel
      this.channel = await this.connection.createChannel();
      
      // Set prefetch to control how many messages can be processed simultaneously
      await this.channel.prefetch(10);
      
      // Create exchanges
      await this.channel.assertExchange(
        this.exchanges.messageEvents,
        'topic',
        { durable: true }
      );
      
      // Set up queues
      await this.setupQueues();
      
      console.log('Connected to RabbitMQ');
      this.connected = true;
      
      // Start consumers if there are any registered handlers
      if (this.messageHandlers.size > 0) {
        this.startConsumers();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      this.connected = false;
      
      // Try to reconnect after a delay
      setTimeout(() => this.connect(), 5000);
      return false;
    }
  }
  
  // Set up queues
  async setupQueues() {
    try {
      // Message broadcast queue - for sending messages to all connected clients
      await this.channel.assertQueue(this.queues.messageBroadcast, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': 'dlq.message.broadcast'
        }
      });
      
      // Bind queue to exchange with appropriate routing key
      await this.channel.bindQueue(
        this.queues.messageBroadcast,
        this.exchanges.messageEvents,
        'message.#'
      );
      
      // Notification queue - for sending notifications to other services
      await this.channel.assertQueue(this.queues.messageNotification, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': 'dlq.message.notification'
        }
      });
      
      // Bind queue to exchange with appropriate routing key
      await this.channel.bindQueue(
        this.queues.messageNotification,
        this.exchanges.messageEvents,
        'notification.#'
      );
      
      // Set up dead letter exchange and queue
      await this.channel.assertExchange('dlx', 'direct', { durable: true });
      
      await this.channel.assertQueue('dlq.message.broadcast', {
        durable: true
      });
      
      await this.channel.bindQueue(
        'dlq.message.broadcast',
        'dlx',
        'dlq.message.broadcast'
      );
      
      await this.channel.assertQueue('dlq.message.notification', {
        durable: true
      });
      
      await this.channel.bindQueue(
        'dlq.message.notification',
        'dlx',
        'dlq.message.notification'
      );
    } catch (error) {
      console.error('Error setting up RabbitMQ queues:', error);
      throw error;
    }
  }
  
  // Publish a message to RabbitMQ
  async publishMessage(routingKey, message, options = {}) {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      // Ensure message is a buffer
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      // Default options with persistence
      const publishOptions = {
        persistent: true,
        ...options
      };
      
      // Publish to the exchange
      await this.channel.publish(
        this.exchanges.messageEvents,
        routingKey,
        messageBuffer,
        publishOptions
      );
      
      console.log(`Published message to ${routingKey}: ${JSON.stringify(message)}`);
      return true;
    } catch (error) {
      console.error(`Error publishing message to ${routingKey}:`, error);
      return false;
    }
  }
  
  // Register a message handler for a specific queue
  registerHandler(queueName, handler) {
    this.messageHandlers.set(queueName, handler);
    
    // If already connected, start consuming
    if (this.connected) {
      this.startConsumer(queueName, handler);
    }
  }
  
  // Start consumers for all registered handlers
  async startConsumers() {
    for (const [queueName, handler] of this.messageHandlers.entries()) {
      await this.startConsumer(queueName, handler);
    }
  }
  
  // Start a consumer for a specific queue
  async startConsumer(queueName, handler) {
    try {
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;
        
        try {
          // Parse the message
          const content = JSON.parse(msg.content.toString());
          
          // Process the message with the handler
          await handler(content, msg.fields.routingKey);
          
          // Acknowledge the message if processing was successful
          this.channel.ack(msg);
        } catch (error) {
          console.error(`Error processing message from ${queueName}:`, error);
          
          // Reject the message and requeue it if it hasn't been retried too many times
          // Check the x-death header for retry count
          const xDeath = msg.properties.headers && msg.properties.headers['x-death'];
          const retryCount = xDeath ? xDeath[0].count : 0;
          
          if (retryCount < 3) {
            // Reject and requeue
            this.channel.reject(msg, true);
          } else {
            // Reject without requeuing (will go to dead letter queue)
            this.channel.reject(msg, false);
          }
        }
      });
      
      console.log(`Started consumer for queue: ${queueName}`);
    } catch (error) {
      console.error(`Error starting consumer for queue ${queueName}:`, error);
    }
  }
  
  // Close the connection
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      
      if (this.connection) {
        await this.connection.close();
      }
      
      this.connected = false;
      console.log('Closed RabbitMQ connection');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}

// Create a singleton instance
const rabbitMQService = new RabbitMQService();

module.exports = rabbitMQService; 