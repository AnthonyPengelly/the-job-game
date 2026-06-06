import { Check } from 'lucide-react';

export interface ChecklistItem {
  label: string;
  done?: boolean;
}

interface ChecklistProps {
  items: ChecklistItem[];
}

export function Checklist({ items }: ChecklistProps) {
  return (
    <div className="checklist">
      {items.map((item, i) => (
        <div key={i} className={['check', item.done ? 'done' : ''].filter(Boolean).join(' ')}>
          <span className="box">
            {item.done && <Check size={14} strokeWidth={1.75} aria-hidden={true} />}
          </span>
          {item.label}
        </div>
      ))}
    </div>
  );
}
