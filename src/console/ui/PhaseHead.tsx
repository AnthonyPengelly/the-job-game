interface PhaseHeadProps {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}

export function PhaseHead({ eyebrow, title, aside }: PhaseHeadProps) {
  return (
    <div className="phase-head">
      <div>
        <div className="phase-eyebrow">{eyebrow}</div>
        <h1 className="phase-title">{title}</h1>
      </div>
      {aside && <div className="phase-aside">{aside}</div>}
    </div>
  );
}
