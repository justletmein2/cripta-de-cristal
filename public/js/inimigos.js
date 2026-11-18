// Monstros: números, inteligência (roda só no anfitrião) e desenho.
import { T, clamp, sinal, toca } from './util.js';
export { ARMADURA };
import { moverCorpo, temChaoFrente, paredeFrente, solido } from './fisica.js';
import { cristal, brilho, rgba } from './arte.js';

export const TIPOS = ['esqueleto', 'golem', 'morcego', 'conjurador', 'chefe'];
export const ESTADOS = ['ronda', 'persegue', 'prepara', 'golpe', 'recupera', 'atordoado', 'morto'];

export const DEFS = {
  esqueleto: { vida: 62, vel: 100, w: 30, h: 70, dano: 15, alcance: 62, prep: 0.5, golpe: 0.18, recup: 0.55, visao: 460, cristais: 4, nome: 'Esqueleto' },
  golem: { vida: 175, vel: 55, w: 62, h: 96, dano: 27, alcance: 96, prep: 0.85, golpe: 0.22, recup: 0.9, visao: 420, pesado: true, cristais: 10, nome: 'Golem de Cristal' },
  morcego: { vida: 32, vel: 160, w: 36, h: 26, dano: 12, alcance: 250, prep: 0.45, golpe: 0.5, recup: 0.6, visao: 520, voa: true, cristais: 3, nome: 'Morcego Espectral' },
  conjurador: { vida: 48, vel: 70, w: 30, h: 72, dano: 14, alcance: 520, prep: 0.75, golpe: 0.1, recup: 1.3, visao: 640, cristais: 6, nome: 'Conjurador' },
  chefe: { vida: 1500, vel: 120, w: 96, h: 150, dano: 26, alcance: 2000, prep: 0.8, golpe: 0.6, recup: 0.9, visao: 5000, pesado: true, voa: true, cristais: 120, nome: 'Guardião do Prisma' },
};

// armadura: enquanto tiver, o monstro não se abala com os golpes; quando quebra, fica tonto e leva +50% de dano
const ARMADURA = { golem: 70, chefe: 260 };
export function criarInimigo(sp, mult, elite = false) {
  const d = DEFS[sp.tipo];
  const ve = elite ? 2.2 : 1;
  const vida = Math.round(d.vida * mult.vida * ve);
  const marm = Math.round(((ARMADURA[sp.tipo] || 0) + (elite ? 45 : 0)) * mult.vida);
  const esc = elite ? 1.2 : 1;
  return {
    id: sp.id, tipo: sp.tipo, x: sp.x, y: sp.y, vx: 0, vy: 0, w: Math.round(d.w * esc), h: Math.round(d.h * esc),
    hp: vida, mhp: vida, d: -1, estado: 'ronda', tE: Math.random() * 2, ac: 0, elite,
    arm: marm, marm, armT: 0, atordT: 0,
    casaX: sp.x, casaY: sp.y, flash: 0, ataque: null, mult: elite ? { ...mult, dano: mult.dano * 1.3, vel: (mult.vel || 1) * 1.08 } : mult, golpeado: 0,
  };
}

const perto = (en, jogs) => {
  let m = null, md = 1e9;
  for (const j of jogs) {
    if (!j.vivo) continue;
    const dd = Math.hypot(j.x - en.x, (j.y - 35) - (en.y - en.h / 2));
    if (dd < md) { md = dd; m = j; }
  }
  return [m, md];
};
const muda = (en, e) => { en.estado = e; en.tE = 0; };

// mundo: { nv, jogs:[{x,y,vivo}], proj:[], zonas:[], novoId(), invocar(tipo,x,y) }
export function atualizarInimigo(en, dt, mundo) {
  const d = DEFS[en.tipo], nv = mundo.nv;
  en.tE += dt; en.flash = Math.max(0, en.flash - dt);
  const [alvo, dist] = perto(en, mundo.jogs);
  const dx = alvo ? alvo.x - en.x : 0;
  const vel = d.vel * (en.mult.vel || 1);

  // armadura volta depois de um tempo quebrada
  if (en.marm > 0 && en.arm <= 0) { en.armT -= dt; if (en.armT <= 0) en.arm = en.marm; }
  if (en.estado === 'atordoado') {
    en.vx *= Math.pow(en.noChao === false ? 0.4 : 0.02, dt);
    const lim = en.atordT || 0.3;
    const noAr = !d.voa && en.noChao === false;
    if (en.tE > lim && !noAr) { en.atordT = 0; muda(en, 'persegue'); }
    if (!d.voa) { en.grav = 0.7; moverCorpo(en, dt, nv); en.grav = 1; }
    else if (en.tipo === 'chefe') { en.x = clamp(en.x + en.vx * dt, T * 3, (nv.w - 3) * T); }
    else { en.x += en.vx * dt; en.y += en.vy * dt; en.vy *= Math.pow(0.05, dt); }
    return;
  }
  const agil = en.mult.agil || 1;   // andares mais fundos: monstros se recuperam mais rápido

  if (en.tipo === 'morcego') {
    const alvoY = alvo ? alvo.y - 130 + Math.sin(en.tE * 3 + en.id) * 20 : en.casaY;
    if (en.estado === 'ronda') {
      en.vx = Math.sin(en.tE * 1.3 + en.id) * 50; en.vy = Math.cos(en.tE * 1.7) * 30;
      if (alvo && dist < d.visao) muda(en, 'persegue');
    } else if (en.estado === 'persegue') {
      if (!alvo) { muda(en, 'ronda'); }
      else {
        const tx = alvo.x - sinal(dx) * 140;
        en.vx += clamp(tx - en.x, -1, 1) * 600 * dt; en.vy += clamp(alvoY - en.y, -1, 1) * 600 * dt;
        en.vx = clamp(en.vx, -vel, vel); en.vy = clamp(en.vy, -vel, vel);
        en.d = sinal(dx);
        if (en.tE > 1.2 && dist < d.alcance + 60) { muda(en, 'prepara'); en.mira = { x: alvo.x, y: alvo.y - 35 }; }
      }
    } else if (en.estado === 'prepara') {
      en.vx *= 0.9; en.vy = -40;
      if (en.tE > d.prep) {
        muda(en, 'golpe'); en.ac++;
        const ang = Math.atan2(en.mira.y - (en.y - 13), en.mira.x - en.x);
        en.vx = Math.cos(ang) * 560; en.vy = Math.sin(ang) * 560;
      }
    } else if (en.estado === 'golpe') {
      if (en.tE > d.golpe || solido(nv, en.x + sinal(en.vx) * 20, en.y - 13)) muda(en, 'recupera');
    } else if (en.estado === 'recupera') {
      en.vx *= Math.pow(0.1, dt); en.vy = -120;
      if (en.tE > d.recup * agil) muda(en, 'persegue');
    }
    const nx = en.x + en.vx * dt, ny = en.y + en.vy * dt;
    if (!solido(nv, nx + sinal(en.vx) * 16, en.y - 13)) en.x = nx; else en.vx *= -0.5;
    if (!solido(nv, en.x, ny - 26) && !solido(nv, en.x, ny)) en.y = ny; else en.vy *= -0.5;
    return;
  }

  if (en.tipo === 'chefe') { atualizarChefe(en, dt, mundo, alvo, dx); return; }

  // andarilhos: esqueleto, golem, conjurador
  if (en.estado === 'ronda') {
    if (en.tE > 2) { en.tE = 0; en.d = -en.d; }
    en.vx = en.d * vel * 0.4;
    if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) { en.d = -en.d; en.vx = 0; }
    if (alvo && dist < d.visao && Math.abs(alvo.y - en.y) < 200) muda(en, 'persegue');
  } else if (en.estado === 'persegue') {
    if (!alvo || dist > d.visao * 1.5) { muda(en, 'ronda'); }
    else {
      en.d = sinal(dx);
      if (en.tipo === 'conjurador') {
        const longe = Math.abs(dx) < 220 ? -1 : Math.abs(dx) > 420 ? 1 : 0;
        en.vx = en.d * longe * vel;
        if (longe && (!temChaoFrente(en, nv, sinal(en.vx)) || paredeFrente(en, nv, sinal(en.vx)))) en.vx = 0;
        if (en.tE > 0.9 && dist < d.alcance) { muda(en, 'prepara'); en.vx = 0; }
        // sumir e reaparecer longe quando encurralado
        if (Math.abs(dx) < 110 && en.tE > 0.6 && Math.abs(alvo.y - en.y) < 80) piscar(en, mundo, alvo);
      } else {
        en.vx = en.d * vel;
        if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) en.vx = 0;
        if (Math.abs(dx) < d.alcance && Math.abs(alvo.y - en.y) < 70) { muda(en, 'prepara'); en.vx = 0; }
      }
    }
  } else if (en.estado === 'prepara') {
    en.vx *= Math.pow(0.001, dt);
    if (en.tE > d.prep) {
      muda(en, 'golpe'); en.ac++;
      if (en.tipo === 'conjurador' && alvo) {
        const sx = en.x + en.d * 20, sy = en.y - 56;
        const ang = Math.atan2(alvo.y - 35 - sy, alvo.x - sx);
        const leque = en.elite || agil < 0.85 ? [-0.22, 0, 0.22] : [0];
        for (const da of leque) mundo.proj.push({ id: mundo.novoId(), x: sx, y: sy, vx: Math.cos(ang + da) * 430, vy: Math.sin(ang + da) * 430, tipo: 0, dano: Math.round(d.dano * en.mult.dano), vida: 3 });
      }
      if (en.tipo === 'esqueleto') en.vx = en.d * 160;
    }
  } else if (en.estado === 'golpe') {
    en.vx *= Math.pow(0.01, dt);
    if (en.tE > d.golpe) muda(en, 'recupera');
  } else if (en.estado === 'recupera') {
    en.vx = 0;
    if (en.tE > d.recup * agil) muda(en, 'persegue');
  }
  moverCorpo(en, dt, nv);
}

function piscar(en, mundo, alvo) {
  const nv = mundo.nv;
  for (const desloc of [340, -340, 260, -260]) {
    const nx = alvo.x + desloc;
    const tx = Math.floor(nx / T);
    if (tx < 2 || tx > nv.w - 3) continue;
    // acha chão nessa coluna perto da altura atual
    for (let ty = Math.floor((en.y - 100) / T); ty < Math.floor((en.y + 200) / T); ty++) {
      if (!solido(nv, nx, ty * T - 10) && !solido(nv, nx, ty * T - 60) && (solido(nv, nx, ty * T + 4) || nv.tiles[ty * nv.w + tx] === 2)) {
        mundo.fx && mundo.fx('piscar', en.x, en.y - 36);
        en.x = nx; en.y = ty * T; en.vy = 0; muda(en, 'recupera'); en.tE = 0.6;
        mundo.fx && mundo.fx('piscar', en.x, en.y - 36);
        return;
      }
    }
  }
}

function atualizarChefe(en, dt, mundo, alvo, dx) {
  const d = DEFS.chefe, nv = mundo.nv;
  const chaoY = nv.chao[Math.floor(nv.w / 2)] * T;
  const alturaVoo = chaoY - 40;
  en.fase2 = en.hp < en.mhp * 0.5;
  const ritmo = en.fase2 ? 0.75 : 1;
  if (alvo) en.d = en.estado === 'golpe' && en.ataque === 'investida' ? en.d : sinal(dx);
  const flutua = Math.sin(en.tE * 2) * 8;
  if (en.estado === 'ronda' || en.estado === 'persegue') {
    if (!alvo) { en.vx = 0; return; }
    if (en.estado === 'ronda') { if (Math.abs(dx) < 900) muda(en, 'persegue'); }
    const tx = alvo.x - sinal(dx) * 300;
    en.vx = clamp(tx - en.x, -1, 1) * d.vel;
    en.y += (alturaVoo + flutua - en.y) * Math.min(1, dt * 3);
    if (en.estado === 'persegue' && en.tE > 1.3 * ritmo) {
      const ops = ['espinhos', 'investida', 'rajada'];
      if (en.fase2 && !en.invocou) ops.push('invocar', 'invocar');
      en.ataque = ops[Math.floor(Math.random() * ops.length)];
      if (en.ataque === en.ultimo) en.ataque = ops[(ops.indexOf(en.ataque) + 1) % ops.length];
      en.ultimo = en.ataque;
      muda(en, 'prepara'); en.vx = 0;
      en.mira = { x: alvo.x, y: alvo.y };
    }
  } else if (en.estado === 'prepara') {
    en.vx = 0;
    if (en.ataque === 'investida') en.y += (chaoY - en.y) * Math.min(1, dt * 6);
    if (en.tE > d.prep * ritmo) {
      muda(en, 'golpe'); en.ac++;
      if (en.ataque === 'espinhos') {
        const dir = sinal(en.mira.x - en.x);
        for (let i = 0; i < 16; i++) {
          const zx = en.x + dir * (70 + i * 62);
          if (zx < T * 2 || zx > (nv.w - 2) * T) break;
          mundo.zonas.push({ id: mundo.novoId(), x: zx, y: chaoY, espera: 0.25 + i * 0.07, dur: 0.45, dano: Math.round(d.dano * en.mult.dano) });
        }
        if (en.fase2) for (let i = 0; i < 6; i++) {
          const zx = en.mira.x + (i - 2.5) * 110;
          mundo.zonas.push({ id: mundo.novoId(), x: zx, y: chaoY, espera: 0.9 + i * 0.05, dur: 0.45, dano: Math.round(d.dano * en.mult.dano) });
        }
      } else if (en.ataque === 'investida') {
        en.vx = en.d * 880;
      } else if (en.ataque === 'rajada') {
        const n = en.fase2 ? 9 : 7, base = Math.atan2(en.mira.y - 40 - (en.y - 90), en.mira.x - en.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.16;
          mundo.proj.push({ id: mundo.novoId(), x: en.x + en.d * 30, y: en.y - 90, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, tipo: 1, dano: Math.round(d.dano * 0.7 * en.mult.dano), vida: 4 });
        }
      } else if (en.ataque === 'invocar') {
        en.invocou = true;
        mundo.invocar('morcego', en.x - 120, en.y - 120); mundo.invocar('morcego', en.x + 120, en.y - 120);
        if (mundo.jogs.length > 1) mundo.invocar('esqueleto', en.x, chaoY);
      }
    }
  } else if (en.estado === 'golpe') {
    if (en.ataque === 'investida') {
      const nx = en.x + en.vx * dt;
      if (nx < T * 3 || nx > (nv.w - 3) * T || en.tE > 1.2) { en.vx = 0; muda(en, 'recupera'); mundo.fx && mundo.fx('tremor', en.x, chaoY); }
      else en.x = nx;
      return;
    }
    if (en.tE > d.golpe) muda(en, 'recupera');
  } else if (en.estado === 'recupera') {
    en.vx = 0;
    en.y += (alturaVoo + flutua - en.y) * Math.min(1, dt * 2);
    if (en.tE > d.recup * ritmo) muda(en, 'persegue');
  }
  en.x = clamp(en.x + en.vx * dt, T * 3, (nv.w - 3) * T);
}

// área perigosa do golpe (para checar contra cada herói)
export function caixaGolpe(en) {
  if (en.estado !== 'golpe') return null;
  const d = DEFS[en.tipo];
  if (en.tipo === 'esqueleto') return { x: en.d > 0 ? en.x : en.x - 66, y: en.y - 64, w: 66, h: 58 };
  if (en.tipo === 'golem') return { x: en.d > 0 ? en.x - 10 : en.x - 120, y: en.y - 60, w: 130, h: 60 };
  if (en.tipo === 'morcego') return { x: en.x - 18, y: en.y - 26, w: 36, h: 26 };
  if (en.tipo === 'chefe' && en.ataque === 'investida') return { x: en.x - 50, y: en.y - 140, w: 100, h: 140 };
  return null;
}
export function danoGolpe(en) {
  const d = DEFS[en.tipo];
  return Math.round((en.tipo === 'chefe' ? d.dano * 1.2 : d.dano) * (en.mult?.dano || 1));
}
export const corpo = en => ({ x: en.x - en.w / 2, y: en.y - en.h, w: en.w, h: en.h });

// ---------- desenho ----------
const CONT = '#140d22';
export function desenharInimigo(c, en, t, bioma) {
  c.save(); c.translate(en.x, en.y);
  const f = en.d < 0 ? -1 : 1;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const prep = en.estado === 'prepara', golpe = en.estado === 'golpe';
  // aviso vermelho antes do golpe ("cuidado com o que brilha vermelho")
  if (prep && en.tipo !== 'chefe') {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = 0.6 + 0.4 * Math.sin(t * 30);
    c.drawImage(brilho('rgba(255,40,70,.85)', 48), -en.w * 1.1, -en.h * 1.25, en.w * 2.2, en.h * 1.5);
    c.globalAlpha = k; c.strokeStyle = '#ff3355'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, -en.h / 2, en.w * 0.9, en.h * 0.7, 0, 0, 7); c.stroke();
    c.restore();
  }
  // elite: aura de cristal e tamanho maior
  if (en.elite) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55 + 0.25 * Math.sin(t * 4 + en.id);
    c.drawImage(brilho('rgba(255,210,90,.9)', 64), -en.w * 1.3, -en.h * 1.35, en.w * 2.6, en.h * 1.7);
    c.restore();
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.09;
      cristal(c, Math.cos(a) * en.w * 0.8, -en.h * 0.55 + Math.sin(a) * 14 + 6, 14, 7, ['#fff5c0', '#ffc94d', '#b5751c'], 0);
    }
    c.scale(1.2, 1.2);
  }
  // tonto (armadura quebrada): estrelinhas na cabeça
  if (en.estado === 'atordoado' && en.atordT > 0.5) {
    c.fillStyle = '#ffe28a';
    for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.09; c.beginPath(); c.arc(Math.cos(a) * 18, -en.h - 8 + Math.sin(a) * 5, 3.5, 0, 7); c.fill(); }
  }
  if (en.tipo === 'esqueleto') {
    c.scale(f, 1);
    const ph = en.estado === 'persegue' || en.estado === 'ronda' ? t * 9 + en.id : 0;
    const osso = '#e8e2d0';
    const linha = (x1, y1, x2, y2, w, cor = osso) => { c.strokeStyle = CONT; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    linha(-2, -36, -2 - Math.sin(ph) * 9, -18, 4); linha(-2 - Math.sin(ph) * 9, -18, -4 - Math.sin(ph) * 12, 0, 4);
    linha(2, -36, 2 + Math.sin(ph) * 9, -18, 4); linha(2 + Math.sin(ph) * 9, -18, 4 + Math.sin(ph) * 12, 0, 4);
    // costelas
    c.fillStyle = '#5a4a3a'; c.strokeStyle = CONT; c.lineWidth = 2;
    c.beginPath(); c.rect(-9, -40, 18, 6); c.fill(); c.stroke();
    linha(0, -40, 0, -62, 4);
    for (let i = 0; i < 3; i++) { c.strokeStyle = osso; c.lineWidth = 3; c.beginPath(); c.ellipse(1, -58 + i * 6, 9 - i, 2.5, 0, 0, Math.PI); c.stroke(); }
    // braço com espada
    let a = 0.5;
    if (prep) a = -2.4 * Math.min(1, en.tE / 0.4); else if (golpe) a = 1.4; else if (en.estado === 'recupera') a = 1.2;
    const hx = 2 + Math.sin(a) * 22, hy = -60 + Math.cos(a) * 22;
    linha(2, -60, hx, hy, 3.5);
    c.save(); c.translate(hx, hy); c.rotate(-(a + (golpe ? 0.2 : 0.9)) + Math.PI / 2);
    c.fillStyle = '#8a7f6a'; c.strokeStyle = CONT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -3); c.lineTo(44, -2); c.lineTo(50, 0); c.lineTo(44, 3); c.lineTo(0, 3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#4a3a2a'; c.fillRect(-4, -6, 4, 12);
    c.restore();
    // crânio + elmo
    c.fillStyle = osso; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.arc(2, -72, 9, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#6a5a7a'; c.beginPath(); c.arc(2, -74, 10, Math.PI, Math.PI * 2); c.lineTo(12, -70); c.lineTo(-8, -70); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = prep ? '#ff4060' : bioma.cristal[0];
    c.beginPath(); c.arc(6, -70, 2.2, 0, 7); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho(prep ? 'rgba(255,64,96,.9)' : rgba(bioma.luz, 0.7), 32), -6, -82, 24, 24); c.restore();
  } else if (en.tipo === 'golem') {
    c.scale(f, 1);
    const bob = en.estado === 'persegue' ? Math.abs(Math.sin(t * 4 + en.id)) * 3 : 0;
    const ph = t * 4 + en.id;
    const pedra = '#4a4566';
    // pernas
    c.fillStyle = pedra; c.strokeStyle = CONT; c.lineWidth = 3;
    c.beginPath(); c.rect(-22, -30 + Math.sin(ph) * 3, 18, 30); c.fill(); c.stroke();
    c.beginPath(); c.rect(4, -30 - Math.sin(ph) * 3, 18, 30); c.fill(); c.stroke();
    c.translate(0, -bob);
    // corpo
    const g = c.createLinearGradient(-30, -96, 30, -30); g.addColorStop(0, '#6a6390'); g.addColorStop(1, '#2f2a48');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-30, -30); c.lineTo(-36, -70); c.lineTo(-20, -94); c.lineTo(18, -96); c.lineTo(34, -74); c.lineTo(28, -30); c.closePath(); c.fill(); c.stroke();
    // cristais nas costas
    cristal(c, -24, -84, 34, 14, bioma.cristal, -0.5); cristal(c, -10, -92, 28, 12, bioma.cristal, -0.15); cristal(c, -32, -66, 22, 10, bioma.cristal, -0.9);
    // núcleo
    c.save(); c.globalCompositeOperation = 'lighter';
    const pul = prep ? 1.4 : 1 + Math.sin(t * 3) * 0.1;
    c.drawImage(brilho(prep ? 'rgba(255,90,90,.9)' : rgba(bioma.luz, 0.85), 48), 2 - 28 * pul, -64 - 28 * pul, 56 * pul, 56 * pul);
    c.restore();
    c.fillStyle = prep ? '#ffd0d0' : bioma.cristal[0]; c.beginPath(); c.arc(4, -62, 6, 0, 7); c.fill();
    // olhos
    c.fillStyle = prep ? '#ff4060' : '#fff'; c.fillRect(16, -86, 9, 3);
    // braço
    let a = 0.4;
    if (prep) a = -2.6 * Math.min(1, en.tE / 0.6); else if (golpe) a = 1.6; else if (en.estado === 'recupera') a = 1.5;
    c.save(); c.translate(14, -76); c.rotate(-a);
    c.fillStyle = pedra; c.strokeStyle = CONT;
    c.beginPath(); c.rect(-9, 0, 18, 34); c.fill(); c.stroke();
    c.fillStyle = '#5f5885'; c.beginPath(); c.arc(0, 42, 13, 0, 7); c.fill(); c.stroke();
    c.restore();
  } else if (en.tipo === 'morcego') {
    c.scale(f, 1);
    const asa = Math.sin(t * (golpe ? 30 : 16) + en.id) * 0.8;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho(prep ? 'rgba(255,80,120,.8)' : rgba(bioma.luz, 0.55), 40), -36, -50, 72, 72);
    c.restore();
    c.fillStyle = '#2a1a44'; c.strokeStyle = CONT; c.lineWidth = 2;
    for (const s of [-1, 1]) {
      c.save(); c.translate(0, -14); c.scale(s, 1); c.rotate(asa * 0.7);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -18, 30, -10); c.lineTo(24, -2); c.lineTo(18, 2); c.lineTo(10, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.fillStyle = '#3d2a63'; c.beginPath(); c.ellipse(0, -13, 9, 11, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-5, -22); c.lineTo(-7, -30); c.lineTo(-1, -23); c.fill();
    c.beginPath(); c.moveTo(3, -22); c.lineTo(6, -30); c.lineTo(7, -21); c.fill();
    c.fillStyle = prep || golpe ? '#ff4060' : bioma.cristal[0];
    c.beginPath(); c.arc(4, -15, 2, 0, 7); c.arc(-1, -15, 1.6, 0, 7); c.fill();
  } else if (en.tipo === 'conjurador') {
    c.scale(f, 1);
    const flut = Math.sin(t * 2.5 + en.id) * 4;
    c.translate(0, flut - 6);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho(rgba(bioma.luz, 0.4), 48), -40, -90, 80, 80);
    c.restore();
    const g = c.createLinearGradient(0, -70, 0, 0); g.addColorStop(0, '#2b2040'); g.addColorStop(1, 'rgba(43,32,64,0)');
    c.fillStyle = g; c.strokeStyle = CONT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-12, -62); c.quadraticCurveTo(-20, -20, -16, 0); c.lineTo(16, 0); c.quadraticCurveTo(18, -30, 12, -62); c.closePath(); c.fill();
    c.fillStyle = '#2b2040'; c.beginPath(); c.moveTo(-12, -62); c.quadraticCurveTo(0, -90, 12, -62); c.quadraticCurveTo(14, -45, 0, -40); c.quadraticCurveTo(-14, -45, -12, -62); c.fill(); c.stroke();
    c.fillStyle = '#100a18'; c.beginPath(); c.ellipse(4, -62, 7, 8, 0, 0, 7); c.fill();
    c.fillStyle = prep ? '#ff4060' : bioma.cristal[0]; c.fillRect(4, -64, 6, 2.5);
    // orbe na mão
    const ox = 18, oy = -48 - (prep ? 10 : 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    const tam = prep ? 18 + en.tE * 20 : 12;
    c.drawImage(brilho(rgba(bioma.luz, 0.9), 32), ox - tam, oy - tam, tam * 2, tam * 2);
    c.restore();
    cristal(c, ox, oy + 6, 14, 7, bioma.cristal, 0);
  } else if (en.tipo === 'chefe') {
    desenharChefe(c, en, t, bioma, f);
  }
  c.restore();
  // barra de vida
  if ((en.hp < en.mhp || en.marm > 0 || en.elite) && en.tipo !== 'chefe') {
    const w = Math.max(40, en.w), by = en.y - en.h * (en.elite ? 1.15 : 1) - 16;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(en.x - w / 2, by, w, 5);
    c.fillStyle = en.elite ? '#ffc94d' : '#ff4d6d'; c.fillRect(en.x - w / 2, by, w * clamp(en.hp / en.mhp, 0, 1), 5);
    if (en.marm > 0) {
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(en.x - w / 2, by - 6, w, 4);
      c.fillStyle = en.arm > 0 ? '#7fd8ff' : 'rgba(127,216,255,.25)';
      c.fillRect(en.x - w / 2, by - 6, w * (en.arm > 0 ? clamp(en.arm / en.marm, 0, 1) : 1 - clamp((en.armT || 0) / 6, 0, 1)), 4);
    }
  }
}

function desenharChefe(c, en, t, bioma, f) {
  const prep = en.estado === 'prepara';
  c.save(); c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho(prep ? 'rgba(255,120,200,.8)' : rgba(bioma.luz, 0.6), 128), -170, -260, 340, 340);
  c.restore();
  c.scale(f, 1);
  // manto de cristais
  for (let i = -3; i <= 3; i++) cristal(c, i * 14, -10, 60 - Math.abs(i) * 8, 18, bioma.cristal, i * 0.12 + Math.sin(t * 2 + i) * 0.04);
  const g = c.createLinearGradient(-40, -150, 40, -40);
  g.addColorStop(0, '#f6e7ff'); g.addColorStop(0.5, '#9b8ac2'); g.addColorStop(1, '#3a2f5c');
  c.fillStyle = g; c.strokeStyle = CONT; c.lineWidth = 3;
  // tronco-armadura
  c.beginPath(); c.moveTo(-34, -40); c.lineTo(-44, -110); c.lineTo(-20, -128); c.lineTo(22, -128); c.lineTo(44, -110); c.lineTo(32, -40); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#e8c76a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -126); c.lineTo(0, -44); c.stroke();
  // núcleo
  c.save(); c.globalCompositeOperation = 'lighter';
  const pul = 1 + Math.sin(t * 5) * 0.15 + (prep ? 0.4 : 0);
  c.drawImage(brilho(rgba(bioma.luz, 0.95), 48), -30 * pul, -116 * 1 - 30 * pul + 30, 60 * pul, 60 * pul);
  c.restore();
  cristal(c, 0, -70, 34, 18, bioma.cristal, 0);
  // ombreiras
  cristal(c, -42, -112, 40, 18, bioma.cristal, -0.6); cristal(c, 42, -112, 40, 18, bioma.cristal, 0.6);
  // cabeça: elmo com coroa
  c.fillStyle = '#d9cff0'; c.strokeStyle = CONT; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-16, -128); c.lineTo(-18, -150); c.quadraticCurveTo(0, -166, 18, -150); c.lineTo(16, -128); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = prep ? '#ff4fc8' : '#fff'; c.fillRect(-2, -146, 16, 4);
  for (let i = -2; i <= 2; i++) cristal(c, i * 8, -160, 18 - Math.abs(i) * 3, 7, bioma.cristal, i * 0.2);
  // espada gigante
  const ataque = en.ataque;
  let a = -0.3;
  if (prep && ataque === 'investida') a = 1.5; else if (prep) a = -1.0 - en.tE; else if (en.estado === 'golpe') a = 1.2;
  c.save(); c.translate(40, -100); c.rotate(a);
  c.fillStyle = '#e8c76a'; c.fillRect(-4, -10, 8, 20); c.fillRect(-14, 6, 28, 6);
  const gl = c.createLinearGradient(-8, 0, 8, 0); gl.addColorStop(0, bioma.cristal[0]); gl.addColorStop(1, bioma.cristal[2]);
  c.fillStyle = gl; c.strokeStyle = CONT; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-8, 12); c.lineTo(-7, 110); c.lineTo(0, 128); c.lineTo(7, 110); c.lineTo(8, 12); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

export function desenharProjetil(c, p, bioma, t) {
  c.save(); c.translate(p.x, p.y);
  c.globalCompositeOperation = 'lighter';
  const r = p.tipo === 1 ? 26 : 20;
  c.drawImage(brilho(p.tipo === 1 ? 'rgba(255,90,200,.9)' : 'rgba(255,80,110,.85)', 32), -r, -r, r * 2, r * 2);
  c.globalCompositeOperation = 'source-over';
  c.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
  cristal(c, 0, 8, 22, 9, p.tipo === 1 ? bioma.cristal : ['#ffd0dc', '#ff4d6d', '#8a1030'], 0);
  c.restore();
}

export function desenharZona(c, z, bioma, agoraT) {
  // agoraT: segundos desde que a zona foi criada
  if (agoraT < z.espera) {
    const k = agoraT / z.espera;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,80,200,${0.2 + k * 0.5})`;
    c.beginPath(); c.ellipse(z.x, z.y - 2, 26, 6, 0, 0, 7); c.fill(); c.restore();
  } else if (agoraT < z.espera + z.dur) {
    const k = (agoraT - z.espera) / z.dur;
    const h = 90 * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (k > 0.7 ? (1 - k) / 0.3 : 1);
    cristal(c, z.x - 10, z.y, h * 0.7, 14, bioma.cristal, -0.2);
    cristal(c, z.x + 10, z.y, h * 0.6, 12, bioma.cristal, 0.25);
    cristal(c, z.x, z.y, h, 18, bioma.cristal, 0);
  }
}
export const caixaZona = z => ({ x: z.x - 24, y: z.y - 80, w: 48, h: 80 });
