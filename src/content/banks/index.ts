// Content bank re-exports — typed accessors for the banks wired through EngineConfig.
// Mini-games receive bank items via the factory pattern (e.g. makeInsideKnowledge(items))
// rather than importing bank JSON directly, keeping generate() pure and deterministic.
export type { TriviaItem, TriviaTier } from '@/content/schema';
