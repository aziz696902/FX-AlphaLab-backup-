import { C } from '../data/colors.js';
import { BOXES } from '../data/boxes.js';
import { N } from '../data/nodes.js';
import { E } from '../data/edges.js';
import { showPanel } from './panel.js';

const FONT = "'SF Pro Display','Segoe UI',system-ui,sans-serif";

// ── Layout ────────────────────────────────────────────────────────────────

let _layoutDone = false;
let _computedBoxes = null;

function ensureLayout() {
  if (_layoutDone) return;

  const PIPELINE_BANDS = [
    { build: 'tech_build',  agent: 'tech'  },
    { build: 'macro_build', agent: 'macro' },
    { build: 'sent_build',  agent: 'sent'  },
    { build: 'geo_build',   agent: 'geo'   },
  ];
  const COORD_GROUPS       = new Set(['coord', 'output']);
  const BAND_GAP           = 70;
  const COORD_GAP          = 100;
  const PIPELINE_AGENT_GAP = 60;

  function layoutSubgraph(nodes, rankdir) {
    const ids = new Set(nodes.map(n => n.id));
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: rankdir || 'LR', ranksep: 72, nodesep: 18, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => g.setNode(n.id, { width: n.w, height: n.h }));
    E.forEach(e => { if (ids.has(e.f) && ids.has(e.t)) g.setEdge(e.f, e.t); });
    dagre.layout(g);
    return g;
  }

  // ── Step 1: layout each band relative to (0,0), record column edges ───
  const bandLayouts = PIPELINE_BANDS.map(({ build, agent }) => {
    const nodes = N.filter(n => n.group === build || n.group === agent);
    const g = layoutSubgraph(nodes, 'LR');
    nodes.forEach(n => { const p = g.node(n.id); n.x = p.x - n.w / 2; n.y = p.y - n.h / 2; });
    const buildNodes = nodes.filter(n => n.group === build);
    const agentNodes = nodes.filter(n => n.group === agent);
    const buildRight = buildNodes.length ? Math.max(...buildNodes.map(n => n.x + n.w)) : 0;
    const agentLeft  = agentNodes.length  ? Math.min(...agentNodes.map(n => n.x))       : buildRight;
    const bandHeight = Math.max(...nodes.map(n => n.y + n.h));
    return { buildNodes, agentNodes, buildRight, agentLeft, bandHeight };
  });

  // ── Step 2: global maxBuildRight → common agent column x ──────────────
  const maxBuildRight = Math.max(...bandLayouts.map(b => b.buildRight));

  // ── Step 3: stack bands vertically, align agent column ────────────────
  let currentY = 60;
  bandLayouts.forEach(({ buildNodes, agentNodes, agentLeft, bandHeight }) => {
    const agentShift = (maxBuildRight + PIPELINE_AGENT_GAP) - agentLeft;
    buildNodes.forEach(n => { n.y += currentY; });
    agentNodes.forEach(n => { n.x += agentShift; n.y += currentY; });
    currentY += bandHeight + BAND_GAP;
  });

  const totalTop    = 60;
  const totalBottom = currentY - BAND_GAP;
  const midY        = (totalTop + totalBottom) / 2;

  // ── Coordinator (TB — vertical column, centered on right) ─────────────
  const coordNodes = N.filter(n => COORD_GROUPS.has(n.group));
  const gCoord = layoutSubgraph(coordNodes, 'TB');

  const maxPipeX = Math.max(...N.filter(n => !COORD_GROUPS.has(n.group)).map(n => n.x + n.w));

  const coordPosArr = coordNodes.map(n => ({ n, p: gCoord.node(n.id) }));
  const cMinY   = Math.min(...coordPosArr.map(({ n, p }) => p.y - n.h / 2));
  const cMaxY   = Math.max(...coordPosArr.map(({ n, p }) => p.y + n.h / 2));
  const cHeight = cMaxY - cMinY;

  coordPosArr.forEach(({ n, p }) => {
    n.x = p.x - n.w / 2 + maxPipeX + COORD_GAP;
    n.y = (p.y - n.h / 2) - cMinY + midY - cHeight / 2;
  });

  // ── Bounding boxes per group ───────────────────────────────────────────
  const gb = {};
  N.forEach(n => {
    if (!n.group) return;
    if (!gb[n.group]) gb[n.group] = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    const b = gb[n.group];
    b.x1 = Math.min(b.x1, n.x);     b.y1 = Math.min(b.y1, n.y);
    b.x2 = Math.max(b.x2, n.x + n.w); b.y2 = Math.max(b.y2, n.y + n.h);
  });

  const PAD = 22;
  _computedBoxes = BOXES.map(b => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    b.groups.forEach(gk => {
      const r = gb[gk];
      if (!r) return;
      x1 = Math.min(x1, r.x1); y1 = Math.min(y1, r.y1);
      x2 = Math.max(x2, r.x2); y2 = Math.max(y2, r.y2);
    });
    if (!isFinite(x1)) return null;
    return { label: b.label, color: b.color, x: x1 - PAD, y: y1 - PAD, w: x2 - x1 + PAD * 2, h: y2 - y1 + PAD * 2 };
  }).filter(Boolean);

  _layoutDone = true;
}

// ── SVG helpers ───────────────────────────────────────────────────────────

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function cp(fn, tn) {
  const fcx = fn.x + fn.w / 2, fcy = fn.y + fn.h / 2;
  const tcx = tn.x + tn.w / 2, tcy = tn.y + tn.h / 2;
  const dx = tcx - fcx, dy = tcy - fcy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fx: fn.x + fn.w, fy: fcy, tx: tn.x,       ty: tcy }
      : { fx: fn.x,        fy: fcy, tx: tn.x + tn.w, ty: tcy };
  } else {
    return dy >= 0
      ? { fx: fcx, fy: fn.y + fn.h, tx: tcx, ty: tn.y }
      : { fx: fcx, fy: fn.y,        tx: tcx, ty: tn.y + tn.h };
  }
}

function bz(p) {
  const dx = p.tx - p.fx, dy = p.ty - p.fy;
  let c1x, c1y, c2x, c2y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    c1x = p.fx + dx * .45; c1y = p.fy;
    c2x = p.tx - dx * .45; c2y = p.ty;
  } else {
    c1x = p.fx; c1y = p.fy + dy * .45;
    c2x = p.tx; c2y = p.ty - dy * .45;
  }
  return `M${p.fx} ${p.fy}C${c1x} ${c1y} ${c2x} ${c2y} ${p.tx} ${p.ty}`;
}

function arrId(c) {
  if (c === C.tech)  return 'arr-c';
  if (c === C.macro) return 'arr-p';
  if (c === C.sent)  return 'arr-o';
  if (c === C.geo)   return 'arr-g';
  if (c === C.alpha) return 'arr-a';
  return 'arr-s';
}

// ── Render ────────────────────────────────────────────────────────────────

export function render() {
  ensureLayout();

  const world = document.getElementById('world');
  world.innerHTML = '';

  const nMap = {};
  N.forEach(n => nMap[n.id] = n);

  // Bounding boxes
  const bg = svgEl('g', {});
  _computedBoxes.forEach(b => {
    const r = svgEl('rect', {
      x: b.x, y: b.y, width: b.w, height: b.h, rx: 12,
      fill: 'rgba(0,0,0,0)', stroke: b.color,
      'stroke-width': 1.2, 'stroke-opacity': .28, 'stroke-dasharray': '7 4'
    });
    bg.appendChild(r);
    const t = svgEl('text', {
      x: b.x + b.w / 2, y: b.y - 8,
      'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700,
      'letter-spacing': 2, fill: b.color, opacity: .8, 'font-family': FONT
    });
    t.textContent = b.label;
    bg.appendChild(t);
  });
  world.appendChild(bg);

  // Edges
  const eg = svgEl('g', {});
  E.forEach(e => {
    const fn = nMap[e.f], tn = nMap[e.t];
    if (!fn || !tn) return;
    const path = svgEl('path', {
      d: bz(cp(fn, tn)), fill: 'none', stroke: e.c,
      'stroke-width': 1.4, 'stroke-opacity': .45,
      'marker-end': `url(#${arrId(e.c)})`
    });
    if (e.dsh) path.setAttribute('stroke-dasharray', '5 3');
    eg.appendChild(path);
  });
  world.appendChild(eg);

  // Nodes
  const ng = svgEl('g', {});
  N.forEach(n => {
    const g = svgEl('g', { cursor: 'pointer', 'data-id': n.id });
    const isColored = n.color !== C.src && n.color !== C.out;
    const isSignal  = n.id.endsWith('_signal') || n.id === 'coord_report' || n.id === 'report_json' || n.id === 'react_dash' || n.id === 'user_mt5';

    const r = svgEl('rect', {
      x: n.x, y: n.y, width: n.w, height: n.h, rx: 7,
      fill: isColored ? '#0c0c1e' : '#0a0a18',
      stroke: n.color,
      'stroke-width':   isColored ? (isSignal ? 2 : 1.5) : .8,
      'stroke-opacity': isColored ? (isSignal ? .9 : .65) : .35
    });
    g.appendChild(r);

    if (isColored) {
      g.appendChild(svgEl('rect', {
        x: n.x + 1, y: n.y + 1, width: n.w - 2, height: 2.5,
        rx: 6, fill: n.color, opacity: .55
      }));
    }

    const hasS = !!n.sub;
    const lbl = svgEl('text', {
      x: n.x + 9, y: n.y + (hasS ? n.h / 2 - 7 : n.h / 2 + 5),
      'dominant-baseline': 'middle',
      'font-size':   isColored ? 13 : 12,
      'font-weight': isColored ? 600 : 500,
      fill: isColored ? n.color : '#64748b',
      'font-family': FONT
    });
    lbl.textContent = n.label;
    g.appendChild(lbl);

    if (hasS) {
      const sub = svgEl('text', {
        x: n.x + 9, y: n.y + n.h / 2 + 11,
        'dominant-baseline': 'middle',
        'font-size': 12, fill: '#4e6680', 'font-family': FONT
      });
      sub.textContent = n.sub;
      g.appendChild(sub);
    }

    g.addEventListener('mouseenter', () => {
      r.setAttribute('stroke-opacity', '1');
      if (isColored) r.setAttribute('fill', '#101028');
    });
    g.addEventListener('mouseleave', () => {
      r.setAttribute('stroke-opacity', isColored ? (isSignal ? .9 : .65) : .35);
      if (isColored) r.setAttribute('fill', '#0c0c1e');
    });

    g.addEventListener('click', () => showPanel(n.id, n.color));
    ng.appendChild(g);
  });
  world.appendChild(ng);
}
