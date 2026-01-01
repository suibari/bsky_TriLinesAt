<script lang="ts">
  import { createDiary } from "$lib/bsky";
  import { session } from "$lib/auth/session";
  import Button from "$lib/components/Button.svelte";
  import {
    Image as ImageIcon,
    X,
    ChevronLeft,
    Send,
    Loader2,
  } from "lucide-svelte";
  import { goto } from "$app/navigation";

  // Redirect if not authed
  $: if (!$session.loading && !$session.isAuthenticated) {
    goto("/");
  }

  let lines = [
    { text: "", image: undefined as Blob | undefined, preview: "" },
    { text: "", image: undefined as Blob | undefined, preview: "" },
    { text: "", image: undefined as Blob | undefined, preview: "" },
  ];

  let shareToBluesky = true;
  let submitting = false;

  const MAX_CHARS = 50;

  function handleImageSelect(index: number, e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      lines[index].image = file;
      lines[index].preview = URL.createObjectURL(file);
      lines = lines; // trigger update
    }
  }

  function removeImage(index: number) {
    lines[index].image = undefined;
    lines[index].preview = "";
    lines = lines;
  }

  async function handleSubmit() {
    if (lines.some((l) => l.text.length > MAX_CHARS)) {
      alert("Each line must be 50 characters or less.");
      return;
    }
    if (lines.every((l) => !l.text.trim())) {
      alert("Please write at least something!");
      return;
    }

    submitting = true;
    try {
      await createDiary(
        lines.map((l) => ({ text: l.text, image: l.image })),
        shareToBluesky,
      );
      goto(`/user/${$session.did}`);
    } catch (e) {
      console.error(e);
      alert("Failed to post diary.");
    } finally {
      submitting = false;
    }
  }
</script>

<div class="max-w-xl mx-auto px-4 py-6 min-h-screen pb-20">
  <header class="flex items-center justify-between mb-8">
    <a
      href="/"
      class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
    >
      <ChevronLeft size={24} />
    </a>
    <h1 class="text-xl font-bold">New Entry</h1>
    <div class="w-8"></div>
  </header>

  <div class="space-y-6">
    {#each lines as line, i}
      <div
        class="glass-panel p-4 rounded-xl relative group focus-within:ring-2 ring-violet-500/50 transition-all"
      >
        <label
          for="line-{i}"
          class="block text-xs font-mono font-bold text-fuchsia-400 mb-2 opacity-70"
          >LINE 0{i + 1}</label
        >

        <textarea
          id="line-{i}"
          bind:value={line.text}
          maxlength={MAX_CHARS}
          placeholder="Write up to 50 chars..."
          class="w-full bg-transparent border-none focus:ring-0 text-lg placeholder-slate-600 resize-none h-16 leading-relaxed"
        ></textarea>

        <!-- Image Preview -->
        {#if line.preview}
          <div
            class="relative mt-2 w-24 h-24 rounded-lg overflow-hidden border border-white/10 group-image"
          >
            <img
              src={line.preview}
              alt="Line attachment"
              class="w-full h-full object-cover"
            />
            <button
              class="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-500/80 transition-colors"
              on:click={() => removeImage(i)}
            >
              <X size={12} />
            </button>
          </div>
        {:else}
          <div
            class="absolute bottom-4 right-4 opacity-0 group-focus-within:opacity-100 transition-opacity"
          >
            <label
              class="cursor-pointer text-slate-400 hover:text-white p-2 bg-white/5 rounded-lg backdrop-blur-sm block"
            >
              <ImageIcon size={18} />
              <input
                type="file"
                accept="image/*"
                class="hidden"
                on:change={(e) => handleImageSelect(i, e)}
              />
            </label>
          </div>
        {/if}

        <div
          class="absolute top-4 right-4 text-xs {line.text.length >= MAX_CHARS
            ? 'text-red-400'
            : 'text-slate-600'} font-mono"
        >
          {line.text.length}/{MAX_CHARS}
        </div>
      </div>
    {/each}

    <!-- Options -->
    <div class="glass-panel rounded-xl p-4 flex items-center justify-between">
      <span class="text-sm font-medium text-slate-300"
        >Share to Bluesky Feed</span
      >
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={shareToBluesky}
          class="sr-only peer"
        />
        <div
          class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"
        ></div>
      </label>
    </div>

    <div class="pt-4">
      <Button
        variant="primary"
        class="w-full py-4 text-lg shadow-xl shadow-fuchsia-900/20"
        onclick={handleSubmit}
        disabled={submitting}
      >
        {#if submitting}
          <Loader2 class="animate-spin mr-2" /> Posting...
        {:else}
          <Send class="mr-2" size={18} /> Publish Diary
        {/if}
      </Button>
    </div>
  </div>
</div>
