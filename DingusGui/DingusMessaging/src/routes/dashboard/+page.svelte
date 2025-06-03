<script lang="ts">
    import '/src/routes/dashboard/dashboard.css';
    import DashboardView from './DashboardView.svelte';
    import { user, isAuthenticated, token } from '$lib/stores/user';
    import { onMount } from 'svelte';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';

    let username = '';
    let search = '';
    let users: string[] = [];
    let chatRooms: {id: string, name: string}[] = [];
    let friends: string[] = [];
    let filteredUsers: string[] = [];
    let addingFriend = false;
    let loading = true;
    let error = '';

    onMount(async () => {
        if (!$isAuthenticated || !$user) {
            goto('/');
        } else {
            // Use display_name if available, otherwise fall back to username
            username = $user.display_name || $user.username || 'User';
            
            // Load real data from backend services
            await loadDashboardData();
        }
    });

    async function handleCreateRoom(event: CustomEvent) {
        const { roomName } = event.detail;
        
        try {
            const response = await fetch('http://localhost:3002/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${$token || ''}`
                },
                body: JSON.stringify({
                    name: roomName,
                    userId: $user?.id
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Handle new response format
                const newRoom = result.room || result; // Fallback for old format
                
                // Add the new room to the list if it's not already there
                if (!chatRooms.find(room => room.id === newRoom.id)) {
                    chatRooms = [...chatRooms, newRoom];
                }
                
                // Navigate to the new room
                await goto(`/chat/room/${encodeURIComponent(newRoom.name)}`);
            } else {
                const errorData = await response.json();
                console.error('Failed to create room:', errorData);
                
                if (errorData.error === 'ROOM_NAME_EXISTS') {
                    alert(`Room name "${roomName}" is already taken. Please choose a different name.`);
                } else {
                    alert('Failed to create room. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Network error. Please check your connection.');
        }
    }

    async function loadDashboardData() {
        loading = true;
        error = '';
        
        try {
            // Load chat rooms from ChatRoomService
            await loadChatRooms();
            
            // Load friends (when we implement friends system)
            await loadFriends();
            
            // Load available users for friend search (when we implement user discovery)
            await loadUsers();
            
        } catch (err) {
            console.error('Error loading dashboard data:', err);
            error = 'Failed to load some data. Some features may not work properly.';
        } finally {
            loading = false;
        }
    }

    async function loadChatRooms() {
        try {
            // Get user's rooms from ChatRoomService
            const response = await fetch(`http://localhost:3002/users/${$user?.id}/rooms`, {
                headers: {
                    'Authorization': `Bearer ${$token || ''}`
                }
            });
            
            if (response.ok) {
                chatRooms = await response.json();
            } else {
                console.warn('Failed to load chat rooms, creating default rooms');
                // Create some default rooms if none exist
                await createDefaultRooms();
            }
        } catch (error) {
            console.error('Error loading chat rooms:', error);
            // Use fallback default rooms
            chatRooms = [
                { id: 'general', name: 'General' },
                { id: 'tech-talk', name: 'Tech Talk' },
                { id: 'random', name: 'Random' }
            ];
        }
    }

    async function createDefaultRooms() {
        const defaultRooms = ['General', 'Tech Talk', 'Random'];
        
        for (const roomName of defaultRooms) {
            try {
                const response = await fetch('http://localhost:3002/rooms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${$token || ''}`
                    },
                    body: JSON.stringify({
                        name: roomName,
                        userId: $user?.id
                    })
                });
                
                if (response.ok) {
                    const room = await response.json();
                    chatRooms = [...chatRooms, room];
                }
            } catch (error) {
                console.error(`Error creating room ${roomName}:`, error);
            }
        }
    }

    async function loadFriends() {
        // TODO: Implement friends system with backend
        // For now, keep empty until we build the friends feature
        friends = [];
    }

    async function loadUsers() {
        // TODO: Implement user discovery with UserPresenceService or AuthenticationService
        // For now, keep empty until we build user discovery
        users = [];
    }

    $: filteredUsers = users.filter(u => 
        u.toLowerCase().includes(search.toLowerCase()) && 
        !friends.includes(u) && 
        u !== username
    );

    async function addFriend(friendName: string) {
        try {
            addingFriend = true;
            
            // TODO: Implement real friends API
            // For now, just add locally
            friends = [...friends, friendName];
            filteredUsers = filteredUsers.filter(u => u !== friendName);
            
            // In the future, this would call:
            // await fetch('/api/friends', { method: 'POST', ... })
            
        } catch (error) {
            console.error('Error adding friend:', error);
            alert('Error adding friend');
        } finally {
            addingFriend = false;
        }
    }
</script>

<DashboardView
    {username}
    {friends}
    {search}
    {filteredUsers}
    {addingFriend}
    {chatRooms}
    {addFriend}
    {loading}
    {error}
    on:createRoom={handleCreateRoom}
/>