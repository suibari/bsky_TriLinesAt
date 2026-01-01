<script lang="ts">
  import { page } from "$app/stores";
  import { session, initSession } from "$lib/auth/session";
  import { IDS } from "$lib/types";
  import DiaryCard from "$lib/components/DiaryCard.svelte";
  import { ChevronLeft, Loader2 } from "lucide-svelte";
  import { onMount } from "svelte";
  import type { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs";

  $: did = $page.params.did;
  $: rkey = $page.params.rkey;

  let entry: any = null;
  let author: any | null = null;
  let loading = true;

  import { get } from "svelte/store";
  import { getPds } from "$lib/bsky";
  import { Agent } from "@atproto/api";

  onMount(() => {
    if (!$session.agent) {
      initSession();
    }
  });

  $: if ($session.agent && did && rkey) {
    loadEntry();
  }

  async function loadEntry() {
    loading = true;
    try {
      const agent = $session.agent!;

      // 1. Get Profile
      try {
        const { data: profile } = await agent.app.bsky.actor.getProfile({
          actor: did!,
        });
        author = profile;
      } catch (e) {
        console.warn(
          "Authenticated getProfile failed, trying public fallback",
          e,
        );
        const publicAgent = new Agent("https://api.bsky.app");
        const { data: profile } = await publicAgent.app.bsky.actor.getProfile({
          actor: did!,
        });
        author = profile;
      }

      // 2. Get PDS and create agent
      let pdsAgent = agent;
      try {
        const endpoint = await getPds(did!);
        if (endpoint) {
          pdsAgent = new Agent(endpoint);
        }
      } catch (e) {
        console.warn("Failed to resolve PDS", e);
      }

      const { data: record } = await pdsAgent.api.com.atproto.repo.getRecord({
        repo: did!,
        collection: IDS.TriLinesEntry,
        rkey: rkey!,
      });

      entry = {
        ...record.value,
        uri: record.uri,
        cid: record.cid,
      };
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen pb-20 pt-6">
  <div class="max-w-xl mx-auto px-4">
    <header class="mb-6">
      <a
        href="/"
        class="inline-flex items-center text-slate-400 hover:text-white transition-colors gap-2"
      >
        <ChevronLeft size={20} /> Back to Timeline
      </a>
    </header>

    {#if loading}
      <div class="flex justify-center py-20">
        <Loader2 class="animate-spin text-fuchsia-500" size={32} />
      </div>
    {:else if entry && author}
      <DiaryCard {entry} {author} />
    {:else}
      <div class="glass-panel p-8 text-center text-red-400">
        Entry not found.
      </div>
    {/if}
  </div>
</div>
