<script lang="ts">
  import { isAboutOpen } from "$lib/stores/ui";
  import { X } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import { fade, scale } from "svelte/transition";

  function close() {
    isAboutOpen.set(false);
  }
</script>

{#if $isAboutOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    transition:fade
    on:click|self={close}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="glass-panel w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
      transition:scale={{ start: 0.95 }}
    >
      <button
        class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        on:click={close}
      >
        <X size={24} />
      </button>

      <h2
        class="text-2xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400"
      >
        {$t("about.title")}
      </h2>

      <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
        <section>
          <h3 class="font-bold text-white mb-2 text-base">
            {$t("about.developer.title")}
          </h3>
          <ul class="list-disc list-outside ml-4 space-y-2">
            <li>{@html $t("about.developer.body")}</li>
            <li>{$t("about.tech.body")}</li>
            <li>{$t("about.support.body")}</li>
          </ul>
        </section>

        <section>
          <h3 class="font-bold text-white mb-2 text-base">
            {$t("about.oauth.title")}
          </h3>
          <ul class="list-disc list-outside ml-4 space-y-2">
            <li>{@html $t("about.oauth.body")}</li>
          </ul>
        </section>

        <section>
          <h3 class="font-bold text-white mb-2 text-base">
            {$t("about.privacy.title")}
          </h3>
          <ul class="list-disc list-outside ml-4 space-y-2">
            <li>{$t("about.privacy.body")}</li>
          </ul>
        </section>

        <section>
          <h3 class="font-bold text-white mb-2 text-base">
            {$t("about.disclaimer.title")}
          </h3>
          <ul class="list-disc list-outside ml-4 space-y-2">
            <li>{$t("about.disclaimer.body")}</li>
          </ul>
        </section>
      </div>

      <div class="mt-8 pt-4 border-t border-white/5 text-center">
        <button
          class="glass-btn px-6 py-2 rounded-full text-sm"
          on:click={close}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
