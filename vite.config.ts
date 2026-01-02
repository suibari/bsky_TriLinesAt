import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.png', 'robots.txt'],
			manifest: {
				name: 'TriLinesAt',
				short_name: 'TriLinesAt',
				description: 'Social 3-line diary on AT Protocol',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				icons: [
					{
						src: 'favicon.png',
						sizes: 'any',
						type: 'image/png'
					}
				]
			},
			devOptions: {
				enabled: false,
				type: 'module'
			}
		})
	]
});
