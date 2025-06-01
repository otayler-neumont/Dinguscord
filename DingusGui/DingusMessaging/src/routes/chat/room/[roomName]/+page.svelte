<script lang="ts">
    import './roomStyles.css';
    import { onMount } from 'svelte';

    export let data: {
        roomName: string;
    };

    let messages: { sender: string; text: string }[] = [];
    let newMessage = '';
    let roomName = decodeURIComponent(data.roomName);

    onMount(async () => {
        const res = await fetch(`/api/chat/room/${encodeURIComponent(roomName)}`);
        const result = await res.json();
        messages = result.messages;
    });

    async function sendMessage() {
        if (!newMessage.trim()) return;

        const res = await fetch(`/api/chat/room/${encodeURIComponent(roomName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newMessage })
        });

        const saved = await res.json();
        messages = [...messages, saved];
        newMessage = '';
    }
</script>

<h2>Chat Room: {roomName}</h2>

<div class="chat-log">
    {#each messages as msg}
        <p><strong>{msg.sender}</strong>: {msg.text}</p>
    {/each}
</div>

<input
    bind:value={newMessage}
    placeholder="Type a message..."
    on:keypress={(e) => e.key === 'Enter' && sendMessage()}
/>
<button on:click={sendMessage}>Send</button>