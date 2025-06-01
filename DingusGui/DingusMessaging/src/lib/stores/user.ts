import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type User = {
	id: string;
	username: string;
	email: string;
	display_name?: string;
	avatar_url?: string;
	created_at?: string;
	updated_at?: string;
};

// Initialize from localStorage if in browser
const storedUser = browser ? localStorage.getItem('dinguscord_user') : null;
const storedToken = browser ? localStorage.getItem('dinguscord_token') : null;

// Create writable stores
export const user = writable<User | null>(storedUser ? JSON.parse(storedUser) : null);
export const token = writable<string | null>(storedToken);

// Create derived store for authentication status
export const isAuthenticated = derived([user, token], ([$user, $token]) => !!$user && !!$token);

// Update localStorage when stores change
if (browser) {
	user.subscribe(value => {
		if (value) {
			localStorage.setItem('dinguscord_user', JSON.stringify(value));
		} else {
			localStorage.removeItem('dinguscord_user');
		}
	});

	token.subscribe(value => {
		if (value) {
			localStorage.setItem('dinguscord_token', value);
		} else {
			localStorage.removeItem('dinguscord_token');
		}
	});
}

// Authentication API endpoints
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Register a new user
export const register = async (userData: {
	username: string;
	email: string;
	password: string;
	display_name?: string;
}): Promise<{ success: boolean; message?: string; error?: any }> => {
	try {
		const response = await fetch(`${API_URL}/auth/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(userData)
		});

		const data = await response.json();

		if (data.success) {
			// Set user and token in stores
			user.set(data.user);
			token.set(data.token);
			return { success: true };
		} else {
			return { success: false, message: data.message || 'Registration failed', error: data.error };
		}
	} catch (error) {
		console.error('Registration error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Login user
export const login = async (credentials: {
	email: string;
	password: string;
}): Promise<{ success: boolean; message?: string; error?: any }> => {
	try {
		const response = await fetch(`${API_URL}/auth/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(credentials)
		});

		const data = await response.json();

		if (data.success) {
			// Set user and token in stores
			user.set(data.user);
			token.set(data.token);
			return { success: true };
		} else {
			return { success: false, message: data.message || 'Login failed', error: data.error };
		}
	} catch (error) {
		console.error('Login error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Logout user
export const logout = (): void => {
	user.set(null);
	token.set(null);
};

// Get user profile
export const getProfile = async (): Promise<{
	success: boolean;
	user?: User;
	message?: string;
	error?: any;
}> => {
	try {
		// Get token from store
		let currentToken: string | null = null;
		const unsubscribe = token.subscribe(value => {
			currentToken = value;
		});
		unsubscribe();

		if (!currentToken) {
			return { success: false, message: 'Not authenticated' };
		}

		const response = await fetch(`${API_URL}/auth/profile`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			// Update user in store
			user.set(data.user);
			return { success: true, user: data.user };
		} else {
			// If token is invalid, logout
			if (response.status === 401 || response.status === 403) {
				logout();
			}
			return { success: false, message: data.message || 'Failed to get profile', error: data.error };
		}
	} catch (error) {
		console.error('Get profile error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Update user profile
export const updateProfile = async (userData: {
	username?: string;
	email?: string;
	display_name?: string;
	avatar_url?: string;
}): Promise<{ success: boolean; message?: string; error?: any }> => {
	try {
		// Get token from store
		let currentToken: string | null = null;
		const unsubscribe = token.subscribe(value => {
			currentToken = value;
		});
		unsubscribe();

		if (!currentToken) {
			return { success: false, message: 'Not authenticated' };
		}

		const response = await fetch(`${API_URL}/auth/profile`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			},
			body: JSON.stringify(userData)
		});

		const data = await response.json();

		if (data.success) {
			// Update user in store
			user.set(data.user);
			return { success: true };
		} else {
			// If token is invalid, logout
			if (response.status === 401 || response.status === 403) {
				logout();
			}
			return {
				success: false,
				message: data.message || 'Failed to update profile',
				error: data.error
			};
		}
	} catch (error) {
		console.error('Update profile error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Verify token on application startup
export const verifyToken = async (): Promise<boolean> => {
	try {
		// Get token from store
		let currentToken: string | null = null;
		const unsubscribe = token.subscribe(value => {
			currentToken = value;
		});
		unsubscribe();

		if (!currentToken) {
			return false;
		}

		const response = await fetch(`${API_URL}/auth/verify`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			// Refresh user in store
			user.set(data.user);
			return true;
		} else {
			// If token is invalid, logout
			logout();
			return false;
		}
	} catch (error) {
		console.error('Token verification error:', error);
		// If there's an error, clear the auth state
		logout();
		return false;
	}
};
