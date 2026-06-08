// Content layer — Zod-validated presets, scenarios, gear, narration, banks.
export { scenariosSchema } from './schema/scenarios';
export type { ParsedScenarios, ParsedScenarioDef } from './schema/scenarios';

export { narrationSchema, narrationVariantSchema, narrationWhenSchema } from './schema/narration';
export type { ParsedNarration, NarrationVariant, NarrationWhen, NarrationBeat } from './schema/narration';

export { spineBankSchema, markSpineSchema } from './schema/spine';
export type { SpineBank, MarkSpine } from './schema/spine';

export { filterByContext, selectVariant } from './narration';
export { fillTemplate, extractTokens, ALLOWED_TOKENS } from './narration/template';
export type { TemplateToken, TemplateContext } from './narration/template';
