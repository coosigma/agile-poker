import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStory } from '../lib/generate-story.mts';
import { twoPeopleEstimateMachine, storyEvents } from './machine.ts';
import { ucManifest } from '../uc/manifest.ts';
import { negativeScenarios } from '../uc/negative/manifest.ts';

const here = dirname(fileURLToPath(import.meta.url));

generateStory({
	machine: twoPeopleEstimateMachine,
	storyEvents,
	ucManifest,
	negativeScenarios,
	initialState: 'anonymousHome',
	outDir: join(here, '..', 'generated'),
	specBaseName: 'two-people-estimate',
	storyName: 'two-people-estimate',
	mdRelPath: 'tests/sdd/two-people-estimate/two-people-estimate.md',
	generatorRelPath: 'tests/sdd/two-people-estimate/generate.mts',
	machineRelPath: 'tests/sdd/two-people-estimate/machine.ts',
	positiveTitle: 'two people estimate together via an invite link',
	negativeDescribe: 'two people estimate — negatives',
	contextImportPath: '../uc/context',
});
