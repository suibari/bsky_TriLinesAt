<script lang="ts">
  import { onMount } from "svelte";
  import { session, initSession, signIn } from "$lib/auth/session";
  import { getFollows, getGlobalFeed } from "$lib/bsky";
  import Button from "$lib/components/Button.svelte";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import { Edit3, Compass, Users } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import Avatar from "$lib/components/Avatar.svelte";
  import type { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { Agent } from "@atproto/api";
  import { t, locale } from "$lib/i18n";

  // State
  let activeTab: "following" | "global" = "following";
  let entries: any[] = [];
  let loading = false;
  let profiles: Record<string, any> = {};

  onMount(() => {
    initSession().then(() => {
      if ($session.isAuthenticated) {
        loadSelfProfile();
        loadFollowing();
      }
    });
  });

  async function loadSelfProfile() {
    if (!$session.did || !$session.agent) return;
    try {
      const { data } = await $session.agent.app.bsky.actor.getProfile({
        actor: $session.did,
      });
      profiles[$session.did] = data;
    } catch (e) {
      console.warn("Self profile fetch failed, trying public fallback", e);
      try {
        const publicAgent = new Agent("https://api.bsky.app");
        const { data } = await publicAgent.app.bsky.actor.getProfile({
          actor: $session.did,
        });
        profiles[$session.did] = data;
      } catch (e2) {
        console.warn("Public fallback also failed", e2);
      }
    }
  }

  async function loadFollowing() {
    if (!$session.agent) return;
    loading = true;
    try {
      activeTab = "following";
      // 1. Get follows
      const follows = await getFollows($session.did!);
      const followDids = new Set(follows.map((f) => f.did));
      // Include self
      followDids.add($session.did!);

      // 2. Optimization: Filter Global Feed instead of N requests
      // This works efficiently because Constellation returns the global stream.
      // We just pick what matches our follow list.
      const globalPosts = await getGlobalFeed();

      const filteredEntries = globalPosts.filter((entry: any) =>
        followDids.has(entry.authorDid),
      );

      // 3. Get profiles for authors
      const authorDids = [
        ...new Set(
          filteredEntries.map((e: any) => e.authorDid).filter(Boolean),
        ),
      ];
      if (authorDids.length > 0) {
        // Check which profiles we already have to save bandwidth
        const missingDids = authorDids.filter(
          (did) => !profiles[did as string],
        );

        if (missingDids.length > 0) {
          try {
            const { data } = await $session.agent.app.bsky.actor.getProfiles({
              actors: missingDids as string[],
            });
            const newProfiles = { ...profiles };
            data.profiles.forEach((p) => (newProfiles[p.did] = p));
            profiles = newProfiles;
          } catch (e) {
            console.warn("Failed to fetch profiles", e);
          }
        }
      }

      entries = filteredEntries;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function loadGlobal() {
    if (!$session.agent) return;
    loading = true;
    try {
      activeTab = "global";
      // This now returns directly shaped TriLinesEntry objects from Constellation
      const posts = await getGlobalFeed();

      const authorDids = [
        ...new Set(posts.map((p: any) => p.authorDid).filter(Boolean)),
      ] as string[];

      if (authorDids.length > 0) {
        try {
          const { data } = await $session.agent.app.bsky.actor.getProfiles({
            actors: authorDids,
          });
          const newProfiles = { ...profiles };
          data.profiles.forEach((p) => (newProfiles[p.did] = p));
          profiles = newProfiles;
        } catch (e) {
          console.warn("Failed to fetch global profiles", e);
        }
      }

      entries = posts;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function handleSignIn() {
    const handle = prompt($t("auth.handle_prompt"));
    if (handle) {
      signIn(handle);
    }
  }

  function toggleLocale() {
    locale.update((l) => (l === "en" ? "ja" : "en"));
  }
</script>

<div class="min-h-screen text-slate-100 pb-20">
  {#if !$session.isAuthenticated}
    <!-- Landing Page -->
    <div
      class="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center space-y-8"
      in:fade
    >
      <div class="w-full max-w-2xl space-y-4">
        <h1
          class="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-2 font-display"
        >
          {$t("app.title")}
        </h1>
        <p class="text-xl text-slate-300">
          {$t("app.tagline")}
        </p>
      </div>

      <div
        class="glass-panel p-8 max-w-sm w-full mx-auto transform hover:scale-105 transition-all text-center"
      >
        <div class="space-y-4 mb-6">
          <div class="w-16 h-1 w-full bg-slate-700 mx-auto rounded-full"></div>
          <div class="w-16 h-1 w-2/3 bg-slate-700 mx-auto rounded-full"></div>
          <div class="w-16 h-1 w-1/2 bg-slate-700 mx-auto rounded-full"></div>
        </div>
        <p class="text-sm text-slate-400">
          {$t("app.connect")}
        </p>
      </div>

      <div class="flex flex-col items-center gap-4">
        <Button variant="primary" onclick={handleSignIn}>
          {$t("auth.signin")}
        </Button>

        <button
          class="text-xs text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
          on:click={toggleLocale}
        >
          {$locale === "en" ? "日本語に切替" : "Switch to English"}
        </button>
      </div>
    </div>
  {:else}
    <!-- Authenticated App -->
    <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <h1
          class="text-xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400"
        >
          {$t("app.title")}
        </h1>
        <div class="flex items-center gap-4">
          <button
            class="text-[10px] px-2 py-1 rounded bg-white/5 text-slate-400 hover:text-white border border-white/5 transition-colors"
            on:click={toggleLocale}
          >
            {$locale === "en" ? "JP" : "EN"}
          </button>
          <a href="/user/{$session.did}">
            {#if profiles[$session.did || ""]}
              <Avatar src={profiles[$session.did!].avatar} size="sm" />
            {:else}
              <div class="w-8 h-8 rounded-full bg-slate-700"></div>
            {/if}
          </a>
        </div>
      </header>

      <!-- FAB (Floating Action Button) -->
      <a href="/new" class="fixed bottom-6 right-6 z-50">
        <button
          class="w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Edit3 size={24} />
        </button>
      </a>

      <!-- Tabs -->
      <div class="flex p-1 bg-black/20 rounded-xl backdrop-blur-sm">
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'following'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={loadFollowing}
        >
          <Users size={16} />
          {$t("feed.following")}
        </button>
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'global'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={loadGlobal}
        >
          <Compass size={16} />
          {$t("feed.global")}
        </button>
      </div>

      <!-- Feed -->
      <div class="space-y-6 min-h-[50vh]">
        {#if loading}
          <div class="glass-panel p-6 animate-pulse space-y-4">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-full bg-white/5"></div>
              <div class="flex-1 py-1 space-y-2">
                <div class="h-4 bg-white/5 rounded w-1/3"></div>
                <div class="h-3 bg-white/5 rounded w-1/4"></div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="h-4 bg-white/5 rounded"></div>
              <div class="h-4 bg-white/5 rounded"></div>
              <div class="h-4 bg-white/5 rounded w-2/3"></div>
            </div>
          </div>
        {:else if entries.length === 0}
          <div class="text-center py-12 text-slate-500">
            <p>{$t("feed.no_entries")}</p>
            <p class="text-sm mt-2">
              {$t("feed.no_entries_hint")}
            </p>
          </div>
        {:else}
          {#each entries as entry (entry.uri)}
            <DiaryCard {entry} author={profiles[entry.authorDid]} />
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
