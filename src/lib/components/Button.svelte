<script lang="ts">
  export let variant: "primary" | "glass" | "ghost" = "primary";
  export let disabled = false;
  export let type: "button" | "submit" | "reset" = "button";
  export let onclick: (() => void) | undefined = undefined;

  export let className = "";
  export { className as class };

  const base =
    "px-6 py-2.5 rounded-xl font-medium transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  const variants = {
    primary:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-violet-500/30 hover:brightness-110 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none",
    glass:
      "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md",
    ghost: "hover:bg-white/5 text-white/70 hover:text-white",
  };
</script>

<button
  {type}
  class="{base} {variants[variant]} {className}"
  {disabled}
  on:click={onclick}
  {...$$restProps}
>
  <slot />
</button>
