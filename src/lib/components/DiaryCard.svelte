<script lang="ts">
  import { IDS, type TriLinesEntry } from "$lib/types";
  import { getBlobUrl, likeEntry, unlikeEntry, getEntryLikes } from "$lib/bsky";
  import Avatar from "./Avatar.svelte";
  import { session } from "$lib/auth/session";
  import { deleteRecord } from "$lib/bsky";
  import { createEventDispatcher, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Heart, ExternalLink, Trash2, X } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import { Agent } from "@atproto/api";

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
      // Debug
      // console.log("LoadLikes", { viewerDid, links });

      const myLike = links.find((l: any) => {
        const authorDid =
          l.author ||
          l.did ||
          (l.value && l.value.author) ||
          (l.value && l.value.did);
        return authorDid === viewerDid;
      });

      if (myLike) {
        liked = true;
        // Robustly get or construct URI
        if (myLike.uri) {
          myLikeUri = myLike.uri;
        } else {
          // Constellation raw object fallback
          const did = myLike.author || myLike.did;
          const rkey = myLike.rkey;
          const collection = myLike.collection || IDS.TriLinesLike;
          if (did && rkey) {
            myLikeUri = `at://${did}/${collection}/${rkey}`;
          }
        }
      } else {
        liked = false;
        myLikeUri = undefined;
      }

      // Distinct authors for avatars
      const uniqueDids = Array.from(
        new Set(links.map((l: any) => l.author || l.did).filter(Boolean)),
      ).slice(0, 5) as string[];
      if (uniqueDids.length > 0) {
        try {
          const publicAgent = new Agent("https://public.api.bsky.app");
          const { data } = await publicAgent.app.bsky.actor.getProfiles({
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
      if (originalLiked) {
        // Unlike Logic
        if (originalUri) {
          // Optimistic UI update: Remove like
          liked = false;
          likes = Math.max(0, likes - 1);
          myLikeUri = undefined;
          likeAvatars = likeAvatars.filter((p) => p.did !== $session.did);

          // Actual API call
          await unlikeEntry(originalUri);
        } else {
          // If we think it's liked but have no URI, we can't delete it easily.
          // But we MUST NOT try to create a new one (double like).
          // For now, we just refresh the likes to sync state.
          await loadLikes();
        }
      } else {
        // Like Logic
        // Optimistic UI update: Add like
        liked = true;
        likes++;

        // Try to add self to avatars optimistically
        if ($session.did) {
          try {
            const publicAgent = new Agent("https://public.api.bsky.app");
            const { data: profile } =
              await publicAgent.app.bsky.actor.getProfile({
                actor: $session.did,
              });
            if (!likeAvatars.find((p) => p.did === $session.did)) {
              likeAvatars = [...likeAvatars, profile];
            }
          } catch {
            // silent fail
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
      alert($t("card.action_failed"));
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
    if (!confirm($t("card.delete_confirm"))) return;
    try {
      await deleteRecord(entry.uri);
      dispatch("delete", { uri: entry.uri });
    } catch (e) {
      alert($t("card.delete_failed") + e);
    }
  }

  onMount(() => {
    loadLikes();
  });

  // Lightbox handled globally
  import { openLightbox } from "$lib/stores/lightbox";
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
        title={$t("card.view_on_bsky")}
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
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div
              class="relative overflow-hidden rounded-lg mt-2 max-w-sm bg-black/20 group-hover:ring-2 ring-white/10 transition-all cursor-zoom-in"
              on:click={(e) => {
                e.stopPropagation();
                openLightbox(
                  getBlobUrl(author?.did || entry.authorDid, line.image!),
                );
              }}
              role="button"
              tabindex="0"
              on:keydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  openLightbox(
                    getBlobUrl(author?.did || entry.authorDid, line.image!),
                  );
                }
              }}
            >
              <img
                src={getBlobUrl(
                  author?.did || entry.authorDid,
                  line.image!,
                  "thumbnail",
                )}
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
          <a
            href="/user/{profile.did}"
            class="block w-6 h-6 rounded-full border border-slate-900 bg-slate-800 ring-2 ring-slate-900 overflow-hidden hover:scale-110 transition-transform"
            title={`${profile.displayName || profile.handle} (@${profile.handle})`}
            on:click|stopPropagation
          >
            {#if profile.avatar}
              <img
                src={profile.avatar}
                alt={profile.handle}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full bg-slate-700"></div>
            {/if}
          </a>
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
        class="ml-auto text-slate-400 hover:text-red-500 transition-colors"
        on:click={handleDelete}
        title={$t("card.delete")}
      >
        <Trash2 size={18} />
      </button>
    {/if}
  </div>
</div>
