// Content layer — Zod-validated presets, scenarios, gear, narration, banks.
export { scenariosSchema } from './schema/scenarios';
export type { ParsedScenarios, ParsedScenarioDef } from './schema/scenarios';

export { narrationSchema, narrationVariantSchema, narrationWhenSchema } from './schema/narration';
export type { ParsedNarration, NarrationVariant, NarrationWhen, NarrationBeat } from './schema/narration';

export { filterByContext, selectVariant } from './narration';
