let tx = 0, ty = 48, sc = 1;
let drag = false, lx = 0, ly = 0, mdx = 0, mdy = 0, lTD = null;
let _world = null;

function applyT() {
  _world.setAttribute('transform', `translate(${tx},${ty}) scale(${sc})`);
}

export function fitAll() {
  const vw = window.innerWidth, vh = window.innerHeight - 48;
  const WW = 1635, WH = 1525, pad = 36;
  sc = Math.min((vw - pad * 2) / WW, (vh - pad * 2) / WH);
  tx = (vw - WW * sc) / 2;
  ty = 48 + (vh - WH * sc) / 2;
  applyT();
}

export function zoomBy(d) {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const ns = Math.max(.18, Math.min(3, sc + d));
  tx = cx - (cx - tx) * (ns / sc);
  ty = cy - (cy - ty) * (ns / sc);
  sc = ns;
  applyT();
}

export function initPanZoom(svg, world, onBgClick) {
  _world = world;

  svg.addEventListener('mousedown', e => {
    drag = true; lx = e.clientX; ly = e.clientY;
    mdx = e.clientX; mdy = e.clientY;
    svg.classList.add('drag');
  });

  window.addEventListener('mousemove', e => {
    if (!drag) return;
    tx += e.clientX - lx; ty += e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    applyT();
  });

  window.addEventListener('mouseup', e => {
    if (drag && Math.hypot(e.clientX - mdx, e.clientY - mdy) < 5) {
      // was a click, not a drag — let bubble handle it
    }
    drag = false;
    svg.classList.remove('drag');
  });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const d = -e.deltaY * .0008;
    const ns = Math.max(.18, Math.min(3, sc + d * sc));
    tx = e.clientX - (e.clientX - tx) * (ns / sc);
    ty = e.clientY - (e.clientY - ty) * (ns / sc);
    sc = ns;
    applyT();
  }, { passive: false });

  // Touch — pan
  svg.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      drag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      lTD = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });

  svg.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag) {
      tx += e.touches[0].clientX - lx;
      ty += e.touches[0].clientY - ly;
      lx = e.touches[0].clientX; ly = e.touches[0].clientY;
      applyT();
    }
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lTD) {
        const ns = Math.max(.18, Math.min(3, sc * (d / lTD)));
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        tx = cx - (cx - tx) * (ns / sc);
        ty = cy - (cy - ty) * (ns / sc);
        sc = ns;
        applyT();
      }
      lTD = d;
    }
  }, { passive: false });

  svg.addEventListener('touchend', () => { drag = false; lTD = null; });

  // Dismiss panel on background click
  svg.addEventListener('click', e => {
    if (e.target === svg || e.target === world) onBgClick();
  });
}
