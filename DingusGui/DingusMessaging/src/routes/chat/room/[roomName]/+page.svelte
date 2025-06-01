<script lang="ts">
    import './roomStyles.css';
    import { onMount, onDestroy } from 'svelte';
    import io from 'socket.io-client';
    import { user, isAuthenticated } from '$lib/stores/user';
    import { goto } from '$app/navigation';

    export let data: {
        roomName: string;
    };

    let messages: { sender_id?: string; sender?: string; text?: string; content?: string; timestamp?: string; created_at?: string; id?: string }[] = [];
    let newMessage = '';
    let roomName = decodeURIComponent(data.roomName);
    let socket: any;
    let isConnecting = true;
    let connectionError = false;
    let username = $user?.username || 'Guest';
    let useMockData = false; // Try to connect to the real backend first

    // Mock messages for testing
    const mockMessages = [
        { 
            id: '1', 
            sender_id: 'System', 
            content: `Welcome to the ${roomName} room!`, 
            created_at: new Date().toISOString() 
        },
        { 
            id: '2', 
            sender_id: 'Alice', 
            content: 'Hey everyone!', 
            created_at: new Date(Date.now() - 3600000).toISOString() 
        },
        { 
            id: '3', 
            sender_id: 'Bob', 
            content: 'Hi Alice, what\'s up?', 
            created_at: new Date(Date.now() - 3500000).toISOString() 
        },
        { 
            id: '4', 
            sender_id: 'Charlie', 
            content: 'Just joined the chat. What are we talking about?', 
            created_at: new Date(Date.now() - 3400000).toISOString() 
        }
    ];

    onMount(async () => {
        // Check if user is authenticated
        if (!$isAuthenticated) {
            goto('/');
            return;
        }

        try {
            if (useMockData) {
                // Use mock data
                isConnecting = false;
                messages = mockMessages;
                return;
            }

            // Attempt to connect to real backend
            const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3003';
            console.log(`Attempting to connect to Socket.IO server at ${SOCKET_URL}`);
            
            socket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000,
                withCredentials: false // Try with CORS credentials disabled
            });

            // Connection events
            socket.on('connect', () => {
                console.log('Socket connected successfully');
                
                // Authenticate with user ID from store
                socket.emit('authenticate', { 
                    userId: $user?.id || username, 
                    username: $user?.display_name || $user?.username || username
                });
            });

            socket.on('authenticated', (data: any) => {
                if (data.success) {
                    console.log('Authenticated successfully');
                    
                    // Join the room
                    socket.emit('join_room', { roomId: roomName });
                } else {
                    console.error('Authentication failed:', data.error);
                    connectionError = true;
                }
            });

            socket.on('room_joined', (data: any) => {
                if (data.success) {
                    console.log('Joined room:', data);
                    isConnecting = false;
                    
                    // Set messages from server if available
                    if (data.messages && Array.isArray(data.messages)) {
                        messages = data.messages;
                    } else {
                        // Fallback to mock messages
                        messages = mockMessages;
                    }
                }
            });

            socket.on('new_message', (message: any) => {
                console.log('Received new message:', message);
                messages = [...messages, message];
                
                // Auto-scroll to bottom
                setTimeout(() => {
                    const chatLog = document.querySelector('.chat-log');
                    if (chatLog) {
                        chatLog.scrollTop = chatLog.scrollHeight;
                    }
                }, 100);
            });

            socket.on('connect_error', (error: any) => {
                console.error('Connection error:', error);
                connectionError = true;
                isConnecting = false;
                // Fallback to mock mode
                console.log('Falling back to mock data due to connection error');
                useMockData = true;
                messages = mockMessages;
            });

            socket.on('error', (error: any) => {
                console.error('Socket error:', error);
                connectionError = true;
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
        } catch (error) {
            console.error('Error setting up socket:', error);
            connectionError = true;
            isConnecting = false;
            // Fallback to mock mode
            console.log('Falling back to mock data due to setup error');
            useMockData = true;
            messages = mockMessages;
        }
    });

    onDestroy(() => {
        if (socket) {
            // Leave room and disconnect socket
            if (socket.connected) {
                socket.emit('leave_room', { roomId: roomName });
                socket.disconnect();
            }
        }
    });

    async function sendMessage() {
        if (!newMessage.trim()) return;
        
        try {
            if (useMockData) {
                // Mock sending a message
                const mockMessage = {
                    id: Math.random().toString(36).substring(7),
                    sender_id: username,
                    content: newMessage,
                    created_at: new Date().toISOString()
                };
                
                messages = [...messages, mockMessage];
                newMessage = '';
                
                // Auto-scroll
                setTimeout(() => {
                    const chatLog = document.querySelector('.chat-log');
                    if (chatLog) {
                        chatLog.scrollTop = chatLog.scrollHeight;
                    }
                }, 100);
                
                return;
            }
            
            // Send message via socket
            if (socket && socket.connected) {
                console.log('Sending message via socket:', newMessage);
                socket.emit('send_message', {
                    room_id: roomName,
                    content: newMessage
                }, (response: any) => {
                    if (response?.success) {
                        console.log('Message sent successfully:', response);
                        newMessage = '';
                    } else {
                        console.error('Failed to send message:', response?.error || 'No response');
                    }
                });
            } else {
                console.error('Socket not connected, cannot send message');
                connectionError = true;
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    function isUserMessage(message: any): boolean {
        return message.sender_id === ($user?.id || username);
    }

    function getDisplayContent(message: any): string {
        return message.content || message.text || '';
    }

    function getDisplayName(message: any): string {
        if (message.sender_id === ($user?.id || username)) {
            return 'You';
        }
        return message.sender || message.sender_id || 'Unknown';
    }

    function getTimestamp(message: any): string {
        const timestamp = message.timestamp || message.created_at;
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }
</script>

<div class="chat-container">
    <h1>{roomName} Room</h1>
    
    {#if isConnecting}
        <div class="loading">
            <p>Connecting to chat room...</p>
        </div>
    {:else if connectionError}
        <div class="error">
            <p>Error connecting to the chat room. Using mock data instead.</p>
            <button on:click={() => window.location.reload()}>Retry</button>
        </div>
    {:else}
        <div class="chat-log">
            {#each messages as message}
                <div class="message {isUserMessage(message) ? 'user' : 'other'}">
                    <div class="sender">{getDisplayName(message)}</div>
                    <div class="text">{getDisplayContent(message)}</div>
                    {#if getTimestamp(message)}
                        <div class="timestamp">{getTimestamp(message)}</div>
                    {/if}
                </div>
            {/each}
        </div>
        
        <div class="message-input">
            <input 
                type="text" 
                bind:value={newMessage} 
                placeholder="Type your message..." 
                on:keydown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button on:click={sendMessage}>Send</button>
        </div>
        
        <div class="connection-status">
            {#if useMockData}
                <p class="mock-data-notice">Using mock data. Real-time updates not available.</p>
            {/if}
        </div>
    {/if}
</div>

<style>
.connection-status {
    margin-top: 10px;
    font-size: 0.8em;
    color: #666;
    text-align: center;
}

.mock-data-notice {
    background-color: #fff3cd;
    color: #856404;
    padding: 5px 10px;
    border-radius: 4px;
    display: inline-block;
}
</style>