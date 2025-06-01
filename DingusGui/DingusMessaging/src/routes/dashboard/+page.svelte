<script lang="ts">
    import '/src/routes/dashboard/dashboard.css';
    import DashboardView from './DashboardView.svelte';
    import { user } from '$lib/stores/user';
    import { onMount } from 'svelte';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';

    let username = '';
    let search = '';
    let users = ['alice', 'bob', 'carol', 'dave'];
    let chatRooms = ['General', 'Tech Talk', 'Random'];
    let friends = ['grace', 'henry', 'isabel'];
    let filteredUsers: string[] = [];
    let addingFriend = false;

    onMount(() => {
        const u = get(user);
        if (!u) {
            goto('/');
        } else {
            username = u.name;
            filteredUsers = users.filter(u => !friends.includes(u) && u !== username);
        }
    });

    $: filteredUsers = users.filter(u => 
        u.toLowerCase().includes(search.toLowerCase()) && 
        !friends.includes(u) && 
        u !== username
    );

    async function addFriend(friendName: string) {
        try {
            addingFriend = true;
            const response = await fetch('/api/friends', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentUser: username,
                    friendName
                })
            });

            const data = await response.json();
            
            if (data.success) {
                friends = [...friends, friendName];
                filteredUsers = filteredUsers.filter(u => u !== friendName);
                alert('Friend added successfully!');
            } else {
                alert('Failed to add friend');
            }
        } catch (error) {
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
/>