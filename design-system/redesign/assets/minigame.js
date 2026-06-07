/* ============================================================
   THE JOB — mini-game shell helper. Builds the STATUS / CHALLENGE
   / REFEREE stage every game shares. Pairs with minigame.css.
   Depends on TJ.icon (cockpit.js).
   ============================================================ */
(function (w) {
  'use strict';
  var icon = w.TJ ? w.TJ.icon : function (n) { return '<i data-lucide="' + n + '"></i>'; };

  function modeBadge(mode, label) {
    var def = { armed: 'Armed · brief', active: 'Active', resolve: 'Resolve' };
    return '<span class="modebadge ' + mode + '"><span class="md"></span>' + (label || def[mode]) + '</span>';
  }

  function timer(value, state, label) {
    state = state || 'ready';
    return '<div class="mg-timer ' + state + '">' + icon('timer') +
      '<div><div class="tv">' + value + '</div><div class="tk">' + (label || 'Timer') + (state === 'ready' ? ' · ready' : '') + '</div></div></div>';
  }

  function dial(label, sub) {
    return '<div class="gmdial">' + icon('eye') +
      '<div><div class="gk">GM only · difficulty</div><div class="gv">' + label + (sub ? ' <small>' + sub + '</small>' : '') + '</div></div></div>';
  }

  function prog(label, value, pct, cls) {
    return '<div class="mg-prog ' + (cls || '') + '"><div class="ph"><span class="pk">' + label + '</span><span class="pv">' + value + '</span></div>' +
      '<div class="ptrack"><div class="pfill" style="width:' + pct + '%"></div></div></div>';
  }

  function boosts(arr) {
    return '<div class="boosts">' + arr.map(function (b) {
      var st = b.state || 'ready';
      var done = st === 'used' ? '<span class="bdone">USED</span>' : '';
      return '<div class="boost ' + st + '"><span class="bav">' + b.holder[0] + '</span>' +
        '<div class="bt"><span class="bn">' + b.name + '</span><span class="bh">' + b.holder + (b.lane ? ' · ' + b.lane : '') + '</span></div>' + done + '</div>';
    }).join('') + '</div>';
  }

  function outcomes(arr) {
    return '<div class="outcomes">' + arr.map(function (o) {
      var ic = { clean: 'check-check', comp: 'alert-triangle', botch: 'x' }[o.tier];
      return '<div class="oc ' + o.tier + (o.suggested ? ' suggested' : '') + '">' +
        (o.suggested ? '<span class="sugflag">Suggested</span>' : '') +
        '<div class="oc-top">' + icon(ic) + '<h4>' + o.name + '</h4></div>' +
        '<p>' + o.desc + '</p>' +
        '<div class="oc-cost"><div class="c"><span class="k">Reward</span><span class="v" style="color:' + o.lootColor + '">' + o.loot + '</span></div>' +
        '<div class="c"><span class="k">Heat</span><span class="v" style="color:' + o.heatColor + '">' + o.heat + '</span></div></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* status parts: array of html (modeBadge, timer, dial, prog). chal: {label, body, live}. ref: {label, content} */
  function stage(opts) {
    var status = '<div class="mg-status">' + (opts.status || []).join('') + '</div>';
    var chal = '<div class="mg-chal' + (opts.chal && opts.chal.live ? ' live' : '') + '">' +
      '<span class="chal-label">' + ((opts.chal && opts.chal.label) || 'Challenge') + '</span>' +
      '<div class="chal-body">' + ((opts.chal && opts.chal.body) || '') + '</div></div>';
    var ref = '';
    if (opts.ref) {
      ref = '<div class="mg-ref">' + (opts.ref.label ? '<span class="ref-label">' + opts.ref.label + '</span>' : '') + opts.ref.content + '</div>';
    }
    return '<div class="mg">' + status + chal + ref + '</div>';
  }

  /* small card helpers */
  function card(val, cls, suit) {
    return '<div class="pcard ' + (cls || '') + '">' + (suit ? '<span class="suit">' + suit + '</span>' : '') + '<span class="val">' + val + '</span></div>';
  }

  w.MG = { modeBadge: modeBadge, timer: timer, dial: dial, prog: prog, boosts: boosts, outcomes: outcomes, stage: stage, card: card };
})(window);
