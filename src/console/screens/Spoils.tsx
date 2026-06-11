import { useState } from 'react';
import {
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  Briefcase,
  BatteryLow,
  Zap,
  Plus,
  Shuffle,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId, Lane, Outcome, RoomResult } from '@/engine';
import { isResting, computeGearSellValue } from '@/engine';
import type { GearDef } from '@/engine/config';
import type { GearGrantDescriptor } from '@/engine/types';
import { Teleprompter } from '@/console/teleprompter';
import { isGrantDescriptor, resolveGearDescriptor } from '@/console/gear-assign-util';
import { formatLoot } from '@/content/format';
import { ActionBar, Button } from '@/console/ui';
import './Spoils.css';

// ── Outcome helpers ───────────────────────────────────────────────────────────

function deriveOutcome(lastResult: RoomResult | undefined): Outcome | undefined {
  if (!lastResult) return undefined;
  if (lastResult.kind === 'obstacle') return lastResult.outcome;
  if (lastResult.kind === 'scenario') {
    if (lastResult.success === true) return 'clean';
    if (lastResult.success === false) return 'complication';
  }
  return undefined;
}

function outcomeLabel(outcome: Outcome): string {
  if (outcome === 'clean') return 'Clean';
  if (outcome === 'complication') return 'Complication';
  return 'Botched';
}

function outcomeIcon(outcome: Outcome): LucideIcon {
  if (outcome === 'clean') return CheckCheck;
  if (outcome === 'complication') return AlertTriangle;
  return AlertOctagon;
}

// ── Gear card helpers ─────────────────────────────────────────────────────────

interface GearMeta {
  cls: 'power' | 'boost' | 'choice';
  typeLabel: string;
  Icon: LucideIcon;
}

function getGearMeta(
  item: GearId | GearGrantDescriptor,
  gearCatalog: Record<string, GearDef>,
): GearMeta {
  if (isGrantDescriptor(item)) {
    const lanes = item.lanes ?? (item.lane ? [item.lane] : []);
    if (lanes.length > 1) {
      return { cls: 'choice', typeLabel: 'Stat boost · pick lane', Icon: Shuffle };
    }
    if (item.kind === 'powerUp') {
      return { cls: 'power', typeLabel: `Power-up · ${lanes[0] ?? 'lane'}`, Icon: Zap };
    }
    return { cls: 'boost', typeLabel: `Stat boost · ${lanes[0] ?? 'lane'}`, Icon: Plus };
  }
  const def = gearCatalog[String(item)];
  if (!def) return { cls: 'boost', typeLabel: 'Gear', Icon: Plus };
  if (def.kind === 'powerUp') {
    return { cls: 'power', typeLabel: `Power-up · ${def.lane}`, Icon: Zap };
  }
  return { cls: 'boost', typeLabel: `Stat boost · ${def.lane}`, Icon: Plus };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getGearName(
  item: GearId | GearGrantDescriptor,
  laneChoice: Lane | '',
  gearCatalog: Record<string, GearDef>,
): string {
  if (isGrantDescriptor(item)) {
    const magnitude = item.kind === 'bigScore' ? 2 : 1;
    const lanes = item.lanes ?? (item.lane ? [item.lane] : []);
    if (lanes.length > 1) return `+${magnitude} Any Lane`;
    if (item.kind === 'powerUp') return `${capitalize(lanes[0] ?? 'Lane')} Power-up`;
    const lane = laneChoice || lanes[0] || 'lane';
    return `+${magnitude} ${capitalize(lane)}`;
  }
  const def = gearCatalog[String(item)];
  if (!def) return String(item);
  if (def.kind === 'powerUp') return `${capitalize(def.lane)} Power-up`;
  return `+${def.magnitude} ${capitalize(def.lane)}`;
}

function getGearDesc(
  item: GearId | GearGrantDescriptor,
  gearCatalog: Record<string, GearDef>,
): string {
  if (isGrantDescriptor(item)) {
    const magnitude = item.kind === 'bigScore' ? 2 : 1;
    const lanes = item.lanes ?? (item.lane ? [item.lane] : []);
    if (item.kind === 'powerUp') {
      return `Activates the ${lanes[0] ?? 'lane'} shout for the holder.`;
    }
    const laneStr = lanes.length > 1 ? 'chosen lane' : (lanes[0] ?? 'lane');
    return `A flat +${magnitude} to the holder's ${laneStr}.`;
  }
  const def = gearCatalog[String(item)];
  if (!def) return '';
  if (def.kind === 'powerUp') return `Activates the ${def.lane} shout for the holder.`;
  return `A flat +${def.magnitude} to the holder's ${def.lane}.`;
}

// ── GearCard ──────────────────────────────────────────────────────────────────

interface GearCardProps {
  item: GearId | GearGrantDescriptor;
  index: number;
  gearCatalog: Record<string, GearDef>;
  onAssign: (to: PlayerId, gearId: GearId, earnedGearIndex: number) => void;
  onSell: (index: number) => void;
  sellValueLabel: string;
  crew: Array<{ id: PlayerId; name: string }>;
}

function GearCard({ item, index, gearCatalog, onAssign, onSell, sellValueLabel, crew }: GearCardProps) {
  const isDescriptor = isGrantDescriptor(item);
  const availableLanes: Lane[] = isDescriptor
    ? ((item.lanes ?? (item.lane ? [item.lane] : [])) as Lane[])
    : [];
  const needsLanePick = isDescriptor && availableLanes.length > 1;

  const [laneChoice, setLaneChoice] = useState<Lane | ''>(
    needsLanePick ? '' : (availableLanes[0] ?? ''),
  );

  const cardId = isDescriptor ? `grant-${index}` : String(item);
  const resolvedId: GearId | undefined = isDescriptor && laneChoice
    ? resolveGearDescriptor(item, laneChoice as Lane, gearCatalog)
    : isDescriptor
      ? undefined
      : (item as GearId);

  const { cls, typeLabel, Icon } = getGearMeta(item, gearCatalog);
  const gearName = getGearName(item, laneChoice, gearCatalog);
  const gearDesc = getGearDesc(item, gearCatalog);

  function handleAssignChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const playerId = e.target.value as PlayerId;
    if (!resolvedId || !playerId) return;
    onAssign(playerId, resolvedId, index);
  }

  return (
    <div className={`gearcard ${cls}`} data-testid={`spoils-gear-card-${cardId}`}>
      <div className="gc-type">
        <Icon size={14} aria-hidden={true} />
        {typeLabel}
      </div>
      <div className="gc-name" data-testid={`spoils-gear-label-${cardId}`}>
        {gearName}
      </div>
      {gearDesc !== '' && <div className="gc-desc">{gearDesc}</div>}
      {needsLanePick && (
        <div className="gc-lane">
          <span className="ga-k">Lane</span>
          <div className="lanepick" data-testid={`spoils-gear-lane-${cardId}`}>
            {availableLanes.map(l => (
              <span
                key={l}
                className={`lp${laneChoice === l ? ' sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setLaneChoice(l)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLaneChoice(l); }}
                aria-pressed={laneChoice === l}
              >
                {l.slice(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="gc-assign">
        <span className="ga-k">Assign to</span>
        <select
          className="gc-select"
          data-testid={`spoils-assign-${cardId}`}
          onChange={handleAssignChange}
          disabled={!resolvedId}
          aria-label={`Assign ${gearName} to crew member`}
        >
          <option value="">— choose —</option>
          {crew.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="gearcard-sell"
        data-testid={`spoils-sell-${cardId}`}
        onClick={() => onSell(index)}
      >
        Sell for {sellValueLabel}
      </button>
    </div>
  );
}

// ── Spoils ────────────────────────────────────────────────────────────────────

/**
 * Spoils/Wrap-up beat shown after every room before the Offer.
 *
 * Shows the outcome banner (Clean/Complication/Botched), Loot banked this room
 * + run total, gear-share panel with per-card dropdown assign + sell, and the
 * rests-next-room exhaust bar. Continue CTA publishes to the cockpit action bar.
 */
export function Spoils() {
  const history = useGameStore(s => s.session.present.history);
  const earnedGear = useGameStore(s => s.session.present.earnedGear);
  const crew = useGameStore(s => s.session.present.crew);
  const loot = useGameStore(s => s.session.present.loot);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const gearCatalog = useGameStore(s => s.cfg.gear);
  const cfg = useGameStore(s => s.cfg);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);
  const clearPendingSpoils = useGameStore(s => s.clearPendingSpoils);

  const sellValueLabel = formatLoot(computeGearSellValue(roomIndex, cfg));
  const lastResult = history.at(-1);
  const outcome = deriveOutcome(lastResult);
  const lootGained = lastResult?.lootGained ?? 0;
  const roomNum = lastResult ? String(lastResult.roomIndex + 1) : '';

  // Payoff narration: committed once at mount for the relevant beat.
  const [quipLines] = useState<string[]>(() => {
    if (director === null || lastResult === undefined) return [];
    if (lastResult.kind === 'obstacle') {
      return director.script('outcomeQuip', { outcome: lastResult.outcome });
    }
    if (lastResult.kind === 'scenario') {
      const outcomeCtx: Outcome | undefined =
        lastResult.success === true ? 'clean'
        : lastResult.success === false ? 'complication'
        : undefined;
      return director.script('scenarioReveal',
        outcomeCtx !== undefined ? { outcome: outcomeCtx } : {},
      );
    }
    return [];
  });
  const [quipIndex, setQuipIndex] = useState(0);

  const currentQuip = quipLines[quipIndex] ?? '';
  const hasNextQuip = quipIndex < quipLines.length - 1;

  function handleQuipAdvance() {
    setQuipIndex(i => Math.min(i + 1, quipLines.length - 1));
  }

  function handleAssign(to: PlayerId, gearId: GearId, earnedGearIndex: number) {
    dispatch({ t: 'ASSIGN_GEAR', gear: gearId, to, earnedGearIndex });
  }

  function handleSell(index: number) {
    dispatch({ t: 'SELL_GEAR', index });
  }

  // Who sits out the NEXT room — not whoever is resting now (their rest is
  // about to end and listing them here misled the table in playtests).
  const restingCrew = crew.filter(p => isResting(p, roomIndex + 1));
  const unassignedCount = earnedGear.length;

  const OutcomeIcon = outcome !== undefined ? outcomeIcon(outcome) : null;
  const bannerCls = outcome !== undefined && outcome !== 'clean'
    ? 'outcome-banner comp'
    : 'outcome-banner';

  return (
    <div className="stage-inner" data-testid="screen-spoils">
      <div className="spoils">

        {/* ── Top row: outcome banner + loot readout ──────────────────── */}
        <div className="spoils-top">
          {outcome !== undefined && OutcomeIcon !== null && (
            <div className={bannerCls} data-testid="spoils-outcome-banner">
              <span className="ob-k">
                <OutcomeIcon size={15} aria-hidden={true} />
                {roomNum !== '' ? `Outcome · Room ${roomNum}` : 'Outcome'}
              </span>
              <span className="ob-v" data-testid="spoils-outcome-value">
                {outcomeLabel(outcome)}
              </span>
            </div>
          )}

          <div className="loot-readout" data-testid="spoils-loot">
            <span className="lr-k">Loot banked</span>
            <span className="lr-v" data-testid="spoils-loot-value">
              {lootGained > 0 ? `+${formatLoot(lootGained)}` : formatLoot(lootGained)}
            </span>
            <span className="lr-s" data-testid="spoils-loot-total">
              Run total {formatLoot(loot)}
            </span>
          </div>
        </div>

        {/* ── Payoff narration ─────────────────────────────────────────── */}
        {currentQuip !== '' && (
          <div data-testid="outcome-quip">
            <Teleprompter line={currentQuip} hasNext={hasNextQuip} onAdvance={handleQuipAdvance} />
          </div>
        )}

        {/* ── Gear share ───────────────────────────────────────────────── */}
        {earnedGear.length > 0 && (
          <div className="gear-share" data-testid="spoils-gear-section">
            <div className="gs-head">
              <Briefcase size={18} aria-hidden={true} />
              <h3>Share out the gear</h3>
              <span className="gs-hint">
                <Users size={15} aria-hidden={true} />
                Pick who holds each card, then continue
              </span>
            </div>
            <div className="gs-body" data-testid="spoils-gear-cards">
              {earnedGear.map((item, idx) => (
                <GearCard
                  key={idx}
                  item={item}
                  index={idx}
                  gearCatalog={gearCatalog}
                  onAssign={handleAssign}
                  onSell={handleSell}
                  sellValueLabel={sellValueLabel}
                  crew={crew.map(p => ({ id: p.id, name: p.name }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Rests-next-room bar ──────────────────────────────────────── */}
        {restingCrew.length > 0 && (
          <div className="exhaust" data-testid="spoils-resting">
            <BatteryLow size={18} aria-hidden={true} />
            <span className="ex-k">Rests next room</span>
            <div className="ex-who">
              {restingCrew.map(p => (
                <div key={p.id} className="ex-chip" data-testid={`spoils-resting-${p.id}`}>
                  <span className="ex-av">{p.name.charAt(0).toUpperCase()}</span>
                  <span className="ex-nm">{p.name}</span>
                </div>
              ))}
            </div>
            <span className="ex-note">They sit the next room out.</span>
          </div>
        )}

      </div>

      {/* ── Continue CTA in cockpit action bar ──────────────────────── */}
      <ActionBar
        right={
          <Button
            kind="primary"
            data-testid="btn-spoils-continue"
            onClick={clearPendingSpoils}
          >
            Continue
          </Button>
        }
        note={
          unassignedCount > 0 ? (
            <span data-testid="spoils-unassigned-note">
              {unassignedCount} gear unassigned · Gear keeps a badge
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
