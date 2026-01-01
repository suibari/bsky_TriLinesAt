import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'robots.txt'],
			manifest: {
				name: 'TriLinesAt',
				short_name: 'TriLines',
				description: 'Social 3-line diary on AT Protocol',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				icons: [
					{
						src: 'favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml'
					}
				]
			}
		})
	]
});
