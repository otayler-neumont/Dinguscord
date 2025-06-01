// src/lib/server/auth.ts
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/core/providers/google';
import Facebook from '@auth/core/providers/facebook';

import {
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	FACEBOOK_CLIENT_ID,
	FACEBOOK_CLIENT_SECRET
} from '$env/static/private';

export const handle = SvelteKitAuth({
	providers: [
		Google({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }),
		Facebook({ clientId: FACEBOOK_CLIENT_ID, clientSecret: FACEBOOK_CLIENT_SECRET })
	],
	callbacks: {
		async redirect({ url, baseUrl }) {
			// Redirect to dashboard after sign-in
			if (url.startsWith(baseUrl)) {
				return `${baseUrl}/dashboard`;
			}
			return `${baseUrl}/dashboard`; // fallback redirect
		}
	}
}).handle;
