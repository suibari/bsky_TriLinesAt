<script lang="ts">
  import { page } from "$app/stores";
  import { getEntries } from "$lib/bsky";
  import { session, initSession } from "$lib/auth/session";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import CommitGraph from "$lib/components/CommitGraph.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import { Agent } from "@atproto/api";
  import {
    ChevronLeft,
    Loader2,
    Edit3,
    Settings as SettingsIcon,
  } from "lucide-svelte";
  import type { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { t } from "$lib/i18n";

  import { Confetti } from "svelte-confetti";
  import { fade, scale } from "svelte/transition";

  import { onMount } from "svelte";

  $: did = $page.params.did;

  // Core State
  let entries: any[] = [];
  let useProfile: any | null = null;
  let loading = true;

  // Celebration State
  let showCelebration = false;
  let celebrationMessage = "";
  let streakCount = 0;

  $: if (did && $session.agent) {
    loadUser();
  }

  onMount(() => {
    if (!$session.agent) {
      initSession();
    }

    // Check URL params for celebration
    const created = $page.url.searchParams.get("created") === "true";
    if (created && did === $session.did) {
      const isFirst = $page.url.searchParams.get("isFirst") === "true";
      const streak = parseInt($page.url.searchParams.get("streak") || "0");
      streakCount = streak;

      if (isFirst) {
        celebrationMessage = $t("celebration.first");
      } else if (streak >= 2) {
        celebrationMessage = $t("celebration.streak").replace(
          "{n}",
          streak.toString(),
        );
      } else {
        celebrationMessage = $t("celebration.posted");
      }

      showCelebration = true;

      // Clean up URL without reload
      const newUrl = new URL($page.url);
      newUrl.searchParams.delete("created");
      newUrl.searchParams.delete("isFirst");
      newUrl.searchParams.delete("streak");
      window.history.replaceState({}, "", newUrl);
    }
  });

  async function loadUser() {
    loading = true;
    try {
      // 1. Get Profile
      try {
        const publicAgent = new Agent("https://public.api.bsky.app");
        const { data } = await publicAgent.app.bsky.actor.getProfile({
          actor: did!,
        });
        useProfile = data;
      } catch (e) {
        console.warn("Failed to fetch profile", e);
        useProfile = null;
      }

      // 2. Get Entries
      // getEntries returns already flattened objects with uri/cid included
      const records = await getEntries(did!);
      entries = records;

      // Sort
      entries.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function getDateHeader(isoString: string) {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
</script>

<div class="min-h-screen pb-20">
  <!-- Header -->
  <div
    class="glass-panel sticky top-0 z-40 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl"
  >
    <div class="max-w-xl mx-auto px-4 h-14 flex items-center gap-4">
      <a
        href="/"
        class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={24} />
      </a>
      <h1 class="font-bold text-lg flex-1">
        {useProfile
          ? useProfile.displayName || useProfile.handle
          : $t("user.loading")}
      </h1>
      {#if did === $session.did}
        <a
          href="/settings"
          class="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
        >
          <SettingsIcon size={20} />
        </a>
      {/if}
    </div>
  </div>

  <div class="max-w-xl mx-auto px-4 py-6 space-y-8">
    {#if loading && !useProfile}
      <div class="flex justify-center py-20">
        <Loader2 class="animate-spin text-fuchsia-500" size={32} />
      </div>
    {:else if useProfile}
      <!-- Profile Header -->
      <div class="flex flex-col items-center text-center space-y-4 py-6">
        <a
          href="https://bsky.app/profile/{useProfile.handle}"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:opacity-80 transition-opacity"
          title={$t("card.view_on_bsky")}
        >
          <Avatar src={useProfile.avatar} size="xl" ring />
        </a>
        <div>
          <h2 class="text-2xl font-bold">
            {useProfile.displayName || useProfile.handle}
          </h2>
          <p class="text-slate-400">@{useProfile.handle}</p>
        </div>
        {#if useProfile.description}
          <p class="text-sm text-slate-300 max-w-sm whitespace-pre-wrap">
            {useProfile.description}
          </p>
        {/if}

        {#if did === $session.did}
          <div class="pt-2">
            <span
              class="text-xs px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
              >{$t("user.thats_you")}</span
            >
          </div>
        {/if}
      </div>

      <!-- Commit Graph -->
      <CommitGraph {entries} />

      <!-- Entries -->
      <div class="space-y-6">
        <div
          class="flex items-center gap-4 before:h-px before:flex-1 before:bg-gradient-to-r before:from-transparent before:to-white/10 after:h-px after:flex-1 after:bg-gradient-to-l after:from-transparent after:to-white/10"
        >
          <span
            class="text-xs font-mono text-slate-500 uppercase tracking-widest"
            >{$t("feed.diary_entries")}</span
          >
        </div>

        {#if loading}
          <div class="glass-panel p-6 animate-pulse space-y-4">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-full bg-white/5"></div>
              <div class="flex-1 py-1 space-y-2">
                <div class="h-4 bg-white/5 rounded w-1/3"></div>
                <div class="h-3 bg-white/5 rounded w-1/4"></div>
              </div>
            </div>
          </div>
        {:else if entries.length === 0}
          <p class="text-center text-slate-500 py-8">
            {$t("feed.no_entries")}
          </p>
        {:else}
          {#each entries as entry, i (entry.uri)}
            {@const currentDate = getDateHeader(entry.createdAt)}
            {@const prevDate =
              i > 0 ? getDateHeader(entries[i - 1].createdAt) : null}
            {@const isToday =
              currentDate === getDateHeader(new Date().toISOString())}

            {#if (i === 0 || currentDate !== prevDate) && !isToday}
              <div class="flex items-center gap-4 py-4 opacity-70">
                <div
                  class="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"
                ></div>
                <span
                  class="text-xs font-mono font-bold text-fuchsia-300 tracking-widest"
                  >{currentDate}</span
                >
                <div
                  class="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"
                ></div>
              </div>
            {/if}

            <DiaryCard
              {entry}
              author={useProfile}
              on:update={(e) => {
                // Optional: Optimistic update if needed for profile view
              }}
              on:delete={(e) => {
                entries = entries.filter((item) => item.uri !== e.detail.uri);
              }}
            />
          {/each}
        {/if}
      </div>
    {:else}
      <div class="text-center py-20 text-red-400">
        {$t("user.not_found")}
      </div>
    {/if}
  </div>

  {#if did === $session.did}
    <!-- FAB (Floating Action Button) -->
    <a href="/new" class="fixed bottom-6 right-6 z-50">
      <button
        class="w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Edit3 size={24} />
      </button>
    </a>
  {/if}
</div>

{#if showCelebration}
  <!-- Confetti Background -->
  <div
    class="fixed top-[-50px] left-0 h-[100vh] w-[100vw] flex justify-center overflow-hidden pointer-events-none z-[100]"
  >
    <Confetti
      x={[-5, 5]}
      y={[0, 0.1]}
      delay={[-1000, 10000]}
      duration={5000}
      amount={400}
      fallDistance="100vh"
    />
  </div>

  <!-- Modal Overlay -->
  <div
    class="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4"
  >
    <div
      class="glass-panel p-8 rounded-2xl border border-white/20 shadow-2xl shadow-fuchsia-500/20 text-center pointer-events-auto transform max-w-sm w-full"
      in:scale={{ start: 0.8, duration: 400 }}
      out:fade
    >
      <h3
        class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 mb-4 drop-shadow-[0_2px_10px_rgba(255,200,0,0.5)]"
      >
        {$t("celebration.congrats")}
      </h3>
      <p class="text-lg text-white font-medium mb-6">
        {celebrationMessage}
      </p>
      <button
        class="glass-btn px-8 py-3 rounded-full text-base font-bold text-white hover:scale-105 active:scale-95 transition-transform"
        on:click={() => (showCelebration = false)}
      >
        OK
      </button>
    </div>
  </div>
{/if}
