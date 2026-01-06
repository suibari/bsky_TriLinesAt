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
    driftX: number;
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
      textPool = [];
    }
  }

  function spawnLine() {
    if (textPool.length === 0) return;

    const text = textPool[Math.floor(Math.random() * textPool.length)];
    const id = nextId++;

    // Position logic ...
    let top, left;
    const zone = Math.floor(Math.random() * 4);
    if (zone === 0) {
      top = 5 + Math.random() * 15;
      left = 5 + Math.random() * 90;
    } else if (zone === 1) {
      top = 80 + Math.random() * 15;
      left = 5 + Math.random() * 90;
    } else if (zone === 2) {
      top = 5 + Math.random() * 90;
      left = 2 + Math.random() * 13;
    } else {
      top = 5 + Math.random() * 90;
      left = 85 + Math.random() * 13;
    }

    const newLine: FloatingLine = {
      id,
      text,
      top,
      left,
      moveDuration: 25 + Math.random() * 10,
      scale: 1.0 + Math.random() * 0.5,
      driftX: (Math.random() - 0.5) * 100,
    };

    visibleLines = [...visibleLines, newLine];

    const activeTime = 5000 + Math.random() * 4000;
    setTimeout(() => {
      visibleLines = visibleLines.filter((l) => l.id !== id);
    }, activeTime);
  }

  // Custom Action to handle movement reliably via JS
  function animateMove(
    node: HTMLElement,
    { duration, x }: { duration: number; x: number },
  ) {
    // Force initial state
    node.style.transform = "translate3d(0,0,0)";
    node.style.transition = `transform ${duration}s linear`;

    // Trigger layout reflow to ensure start position is locked
    node.getBoundingClientRect();

    // Start move
    requestAnimationFrame(() => {
      node.style.transform = `translate3d(${x}px, -50px, 0)`;
    });

    return {
      update() {}, // no-op
    };
  }

  onMount(() => {
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
      use:animateMove={{ duration: line.moveDuration, x: line.driftX }}
      class="absolute text-fuchsia-100/80 font-handwriting whitespace-nowrap select-none drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]"
      style="
        top: {line.top}%; 
        left: {line.left}%; 
        opacity: 0.9;
        font-size: {line.scale}rem;
        will-change: transform, opacity;
      "
    >
      {line.text}
    </div>
  {/each}
</div>

<style>
  /* No keyframes needed */
</style>
