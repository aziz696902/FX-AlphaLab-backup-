import { DETAILS } from '../data/details.js';

let _panel    = null;
let _pcontent = null;

export function initPanel(panel, pcontent, pclose) {
  _panel    = panel;
  _pcontent = pcontent;
  pclose.onclick = () => _panel.classList.remove('open');
}

export function showPanel(id, color) {
  const d = DETAILS[id];
  if (!d) return;

  let mHtml = '';
  if (d.metrics && d.metrics.length) {
    mHtml = `<div class="p-div"></div>
      <div class="p-section">Details</div>
      <div class="p-metrics-box" style="border:1px solid rgba(255,255,255,.05);border-radius:7px;overflow:hidden">
        ${d.metrics.map(m => `<div class="p-metric">
          <span class="p-ml">${m.l}</span>
          <span class="p-mv" style="color:${color}">${m.v}</span>
        </div>`).join('')}
      </div>`;
  }

  _pcontent.innerHTML = `
    <div class="p-tag" style="background:${color}18;color:${color}">${d.tag}</div>
    <div class="p-title">${d.title}</div>
    <div class="p-sub">${d.sub}</div>
    <div class="p-div"></div>
    <div class="p-section">Description</div>
    <div class="p-desc">${d.desc}</div>
    ${mHtml}`;

  _panel.classList.add('open');
}

export function dismissPanel() {
  if (_panel) _panel.classList.remove('open');
}
