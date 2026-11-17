// Cenário: fundo em camadas, blocos, enfeites e o portal. Tudo desenhado por código (vetor, sem pixel art).
import { T, rng, tela, hash } from './util.js';

// ---------- cristal genérico ----------
export function cristal(c, x, y, h, w, cores, ang = 0, brilho = 1) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const g = c.createLinearGradient(-w, 0, w, -h);
  g.addColorStop(0, cores[2]); g.addColorStop(0.5, cores[1]); g.addColorStop(1, cores[0]);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h * 0.72); c.lineTo(0, -h); c.lineTo(w / 2, -h * 0.72); c.lineTo(w / 2, 0); c.closePath(); c.fill();
  // faceta clara
  c.globalAlpha = 0.55 * brilho; c.fillStyle = cores[0];
  c.beginPath(); c.moveTo(-w / 2, -h * 0.72); c.lineTo(0, -h); c.lineTo(0, 0); c.lineTo(-w / 6, 0); c.closePath(); c.fill();
  c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = Math.max(1, w * 0.06);
  c.beginPath(); c.moveTo(0, -h); c.lineTo(0, 0); c.stroke();
  c.restore();
}

// brilho redondo pronto (desenhado uma vez, usado com "lighter")
const brilhos = new Map();
export function brilho(cor, r = 64) {
  const k = cor + r;
  if (!brilhos.has(k)) {
    const cv = tela(r * 2, r * 2), c = cv.getContext('2d');
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, cor); g.addColorStop(0.35, cor.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.4) + ')')); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, r * 2, r * 2);
    brilhos.set(k, cv);
  }
  return brilhos.get(k);
}
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// ---------- fundo em camadas ----------
export function criarFundo(bioma, larg, alt, semente) {
  const r = rng(semente + 7);
  const L = Math.max(1200, Math.ceil(larg * 1.2));
  const camadas = [];
  // céu
  const ceu = tela(larg, alt), c0 = ceu.getContext('2d');
  const g = c0.createLinearGradient(0, 0, 0, alt);
  g.addColorStop(0, bioma.ceu[0]); g.addColorStop(0.6, bioma.ceu[1]); g.addColorStop(1, bioma.ceu[2]);
  c0.fillStyle = g; c0.fillRect(0, 0, larg, alt);
  for (let i = 0; i < 140; i++) {
    c0.globalAlpha = 0.25 + r() * 0.7; c0.fillStyle = '#fff';
    const s = r() < 0.9 ? 1 : 2;
    c0.fillRect(r() * larg, r() * alt * 0.7, s, s);
  }
  c0.globalAlpha = 1;
  // lua grande
  const lx = larg * 0.72, ly = alt * 0.2, lr = alt * 0.11;
  c0.globalCompositeOperation = 'lighter';
  c0.drawImage(brilho(rgba(bioma.luz, 0.5), 128), lx - lr * 3, ly - lr * 3, lr * 6, lr * 6);
  c0.globalCompositeOperation = 'source-over';
  const gl = c0.createRadialGradient(lx - lr * 0.3, ly - lr * 0.3, lr * 0.1, lx, ly, lr);
  gl.addColorStop(0, '#ffffff'); gl.addColorStop(1, bioma.cristal[0]);
  c0.fillStyle = gl; c0.beginPath(); c0.arc(lx, ly, lr, 0, 7); c0.fill();
  c0.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 5; i++) { c0.beginPath(); c0.arc(lx + (r() - 0.5) * lr, ly + (r() - 0.5) * lr, lr * (0.1 + r() * 0.15), 0, 7); c0.fill(); }
  camadas.push({ cv: ceu, par: 0, fixo: true });

  // montanhas e castelo distante
  const m = tela(L, alt), c1 = m.getContext('2d');
  c1.fillStyle = bioma.ceu[1];
  c1.globalAlpha = 0.9;
  const perfil = (base, amp, passo, cor) => {
    c1.fillStyle = cor; c1.beginPath(); c1.moveTo(0, alt);
    const pts = [];
    for (let x = 0; x <= L; x += passo) pts.push([x, base - r() * amp]);
    pts[pts.length - 1][1] = pts[0][1];
    pts.forEach(([x, y]) => c1.lineTo(x, y));
    c1.lineTo(L, alt); c1.closePath(); c1.fill();
  };
  perfil(alt * 0.62, alt * 0.22, 90, mistura(bioma.ceu[1], bioma.ceu[2], 0.5));
  // castelo
  const cx = L * (0.3 + r() * 0.4), cb = alt * 0.6;
  c1.fillStyle = mistura(bioma.ceu[0], bioma.ceu[1], 0.6);
  for (let i = -3; i <= 3; i++) {
    const tw = 18 + r() * 14, th = 80 + r() * 120 - Math.abs(i) * 18;
    const tx = cx + i * 34;
    c1.fillRect(tx - tw / 2, cb - th, tw, th + 40);
    c1.beginPath(); c1.moveTo(tx - tw / 2 - 5, cb - th); c1.lineTo(tx, cb - th - 40 - r() * 30); c1.lineTo(tx + tw / 2 + 5, cb - th); c1.fill();
  }
  c1.fillStyle = rgba(bioma.luz, 0.8);
  for (let i = 0; i < 14; i++) c1.fillRect(cx - 100 + r() * 200, cb - 20 - r() * 140, 3, 5);
  perfil(alt * 0.78, alt * 0.16, 70, mistura(bioma.ceu[0], bioma.ceu[1], 0.7));
  camadas.push({ cv: m, par: 0.08, L });

  // grandes pilares de cristal
  const p = tela(L, alt), c2 = p.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = (i + r() * 0.6) * L / 9, h = alt * (0.35 + r() * 0.5), w = 28 + r() * 50;
    c2.globalAlpha = 0.35 + r() * 0.25;
    for (const dx of [0, -L, L]) cristal(c2, x + dx, alt * 1.02, h, w, bioma.cristal, (r() - 0.5) * 0.25, 0.6);
  }
  c2.globalAlpha = 1;
  camadas.push({ cv: p, par: 0.2, L });

  // arcos góticos escuros
  const a = tela(L, alt), c3 = a.getContext('2d');
  c3.fillStyle = mistura(bioma.pedra[1], '#000000', 0.35);
  const nA = 5;
  for (let i = 0; i < nA; i++) {
    const x = i * L / nA, w = L / nA;
    c3.fillRect(x, alt * 0.05, 30, alt);           // pilar
    c3.beginPath();
    c3.moveTo(x, alt * 0.05); c3.lineTo(x + w, alt * 0.05); c3.lineTo(x + w, alt * 0.18);
    c3.quadraticCurveTo(x + w / 2 + 15, alt * 0.06, x + 30, alt * 0.18); c3.closePath(); c3.fill();
    // janelinha com vitral
    c3.save(); c3.globalAlpha = 0.25; c3.fillStyle = bioma.luz;
    c3.beginPath(); c3.ellipse(x + w / 2 + 15, alt * 0.3, 16, 26, 0, 0, 7); c3.fill(); c3.restore();
  }
  c3.fillRect(0, 0, L, alt * 0.05);
  camadas.push({ cv: a, par: 0.45, L, alpha: 0.85 });
  return camadas;
}

export function desenharFundo(c, camadas, camX, camY, larg, alt, t) {
  for (const k of camadas) {
    if (k.fixo) { c.drawImage(k.cv, 0, 0, larg, alt); continue; }
    const off = ((camX * k.par) % k.L + k.L) % k.L;
    const dy = -camY * k.par * 0.15;
    c.globalAlpha = k.alpha || 1;
    for (let x = -off; x < larg; x += k.L) c.drawImage(k.cv, x, dy);
    c.globalAlpha = 1;
  }
}

export function mistura(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// ---------- blocos ----------
export function criarBlocos(bioma, s) {
  const S = Math.ceil(T * s);
  const mk = fn => { const cv = tela(S, S), c = cv.getContext('2d'); c.scale(S / T, S / T); fn(c); return cv; };
  const pedra = [];
  for (let v = 0; v < 4; v++) pedra.push(mk(c => {
    const g = c.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, bioma.pedra[2]); g.addColorStop(1, bioma.pedra[0]);
    c.fillStyle = g; c.fillRect(0, 0, T, T);
    c.strokeStyle = bioma.pedra[1]; c.lineWidth = 2;
    // tijolos
    const off = v % 2 ? T / 2 : 0;
    c.beginPath(); c.moveTo(0, T / 2); c.lineTo(T, T / 2);
    c.moveTo(off + T / 4, 0); c.lineTo(off + T / 4, T / 2); c.moveTo((off + T * 0.75) % T, T / 2); c.lineTo((off + T * 0.75) % T, T); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(2, 2, T - 4, 3);
    if (v === 3) { // veio de cristal
      c.strokeStyle = bioma.cristal[1]; c.lineWidth = 2.5; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(6, 40); c.lineTo(18, 28); c.lineTo(24, 33); c.lineTo(40, 14); c.stroke();
    }
  }));
  const fundoEscuro = mk(c => { c.fillStyle = mistura(bioma.pedra[1], '#000000', 0.25); c.fillRect(0, 0, T, T); });
  const topo = mk(c => {
    const g = c.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, bioma.topo); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, T, 14);
    c.fillStyle = bioma.topo;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(T, 0); c.lineTo(T, 4);
    for (let x = T; x >= 0; x -= 6) c.lineTo(x, 4 + ((x * 7) % 5));
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, T, 1.5);
  });
  const lado = mk(c => {
    const g = c.createLinearGradient(0, 0, 10, 0);
    g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 10, T);
  });
  const baixo = mk(c => {
    const g = c.createLinearGradient(0, T, 0, T - 12);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, T - 12, T, 12);
  });
  const plataforma = mk(c => {
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, bioma.cristal[0]); g.addColorStop(0.4, bioma.cristal[1]); g.addColorStop(1, bioma.cristal[2]);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(T, 2); c.lineTo(T, 12); c.lineTo(T * 0.75, 16); c.lineTo(T / 2, 12); c.lineTo(T / 4, 17); c.lineTo(0, 12); c.closePath(); c.fill();
    c.fillStyle = '#e8c76a'; c.fillRect(0, 0, T, 3);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, 3, T, 1);
  });
  const espinhos = mk(c => {
    for (let i = 0; i < 4; i++) cristal(c, 6 + i * 12, T, 22 + ((i * 13) % 14), 10, bioma.cristal, (i % 2 ? 0.15 : -0.12));
  });
  return { pedra, fundoEscuro, topo, lado, baixo, plataforma, espinhos };
}

// ---------- enfeites ----------
export function desenharEnfeite(c, e, bioma, t) {
  if (e.t === 'cristal') {
    const s = e.s;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2 + e.v * 9);
    c.drawImage(brilho(rgba(bioma.luz, 0.55), 64), e.x - 50 * s, e.y - 70 * s, 100 * s, 100 * s);
    c.restore();
    cristal(c, e.x - 9 * s, e.y + 2, 26 * s, 11 * s, bioma.cristal, -0.35);
    cristal(c, e.x + 9 * s, e.y + 2, 22 * s, 10 * s, bioma.cristal, 0.4);
    cristal(c, e.x, e.y + 2, 40 * s, 15 * s, bioma.cristal, 0.05);
  } else if (e.t === 'estalactite') {
    c.save(); c.translate(e.x, e.y); c.scale(1, -1);
    cristal(c, 0, 0, 34 * e.s, 13 * e.s, bioma.cristal, 0);
    cristal(c, 10 * e.s, 0, 18 * e.s, 8 * e.s, bioma.cristal, 0.2);
    c.restore();
  } else if (e.t === 'corrente') {
    c.strokeStyle = '#5c5670'; c.lineWidth = 3;
    const n = e.s * 6;
    for (let i = 0; i < n; i++) { c.beginPath(); c.ellipse(e.x + Math.sin(t + i * 0.2) * i * 0.3, e.y + i * 15, i % 2 ? 2 : 5, 8, 0, 0, 7); c.stroke(); }
  } else if (e.t === 'tocha') {
    c.fillStyle = '#3a3048'; c.fillRect(e.x - 4, e.y, 8, 26);
    c.fillStyle = '#c9a54a'; c.fillRect(e.x - 9, e.y - 4, 18, 6);
    c.save(); c.globalCompositeOperation = 'lighter';
    const f = 0.85 + 0.15 * Math.sin(t * 13 + e.x);
    c.drawImage(brilho(rgba(bioma.luz, 0.7), 64), e.x - 80 * f, e.y - 90 * f, 160 * f, 160 * f);
    c.fillStyle = bioma.cristal[0];
    c.beginPath(); c.moveTo(e.x - 8, e.y - 4); c.quadraticCurveTo(e.x - 6, e.y - 22 * f, e.x + Math.sin(t * 9) * 3, e.y - 30 * f); c.quadraticCurveTo(e.x + 6, e.y - 18, e.x + 8, e.y - 4); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(e.x, e.y - 9, 3, 7 * f, 0, 0, 7); c.fill();
    c.restore();
  } else if (e.t === 'estandarte') {
    c.fillStyle = '#c9a54a'; c.fillRect(e.x - 22, e.y - 3, 44, 5);
    const g = c.createLinearGradient(0, e.y, 0, e.y + 100);
    g.addColorStop(0, bioma.cristal[2]); g.addColorStop(1, mistura(bioma.cristal[2], '#000000', 0.5));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(e.x - 18, e.y);
    for (let i = 0; i <= 10; i++) c.lineTo(e.x - 18 + Math.sin(t * 2 + i) * 2, e.y + i * 9);
    c.lineTo(e.x, e.y + 82); c.lineTo(e.x + 18, e.y + 92); c.lineTo(e.x + 18, e.y); c.closePath(); c.fill();
    cristal(c, e.x, e.y + 55, 30, 14, bioma.cristal, 0);
  } else if (e.t === 'trono') {
    c.save(); c.globalAlpha = 0.55;
    const x = e.x, y = e.y;
    for (let i = -4; i <= 4; i++) cristal(c, x + i * 46, y, 260 - Math.abs(i) * 42, 40, bioma.cristal, i * 0.05, 0.7);
    c.restore();
  }
}

export function desenharPortal(c, p, bioma, t, ativo) {
  const x = p.x, y = p.y - 70;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho(rgba(bioma.luz, ativo ? 0.9 : 0.55), 96), x - 120, y - 120, 240, 240);
  c.globalCompositeOperation = 'source-over';
  // pedra em volta
  c.fillStyle = bioma.pedra[2]; c.strokeStyle = '#e8c76a'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, 46, 72, 0, 0, 7); c.fill(); c.stroke();
  // redemoinho
  const g = c.createRadialGradient(x, y, 4, x, y, 64);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, bioma.cristal[0]); g.addColorStop(1, bioma.cristal[2]);
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 36, 60, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    const a0 = t * 2 + i * 1.57;
    for (let k = 0; k < 20; k++) { const a = a0 + k * 0.25, rr = 4 + k * 1.7; c.lineTo(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr); }
    c.stroke();
  }
  // runas
  c.fillStyle = bioma.cristal[0];
  for (let i = 0; i < 8; i++) { const a = t * 0.6 + i * 0.785; c.fillRect(x + Math.cos(a) * 58 - 2, y + Math.sin(a) * 84 - 2, 4, 4); }
  c.restore();
}

export const varianteBloco = (x, y) => Math.floor(hash(x * 73 + y * 1999) * 4);
