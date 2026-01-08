<script>
	import "../app.css";
	import { onMount } from "svelte";
	import { dev } from "$app/environment";
	import Lightbox from "$lib/components/Lightbox.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import AboutModal from "$lib/components/AboutModal.svelte";

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
	<!-- PWA Manifest Link -->
	{#if !dev}
		<link rel="manifest" href="/manifest.webmanifest" />
	{/if}
	<meta name="theme-color" content="#0f172a" />
</svelte:head>

<Lightbox />
<AboutModal />
<div class="flex flex-col min-h-screen">
	{@render children()}
	<Footer />
</div>
