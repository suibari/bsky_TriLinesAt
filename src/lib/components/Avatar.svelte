<script lang="ts">
  export let src: string | undefined = undefined;
  export let alt: string = "User avatar";
  export let size: "sm" | "md" | "lg" | "xl" = "md";
  export let ring = false;

  export let badge: string | undefined = undefined;

  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const badgeSizes = {
    sm: "text-[10px] -bottom-1 -right-1 w-4 h-4",
    md: "text-base -bottom-1 -right-1 w-6 h-6",
    lg: "text-xl -bottom-1 -right-1 w-8 h-8",
    xl: "text-2xl -bottom-2 -right-2 w-10 h-10",
  };

  const fallback = `https://ui-avatars.com/api/?name=User&background=random`;
</script>

<div class="relative inline-block {sizes[size]} shrink-0">
  <img
    src={src || fallback}
    {alt}
    class="w-full h-full object-cover rounded-full {ring
      ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-slate-900'
      : ''} bg-slate-800"
    loading="lazy"
  />
  {#if badge}
    <div
      class="absolute {badgeSizes[size]} flex items-center justify-center z-10"
      title="Badge"
      style="text-shadow: 2px 0 0 #0f172a, -2px 0 0 #0f172a, 0 2px 0 #0f172a, 0 -2px 0 #0f172a, 1px 1px 0 #0f172a, -1px -1px 0 #0f172a, 1px -1px 0 #0f172a, -1px 1px 0 #0f172a;"
    >
      {badge}
    </div>
  {/if}
</div>
