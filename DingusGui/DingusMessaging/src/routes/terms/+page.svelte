<script lang="ts">
    import { onMount } from 'svelte';

    onMount(() => {
        window.scrollTo(0, 0);
    });
</script>

<div class="terms-container">
    <h1>Terms of Service</h1>

    <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using DingusCord, you accept and agree to be bound by the terms and conditions of this agreement.</p>
    </section>

    <section>
        <h2>2. Description of Service</h2>
        <p>DingusCord provides a social platform for users to connect and communicate with other users.</p>
    </section>

    <section>
        <h2>3. User Conduct</h2>
        <p>You agree to use DingusCord in accordance with all applicable laws and regulations. You are prohibited from:</p>
        <ul>
            <li>Posting illegal, harmful, or offensive content</li>
            <li>Harassing other users</li>
            <li>Attempting to gain unauthorized access to the service</li>
            <li>Using the service for any illegal purposes</li>
        </ul>
    </section>

    <section>
        <h2>4. Account Registration</h2>
        <p>To access certain features of DingusCord, you may be required to register for an account. You agree to:</p>
        <ul>
            <li>Provide accurate information</li>
            <li>Maintain the security of your account</li>
            <li>Accept responsibility for all activities under your account</li>
        </ul>
    </section>

    <section>
        <h2>5. Termination</h2>
        <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any reason.</p>
    </section>

    <section>
        <h2>6. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. We will notify users of any changes by updating the date at the top of this page.</p>
    </section>
</div>

<style>
    .terms-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        line-height: 1.6;
    }

    h1 {
        text-align: center;
        color: #333;
        margin-bottom: 2rem;
    }

    section {
        margin-bottom: 2rem;
    }

    h2 {
        color: #444;
        margin-bottom: 1rem;
    }

    ul {
        list-style-type: disc;
        margin-left: 2rem;
        margin-top: 0.5rem;
    }

    li {
        margin-bottom: 0.5rem;
    }

    @media (max-width: 768px) {
        .terms-container {
            padding: 1rem;
        }
    }
</style>
