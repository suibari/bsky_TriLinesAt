<script lang="ts">
  import type { TriLinesEntry, TriLinesEntryView } from "$lib/types";
  import { getBlobUrl, likeEntry, unlikeEntry, getPostInteractionState, updateDiaryLines } from "$lib/bsky";
  import Avatar from "./Avatar.svelte";
  import { session } from "$lib/auth/session";
  import { deleteRecord } from "$lib/bsky";
  import { createEventDispatcher, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Heart, Pencil, Trash2, X } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import { Agent } from "@atproto/api";
  import { userBadges } from "$lib/stores/badges";
  import { NAGI_URL } from "$lib/config";

  const dispatch = createEventDispatcher();

  export let entry: TriLinesEntryView;
  export let author: any;
  export let rkey: string | undefined = undefined; // passed if we know it
  // Allow the owner to edit the line texts in place (entry page only)
  export let editable = false;

  const MAX_CHARS = 50;
  let editing = false;
  let saving = false;
  let editTexts: string[] = [];

  $: isOwner =
    !!author && $session.isAuthenticated && $session.did === author.did;
  $: canSave =
    !saving &&
    editTexts.every((text) => text.trim().length > 0) &&
    editTexts.some((text, i) => text !== entry.lines[i]?.text);

  function startEdit() {
    editTexts = entry.lines.map((line) => line.text);
    editing = true;
  }

  async function saveEdit() {
    if (!canSave) return;
    saving = true;
    try {
      const { cid, lines } = await updateDiaryLines(entry.uri, editTexts);
      entry = { ...entry, cid, lines };
      editing = false;
    } catch (e) {
      alert($t("card.edit_failed") + e);
    } finally {
      saving = false;
    }
  }

  // Determine post link
  $: postLink =
    entry.sharedPost && author
      ? `https://bsky.app/profile/${author.did}/post/${entry.sharedPost.uri.split("/").pop()}`
      : "#";
  $: nagiPostLink =
    entry.sharedNagiPost && author
      ? `${NAGI_URL}/thread/${author.did}/${entry.sharedNagiPost.uri.split("/").pop()}`
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
  // Viewer already counted via a like on the shared Bluesky/Nagi post
  let viewerSharedLike = false;
  // Heart is filled if the viewer is counted by either a TriLines or a shared-post like
  $: likedDisplay = liked || viewerSharedLike;

  async function loadLikes() {
    // If passed via props, use it
    if (typeof entry.likeCount === "number") {
      applyInteractions(entry);
      return;
    }

    // Fallback: Fetch if not provided (retaining standalone capability)
    if (!entry?.uri) return;
    applyInteractions(await getPostInteractionState(entry, $session.did ?? undefined));
  }

  function applyInteractions(state: {
    likeCount?: number;
    viewerLike?: string;
    viewerSharedLike?: boolean;
    likeAvatars?: any[];
  }) {
    likes = state.likeCount ?? 0;
    liked = !!state.viewerLike;
    myLikeUri = state.viewerLike;
    viewerSharedLike = !!state.viewerSharedLike;
    likeAvatars = state.likeAvatars || [];
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
          myLikeUri = undefined;
          if (!viewerSharedLike) {
            likes = Math.max(0, likes - 1);
            likeAvatars = likeAvatars.filter((p) => p.did !== $session.did);
          }

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
        if (!viewerSharedLike) likes++;

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
    if (!author || editing) return;
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
          badge={$userBadges[author.did]}
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
        class="text-slate-500 hover:text-white text-xs font-bold leading-4"
        title={$t("card.view_on_bsky")}
        on:click|stopPropagation
      >
        Bluesky
      </a>
    {/if}
    {#if entry.sharedNagiPost}
      <a
        href={nagiPostLink}
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-500 hover:text-white text-xs font-bold leading-4"
        title={$t("card.view_on_nagi")}
        on:click|stopPropagation
      >
        Nagi
      </a>
    {/if}
  </div>

  <!-- Diary Lines -->
  {#if editing}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="space-y-3 py-2" on:click|stopPropagation>
      {#each editTexts as _, i}
        <div class="flex gap-4 items-center">
          <label
            for="edit-line-{i}"
            class="text-fuchsia-400 font-mono font-bold opacity-50 select-none"
            >0{i + 1}</label
          >
          <input
            id="edit-line-{i}"
            type="text"
            bind:value={editTexts[i]}
            maxlength={MAX_CHARS}
            class="flex-1 min-w-0 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 ring-violet-500/50"
          />
          <span
            class="text-[10px] font-mono shrink-0 {editTexts[i].length >= MAX_CHARS
              ? 'text-red-400'
              : 'text-slate-600'}"
          >
            {editTexts[i].length}/{MAX_CHARS}
          </span>
        </div>
      {/each}
      {#if entry.sharedPost || entry.sharedNagiPost}
        <p class="text-xs text-slate-500">{$t("card.edit_shared_note")}</p>
      {/if}
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          on:click={() => (editing = false)}
          disabled={saving}
        >
          {$t("editor.cancel")}
        </button>
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 transition-all"
          on:click={saveEdit}
          disabled={!canSave}
        >
          {saving ? $t("card.saving") : $t("card.save")}
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-4 py-2">
      {#each entry.lines as line, i}
        <div class="flex gap-4 items-start group">
          <span
            class="text-fuchsia-400 font-mono font-bold pt-1 opacity-50 select-none"
            >0{i + 1}</span
          >
          <div class="flex-1 space-y-2 min-w-0 overflow-hidden">
            <p
              class="text-lg leading-relaxed text-slate-100 break-all w-full whitespace-pre-wrap"
              style="overflow-wrap: anywhere;"
            >
              {line.text}
            </p>
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
  {/if}

  <!-- Actions -->
  <div class="flex items-center gap-4 pt-2 border-t border-white/5 h-10">
    <button
      class="flex items-center gap-2 text-sm font-medium transition-colors {likedDisplay
        ? 'text-pink-500'
        : 'text-slate-400 hover:text-pink-400'}"
      on:click={toggleLike}
      disabled={likeLoading}
    >
      <Heart class={likedDisplay ? "fill-current" : ""} size={18} />
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
                src={profile.avatar?.replace(
                  "/img/avatar/",
                  "/img/avatar_thumbnail/",
                )}
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

    {#if isOwner}
      {#if editable && !editing}
        <button
          class="ml-auto text-slate-400 hover:text-white transition-colors"
          on:click|stopPropagation={startEdit}
          title={$t("card.edit")}
        >
          <Pencil size={18} />
        </button>
      {/if}
      <button
        class="{editable && !editing ? '' : 'ml-auto'} text-slate-400 hover:text-red-500 transition-colors"
        on:click={handleDelete}
        title={$t("card.delete")}
      >
        <Trash2 size={18} />
      </button>
    {/if}
  </div>
</div>
