<script lang="ts">
  import { lightboxImage, closeLightbox } from "$lib/stores/lightbox";
  import { X } from "lucide-svelte";
  import { fade } from "svelte/transition";
</script>

{#if $lightboxImage}
  <div
    class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 outline-none"
    on:click={closeLightbox}
    on:keydown={(e) => {
      if (e.key === "Escape") closeLightbox();
    }}
    role="dialog"
    aria-label="Image Lightbox"
    tabindex="-1"
    aria-modal="true"
    transition:fade={{ duration: 200 }}
  >
    <button
      class="absolute top-4 right-4 p-2 text-white bg-black/50 hover:bg-black/70 rounded-full transition-all backdrop-blur-sm z-10"
      on:click={closeLightbox}
      aria-label="Close lightbox"
    >
      <X size={24} />
    </button>
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <img
      src={$lightboxImage}
      alt="Full size"
      class="max-w-full max-h-screen object-contain shadow-2xl select-none"
      on:click|stopPropagation
    />
  </div>
{/if}
