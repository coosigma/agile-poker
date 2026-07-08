import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Story-generation entrypoint for `pnpm test:story:gen`.
 *
 * Discovers every `tests/sdd/<story>/generate.mts` and runs it. Each generator
 * is a thin config that calls `generateStory(...)` from `./generate-story.mts`
 * as an import side-effect, emitting that story's specs into `tests/sdd/generated/`.
 *
 * Auto-discovery keeps the wiring first-principles simple: adding a story is a
 * drop-in folder, no `package.json` edit. With no stories yet this is a clean
 * no-op (see docs/sdd.md).
 */
const sddRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const nonStoryDirs = new Set(['lib', 'utils', 'uc', 'generated']);

const generators = readdirSync(sddRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && !nonStoryDirs.has(entry.name))
	.map((entry) => entry.name)
	.sort()
	.map((name) => join(sddRoot, name, 'generate.mts'))
	.filter((generatorPath) => existsSync(generatorPath));

if (generators.length === 0) {
	console.log(
		'test:story:gen — no stories yet (tests/sdd/<story>/generate.mts); nothing to generate.',
	);
}

for (const generatorPath of generators) {
	await import(pathToFileURL(generatorPath).href);
}
