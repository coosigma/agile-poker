import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStory } from '../lib/generate-story.mts';
import { twoPeopleEstimateByCodeMachine, storyEvents } from './machine.ts';
import { ucManifestByCode } from './manifest.ts';
import { negativeScenariosByCode } from './negative-manifest.ts';

const here = dirname(fileURLToPath(import.meta.url));

generateStory({
	machine: twoPeopleEstimateByCodeMachine,
	storyEvents,
	ucManifest: ucManifestByCode,
	negativeScenarios: negativeScenariosByCode,
	initialState: 'anonymousHome',
	outDir: join(here, '..', 'generated'),
	specBaseName: 'two-people-estimate-by-code',
	storyName: 'two-people-estimate-by-code',
	mdRelPath:
		'tests/sdd/two-people-estimate-by-code/two-people-estimate-by-code.md',
	generatorRelPath: 'tests/sdd/two-people-estimate-by-code/generate.mts',
	machineRelPath: 'tests/sdd/two-people-estimate-by-code/machine.ts',
	positiveTitle: 'two people estimate together via a room code',
	negativeDescribe: 'two people estimate by code — negatives',
	contextImportPath: '../uc/context',
});
