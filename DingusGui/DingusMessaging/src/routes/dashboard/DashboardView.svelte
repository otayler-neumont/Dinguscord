<script lang="ts">
    import { logout } from '$lib/stores/user';
    import { goto } from '$app/navigation';
    import { createEventDispatcher } from 'svelte';
    
    export let username = '';
    export let friends: string[] = [];
    export let search = '';
    export let filteredUsers: string[] = [];
    export let addingFriend = false;
    export let chatRooms: {id: string, name: string}[] = [];
    export let addFriend: (friendName: string) => Promise<void>;
    export let loading = false;
    export let error = '';

    // Room creation state
    let showCreateRoomModal = false;
    let newRoomName = '';
    let creatingRoom = false;

    const dispatch = createEventDispatcher();

    async function handleLogout() {
        logout();
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
</script>

<div class="dashboard">
    <div class="dashboard-container">
        <h1>Welcome back, {username}! 👋</h1>

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

        <div class="dashboard-actions">
            {#if chatRooms.length > 0}
                <button on:click={() => goto(`/chat/room/${encodeURIComponent(chatRooms[0].name)}`)}>
                    Join {chatRooms[0].name}
                </button>
            {:else}
                <button on:click={() => goto('/chat/room/General')}>
                    Join General Chat
                </button>
            {/if}
            <button on:click={() => goto('/chat/room/Tech%20Talk')}>
                Tech Discussion
            </button>
            <button on:click={handleLogout}>
                Logout
            </button>
        </div>

        <div class="dashboard-sections">
            <!-- Friends Section -->
            <div class="section friends-list">
                <h2>Your Friends ({friends.length})</h2>
                {#if friends.length > 0}
                    <ul>
                        {#each friends as friend}
                            <li>
                                <a href="/chat/{friend}">
                                    {friend}
                                </a>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px;">
                        No friends yet. Add some from the search section!
                    </p>
                {/if}
            </div>

            <!-- Search Friends Section -->
            <div class="section search-section">
                <h2>Find New Friends</h2>
                <input 
                    type="text" 
                    placeholder="Search users..." 
                    bind:value={search}
                    class="search-input"
                />
                {#if filteredUsers.length > 0}
                    <ul class="search-results">
                        {#each filteredUsers as user}
                            <li>
                                <div class="user-item">
                                    <span class="username">{user}</span>
                                    <button 
                                        on:click={() => addFriend(user)}
                                        disabled={addingFriend}
                                        class="add-friend-btn"
                                    >
                                        {addingFriend ? 'Adding...' : 'Add Friend'}
                                    </button>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {:else if search}
                    <p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px;">
                        No users found matching "{search}"
                    </p>
                {:else}
                    <p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px;">
                        User discovery coming soon...
                    </p>
                {/if}
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
</style>