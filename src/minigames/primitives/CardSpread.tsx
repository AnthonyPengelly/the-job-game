export type CardId = string & { readonly __brand: 'CardId' };

export interface Card {
  id: CardId;
  label: string;
}

export interface CardSpreadProps {
  cards: Card[];
  layout: 'row' | 'grid';
  faceDown?: CardId[];
  onTap?: (id: CardId) => void;
}

/** Renders a spread of cards face-up or face-down; supports tap-to-select. */
export function CardSpread({ cards, layout, faceDown = [], onTap }: CardSpreadProps): JSX.Element {
  const isFaceDown = (id: CardId) => faceDown.includes(id);

  const containerStyle: React.CSSProperties =
    layout === 'grid'
      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8 }
      : { display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' };

  return (
    <div data-testid="card-spread" style={containerStyle}>
      {cards.map((card) => {
        const down = isFaceDown(card.id);
        return (
          <button
            key={card.id}
            data-testid={`card-${card.id}`}
            data-face-down={down ? 'true' : 'false'}
            onClick={() => onTap?.(card.id)}
            style={{
              width: 60,
              height: 84,
              border: '1px solid #999',
              borderRadius: 4,
              background: down ? '#333' : '#fff',
              color: down ? 'transparent' : '#000',
              cursor: onTap ? 'pointer' : 'default',
            }}
          >
            {down ? '?' : card.label}
          </button>
        );
      })}
    </div>
  );
}
