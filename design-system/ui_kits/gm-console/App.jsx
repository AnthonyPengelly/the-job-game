// GM Console — app shell: phase state machine, action bar, Tweaks.

const PHASES = [
  { key: 'setup',    label: 'Setup',    Screen: () => window.SetupScreen },
  { key: 'briefing', label: 'Brief',    Screen: () => window.BriefingScreen },
  { key: 'obstacle', label: 'Obstacle', Screen: () => window.ObstacleScreen },
  { key: 'offer',    label: 'Offer',    Screen: () => window.OfferScreen },
  { key: 'getaway',  label: 'Getaway',  Screen: () => window.GetawayScreen },
  { key: 'result',   label: 'Result',   Screen: () => window.ResultScreen },
];

const CREW_POOL = [
  { id: 1, name: 'Reno',   role: 'Driver', gear: true },
  { id: 2, name: 'Vesper', role: 'Hacker', gear: true },
  { id: 3, name: 'Marlow', role: 'Muscle', gear: false },
  { id: 4, name: 'Sable',  role: 'Face',   gear: true },
  { id: 5, name: 'Quill',  role: 'Tech',   gear: true },
  { id: 6, name: 'Bishop', role: 'Lookout', gear: false },
  { id: 7, name: 'Iris',   role: 'Climber', gear: true },
];

const INITIAL = {
  crewName: 'The Magpies',
  crew: CREW_POOL.slice(0, 5),
  heat: 6,
  loot: 48500,
  round: 1,
  totalRounds: 6,
  gearLeft: 2,
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "green",
  "texture": "clean"
}/*EDITMODE-END*/;

const PRIMARY = {
  setup:    { label: 'Begin heist',     icon: 'play' },
  briefing: { label: 'Enter first room', icon: 'door-open' },
  obstacle: { label: 'Next room',        icon: 'skip-forward' },
  offer:    { label: 'Skip the offer',   icon: 'skip-forward' },
  getaway:  { label: 'Made it out',      icon: 'check' },
  result:   { label: 'New job',          icon: 'rotate-ccw' },
};

function load() {
  try { const s = JSON.parse(localStorage.getItem('thejob.state')); if (s && s.crew) return s; } catch (e) {}
  return INITIAL;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [phaseIndex, setPhaseIndex] = React.useState(() => {
    const n = parseInt(localStorage.getItem('thejob.phase'), 10);
    return Number.isFinite(n) ? n : 0;
  });
  const [state, setState] = React.useState(load);
  const [pulseIdx, setPulseIdx] = React.useState(null);

  React.useEffect(() => { localStorage.setItem('thejob.state', JSON.stringify(state)); }, [state]);
  React.useEffect(() => { localStorage.setItem('thejob.phase', String(phaseIndex)); }, [phaseIndex]);

  const api = React.useMemo(() => ({
    next: () => setPhaseIndex((i) => Math.min(i + 1, PHASES.length - 1)),
    back: () => setPhaseIndex((i) => Math.max(i - 1, 0)),
    jump: (i) => setPhaseIndex(i),
    raiseHeat: (n = 1) => setState((s) => {
      const heat = Math.min(20, s.heat + n);
      setPulseIdx(heat - 1);
      setTimeout(() => setPulseIdx(null), 320);
      return { ...s, heat };
    }),
    lowerHeat: (n = 1) => setState((s) => ({ ...s, heat: Math.max(0, s.heat - n) })),
    addLoot: (n) => setState((s) => ({ ...s, loot: s.loot + n })),
    setPlayers: (d) => setState((s) => {
      const n = Math.max(2, Math.min(7, s.crew.length + d));
      return { ...s, crew: CREW_POOL.slice(0, n) };
    }),
    setCrewName: (v) => setState((s) => ({ ...s, crewName: v })),
    reset: () => { setState(INITIAL); setPhaseIndex(0); },
  }), []);

  const phase = PHASES[phaseIndex];
  const Screen = phase.Screen();
  const prim = PRIMARY[phase.key];
  const onPrimary = phase.key === 'result' ? api.reset : api.next;

  return (
    <div className="console" data-accent={t.accent} data-texture={t.texture}>
      <Hud state={state} phases={PHASES} phaseIndex={phaseIndex} onJump={api.jump} pulseIdx={pulseIdx} />

      <main className="stage">
        {Screen ? <Screen state={state} api={api} /> : null}
      </main>

      <div className="actionbar">
        <div className="grp">
          <Button kind="ghost" icon="chevron-left" disabled={phaseIndex === 0} onClick={api.back}>Back</Button>
        </div>
        <div className="grp">
          {phase.key !== 'result' && (
            <Button kind="danger" icon="flame" onClick={() => api.raiseHeat(1)}>Raise Heat</Button>
          )}
          <Button kind="primary" icon={prim.icon} onClick={onPrimary}>{prim.label}</Button>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Look & feel" />
        <TweakRadio label="Signal colour" value={t.accent}
          options={['green', 'amber', 'cyan']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="Surface texture" value={t.texture}
          options={['clean', 'grain', 'scan']}
          onChange={(v) => setTweak('texture', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
