/* ============================================================
   THE JOB — cockpit renderer + gallery helpers
   Builds the fixed 1280×800 GM cockpit from a config object,
   lays frames out on a review page, fits & scales them.
   ============================================================ */
(function (w) {
  'use strict';

  /* ---- the cast (British crew) ------------------------------ */
  var CREW = {
    Lucy:   { name: 'Lucy',   role: 'Hacker',   lanes: { tec: 5, phy: 2, cha: 3, ste: 4 } },
    Millie: { name: 'Millie', role: 'Grifter',  lanes: { tec: 2, phy: 2, cha: 6, ste: 3 } },
    George: { name: 'George', role: 'Muscle',   lanes: { tec: 1, phy: 6, cha: 2, ste: 2 } },
    Liv:    { name: 'Liv',    role: 'Ghost',    lanes: { tec: 3, phy: 3, cha: 2, ste: 6 } },
    Chris:  { name: 'Chris',  role: 'Wheelman', lanes: { tec: 3, phy: 4, cha: 3, ste: 3 } },
    Alison: { name: 'Alison', role: 'Fixer',    lanes: { tec: 4, phy: 2, cha: 4, ste: 3 } },
    Dave:   { name: 'Dave',   role: 'Cleaner',  lanes: { tec: 2, phy: 4, cha: 2, ste: 4 } }
  };
  var LANE_ORDER = ['tec', 'phy', 'cha', 'ste'];
  var LANE_LABEL = { tec: 'TEC', phy: 'PHY', cha: 'CHA', ste: 'STE' };

  function icon(name, attrs) {
    return '<i data-lucide="' + name + '"' + (attrs || '') + '></i>';
  }

  /* ---- HEAT TRACK ------------------------------------------- */
  function heatTrack(cfg) {
    var heat = cfg.heat || 0, max = 20, pulse = cfg.heatPulse, warnFrom = cfg.heatWarnFrom;
    var hot = heat >= 14;
    var slots = '';
    for (var i = 0; i < max; i++) {
      var cls = 'slot';
      if (i < heat) {
        cls += ' on';
        if (warnFrom != null && i >= warnFrom && i < heat) cls += ' warn';
      } else if (i === heat) cls += ' next';
      if (i === pulse) cls += ' pulse';
      slots += '<div class="' + cls + '"></div>';
    }
    return '' +
      '<div class="heatwrap">' +
        '<div class="heat-head">' +
          '<span class="hlabel"><span class="dot"></span>Heat</span>' +
          '<span class="heat-count"><span class="lit">' + String(heat).padStart(2, '0') + '</span><span class="tot"> / ' + max + '</span></span>' +
        '</div>' +
        '<div class="track">' + slots + '</div>' +
      '</div>';
  }

  /* ---- CREW CARD -------------------------------------------- */
  function crewCard(m) {
    var base = CREW[m.name] || { name: m.name, role: m.role || '', lanes: m.lanes || { tec: 0, phy: 0, cha: 0, ste: 0 } };
    var lanes = m.lanes || base.lanes;
    var role = m.role || base.role;
    var powers = m.powers || [];
    var state = m.state || 'idle';
    var stateLabel = m.stateLabel || ({ in: 'IN PLAY', rest: 'RESTS', idle: 'READY' })[state] || '';
    var cls = ['member', state];
    if (m.cls) cls.push(m.cls);

    var laneHTML = LANE_ORDER.map(function (k) {
      var hot = (m.hotLanes || []).indexOf(k) >= 0;
      return '<div class="lane' + (hot ? ' hot' : '') + '"><span class="ll">' + LANE_LABEL[k] + '</span><span class="lv">' + (lanes[k] != null ? lanes[k] : '–') + '</span></div>';
    }).join('');

    var pipHTML = LANE_ORDER.map(function (k) {
      return '<span class="pip' + (powers.indexOf(k) >= 0 ? ' on' : '') + '" title="' + LANE_LABEL[k] + ' power-up"></span>';
    }).join('');

    var attrs = m.attr || '';

    return '<div class="' + cls.join(' ') + '"' + attrs + '>' +
      '<div class="m-top">' +
        '<span class="av">' + base.name[0] + '</span>' +
        '<span class="who"><span class="nm">' + base.name + '</span><span class="role">' + role + '</span></span>' +
        (stateLabel ? '<span class="mstate">' + stateLabel + '</span>' : '') +
      '</div>' +
      '<div class="lanes">' + laneHTML + '</div>' +
      '<div class="pips">' + pipHTML + '</div>' +
    '</div>';
  }

  /* ---- TOOLS RAIL ------------------------------------------- */
  function toolsRail(cfg) {
    var t = cfg.tools || {};
    var active = t.active;
    function tool(id, ic, label, badge, extra) {
      return '<button class="tool ' + (active === id ? 'active ' : '') + (extra || '') + '" data-tool="' + id + '">' +
        (badge ? '<span class="tbadge">' + badge + '</span>' : '') +
        icon(ic) + '<span class="tl">' + label + '</span></button>';
    }
    return '<aside class="toolsrail">' +
      tool('sound', 'volume-2', 'Sound') +
      tool('gm', 'sliders-horizontal', 'GM') +
      tool('gear', 'briefcase', 'Gear', t.gearBadge) +
      tool('settings', 'settings', 'Set') +
      '<span class="spacer"></span>' +
      tool('undo', 'rotate-ccw', 'Undo', null, 'undo') +
    '</aside>';
  }

  /* ---- ACTION BAR ------------------------------------------- */
  function btn(b, dflt) {
    if (!b) return '';
    var kind = b.kind || dflt || 'secondary';
    var size = b.size ? ' btn-' + b.size : '';
    return '<button class="btn btn-' + kind + size + '"' + (b.disabled ? ' disabled' : '') + '>' +
      (b.icon ? icon(b.icon) : '') + (b.label || '') + '</button>';
  }
  function actionBar(cfg) {
    var a = cfg.action || {};
    var left = '<div class="grp">' + btn(a.back, 'ghost') + btn(a.secondary, 'secondary') + '</div>';
    var cues = '';
    if (a.cues && a.cues.length) {
      cues = '<div class="grp cues"><span class="cues-label">Cues</span>' + a.cues.map(function (c) {
        return '<button class="cue ' + (c.cls || '') + '">' + icon(c.icon || 'volume-2') + '<span class="cl">' + c.label + '</span></button>';
      }).join('') + '</div>';
    } else {
      cues = '<div class="grp cues"></div>';
    }
    var right = '<div class="grp">' + (a.primaryNote ? '<span class="dialnote">' + a.primaryNote + '</span>' : '') + btn(a.primary, 'primary') + '</div>';
    return '<div class="actionbar">' + left + cues + right + '</div>';
  }

  /* ---- TOP RAIL --------------------------------------------- */
  function topRail(cfg) {
    var esc = '';
    if (cfg.escape === 'signal') {
      esc = '<div class="escape-sig">' + icon('siren') +
        '<span class="t"><span class="k">Getting hot</span><span class="v">we can roll</span></span></div>';
    } else if (cfg.escape === 'forced') {
      esc = '<div class="escape-sig forced">' + icon('siren') +
        '<span class="t"><span class="k">Cover blown</span><span class="v">Getaway forced</span></span></div>';
    }
    var lootStr = cfg.lootStr || ('$' + (cfg.loot != null ? cfg.loot.toLocaleString() : '0'));
    var kindTag = cfg.kind ? '<span class="kindtag ' + cfg.kind.toLowerCase() + '">' + cfg.kind + '</span>' : '';
    var roundChip = cfg.round ? '<div class="chip"><div class="stk"><span class="k">Room</span><span class="v">' + cfg.round + '<small> / ' + (cfg.totalRounds || '?') + '</small></span></div></div>' : '';

    return '<header class="toprail">' +
      '<div class="lockup"><span class="sq"></span><div><div class="wm"><em>THE</em>_JOB</div><div class="sub">GM Console</div></div></div>' +
      '<div class="rail-div"></div>' +
      (cfg.phaseLabel ? '<div class="phaseblock">' +
        '<span class="k">PHASE <b>' + (cfg.phaseNum || '') + '</b>' + (cfg.roomLabel ? ' · ' + cfg.roomLabel : '') + '</span>' +
        '<div class="row"><span class="ph">' + cfg.phaseLabel + '</span>' + kindTag + '</div>' +
      '</div>' : '') +
      heatTrack(cfg) +
      esc +
      roundChip +
      '<div class="chip accent">' + icon('banknote') + '<div class="stk"><span class="k">Loot</span><span class="v">' + lootStr + '</span></div></div>' +
    '</header>';
  }

  /* ---- CREW RAIL -------------------------------------------- */
  function crewRail(cfg) {
    var crew = cfg.crew || [];
    var mode = cfg.crewMode || 'default';
    var modeLabel = cfg.crewModeLabel || ({ default: 'Roster', committing: 'Commit', attempter: 'Pick one' })[mode];
    return '<aside class="crewrail">' +
      '<div class="crewrail-head"><span class="hl">' + icon('users') + 'Crew · ' + crew.length + '</span>' +
        '<span class="mode ' + mode + '">' + modeLabel + '</span></div>' +
      '<div class="crewscroll">' + crew.map(crewCard).join('') + '</div>' +
    '</aside>';
  }

  /* ---- STAGE ------------------------------------------------ */
  function stage(cfg) {
    var tp = '';
    if (cfg.tp) {
      tp = '<div class="tp' + (cfg.tp.amber ? ' amber' : '') + '">' +
        '<div class="tp-label">' + icon('megaphone') + (cfg.tp.label || 'Read aloud') +
          '<span class="next">Next' + icon('chevron-right') + '</span></div>' +
        '<p>' + cfg.tp.text + '</p></div>';
    }
    return '<main class="stage">' + tp + '<div class="work ' + (cfg.stageClass || '') + '">' + (cfg.stage || '') + '</div></main>';
  }

  /* ---- COCKPIT ---------------------------------------------- */
  function cockpit(cfg) {
    cfg = cfg || {};
    var inner = topRail(cfg) + crewRail(cfg) + stage(cfg) + toolsRail(cfg) + actionBar(cfg);
    var html = '<div class="cockpit' + (cfg.hot ? ' hot' : '') + '">' + inner + (cfg.overlay || '') + '</div>';
    return html;
  }

  /* ============================================================
     GALLERY
     ============================================================ */
  function page(meta) {
    document.title = 'The Job · ' + (meta.num ? meta.num + ' ' : '') + meta.title;
    var crumbs = (meta.crumbs || []).map(function (c) {
      return '<a class="crumb' + (c.here ? ' here' : '') + '" href="' + c.href + '">' + c.label + '</a>';
    }).join('');
    var head = '<div class="gallery-head">' +
      '<div class="eyebrow"><span class="sq"></span>' + (meta.eyebrow || ('Screen ' + (meta.num || ''))) + '</div>' +
      '<h1>' + meta.title + '</h1>' +
      (meta.desc ? '<p>' + meta.desc + '</p>' : '') +
      (crumbs ? '<div class="crumbs">' + crumbs + '</div>' : '') +
      '</div>';
    var g = document.createElement('div');
    g.className = 'gallery';
    g.innerHTML = head;
    document.body.appendChild(g);
    w.__TJ_G = g;
  }

  function frame(meta, cockpitCfg) {
    var g = w.__TJ_G;
    var block = document.createElement('div');
    block.className = 'frame-block';
    block.innerHTML =
      '<div class="frame-label">' +
        (meta.vnum ? '<span class="vnum">' + meta.vnum + '</span>' : '') +
        '<h2>' + (meta.title || '') + '</h2>' +
        '<span class="dims">' + (meta.dims || '1280 × 800') + '</span>' +
        (meta.note ? '<span class="note">' + meta.note + '</span>' : '') +
      '</div>' +
      '<div class="frame-stage"><div class="frame">' + cockpit(cockpitCfg) + '</div></div>';
    g.appendChild(block);
  }

  /* frameRaw — arbitrary inner HTML (e.g. the chrome-less player view) */
  function frameRaw(meta, innerHTML) {
    var g = w.__TJ_G;
    var block = document.createElement('div');
    block.className = 'frame-block';
    block.innerHTML =
      '<div class="frame-label">' +
        (meta.vnum ? '<span class="vnum">' + meta.vnum + '</span>' : '') +
        '<h2>' + (meta.title || '') + '</h2>' +
        '<span class="dims">' + (meta.dims || '1280 × 800') + '</span>' +
        (meta.note ? '<span class="note">' + meta.note + '</span>' : '') +
      '</div>' +
      '<div class="frame-stage"><div class="frame">' + innerHTML + '</div></div>';
    g.appendChild(block);
  }

  function fit() {
    var stages = document.querySelectorAll('.frame-stage');
    stages.forEach(function (st) {
      var avail = st.parentElement.clientWidth;
      var s = Math.min(1, avail / 1280);
      var f = st.querySelector('.frame');
      f.style.transform = 'scale(' + s + ')';
      st.style.width = (1280 * s) + 'px';
      st.style.height = (800 * s) + 'px';
    });
  }

  function render() {
    if (w.lucide) w.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
    fit();
  }

  w.addEventListener('resize', fit);

  w.TJ = {
    CREW: CREW, icon: icon, cockpit: cockpit, heatTrack: heatTrack, crewCard: crewCard,
    page: page, frame: frame, frameRaw: frameRaw, render: render, fit: fit
  };
})(window);
