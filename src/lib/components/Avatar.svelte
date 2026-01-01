<script lang="ts">
  export let src: string | undefined = undefined;
  export let alt: string = "User avatar";
  export let size: "sm" | "md" | "lg" | "xl" = "md";
  export let ring = false;

  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
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
</div>
