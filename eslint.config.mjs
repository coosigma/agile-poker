import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Mainstream flat config: typescript-eslint recommended (non-type-checked —
// tsc already owns type safety in verify) plus the React hooks/refresh rules
// used by the Vite frontend. Type-aware linting is intentionally omitted to
// keep `eslint .` fast across the monorepo.
export default tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/build/**',
			'**/.wrangler/**',
			'**/mockServiceWorker.js',
			'tests/sdd/generated/**',
		],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
		},
	},
	reactHooks.configs.flat.recommended,
	reactRefresh.configs.vite,
	{
		// v7-only performance advisory. Components that sync an external system
		// (e.g. a WebSocket / async fetch) inside an effect are a validated
		// pattern here, so keep it non-blocking rather than refactor proven code.
		files: ['**/*.{ts,tsx}'],
		rules: {
			'react-hooks/set-state-in-effect': 'warn',
		},
	},
);
