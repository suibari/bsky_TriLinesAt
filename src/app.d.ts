// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ImportMetaEnv {
		readonly PUBLIC_APP_URL?: string;
		readonly PUBLIC_PREVIEW_URL?: string;
		readonly PUBLIC_NAGI_URL?: string;
	}
}

export {};
