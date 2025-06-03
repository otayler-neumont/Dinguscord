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
			
			// Start heartbeat system for presence tracking
			startHeartbeat();
			
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
export const logout = async (): Promise<void> => {
	// Send logout presence to immediately mark as offline
	try {
		await sendLogoutPresence();
	} catch (error) {
		console.error('Failed to send logout presence:', error);
		// Continue with logout even if this fails
	}
	
	// Stop heartbeat system
	stopHeartbeat();
	
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

// Search users for adding friends
export const searchUsers = async (searchTerm: string): Promise<{
	success: boolean;
	users?: User[];
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

		const response = await fetch(`${API_URL}/auth/users/search?q=${encodeURIComponent(searchTerm)}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			return { success: true, users: data.users };
		} else {
			return { success: false, message: data.message || 'Search failed', error: data.error };
		}
	} catch (error) {
		console.error('Search users error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Add friend
export const addFriend = async (friendId: string): Promise<{
	success: boolean;
	friend?: User;
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

		const response = await fetch(`${API_URL}/auth/friends`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			},
			body: JSON.stringify({ friendId })
		});

		const data = await response.json();

		if (data.success) {
			return { success: true, friend: data.friend };
		} else {
			return { success: false, message: data.message || 'Failed to add friend', error: data.error };
		}
	} catch (error) {
		console.error('Add friend error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Remove friend
export const removeFriend = async (friendId: string): Promise<{
	success: boolean;
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

		const response = await fetch(`${API_URL}/auth/friends/${friendId}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			return { success: true };
		} else {
			return { success: false, message: data.message || 'Failed to remove friend', error: data.error };
		}
	} catch (error) {
		console.error('Remove friend error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Get friends list
export const getFriends = async (): Promise<{
	success: boolean;
	friends?: User[];
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

		const response = await fetch(`${API_URL}/auth/friends`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			return { success: true, friends: data.friends };
		} else {
			return { success: false, message: data.message || 'Failed to get friends', error: data.error };
		}
	} catch (error) {
		console.error('Get friends error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Get online status for friends
export const getFriendsOnlineStatus = async (userIds: string[]): Promise<{
	success: boolean;
	onlineStatus?: Record<string, boolean>;
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

		const response = await fetch(`http://localhost:3003/presence/users`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			},
			body: JSON.stringify({ userIds })
		});

		const data = await response.json();
		
		if (data.success) {
			return { success: true, onlineStatus: data.onlineStatus };
		} else {
			return { success: false, message: data.message || 'Failed to get online status', error: data.error };
		}
	} catch (error) {
		console.error('Get friends online status error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// ========== DM FUNCTIONS ==========

// Create or get DM room with a friend
export const createOrGetDM = async (friendId: string): Promise<{
	success: boolean;
	room?: any;
	message?: string;
	error?: any;
}> => {
	try {
		// Get current user and token from store
		let currentUser: User | null = null;
		let currentToken: string | null = null;
		
		const unsubscribeUser = user.subscribe(value => {
			currentUser = value;
		});
		const unsubscribeToken = token.subscribe(value => {
			currentToken = value;
		});
		unsubscribeUser();
		unsubscribeToken();

		if (!currentUser || !currentToken) {
			return { success: false, message: 'Not authenticated' };
		}

		const response = await fetch(`http://localhost:3002/dm/${currentUser.id}/${friendId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			return { success: true, room: data.room };
		} else {
			return { success: false, message: data.message || 'Failed to create/get DM', error: data.error };
		}
	} catch (error) {
		console.error('Create/get DM error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Get all DM rooms for current user
export const getUserDMs = async (): Promise<{
	success: boolean;
	dms?: any[];
	message?: string;
	error?: any;
}> => {
	try {
		// Get current user and token from store
		let currentUser: User | null = null;
		let currentToken: string | null = null;
		
		const unsubscribeUser = user.subscribe(value => {
			currentUser = value;
		});
		const unsubscribeToken = token.subscribe(value => {
			currentToken = value;
		});
		unsubscribeUser();
		unsubscribeToken();

		if (!currentUser || !currentToken) {
			return { success: false, message: 'Not authenticated' };
		}

		const response = await fetch(`http://localhost:3002/users/${currentUser.id}/dms`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			return { success: true, dms: data.dms };
		} else {
			return { success: false, message: data.message || 'Failed to get DMs', error: data.error };
		}
	} catch (error) {
		console.error('Get user DMs error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// ========== HEARTBEAT PRESENCE SYSTEM ==========

// Send heartbeat to maintain online presence
export const sendHeartbeat = async (): Promise<{
	success: boolean;
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

		const response = await fetch(`http://localhost:3003/presence/heartbeat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			console.log('Heartbeat sent successfully:', data.timestamp);
			return { success: true };
		} else {
			console.error('Heartbeat failed:', data.message);
			return { success: false, message: data.message || 'Heartbeat failed', error: data.error };
		}
	} catch (error) {
		console.error('Heartbeat error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Send logout presence to immediately mark as offline
export const sendLogoutPresence = async (): Promise<{
	success: boolean;
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

		const response = await fetch(`http://localhost:3003/presence/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${currentToken}`
			}
		});

		const data = await response.json();

		if (data.success) {
			console.log('Logout presence sent successfully:', data.timestamp);
			return { success: true };
		} else {
			console.error('Logout presence failed:', data.message);
			return { success: false, message: data.message || 'Logout presence failed', error: data.error };
		}
	} catch (error) {
		console.error('Logout presence error:', error);
		return { success: false, message: 'Network or server error', error };
	}
};

// Start heartbeat interval (call this when user logs in)
let heartbeatInterval: NodeJS.Timeout | null = null;

export const startHeartbeat = (): void => {
	// Clear any existing interval
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
	}

	// Send initial heartbeat
	sendHeartbeat();

	// Send heartbeat every 60 seconds
	heartbeatInterval = setInterval(() => {
		sendHeartbeat();
	}, 60000); // 60 seconds

	console.log('Heartbeat system started - pinging every 60 seconds');
};

// Stop heartbeat interval (call this when user logs out)
export const stopHeartbeat = (): void => {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
		console.log('Heartbeat system stopped');
	}
};
