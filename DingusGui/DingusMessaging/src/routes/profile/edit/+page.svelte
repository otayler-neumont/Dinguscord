<script lang="ts">
    import { goto } from '$app/navigation';
    import { user, token, isAuthenticated } from '$lib/stores/user';
    import { onMount } from 'svelte';

    let displayName = '';
    let loading = true;
    let error = '';
    let successMessage = '';

    onMount(async () => {
        if (!$isAuthenticated || !$user) {
            goto('/');
            return;
        }

        // Initialize with current display name
        displayName = $user.display_name || $user.username || '';
        loading = false;
    });

    async function handleSubmit() {
        try {
            loading = true;
            error = '';
            successMessage = '';

            const response = await fetch('http://localhost:3001/users/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${$token}`
                },
                body: JSON.stringify({ display_name: displayName })
            });

            if (response.ok) {
                // Update the user store with the new display name
                user.update(u => u ? { ...u, display_name: displayName } : null);
                successMessage = 'Profile updated successfully!';

                // Navigate back to dashboard after a brief delay
                setTimeout(() => {
                    goto('/dashboard');
                }, 1500);
            } else {
                const errorData = await response.json();
                error = errorData.message || 'Failed to update profile';
            }
        } catch (e) {
            error = 'Error updating profile';
            console.error('Profile update error:', e);
        } finally {
            loading = false;
        }
    }
</script>

<div class="edit-profile-container">
    <div class="edit-profile-card">
        <div class="card-header">
            <h1>Edit Profile</h1>
        </div>

        <div class="card-content">
            {#if loading}
                <div class="status-message loading">
                    <span class="spinner"></span>
                    Loading...
                </div>
            {:else if error}
                <div class="status-message error">
                    {error}
                </div>
            {:else if successMessage}
                <div class="status-message success">
                    {successMessage}
                </div>
            {:else}
                <form on:submit|preventDefault={handleSubmit} class="edit-form">
                    <div class="form-group">
                        <label for="displayName">Display Name</label>
                        <input
                                type="text"
                                id="displayName"
                                bind:value={displayName}
                                required
                                minlength="3"
                                maxlength="30"
                                placeholder="Enter your display name"
                        />
                        <span class="input-hint">3-30 characters</span>
                    </div>

                    <div class="button-group">
                        <button type="button" class="secondary-button" on:click={() => goto('/dashboard')}>
                            Cancel
                        </button>
                        <button type="submit" class="primary-button">
                            Save Changes
                        </button>
                    </div>
                </form>
            {/if}
        </div>
    </div>
</div>

<style>
    .edit-profile-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .edit-profile-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 500px;
        overflow: hidden;
    }

    .card-header {
        background: linear-gradient(to right, #3498db, #2980b9);
        padding: 2rem;
        text-align: center;
    }

    .card-header h1 {
        color: white;
        margin: 0;
        font-size: 2rem;
        font-weight: 600;
    }

    .card-content {
        padding: 2rem;
    }

    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    label {
        font-weight: 600;
        color: #2c3e50;
    }

    input {
        padding: 0.75rem;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.2s ease;
    }

    input:focus {
        outline: none;
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }

    .input-hint {
        font-size: 0.875rem;
        color: #64748b;
    }

    .button-group {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 1rem;
    }

    .primary-button, .secondary-button {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .primary-button {
        background: #3498db;
        color: white;
        border: none;
    }

    .primary-button:hover {
        background: #2980b9;
        transform: translateY(-1px);
    }

    .secondary-button {
        background: #e2e8f0;
        color: #2c3e50;
        border: none;
    }

    .secondary-button:hover {
        background: #cbd5e0;
        transform: translateY(-1px);
    }

    .status-message {
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
        margin: 1rem 0;
    }

    .loading {
        background: #e2e8f0;
        color: #2c3e50;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .error {
        background: #fed7d7;
        color: #c53030;
    }

    .success {
        background: #c6f6d5;
        color: #2f855a;
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #cbd5e0;
        border-top-color: #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (max-width: 640px) {
        .edit-profile-container {
            padding: 1rem;
        }

        .card-header {
            padding: 1.5rem;
        }

        .card-content {
            padding: 1.5rem;
        }

        .button-group {
            flex-direction: column-reverse;
        }

        .primary-button, .secondary-button {
            width: 100%;
        }
    }
</style>
