    <script lang="ts">
        import './SignIn/form.css';
        import { onMount } from 'svelte';
        import { signIn } from '@auth/sveltekit/client';
        import { user, register, login, logout, isAuthenticated } from '$lib/stores/user';
        import {goto} from "$app/navigation";

        let container: HTMLElement;
        let isModalOpen = false;
        let resetEmail = '';
        let errorMessage = '';
        let loading = false;

        // Form inputs
        let signUpUsername = '';
        let signUpName = '';
        let signUpEmail = '';
        let signUpPassword = '';
        let signInEmail = '';
        let signInPassword = '';

        function openModal() {
            isModalOpen = true;
        }

        function closeModal() {
            isModalOpen = false;
            resetEmail = '';
        }

        async function handleResetPassword() {
            try {
                //call password reset API
                console.log('Password reset requested for:', resetEmail);
                // TODO: Implement actual password reset logic
                alert('If an account exists with this email, you will receive password reset instructions.');
                closeModal();
            } catch (error) {
                console.error('Error requesting password reset:', error);
            }
        }

        async function handleSignUp() {
            if (!signUpUsername || !signUpEmail || !signUpPassword) {
                errorMessage = 'All fields are required';
                return;
            }
            
            loading = true;
            errorMessage = '';
            
            try {
                const result = await register({
                    username: signUpUsername,
                    email: signUpEmail,
                    password: signUpPassword,
                    display_name: signUpName || undefined
                });
                
                if (result.success) {
                    
                    window.location.href = '/dashboard';
                } else {
                    errorMessage = result.message || 'Registration failed';
                }
            } catch (error) {
                console.error('Error during registration:', error);
                errorMessage = 'An unexpected error occurred';
            } finally {
                loading = false;
            }
        }

        async function handleSignIn() {
            if (!signInEmail || !signInPassword) {
                errorMessage = 'Email and password are required';
                return;
            }
            
            loading = true;
            errorMessage = '';
            
            try {
                const result = await login({
                    email: signInEmail,
                    password: signInPassword
                });
                
                if (result.success) {
                    await goto('/dashboard');
                } else {
                    errorMessage = result.message || 'Login failed';
                }
            } catch (error) {
                console.error('Error during login:', error);
                errorMessage = 'An unexpected error occurred';
            } finally {
                loading = false;
            }
        }

        onMount(() => {
            document.getElementById('signUp')?.addEventListener('click', () => {
                container?.classList.add('right-panel-active');
                errorMessage = '';
            });
            document.getElementById('signIn')?.addEventListener('click', () => {
                container?.classList.remove('right-panel-active');
                errorMessage = '';
            });
            
            // Check if user is already authenticated
            if ($isAuthenticated) {
                goto('/dashboard');
            }
        });

        const handleSocialLogin = async (provider: 'facebook' | 'google') => {
            try {
                await signIn(provider, {
                    redirect: true,
                    redirectTo: '/dashboard'
                });
            } catch (error) {
                console.error(`Error signing in with ${provider}:`, error);
                alert(`Failed to sign in with ${provider}.`);
            }
        };

    </script>

    <h2>Welcome To DingusCord</h2>
    <div bind:this={container} class="container" id="container">
        <div class="form-container sign-up-container">
            <form on:submit|preventDefault={handleSignUp}>
                <h1>Create Account</h1>
                <div class="social-container">
                    <button type="button" class="social" aria-label="Sign in with Facebook" on:click={() => handleSocialLogin('facebook')}><i class="fab fa-facebook-f"></i></button>
                    <button type="button" class="social" aria-label="Sign in with Google" on:click={() => handleSocialLogin('google')}><i class="fab fa-google-plus-g"></i></button>
                </div>
                <span>or use your email for registration</span>
                <input type="text" placeholder="Username" bind:value={signUpUsername} />
                <input type="text" placeholder="Display Name (optional)" bind:value={signUpName} />
                <input type="email" placeholder="Email" bind:value={signUpEmail} />
                <input type="password" placeholder="Password" bind:value={signUpPassword} />
                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Sign Up'}
                </button>
            </form>
        </div>

        <div class="form-container sign-in-container">
            <form on:submit|preventDefault={handleSignIn}>
                <h1>Sign in</h1>
                <div class="social-container">
                    <button type="button" class="social" aria-label=" Facebook" on:click={() => handleSocialLogin('facebook')}><i class="fab fa-facebook-f"></i></button>
                    <button type="button" class="social" aria-label=" Google" on:click={() => handleSocialLogin('google')}><i class="fab fa-google-plus-g"></i></button>
                </div>
                <span>or use your account</span>
                <input type="email" placeholder="Email" bind:value={signInEmail} />
                <input type="password" placeholder="Password" bind:value={signInPassword} />
                <a href="#" on:click|preventDefault={openModal}>Forgot your password?</a>
                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Sign In'}
                </button>
            </form>
        </div>

        <div class="overlay-container">
            <div class="overlay">
                <div class="overlay-panel overlay-left">
                    <h1>Welcome Back!</h1>
                    <p>To keep connected with Dinguses please login</p>
                    <button class="ghost" id="signIn">Sign In</button>
                </div>
                <div class="overlay-panel overlay-right">
                    <h1>Hello Dingus!</h1>
                    <p>Create an account and start being a Dingus</p>
                    <button class="ghost" id="signUp">Sign Up</button>
                </div>
            </div>
        </div>
    </div>

    {#if isModalOpen}
        <div class="modal-overlay" on:click={closeModal}>
            <div class="modal-content" on:click|stopPropagation>
                <div class="modal-header">
                    <h2>Reset Password</h2>
                    <button class="close-button" on:click={closeModal}>&times;</button>
                </div>
                <div class="modal-body">
                    <p>Enter email to reset password.</p>
                    <form on:submit|preventDefault={handleResetPassword}>
                        <input
                                type="email"
                                bind:value={resetEmail}
                                placeholder="Enter your email"
                                required
                        />
                        <div class="modal-buttons">
                            <button type="button" class="cancel-button" on:click={closeModal}>Cancel</button>
                            <button type="submit" class="submit-button">Confirm</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    {/if}


    <footer>
        <p>
            Copyright © 2025 ProDingus |
            <a href="/terms">Terms of Service</a> |
            <a href="/privacy">Privacy Policy</a>
        </p>
    </footer>

<style>
    .error-message {
        color: #e74c3c;
        font-size: 14px;
        margin: 5px 0;
        text-align: center;
    }
</style>


