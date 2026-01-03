<script lang="ts">
  import { onMount } from "svelte";
  import { session, initSession, signIn, signOut } from "$lib/auth/session";
  import { getFollows, getGlobalFeed, getProfiles } from "$lib/bsky";
  import Button from "$lib/components/Button.svelte";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import { Edit3, Compass, Users, LogOut, Trophy } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import Avatar from "$lib/components/Avatar.svelte";
  import type { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { Agent } from "@atproto/api";
  import { t, locale } from "$lib/i18n";
  import { calculateRankings, type Rankings } from "$lib/ranking";
  import { isAboutOpen } from "$lib/stores/ui";

  // State
  // State
  let activeTab: "following" | "global" | "ranking" = "following";
  let entries: any[] = [];
  let loading = true;
  let loadingMore = false;
  let cursor: string | undefined = undefined;
  let profiles: Record<string, any> = {};
  let follows: string[] = []; // Changed to string[] for easier filtering

  let rankingData: Rankings = { total: [], streak: [] };
  let rankingMode: "total" | "streak" = "total";

  function handleEntryUpdate(e: CustomEvent) {
    const { uri, isLiked, likeCount, viewerLike } = e.detail;

    // Update in allPosts
    const targetIndex = allPosts.findIndex((p) => p.uri === uri);
    if (targetIndex !== -1) {
      allPosts[targetIndex] = {
        ...allPosts[targetIndex],
        likeCount: likeCount,
        viewer: {
          ...allPosts[targetIndex].viewer,
          like: viewerLike,
        },
      };
      // Also update current view 'entries' to reflect immediately if needed
      // (Though Svelte might not react deeply if we don't reassign entries)
      // Since entries is derived from allPosts via updateFilteredEntries,
      // let's re-run filtering or manually update the entry in `entries` too.
      // Updating `entries` directly is faster for the UI.
      const entryIndex = entries.findIndex((p) => p.uri === uri);
      if (entryIndex !== -1) {
        entries[entryIndex] = allPosts[targetIndex];
      }
    }
  }

  // Element references for infinite scroll
  let sentinel: HTMLElement;

  onMount(() => {
    initSession().then(() => {
      if ($session.isAuthenticated) {
        loadSelfProfile();
        initialLoad();
      }
    });

    // Setup intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && !loadingMore && !loading) {
          if (activeTab === "following" || activeTab === "global") {
            fetchMorePosts().then(() => updateFilteredEntries());
          }
        }
      },
      { rootMargin: "200px" },
    );

    // We need to observe when sentinel is available.
    // Svelte mount might be too early if DOM isn't ready or inside if block.
    // We'll attach it via action or simple check later.
    // For now, let's just re-observe when activeTab changes or entries update
    const interval = setInterval(() => {
      if (sentinel) {
        observer.observe(sentinel);
        clearInterval(interval);
      }
    }, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
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

  // --- Core Logic ---

  let allPosts: any[] = []; // Cache of all fetched global posts

  async function fetchMorePosts() {
    if (loadingMore) return;
    loadingMore = true;
    try {
      const result = await getGlobalFeed(cursor, 50);
      cursor = result.cursor;

      // Append to master list
      allPosts = [...allPosts, ...result.posts];

      const newDids = [...new Set(result.posts.map((p: any) => p.authorDid))];
      const profilesToFetch = newDids.filter((did) => !profiles[did as string]);

      if (profilesToFetch.length > 0) {
        const newProfiles = await getProfiles(profilesToFetch as string[]);
        profiles = { ...profiles, ...newProfiles };
      }
    } catch (e) {
      console.error("Failed to fetch more posts", e);
    } finally {
      loadingMore = false;
    }
  }

  function updateFilteredEntries() {
    if (activeTab === "following") {
      entries = allPosts.filter(
        (p) => follows.includes(p.authorDid) || p.authorDid === $session.did,
      );
    } else if (activeTab === "global") {
      entries = allPosts;
    }
  }

  // --- Tab Switchers (Optimized) ---

  // These no longer fetch data, just switch view
  function switchToFollowing() {
    activeTab = "following";
    updateFilteredEntries();
  }

  function switchToGlobal() {
    activeTab = "global";
    updateFilteredEntries();
  }

  // Initial Load (Consolidated)
  async function initialLoad() {
    loading = true;
    try {
      if (!$session.agent) return;

      // Get Follows
      const f = await getFollows($session.did!);
      follows = f.map((p) => p.did);

      await fetchMorePosts();
      updateFilteredEntries();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function loadRanking() {
    if (!$session.agent) return;
    loading = true;
    entries = []; // Clear entries when in ranking mode

    try {
      activeTab = "ranking";
      // Need import specifically if separate function, assuming imported or available
      // Using the one defined in bsky.ts
      const { getAllEntriesForRanking } = await import("$lib/bsky");
      const posts = await getAllEntriesForRanking();

      // Calculate
      rankingData = calculateRankings(posts);

      // Fetch profiles for top 20 of each
      const topDids = new Set([
        ...rankingData.total.slice(0, 20).map((r) => r.did),
        ...rankingData.streak.slice(0, 20).map((r) => r.did),
      ]);

      const authorDids = Array.from(topDids);
      if (authorDids.length > 0) {
        // Check missing
        const missingDids = authorDids.filter((did) => !profiles[did]);
        if (missingDids.length > 0) {
          try {
            // Batch in chunks of 25 if needed, but 40 is fine
            const { data } = await $session.agent.app.bsky.actor.getProfiles({
              actors: missingDids,
            });
            const newProfiles = { ...profiles };
            data.profiles.forEach((p) => (newProfiles[p.did] = p));
            profiles = newProfiles;
          } catch (e) {
            console.warn("Failed to fetch ranking profiles", e);
          }
        }
      }
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

  // Swipe Logic
  let touchStartX = 0;
  let touchStartY = 0;
  let translateX = 0;
  let isSwiping = false;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping) return;

    const touchCurrentX = e.changedTouches[0].screenX;
    const touchCurrentY = e.changedTouches[0].screenY;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;

    // Determine if scrolling vertically
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    translateX = deltaX;
  }

  function getDateHeader(isoString: string) {
    const d = new Date(isoString);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  async function animateTabSwitch(
    direction: "left" | "right",
    loadCallback: () => void,
  ) {
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 375;
    const exitTo = direction === "right" ? screenWidth : -screenWidth;
    const enterFrom = direction === "right" ? -screenWidth : screenWidth;

    // 1. Animate Out
    isSwiping = false; // Enable transition
    translateX = exitTo;

    // Wait for transition
    await new Promise((r) => setTimeout(r, 300));

    // 2. Switch Data/State (Loading becomes true)
    loadCallback();

    // 3. Reset to Enter Position (Instant)
    isSwiping = true; // Disable transition for instant jump
    translateX = enterFrom;

    // 4. Animate In
    // Force reflow/next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isSwiping = false; // Enable transition
        translateX = 0;
      });
    });
  }

  function handleTouchEnd(e: TouchEvent) {
    isSwiping = false;

    // Prevent swipe during loading or on landing page (if not authenticated)
    if (
      loading ||
      (activeTab === "ranking" && loading) ||
      !$session.isAuthenticated
    ) {
      translateX = 0;
      return;
    }

    const SWIPE_THRESHOLD = 80;

    if (Math.abs(translateX) > SWIPE_THRESHOLD) {
      if (translateX > 0) {
        // Swipe Right (Previous Tab)
        if (activeTab === "global") {
          animateTabSwitch("right", () => switchToFollowing());
          return;
        } else if (activeTab === "ranking") {
          animateTabSwitch("right", () => switchToGlobal());
          return;
        }
      } else {
        // Swipe Left (Next Tab)
        if (activeTab === "following") {
          animateTabSwitch("left", () => switchToGlobal());
          return;
        } else if (activeTab === "global") {
          animateTabSwitch("left", () => loadRanking());
          return;
        }
      }
    }

    translateX = 0;
  }

  function toggleLocale() {
    locale.update((l) => (l === "en" ? "ja" : "en"));
  }
</script>

<div
  class="min-h-screen text-slate-100 pb-20 overflow-x-hidden touch-pan-y"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  {#if $session.loading}
    <!-- Optional: Loading Spinner or just blank -->
    <div class="flex items-center justify-center min-h-screen">
      <!-- <div class="w-8 h-8 rounded-full border-t-2 border-fuchsia-500 animate-spin"></div> -->
    </div>
  {:else if !$session.isAuthenticated}
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
          class="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-600 hover:decoration-white underline-offset-4"
          on:click={() => isAboutOpen.set(true)}
        >
          {$t("about.button")}
        </button>

        <div
          class="flex items-center gap-3 text-xs font-medium tracking-widest"
        >
          <button
            class="transition-colors {$locale === 'ja'
              ? 'text-fuchsia-400'
              : 'text-slate-600 hover:text-slate-400'}"
            on:click={() => locale.set("ja")}
          >
            日本語
          </button>
          <span class="text-slate-700">/</span>
          <button
            class="transition-colors {$locale === 'en'
              ? 'text-fuchsia-400'
              : 'text-slate-600 hover:text-slate-400'}"
            on:click={() => locale.set("en")}
          >
            English
          </button>
        </div>
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
          <div
            class="flex items-center bg-white/5 rounded-lg border border-white/5 p-0.5"
          >
            <button
              class="text-[10px] px-2 py-1 rounded-md transition-all {$locale ===
              'ja'
                ? 'bg-fuchsia-500/20 text-fuchsia-300 shadow-sm border border-fuchsia-500/30'
                : 'text-slate-500 hover:text-slate-300'}"
              on:click={() => locale.set("ja")}
            >
              JP
            </button>
            <div class="w-px h-3 bg-white/5 mx-0.5"></div>
            <button
              class="text-[10px] px-2 py-1 rounded-md transition-all {$locale ===
              'en'
                ? 'bg-fuchsia-500/20 text-fuchsia-300 shadow-sm border border-fuchsia-500/30'
                : 'text-slate-500 hover:text-slate-300'}"
              on:click={() => locale.set("en")}
            >
              EN
            </button>
          </div>
          <button
            class="text-slate-400 hover:text-white transition-colors"
            on:click={signOut}
            title={$t("auth.signout")}
          >
            <LogOut size={20} />
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
      <div
        class="flex p-1 bg-black/20 rounded-xl backdrop-blur-sm overflow-x-auto"
      >
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'following'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={() => switchToFollowing()}
        >
          <Users size={16} />
          <span class="whitespace-nowrap">{$t("feed.following")}</span>
        </button>
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'global'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={() => switchToGlobal()}
        >
          <Compass size={16} />
          <span class="whitespace-nowrap">{$t("feed.global")}</span>
        </button>
        <button
          class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 {activeTab ===
          'ranking'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'}"
          on:click={loadRanking}
        >
          <Trophy size={16} />
          <span class="whitespace-nowrap">{$t("feed.ranking")}</span>
        </button>
      </div>

      <!-- Feed -->
      <div
        class="space-y-6 min-h-[50vh] {isSwiping
          ? ''
          : 'transition-transform duration-300 ease-out'}"
        style="transform: translateX({translateX}px)"
      >
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
        {:else if activeTab === "ranking"}
          <!-- Ranking View -->
          <div class="space-y-6">
            <div class="flex justify-center gap-4">
              <button
                class="px-4 py-1 rounded-full text-sm font-bold transition-colors {rankingMode ===
                'total'
                  ? 'bg-fuchsia-500 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
                on:click={() => (rankingMode = "total")}
              >
                {$t("ranking.total")}
              </button>
              <button
                class="px-4 py-1 rounded-full text-sm font-bold transition-colors {rankingMode ===
                'streak'
                  ? 'bg-fuchsia-500 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
                on:click={() => (rankingMode = "streak")}
              >
                {$t("ranking.streak")}
              </button>
            </div>

            {#each (rankingMode === "total" ? rankingData.total : rankingData.streak).slice(0, 50) as item}
              <div class="glass-panel p-4 flex items-center gap-4">
                <div
                  class="w-8 text-center font-black text-xl italic {item.rank <=
                  3
                    ? 'text-yellow-400'
                    : 'text-slate-600'}"
                >
                  #{item.rank}
                </div>

                <a
                  href="/user/{item.did}"
                  class="flex items-center gap-3 flex-1 min-w-0"
                >
                  {#if profiles[item.did]}
                    <Avatar src={profiles[item.did].avatar} size="md" />
                    <div class="min-w-0">
                      <div class="font-bold truncate">
                        {profiles[item.did].displayName ||
                          profiles[item.did].handle}
                      </div>
                      <div class="text-xs text-slate-400 truncate">
                        @{profiles[item.did].handle}
                      </div>
                    </div>
                  {:else}
                    <div class="w-10 h-10 rounded-full bg-slate-700"></div>
                    <div class="min-w-0">
                      <div class="font-bold truncate text-slate-500">
                        Loading...
                      </div>
                    </div>
                  {/if}
                </a>

                <div class="text-right">
                  <div class="text-2xl font-black text-white">{item.count}</div>
                  <div
                    class="text-[10px] text-slate-400 uppercase tracking-widest"
                  >
                    {rankingMode === "total"
                      ? $t("ranking.days")
                      : $t("ranking.days")}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else if entries.length === 0}
          <div class="text-center py-12 text-slate-500">
            <p>{$t("feed.no_entries")}</p>
            <p class="text-sm mt-2">
              {$t("feed.no_entries_hint")}
            </p>
          </div>
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
              author={profiles[entry.authorDid]}
              on:update={handleEntryUpdate}
              on:delete={(e) => {
                entries = entries.filter((item) => item.uri !== e.detail.uri);
                allPosts = allPosts.filter((item) => item.uri !== e.detail.uri);
              }}
            />
          {/each}

          <!-- Infinite Scroll Sentinel -->
          {#if (activeTab === "following" || activeTab === "global") && !loading}
            <div bind:this={sentinel} class="h-4 w-full"></div>
            {#if loadingMore}
              <div class="flex justify-center py-4">
                <div
                  class="w-6 h-6 rounded-full border-t-2 border-fuchsia-500 animate-spin"
                ></div>
              </div>
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
