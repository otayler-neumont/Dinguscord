<script lang="ts">
    import './roomStyles.css';
    import { onMount, onDestroy } from 'svelte';
    import io from 'socket.io-client';
    import { user, isAuthenticated, token } from '$lib/stores/user';
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
    let useMockData = false;
    let chatLogElement: HTMLElement;
    
    // User invitation state
    let showAddMembersModal = false;
    let userSearch = '';
    let searchResults: any[] = [];
    let addingUser = false;
    let searchingUsers = false;

    function scrollToBottom() {
        if (chatLogElement) {
            chatLogElement.scrollTop = chatLogElement.scrollHeight;
        }
    }

    function formatTime(timestamp: string) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatContent(content: string | undefined, text: string | undefined) {
        return content || text || '';
    }

    function formatSenderName(message: any): string {
        // Use the new enriched sender information if available
        if (message.sender_display_name) {
            return message.sender_display_name;
        }
        
        if (message.sender_name) {
            return message.sender_name;
        }
        
        // Fallback to old logic if enriched data is not available
        if (message.sender_id === $user?.id) {
            return 'You';
        }
        
        // For UUID-like sender_ids, create a friendly name
        if (message.sender_id && message.sender_id.includes('-')) {
            // Generate a consistent user name based on the UUID
            const userNum = parseInt(message.sender_id.substring(0, 8), 16) % 1000;
            return `User${userNum}`;
        }
        
        // Return sender_id if all else fails
        return message.sender_id || 'Unknown User';
    }

    function isCurrentUser(message: any) {
        return message.sender_id === ($user?.id || $user?.username || username);
    }

    onMount(async () => {
        // Check if user is authenticated
        if (!$isAuthenticated) {
            goto('/');
            return;
        }

        // Clear any cached messages and force fresh start
        messages = [];
        
        try {
            // Connect to real MessageHandlingService
            const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3003';
            console.log(`Connecting to Socket.IO server at ${SOCKET_URL}`);
            
            socket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 10000,
                withCredentials: false
            });

            // Connection events
            socket.on('connect', () => {
                console.log('Socket connected successfully');
                isConnecting = false;
                connectionError = false;
                
                // Authenticate with user ID from store
                socket.emit('authenticate', { 
                    userId: $user?.id || $user?.username || username, 
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
                    
                    // Set messages from server if available
                    if (data.messages && Array.isArray(data.messages)) {
                        messages = data.messages;
                    } else {
                        // Load messages via API if not provided via socket
                        loadRoomMessages();
                    }
                    
                    setTimeout(scrollToBottom, 100);
                }
            });

            socket.on('new_message', (message: any) => {
                console.log('Received new message:', message);
                messages = [...messages, message];
                
                // Auto-scroll to bottom
                setTimeout(scrollToBottom, 100);
            });

            socket.on('connect_error', (error: any) => {
                console.error('Connection error:', error);
                connectionError = true;
                isConnecting = false;
                
                // Try to load messages via REST API as fallback
                loadRoomMessages();
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
            
            // Fallback: Load messages via REST API
            loadRoomMessages();
        }
    });

    // Load messages via REST API (fallback when socket fails)
    async function loadRoomMessages() {
        try {
            // Get token from store
            let currentToken: string | null = null;
            const unsubscribe = token.subscribe(value => {
                currentToken = value;
            });
            unsubscribe();

            const response = await fetch(`http://localhost:3003/messages/room/${roomName}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken || ''}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                messages = data || [];
                setTimeout(scrollToBottom, 100);
            } else {
                console.warn('Failed to load messages, using empty room');
                messages = [];
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            messages = [];
        }
    }

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
            // Send message via socket first (real-time)
            if (socket && socket.connected) {
                console.log('Sending message via socket:', newMessage);
                socket.emit('send_message', {
                    room_id: roomName,
                    content: newMessage
                }, (response: any) => {
                    if (response?.success) {
                        console.log('Message sent successfully via socket');
                    } else {
                        console.error('Failed to send message via socket:', response?.error);
                        // Fallback to REST API
                        sendMessageViaAPI();
                    }
                });
                
                newMessage = '';
            } else {
                // Fallback: Send via REST API
                await sendMessageViaAPI();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    // Send message via REST API (fallback)
    async function sendMessageViaAPI() {
        try {
            // Get token from store
            let currentToken: string | null = null;
            const unsubscribe = token.subscribe(value => {
                currentToken = value;
            });
            unsubscribe();

            const response = await fetch('http://localhost:3003/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken || ''}`
                },
                body: JSON.stringify({
                    room_id: roomName,
                    content: newMessage
                })
            });

            if (response.ok) {
                const sentMessage = await response.json();
                console.log('Message sent successfully via API');
                
                // Add to local messages if not already added by socket
                if (!messages.find(m => m.id === sentMessage.id)) {
                    messages = [...messages, sentMessage];
                    setTimeout(scrollToBottom, 100);
                }
                
                newMessage = '';
            } else {
                console.error('Failed to send message via API');
                alert('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message via API:', error);
            alert('Network error. Please check your connection.');
        }
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function retryConnection() {
        window.location.reload();
    }

    // User invitation functions
    function openAddMembersModal() {
        showAddMembersModal = true;
        userSearch = '';
        searchResults = [];
    }

    function closeAddMembersModal() {
        showAddMembersModal = false;
        userSearch = '';
        searchResults = [];
        addingUser = false;
        searchingUsers = false;
    }

    // Ensure room exists in ChatRoomService
    async function ensureRoomExists() {
        try {
            // Get token from store
            let currentToken: string | null = null;
            const unsubscribe = token.subscribe(value => {
                currentToken = value;
            });
            unsubscribe();

            // Check if room exists
            const checkResponse = await fetch(`http://localhost:3002/rooms/${roomName}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken || ''}`
                }
            });

            if (checkResponse.status === 404) {
                // Room doesn't exist, create it
                console.log('Room not found, creating room:', roomName);
                const createResponse = await fetch('http://localhost:3002/rooms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentToken || ''}`
                    },
                    body: JSON.stringify({
                        name: roomName,
                        userId: $user?.id || $user?.username || username,
                        allowJoinExisting: true  // Allow joining if room exists
                    })
                });

                if (createResponse.ok) {
                    const result = await createResponse.json();
                    if (result.success) {
                        console.log('Room operation successful:', result.message, result.room);
                    } else {
                        console.error('Room creation failed:', result.message);
                    }
                } else if (createResponse.status === 409) {
                    // Room name conflict
                    const errorResult = await createResponse.json();
                    console.warn('Room name conflict:', errorResult.message);
                    // For our use case, we'll continue anyway since the room exists
                } else {
                    console.error('Failed to create room:', createResponse.status);
                }
            } else if (checkResponse.ok) {
                console.log('Room already exists');
            }
        } catch (error) {
            console.error('Error ensuring room exists:', error);
        }
    }

    async function searchUsers() {
        if (!userSearch.trim()) {
            searchResults = [];
            return;
        }

        searchingUsers = true;
        
        try {
            // Get token from store
            let currentToken: string | null = null;
            const unsubscribe = token.subscribe(value => {
                currentToken = value;
            });
            unsubscribe();

            console.log('Searching for users with query:', userSearch);
            console.log('Using token:', currentToken ? 'Token exists' : 'No token');

            // Search for real users via AuthenticationService
            const response = await fetch(`http://localhost:3001/auth/users/search?q=${encodeURIComponent(userSearch)}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken || ''}`
                }
            });
            
            console.log('Search response status:', response.status);
            console.log('Search response headers:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Search API result:', result);
                searchResults = result.users || [];
                console.log('Final search results:', searchResults);
            } else {
                const errorText = await response.text();
                console.error('Failed to search users:', response.status, errorText);
                searchResults = [];
            }
            
        } catch (error) {
            console.error('Error searching users:', error);
            searchResults = [];
        } finally {
            searchingUsers = false;
        }
    }

    async function addUserToRoom(user: any) {
        addingUser = true;
        
        try {
            // Ensure room exists first
            await ensureRoomExists();
            
            // Get token from store
            let currentToken: string | null = null;
            const unsubscribe = token.subscribe(value => {
                currentToken = value;
            });
            unsubscribe();

            console.log('Adding user to room:', user);
            console.log('Room name:', roomName);
            console.log('User ID:', user.id);
            
            const apiUrl = `http://localhost:3002/rooms/${roomName}/add/${user.id}`;
            console.log('API URL:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken || ''}`
                }
            });
            
            console.log('Add user response status:', response.status);
            console.log('Add user response headers:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('User added to room successfully:', result);
                
                // Remove user from search results
                searchResults = searchResults.filter(u => u.id !== user.id);
                
                // Show success message
                alert(`${user.display_name || user.username} has been added to the room!`);
                
                // Send notification via socket if connected
                if (socket && socket.connected) {
                    socket.emit('room_member_added', {
                        room_id: roomName,
                        user_id: user.id,
                        username: user.display_name || user.username
                    });
                }
                
            } else {
                const errorData = await response.json();
                console.error('Failed to add user to room - Response:', errorData);
                console.error('Response status:', response.status);
                alert('Failed to add user to room. They may already be a member.');
            }
        } catch (error) {
            console.error('Error adding user to room:', error);
            alert('Network error. Please check your connection.');
        } finally {
            addingUser = false;
        }
    }

    // Reactive search
    $: if (userSearch) {
        searchUsers();
    } else {
        searchResults = [];
    }
</script>

<div class="chat-room-container">
    <div class="chat-container">
        <!-- Room Header -->
        <div class="room-header">
            <div>
                <h1>#{roomName}</h1>
                <div class="room-members">
                    {#if isConnecting}
                        Connecting...
                    {:else if connectionError}
                        Connection Error - Using Offline Mode
                    {:else if socket && socket.connected}
                        Connected - Live Chat
                    {:else}
                        Offline Mode
                    {/if}
                </div>
            </div>
            <div class="room-actions">
                <button class="room-action-btn" on:click={() => goto('/dashboard')}>
                    ← Back to Dashboard
                </button>
                <button class="room-action-btn" on:click={openAddMembersModal} title="Add members to room">
                    👥 Add Members
                </button>
                {#if connectionError}
                    <button class="room-action-btn" on:click={retryConnection}>
                        🔄 Retry
                    </button>
                {/if}
            </div>
        </div>

        <!-- Chat Messages -->
        <div class="chat-log" bind:this={chatLogElement}>
            {#if isConnecting}
                <div class="loading">
                    <p>Connecting to chat room...</p>
                </div>
            {:else if connectionError && messages.length === 0}
                <div class="error">
                    <p>Failed to connect to the chat server. You can still view the chat interface in demo mode.</p>
                    <button on:click={retryConnection}>Try Again</button>
                </div>
            {:else}
                {#each messages as message}
                    <div class="message {isCurrentUser(message) ? 'user' : 'other'}">
                        <div class="sender">{formatSenderName(message)}</div>
                        <div class="content">{formatContent(message.content, message.text)}</div>
                        <div class="timestamp">
                            {formatTime(message.created_at || message.timestamp || new Date().toISOString())}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Message Input -->
        <div class="message-input-container">
            <div class="message-input">
                <input
                    type="text"
                    bind:value={newMessage}
                    on:keydown={handleKeyPress}
                    placeholder="Type your message here..."
                    disabled={isConnecting}
                />
                <button 
                    on:click={sendMessage} 
                    disabled={!newMessage.trim() || isConnecting}
                    title="Send message"
                >
                    <span>→</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Add Members Modal -->
{#if showAddMembersModal}
    <div class="modal-overlay" on:click={closeAddMembersModal}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h3>Add Members to #{roomName}</h3>
                <button class="close-button" on:click={closeAddMembersModal}>&times;</button>
            </div>
            <div class="modal-body">
                <div class="search-section">
                    <input
                        type="text"
                        placeholder="Search for users..."
                        bind:value={userSearch}
                        class="user-search-input"
                        disabled={addingUser}
                    />
                    {#if searchingUsers}
                        <div class="searching-message">Searching...</div>
                    {/if}
                </div>
                
                {#if searchResults.length > 0}
                    <div class="search-results">
                        <h4>Found Users:</h4>
                        <ul class="user-list">
                            {#each searchResults as user}
                                <li class="user-item">
                                    <div class="user-info">
                                        <span class="user-name">{user.display_name || user.username}</span>
                                        <span class="username">@{user.username}</span>
                                    </div>
                                    <button 
                                        class="add-user-btn" 
                                        on:click={() => addUserToRoom(user)}
                                        disabled={addingUser}
                                    >
                                        {addingUser ? 'Adding...' : 'Add'}
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {:else if userSearch && !searchingUsers}
                    <div class="no-results">
                        <p>No users found matching "{userSearch}"</p>
                    </div>
                {:else if !userSearch}
                    <div class="search-prompt">
                        <p>Start typing to search for users to add to this room.</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

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

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 15px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    padding: 20px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
}

.close-button {
    background: none;
    border: none;
    color: white;
    font-size: 28px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.3s ease;
}

.close-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
}

.modal-body {
    padding: 25px;
    max-height: 60vh;
    overflow-y: auto;
}

.search-section {
    margin-bottom: 20px;
}

.user-search-input {
    width: 100%;
    padding: 15px 20px;
    font-size: 16px;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    box-sizing: border-box;
    transition: all 0.3s ease;
}

.user-search-input:focus {
    border-color: #3498db;
    outline: none;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.searching-message {
    text-align: center;
    color: #7f8c8d;
    font-style: italic;
    margin-top: 10px;
}

.search-results h4 {
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-size: 16px;
}

.user-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    margin-bottom: 10px;
    transition: all 0.3s ease;
}

.user-item:hover {
    background: #e9ecef;
    border-color: #3498db;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    font-weight: 600;
    color: #2c3e50;
    font-size: 16px;
}

.username {
    color: #7f8c8d;
    font-size: 14px;
    margin-top: 2px;
}

.add-user-btn {
    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.add-user-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #229954 0%, #1e8449 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.add-user-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.no-results, .search-prompt {
    text-align: center;
    padding: 40px 20px;
    color: #7f8c8d;
    font-style: italic;
}

.no-results p, .search-prompt p {
    margin: 0;
    font-size: 16px;
}
</style>