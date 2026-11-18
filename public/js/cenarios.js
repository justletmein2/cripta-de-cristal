// Cenários temáticos: Castelo Gótico, Londres Vitoriana e Ruína Egípcia.
// Cada tema desenha 3 camadas de fundo (longe, meio, perto), o padrão dos blocos e os enfeites.
import { tela, rng } from './util.js';

// ---------- camadas de fundo ----------
export function camadasTema(tema, bioma, L, alt, r, A) {
  const { mistura, rgba, brilho } = A;
  const ceuMeio = bioma.ceu[1], hor = bioma.ceu[2];
  const nevoa = (a) => rgba(mistura(hor, '#ffffff', 0.1), a);
  const faixaNevoa = (c, y0, y1, a) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, nevoa(0)); g.addColorStop(1, nevoa(a)); c.fillStyle = g; c.fillRect(0, y0, L, y1 - y0); };
  const brilhinhos = (c, n, x0, x1, y0, y1, cor, tam = 12) => { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); c.drawImage(brilho(rgba(cor, 0.8), 16), x - tam / 2, y - tam / 2, tam, tam); } c.restore(); };
  const longe = tela(L, alt), c1 = longe.getContext('2d');
  const meio = tela(L, alt), c2 = meio.getContext('2d');
  const perto = tela(L, alt), c3 = perto.getContext('2d');
  const corLonge = mistura(ceuMeio, hor, 0.55), corMeio = mistura(bioma.ceu[0], ceuMeio, 0.6), corPerto = mistura(bioma.pedra[1], bioma.ceu[0], 0.5);

  if (tema === 'gotico') {
    // castelo do vampiro no alto de um penhasco, com muitas torres pontudas
    c1.fillStyle = corLonge;
    c1.beginPath(); c1.moveTo(0, alt); for (let x = 0; x <= L; x += 60) c1.lineTo(x, alt * (0.62 + 0.08 * Math.sin(x * 0.01) + r() * 0.04)); c1.lineTo(L, alt); c1.fill();
    const cx = L * 0.55, base = alt * 0.6;
    c1.beginPath(); c1.moveTo(cx - 220, alt); c1.lineTo(cx - 160, base); c1.lineTo(cx + 170, base); c1.lineTo(cx + 240, alt); c1.fill();
    const torres = [[-150, 120, 16], [-110, 190, 22], [-60, 150, 18], [-20, 260, 26], [30, 210, 20], [75, 160, 18], [120, 230, 22], [160, 130, 14]];
    for (const [dx, h, w] of torres) {
      const x = cx + dx;
      c1.fillRect(x - w / 2, base - h, w, h + 10);
      c1.beginPath(); c1.moveTo(x - w / 2 - 6, base - h); c1.lineTo(x, base - h - h * 0.45); c1.lineTo(x + w / 2 + 6, base - h); c1.fill();
    }
    c1.fillRect(cx - 160, base - 90, 330, 92);
    brilhinhos(c1, 26, cx - 150, cx + 170, base - 220, base - 20, '#ffcf7a', 10);
    // morcegos voando
    c1.fillStyle = corMeio;
    for (let i = 0; i < 14; i++) { const x = cx - 300 + r() * 600, y = alt * (0.1 + r() * 0.3), s = 3 + r() * 4; c1.beginPath(); c1.moveTo(x - s * 2, y); c1.quadraticCurveTo(x - s, y - s, x, y); c1.quadraticCurveTo(x + s, y - s, x + s * 2, y); c1.quadraticCurveTo(x, y + s * 0.4, x - s * 2, y); c1.fill(); }
    faixaNevoa(c1, alt * 0.5, alt * 0.85, 0.6);
    // meio: catedral com rosácea de vitral
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.2 + r() * 0.5) * L / 3, w = 160 + r() * 80, h = alt * (0.45 + r() * 0.2);
      c2.fillStyle = corMeio;
      c2.fillRect(x - w / 2, alt - h, w, h);
      c2.beginPath(); c2.moveTo(x - w / 2, alt - h); c2.lineTo(x, alt - h - w * 0.55); c2.lineTo(x + w / 2, alt - h); c2.fill();
      for (const s of [-1, 1]) { c2.fillRect(x + s * (w / 2 + 14) - 14, alt - h - 60, 28, h + 60); c2.beginPath(); c2.moveTo(x + s * (w / 2 + 14) - 18, alt - h - 60); c2.lineTo(x + s * (w / 2 + 14), alt - h - 150); c2.lineTo(x + s * (w / 2 + 14) + 18, alt - h - 60); c2.fill(); }
      const rx = x, ry = alt - h + 60, rr = w * 0.16;
      c2.save(); c2.globalCompositeOperation = 'lighter'; c2.drawImage(brilho(rgba(bioma.luz, 0.7), 64), rx - rr * 2.5, ry - rr * 2.5, rr * 5, rr * 5); c2.restore();
      for (let k = 0; k < 8; k++) { c2.fillStyle = ['#c41e3a', '#3b4fd6', '#e8a93a', '#7a2bd6'][k % 4]; c2.globalAlpha = 0.38; c2.beginPath(); c2.moveTo(rx, ry); c2.arc(rx, ry, rr, k * Math.PI / 4, (k + 1) * Math.PI / 4); c2.fill(); }
      c2.globalAlpha = 1; c2.strokeStyle = corMeio; c2.lineWidth = 3; c2.beginPath(); c2.arc(rx, ry, rr, 0, 7); c2.stroke();
      for (let k = 0; k < 4; k++) { c2.beginPath(); c2.moveTo(rx - rr * Math.cos(k * Math.PI / 4), ry - rr * Math.sin(k * Math.PI / 4)); c2.lineTo(rx + rr * Math.cos(k * Math.PI / 4), ry + rr * Math.sin(k * Math.PI / 4)); c2.stroke(); }
    }
    faixaNevoa(c2, alt * 0.6, alt, 0.45);
    // perto: arcos ogivais com vitrais vermelhos e cortinas
    for (let i = 0; i < 4; i++) {
      const x = i * L / 4, w = L / 4;
      c3.fillStyle = corPerto; c3.fillRect(x, 0, 40, alt);
      c3.beginPath(); c3.moveTo(x, 0); c3.lineTo(x + w, 0); c3.lineTo(x + w, alt * 0.24); c3.quadraticCurveTo(x + w * 0.55, alt * 0.02, x + 40, alt * 0.24); c3.closePath(); c3.fill();
      c3.fillStyle = 'rgba(120,10,30,.8)'; c3.beginPath(); c3.moveTo(x + 40, alt * 0.06); c3.quadraticCurveTo(x + 90, alt * 0.3, x + 50, alt * 0.55); c3.lineTo(x + 40, alt * 0.55); c3.fill();
      c3.save(); c3.globalCompositeOperation = 'lighter'; c3.globalAlpha = 0.5;
      c3.fillStyle = 'rgba(255,60,80,.6)'; c3.beginPath(); c3.ellipse(x + w / 2 + 20, alt * 0.3, 14, 32, 0, 0, 7); c3.fill();
      c3.drawImage(brilho(rgba(bioma.luz, 0.8), 48), x + w / 2 - 30, alt * 0.2, 100, 120); c3.restore();
    }
  } else if (tema === 'londres') {
    // Big Ben e silhueta da cidade
    c1.fillStyle = corLonge;
    let x = 0;
    while (x < L) { const w = 30 + r() * 70, h = alt * (0.15 + r() * 0.2); c1.fillRect(x, alt * 0.75 - h, w, h + alt * 0.3); if (r() < 0.4) { c1.beginPath(); c1.moveTo(x, alt * 0.75 - h); c1.lineTo(x + w / 2, alt * 0.75 - h - 30); c1.lineTo(x + w, alt * 0.75 - h); c1.fill(); } x += w; }
    const bx = L * 0.4, bb = alt * 0.62, bw = 46;
    c1.fillRect(bx - bw / 2, bb - alt * 0.45, bw, alt * 0.6);
    c1.fillRect(bx - bw / 2 - 6, bb - alt * 0.47, bw + 12, 16);
    c1.beginPath(); c1.moveTo(bx - bw / 2 - 6, bb - alt * 0.47); c1.lineTo(bx, bb - alt * 0.62); c1.lineTo(bx + bw / 2 + 6, bb - alt * 0.47); c1.fill();
    c1.fillRect(bx - 2, bb - alt * 0.7, 4, alt * 0.1);
    const ry = bb - alt * 0.4;
    c1.save(); c1.globalCompositeOperation = 'lighter'; c1.drawImage(brilho('rgba(255,220,140,.9)', 64), bx - 60, ry - 60, 120, 120); c1.restore();
    c1.fillStyle = '#f6e3a8'; c1.beginPath(); c1.arc(bx, ry, 18, 0, 7); c1.fill();
    c1.strokeStyle = corLonge; c1.lineWidth = 2; c1.beginPath(); c1.moveTo(bx, ry); c1.lineTo(bx, ry - 13); c1.moveTo(bx, ry); c1.lineTo(bx + 9, ry + 3); c1.stroke();
    brilhinhos(c1, 60, 0, L, alt * 0.45, alt * 0.75, '#ffcf7a', 8);
    faixaNevoa(c1, alt * 0.45, alt * 0.85, 0.75);
    // meio: telhados com chaminés soltando fumaça
    c2.fillStyle = corMeio;
    x = 0;
    while (x < L) {
      const w = 120 + r() * 120, h = alt * (0.22 + r() * 0.12), y = alt - h;
      c2.beginPath(); c2.moveTo(x, alt); c2.lineTo(x, y); c2.lineTo(x + w * 0.5, y - 50); c2.lineTo(x + w, y); c2.lineTo(x + w, alt); c2.fill();
      for (let k = 0; k < 2; k++) {
        const cxh = x + w * (0.25 + k * 0.45); c2.fillRect(cxh - 8, y - 70, 16, 60);
        c2.save(); c2.globalAlpha = 0.25; c2.fillStyle = '#c8d4cc';
        for (let f = 0; f < 5; f++) { c2.beginPath(); c2.arc(cxh + f * 10, y - 80 - f * 22, 10 + f * 5, 0, 7); c2.fill(); }
        c2.restore(); c2.fillStyle = corMeio;
      }
      c2.save(); c2.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) { const wx = x + 15 + r() * (w - 30), wy = y + 20 + r() * (h - 60); c2.fillStyle = 'rgba(255,200,110,.55)'; c2.fillRect(wx, wy, 10, 14); }
      c2.restore();
      x += w + 10;
    }
    faixaNevoa(c2, alt * 0.55, alt, 0.6);
    // perto: postes de gás e grades de ferro
    for (let i = 0; i < 5; i++) {
      const px = (i + 0.5) * L / 5;
      c3.fillStyle = corPerto; c3.fillRect(px - 3, alt * 0.3, 6, alt * 0.7);
      c3.fillRect(px - 10, alt * 0.3 - 26, 20, 26);
      c3.save(); c3.globalCompositeOperation = 'lighter'; c3.drawImage(brilho('rgba(255,210,120,.95)', 64), px - 70, alt * 0.3 - 80, 140, 120); c3.fillStyle = '#ffe2a0'; c3.fillRect(px - 7, alt * 0.3 - 22, 14, 18); c3.restore();
    }
    c3.strokeStyle = corPerto; c3.lineWidth = 3;
    for (let gx = 0; gx < L; gx += 18) { c3.beginPath(); c3.moveTo(gx, alt); c3.lineTo(gx, alt * 0.82); c3.stroke(); c3.beginPath(); c3.moveTo(gx - 4, alt * 0.82); c3.lineTo(gx, alt * 0.8); c3.lineTo(gx + 4, alt * 0.82); c3.fill(); }
    c3.fillRect(0, alt * 0.86, L, 4);
  } else if (tema === 'egito') {
    // pirâmides e dunas ao luar
    c1.fillStyle = mistura(corLonge, '#d9a066', 0.25);
    c1.beginPath(); c1.moveTo(0, alt); for (let x = 0; x <= L; x += 80) c1.lineTo(x, alt * (0.72 + 0.05 * Math.sin(x * 0.006 + 1))); c1.lineTo(L, alt); c1.fill();
    for (const [px, w, h] of [[0.2, 300, 0.32], [0.45, 420, 0.42], [0.72, 260, 0.28]]) {
      const x = L * px, base = alt * 0.74;
      c1.fillStyle = mistura(corLonge, '#e8c27a', 0.18); c1.beginPath(); c1.moveTo(x - w / 2, base); c1.lineTo(x, base - alt * h); c1.lineTo(x + w / 2, base); c1.fill();
      c1.fillStyle = mistura(corLonge, '#000000', 0.25); c1.beginPath(); c1.moveTo(x, base - alt * h); c1.lineTo(x + w / 2, base); c1.lineTo(x + w * 0.12, base); c1.fill();
      c1.save(); c1.globalCompositeOperation = 'lighter'; c1.drawImage(brilho('rgba(255,220,120,.8)', 32), x - 12, base - alt * h - 12, 24, 24); c1.restore();
    }
    faixaNevoa(c1, alt * 0.55, alt * 0.9, 0.5);
    // meio: obeliscos e estátuas de chacal
    for (let i = 0; i < 6; i++) {
      const x = (i + r() * 0.6) * L / 6, h = alt * (0.35 + r() * 0.25), w = 26 + r() * 14;
      c2.fillStyle = corMeio;
      if (i % 2) {
        c2.beginPath(); c2.moveTo(x - w / 2, alt); c2.lineTo(x - w * 0.38, alt - h); c2.lineTo(x, alt - h - w * 0.7); c2.lineTo(x + w * 0.38, alt - h); c2.lineTo(x + w / 2, alt); c2.fill();
        c2.save(); c2.globalCompositeOperation = 'lighter'; c2.fillStyle = rgba(bioma.luz, 0.4); for (let k = 0; k < 6; k++) c2.fillRect(x - 5, alt - h + 30 + k * 26, 10, 6); c2.restore();
      } else {
        // estátua sentada de chacal
        const b = alt, s = h / 260;
        c2.fillRect(x - 40 * s, b - 90 * s, 80 * s, 90 * s);
        c2.fillRect(x - 26 * s, b - 200 * s, 52 * s, 120 * s);
        c2.beginPath(); c2.moveTo(x - 20 * s, b - 200 * s); c2.lineTo(x - 14 * s, b - 250 * s); c2.lineTo(x - 4 * s, b - 214 * s); c2.lineTo(x + 6 * s, b - 214 * s); c2.lineTo(x + 14 * s, b - 250 * s); c2.lineTo(x + 20 * s, b - 200 * s); c2.lineTo(x + 50 * s, b - 196 * s); c2.lineTo(x + 20 * s, b - 180 * s); c2.closePath(); c2.fill();
        c2.save(); c2.globalCompositeOperation = 'lighter'; c2.drawImage(brilho(rgba(bioma.luz, 0.9), 16), x + 4 * s - 6, b - 206 * s - 6, 12, 12); c2.restore();
      }
    }
    faixaNevoa(c2, alt * 0.6, alt, 0.4);
    // perto: colunas com faixas de hieróglifos e braseiros
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.3) * L / 4, w = 54;
      c3.fillStyle = corPerto; c3.fillRect(x - w / 2, alt * 0.12, w, alt);
      c3.fillRect(x - w / 2 - 10, alt * 0.1, w + 20, 18);
      c3.fillStyle = rgba(bioma.cristal[0], 0.35);
      for (let k = 0; k < 7; k++) c3.fillRect(x - 12 + (k % 2) * 10, alt * 0.2 + k * 34, 10, 12);
      c3.save(); c3.globalCompositeOperation = 'lighter'; c3.drawImage(brilho('rgba(255,170,60,.9)', 64), x + 40, alt * 0.48, 90, 90); c3.restore();
    }
    c3.fillStyle = corPerto; c3.fillRect(0, 0, L, alt * 0.1);
  }
  return [{ cv: longe, par: 0.08, L }, { cv: meio, par: 0.2, L }, { cv: perto, par: 0.45, L, alpha: 0.55 }];
}

// ---------- padrão dos blocos (por cima da textura de pedra) ----------
export function padraoBlocos(c, tema, TT, bioma, A) {
  const { rgba, mistura } = A;
  const r = rng(tema.length * 77);
  if (tema === 'gotico') {
    // blocos grandes de cantaria com rejunte e musgo avermelhado
    c.strokeStyle = rgba(bioma.pedra[1], 0.7); c.lineWidth = 2.5;
    for (let y = 0; y < TT; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(TT, y); c.stroke(); for (let x = (y / 48) % 2 ? 48 : 0; x < TT; x += 96) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 48); c.stroke(); } }
    c.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < TT; y += 48) c.fillRect(0, y + 2, TT, 4);
  } else if (tema === 'londres') {
    // tijolinhos pequenos com rejunte claro
    c.strokeStyle = rgba(mistura(bioma.pedra[2], '#ffffff', 0.25), 0.35); c.lineWidth = 1.5;
    for (let y = 0; y < TT; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(TT, y); c.stroke(); for (let x = (y / 16) % 2 ? 16 : 0; x < TT; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } }
    for (let i = 0; i < 40; i++) { c.fillStyle = rgba(r() < 0.5 ? '#000000' : '#ffffff', 0.06); c.fillRect(Math.floor(r() * 6) * 32 + ((Math.floor(r() * 12) % 2) * 16), Math.floor(r() * 12) * 16, 32, 16); }
  } else if (tema === 'egito') {
    // blocos de arenito e hieróglifos entalhados
    c.strokeStyle = rgba(bioma.pedra[1], 0.5); c.lineWidth = 2;
    for (let y = 0; y < TT; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(TT, y); c.stroke(); for (let x = (y / 64) % 2 ? 48 : 0; x < TT; x += 96) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); } }
    c.strokeStyle = rgba(bioma.pedra[1], 0.45); c.lineWidth = 2;
    const glifo = (x, y, k) => {
      c.beginPath();
      if (k === 0) { c.arc(x, y - 4, 4, 0, 7); c.moveTo(x, y); c.lineTo(x, y + 10); c.moveTo(x - 5, y + 3); c.lineTo(x + 5, y + 3); }      // ankh
      else if (k === 1) { c.ellipse(x, y + 3, 8, 4, 0, 0, 7); c.moveTo(x - 2, y + 3); c.arc(x - 2, y + 3, 2, 0, 7); }                     // olho
      else if (k === 2) { c.moveTo(x - 6, y + 8); c.lineTo(x, y - 6); c.lineTo(x + 6, y + 8); c.closePath(); }                              // pirâmide
      else { c.moveTo(x - 7, y); c.quadraticCurveTo(x, y - 8, x + 7, y); c.moveTo(x - 7, y + 6); c.quadraticCurveTo(x, y - 2, x + 7, y + 6); } // água
      c.stroke();
    };
    for (let i = 0; i < 18; i++) glifo(14 + r() * (TT - 28), 14 + r() * (TT - 28), Math.floor(r() * 4));
  }
}

// ---------- espinhos de cada tema ----------
export function espinhosTema(c, tema, T, bioma) {
  if (tema === 'gotico' || tema === 'londres') {
    // estacas de ferro
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 10, h = 24 + ((i * 11) % 10);
      const g = c.createLinearGradient(x, 0, x + 6, 0); g.addColorStop(0, '#9aa0b5'); g.addColorStop(1, '#4a4e60');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, T); c.lineTo(x + 3, T - h); c.lineTo(x + 6, T); c.fill();
      if (tema === 'gotico') { c.fillStyle = '#8a1020'; c.beginPath(); c.moveTo(x + 1.5, T - h * 0.55); c.lineTo(x + 3, T - h); c.lineTo(x + 4.5, T - h * 0.55); c.fill(); }
    }
    c.fillStyle = '#3a3c4a'; c.fillRect(0, T - 4, T, 4);
    return true;
  }
  if (tema === 'egito') {
    // estacas de pedra com pontas douradas
    for (let i = 0; i < 4; i++) { const x = 4 + i * 12, h = 22 + ((i * 13) % 12); c.fillStyle = '#b08a52'; c.beginPath(); c.moveTo(x, T); c.lineTo(x + 4, T - h); c.lineTo(x + 8, T); c.fill(); c.fillStyle = '#ffd86b'; c.beginPath(); c.moveTo(x + 2.5, T - h * 0.7); c.lineTo(x + 4, T - h); c.lineTo(x + 5.5, T - h * 0.7); c.fill(); }
    return true;
  }
  return false;
}

// ---------- enfeites ----------
export function enfeiteTema(c, e, bioma, t, A) {
  const tema = bioma.tema;
  if (!tema || tema === 'cristal') return false;
  const { brilho, rgba } = A;
  const chama = (x, y, s, cor = 'rgba(255,170,60,.9)') => {
    const f = 0.85 + 0.15 * Math.sin(t * 13 + x);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho(cor, 32), x - 40 * s * f, y - 50 * s * f, 80 * s * f, 80 * s * f);
    c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(x - 4 * s, y); c.quadraticCurveTo(x - 3 * s, y - 12 * s * f, x + Math.sin(t * 9 + x) * 2, y - 18 * s * f); c.quadraticCurveTo(x + 3 * s, y - 10 * s, x + 4 * s, y); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 4 * s, 1.5 * s, 4 * s * f, 0, 0, 7); c.fill();
    c.restore();
  };
  if (e.t === 'cristal') {
    // enfeite de chão
    const s = e.s, v = e.v;
    if (tema === 'gotico') {
      if (v < 0.5) { // candelabro de chão
        c.fillStyle = '#3a3040'; c.fillRect(e.x - 2, e.y - 40 * s, 4, 40 * s); c.fillRect(e.x - 14 * s, e.y - 40 * s, 28 * s, 3);
        c.fillRect(e.x - 8 * s, e.y - 3, 16 * s, 3);
        for (const dx of [-12, 0, 12]) { c.fillStyle = '#efe6d0'; c.fillRect(e.x + dx * s - 2, e.y - 50 * s, 4, 10 * s); chama(e.x + dx * s, e.y - 50 * s, 0.7 * s); }
      } else { // lápide
        c.fillStyle = '#3d3846'; c.beginPath(); c.moveTo(e.x - 12 * s, e.y); c.lineTo(e.x - 12 * s, e.y - 24 * s); c.arc(e.x, e.y - 24 * s, 12 * s, Math.PI, 0); c.lineTo(e.x + 12 * s, e.y); c.fill();
        c.fillStyle = '#26222e'; c.fillRect(e.x - 1.5, e.y - 30 * s, 3, 14 * s); c.fillRect(e.x - 6 * s, e.y - 26 * s, 12 * s, 3);
      }
    } else if (tema === 'londres') {
      if (v < 0.5) { // caixote
        c.fillStyle = '#6b4a2b'; c.fillRect(e.x - 16 * s, e.y - 28 * s, 32 * s, 28 * s);
        c.strokeStyle = '#3e2a16'; c.lineWidth = 2; c.strokeRect(e.x - 16 * s, e.y - 28 * s, 32 * s, 28 * s);
        c.beginPath(); c.moveTo(e.x - 16 * s, e.y - 28 * s); c.lineTo(e.x + 16 * s, e.y); c.stroke();
      } else { // barril
        c.fillStyle = '#5a3a20'; c.beginPath(); c.ellipse(e.x, e.y - 18 * s, 14 * s, 18 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#2e2e36'; c.fillRect(e.x - 14 * s, e.y - 28 * s, 28 * s, 3); c.fillRect(e.x - 14 * s, e.y - 10 * s, 28 * s, 3);
      }
    } else if (tema === 'egito') {
      if (v < 0.5) { // vaso canópico
        c.fillStyle = '#c9a36a'; c.beginPath(); c.ellipse(e.x, e.y - 14 * s, 9 * s, 14 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#2fa8a0'; c.fillRect(e.x - 9 * s, e.y - 18 * s, 18 * s, 3);
        c.fillStyle = '#b08a52'; c.beginPath(); c.arc(e.x, e.y - 28 * s, 6 * s, 0, 7); c.fill();
      } else { // braseiro
        c.fillStyle = '#8a6a3a'; c.fillRect(e.x - 2, e.y - 22 * s, 4, 22 * s);
        c.fillStyle = '#c9a36a'; c.beginPath(); c.moveTo(e.x - 12 * s, e.y - 22 * s); c.lineTo(e.x + 12 * s, e.y - 22 * s); c.lineTo(e.x + 7 * s, e.y - 30 * s); c.lineTo(e.x - 7 * s, e.y - 30 * s); c.fill();
        chama(e.x, e.y - 28 * s, 1.1 * s);
      }
    }
    return true;
  }
  if (e.t === 'estalactite') {
    if (tema === 'gotico') { // teia de aranha
      c.strokeStyle = 'rgba(220,220,235,.25)'; c.lineWidth = 1;
      const r0 = 26 * e.s;
      for (let k = 0; k < 5; k++) { const a = Math.PI * (0.1 + k * 0.2); c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0); c.stroke(); }
      for (let rr = 8; rr < r0; rr += 7) { c.beginPath(); c.arc(e.x, e.y, rr, Math.PI * 0.1, Math.PI * 0.9); c.stroke(); }
    } else if (tema === 'londres') { // lampião pendurado
      c.strokeStyle = '#3a3c4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x, e.y + 30 * e.s); c.stroke();
      c.fillStyle = '#2e2e36'; c.fillRect(e.x - 7, e.y + 30 * e.s, 14, 16);
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,210,120,.9)', 32), e.x - 30, e.y + 30 * e.s - 22, 60, 60); c.fillStyle = '#ffe2a0'; c.fillRect(e.x - 5, e.y + 32 * e.s, 10, 12); c.restore();
    } else if (tema === 'egito') { // raízes
      c.strokeStyle = '#4a3a22'; c.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(e.x + k * 6, e.y); c.quadraticCurveTo(e.x + k * 6 + Math.sin(t + k) * 4, e.y + 20 * e.s, e.x + k * 8 - 4, e.y + (30 + k * 8) * e.s); c.stroke(); }
    }
    return true;
  }
  if (e.t === 'tocha') {
    if (tema === 'londres') { // poste de gás
      c.fillStyle = '#2e2e36'; c.fillRect(e.x - 3, e.y - 30, 6, 80); c.fillRect(e.x - 9, e.y - 52, 18, 22);
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,210,120,.95)', 64), e.x - 80, e.y - 120, 160, 150); c.fillStyle = '#ffe2a0'; c.fillRect(e.x - 6, e.y - 48, 12, 16); c.restore();
    } else if (tema === 'egito') {
      c.fillStyle = '#8a6a3a'; c.fillRect(e.x - 3, e.y - 6, 6, 30);
      c.fillStyle = '#c9a36a'; c.beginPath(); c.moveTo(e.x - 12, e.y - 6); c.lineTo(e.x + 12, e.y - 6); c.lineTo(e.x + 8, e.y - 14); c.lineTo(e.x - 8, e.y - 14); c.fill();
      chama(e.x, e.y - 12, 1.6);
    } else { // gótico: castiçal de parede com velas
      c.fillStyle = '#5a4a30'; c.fillRect(e.x - 14, e.y, 28, 4); c.fillRect(e.x - 2, e.y, 4, 16);
      for (const dx of [-10, 0, 10]) { c.fillStyle = '#efe6d0'; c.fillRect(e.x + dx - 2, e.y - 12, 4, 12); chama(e.x + dx, e.y - 12, 0.9, 'rgba(255,150,60,.9)'); }
    }
    return true;
  }
  if (e.t === 'estandarte') {
    const cores = tema === 'gotico' ? ['#8a1020', '#3a0810', '#e8c76a'] : tema === 'londres' ? ['#1f3a5a', '#0f1f33', '#e8c76a'] : ['#2fa8a0', '#145a55', '#ffd86b'];
    c.fillStyle = '#c9a54a'; c.fillRect(e.x - 22, e.y - 3, 44, 5);
    const g = c.createLinearGradient(0, e.y, 0, e.y + 100); g.addColorStop(0, cores[0]); g.addColorStop(1, cores[1]);
    c.fillStyle = g; c.beginPath(); c.moveTo(e.x - 18, e.y);
    for (let i = 0; i <= 10; i++) c.lineTo(e.x - 18 + Math.sin(t * 2 + i) * 2, e.y + i * 9);
    c.lineTo(e.x, e.y + 82); c.lineTo(e.x + 18, e.y + 92); c.lineTo(e.x + 18, e.y); c.closePath(); c.fill();
    c.strokeStyle = cores[2]; c.lineWidth = 2.5; c.beginPath();
    if (tema === 'egito') { c.arc(e.x, e.y + 34, 6, 0, 7); c.moveTo(e.x, e.y + 40); c.lineTo(e.x, e.y + 62); c.moveTo(e.x - 8, e.y + 46); c.lineTo(e.x + 8, e.y + 46); }
    else if (tema === 'gotico') { c.moveTo(e.x - 9, e.y + 30); c.lineTo(e.x, e.y + 54); c.lineTo(e.x + 9, e.y + 30); c.moveTo(e.x - 9, e.y + 54); c.lineTo(e.x + 9, e.y + 54); }
    else { c.arc(e.x, e.y + 44, 10, 0, 7); c.moveTo(e.x, e.y + 44); c.lineTo(e.x, e.y + 37); c.moveTo(e.x, e.y + 44); c.lineTo(e.x + 6, e.y + 46); }
    c.stroke();
    return true;
  }
  if (e.t === 'corrente' && tema === 'egito') return true;   // sem correntes no Egito
  return false;
}
