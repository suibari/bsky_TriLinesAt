import { writable } from 'svelte/store';

export const lightboxImage = writable<string | null>(null);

export function openLightbox(url: string) {
  lightboxImage.set(url);
}

export function closeLightbox() {
  lightboxImage.set(null);
}
