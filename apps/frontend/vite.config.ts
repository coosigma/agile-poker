import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));
const playgroundHtml = resolve(rootDir, 'playground.html');

export default defineConfig({
	plugins: [react()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:8787',
			},
			'/graphql': {
				target: 'http://localhost:8787',
			},
			'/ws': {
				target: 'ws://localhost:8787',
				ws: true,
			},
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(rootDir, 'index.html'),
				// Dev-only preview entry; included only when present so production
				// builds without it stay unaffected.
				...(existsSync(playgroundHtml) ? { playground: playgroundHtml } : {}),
			},
		},
	},
});
