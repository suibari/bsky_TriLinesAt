<script lang="ts">
  import { session } from "$lib/auth/session";
  import TimeCapsule from "$lib/components/TimeCapsule.svelte";
  import DiaryComposer from "$lib/components/DiaryComposer.svelte";
  import { ChevronLeft } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { t } from "$lib/i18n";
  import { settings } from "$lib/stores/settings";

  import { onMount } from "svelte";

  // Redirect if not authed
  $: if (!$session.loading && !$session.isAuthenticated) {
    goto("/");
  }

  let myEntries: any[] | undefined = undefined;

  onMount(() => {
    settings.init();
  });
</script>

<div class="w-full max-w-xl mx-auto px-4 py-6 min-h-screen pb-20">
  {#if $settings.timeCapsuleEnabled}
    <TimeCapsule entries={myEntries} />
  {/if}
  <header class="flex items-center justify-between mb-8 relative z-10">
    <a
      href="/"
      class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
    >
      <ChevronLeft size={24} />
    </a>
    <h1 class="text-xl font-bold">{$t("editor.title")}</h1>
    <div class="w-8"></div>
  </header>

  <p class="relative z-10 mb-4 text-sm text-slate-400">{$t("editor.day_cutoff")}</p>
  <DiaryComposer bind:entries={myEntries} />
</div>
