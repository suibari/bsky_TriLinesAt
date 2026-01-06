<script lang="ts">
  import { t } from "$lib/i18n";
  import { settings } from "$lib/stores/settings";
  import { ChevronLeft } from "lucide-svelte";
  import { onMount } from "svelte";
  import { session } from "$lib/auth/session";
  import { goto } from "$app/navigation";

  // Redirect if not authed
  $: if (!$session.loading && !$session.isAuthenticated) {
    goto("/");
  }

  onMount(() => {
    settings.init();
  });
</script>

<div class="min-h-screen pb-20">
  <!-- Header -->
  <div
    class="glass-panel sticky top-0 z-40 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl"
  >
    <div class="max-w-xl mx-auto px-4 h-14 flex items-center gap-4">
      <a
        href="/user/{$session.did}"
        class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={24} />
      </a>
      <h1 class="font-bold text-lg">{$t("settings.title")}</h1>
    </div>
  </div>

  <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
    <div class="glass-panel rounded-xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-lg text-fuchsia-300">
            {$t("settings.timecapsule")}
          </h3>
          <p class="text-sm text-slate-400 mt-1">
            {$t("settings.timecapsule_desc")}
          </p>
        </div>

        <button
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          class:bg-fuchsia-600={$settings.timeCapsuleEnabled}
          class:bg-slate-700={!$settings.timeCapsuleEnabled}
          on:click={() => settings.toggleTimeCapsule()}
          role="switch"
          aria-checked={$settings.timeCapsuleEnabled}
          aria-label={$t("settings.timecapsule")}
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            class:translate-x-6={$settings.timeCapsuleEnabled}
            class:translate-x-1={!$settings.timeCapsuleEnabled}
          ></span>
        </button>
      </div>
    </div>
  </div>
</div>
