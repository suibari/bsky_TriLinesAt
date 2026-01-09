<script lang="ts">
  import { t } from "$lib/i18n";
  import { fade, scale } from "svelte/transition";
  import { Loader2 } from "lucide-svelte";

  export let entries: any[] = [];
  export let loading = false;

  // State
  let currentDate = new Date();
  let hoveredDay: {
    day: number;
    entry: any;
    x: number;
    y: number;
    align: "left" | "center" | "right";
  } | null = null;
  let tooltipElement: HTMLElement;

  // Reactive derived values
  $: year = currentDate.getFullYear();
  $: month = currentDate.getMonth(); // 0-indexed
  $: daysInMonth = new Date(year, month + 1, 0).getDate();
  $: firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  // Create calendar grid
  // We need empty slots for days before the 1st of the month
  $: paddingDays = Array(firstDayOfWeek).fill(null);
  $: days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  $: allCells = [...paddingDays, ...days];

  // Map entries to days
  // Ensure we match local date, but entries are UTC ISO strings.
  // We should probably show entries based on user's local time or the entry's date.
  // For simplicity and consistency with DiaryCard, we use the local date representation.
  $: entriesByDay = entries.reduce(
    (acc, entry) => {
      const d = new Date(entry.createdAt);
      // Check if entry belongs to currently displayed month/year
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        // If multiple entries per day, maybe just take the last one or show count?
        // Requirement says "show the diary", implying one. If multiple, we show latest.
        if (
          !acc[day] ||
          new Date(entry.createdAt) > new Date(acc[day].createdAt)
        ) {
          acc[day] = entry;
        }
      }
      return acc;
    },
    {} as Record<number, any>,
  );

  function handleMouseEnter(event: MouseEvent, day: number) {
    const entry = entriesByDay[day];
    if (entry) {
      const target = event.target as HTMLElement;
      const rect = target.getBoundingClientRect();

      // Calculate alignment
      const col = (firstDayOfWeek + day - 1) % 7;
      let align: "left" | "center" | "right" = "center";
      if (col <= 1) align = "left";
      else if (col >= 5) align = "right";

      // Center tooltip above the cell
      hoveredDay = {
        day,
        entry,
        x: rect.left + rect.width / 2,
        y: rect.top,
        align,
      };
    }
  }

  function handleMouseLeave() {
    hoveredDay = null;
  }

  // Navigation
  function prevMonth() {
    currentDate = new Date(year, month - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
</script>

<div
  class="glass-panel p-6 w-full max-w-sm mx-auto select-none relative rounded-2xl overflow-hidden"
>
  {#if loading}
    <div
      class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10 transition-all duration-300"
      transition:fade
    >
      <Loader2 class="animate-spin text-fuchsia-500" size={32} />
    </div>
  {/if}

  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <button
      class="p-1 hover:text-fuchsia-300 transition-colors"
      on:click={prevMonth}
    >
      &larr;
    </button>
    <div class="font-bold text-center">
      {monthNames[month]}
      {year}
    </div>
    <button
      class="p-1 hover:text-fuchsia-300 transition-colors"
      on:click={nextMonth}
    >
      &rarr;
    </button>
  </div>

  <!-- Grid -->
  <div class="grid grid-cols-7 gap-2">
    <!-- Weekday Headers -->
    {#each ["S", "M", "T", "W", "T", "F", "S"] as dayHeader}
      <div class="text-center text-xs text-slate-500 font-mono mb-1">
        {dayHeader}
      </div>
    {/each}

    <!-- Days -->
    {#each allCells as day}
      {#if day === null}
        <div class="aspect-square"></div>
      {:else}
        {@const hasEntry = !!entriesByDay[day]}
        <!-- svelte-ignore a11y-mouse-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="aspect-square rounded-md transition-all duration-300 flex items-center justify-center text-xs relative
            {hasEntry
            ? 'bg-fuchsia-500 text-white shadow-[0_0_10px_rgba(232,121,249,0.3)] cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_rgba(232,121,249,0.5)]'
            : 'bg-white/5 text-slate-500'}
          "
          on:mouseenter={(e) => handleMouseEnter(e, day)}
          on:mouseleave={handleMouseLeave}
        >
          {day}
        </div>
      {/if}
    {/each}
  </div>
</div>

<!-- Tooltip Portal -->
{#if hoveredDay}
  <div
    class="fixed z-[9999] pointer-events-none"
    style="left: {hoveredDay.x}px; top: {hoveredDay.y}px;"
  >
    <div
      class="glass-panel absolute bottom-2 w-64 p-3 rounded-lg border border-white/20 shadow-xl
        {hoveredDay.align === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
        {hoveredDay.align === 'left' ? 'left-[-20px]' : ''}
        {hoveredDay.align === 'right' ? 'right-[-20px]' : ''}
      "
      in:fade={{ duration: 150 }}
      out:fade={{ duration: 150 }}
    >
      <div class="text-xs text-slate-400 mb-1 border-b border-white/10 pb-1">
        {new Date(hoveredDay.entry.createdAt).toLocaleDateString()}
      </div>
      <div class="text-sm overflow-hidden text-ellipsis">
        {#each hoveredDay.entry.lines as line}
          <div class="whitespace-pre-wrap break-words">{line.text}</div>
        {/each}
      </div>
      <!-- Triangle pointer -->
      <div
        class="absolute -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-white/20 rotate-45
          {hoveredDay.align === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
          {hoveredDay.align === 'left' ? 'left-[20px] -translate-x-1/2' : ''}
          {hoveredDay.align === 'right' ? 'right-[20px] translate-x-1/2' : ''}
        "
      ></div>
    </div>
  </div>
{/if}
