// API client for connecting to Dinguscord backend services

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface ApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: HeadersInit;
    requiresAuth?: boolean;
}

/**
 * Makes an API request to the backend
 */
export async function apiRequest<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const {
        method = 'GET',
        body,
        headers = {},
        requiresAuth = true
    } = options;

    const requestHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...headers
    };

    // Add authentication if required and available
    if (requiresAuth) {
        // TODO: Get auth token from session/storage
        const token = localStorage.getItem('auth_token');
        if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    const requestOptions: RequestInit = {
        method,
        headers: requestHeaders,
        credentials: 'include',
    };

    if (body) {
        requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return response.text() as unknown as T;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status} ${response.statusText}`);
    }
    
    return data;
}

// Authentication endpoints
export const authApi = {
    login: (credentials: { username: string, password: string }) => 
        apiRequest<{ token: string, user: any }>('/auth/login', {
            method: 'POST',
            body: credentials,
            requiresAuth: false
        }),
    
    register: (userData: { username: string, password: string, email: string }) => 
        apiRequest<{ success: boolean }>('/auth/register', {
            method: 'POST',
            body: userData,
            requiresAuth: false
        }),
        
    getCurrentUser: () => apiRequest<any>('/auth/me'),
};

// Chat room endpoints
export const chatRoomApi = {
    getRooms: () => apiRequest<any[]>('/rooms'),
    
    getRoom: (roomId: string) => apiRequest<any>(`/rooms/${roomId}`),
    
    createRoom: (roomData: { name: string }) => 
        apiRequest<any>('/rooms', {
            method: 'POST',
            body: roomData
        }),
        
    addUserToRoom: (roomId: string, userId: string) => 
        apiRequest<any>(`/rooms/${roomId}/add/${userId}`, {
            method: 'POST'
        }),
};

// Message endpoints
export const messageApi = {
    getRoomMessages: (roomId: string) => 
        apiRequest<any[]>(`/messages/room/${roomId}`),
    
    sendRoomMessage: (roomId: string, message: string) => 
        apiRequest<any>(`/messages`, {
            method: 'POST',
            body: { room_id: roomId, text: message }
        }),
        
    getDirectMessages: (userId: string) => 
        apiRequest<any[]>(`/messages/direct/${userId}`),
        
    sendDirectMessage: (userId: string, message: string) => 
        apiRequest<any>(`/messages`, {
            method: 'POST',
            body: { receiver_id: userId, text: message }
        }),
};

// User presence endpoints
export const presenceApi = {
    getUserStatus: (userId: string) => 
        apiRequest<{ status: string }>(`/presence/${userId}`),
    
    setUserStatus: (status: string) => 
        apiRequest<{ status: string }>(`/presence`, {
            method: 'POST',
            body: { status }
        }),
}; 