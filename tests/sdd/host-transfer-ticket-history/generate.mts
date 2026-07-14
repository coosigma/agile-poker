import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStory } from '../lib/generate-story.mts';
import { hostTransferTicketHistoryMachine, storyEvents } from './machine.ts';
import { hostTransferTicketHistoryManifest } from './manifest.ts';
import { negativeScenarios } from './negative-manifest.ts';

const here = dirname(fileURLToPath(import.meta.url));

generateStory({
	machine: hostTransferTicketHistoryMachine,
	storyEvents,
	ucManifest: hostTransferTicketHistoryManifest,
	negativeScenarios,
	initialState: 'anonymousHome',
	outDir: join(here, '..', 'generated'),
	specBaseName: 'host-transfer-ticket-history',
	storyName: 'host-transfer-ticket-history',
	mdRelPath:
		'tests/sdd/host-transfer-ticket-history/host-transfer-ticket-history.md',
	generatorRelPath: 'tests/sdd/host-transfer-ticket-history/generate.mts',
	machineRelPath: 'tests/sdd/host-transfer-ticket-history/machine.ts',
	positiveTitle:
		'host transfers control and the new host completes ticket history',
	negativeDescribe: 'host transfer ticket history — negatives',
	contextImportPath: '../uc/context',
});
