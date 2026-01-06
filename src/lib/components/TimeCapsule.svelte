<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";

  export let entries: any[] | undefined = undefined;

  interface FloatingLine {
    id: number;
    text: string;
    top: number;
    left: number;
    moveDuration: number;
    scale: number;
  }

  let visibleLines: FloatingLine[] = [];
  let nextId = 0;
  let intervalId: any;
  let textPool: string[] = [];

  $: if (entries !== undefined) {
    const extracted = entries
      .flatMap((e) => e.lines)
      .map((l: any) => l.text)
      .filter((t: string) => t && t.trim().length > 0 && t.length < 100);

    if (extracted.length > 0) {
      textPool = extracted;
    } else {
      textPool = [
        "Your past thoughts will appear here...",
        "A starry sky of memories",
        "Keep writing to fill the sky",
        "Every day is a new star",
        "Three lines a day...",
      ];
    }
  }

  function spawnLine() {
    if (textPool.length === 0) return;

    const text = textPool[Math.floor(Math.random() * textPool.length)];
    const id = nextId++;

    // Position logic to avoid center
    let top, left;
    const zone = Math.floor(Math.random() * 4);
    if (zone === 0) {
      top = 5 + Math.random() * 15;
      left = 5 + Math.random() * 90;
    } // Top
    else if (zone === 1) {
      top = 80 + Math.random() * 15;
      left = 5 + Math.random() * 90;
    } // Bottom
    else if (zone === 2) {
      top = 5 + Math.random() * 90;
      left = 2 + Math.random() * 13;
    } // Left
    else {
      top = 5 + Math.random() * 90;
      left = 85 + Math.random() * 13;
    } // Right

    const newLine: FloatingLine = {
      id,
      text,
      top,
      left,
      moveDuration: 20 + Math.random() * 10,
      scale: 0.8 + Math.random() * 0.4,
    };

    visibleLines = [...visibleLines, newLine];

    // Lifecycle:
    // Fade IN (4s) -> Stay -> Fade OUT (4s)
    // We remove it after enough time passed.
    const activeTime = 5000 + Math.random() * 4000;

    setTimeout(() => {
      visibleLines = visibleLines.filter((l) => l.id !== id);
    }, activeTime);
  }

  onMount(() => {
    // Initial spawn
    spawnLine();
    setTimeout(() => spawnLine(), 1500);

    intervalId = setInterval(() => {
      if (document.hidden) return;
      spawnLine();
    }, 3500);
  });

  onDestroy(() => {
    clearInterval(intervalId);
  });
</script>

<div
  class="absolute inset-0 pointer-events-none z-[0] overflow-hidden min-h-screen"
  aria-hidden="true"
>
  {#each visibleLines as line (line.id)}
    <div
      in:fade={{ duration: 4000 }}
      out:fade={{ duration: 4000 }}
      class="absolute text-slate-400 font-handwriting whitespace-nowrap select-none"
      style="
        top: {line.top}%; 
        left: {line.left}%; 
        opacity: 0.6;
        font-size: {line.scale}rem;
        will-change: transform, opacity;
        animation: slowFloat {line.moveDuration}s linear forwards;
      "
    >
      {line.text}
    </div>
  {/each}
</div>

<style>
  @keyframes slowFloat {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(-30px);
    }
  }
</style>
