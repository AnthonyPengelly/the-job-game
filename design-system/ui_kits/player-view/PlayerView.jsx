// Player View — read-only surface for one mini-game + optional countdown.
// Two states (Rulebook / Countdown) toggled by a kit-only switch.

function Rulebook() {
  return (
    <div className="pv-inner">
      <div className="pv-eyebrow">
        <span className="sq" />Player View
        <span className="div" />
        <span className="muted">Room 01A · Obstacle</span>
      </div>
      <h1 className="pv-title">Tile Run</h1>
      <p className="pv-lede">The gallery floor is wired. Cross it together &mdash; or trip the shutters.</p>
      <div className="pv-steps">
        <div className="pv-step"><span className="num">1</span><span className="txt">Each player chooses <b>one card</b> from their hand and places it face-down.</span></div>
        <div className="pv-step"><span className="num">2</span><span className="txt">On the GM&rsquo;s call, <b>reveal together</b> and add up the values. Face cards count as 10.</span></div>
        <div className="pv-step"><span className="num">3</span><span className="txt">Meet the check and the crew slips through. Miss it and the room gains <b>Heat</b>.</span></div>
      </div>
      <div className="pv-check">
        <span className="k">Pass the check</span>
        <span className="v">Total &ge; 14</span>
      </div>
    </div>
  );
}

function Countdown() {
  const [secs, setSecs] = React.useState(45);
  React.useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const danger = secs <= 15;
  return (
    <div className="pv-inner" style={{ alignItems: 'center' }}>
      <div className="pv-clock-label">Get to the van</div>
      <div className={'pv-clock' + (danger ? ' danger' : '')}>{mm}:{ss}</div>
    </div>
  );
}

function PlayerView() {
  const [mode, setMode] = React.useState('rules');
  return (
    <div className="pv">
      {mode === 'rules' ? <Rulebook /> : <Countdown key="cd" />}
      <div className="pv-switch">
        <span className="tag">Kit preview</span>
        <button className={mode === 'rules' ? 'on' : ''} onClick={() => setMode('rules')}>Rulebook</button>
        <button className={mode === 'clock' ? 'on' : ''} onClick={() => setMode('clock')}>Countdown</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PlayerView />);
