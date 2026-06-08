// Pure template engine — no engine imports, no React, no DOM.

export const ALLOWED_TOKENS = [
  'mark',
  'vault',
  'security',
  'targetHaul',
  'lane',
  'crew',
  'attempter',
  'outcome',
  'heatBand',
  'runTotal',
  'roomNum',
] as const;

export type TemplateToken = (typeof ALLOWED_TOKENS)[number];

/** Render context: all values are already-stringified. */
export type TemplateContext = Partial<Record<TemplateToken, string>>;

/**
 * Extract all `{token}` names from `text` (e.g. `["mark", "vault"]`).
 * Used at schema parse-time to validate the token set.
 */
export function extractTokens(text: string): string[] {
  const tokens: string[] = [];
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[1]!);
  }
  return tokens;
}

/**
 * Replace `{token}` placeholders in `text` with values from `ctx`.
 * A token absent from `ctx` renders to an empty string — never the literal
 * `{token}` at the table.
 */
export function fillTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(/\{(\w+)\}/g, (_match, token: string) => ctx[token as TemplateToken] ?? '');
}
