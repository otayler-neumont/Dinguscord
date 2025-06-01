const amqp = require('amqplib');
const config = require('../config/config');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.mockMessageHandlers = new Map();
    
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
      
      // Use mock implementations if RabbitMQ is not available
      this.useMockImplementation();
      
      // Try to reconnect after a delay
      setTimeout(() => this.connect(), 5000);
      return false;
    }
  }
  
  // Use mock implementation when RabbitMQ is not available
  useMockImplementation() {
    console.log('Using mock RabbitMQ implementation');
    
    // Start a periodic task to process mock messages
    if (this.mockInterval) clearInterval(this.mockInterval);
    
    this.mockInterval = setInterval(() => {
      // Process any mock messages for registered handlers
      this.mockMessageHandlers.forEach((handler, queueName) => {
        // Occasionally simulate a message for testing
        if (Math.random() < 0.1) {
          const mockMessage = {
            content: JSON.stringify({
              type: 'mock_message',
              data: { timestamp: new Date().toISOString() }
            })
          };
          const mockRoutingKey = 'mock.routing.key';
          
          console.log(`Processing mock message for queue: ${queueName}`);
          handler(JSON.parse(mockMessage.content), mockRoutingKey);
        }
      });
    }, 10000); // Check every 10 seconds
  }
  
  // Set up queues
  async setupQueues() {
    try {
      // Create queues for each registered handler
      for (const [queueName, handler] of this.messageHandlers.entries()) {
        await this.channel.assertQueue(queueName, { durable: true });
        
        // Bind queue to exchange with appropriate routing key
        await this.channel.bindQueue(
          queueName,
          this.exchanges.messageEvents,
          `${queueName}.*`
        );
        
        console.log(`Queue '${queueName}' set up successfully`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to set up queues:', error);
      return false;
    }
  }
  
  // Start message consumers
  startConsumers() {
    try {
      // Start a consumer for each registered handler
      for (const [queueName, handler] of this.messageHandlers.entries()) {
        this.channel.consume(queueName, (msg) => {
          if (msg !== null) {
            try {
              // Parse message content
              const content = JSON.parse(msg.content.toString());
              
              // Process the message with the registered handler
              handler(content, msg.fields.routingKey);
              
              // Acknowledge the message
              this.channel.ack(msg);
            } catch (error) {
              console.error(`Error processing message from queue '${queueName}':`, error);
              
              // Reject the message and requeue it
              this.channel.nack(msg, false, true);
            }
          }
        });
        
        console.log(`Started consumer for queue: ${queueName}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to start consumers:', error);
      return false;
    }
  }
  
  // Register a message handler for a queue
  registerHandler(queueName, handler) {
    this.messageHandlers.set(queueName, handler);
    this.mockMessageHandlers.set(queueName, handler);
    
    // If already connected, set up the queue and start the consumer
    if (this.connected && this.channel) {
      this.setupQueues().then(() => this.startConsumers());
    }
    
    console.log(`Handler registered for queue: ${queueName}`);
    return true;
  }
  
  // Publish a message to an exchange
  async publish(routingKey, message) {
    try {
      if (!this.connected || !this.channel) {
        console.warn('Not connected to RabbitMQ, using mock implementation');
        
        // If we're using mock handlers and one exists for this routing key
        const queuePrefix = routingKey.split('.')[0];
        const mockHandler = this.mockMessageHandlers.get(queuePrefix);
        
        if (mockHandler) {
          console.log(`Mock publishing message with routing key: ${routingKey}`);
          setTimeout(() => mockHandler(message, routingKey), 100);
          return true;
        }
        
        return false;
      }
      
      // Publish message to exchange
      this.channel.publish(
        this.exchanges.messageEvents,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      
      console.log(`Published message with routing key: ${routingKey}`);
      return true;
    } catch (error) {
      console.error('Failed to publish message:', error);
      return false;
    }
  }
  
  // Alias for publish method for compatibility
  async publishMessage(routingKey, message) {
    return this.publish(routingKey, message);
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
const rabbitmqService = new RabbitMQService();

module.exports = rabbitmqService; 