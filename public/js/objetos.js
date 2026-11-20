// Coisas espalhadas pelas fases do modo clássico (sempre iguais para todos, saem da semente):
//  barril explosivo · jaula com prisioneiro pra soltar · baú de tesouro (o do desafio vem trancado) · mercador
//  armadilhas por tema: pêndulo (Castelo) · jato de vapor (Londres) · dardos (Egito) · cristais que brotam (Catacumbas)
import { T, clamp } from './util.js';
import { brilho, cristal, rgba } from './arte.js';

const CONT = '#140d22';
export const ESC_OBJ = 1.3;   // objetos um pouco maiores que o desenho base

// ---------- armadilhas: tudo depende só do relógio, então todo mundo vê igual ----------
export const ARM = {
  pendulo: { per: 2.6 },
  vapor: { per: 3.2, aviso: 1.3, ativo: 2.0, fim: 2.7 },
  espinho: { per: 2.8, aviso: 1.4, ativo: 2.0, fim: 2.5 },
  dardo: { per: 2.4, vel: 430, alc: 7 * T },
};
// devolve a área perigosa agora (ou null)
export function perigoArmadilha(a, t) {
  if (a.t === 'pendulo') {
    const fase = (t + a.fase) * Math.PI * 2 / ARM.pendulo.per, ang = Math.sin(fase) * (a.amp || 0.95);
    const bx = a.x + Math.sin(ang) * a.L, by = a.ay + Math.cos(ang) * a.L;
    return { x: bx - 30, y: by - 22, w: 60, h: 44, kb: Math.cos(fase) < 0 ? -1 : 1 };
  }
  if (a.t === 'vapor' || a.t === 'espinho') {
    const C = ARM[a.t], k = (t + a.fase) % C.per;
    if (k < C.ativo || k > C.fim) return null;
    const h = a.t === 'vapor' ? 150 : 86;
    return { x: a.x - 26, y: a.y - h, w: 52, h };
  }
  if (a.t === 'dardo') {
    const C = ARM.dardo, k = (t + a.fase) % C.per, dist = k * C.vel;
    if (dist > C.alc) return null;
    const dx = a.x + a.d * (24 + dist);
    return { x: dx - 16, y: a.y - 48, w: 32, h: 10 };
  }
  return null;
}

export function desenharArmadilha(c, a, t, bioma) {
  c.save();
  if (a.t === 'pendulo') {
    const ang = Math.sin((t + a.fase) * Math.PI * 2 / ARM.pendulo.per) * (a.amp || 0.95);
    c.translate(a.x, a.ay); c.rotate(-ang);
    c.strokeStyle = '#6a5a5a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, a.L - 16); c.stroke();
    c.fillStyle = '#3a3038'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill();
    // lâmina em meia-lua
    c.translate(0, a.L);
    const g = c.createLinearGradient(0, -20, 0, 24); g.addColorStop(0, '#5a5060'); g.addColorStop(1, '#e8e2f0');
    c.fillStyle = g; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-40, -6); c.quadraticCurveTo(0, 40, 40, -6); c.quadraticCurveTo(0, 14, -40, -6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8a1020'; c.beginPath(); c.arc(0, -10, 7, 0, 7); c.fill(); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.strokeStyle = 'rgba(255,90,110,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-36, 0); c.quadraticCurveTo(0, 32, 36, 0); c.stroke();
    c.restore();
  } else if (a.t === 'vapor') {
    const C = ARM.vapor, k = (t + a.fase) % C.per;
    // grade no chão
    c.fillStyle = '#2a2a33'; c.fillRect(a.x - 26, a.y - 6, 52, 6);
    c.fillStyle = '#b08a4a'; for (let i = 0; i < 5; i++) c.fillRect(a.x - 24 + i * 11, a.y - 6, 4, 6);
    if (k > C.aviso && k < C.ativo) {   // chiando: fumacinha avisando
      c.fillStyle = 'rgba(230,225,215,.5)';
      for (let i = 0; i < 4; i++) { const p = ((t * 3 + i / 4) % 1); c.beginPath(); c.arc(a.x + Math.sin(i * 3 + t * 5) * 12, a.y - 8 - p * 30, 4 + p * 6, 0, 7); c.fill(); }
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30);
      c.fillStyle = 'rgba(255,170,80,.5)'; c.fillRect(a.x - 26, a.y - 8, 52, 3);
    } else if (k >= C.ativo && k <= C.fim) {
      const s = Math.min(1, (k - C.ativo) / 0.1) * (k > C.fim - 0.15 ? (C.fim - k) / 0.15 : 1);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const p = ((t * 4 + i / 9) % 1), r = 14 + p * 22;
        c.globalAlpha = s * (1 - p * 0.7);
        c.drawImage(brilho('rgba(255,250,240,.85)', 32), a.x - r + Math.sin(i * 2 + t * 9) * 8, a.y - 10 - p * 150 - r, r * 2, r * 2);
      }
    }
  } else if (a.t === 'espinho') {
    const C = ARM.espinho, k = (t + a.fase) % C.per;
    if (k > C.aviso && k < C.ativo) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(bioma.luz, 0.25 + 0.4 * ((k - C.aviso) / (C.ativo - C.aviso)));
      c.beginPath(); c.ellipse(a.x, a.y - 2, 30, 6, 0, 0, 7); c.fill();
      c.globalCompositeOperation = 'source-over';
      for (let i = -1; i <= 1; i++) cristal(c, a.x + i * 14, a.y, 10, 8, bioma.cristal, i * 0.2);
    } else if (k >= C.ativo && k <= C.fim) {
      const s = Math.sin(Math.min(1, (k - C.ativo) / 0.08) * Math.PI / 2) * (k > C.fim - 0.12 ? (C.fim - k) / 0.12 : 1);
      cristal(c, a.x - 14, a.y, 66 * s, 14, bioma.cristal, -0.25);
      cristal(c, a.x + 14, a.y, 60 * s, 13, bioma.cristal, 0.25);
      cristal(c, a.x, a.y, 90 * s, 18, bioma.cristal, 0);
    } else {
      c.fillStyle = rgba(bioma.cristal[2], 0.6); c.beginPath(); c.ellipse(a.x, a.y - 1, 24, 4, 0, 0, 7); c.fill();
    }
  } else if (a.t === 'dardo') {
    // estátua de chacal que cospe dardos
    c.translate(a.x, a.y); c.scale(a.d, 1);
    c.fillStyle = '#a8865a'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.rect(-16, -30, 32, 30); c.fill(); c.stroke();
    c.fillStyle = '#151820';
    c.beginPath(); c.moveTo(-12, -30); c.lineTo(-10, -58); c.lineTo(-4, -66); c.lineTo(-2, -58); c.lineTo(6, -58); c.lineTo(24, -50); c.lineTo(22, -44); c.lineTo(4, -40); c.lineTo(8, -30); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-8, -62); c.lineTo(-10, -80); c.lineTo(-2, -64); c.fill();
    const C = ARM.dardo, k = (t + a.fase) % C.per;
    c.fillStyle = k > C.per - 0.5 ? '#7dffe8' : '#ffd27a'; c.fillRect(4, -55, 6, 3);
    if (k > C.per - 0.5) { c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(80,255,220,.8)', 24), -4, -66, 24, 24); }
    c.restore(); c.save();
    const dist = k * C.vel;
    if (dist <= C.alc) {
      const dx = a.x + a.d * (24 + dist), dy = a.y - 43;
      c.translate(dx, dy); c.scale(a.d, 1);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-16, 0); c.lineTo(10, 0); c.stroke();
      c.fillStyle = '#7dffe8'; c.beginPath(); c.moveTo(10, -4); c.lineTo(20, 0); c.lineTo(10, 4); c.closePath(); c.fill();
      c.fillStyle = '#d6233f'; c.beginPath(); c.moveTo(-16, 0); c.lineTo(-22, -5); c.lineTo(-20, 0); c.lineTo(-22, 5); c.closePath(); c.fill();
    }
  }
  c.restore();
}

// ---------- objetos ----------
// e = estado local: { usado, hp, golpe (tempo do último golpe), aberto, perto }
export function desenharObjeto(c, o, e, t, bioma) {
  c.save(); c.translate(o.x, o.y); c.scale(ESC_OBJ, ESC_OBJ);
  const treme = e.golpe > 0 ? Math.sin(t * 80) * 3 * e.golpe / 0.2 : 0;
  c.translate(treme, 0);
  if (o.t === 'barril') {
    if (e.usado) { c.fillStyle = 'rgba(20,10,10,.5)'; c.beginPath(); c.ellipse(0, -2, 30, 6, 0, 0, 7); c.fill(); c.restore(); return; }
    c.fillStyle = '#6a2a14'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-18, 0); c.quadraticCurveTo(-24, -24, -18, -48); c.lineTo(18, -48); c.quadraticCurveTo(24, -24, 18, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a3a44'; c.fillRect(-21, -40, 42, 5); c.fillRect(-21, -13, 42, 5);
    // símbolo de perigo (chama) e brilho pulsando
    c.fillStyle = '#ffcf3a'; c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(9, -26, 5, -18); c.quadraticCurveTo(0, -14, -5, -18); c.quadraticCurveTo(-8, -26, 0, -34); c.fill();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 5 + o.id);
    c.drawImage(brilho('rgba(255,120,40,.8)', 32), -26, -50, 52, 52);
  } else if (o.t === 'jaula') {
    // prisioneiro (some quando é solto)
    if (!e.usado) {
      const bob = Math.sin(t * 3 + o.id) * 2;
      c.save(); c.translate(0, bob);
      c.fillStyle = ['#d9a17a', '#a86c4a', '#efc29b'][o.v % 3]; c.strokeStyle = CONT; c.lineWidth = 2;
      c.fillStyle = ['#6a5a4a', '#4a5a6a', '#6a4a5a'][o.v % 3];
      c.beginPath(); c.moveTo(-12, -2); c.lineTo(-10, -36); c.lineTo(10, -36); c.lineTo(12, -2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = ['#d9a17a', '#a86c4a', '#efc29b'][o.v % 3];
      c.beginPath(); c.arc(0, -46, 10, 0, 7); c.fill(); c.stroke();
      c.fillStyle = ['#3a2a1a', '#1a1a1a', '#8a5a2a'][o.v % 3]; c.beginPath(); c.arc(0, -50, 10, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-5, -47, 3, 3); c.fillRect(3, -47, 3, 3);
      // braços acenando por socorro
      const ac = Math.sin(t * 8 + o.id) * 0.5;
      c.strokeStyle = ['#d9a17a', '#a86c4a', '#efc29b'][o.v % 3]; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-9, -32); c.lineTo(-20, -52 + ac * 8); c.moveTo(9, -32); c.lineTo(20, -50 - ac * 8); c.stroke();
      c.restore();
      if (e.perto === undefined || e.perto) {
        c.font = '900 13px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe9a0';
        c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); c.fillText('SOCORRO!', 0, -98); c.globalAlpha = 1;
      }
    }
    // a jaula
    const quebrada = e.usado;
    c.strokeStyle = '#3a3a44'; c.lineWidth = 4;
    if (!quebrada) {
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 12, 0); c.lineTo(i * 12, -78); c.stroke(); }
      c.fillStyle = '#4a4a56'; c.fillRect(-30, -84, 60, 8); c.fillRect(-30, -4, 60, 6);
      c.strokeStyle = '#4a4a56'; c.lineWidth = 3; c.beginPath(); c.arc(0, -84, 8, Math.PI, 0); c.stroke();
      // rachaduras conforme apanha
      if (e.hp < 3) { c.strokeStyle = '#ffe9a0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, -60); c.lineTo(-4, -50); c.lineTo(-10, -40); if (e.hp < 2) { c.moveTo(12, -30); c.lineTo(4, -22); c.lineTo(10, -12); } c.stroke(); }
    } else {
      c.fillStyle = '#4a4a56'; c.fillRect(-30, -4, 60, 6);
      c.save(); c.translate(-26, -6); c.rotate(-1.2); c.fillRect(0, -3, 50, 4); c.restore();
      c.save(); c.translate(24, -6); c.rotate(-2.0); c.fillRect(0, -3, 46, 4); c.restore();
    }
  } else if (o.t === 'bau') {
    const tranc = o.tranc && !e.destrancado;
    if (!tranc && !e.usado) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4); c.drawImage(brilho('rgba(255,215,110,.8)', 48), -50, -70, 100, 90); c.restore(); }
    const abre = e.usado ? Math.min(1, (e.abertoT || 1) * 4) : 0;
    c.fillStyle = '#6a3a1a'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.rect(-26, -30, 52, 30); c.fill(); c.stroke();
    c.fillStyle = '#e8c76a'; c.fillRect(-26, -30, 52, 4); c.fillRect(-4, -30, 8, 30);
    // tampa
    c.save(); c.translate(-26, -30); c.rotate(-abre * 1.9);
    c.fillStyle = '#7a4a22'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(26, -22, 52, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8c76a'; c.fillRect(22, -12, 8, 12);
    c.restore();
    if (e.usado) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - (e.abertoT || 1)); c.drawImage(brilho('rgba(255,230,140,.95)', 48), -40, -90, 80, 80); }
    if (tranc) {
      c.strokeStyle = '#8a8a96'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-28, -26); c.lineTo(28, -6); c.moveTo(28, -26); c.lineTo(-28, -6); c.stroke();
      c.fillStyle = '#b08a4a'; c.strokeStyle = CONT; c.lineWidth = 2;
      c.beginPath(); c.rect(-8, -22, 16, 14); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -22, 6, Math.PI, 0); c.stroke();
    }
  } else if (o.t === 'mercador') {
    // mercador encapuzado com mochila enorme e lampião
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,200,110,.6)', 64), -70, -120, 140, 140);
    c.restore();
    c.fillStyle = '#5a3a20'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.rect(-34, -78, 30, 62); c.fill(); c.stroke();   // mochila
    c.fillStyle = '#8a5a2a'; c.fillRect(-34, -64, 30, 4); c.fillRect(-34, -40, 30, 4);
    c.fillStyle = '#c9a54a'; c.beginPath(); c.arc(-26, -84, 7, 0, 7); c.fill(); c.stroke();   // panela pendurada
    c.fillStyle = '#3a2a5a';
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-10, -60); c.quadraticCurveTo(2, -84, 14, -60); c.lineTo(18, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#100a18'; c.beginPath(); c.ellipse(4, -60, 8, 9, 0, 0, 7); c.fill();
    c.fillStyle = '#ffd27a'; c.fillRect(4, -62, 6, 2.5);
    // lampião
    const bal = Math.sin(t * 2) * 0.15;
    c.save(); c.translate(20, -40); c.rotate(bal);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 10); c.stroke();
    c.fillStyle = '#c9a54a'; c.fillRect(-6, 10, 12, 14);
    c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,210,120,.95)', 32), -20, -2, 40, 40);
    c.restore();
    // balão
    const pul = 1 + Math.sin(t * 4) * 0.06;
    c.translate(0, -106); c.scale(pul, pul);
    c.fillStyle = e.perto ? '#ffe28a' : 'rgba(20,10,50,.75)'; c.strokeStyle = '#ffe28a'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 0, 30, 18, 0, 0, 7); c.fill(); c.stroke();
    c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('🛒', 0, 6);
  }
  c.restore();
}
