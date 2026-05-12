import { render }                    from './lib/renderer.js';
import { initPanZoom, fitAll, zoomBy } from './lib/pan-zoom.js';
import { initPanel, dismissPanel }     from './lib/panel.js';

const svg      = document.getElementById('svg-wrap');
const world    = document.getElementById('world');
const panel    = document.getElementById('panel');
const pcontent = document.getElementById('pcontent');
const pclose   = document.getElementById('pclose');
const hint     = document.getElementById('hint');

render();
initPanel(panel, pcontent, pclose);
initPanZoom(svg, world, dismissPanel);
fitAll();

document.getElementById('zoom-in').onclick  = () => zoomBy(.18);
document.getElementById('zoom-fit').onclick = () => fitAll();
document.getElementById('zoom-out').onclick = () => zoomBy(-.18);

hint.style.transition = 'opacity 1s';
setTimeout(() => { if (hint) hint.style.opacity = '0'; }, 4000);
