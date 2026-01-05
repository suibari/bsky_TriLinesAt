<script>
	import "../app.css";
	import { onMount } from "svelte";
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
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#0f172a" />

	<!-- SEO & OGP -->
	<title>TriLinesAt</title>
	<meta
		name="description"
		content="Five minutes before bed, three lines of journaling. A social diary app on Bluesky."
	/>

	<meta property="og:title" content="TriLinesAt" />
	<meta
		property="og:description"
		content="Five minutes before bed, three lines of journaling. A social diary app on Bluesky."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/ogp.png" />
	<meta property="og:site_name" content="TriLinesAt" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="TriLinesAt" />
	<meta
		name="twitter:description"
		content="Five minutes before bed, three lines of journaling. A social diary app on Bluesky."
	/>
	<meta name="twitter:image" content="/ogp.png" />
</svelte:head>

<Lightbox />
<AboutModal />
<div class="flex flex-col min-h-screen">
	{@render children()}
	<Footer />
</div>
