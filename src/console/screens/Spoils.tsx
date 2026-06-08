import { useState } from 'react';
import { useGameStore } from '@/console/store';
import type { GearId, PlayerId, Lane } from '@/engine';
import { isResting, computeGearSellValue } from '@/engine';
import type { GearDef } from '@/engine/config';
import type { GearGrantDescriptor } from '@/engine/types';
import { Teleprompter } from '@/console/teleprompter';
import { isGrantDescriptor, resolveGearDescriptor, gearItemLabel } from '@/console/gear-assign-util';
import { formatLoot } from '@/content/format';

// ── GearCard ──────────────────────────────────────────────────────────────────

interface GearCardProps {
  item: GearId | GearGrantDescriptor;
  index: number;
  selected: boolean;
  gearCatalog: Record<string, GearDef>;
  onSelect: () => void;
  onAssign: (to: PlayerId, gearId: GearId, earnedGearIndex: number) => void;
  onSell: (index: number) => void;
  sellValueLabel: string;
  crew: Array<{ id: PlayerId; name: string }>;
}

function GearCard({ item, index, selected, gearCatalog, onSelect, onAssign, onSell, sellValueLabel, crew }: GearCardProps) {
  const isDescriptor = isGrantDescriptor(item);
  const availableLanes: Lane[] = isDescriptor
    ? ((item.lanes ?? (item.lane ? [item.lane] : [])) as Lane[])
    : [];
  const needsLanePick = isDescriptor && availableLanes.length > 1;

  const [laneChoice, setLaneChoice] = useState<Lane | ''>(
    needsLanePick ? '' : (availableLanes[0] ?? ''),
  );

  const cardId = isDescriptor ? `grant-${index}` : String(item);
  const displayLabel = gearItemLabel(item, gearCatalog);

  const resolvedId: GearId | undefined = isDescriptor && laneChoice
    ? resolveGearDescriptor(item, laneChoice as Lane, gearCatalog)
    : isDescriptor
      ? undefined
      : (item as GearId);

  return (
    <div
      className={`spoils-gear-card${selected ? ' selected' : ''}`}
      data-testid={`spoils-gear-card-${cardId}`}
      draggable={!isDescriptor || !!resolvedId}
      onDragStart={(e) => {
        if (resolvedId) {
          e.dataTransfer.setData('application/x-gear-id', resolvedId as string);
          e.dataTransfer.setData('application/x-gear-index', String(index));
          e.dataTransfer.effectAllowed = 'copy';
        }
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      aria-pressed={selected}
    >
      <span data-testid={`spoils-gear-label-${cardId}`}>{displayLabel}</span>

      {needsLanePick && (
        <select
          value={laneChoice}
          onChange={(e) => { setLaneChoice(e.target.value as Lane); e.stopPropagation(); }}
          data-testid={`spoils-gear-lane-${cardId}`}
          aria-label="Choose lane"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Pick lane…</option>
          {availableLanes.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      )}

      <button
        type="button"
        className="spoils-sell-btn"
        data-testid={`spoils-sell-${cardId}`}
        onClick={(e) => {
          e.stopPropagation();
          onSell(index);
        }}
      >
        Sell for {sellValueLabel}
      </button>

      {selected && (
        <div className="spoils-crew-picker" data-testid={`spoils-crew-picker-${cardId}`}>
          {crew.map(p => (
            <button
              key={p.id}
              type="button"
              className="spoils-crew-pick-btn"
              data-testid={`spoils-assign-${cardId}-${p.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!resolvedId) return;
                onAssign(p.id, resolvedId, index);
              }}
              disabled={!resolvedId}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Spoils ────────────────────────────────────────────────────────────────────

/**
 * Spoils/Wrap-up beat shown after every room before the Offer.
 *
 * Announces loot gained and lets the GM assign earned gear (drag onto crew
 * avatar in the left rail, or tap-card → tap-crew inline). Shows who is now
 * resting. CONTINUE clears the pending-spoils flag and the PhaseRouter shows
 * the Offer screen.
 *
 * No engine phase is created — this is a console-only UI interstitial.
 */
export function Spoils() {
  const history = useGameStore(s => s.session.present.history);
  const earnedGear = useGameStore(s => s.session.present.earnedGear);
  const crew = useGameStore(s => s.session.present.crew);
  const roomIndex = useGameStore(s => s.session.present.roomIndex);
  const gearCatalog = useGameStore(s => s.cfg.gear);
  const cfg = useGameStore(s => s.cfg);
  const director = useGameStore(s => s.director);
  const dispatch = useGameStore(s => s.dispatch);
  const clearPendingSpoils = useGameStore(s => s.clearPendingSpoils);

  const sellValueLabel = formatLoot(computeGearSellValue(roomIndex, cfg));

  const lastResult = history.at(-1);

  // Outcome quip: shown for obstacle rooms only.
  const [quipLine] = useState<string>(() => {
    if (director !== null && lastResult?.kind === 'obstacle') {
      return director.next('outcomeQuip', { outcome: lastResult.outcome });
    }
    return '';
  });

  const [currentQuip, setCurrentQuip] = useState(quipLine);

  function handleQuipAdvance() {
    if (director !== null && lastResult?.kind === 'obstacle') {
      const next = director.next('outcomeQuip', { outcome: lastResult.outcome });
      setCurrentQuip(next);
    }
  }

  const [selectedGearIdx, setSelectedGearIdx] = useState<number | null>(null);

  const lootGained = lastResult?.lootGained ?? 0;

  function handleGearSelect(idx: number) {
    setSelectedGearIdx(prev => (prev === idx ? null : idx));
  }

  function handleAssign(to: PlayerId, gearId: GearId, earnedGearIndex: number) {
    dispatch({ t: 'ASSIGN_GEAR', gear: gearId, to, earnedGearIndex });
    setSelectedGearIdx(null);
  }

  function handleSell(index: number) {
    dispatch({ t: 'SELL_GEAR', index });
    setSelectedGearIdx(null);
  }

  const restingCrew = crew.filter(p => isResting(p, roomIndex));

  return (
    <div className="stage-inner" data-testid="screen-spoils">
      <h2 className="spoils-heading">Spoils</h2>

      {/* Outcome quip (obstacle only) */}
      {currentQuip !== '' && (
        <div data-testid="outcome-quip">
          <Teleprompter line={currentQuip} onAdvance={handleQuipAdvance} />
        </div>
      )}

      {/* Loot gained */}
      <div className="spoils-loot" data-testid="spoils-loot">
        <span className="k">Loot gained</span>
        <span className="v" data-testid="spoils-loot-value">{formatLoot(lootGained)}</span>
      </div>

      {/* Earned gear */}
      {earnedGear.length > 0 && (
        <div className="spoils-gear-section" data-testid="spoils-gear-section">
          <h3>Gear dropped</h3>
          <div className="spoils-gear-cards" data-testid="spoils-gear-cards">
            {earnedGear.map((item, idx) => (
              <GearCard
                key={idx}
                item={item}
                index={idx}
                selected={selectedGearIdx === idx}
                gearCatalog={gearCatalog}
                onSelect={() => handleGearSelect(idx)}
                onAssign={handleAssign}
                onSell={handleSell}
                sellValueLabel={sellValueLabel}
                crew={crew.map(p => ({ id: p.id, name: p.name }))}
              />
            ))}
          </div>
          <p className="spoils-gear-hint">
            Drag a card onto a crew avatar, or tap a card then tap a name.
          </p>
        </div>
      )}

      {/* Exhaustion */}
      {restingCrew.length > 0 && (
        <div className="spoils-resting" data-testid="spoils-resting">
          <h3>Resting next room</h3>
          <ul>
            {restingCrew.map(p => (
              <li key={p.id} data-testid={`spoils-resting-${p.id}`}>
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Continue */}
      <button
        type="button"
        className="btn btn-primary spoils-continue"
        data-testid="btn-spoils-continue"
        onClick={clearPendingSpoils}
      >
        Continue
      </button>
    </div>
  );
}
