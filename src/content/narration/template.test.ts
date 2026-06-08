import { describe, it, expect } from 'vitest';
import { fillTemplate, extractTokens, ALLOWED_TOKENS } from './template';
import type { TemplateContext } from './template';

// ── extractTokens ─────────────────────────────────────────────────────────────

describe('extractTokens', () => {
  it('returns an empty array for text with no tokens', () => {
    expect(extractTokens('No tokens here.')).toEqual([]);
  });

  it('extracts a single token', () => {
    expect(extractTokens('Hello {mark}!')).toEqual(['mark']);
  });

  it('extracts multiple tokens', () => {
    expect(extractTokens('{crew} breaches {mark} via the {vault}.')).toEqual([
      'crew',
      'mark',
      'vault',
    ]);
  });

  it('extracts duplicate tokens (reports each occurrence)', () => {
    expect(extractTokens('{mark} — always {mark}.')).toEqual(['mark', 'mark']);
  });

  it('handles all canonical tokens', () => {
    const text = ALLOWED_TOKENS.map((t) => `{${t}}`).join(' ');
    const extracted = extractTokens(text);
    expect(extracted).toEqual([...ALLOWED_TOKENS]);
  });
});

// ── fillTemplate ──────────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('returns text unchanged when there are no tokens', () => {
    expect(fillTemplate('Plain text.', {})).toBe('Plain text.');
  });

  it('replaces a single token', () => {
    const ctx: TemplateContext = { mark: 'Ashcombe House' };
    expect(fillTemplate('Welcome to {mark}.', ctx)).toBe('Welcome to Ashcombe House.');
  });

  it('replaces multiple different tokens', () => {
    const ctx: TemplateContext = { crew: 'Spark & Ghost', mark: 'Ashcombe House' };
    expect(fillTemplate('{crew} hits {mark} tonight.', ctx)).toBe(
      'Spark & Ghost hits Ashcombe House tonight.',
    );
  });

  it('replaces all occurrences of the same token', () => {
    const ctx: TemplateContext = { mark: 'The Meridian' };
    expect(fillTemplate('{mark} — always {mark}.', ctx)).toBe(
      'The Meridian — always The Meridian.',
    );
  });

  it('renders an empty string for a missing context value (never the literal {token})', () => {
    expect(fillTemplate('Vault: {vault}.', {})).toBe('Vault: .');
  });

  it('renders empty string for every missing token type', () => {
    const emptyCtx: TemplateContext = {};
    for (const token of ALLOWED_TOKENS) {
      const result = fillTemplate(`{${token}}`, emptyCtx);
      expect(result).toBe('');
      expect(result).not.toBe(`{${token}}`);
    }
  });

  it('covers every allowed token when all are provided', () => {
    const ctx: TemplateContext = {
      mark: 'Ashcombe House',
      vault: 'East Wing',
      security: 'HIGH',
      targetHaul: '$85k',
      lane: 'tech',
      crew: 'Ghost & Spark',
      attempter: 'Ghost',
      outcome: 'clean',
      heatBand: 'cool',
      runTotal: '3',
      roomNum: '2',
    };
    for (const token of ALLOWED_TOKENS) {
      const filled = fillTemplate(`{${token}}`, ctx);
      expect(filled).toBe(ctx[token]);
    }
  });

  it('handles {crew} as a pre-joined string', () => {
    const ctx: TemplateContext = { crew: 'Alpha, Bravo, Charlie' };
    expect(fillTemplate('Crew: {crew}.', ctx)).toBe('Crew: Alpha, Bravo, Charlie.');
  });

  it('leaves non-token curly braces unchanged', () => {
    // Only word-character tokens are matched — numeric or otherwise non-word
    // patterns inside braces are left as-is since they never appear in our content.
    const result = fillTemplate('{mark} costs {}', { mark: 'Villa' });
    expect(result).toBe('Villa costs {}');
  });
});

// ── ALLOWED_TOKENS ────────────────────────────────────────────────────────────

describe('ALLOWED_TOKENS', () => {
  it('is a non-empty readonly array', () => {
    expect(ALLOWED_TOKENS.length).toBeGreaterThan(0);
  });

  it('contains the required canonical tokens', () => {
    const required = [
      'mark', 'vault', 'security', 'targetHaul',
      'lane', 'crew', 'attempter', 'outcome',
      'heatBand', 'runTotal', 'roomNum',
    ] as const;
    for (const t of required) {
      expect(ALLOWED_TOKENS).toContain(t);
    }
  });
});
