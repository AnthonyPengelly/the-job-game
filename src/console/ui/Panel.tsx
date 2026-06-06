interface PanelProps {
  title?: string;
  tag?: string;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Panel({ title, tag, live, className, children }: PanelProps) {
  const cls = ['panel', live ? 'live' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {(title || tag) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {tag && <span className="panel-tag">{tag}</span>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}

/** Convenience variant for body-only panels (no head). */
export function PanelCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const cls = ['panel', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="panel-body">{children}</div>
    </div>
  );
}
