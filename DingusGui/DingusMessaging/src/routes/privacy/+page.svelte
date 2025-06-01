<script lang="ts">
    import { onMount } from 'svelte';

    onMount(() => {
        window.scrollTo(0, 0);
    });
</script>

<div class="privacy-container">
    <h1>Privacy Policy</h1>

    <section>
        <h2>1. Information We Collect</h2>
        <h3>Personal Information</h3>
        <p>We collect information that you provide directly to us, including:</p>
        <ul>
            <li>Name and email address</li>
            <li>Profile information</li>
            <li>Communication preferences</li>
            <li>Messages and content you share</li>
        </ul>
    </section>

    <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
            <li>Provide and maintain our services</li>
            <li>Send you notifications and updates</li>
            <li>Respond to your comments and questions</li>
            <li>Protect against fraudulent or illegal activity</li>
        </ul>
    </section>

    <section>
        <h2>3. Information Sharing</h2>
        <p>We do not sell or rent your personal information to third parties. We may share your information:</p>
        <ul>
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and safety</li>
        </ul>
    </section>

    <section>
        <h2>4. Data Security</h2>
        <p>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or destruction.</p>
    </section>

    <section>
        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
        </ul>
    </section>

    <section>
        <h2>6. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact us at:</p>
        <p>Email: privacy@dinguscord.com</p>
    </section>
</div>

<style>
    .privacy-container {
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

    h3 {
        color: #555;
        margin-bottom: 0.5rem;
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
        .privacy-container {
            padding: 1rem;
        }
    }
</style>
