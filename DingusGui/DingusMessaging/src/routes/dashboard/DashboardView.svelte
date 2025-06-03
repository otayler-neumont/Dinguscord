<script lang="ts">
    import { logout, searchUsers, addFriend, removeFriend, getFriends, getFriendsOnlineStatus, createOrGetDM, startHeartbeat, stopHeartbeat } from '$lib/stores/user';
    import { goto } from '$app/navigation';
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { user, token } from '$lib/stores/user';
    
    export let username = '';
    export let chatRooms: {id: string, name: string}[] = [];
    export let loading = false;
    export let error = '';

    // Room creation state
    let showCreateRoomModal = false;
    let newRoomName = '';
    let creatingRoom = false;

    // Friends system state
    let searchTerm = '';
    let searchResults = [];
    let searchLoading = false;
    let friends = [];
    let onlineStatus = {};
    let friendsLoading = false;

    // Presence tracking
    let currentUser = null;
    let currentToken = null;
    let presenceUpdateInterval = null;

    const dispatch = createEventDispatcher();

    // Subscribe to user and token stores
    const unsubscribeUser = user.subscribe(value => {
        currentUser = value;
    });
    
    const unsubscribeToken = token.subscribe(value => {
        currentToken = value;
    });

    // Load friends and start heartbeat system on mount
    onMount(async () => {
        await loadFriends();
        
        // Start heartbeat system for presence tracking
        if (currentUser && currentToken) {
            startHeartbeat();
        }
        
        // Start checking friends' online status
        startPresenceUpdates();
    });

    // Clean up on destroy
    onDestroy(() => {
        unsubscribeUser();
        unsubscribeToken();
        
        // Stop heartbeat system
        stopHeartbeat();
        
        if (presenceUpdateInterval) {
            clearInterval(presenceUpdateInterval);
        }
    });

    function startPresenceUpdates() {
        // Update friends online status every 10 seconds for faster debugging
        presenceUpdateInterval = setInterval(async () => {
            if (friends.length > 0) {
                console.log('Auto-refreshing friends online status...');
                await updateFriendsOnlineStatus();
            }
        }, 10000); // 10 seconds for debugging
    }

    async function updateFriendsOnlineStatus() {
        if (friends.length === 0) return;
        
        try {
            const userIds = friends.map(friend => friend.id);
            console.log('Checking online status for user IDs:', userIds);
            const statusResult = await getFriendsOnlineStatus(userIds);
            console.log('Online status result:', statusResult);
            if (statusResult.success) {
                onlineStatus = statusResult.onlineStatus || {};
                console.log('Updated online status:', onlineStatus);
            }
        } catch (error) {
            console.error('Failed to update friends online status:', error);
        }
    }

    async function handleLogout() {
        // Stop heartbeat before logging out
        stopHeartbeat();
        await logout();
        await goto('/');
    }

    function openCreateRoomModal() {
        showCreateRoomModal = true;
        newRoomName = '';
    }

    function closeCreateRoomModal() {
        showCreateRoomModal = false;
        newRoomName = '';
        creatingRoom = false;
    }

    async function createRoom() {
        if (!newRoomName.trim()) {
            alert('Please enter a room name');
            return;
        }

        creatingRoom = true;
        
        try {
            // Dispatch event to parent component
            dispatch('createRoom', { roomName: newRoomName.trim() });
            closeCreateRoomModal();
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room. Please try again.');
        } finally {
            creatingRoom = false;
        }
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            createRoom();
        }
    }

    async function handleSearch() {
        if (!searchTerm.trim()) {
            searchResults = [];
            return;
        }

        searchLoading = true;
        try {
            const result = await searchUsers(searchTerm);
            if (result.success) {
                searchResults = result.users || [];
            } else {
                console.error('Search failed:', result.message);
                searchResults = [];
            }
        } catch (error) {
            console.error('Search error:', error);
            searchResults = [];
        } finally {
            searchLoading = false;
        }
    }

    async function handleAddFriend(friendId) {
        try {
            const result = await addFriend(friendId);
            if (result.success) {
                // Remove from search results
                searchResults = searchResults.filter(user => user.id !== friendId);
                // Reload friends list
                await loadFriends();
            } else {
                console.error('Add friend failed:', result.message);
                alert('Failed to add friend: ' + result.message);
            }
        } catch (error) {
            console.error('Add friend error:', error);
            alert('Failed to add friend');
        }
    }

    async function handleRemoveFriend(friendId) {
        if (!confirm('Are you sure you want to remove this friend?')) {
            return;
        }

        try {
            const result = await removeFriend(friendId);
            if (result.success) {
                // Reload friends list
                await loadFriends();
            } else {
                console.error('Remove friend failed:', result.message);
                alert('Failed to remove friend: ' + result.message);
            }
        } catch (error) {
            console.error('Remove friend error:', error);
            alert('Failed to remove friend');
        }
    }

    async function loadFriends() {
        friendsLoading = true;
        try {
            const result = await getFriends();
            if (result.success) {
                friends = result.friends || [];
                
                // Get online status for friends using the dedicated function
                await updateFriendsOnlineStatus();
            } else {
                console.error('Load friends failed:', result.message);
                friends = [];
            }
        } catch (error) {
            console.error('Load friends error:', error);
            friends = [];
        } finally {
            friendsLoading = false;
        }
    }

    // Auto-search when typing with debounce
    let searchTimer;
    $: {
        if (searchTimer) {
            clearTimeout(searchTimer);
        }
        
        if (searchTerm) {
            searchTimer = setTimeout(handleSearch, 300);
        } else {
            searchResults = [];
        }
    }

    async function handleStartDM(friendId) {
        try {
            // Create or get the DM room
            const result = await createOrGetDM(friendId);
            if (result.success && result.room) {
                // Navigate to the regular chat interface with the DM room ID
                goto(`/chat/room/${encodeURIComponent(result.room.id)}`);
            } else {
                console.error('Failed to create DM:', result.message);
                alert('Failed to start conversation. Please try again.');
            }
        } catch (error) {
            console.error('Error starting DM:', error);
            alert('Failed to start conversation. Please try again.');
        }
    }
</script>

<div class="dashboard">
    <div class="dashboard-container">
        <!-- Header with logout button -->
        <div class="dashboard-header">
            <h1>Welcome back, {username}! 👋</h1>
            <button class="logout-btn" on:click={handleLogout} title="Logout">
                <span>Logout</span>
            </button>
        </div>

        {#if loading}
            <div class="loading-message">
                <p>Loading your dashboard...</p>
            </div>
        {/if}

        {#if error}
            <div class="error-message">
                <p>{error}</p>
            </div>
        {/if}

        <div class="dashboard-sections">
            <!-- Friends Section -->
            <div class="section friends-list">
                <div class="section-header">
                    <h2>Your Friends ({friends.length})</h2>
                </div>
                <div class="section-content">
                    {#if friendsLoading}
                        <div class="loading-text">Loading friends...</div>
                    {:else if friends.length === 0}
                        <div class="empty-state">
                            <p>No friends yet. Add some from the search section!</p>
                        </div>
                    {:else}
                        <div class="friends-list">
                            {#each friends as friend (friend.id)}
                                <div class="friend-item">
                                    <div class="friend-info">
                                        <div class="friend-avatar">
                                            {#if friend.avatar_url}
                                                <img src={friend.avatar_url} alt={friend.username} />
                                            {:else}
                                                <div class="avatar-placeholder">
                                                    {friend.username.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="online-indicator {onlineStatus[friend.id] ? 'online' : 'offline'}"></div>
                                        </div>
                                        <div class="friend-details">
                                            <div class="friend-name">{friend.display_name || friend.username}</div>
                                            <div class="friend-username">@{friend.username}</div>
                                            <div class="friend-status" style="color: {onlineStatus[friend.id] ? '#10b981' : '#6b7280'}">
                                                {onlineStatus[friend.id] ? 'Online' : 'Offline'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="friend-actions">
                                        <button class="action-btn message-btn" on:click={() => handleStartDM(friend.id)} title="Send Message">
                                            💬
                                        </button>
                                        <button class="action-btn remove-btn" on:click={() => handleRemoveFriend(friend.id)} title="Remove Friend">
                                            ❌
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Search Friends Section -->
            <div class="section search-section">
                <div class="section-header">
                    <h2>Find New Friends</h2>
                </div>
                <div class="section-content">
                    <div class="search-container">
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            bind:value={searchTerm}
                            class="search-input"
                        />
                        {#if searchLoading}
                            <div class="search-loading">Searching...</div>
                        {/if}
                    </div>
                    
                    {#if searchResults.length > 0}
                        <div class="search-results">
                            {#each searchResults as user (user.id)}
                                <div class="search-result-item">
                                    <div class="user-info">
                                        <div class="user-avatar">
                                            {#if user.avatar_url}
                                                <img src={user.avatar_url} alt={user.username} />
                                            {:else}
                                                <div class="avatar-placeholder">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                        </div>
                                        <div class="user-details">
                                            <div class="user-name">{user.display_name || user.username}</div>
                                            <div class="user-username">@{user.username}</div>
                                        </div>
                                    </div>
                                    <button class="add-friend-btn" on:click={() => handleAddFriend(user.id)}>
                                        Add Friend
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else if searchTerm && !searchLoading}
                        <div class="no-results">
                            <p>No users found matching "{searchTerm}"</p>
                        </div>
                    {:else if !searchTerm}
                        <div class="search-placeholder">
                            <p>Start typing to search for users...</p>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Chat Rooms Section -->
            <div class="section chat-rooms">
                <div class="section-header">
                    <h2>Your Chat Rooms</h2>
                    <button class="create-room-btn" on:click={openCreateRoomModal} title="Create new room">
                        <span>+</span>
                    </button>
                </div>
                
                {#if loading}
                    <p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px;">
                        Loading rooms...
                    </p>
                {:else if chatRooms.length > 0}
                    <ul>
                        {#each chatRooms as room}
                            <li>
                                <a href="/chat/room/{encodeURIComponent(room.name)}">
                                    {room.name}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px;">
                        No rooms yet. Create your first room!
                    </p>
                {/if}
            </div>

            <!-- Quick Actions Section -->
            <div class="section">
                <h2>Quick Actions</h2>
                <ul>
                    <li>
                        <a href="/chat/room/Help">
                            Get Help & Support
                        </a>
                    </li>
                    <li>
                        <a href="/chat/room/Announcements">
                            View Announcements
                        </a>
                    </li>
                    <li>
                        <a href="/profile">
                            Edit Profile
                        </a>
                    </li>
                    <li>
                        <a href="/settings">
                            Settings
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- Create Room Modal -->
{#if showCreateRoomModal}
    <div class="modal-overlay" on:click={closeCreateRoomModal}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h3>Create New Room</h3>
                <button class="close-button" on:click={closeCreateRoomModal}>&times;</button>
            </div>
            <div class="modal-body">
                <input
                    type="text"
                    placeholder="Enter room name..."
                    bind:value={newRoomName}
                    on:keydown={handleKeyPress}
                    class="room-name-input"
                    disabled={creatingRoom}
                />
            </div>
            <div class="modal-footer">
                <button class="cancel-btn" on:click={closeCreateRoomModal} disabled={creatingRoom}>
                    Cancel
                </button>
                <button class="create-btn" on:click={createRoom} disabled={creatingRoom || !newRoomName.trim()}>
                    {creatingRoom ? 'Creating...' : 'Create Room'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #ecf0f1;
}

.dashboard-header h1 {
    margin: 0;
    color: #2c3e50;
    font-size: 32px;
    font-weight: 800;
}

.logout-btn {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
}

.logout-btn:hover {
    background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
}

.logout-btn:active {
    transform: translateY(0);
}

.loading-message, .error-message {
    text-align: center;
    padding: 20px;
    margin: 20px 0;
    border-radius: 10px;
}

.loading-message {
    background-color: #e3f2fd;
    color: #1565c0;
    border: 2px solid #bbdefb;
}

.error-message {
    background-color: #ffebee;
    color: #c62828;
    border: 2px solid #ffcdd2;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.section-header h2 {
    margin: 0;
    font-size: 24px;
    color: #2c3e50;
    font-weight: 700;
    border-bottom: 3px solid #3498db;
    padding-bottom: 10px;
    flex: 1;
}

.create-room-btn {
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
    margin-left: 15px;
}

.create-room-btn:hover {
    background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
}

.create-room-btn:active {
    transform: translateY(0);
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
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
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
}

.room-name-input {
    width: 100%;
    padding: 15px 20px;
    font-size: 16px;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    box-sizing: border-box;
    transition: all 0.3s ease;
}

.room-name-input:focus {
    border-color: #3498db;
    outline: none;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.modal-footer {
    padding: 20px 25px;
    background-color: #f8f9fa;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.cancel-btn, .create-btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.cancel-btn {
    background-color: #95a5a6;
    color: white;
}

.cancel-btn:hover {
    background-color: #7f8c8d;
}

.create-btn {
    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
    color: white;
}

.create-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.create-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Friends List Styles */
.friends-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.friend-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 12px;
    border: 1px solid #e9ecef;
    transition: all 0.2s ease;
}

.friend-item:hover {
    background: #e9ecef;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.friend-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.friend-avatar, .user-avatar {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
}

.friend-avatar img, .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 18px;
}

.online-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid white;
    transition: all 0.2s ease;
}

.online-indicator.online {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

.online-indicator.offline {
    background: #6b7280;
}

.friend-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.friend-name, .user-name {
    font-weight: 600;
    color: #2c3e50;
    font-size: 16px;
}

.friend-username, .user-username {
    color: #7f8c8d;
    font-size: 14px;
}

.friend-status {
    font-size: 12px;
    font-weight: 500;
}

.friend-actions {
    display: flex;
    gap: 8px;
}

.action-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.message-btn {
    background: #3498db;
    color: white;
}

.message-btn:hover {
    background: #2980b9;
    transform: scale(1.1);
}

.remove-btn {
    background: #e74c3c;
    color: white;
}

.remove-btn:hover {
    background: #c0392b;
    transform: scale(1.1);
}

/* Search Styles */
.search-container {
    margin-bottom: 20px;
}

.search-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #bdc3c7;
    border-radius: 8px;
    font-size: 16px;
    transition: all 0.3s ease;
    background: white;
}

.search-input:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.search-loading {
    text-align: center;
    color: #7f8c8d;
    font-style: italic;
    margin-top: 10px;
}

.search-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
}

.search-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
    transition: all 0.2s ease;
}

.search-result-item:hover {
    background: #e9ecef;
    transform: translateY(-1px);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.user-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.add-friend-btn {
    background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.add-friend-btn:hover {
    background: linear-gradient(135deg, #229954 0%, #27ae60 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.no-results, .search-placeholder, .empty-state {
    text-align: center;
    color: #7f8c8d;
    font-style: italic;
    padding: 40px 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px dashed #bdc3c7;
}

.loading-text {
    text-align: center;
    color: #7f8c8d;
    font-style: italic;
    padding: 20px;
}

/* Chat Rooms Styles */
.chat-rooms {
    margin-bottom: 30px;
}

.chat-rooms ul {
    list-style: none;
    padding: 0;
}

.chat-rooms li {
    margin-bottom: 10px;
}

.chat-rooms a {
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
}

.chat-rooms a:hover {
    color: #3498db;
    transform: translateY(-2px);
}

/* Quick Actions Styles */
.section {
    margin-bottom: 30px;
}

.section h2 {
    margin-bottom: 20px;
}

.section ul {
    list-style: none;
    padding: 0;
}

.section li {
    margin-bottom: 10px;
}

.section a {
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
}

.section a:hover {
    color: #3498db;
    transform: translateY(-2px);
}
</style>