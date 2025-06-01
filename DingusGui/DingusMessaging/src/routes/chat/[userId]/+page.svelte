<script lang="ts">
    import { onMount } from 'svelte';
    import './chatStyles.css';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';

    let messages: { sender: string; text: string }[] = [];
    let newMessage = '';
    let chatWith = '';

    export let data: {
        userId: string;
    };

    const userId = data.userId;

    onMount(async () => {
        const res = await fetch(`/api/chat/${userId}`);
        const result = await res.json();
        messages = result.messages;
        chatWith = result.name;
    });

    async function sendMessage() {
        if (!newMessage.trim()) return;

        const res = await fetch(`/api/chat/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newMessage })
        });

        const saved = await res.json();
        messages.push(saved);
        newMessage = '';
    }
</script>