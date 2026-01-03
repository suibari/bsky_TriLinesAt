<script lang="ts">
  import { page } from "$app/stores";
  import { getEntries } from "$lib/bsky";
  import { session, initSession } from "$lib/auth/session";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import { Agent } from "@atproto/api";
  import { ChevronLeft, Loader2, Edit3 } from "lucide-svelte";
  import type { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";
  import { t } from "$lib/i18n";

  $: did = $page.params.did;

  let entries: any[] = [];
  let useProfile: any | null = null;
  let loading = true;

  $: if (did && $session.agent) {
    loadUser();
  }

  // Handle reload on mount if directly navigating
  import { onMount } from "svelte";
  onMount(() => {
    if (!$session.agent) {
      initSession(); // will trigger reactive block above once authed
    }
  });

  async function loadUser() {
    loading = true;
    try {
      // 1. Get Profile
      try {
        const { data } = await $session.agent!.app.bsky.actor.getProfile({
          actor: did!,
        });
        useProfile = data;
      } catch (e) {
        console.warn(
          "Authenticated getProfile failed, trying public fallback",
          e,
        );
        const publicAgent = new Agent("https://api.bsky.app");
        const { data } = await publicAgent.app.bsky.actor.getProfile({
          actor: did!,
        });
        useProfile = data;
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
      <h1 class="font-bold text-lg">
        {useProfile
          ? useProfile.displayName || useProfile.handle
          : $t("user.loading")}
      </h1>
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

        {#if entries.length === 0}
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
