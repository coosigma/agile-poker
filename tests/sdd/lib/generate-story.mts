import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getShortestPaths } from '@xstate/graph';
import type { AnyStateMachine } from 'xstate';

/**
 * A single entry in a story's use-case manifest — a **pure-data** description of
 * one machine node/transition. The generator reads the manifest, **never the UC
 * bodies**, so codegen never imports Playwright. Keep `id`/`from`/`to` in sync
 * with `machine.ts` and each `uc-*.ts` file (see docs/sdd.md).
 */
export interface UseCaseManifestEntry {
	readonly id: string;
	/** Exported symbol name in the UC module. */
	readonly importName: string;
	/** Extensionless module path, relative to the generated spec. */
	readonly importPath: string;
	readonly from: string;
	readonly to: string;
	readonly description: string;
}

/**
 * An auto-generated NEGATIVE scenario (reviewed before commit). Each negative is
 * a setup prefix of positive use-cases that drives the app to the negative's
 * `from` state, followed by the negative use-case that asserts the guard holds.
 * Negatives are implied by the machine / story — NOT written into the `.md`.
 */
export interface NegativeScenario {
	readonly id: string;
	readonly title: string;
	/** Positive use-cases (by manifest id) that establish the negative's precondition. */
	readonly setup: readonly string[];
	readonly negative: UseCaseManifestEntry;
}

/**
 * Shared story-spec generator (build-time codegen; emitted specs are committed).
 * Each story provides a thin config; this library does the enumeration and
 * emits the positive + negative Playwright specs. Keeping it here avoids
 * duplicating the generator per story (see docs/sdd.md).
 *
 * Enumeration config (locked, see docs/sdd.md):
 *   - traversal:  getShortestPaths
 *   - goals:      terminal state reached via the machine
 *   - coverage:   STATE coverage
 *   - alphabet:   the machine's event set (one event per use-case)
 *   - bounds:     none (termination via a distinct `final` state)
 *
 * For a linear story `getShortestPaths` returns one path per reachable state;
 * the longest (terminal) path subsumes them all, so state coverage is a single
 * full-journey test. Each event on that path maps to its use-case, emitted as
 * ordered `.run(ctx)` calls — UC bodies are NOT inlined and the machine is NOT
 * re-enumerated at runtime.
 */
export interface StoryGenConfig {
	readonly machine: AnyStateMachine;
	readonly storyEvents: readonly { readonly type: string }[];
	readonly ucManifest: readonly UseCaseManifestEntry[];
	readonly negativeScenarios: readonly NegativeScenario[];
	/** Machine's initial state id, used to seed the coverage sanity-check. */
	readonly initialState: string;
	/** Absolute path to the `tests/sdd/generated` directory. */
	readonly outDir: string;
	/** File stem for the emitted specs, e.g. `two-people-estimate-by-code`. */
	readonly specBaseName: string;
	/** Human story name used in generated headers. */
	readonly storyName: string;
	/** Repo-relative path to the story `.md` (for the header). */
	readonly mdRelPath: string;
	/** Repo-relative path to this story's generator (for the header). */
	readonly generatorRelPath: string;
	/** Repo-relative path to this story's machine (for the header). */
	readonly machineRelPath: string;
	/** Playwright `test()` title for the positive journey. */
	readonly positiveTitle: string;
	/** Playwright `test.describe()` title for the negatives. */
	readonly negativeDescribe: string;
	/** Import path for the story context, relative to the generated spec. */
	readonly contextImportPath: string;
}

export function generateStory(config: StoryGenConfig): void {
	const manifestById = new Map<string, UseCaseManifestEntry>(
		config.ucManifest.map((uc) => [uc.id, uc]),
	);

	const outFile = join(config.outDir, `${config.specBaseName}.story.spec.ts`);
	const negativeOutFile = join(
		config.outDir,
		`${config.specBaseName}.negative.story.spec.ts`,
	);

	/**
	 * Stable key for an XState state value. `state.value` is a string for atomic
	 * states but an object for nested/compound/parallel states; `String(...)` would
	 * collapse every compound state to "[object Object]", so serialize objects.
	 */
	const stateKey = (value: unknown): string =>
		typeof value === 'string' ? value : JSON.stringify(value);

	/** Pick the path that covers the most states (state coverage → the terminal path). */
	function coveringPath() {
		const paths = getShortestPaths(config.machine, {
			events: config.storyEvents,
		});
		const covered = new Set<string>();
		for (const p of paths) {
			covered.add(stateKey(p.state.value));
		}
		let best = paths[0];
		for (const p of paths) {
			if (p.steps.length > best.steps.length) {
				best = p;
			}
		}
		const visited = new Set<string>([config.initialState]);
		for (const step of best.steps) {
			if (step.state) {
				visited.add(stateKey(step.state.value));
			}
		}
		visited.add(stateKey(best.state.value));
		for (const s of covered) {
			if (!visited.has(s)) {
				throw new Error(`chosen path does not cover state "${s}"`);
			}
		}
		return best;
	}

	function orderedUseCases(): UseCaseManifestEntry[] {
		const path = coveringPath();
		const ucs: UseCaseManifestEntry[] = [];
		for (const step of path.steps) {
			const eventType = step.event.type;
			if (eventType === 'xstate.init') {
				continue;
			}
			const uc = manifestById.get(eventType);
			if (!uc) {
				throw new Error(
					`no use-case in manifest for machine event "${eventType}"`,
				);
			}
			ucs.push(uc);
		}
		return ucs;
	}

	function render(ucs: UseCaseManifestEntry[]): string {
		const importLines = ucs.map(
			(uc) => `import { ${uc.importName} } from '${uc.importPath}';`,
		);
		const journey = ucs.map((uc) => `${uc.from} → ${uc.to}`).join('\n *   ');
		const runLines = ucs
			.map(
				(uc) =>
					`\t\tawait test.step('${uc.id}', () => ${uc.importName}.run(ctx));`,
			)
			.join('\n');

		return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Generated from ${config.mdRelPath}
 * via ${config.generatorRelPath} (state coverage over
 * ${config.machineRelPath}). Re-run \`pnpm test:story:gen\`
 * after editing the story, the machine, or the use-cases.
 *
 * Journey (state coverage — single terminal path):
 *   ${journey}
 */
import { test } from '@playwright/test';
${importLines.join('\n')}
import { createStoryContext, disposeStoryContext } from '${config.contextImportPath}';

test('${config.positiveTitle}', async ({ browser }) => {
\tconst ctx = await createStoryContext(browser);
\ttry {
${runLines}
\t} finally {
\t\tawait disposeStoryContext(ctx);
\t}
});
`;
	}

	function renderNegatives(scenarios: readonly NegativeScenario[]): string {
		const setupUcs = new Map<string, UseCaseManifestEntry>();
		for (const scenario of scenarios) {
			for (const id of scenario.setup) {
				const uc = manifestById.get(id);
				if (!uc) {
					throw new Error(`negative setup references unknown use-case "${id}"`);
				}
				setupUcs.set(uc.importName, uc);
			}
		}

		const imports = [
			...[...setupUcs.values()].map(
				(uc) => `import { ${uc.importName} } from '${uc.importPath}';`,
			),
			...scenarios.map(
				(s) =>
					`import { ${s.negative.importName} } from '${s.negative.importPath}';`,
			),
		];

		const tests = scenarios.map((scenario) => {
			const steps = [
				...scenario.setup.map((id) => {
					const uc = manifestById.get(id)!;
					return `\t\t\tawait test.step('${uc.id}', () => ${uc.importName}.run(ctx));`;
				}),
				`\t\t\tawait test.step('${scenario.negative.id}', () => ${scenario.negative.importName}.run(ctx));`,
			].join('\n');
			return `\ttest('${scenario.title}', async ({ browser }) => {
\t\tconst ctx = await createStoryContext(browser);
\t\ttry {
${steps}
\t\t} finally {
\t\t\tawait disposeStoryContext(ctx);
\t\t}
\t});`;
		});

		return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Auto-generated NEGATIVE cases for the ${config.storyName} story (reviewed
 * before commit). Implied by the machine / story — NOT written into the .md.
 * Re-run \`pnpm test:story:gen\`.
 */
import { test } from '@playwright/test';
${imports.join('\n')}
import { createStoryContext, disposeStoryContext } from '${config.contextImportPath}';

test.describe('${config.negativeDescribe}', () => {
${tests.join('\n\n')}
});
`;
	}

	const ucs = orderedUseCases();
	mkdirSync(dirname(outFile), { recursive: true });
	writeFileSync(outFile, render(ucs));
	console.log(`generated ${outFile} (${ucs.length} use-cases)`);

	writeFileSync(negativeOutFile, renderNegatives(config.negativeScenarios));
	console.log(
		`generated ${negativeOutFile} (${config.negativeScenarios.length} negative scenarios)`,
	);
}
