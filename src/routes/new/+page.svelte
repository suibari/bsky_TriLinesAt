<script lang="ts">
  import { createDiary } from "$lib/bsky";
  import { session } from "$lib/auth/session";
  import Button from "$lib/components/Button.svelte";
  import TimeCapsule from "$lib/components/TimeCapsule.svelte";
  import {
    Image as ImageIcon,
    X,
    ChevronLeft,
    Send,
    Loader2,
  } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { t, locale } from "$lib/i18n"; // Import locale
  import { settings } from "$lib/stores/settings";
  import { getRandomPlaceholders } from "$lib/constants/placeholders";

  import { onMount } from "svelte";

  import { getEntries } from "$lib/bsky";
  import { calculateRankings } from "$lib/ranking";

  // Redirect if not authed
  $: if (!$session.loading && !$session.isAuthenticated) {
    goto("/");
  }

  let lines = [
    { text: "", image: undefined as Blob | undefined, preview: "" },
    { text: "", image: undefined as Blob | undefined, preview: "" },
    { text: "", image: undefined as Blob | undefined, preview: "" },
  ];

  let placeholders: string[] = ["", "", ""];

  // Reactively update placeholders when locale changes or on mount
  $: placeholders = getRandomPlaceholders(3, $locale);

  let shareToBluesky = false; // Default OFF (safer side)
  let rememberSettings = false;
  let submitting = false;
  let isLoaded = false;

  // Stats for calculation
  let currentStreak = 0;
  let totalCount = 0;
  let lastPostDate: string | undefined;
  let myEntries: any[] | undefined = undefined;

  onMount(async () => {
    settings.init();
    // Load settings from localStorage
    if (typeof localStorage !== "undefined") {
      const storedRemember =
        localStorage.getItem("settings.rememberShare") === "true";
      rememberSettings = storedRemember;

      if (storedRemember) {
        shareToBluesky =
          localStorage.getItem("settings.shareToBluesky") === "true";
      }

      // Load draft
      try {
        const savedDraft = localStorage.getItem("diary_draft");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (Array.isArray(parsed) && parsed.length === 3) {
            lines = parsed.map((l: any, i) => ({
              ...lines[i], // keep defaults/structure
              text: l.text || "",
              // Images are not persisted in localStorage due to size/complexity
            }));
          }
        }
      } catch (e) {
        console.warn("Failed to load draft", e);
      }
    }
    isLoaded = true;

    // Fetch current stats if authed
    if ($session.isAuthenticated && $session.did) {
      try {
        const entriesData = await getEntries($session.did);
        myEntries = entriesData;
        const { total, streak } = calculateRankings(entriesData);
        const myTotal = total.find((r) => r.did === $session.did);
        const myStreak = streak.find((r) => r.did === $session.did);

        totalCount = myTotal?.count || 0;
        currentStreak = myStreak?.count || 0;
        lastPostDate = myStreak?.lastPostDate; // Using streak's last post date ensures continuity logic matches
      } catch (e) {
        console.warn("Failed to fetch pre-post stats", e);
      }
    }
  });

  // Save settings and DRAFT when changed
  $: if (isLoaded && typeof localStorage !== "undefined") {
    localStorage.setItem("settings.rememberShare", String(rememberSettings));
    if (rememberSettings) {
      localStorage.setItem("settings.shareToBluesky", String(shareToBluesky));
    } else {
      localStorage.removeItem("settings.shareToBluesky");
    }

    // Save Draft (Debouncing logic is natural via Svelte reactive block, but strictly it saves on every keystroke.
    // For text this is fine. browser handles it well.)
    const draftData = lines.map((l) => ({ text: l.text }));
    localStorage.setItem("diary_draft", JSON.stringify(draftData));
  }

  const MAX_CHARS = 50;

  function handleImageSelect(index: number, e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      lines[index].image = file;
      lines[index].preview = URL.createObjectURL(file);
      lines = lines; // trigger update
    }
  }

  function removeImage(index: number) {
    lines[index].image = undefined;
    lines[index].preview = "";
    lines = lines;
  }

  $: canSubmit = lines.every((l) => l.text.trim().length > 0) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (lines.some((l) => l.text.length > MAX_CHARS)) {
      alert("Each line must be 50 characters or less.");
      return;
    }
    if (lines.every((l) => !l.text.trim())) {
      alert("Please write at least something!");
      return;
    }

    submitting = true;

    try {
      await createDiary(
        lines.map((l) => ({ text: l.text, image: l.image })),
        shareToBluesky,
      );

      // Clear draft on success
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("diary_draft");
      }

      // Calculate post-success stats (Optimistic)
      let newStreak = currentStreak;
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // Logic:
      // If we already had a post today (lastPostDate === today), streak doesn't increase.
      // If last post was yesterday, streak increments.
      // If last post was older or null (0), streak becomes 1.

      // Parse lastPostDate to YYYY-MM-DD
      let lastDateYMD = "";
      if (lastPostDate) {
        const d = new Date(lastPostDate);
        lastDateYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYMD = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      // Wait calculateRankings typically handles timezone, but let's be approximate/robust.
      // If currentStreak > 0, it means it's active (today/yesterday).
      if (currentStreak > 0) {
        if (lastDateYMD === today) {
          // Already posted today, no change
          newStreak = currentStreak;
        } else {
          // Since it's active (>0), it must be yesterday (or earlier today?)
          // Simple increment
          newStreak = currentStreak + 1;
        }
      } else {
        // Streak was broken or 0
        newStreak = 1;
      }

      const isFirst = totalCount === 0;

      goto(
        `/user/${$session.did}?created=true&streak=${newStreak}&isFirst=${isFirst}`,
      );
    } catch (e) {
      console.error(e);
      let errorMessage = "Failed to post diary."; // Default

      if (typeof e === "object" && e !== null) {
        const err = e as any;
        if (
          err.status === 413 ||
          err.message?.includes("too large") ||
          err.error === "ImageTooLarge"
        ) {
          errorMessage =
            "Image upload failed: The image is too large (Limit is ~975KB).";
        } else if (
          err.status === 401 ||
          err.error === "AuthenticationRequired"
        ) {
          errorMessage = "Session expired. Please sign in again.";
        } else if (err.status === 429) {
          errorMessage =
            "Rate limit exceeded. Please wait a moment before trying again.";
        } else if (err.message) {
          errorMessage = `Error: ${err.message}`;
        }
      }
      alert(errorMessage);
      // Do NOT clear draft here so user can retry
    } finally {
      submitting = false;
    }
  }
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

  <div class="space-y-6 relative z-10">
    {#each lines as line, i}
      <div
        class="glass-panel p-4 rounded-xl relative group focus-within:ring-2 ring-violet-500/50 transition-all"
      >
        <label
          for="line-{i}"
          class="block text-xs font-mono font-bold text-fuchsia-400 mb-2 opacity-70"
          >{$t(`editor.line${i + 1}` as any)}</label
        >

        <textarea
          id="line-{i}"
          bind:value={line.text}
          maxlength={MAX_CHARS}
          placeholder={placeholders[i] || $t("editor.placeholder")}
          class="w-full bg-transparent border-none focus:ring-0 text-lg placeholder-slate-600 resize-none h-16 text-white caret-fuchsia-500 px-1"
        ></textarea>

        <!-- Image Preview -->
        {#if line.preview}
          <div
            class="relative mt-2 w-24 h-24 rounded-lg overflow-hidden border border-white/10 group-image"
          >
            <img
              src={line.preview}
              alt="Line attachment"
              class="w-full h-full object-cover"
            />
            <button
              class="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-500/80 transition-colors"
              on:click={() => removeImage(i)}
            >
              <X size={12} />
            </button>
          </div>
        {:else}
          <div
            class="absolute bottom-4 right-4 opacity-0 group-focus-within:opacity-100 transition-opacity"
          >
            <label
              class="cursor-pointer text-slate-400 hover:text-white p-2 bg-white/5 rounded-lg backdrop-blur-sm block"
            >
              <ImageIcon size={18} />
              <input
                type="file"
                accept="image/*"
                class="hidden"
                on:change={(e) => handleImageSelect(i, e)}
              />
            </label>
          </div>
        {/if}

        <div
          class="absolute top-4 right-4 text-xs {line.text.length >= MAX_CHARS
            ? 'text-red-400'
            : 'text-slate-600'} font-mono"
        >
          {line.text.length}/{MAX_CHARS}
        </div>
      </div>
    {/each}

    <!-- Options -->
    <div class="glass-panel rounded-xl p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-slate-300"
          >{$t("editor.share_bluesky")}</span
        >
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={shareToBluesky}
            class="sr-only peer"
          />
          <div
            class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"
          ></div>
        </label>
      </div>

      <div class="flex items-center justify-end gap-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={rememberSettings}
            class="form-checkbox h-4 w-4 text-fuchsia-500 rounded border-slate-500 bg-black/20 focus:ring-0 focus:ring-offset-0"
          />
          <span class="text-xs text-slate-400 select-none"
            >{$t("editor.remember_settings")}</span
          >
        </label>
      </div>
    </div>

    <div class="pt-4">
      <Button
        variant="primary"
        class="w-full py-4 text-lg shadow-xl shadow-fuchsia-900/20 flex items-center justify-center gap-2"
        onclick={handleSubmit}
        disabled={!canSubmit}
      >
        {#if submitting}
          <Loader2 class="animate-spin mr-2" /> {$t("editor.submitting")}
        {:else}
          <Send class="mr-2" size={18} /> {$t("editor.submit")}
        {/if}
      </Button>
    </div>
  </div>
</div>
