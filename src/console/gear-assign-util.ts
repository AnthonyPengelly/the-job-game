import type { GearId, Lane } from '@/engine';
import type { GearDef } from '@/engine/config';
import type { GearGrantDescriptor } from '@/engine/types';

export function isGrantDescriptor(item: GearId | GearGrantDescriptor): item is GearGrantDescriptor {
  return typeof item === 'object' && item !== null && 'kind' in item;
}

/** Find the GearId in the catalog that matches the descriptor + chosen lane. */
export function resolveGearDescriptor(
  descriptor: GearGrantDescriptor,
  lane: Lane,
  gearCatalog: Record<string, GearDef>,
): GearId | undefined {
  const targetKind = descriptor.kind === 'bigScore' ? 'statBoost' : descriptor.kind;
  const targetMagnitude = descriptor.kind === 'bigScore' ? 2 : 1;
  for (const [id, def] of Object.entries(gearCatalog)) {
    if (def.lane !== lane) continue;
    if (def.kind === 'powerUp' && targetKind === 'powerUp') return id as GearId;
    if (def.kind === 'statBoost' && targetKind === 'statBoost' && def.magnitude === targetMagnitude) {
      return id as GearId;
    }
  }
  return undefined;
}

export function gearItemLabel(
  item: GearId | GearGrantDescriptor,
  gearCatalog: Record<string, GearDef>,
): string {
  if (!isGrantDescriptor(item)) {
    const def = gearCatalog[item as string];
    if (def === undefined) return String(item);
    if (def.kind === 'powerUp') return `${def.name} (${def.lane} power-up)`;
    return `${def.name} (${def.lane} +${def.magnitude})`;
  }
  const lanes = item.lanes ?? (item.lane ? [item.lane] : []);
  // Kind first — a power-up grant must never read as a stat boost.
  const kindLabel =
    item.kind === 'powerUp' ? 'power-up' : item.kind === 'bigScore' ? '+2 stat' : '+1 stat';
  return `${kindLabel} (${lanes.join('/')})`;
}
