import { z } from 'zod';
import type { RunPhase } from '@/engine';

// ── Channel groups ─────────────────────────────────────────────────────────────

export const soundChannelSchema = z.enum([
  'ambient',
  'heistSfx',
  'sting',
  'danger',
  'finale',
]);

export type SoundChannel = z.infer<typeof soundChannelSchema>;

// ── Run phases (mirrors engine RunPhase — written out as literals) ─────────────

const RUN_PHASES = [
  'briefing',
  'room',
  'minigame',
  'offer',
  'getaway',
  'result',
] as const satisfies [RunPhase, ...RunPhase[]];

export const runPhaseSchema = z.enum(RUN_PHASES);

// ── Sound cue ─────────────────────────────────────────────────────────────────

export const soundCueSchema = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1),
    channel: soundChannelSchema,
    loop: z.boolean().optional(),
    gain: z.number().positive().optional(),
    phases: z.array(runPhaseSchema).min(1),
  })
  .strict();

export type SoundCue = z.infer<typeof soundCueSchema>;

// ── Ambient bed spec ──────────────────────────────────────────────────────────

export const ambientBedSchema = z
  .object({
    droneId: z.string().min(1),
    heartbeatId: z.string().min(1),
  })
  .strict();

export type AmbientBed = z.infer<typeof ambientBedSchema>;

// ── Sound manifest ────────────────────────────────────────────────────────────

export const soundManifestSchema = z
  .object({
    cues: z.array(soundCueSchema).superRefine((cues, ctx) => {
      const seen = new Set<string>();
      for (const cue of cues) {
        if (seen.has(cue.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate cue id: "${cue.id}"`,
          });
        }
        seen.add(cue.id);
      }
    }),
    ambientBed: ambientBedSchema,
  })
  .strict();

export type ParsedSoundManifest = z.infer<typeof soundManifestSchema>;
