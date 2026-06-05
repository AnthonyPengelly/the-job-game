// Phase screens for the GM Console. Each takes { state, api }.

function PhaseHead({ eyebrow, title, aside }) {
  return (
    <div className="phase-head">
      <div>
        <div className="phase-eyebrow">{eyebrow}</div>
        <h1 className="phase-title">{title}</h1>
      </div>
      {aside && <div className="phase-aside" dangerouslySetInnerHTML={{ __html: aside }} />}
    </div>
  );
}

function Teleprompter({ children }) {
  return (
    <div className="teleprompter">
      <div className="tp-label"><Icon name="megaphone" style={{ width: 13, height: 13 }} />Read aloud</div>
      <p>{children}</p>
    </div>
  );
}

/* ---------------------------------------------------------- */
function SetupScreen({ state, api }) {
  const steps = [
    'Shuffle the Room deck and place it face-down',
    'Deal one Gear card to each player, face-down',
    'Set the Heat track to zero',
    'The Mastermind reads the Briefing aloud',
  ];
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow="01 · Setup" title="Assemble the Crew" aside={'TONIGHT&rsquo;S MARK<br/>Meridian Private Bank'} />
      <div className="setup-grid">
        <div className="panel"><div className="panel-body">
          <div className="field">
            <label>Players at the table</label>
            <div className="stepper">
              <button onClick={() => api.setPlayers(-1)}>&minus;</button>
              <span className="val">{state.crew.length}</span>
              <button onClick={() => api.setPlayers(1)}>+</button>
            </div>
          </div>
          <div className="field">
            <label>Crew name</label>
            <input className="inp" value={state.crewName} onChange={(e) => api.setCrewName(e.target.value)} />
          </div>
        </div></div>
        <div className="panel"><div className="panel-body">
          <span className="panel-tag">Setup checklist</span>
          <div className="checklist">
            {steps.map((s, i) => (
              <div key={i} className={'check' + (i < 2 ? ' done' : '')}>
                <span className="box">{i < 2 && <Icon name="check" />}</span>{s}
              </div>
            ))}
          </div>
        </div></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function BriefingScreen({ state }) {
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow="02 · Briefing" title="The Briefing" aside={'TARGET HAUL<br/><span style="color:var(--accent);font-size:18px">$120,000</span>'} />
      <Teleprompter>
        Three floors of cold marble between you and the vault. The Meridian doesn&rsquo;t trust cameras &mdash; it trusts people, and people can be moved. You have six rooms to clear before the night shift changes. Keep the Heat low and you walk out rich. Let it climb&hellip; and you don&rsquo;t walk out at all.
      </Teleprompter>
      <div className="grid-3">
        <div className="readout"><span className="k">Security</span><span className="v" style={{ color: 'var(--caution)' }}>HIGH</span></div>
        <div className="readout"><span className="k">Rooms</span><span className="v">6</span></div>
        <div className="readout"><span className="k">Crew</span><span className="v">{state.crew.length}</span></div>
      </div>
      <div className="panel"><div className="panel-head"><h3>Order of Play</h3><span className="panel-tag">Mastermind reveals</span></div>
        <div className="panel-body">
          <div className="checklist">
            {state.crew.map((c, i) => (
              <div key={c.id} className="check done">
                <span className="box" style={{ fontFamily: 'var(--font-data)', fontWeight: 800 }}>{i + 1}</span>
                <strong style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '.02em' }}>{c.name}</strong>
                <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-data)', fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase' }}>{c.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function ObstacleScreen({ state, api }) {
  const [resolved, setResolved] = React.useState(null);
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow={'Room 0' + state.round + 'A · Obstacle'} title="Pressure Plate" aside={'CHECK<br/>Total &ge; 14 to pass'} />
      <Teleprompter>
        The floor of the gallery is a grid of brushed-steel tiles, and every third one is wired. One wrong step and the shutters drop. Move together, move quiet &mdash; and whatever you do, don&rsquo;t rush it.
      </Teleprompter>
      <div className="panel live"><div className="panel-head"><h3>Mini-game · Tile Run</h3><span className="panel-tag">Player view ready</span></div>
        <div className="panel-body">
          <p className="prose muted">Each player simultaneously plays one card face-down, then reveals. Sum the values. Face cards count as 10. If the total meets the check, the crew slips through clean.</p>
          {!resolved ? (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button kind="primary" icon="check" onClick={() => { setResolved('pass'); }}>Cleared the room</Button>
              <Button kind="danger" icon="flame" onClick={() => { setResolved('fail'); api.raiseHeat(2, true); }}>Plate triggered &middot; +2 Heat</Button>
            </div>
          ) : (
            <div className={'readout'} style={{ alignItems: 'flex-start', borderColor: resolved === 'pass' ? 'color-mix(in srgb,var(--accent) 50%,transparent)' : 'color-mix(in srgb,var(--danger) 50%,transparent)' }}>
              <span className="k">{resolved === 'pass' ? 'Clean run' : 'Alarm tripped'}</span>
              <p className="prose" style={{ fontSize: 18 }}>{resolved === 'pass'
                ? 'Nobody breathes. The last tile holds. You\u2019re through \u2014 on to the next door.'
                : 'A shutter slams somewhere behind you. Heat rises. Keep moving before the patrol circles back.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function OfferScreen({ api }) {
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow="04 · The Offer" title="The Fence" aside={'A choice<br/>No take-backs'} />
      <Teleprompter>
        A voice on the comms. The fence has a buyer for the manager&rsquo;s private safe &mdash; double the take, if you&rsquo;re willing to crack it while the clock&rsquo;s already running. More money, more noise. Your call.
      </Teleprompter>
      <div className="grid-2">
        <div className="opt risk" onClick={() => { api.addLoot(40000); api.raiseHeat(4, true); api.next(); }}>
          <span className="opt-tag"><Icon name="flame" style={{ width: 14, height: 14 }} /> High risk</span>
          <h4>Crack the safe</h4>
          <p className="prose muted" style={{ fontSize: 16 }}>Take the second score. Loud, slow, lucrative.</p>
          <div className="opt-cost">
            <div className="c"><span className="k">Loot</span><span className="v" style={{ color: 'var(--accent)' }}>+$40k</span></div>
            <div className="c"><span className="k">Heat</span><span className="v" style={{ color: 'var(--danger)' }}>+4</span></div>
          </div>
        </div>
        <div className="opt safe" onClick={() => { api.next(); }}>
          <span className="opt-tag"><Icon name="shield" style={{ width: 14, height: 14 }} /> Play it safe</span>
          <h4>Walk away</h4>
          <p className="prose muted" style={{ fontSize: 16 }}>Bank what you have. Live to spend it.</p>
          <div className="opt-cost">
            <div className="c"><span className="k">Loot</span><span className="v" style={{ color: 'var(--fg-faint)' }}>&plusmn;0</span></div>
            <div className="c"><span className="k">Heat</span><span className="v" style={{ color: 'var(--fg-faint)' }}>&plusmn;0</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function GetawayScreen({ state }) {
  const [secs, setSecs] = React.useState(45);
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => {
    if (!running) return;
    if (secs <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, secs]);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const danger = secs <= 15;
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow="05 · The Getaway" title="The Getaway" aside={'Heat ' + String(state.heat).padStart(2, '0') + ' / 20'} />
      <Teleprompter>
        Van&rsquo;s idling on the loading dock. The moment this clock hits zero, the doors lock and the cameras come back online. Everyone who isn&rsquo;t in the van is on their own.
      </Teleprompter>
      <div className="clock-wrap">
        <div className={'clock ' + (danger ? '' : 'calm') + (running ? ' running' : '')}>{mm}:{ss}</div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {!running
            ? <Button kind="primary" size="lg" icon="play" onClick={() => setRunning(true)}>{secs === 45 ? 'Start run' : 'Resume'}</Button>
            : <Button kind="secondary" size="lg" icon="pause" onClick={() => setRunning(false)}>Hold</Button>}
          <Button kind="ghost" size="lg" icon="rotate-ccw" onClick={() => { setRunning(false); setSecs(45); }}>Reset</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function ResultScreen({ state }) {
  const win = state.heat < 20;
  return (
    <div className="stage-inner">
      <PhaseHead eyebrow="06 · Result" title="After the Job" />
      <div className={'verdict ' + (win ? 'win' : 'lose')}>{win ? 'Clean Getaway' : 'Job Blown'}</div>
      <Teleprompter>
        {win
          ? 'Taillights on the motorway. The bank won\u2019t know what hit them until morning, and by then you\u2019re three counties gone. Split it fair.'
          : 'Blue light fills the van. Somebody talked, or the Heat caught up \u2014 either way the night ends in cuffs. There\u2019s always the next job.'}
      </Teleprompter>
      <div className="grid-3">
        <div className="readout"><span className="k">Total haul</span><span className="v" style={{ color: 'var(--accent)' }}>${(state.loot / 1000).toFixed(1)}k</span></div>
        <div className="readout"><span className="k">Final heat</span><span className="v" style={{ color: win ? 'var(--fg)' : 'var(--danger)' }}>{String(state.heat).padStart(2, '0')}<small style={{ color: 'var(--fg-faint)', fontSize: 20 }}>/20</small></span></div>
        <div className="readout"><span className="k">Rooms cleared</span><span className="v">{state.totalRounds}</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { SetupScreen, BriefingScreen, ObstacleScreen, OfferScreen, GetawayScreen, ResultScreen, PhaseHead, Teleprompter });
