import { writable } from 'svelte/store';

export type User = {
	name: string;
	email: string;
	friends: string[];
};

export const user = writable<User | null>(null);
