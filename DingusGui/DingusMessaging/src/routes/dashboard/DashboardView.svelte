<script lang="ts">
    export let username = '';
    export let friends: string[] = [];
    export let search = '';
    export let filteredUsers: string[] = [];
    export let addingFriend = false;
    export let chatRooms: string[] = [];
    export let addFriend: (friendName: string) => Promise<void>;
</script>

<div class="dashboard-container">
    <h1>Welcome, {username}!</h1>

    <div class="dashboard-sections">
        <div class="section">
            <h2>Your Friends ({friends.length})</h2>
            <ul class="friends-list">
                {#each friends as friend}
                    <li>
                        <a href="/chat/{friend}">
                            {friend}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>

        <div class="section">
            <h2>Find New Friends</h2>
            <input 
                type="text" 
                placeholder="Search users..." 
                bind:value={search}
                class="search-input"
            />
            <ul class="search-results">
                {#each filteredUsers as user}
                    <li>
                        <div class="user-item">
                            <span>{user}</span>
                            <button 
                                on:click={() => addFriend(user)}
                                disabled={addingFriend}
                                class="add-friend-btn"
                            >
                                Add Friend
                            </button>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>

        <div class="section">
            <h2>Chat Rooms</h2>
            <ul class="chat-rooms">
                {#each chatRooms as room}
                    <li>
                        <a href="/chat/room/{encodeURIComponent(room)}">
                            {room}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>