<script lang="ts">
  import { Github, Info } from "lucide-svelte";
  import { t } from "$lib/i18n";
  import { isAboutOpen } from "$lib/stores/ui";
</script>

<footer
  class="w-full py-8 mt-auto border-t border-white/5 bg-black/20 backdrop-blur-sm"
>
  <div
    class="max-w-xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4"
  >
    <!-- App Info -->
    <div class="flex items-center gap-2">
      <span
        class="font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400"
      >
        {$t("app.title")}
      </span>
      <span class="text-xs text-slate-500">© 2026 Suibari</span>
    </div>

    <!-- Social Links -->
    <div class="flex items-center gap-6">
      <button
        class="text-slate-400 hover:text-fuchsia-400 transition-colors flex items-center gap-2"
        on:click={() => isAboutOpen.set(true)}
        title={$t("about.button")}
      >
        <Info size={20} />
        <span class="sr-only">{$t("about.button")}</span>
      </button>

      <a
        href="https://bsky.app/profile/suibari.com"
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-400 hover:text-[#0085ff] transition-colors flex items-center gap-2 group"
        title="Bluesky"
      >
        <!-- Bluesky Logo (Bootstrap Icons) -->
        <svg
          viewBox="0 0 16 16"
          class="w-5 h-5 fill-current group-hover:drop-shadow-[0_0_8px_rgba(0,133,255,0.5)] transition-all"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3.468 1.948C5.303 3.325 7.276 6.118 8 7.616c.725-1.498 2.698-4.29 4.532-5.668C13.855.955 16 .186 16 2.632c0 .489-.28 4.105-.444 4.692-.572 2.04-2.653 2.561-4.504 2.246 3.236.551 4.06 2.375 2.281 4.2-3.376 3.464-4.852-.87-5.23-1.98-.07-.204-.103-.3-.103-.218 0-.081-.033.014-.102.218-.379 1.11-1.855 5.444-5.231 1.98-1.778-1.825-.955-3.65 2.28-4.2-1.85.315-3.932-.205-4.503-2.246C.28 6.737 0 3.12 0 2.632 0 .186 2.145.955 3.468 1.948"
          />
        </svg>
        <span class="sr-only">Bluesky</span>
      </a>

      <a
        href="https://github.com/suibari/bsky_TriLinesAt"
        target="_blank"
        rel="noopener noreferrer"
        class="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        title="GitHub"
      >
        <Github size={20} />
        <span class="sr-only">GitHub</span>
      </a>
    </div>
  </div>
</footer>
