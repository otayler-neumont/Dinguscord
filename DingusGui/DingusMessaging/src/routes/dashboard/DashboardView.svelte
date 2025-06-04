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

    function goToEditProfile() {
        goto('/profile/edit');
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
                        <a href="https://github.com/otayler-neumont/Dinguscord">
                            View Announcements
                        </a>
                    </li>
                    <li>
                        <a class="quick-action-btn" on:click={goToEditProfile}>
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

