<script lang="ts">
    import './roomStyles.css';
    import { onMount, onDestroy } from 'svelte';
    import { messageApi } from '$lib/apiClient';
    import io from 'socket.io-client';

    export let data: {
        roomName: string;
    };

    let messages: { sender: string; text: string; timestamp?: string }[] = [];
    let newMessage = '';
    let roomName = decodeURIComponent(data.roomName);
    let socket: any;
    let isConnecting = true;
    let connectionError = false;
    
    // Mock data for testing when API isn't ready
    const mockMessages = [
        { sender: 'System', text: 'Welcome to the ' + roomName + ' room!', timestamp: new Date().toISOString() },
        { sender: 'Alice', text: 'Hey everyone!', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { sender: 'Bob', text: 'How are you all doing today?', timestamp: new Date(Date.now() - 3500000).toISOString() },
        { sender: 'Charlie', text: 'Just wanted to say hi!', timestamp: new Date(Date.now() - 1800000).toISOString() }
    ];

    onMount(async () => {
        try {
            // Try to fetch initial messages from API
            try {
                const result = await messageApi.getRoomMessages(roomName);
                messages = result.length ? result : mockMessages;
            } catch (error) {
                console.warn('Failed to fetch messages from API, using mock data', error);
                messages = mockMessages;
            }
            
            // Connect to real-time socket
            try {
                const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3003';
                socket = io(SOCKET_URL, {
                    reconnectionAttempts: 3,
                    timeout: 5000,
                    transports: ['websocket', 'polling']
                });
                
                // Socket event listeners
                socket.on('connect', () => {
                    isConnecting = false;
                    console.log('Connected to socket server');
                    // Authenticate and join room
                    socket.emit('authenticate', { 
                        userId: localStorage.getItem('user_id') || 'test-user',
                        token: localStorage.getItem('auth_token') || 'mock-token'
                    });
                    socket.emit('join_room', { roomId: roomName });
                });
                
                socket.on('new_message', (message: any) => {
                    console.log('New message received:', message);
                    if (message.room_id === roomName || message.roomId === roomName) {
                        messages = [...messages, message];
                    }
                });
                
                socket.on('connect_error', (err: any) => {
                    console.error('Socket connection error:', err);
                    connectionError = true;
                    isConnecting = false;
                });
                
                socket.on('error', (err: any) => {
                    console.error('Socket error:', err);
                });
                
                // Set a timeout for connection
                setTimeout(() => {
                    if (isConnecting) {
                        isConnecting = false;
                        connectionError = true;
                        console.warn('Socket connection timed out');
                    }
                }, 5000);
            } catch (error) {
                console.error('Error setting up socket connection:', error);
                connectionError = true;
                isConnecting = false;
            }
        } catch (error) {
            console.error('Error initializing chat room:', error);
            connectionError = true;
            isConnecting = false;
        }
    });
    
    onDestroy(() => {
        if (socket) {
            try {
                socket.emit('leave_room', { roomId: roomName });
                socket.disconnect();
            } catch (error) {
                console.error('Error disconnecting socket:', error);
            }
        }
    });

    async function sendMessage() {
        if (!newMessage.trim()) return;

        try {
            // Try to send via REST API
            try {
                const saved = await messageApi.sendRoomMessage(roomName, newMessage);
                
                // If we're not using sockets or there's an error, update UI directly
                if (!socket || !socket.connected) {
                    messages = [...messages, saved];
                }
            } catch (error) {
                console.warn('Failed to send message via API, using mock data', error);
                // Add mock message to UI if API fails
                const mockMessage = {
                    sender: 'You',
                    text: newMessage,
                    timestamp: new Date().toISOString()
                };
                messages = [...messages, mockMessage];
                
                // Try to emit via socket if available
                if (socket && socket.connected) {
                    socket.emit('send_message', {
                        room_id: roomName,
                        text: newMessage,
                        sender: 'You'
                    });
                }
            }
            
            newMessage = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    }
</script>

<h2>Chat Room: {roomName}</h2>

{#if isConnecting}
    <p>Connecting to chat room...</p>
{:else if connectionError}
    <p class="error">Could not connect to chat server. Messages will not update in real-time.</p>
{/if}

<div class="chat-log">
    {#each messages as msg}
        <div class="message {msg.sender === 'You' ? 'user' : 'other'}">
            <span class="sender">{msg.sender}</span>
            <span class="text">{msg.text}</span>
            {#if msg.timestamp}
                <span class="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            {/if}
        </div>
    {/each}
</div>

<div class="message-input">
    <input
        bind:value={newMessage}
        placeholder="Type a message..."
        on:keypress={(e) => e.key === 'Enter' && sendMessage()}
    />
    <button on:click={sendMessage}>Send</button>
</div> 