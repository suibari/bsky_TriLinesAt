<script lang="ts">
  import type { TriLinesEntry } from "$lib/types";
  import type { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { getBlobUrl } from "$lib/bsky";
  import Avatar from "./Avatar.svelte";
  import Button from "./Button.svelte";
  import { Heart, MessageCircle, Share2, ExternalLink } from "lucide-svelte";

  export let entry: TriLinesEntry;
  export let author: any;
  export let rkey: string | undefined = undefined; // passed if we know it

  // Determine post link
  $: postLink = entry.sharedPost
    ? `https://bsky.app/profile/${author.did}/post/${entry.sharedPost.uri.split("/").pop()}`
    : "#";

  // Format date
  $: date = new Date(entry.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Placeholder like function
  let liked = false;
  let likes = Math.floor(Math.random() * 10); // Fake count for MVP demo
  function toggleLike() {
    liked = !liked;
    likes += liked ? 1 : -1;
  }
</script>

<div
  class="glass-panel p-6 rounded-2xl space-y-4 hover:bg-white/5 transition-colors"
>
  <!-- Header -->
  <div class="flex items-center gap-3">
    <a href="/user/{author.did}" class="shrink-0">
      <Avatar
        src={author.avatar}
        alt={author.displayName || author.handle}
        size="md"
      />
    </a>
    <div class="min-w-0 flex-1">
      <a
        href="/user/{author.did}"
        class="block font-semibold hover:underline truncate"
      >
        {author.displayName || author.handle}
      </a>
      <div class="text-xs text-slate-400">@{author.handle} • {date}</div>
    </div>
    {#if entry.sharedPost}
      <a
        href={postLink}
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-500 hover:text-white"
        title="View on Bluesky"
      >
        <ExternalLink size={16} />
      </a>
    {/if}
  </div>

  <!-- Diary Lines -->
  <div class="space-y-4 py-2">
    {#each entry.lines as line, i}
      <div class="flex gap-4 items-start group">
        <span
          class="text-fuchsia-400 font-mono font-bold pt-1 opacity-50 select-none"
          >0{i + 1}</span
        >
        <div class="flex-1 space-y-2">
          <p class="text-lg leading-relaxed text-slate-100">{line.text}</p>
          {#if line.image}
            <div class="relative overflow-hidden rounded-lg mt-2 max-w-sm">
              <img
                src={getBlobUrl(author.did, line.image)}
                alt="Entry attachment"
                class="w-full h-auto max-h-64 object-cover transform hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-4 pt-2 border-t border-white/5">
    <button
      class="flex items-center gap-2 text-sm font-medium transition-colors {liked
        ? 'text-pink-500'
        : 'text-slate-400 hover:text-pink-400'}"
      on:click={toggleLike}
    >
      <Heart class={liked ? "fill-current" : ""} size={18} />
      <span>{likes}</span>
    </button>
    <a
      href={postLink}
      target="_blank"
      class="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-blue-400 transition-colors"
    >
      <MessageCircle size={18} />
      <span>Comment</span>
    </a>
    <button class="ml-auto text-slate-400 hover:text-white">
      <Share2 size={18} />
    </button>
  </div>
</div>
