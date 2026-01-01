<script lang="ts">
  import type { TriLinesEntry } from "$lib/types";
  import { getBlobUrl, likeEntry, unlikeEntry, getEntryLikes } from "$lib/bsky";
  import Avatar from "./Avatar.svelte";
  import { session } from "$lib/auth/session";
  import { deleteRecord } from "$lib/bsky";
  import { createEventDispatcher, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Heart, ExternalLink, Trash2 } from "lucide-svelte";

  const dispatch = createEventDispatcher();

  export let entry: TriLinesEntry;
  export let author: any;
  export let rkey: string | undefined = undefined; // passed if we know it

  // Determine post link
  $: postLink =
    entry.sharedPost && author
      ? `https://bsky.app/profile/${author.did}/post/${entry.sharedPost.uri.split("/").pop()}`
      : "#";

  // Format date
  $: date = new Date(entry.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Like Logic
  let likes = 0;
  let liked = false;
  let myLikeUri: string | undefined = undefined;
  let likeAvatars: any[] = [];
  let likeLoading = false;

  async function loadLikes() {
    if (!entry?.uri) return;
    try {
      const links = await getEntryLikes(entry.uri);
      // links: [{ uri, cid, author, value: {...} }, ...]
      likes = links.length;

      // Distinct authors for avatars
      // We might need to fetch profiles if 'author' is just a DID.
      // Constellation usually returns 'author' as string DID.
      // We'll need to fetch profiles or just show placeholders?
      // For MVP, if author is DID, we can't show avatar easily without fetching.
      // Does Constellation return expanded author? The docs say "author" is DID.
      // We can try to match with session DID for 'liked' status.
      // And fetch profiles for avatars? Or maybe we skip avatars for now if too heavy?
      // User requested avatars. We can batch fetch profiles or just show a count?
      // Let's assume we can fetch a few profiles.

      const viewerDid = $session.did;
      const myLike = links.find((l: any) => l.author === viewerDid);
      if (myLike) {
        liked = true;
        myLikeUri = myLike.uri;
      } else {
        liked = false;
        myLikeUri = undefined;
      }

      // Distinct authors for avatars
      const uniqueDids = Array.from(
        new Set(links.map((l: any) => l.author || l.did).filter(Boolean)),
      ).slice(0, 5) as string[];
      if (uniqueDids.length > 0 && $session.agent) {
        try {
          const { data } = await $session.agent.app.bsky.actor.getProfiles({
            actors: uniqueDids,
          });
          likeAvatars = data.profiles;
        } catch {
          // fallback or ignore
        }
      }
    } catch (e) {
      console.warn("Error loading likes", e);
    }
  }

  async function toggleLike(e: MouseEvent) {
    e.stopPropagation();
    if (likeLoading || !$session.isAuthenticated) return;
    likeLoading = true;

    const originalLiked = liked;
    const originalLikes = likes;
    const originalAvatars = [...likeAvatars];
    const originalUri = myLikeUri;

    try {
      if (originalLiked && originalUri) {
        // Optimistic UI update: Remove like
        liked = false;
        likes = Math.max(0, likes - 1);
        myLikeUri = undefined;
        likeAvatars = likeAvatars.filter((p) => p.did !== $session.did);

        // Actual API call
        await unlikeEntry(originalUri);
      } else {
        // Optimistic UI update: Add like
        liked = true;
        likes++;

        // Try to add self to avatars optimistically
        if ($session.did && $session.agent) {
          try {
            const { data: profile } =
              await $session.agent.app.bsky.actor.getProfile({
                actor: $session.did,
              });
            if (!likeAvatars.find((p) => p.did === $session.did)) {
              likeAvatars = [...likeAvatars, profile];
            }
          } catch {
            // silent fail on profile fetch, count is still updated
          }
        }

        // Actual API call
        const res = await likeEntry(entry.uri, entry.cid);
        myLikeUri = res.uri;
      }
    } catch (e) {
      console.error("Like failed", e);
      // Rollback on error
      liked = originalLiked;
      likes = originalLikes;
      likeAvatars = originalAvatars;
      myLikeUri = originalUri;
      alert("Action failed. Constellation indexing may be delayed.");
    } finally {
      likeLoading = false;
    }
  }

  function handleCardClick() {
    if (!author) return;
    if (rkey) {
      goto(`/entry/${author.did}/${rkey}`);
    } else {
      const parts = entry.uri.split("/");
      const extractedRkey = parts.pop();
      if (extractedRkey) {
        goto(`/entry/${author.did}/${extractedRkey}`);
      }
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this diary entry?")) return;
    try {
      await deleteRecord(entry.uri);
      dispatch("delete", { uri: entry.uri });
    } catch (e) {
      alert("Failed to delete entry: " + e);
    }
  }

  onMount(() => {
    loadLikes();
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="glass-panel p-6 rounded-2xl space-y-4 hover:bg-white/5 transition-colors cursor-pointer"
  on:click={handleCardClick}
>
  <!-- Header -->
  <div class="flex items-center gap-3">
    {#if author}
      <a href="/user/{author.did}" class="shrink-0" on:click|stopPropagation>
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
          on:click|stopPropagation
        >
          {author.displayName || author.handle}
        </a>
        <div class="text-xs text-slate-400">@{author.handle} • {date}</div>
      </div>
    {:else}
      <div class="w-10 h-10 rounded-full bg-white/5 animate-pulse"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 bg-white/5 rounded w-1/4 animate-pulse"></div>
        <div class="h-3 bg-white/5 rounded w-1/3 animate-pulse"></div>
      </div>
    {/if}
    {#if entry.sharedPost}
      <a
        href={postLink}
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-500 hover:text-white"
        title="View on Bluesky"
        on:click|stopPropagation
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
            <div
              class="relative overflow-hidden rounded-lg mt-2 max-w-sm bg-black/20"
            >
              <img
                src={getBlobUrl(author?.did || entry.authorDid, line.image)}
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
  <div class="flex items-center gap-4 pt-2 border-t border-white/5 h-10">
    <button
      class="flex items-center gap-2 text-sm font-medium transition-colors {liked
        ? 'text-pink-500'
        : 'text-slate-400 hover:text-pink-400'}"
      on:click={toggleLike}
      disabled={likeLoading}
    >
      <Heart class={liked ? "fill-current" : ""} size={18} />
      <span>{likes}</span>
    </button>

    <!-- Like Avatars -->
    {#if likeAvatars.length > 0}
      <div class="flex items-center -space-x-2 overflow-hidden ml-2">
        {#each likeAvatars as profile}
          <div
            class="w-6 h-6 rounded-full border border-slate-900 bg-slate-800 ring-2 ring-slate-900"
            title={profile.handle}
          >
            {#if profile.avatar}
              <img
                src={profile.avatar}
                alt={profile.handle}
                class="w-full h-full object-cover rounded-full"
              />
            {:else}
              <div class="w-full h-full bg-slate-700 rounded-full"></div>
            {/if}
          </div>
        {/each}
        {#if likes > 5}
          <div class="pl-3 text-xs text-slate-500 font-medium">
            +{likes - 5}
          </div>
        {/if}
      </div>
    {/if}

    {#if author && $session.isAuthenticated && $session.did === author.did}
      <button
        class="ml-2 text-slate-400 hover:text-red-500 transition-colors"
        on:click={handleDelete}
        title="Delete Entry"
      >
        <Trash2 size={18} />
      </button>
    {/if}
  </div>
</div>
