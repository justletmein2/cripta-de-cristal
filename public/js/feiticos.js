// Feitiços desenhados do Mago/Maga no modo clássico (o reconhecimento do desenho é o mesmo do modo trilho)
//  ⚡ zigue-zague = RAIO em cadeia · ◯ círculo = PRISÃO DE GELO (congela) · 〰 linha = LANÇA DE FOGO (queima)
import { clamp, lerp, rng } from './util.js';
import { brilho, cristal } from './arte.js';
export { reconhecer, reamostrar } from './trilho.js';

export const FEIT = {
  raio: { nome: 'RAIO EM CADEIA', cd: 5, cor: '#9fe8ff', ic: '⚡' },
  gelo: { nome: 'PRISÃO DE GELO', cd: 6, cor: '#bff4ff', ic: '❄' },
  fogo: { nome: 'LANÇA DE FOGO', cd: 4, cor: '#ffa040', ic: '🔥' },
};

// o rastro do dedo/mouse enquanto desenha (em coordenadas de tela)
export function desenharRastro(c, pts, cor, alpha = 1) {
  if (pts.length < 2) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, cc] of [[18, 'rgba(160,120,255,.25)'], [7, cor], [2.5, '#ffffff']]) {
    c.strokeStyle = cc; c.lineWidth = w; c.beginPath();
    pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
  }
  const u = pts[pts.length - 1];
  c.drawImage(brilho('rgba(200,170,255,.9)', 32), u.x - 22, u.y - 22, 44, 44);
  c.restore();
}

// efeitos no mundo; devolve true se desenhou
export function desenharFxFeitico(c, f, t) {
  const k = f.t / f.dur;
  if (f.tipo === 'relampago') {
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    const pisca = k < 0.6 ? 1 : (Math.floor(f.t * 30) % 2 ? 0.3 : 1 - k);
    const zig = (a, b, amp) => { const n = 9, pts = [a]; for (let i = 1; i < n; i++) { const s = i / n; pts.push({ x: lerp(a.x, b.x, s) + (Math.random() - 0.5) * amp, y: lerp(a.y, b.y, s) + (Math.random() - 0.5) * amp }); } pts.push(b); return pts; };
    const linha = (pts, w, cor) => { c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); };
    const p0 = f.pts[0];
    const segs = [zig({ x: p0.x + (Math.random() - 0.5) * 60, y: p0.y - 520 }, p0, 70)];
    for (let i = 1; i < f.pts.length; i++) if (k > i * 0.05) segs.push(zig(f.pts[i - 1], f.pts[i], 46));
    c.globalAlpha = pisca;
    for (const sg of segs) { linha(sg, 16, 'rgba(120,200,255,.35)'); linha(sg, 5, '#9fe8ff'); linha(sg, 2, '#ffffff'); }
    for (const q of f.pts) c.drawImage(brilho('rgba(160,230,255,.9)', 48), q.x - 60, q.y - 60, 120, 120);
    c.restore(); return true;
  }
  if (f.tipo === 'geada') {
    c.save(); c.translate(f.x, f.y); c.globalAlpha = 1 - k;
    c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(170,230,255,.8)', 64), -f.r * 1.4, -f.r * 1.4, f.r * 2.8, f.r * 2.8);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#e8fbff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, f.r * (0.5 + k * 0.7), 0, 7); c.stroke();
    const r2 = rng(Math.floor(f.seed * 1e6));
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + r2() * 0.3, d = f.r * (0.6 + k * 0.6); c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + Math.PI / 2); cristal(c, 0, 10, 26 * (1 - k * 0.4), 7, ['#ffffff', '#bff4ff', '#4aa8d8'], 0); c.restore(); }
    c.restore(); return true;
  }
  if (f.tipo === 'floco') {
    c.save(); c.globalAlpha = 1 - k; c.fillStyle = '#e8fbff'; c.translate(f.x + f.vx * f.t, f.y + f.vy * f.t + 40 * f.t * f.t); c.rotate(f.t * 6);
    c.fillRect(-f.tam / 2, -0.8, f.tam, 1.6); c.fillRect(-0.8, -f.tam / 2, 1.6, f.tam);
    c.restore(); return true;
  }
  if (f.tipo === 'lanca') {
    const n = f.pts.length, cab = Math.min(n - 1, Math.floor(clamp(k / 0.35, 0, 1) * (n - 1)));
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalAlpha = 1 - clamp((k - 0.35) / 0.65, 0, 1);
    for (const [w, cor] of [[24, 'rgba(255,80,20,.35)'], [11, '#ff7a20'], [4, '#ffe08a']]) {
      c.strokeStyle = cor; c.lineWidth = w; c.beginPath();
      for (let i = 0; i <= cab; i++) { const q = f.pts[i], tw = Math.sin(t * 30 + i) * 3; i ? c.lineTo(q.x + tw, q.y - tw) : c.moveTo(q.x, q.y); }
      c.stroke();
    }
    const q = f.pts[cab], ant = f.pts[Math.max(0, cab - 1)], ang = Math.atan2(q.y - ant.y, q.x - ant.x);
    if (k < 0.4) { c.translate(q.x, q.y); c.rotate(ang); c.drawImage(brilho('rgba(255,160,60,.95)', 48), -50, -50, 100, 100); c.fillStyle = '#fff2c0'; c.beginPath(); c.moveTo(34, 0); c.lineTo(-10, -9); c.lineTo(-4, 0); c.lineTo(-10, 9); c.closePath(); c.fill(); }
    c.restore(); return true;
  }
  return false;
}

// monstro congelado (bloco de gelo) ou pegando fogo
export function desenharEstadoInimigo(c, en, t) {
  if (en.gelo > 0) {
    c.save(); c.translate(en.x, en.y);
    const w = en.w * 1.25 + 14, h = en.h * 1.08 + 10;
    c.globalAlpha = Math.min(1, en.gelo * 2) * 0.8;
    const g = c.createLinearGradient(-w / 2, -h, w / 2, 0); g.addColorStop(0, 'rgba(230,250,255,.75)'); g.addColorStop(1, 'rgba(110,190,240,.45)');
    c.fillStyle = g; c.strokeStyle = '#e8fbff'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + 4, -h * 0.8); c.lineTo(-w * 0.15, -h); c.lineTo(w * 0.3, -h * 0.94); c.lineTo(w / 2, -h * 0.7); c.lineTo(w / 2 - 3, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-w * 0.3, -h * 0.75); c.lineTo(-w * 0.12, -h * 0.4); c.moveTo(w * 0.2, -h * 0.85); c.lineTo(w * 0.32, -h * 0.6); c.stroke();
    c.restore();
  }
  if (en.queima > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const p = (t * 1.6 + i / 5 + en.id * 0.13) % 1;
      const x = en.x + Math.sin(i * 2.7 + en.id) * en.w * 0.4, y = en.y - en.h * 0.2 - p * en.h * 0.9;
      const r = (1 - p) * 16 + 6;
      c.globalAlpha = 1 - p;
      c.drawImage(brilho(p < 0.4 ? 'rgba(255,200,80,.9)' : 'rgba(255,90,20,.8)', 24), x - r, y - r, r * 2, r * 2);
    }
    c.restore();
  }
}
