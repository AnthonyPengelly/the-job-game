interface ActionBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function ActionBar({ left, right }: ActionBarProps) {
  return (
    <div className="actionbar">
      {left !== undefined && <div className="grp">{left}</div>}
      {right !== undefined && <div className="grp">{right}</div>}
    </div>
  );
}
