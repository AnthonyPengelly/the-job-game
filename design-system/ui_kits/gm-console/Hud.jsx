// HUD — persistent top bar: logo · heat track · counters · crew · phase rail.

function HeatTrack({ heat, max = 20, pulseIdx }) {
  const slots = [];
  for (let i = 0; i < max; i++) {
    let cls = 'slot';
    if (i < heat) cls += ' on';
    else if (i === heat) cls += ' next';
    if (i === pulseIdx) cls += ' pulse';
    slots.push(<div key={i} className={cls} />);
  }
  return (
    <div className="heatwrap">
      <div className="heat-head">
        <span className="hlabel"><span className="dot heat" />Heat</span>
        <span className="heat-count"><span className="lit">{String(heat).padStart(2, '0')}</span><span className="tot"> / {max}</span></span>
      </div>
      <div className="track">{slots}</div>
    </div>
  );
}

function Chip({ icon, label, value, sub, accent }) {
  return (
    <div className={'chip' + (accent ? ' accent' : '')}>
      {icon && <Icon name={icon} />}
      <div className="stk">
        <span className="k">{label}</span>
        <span className="v">{value}{sub && <small> {sub}</small>}</span>
      </div>
    </div>
  );
}

function Hud({ state, phases, phaseIndex, onJump, pulseIdx }) {
  const { heat, loot, round, totalRounds, crew, gearLeft } = state;
  return (
    <header className="hud">
      <div className="hud-main">
        <div className="lockup">
          <span className="sq" />
          <div>
            <div className="wm"><em>THE</em>_JOB</div>
            <div className="sub">GM Console</div>
          </div>
        </div>

        <div className="hud-block grow">
          <HeatTrack heat={heat} pulseIdx={pulseIdx} />
        </div>

        <div className="chips">
          <Chip icon="banknote" label="Loot" value={'$' + (loot / 1000).toFixed(1) + 'k'} accent />
          <Chip icon="repeat" label="Round" value={round} sub={'/ ' + totalRounds} />
          <Chip icon="briefcase" label="Gear" value={gearLeft} />
        </div>

        <div className="hud-block">
          <span className="hlabel"><Icon name="users" style={{ width: 14, height: 14 }} />Crew</span>
          <div className="crew-row">
            {crew.map((c) => (
              <div key={c.id} className="av" data-out={c.out ? 'true' : 'false'} title={c.name + ' · ' + c.role}>
                {c.name[0]}
                {c.gear && !c.out && <span className="gdot" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <nav className="rail">
        {phases.map((p, i) => (
          <button
            key={p.key}
            className={'pill ' + (i === phaseIndex ? 'now' : i < phaseIndex ? 'done' : '')}
            onClick={() => onJump(i)}
          >
            <span className="n">{String(i + 1).padStart(2, '0')}</span>{p.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

Object.assign(window, { Hud, HeatTrack, Chip });
