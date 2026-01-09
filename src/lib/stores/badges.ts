import { writable } from 'svelte/store';

// Map of DID -> Badge Emoji (or null)
export const userBadges = writable<Record<string, string>>({});
