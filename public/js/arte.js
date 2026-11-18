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

// ---------- fundo em camadas (estilo cenário de anime: pintado, suave, com névoa e luz) ----------
export function criarFundo(bioma, larg, alt, semente) {
  const r = rng(semente + 7);
  const L = Math.max(1400, Math.ceil(larg * 1.3));
  const camadas = [];
  const ceuMeio = bioma.ceu[1], horizonte = bioma.ceu[2];
  const nevoa = (cor, a) => rgba(mistura(cor, horizonte, 0.5), a);

  // céu com degradê, estrelas, lua e nuvens macias
  const ceu = tela(larg, alt), c0 = ceu.getContext('2d');
  const g = c0.createLinearGradient(0, 0, 0, alt);
  g.addColorStop(0, bioma.ceu[0]); g.addColorStop(0.45, ceuMeio); g.addColorStop(0.85, horizonte); g.addColorStop(1, mistura(horizonte, '#ffffff', 0.15));
  c0.fillStyle = g; c0.fillRect(0, 0, larg, alt);
  for (let i = 0; i < 160; i++) {
    const y = r() * alt * 0.55;
    c0.globalAlpha = (0.2 + r() * 0.8) * (1 - y / (alt * 0.6));
    c0.fillStyle = '#fff'; const s = r() < 0.93 ? 1 : 2; c0.fillRect(r() * larg, y, s, s);
  }
  c0.globalAlpha = 1;
  const lx = larg * 0.74, ly = alt * 0.2, lr = alt * 0.1;
  c0.globalCompositeOperation = 'lighter';
  c0.drawImage(brilho(rgba(bioma.luz, 0.45), 128), lx - lr * 4, ly - lr * 4, lr * 8, lr * 8);
  c0.globalCompositeOperation = 'source-over';
  const gl = c0.createRadialGradient(lx - lr * 0.35, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
  gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.7, mistura('#ffffff', bioma.cristal[0], 0.4)); gl.addColorStop(1, bioma.cristal[0]);
  c0.fillStyle = gl; c0.beginPath(); c0.arc(lx, ly, lr, 0, 7); c0.fill();
  // nuvens: bolinhas sobrepostas com topo iluminado
  const nuvem = (cx, cy, w, h, cor, a) => {
    c0.save(); c0.globalAlpha = a;
    for (let i = 0; i < 9; i++) {
      const bx = cx + (r() - 0.5) * w, by = cy + (r() - 0.3) * h * 0.5, br = h * (0.35 + r() * 0.4);
      const gg = c0.createRadialGradient(bx, by - br * 0.4, br * 0.1, bx, by, br);
      gg.addColorStop(0, mistura(cor, '#ffffff', 0.35)); gg.addColorStop(0.6, cor); gg.addColorStop(1, rgba(cor, 0));
      c0.fillStyle = gg; c0.beginPath(); c0.arc(bx, by, br, 0, 7); c0.fill();
    }
    c0.restore();
  };
  for (let i = 0; i < 6; i++) nuvem(r() * larg, alt * (0.25 + r() * 0.35), larg * (0.15 + r() * 0.2), alt * (0.06 + r() * 0.06), mistura(ceuMeio, bioma.luz, 0.35), 0.35 + r() * 0.25);
  camadas.push({ cv: ceu, par: 0, fixo: true });

  // camada distante: penhascos e castelo, bem enevoados
  const m = tela(L, alt), c1 = m.getContext('2d');
  const perfil = (base, amp, passo, cor, ctx = c1) => {
    ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(0, alt);
    let y = base - r() * amp; const y0 = y;
    for (let x = 0; x <= L; x += passo) { y = x >= L - passo ? y0 : base - r() * amp; ctx.lineTo(x, y); }
    ctx.lineTo(L, alt); ctx.closePath(); ctx.fill();
  };
  perfil(alt * 0.6, alt * 0.2, 110, mistura(ceuMeio, horizonte, 0.65));
  const cx = L * (0.3 + r() * 0.4), cb = alt * 0.58;
  const corCastelo = mistura(ceuMeio, horizonte, 0.45);
  c1.fillStyle = corCastelo;
  for (let i = -3; i <= 3; i++) {
    const tw = 16 + r() * 14, th = 80 + r() * 120 - Math.abs(i) * 18, tx = cx + i * 34;
    c1.fillRect(tx - tw / 2, cb - th, tw, th + 40);
    c1.beginPath(); c1.moveTo(tx - tw / 2 - 5, cb - th); c1.lineTo(tx, cb - th - 40 - r() * 30); c1.lineTo(tx + tw / 2 + 5, cb - th); c1.fill();
  }
  c1.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { const wx = cx - 100 + r() * 200, wy = cb - 20 - r() * 140; c1.drawImage(brilho(rgba(bioma.luz, 0.8), 16), wx - 6, wy - 6, 12, 12); }
  c1.globalCompositeOperation = 'source-over';
  // faixa de névoa sobre a base
  let gn = c1.createLinearGradient(0, alt * 0.45, 0, alt * 0.8);
  gn.addColorStop(0, nevoa(horizonte, 0)); gn.addColorStop(1, nevoa(horizonte, 0.75));
  c1.fillStyle = gn; c1.fillRect(0, alt * 0.45, L, alt * 0.55);
  perfil(alt * 0.76, alt * 0.12, 80, mistura(bioma.ceu[0], ceuMeio, 0.55));
  camadas.push({ cv: m, par: 0.08, L });

  // pilares de cristal gigantes, translúcidos, com brilho por dentro
  const p = tela(L, alt), c2 = p.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const x = (i + r() * 0.6) * L / 8, h = alt * (0.4 + r() * 0.5), w = 34 + r() * 60;
    c2.globalAlpha = 0.28 + r() * 0.2;
    for (const dx of [0, -L, L]) cristal(c2, x + dx, alt * 1.02, h, w, bioma.cristal, (r() - 0.5) * 0.25, 0.8);
    c2.globalAlpha = 0.25; c2.globalCompositeOperation = 'lighter';
    for (const dx of [0, -L, L]) c2.drawImage(brilho(rgba(bioma.luz, 0.6), 64), x + dx - w, alt - h * 0.7, w * 2, h * 0.7);
    c2.globalCompositeOperation = 'source-over';
  }
  c2.globalAlpha = 1;
  gn = c2.createLinearGradient(0, alt * 0.55, 0, alt);
  gn.addColorStop(0, nevoa(horizonte, 0)); gn.addColorStop(1, nevoa(horizonte, 0.55));
  c2.fillStyle = gn; c2.fillRect(0, alt * 0.55, L, alt * 0.45);
  camadas.push({ cv: p, par: 0.2, L });

  // arcos góticos próximos, escuros mas com borda iluminada (luz de contorno)
  const a = tela(L, alt), c3 = a.getContext('2d');
  const escuro = mistura(bioma.pedra[1], bioma.ceu[0], 0.5);
  const nA = 4;
  for (let i = 0; i < nA; i++) {
    const x = i * L / nA, w = L / nA;
    const forma = () => {
      c3.beginPath();
      c3.rect(x, alt * 0.05, 34, alt);
      c3.moveTo(x, alt * 0.05); c3.lineTo(x + w, alt * 0.05); c3.lineTo(x + w, alt * 0.2);
      c3.quadraticCurveTo(x + w / 2 + 17, alt * 0.04, x + 34, alt * 0.2); c3.closePath();
    };
    c3.fillStyle = escuro; forma(); c3.fill();
    c3.strokeStyle = rgba(bioma.luz, 0.35); c3.lineWidth = 2; c3.beginPath(); c3.moveTo(x + 34, alt * 0.2); c3.lineTo(x + 34, alt); c3.stroke();
    c3.save(); c3.globalCompositeOperation = 'lighter'; c3.globalAlpha = 0.35;
    c3.drawImage(brilho(rgba(bioma.luz, 0.9), 48), x + w / 2 - 20, alt * 0.22, 70, 90);
    c3.fillStyle = rgba(bioma.cristal[0], 0.5); c3.beginPath(); c3.ellipse(x + w / 2 + 17, alt * 0.3, 13, 24, 0, 0, 7); c3.fill();
    c3.restore();
  }
  c3.fillStyle = escuro; c3.fillRect(0, 0, L, alt * 0.05);
  camadas.push({ cv: a, par: 0.45, L, alpha: 0.55 });

  // raios de luz diagonais (desenhados por cima de tudo, bem sutis)
  const raios = tela(larg, alt), c4 = raios.getContext('2d');
  c4.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x0 = larg * (0.1 + i * 0.2 + r() * 0.1), w = 40 + r() * 90;
    const gr = c4.createLinearGradient(x0, 0, x0 - alt * 0.5, alt);
    gr.addColorStop(0, rgba(bioma.luz, 0.22)); gr.addColorStop(1, rgba(bioma.luz, 0));
    c4.fillStyle = gr; c4.beginPath(); c4.moveTo(x0, 0); c4.lineTo(x0 + w, 0); c4.lineTo(x0 + w - alt * 0.55, alt); c4.lineTo(x0 - alt * 0.55, alt); c4.closePath(); c4.fill();
  }
  camadas.raios = raios;
  // partículas desfocadas (bokeh) — posições fixas, desenhadas com paralaxe
  camadas.bokeh = Array.from({ length: 34 }, () => ({ x: r(), y: r(), r: 3 + r() * 12, par: 0.3 + r() * 0.9, v: r() * 6, cor: r() < 0.5 ? bioma.luz : bioma.cristal[0] }));
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
// por cima do mundo: raios de luz e partículas brilhando
export function desenharAtmosfera(c, camadas, camX, camY, larg, alt, t) {
  if (!camadas.raios) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.6);
  c.drawImage(camadas.raios, -((camX * 0.05) % larg), 0, larg, alt);
  c.drawImage(camadas.raios, larg - ((camX * 0.05) % larg), 0, larg, alt);
  const esc = alt / 640;
  for (const b of camadas.bokeh) {
    const x = (((b.x * larg * 1.5 - camX * b.par * 0.6 + Math.sin(t * 0.3 + b.v) * 30) % (larg * 1.5)) + larg * 1.5) % (larg * 1.5) - larg * 0.25;
    const y = (((b.y * alt - t * 8 * b.par * esc - camY * b.par * 0.3) % alt) + alt) % alt;
    c.globalAlpha = 0.18 + 0.15 * Math.sin(t * 1.5 + b.v * 3);
    const rr = b.r * esc * (0.6 + b.par * 0.6);
    c.drawImage(brilho(rgba(b.cor, 0.9), 32), x - rr, y - rr, rr * 2, rr * 2);
  }
  c.restore();
}

export function mistura(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// ---------- blocos ----------
export function criarBlocos(bioma, s) {
  const S = Math.ceil(T * s);
  const mk = (fn, w = 1, h = 1) => { const cv = tela(S * w, S * h), c = cv.getContext('2d'); c.scale(S / T, S / T); fn(c); return cv; };
  const r = rng(91);
  // textura de pedra contínua (4x4 blocos, emenda sem costura): manchas suaves, rachaduras finas e veios de cristal
  const N = 4, TT = T * N;
  const textura = mk(c => {
    const g = c.createLinearGradient(0, 0, TT, TT);
    g.addColorStop(0, bioma.pedra[2]); g.addColorStop(0.5, mistura(bioma.pedra[2], bioma.pedra[0], 0.5)); g.addColorStop(1, bioma.pedra[2]);
    c.fillStyle = g; c.fillRect(0, 0, TT, TT);
    const mancha = (x, y, rad, cor, a) => {
      for (const dx of [-TT, 0, TT]) for (const dy of [-TT, 0, TT]) {
        const gg = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        gg.addColorStop(0, rgba(cor, a)); gg.addColorStop(1, rgba(cor, 0));
        c.fillStyle = gg; c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    };
    for (let i = 0; i < 14; i++) mancha(r() * TT, r() * TT, 30 + r() * 60, bioma.pedra[0], 0.35);
    for (let i = 0; i < 8; i++) mancha(r() * TT, r() * TT, 20 + r() * 40, mistura(bioma.pedra[2], '#ffffff', 0.2), 0.25);
    // rachaduras
    c.strokeStyle = rgba(bioma.pedra[1], 0.3); c.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let x = r() * TT, y = r() * TT; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += r() * 26; c.lineTo(x, y); }
      c.stroke();
    }
    // veios de cristal brilhando
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      let x = r() * TT, y = r() * TT;
      c.strokeStyle = rgba(bioma.cristal[1], 0.6); c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (r() - 0.3) * 30; y -= r() * 20; c.lineTo(x, y); }
      c.stroke();
      c.drawImage(brilho(rgba(bioma.luz, 0.5), 32), x - 18, y - 18, 36, 36);
    }
    c.restore();
  }, N, N);
  const fundoEscuro = mk(c => {
    const g = c.createLinearGradient(0, 0, 0, T);
    const e = mistura(bioma.pedra[1], '#000000', 0.25);
    g.addColorStop(0, e); g.addColorStop(1, mistura(e, bioma.pedra[0], 0.2));
    c.fillStyle = g; c.fillRect(0, 0, T, T);
  });
  // borda de cima: luz de contorno + musgo de cristal com lâminas
  const topo = mk(c => {
    const g = c.createLinearGradient(0, 0, 0, 18);
    g.addColorStop(0, rgba(bioma.topo, 0.95)); g.addColorStop(0.35, rgba(bioma.topo, 0.55)); g.addColorStop(1, rgba(bioma.topo, 0));
    c.fillStyle = g; c.fillRect(0, 0, T, 18);
    c.fillStyle = mistura(bioma.topo, '#ffffff', 0.45); c.fillRect(0, 0, T, 2);
    c.fillStyle = bioma.topo;
    for (let x = 1; x < T; x += 4) { const h = 3 + ((x * 37) % 7); c.beginPath(); c.moveTo(x, 1); c.lineTo(x + 1.5, -h * 0.2); c.lineTo(x + 3, 1); c.fill(); }
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
    c.drawImage(brilho(rgba(bioma.luz, 0.6), 32), -10, -14, T + 20, 26); c.restore();
  });
  const lado = mk(c => {
    const g = c.createLinearGradient(0, 0, 14, 0);
    g.addColorStop(0, rgba(bioma.luz, 0.25)); g.addColorStop(0.15, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 14, T);
  });
  const baixo = mk(c => {
    const g = c.createLinearGradient(0, T, 0, T - 16);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, T - 16, T, 16);
  });
  const plataforma = mk(c => {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.drawImage(brilho(rgba(bioma.luz, 0.7), 32), -6, -4, T + 12, 26); c.restore();
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, mistura(bioma.cristal[0], '#ffffff', 0.3)); g.addColorStop(0.4, bioma.cristal[1]); g.addColorStop(1, rgba(bioma.cristal[2], 0.6));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(T, 2); c.lineTo(T, 10); c.lineTo(T * 0.75, 15); c.lineTo(T / 2, 10); c.lineTo(T / 4, 16); c.lineTo(0, 10); c.closePath(); c.fill();
    c.fillStyle = '#f4dc8a'; c.fillRect(0, 0, T, 2.5);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, 2.5, T, 1);
  });
  const espinhos = mk(c => {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.drawImage(brilho('rgba(255,80,110,.6)', 32), -6, T - 30, T + 12, 34); c.restore();
    for (let i = 0; i < 4; i++) cristal(c, 6 + i * 12, T, 22 + ((i * 13) % 14), 10, bioma.cristal, (i % 2 ? 0.15 : -0.12));
  });
  return { textura, N, S, fundoEscuro, topo, lado, baixo, plataforma, espinhos };
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
