import { z } from 'zod';
import type { RunEvent } from '@/engine/types';

export const SAVE_VERSION = 1;

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const laneSchema = z.enum(['tech', 'physical', 'charm', 'stealth']);
const outcomeSchema = z.enum(['clean', 'complication', 'botched']);
const runPhaseSchema = z.enum(['briefing', 'room', 'minigame', 'offer', 'getaway', 'result']);

const playerSetupSchema = z.object({
  name: z.string(),
  quirk: z.string().optional(),
});

// ── Core event schemas ────────────────────────────────────────────────────────

const startRunSchema = z.object({
  t: z.literal('START_RUN'),
  crew: z.array(playerSetupSchema),
  seed: z.number().optional(),
});

const chooseOptionSchema = z.object({
  t: z.literal('CHOOSE_OPTION'),
  optionId: z.string(),
  committed: z.array(z.string()),
});

const resolveMinigameSchema = z.object({
  t: z.literal('RESOLVE_MINIGAME'),
  outcome: outcomeSchema,
});

const chooseScenarioSchema = z.object({
  t: z.literal('CHOOSE_SCENARIO'),
  choiceId: z.string(),
  attemptedBy: z.string().optional(),
});

const resolveScenarioRollSchema = z.object({
  t: z.literal('RESOLVE_SCENARIO_ROLL'),
  externalRoll: z.number().int().min(1).max(20).optional(),
});

const assignGearSchema = z.object({
  t: z.literal('ASSIGN_GEAR'),
  gear: z.string(),
  to: z.string(),
  earnedGearIndex: z.number().int().optional(),
});

const pushOnSchema = z.object({ t: z.literal('PUSH_ON') });
const callGetawaySchema = z.object({ t: z.literal('CALL_GETAWAY') });

const resolveGetawaySchema = z.object({
  t: z.literal('RESOLVE_GETAWAY'),
  win: z.boolean().optional(),
});

// ── GM-override event schemas ─────────────────────────────────────────────────

const overrideSetHeatSchema = z.object({
  t: z.literal('OVERRIDE_SET_HEAT'),
  value: z.number(),
});
const overrideAdjustHeatSchema = z.object({
  t: z.literal('OVERRIDE_ADJUST_HEAT'),
  delta: z.number(),
});
const overrideSetLootSchema = z.object({
  t: z.literal('OVERRIDE_SET_LOOT'),
  value: z.number(),
});
const overrideAdjustLootSchema = z.object({
  t: z.literal('OVERRIDE_ADJUST_LOOT'),
  delta: z.number(),
});
const overrideSetStatSchema = z.object({
  t: z.literal('OVERRIDE_SET_STAT'),
  player: z.string(),
  lane: laneSchema,
  value: z.number(),
});
const overrideAdjustStatSchema = z.object({
  t: z.literal('OVERRIDE_ADJUST_STAT'),
  player: z.string(),
  lane: laneSchema,
  delta: z.number(),
});
const overrideSetPowerUpSchema = z.object({
  t: z.literal('OVERRIDE_SET_POWERUP'),
  player: z.string(),
  lane: laneSchema,
  held: z.boolean(),
});
const overrideSetRestingSchema = z.object({
  t: z.literal('OVERRIDE_SET_RESTING'),
  player: z.string(),
  untilRoom: z.number().optional(),
});
const overrideRerollRoomSchema = z.object({ t: z.literal('OVERRIDE_REROLL_ROOM') });
const overrideSkipRoomSchema = z.object({ t: z.literal('OVERRIDE_SKIP_ROOM') });
const overrideSetPhaseSchema = z.object({
  t: z.literal('OVERRIDE_SET_PHASE'),
  phase: runPhaseSchema,
});

// ── RunEvent discriminated union ──────────────────────────────────────────────

export const runEventSchema = z.discriminatedUnion('t', [
  startRunSchema,
  chooseOptionSchema,
  resolveMinigameSchema,
  chooseScenarioSchema,
  resolveScenarioRollSchema,
  assignGearSchema,
  pushOnSchema,
  callGetawaySchema,
  resolveGetawaySchema,
  overrideSetHeatSchema,
  overrideAdjustHeatSchema,
  overrideSetLootSchema,
  overrideAdjustLootSchema,
  overrideSetStatSchema,
  overrideAdjustStatSchema,
  overrideSetPowerUpSchema,
  overrideSetRestingSchema,
  overrideRerollRoomSchema,
  overrideSkipRoomSchema,
  overrideSetPhaseSchema,
]);

// ── Save envelope ─────────────────────────────────────────────────────────────

export const saveEnvelopeSchema = z.object({
  version: z.number().int().positive(),
  seed: z.number().int().nonnegative(),
  eventLog: z.array(runEventSchema),
});

/**
 * Versioned save envelope for localStorage persistence.
 * Branded IDs (PlayerId, GearId, QuirkId) are nominal over string and erased at
 * runtime; the Zod schema validates all structural constraints, so eventLog is
 * typed as RunEvent[] — the cast in parseSaveEnvelope is sound.
 */
export interface SaveEnvelope {
  version: number;
  seed: number;
  eventLog: RunEvent[];
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

/**
 * Parse and return a save envelope, throwing ZodError on failure.
 * Branded IDs are nominal over string and erased at runtime; structural
 * validation is complete, so the cast to RunEvent[] is sound.
 */
export function parseSaveEnvelope(data: unknown): SaveEnvelope {
  const parsed = saveEnvelopeSchema.parse(data);
  // Branded types (PlayerId, GearId, QuirkId) are erased at runtime; the schema
  // validates all structural constraints so this coercion to RunEvent[] is sound.
  return parsed as unknown as SaveEnvelope;
}

/**
 * Safely parse a save envelope. Returns a discriminated result.
 */
export function safeParseSaveEnvelope(
  data: unknown,
): { success: true; data: SaveEnvelope } | { success: false; error: z.ZodError } {
  const result = saveEnvelopeSchema.safeParse(data);
  if (result.success) {
    return {
      success: true,
      // See parseSaveEnvelope: branded types are erased at runtime; cast is sound.
      data: result.data as unknown as SaveEnvelope,
    };
  }
  return { success: false, error: result.error };
}
