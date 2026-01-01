<script lang="ts">
  import { onMount } from "svelte";
  import { session, initSession, signIn } from "$lib/auth/session";
  import { getTimeline, getFollows, getGlobalFeed } from "$lib/bsky";
  import Button from "$lib/components/Button.svelte";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import { Edit3, Compass, Users } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import Avatar from "$lib/components/Avatar.svelte";
  import type { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { Agent } from "@atproto/api";

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
      const followDids = follows.map((f) => f.did);

      // 2. Get entries
      // Include self
      followDids.push($session.did!);

      const rawEntries = await getTimeline([...followDids]); // Pass clone

      // 3. Get profiles for authors
      // Dedupe DIDs
      const authorDids = [...new Set(rawEntries.map((e) => e.authorDid))];
      if (authorDids.length > 0) {
        const { data } = await $session.agent.app.bsky.actor.getProfiles({
          actors: authorDids,
        });
        data.profiles.forEach((p) => (profiles[p.did] = p));
      }

      entries = rawEntries;
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
      const posts = await getGlobalFeed();
      // Global feed is app.bsky.feed.post with hashtag #TriLinesAt.
      // We need to fetch the ACTUAL diary records if the post links to them?
      // The plan says "Global Feed: Use search #TriLinesAt".
      // Search results are Posts. The Post *content* might be the diary text.
      // BUT our custom lexicon data might not be searchable by text content directly via app.bsky.feed.searchPosts if it's not a post.
      // The "Share to Bluesky" creates a Post. We search for THAT Post.
      // So we display the POSTs in the global feed?
      // Or do we try to resolve the custom record from the post?
      // For MVP, displaying the SEARCH RESULT (Post) is easiest, but creating a DiaryCard from it might be tricky if the Post text is just summary.
      // Ideally we want to show DiaryCards.
      // If the user includes a link to the entry, maybe we can parse it?
      // For this version, let's just display the list of Posts that match, using a modified card or just standard feed style?
      // Or: we search for posts, get the author DID, and fetch THEIR recent diary entries?

      // Strategy: Parse the search results. If the post has text, show it.
      // But we want the visual style of DiaryCard.
      // Let's iterate search results, extract author, fetch their latest custom record.
      // This is expensive (N requests).

      // Alternative: Just show the user's latest entry if they appear in search.
      // Let's simply map the search result authors to DIDs, then fetch their records.
      const authorDids = [...new Set(posts.map((p) => p.author.did))];

      // Reuse getTimeline style logic for these DIDs
      // We want SPECIFIC entries? Or just "users who posted about it recently"?
      // Let's fetch the entries from these authors.
      const rawEntries = await getTimeline([...authorDids]);

      // Fetch profiles
      if (authorDids.length > 0) {
        // we have partial profiles in search results (author), can use that
        posts.forEach((p) => (profiles[p.author.did] = p.author));
      }

      entries = rawEntries;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function handleSignIn() {
    const handle = prompt("Enter your Bluesky handle (e.g. user.bsky.social):");
    if (handle) {
      signIn(handle);
    }
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
          TriLinesAt
        </h1>
        <p class="text-xl text-slate-300">
          Make journaling a habit. Share your day in 3 lines.
        </p>
      </div>

      <div
        class="glass-panel p-8 max-w-sm w-full mx-auto transform hover:scale-105 transition-all"
      >
        <div class="space-y-4">
          <div class="w-16 h-1 w-full bg-slate-700 rounded-full"></div>
          <div class="w-16 h-1 w-2/3 bg-slate-700 rounded-full"></div>
          <div class="w-16 h-1 w-1/2 bg-slate-700 rounded-full"></div>
        </div>
        <p class="mt-6 text-sm text-slate-400">
          Connect with others who value concise expression.
        </p>
      </div>

      <Button variant="primary" onclick={handleSignIn}>
        Sign in with Bluesky
      </Button>
    </div>
  {:else}
    <!-- Authenticated App -->
    <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <h1
          class="text-xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400"
        >
          TriLinesAt
        </h1>
        <a href="/user/{$session.did}">
          {#if profiles[$session.did || ""]}
            <Avatar src={profiles[$session.did!].avatar} size="sm" />
          {:else}
            <div class="w-8 h-8 rounded-full bg-slate-700"></div>
          {/if}
        </a>
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
          <Users size={16} /> Following
        </button>
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'global'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={loadGlobal}
        >
          <Compass size={16} /> Global
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
            <p>No entries found.</p>
            <p class="text-sm mt-2">
              Try following more people or writing your first diary!
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
