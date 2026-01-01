<script>
	import "../app.css";
	import favicon from "$lib/assets/favicon.svg";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(async () => {
		if (typeof window !== "undefined" && "serviceWorker" in navigator) {
			const { registerSW } = await import("virtual:pwa-register");
			registerSW({
				immediate: true,
				onNeedRefresh() {
					// You could show a prompt here, but for now just auto-update or let it happen on next load
					console.log("PWA needs refresh");
				},
				onOfflineReady() {
					console.log("PWA offline ready");
				},
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- PWA Manifest Link -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#0f172a" />
</svelte:head>

{@render children()}
