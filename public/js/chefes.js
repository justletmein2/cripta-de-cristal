// Chefões temáticos (um por fase): inteligência (roda só no anfitrião) e desenho.
//  Castelo Carmesim → Conde Carmesim: vira morcegos e surge nas costas, ondas de sangue, gêiseres, invoca morcegos
//  Londres Enevoada → Lorde Engrenagem: jato de vapor, serras que rolam no chão, punho-foguete, pisão com onda de choque
//  Tumba de Anúbis → Avatar de Anúbis: pilares de areia embaixo de você, leque de lanças, afunda e surge do seu lado, escaravelhos
// Todos ficam mais rápidos e mais bravos abaixo de 50% de vida.
import { T, clamp, sinal } from './util.js';
import { brilho, rgba } from './arte.js';

export const DEFS3 = {
  conde: { vida: 1350, vel: 170, w: 58, h: 140, dano: 24, alcance: 2000, prep: 0.7, golpe: 0.5, recup: 0.85, visao: 5000, voa: true, pesado: true, chefe: true, cristais: 120, nome: 'Conde Carmesim', arena: 'O Salão do Conde', cor: ['#ff2a4a', '#ffb3c0'] },
  engrenagem: { vida: 1650, vel: 95, w: 112, h: 150, dano: 28, alcance: 2000, prep: 0.8, golpe: 0.6, recup: 0.95, visao: 5000, pesado: true, chefe: true, cristais: 120, nome: 'Lorde Engrenagem', arena: 'A Grande Fornalha', cor: ['#e8a93a', '#ffe2a0'] },
  anubis: { vida: 1450, vel: 135, w: 76, h: 160, dano: 25, alcance: 2000, prep: 0.7, golpe: 0.6, recup: 0.9, visao: 5000, voa: true, pesado: true, chefe: true, cristais: 120, nome: 'Avatar de Anúbis', arena: 'A Câmara do Julgamento', cor: ['#2fa8a0', '#ffd27a'] },
};
export const ARMADURA3 = { conde: 230, engrenagem: 300, anubis: 250 };
// nomes dos ataques (vão pela rede como número)
export const ATAQUES3 = ['garra', 'onda', 'chuva', 'morcegos', 'vapor', 'serras', 'punho', 'pisao', 'areia', 'lancas', 'sombra', 'escaravelhos'];

// tempo de preparo e de golpe de cada ataque (preparo = o aviso que dá pra ler e fugir)
const ATQ = {
  garra: { prep: 0.75, golpe: 0.62 }, onda: { prep: 0.6, golpe: 0.35 }, chuva: { prep: 0.55, golpe: 0.4 }, morcegos: { prep: 0.7, golpe: 0.4 },
  vapor: { prep: 0.8, golpe: 0.9 }, serras: { prep: 0.6, golpe: 0.4 }, punho: { prep: 0.7, golpe: 0.4 }, pisao: { prep: 0.9, golpe: 0.5 },
  areia: { prep: 0.55, golpe: 0.4 }, lancas: { prep: 0.7, golpe: 0.35 }, sombra: { prep: 0.9, golpe: 0.85 }, escaravelhos: { prep: 0.7, golpe: 0.4 },
};
const LISTA = {
  conde: ['garra', 'onda', 'chuva', 'garra', 'onda'],
  engrenagem: ['vapor', 'serras', 'punho', 'pisao'],
  anubis: ['areia', 'lancas', 'sombra', 'lancas', 'areia'],
};
const INVOCA = { conde: 'morcegos', anubis: 'escaravelhos', engrenagem: null };

const muda = (en, e) => { en.estado = e; en.tE = 0; };
const chaoDe = nv => nv.chao[Math.floor(nv.w / 2)] * T;

// IA dos chefões novos
export function atualizarChefe3(en, dt, mundo, alvo, dx) {
  const d = DEFS3[en.tipo], nv = mundo.nv, chaoY = chaoDe(nv);
  const f2 = en.hp < en.mhp * 0.5;
  if (f2 && !en.fase2) { en.fase2 = true; mundo.fx && mundo.fx('tremor', en.x, chaoY); }
  const ritmo = en.fase2 ? 0.72 : 1;
  const dano = k => Math.round(d.dano * k * (en.mult.dano || 1));
  const xMin = T * 3, xMax = (nv.w - 3) * T;
  // altura de "descanso" de cada um
  const flut = Math.sin(en.tE * 2.2 + en.id) * 7;
  const alturaY = en.tipo === 'conde' ? chaoY - 8 + flut * 0.6 : en.tipo === 'anubis' ? chaoY - 34 + flut : chaoY;
  const distIdeal = en.tipo === 'engrenagem' ? 210 : en.tipo === 'conde' ? 270 : 330;
  const at = ATQ[en.ataque] || { prep: d.prep, golpe: d.golpe };

  if (en.estado === 'ronda' || en.estado === 'persegue') {
    if (!alvo) { en.vx = 0; return; }
    en.d = sinal(dx);
    if (en.estado === 'ronda') { if (Math.abs(dx) < 950) muda(en, 'persegue'); }
    const tx = alvo.x - sinal(dx) * distIdeal;
    en.vx = clamp((tx - en.x) / 60, -1, 1) * d.vel * (en.fase2 ? 1.15 : 1);
    en.y += (alturaY - en.y) * Math.min(1, dt * 4);
    if (en.estado === 'persegue' && en.tE > 1.15 * ritmo) {
      const ops = [...LISTA[en.tipo]];
      const inv = INVOCA[en.tipo];
      if (inv && (en.nInv || 0) < (en.fase2 ? 2 : 1)) ops.push(inv);
      if (en.tipo === 'engrenagem' && Math.abs(dx) < 300) ops.push('vapor', 'pisao');
      if (en.tipo === 'engrenagem' && Math.abs(dx) > 500) ops.push('punho', 'serras');
      let a = ops[Math.floor(Math.random() * ops.length)];
      if (a === en.ultimo) a = ops.find(o => o !== en.ultimo) || a;
      en.ataque = en.ultimo = a;
      muda(en, 'prepara'); en.vx = 0;
      en.mira = { x: alvo.x, y: alvo.y };
    }
  } else if (en.estado === 'prepara') {
    en.vx = 0;
    if (alvo && en.ataque !== 'sombra' && en.ataque !== 'garra') en.d = sinal(dx);
    if (alvo) en.mira = { x: alvo.x, y: alvo.y };   // continua mirando até soltar
    if (en.ataque === 'sombra') en.y += (chaoY + 40 - en.y) * Math.min(1, dt * 3);   // afunda na areia
    else en.y += (alturaY - en.y) * Math.min(1, dt * 4);
    if (en.tE > at.prep * ritmo) {
      muda(en, 'golpe'); en.ac++;
      soltar(en, mundo, alvo, chaoY, dano, xMin, xMax);
    }
  } else if (en.estado === 'golpe') {
    if (en.ataque === 'sombra') en.y += (alturaY - en.y) * Math.min(1, dt * 7);
    else en.y += (alturaY - en.y) * Math.min(1, dt * 4);
    // fase 2: o Conde emenda uma segunda garra
    if (en.tE > at.golpe) {
      if (en.ataque === 'garra' && en.fase2 && !en.emendou) { en.emendou = true; muda(en, 'prepara'); en.tE = at.prep * 0.45; }
      else { en.emendou = false; muda(en, 'recupera'); }
    }
  } else if (en.estado === 'recupera') {
    en.vx = 0;
    en.y += (alturaY - en.y) * Math.min(1, dt * 3);
    if (en.tE > d.recup * ritmo) muda(en, 'persegue');
  }
  en.x = clamp(en.x + en.vx * dt, xMin, xMax);
}

// o momento em que o ataque sai
function soltar(en, mundo, alvo, chaoY, dano, xMin, xMax) {
  const a = en.ataque, m = en.mira || { x: en.x + en.d * 200, y: chaoY };
  const proj = (x, y, vx, vy, tipo, k, vida = 4) => mundo.proj.push({ id: mundo.novoId(), x, y, vx, vy, tipo, dano: dano(k), vida });
  const zona = (x, espera, tipo, dur = 0.5, k = 1) => { if (x > xMin - T && x < xMax + T) mundo.zonas.push({ id: mundo.novoId(), x, y: chaoY, espera, dur, dano: dano(k), tipo }); };
  const vivos = mundo.jogs.filter(j => j.vivo);
  if (a === 'garra' || a === 'sombra') {
    // some e reaparece do outro lado do herói
    if (alvo) {
      mundo.fx && mundo.fx(a === 'garra' ? 'morcegos' : 'areia', en.x, en.y - en.h / 2);
      const lado = sinal(alvo.x - en.x);
      let nx = alvo.x + lado * (a === 'garra' ? 105 : 125);
      if (nx < xMin || nx > xMax) nx = alvo.x - lado * 115;
      en.x = clamp(nx, xMin, xMax); en.d = sinal(alvo.x - en.x);
      if (a === 'garra') en.y = chaoY - 8;
      mundo.fx && mundo.fx(a === 'garra' ? 'morcegos' : 'areia', en.x, en.y - en.h / 2);
    }
  } else if (a === 'onda') {
    proj(en.x + en.d * 40, chaoY - 38, en.d * 520, 0, 3, 0.9);
    if (en.fase2) proj(en.x - en.d * 40, chaoY - 38, -en.d * 520, 0, 3, 0.9);
  } else if (a === 'chuva') {
    for (const j of vivos) zona(j.x, 0.75, 'sangue', 0.5, 0.9);
    const n = en.fase2 ? 7 : 4;
    for (let i = 0; i < n; i++) zona(m.x + (i - (n - 1) / 2) * 150 + (Math.random() - 0.5) * 50, 0.95 + i * 0.1, 'sangue', 0.5, 0.9);
  } else if (a === 'morcegos') {
    en.nInv = (en.nInv || 0) + 1;
    mundo.invocar('morcego', en.x - 110, en.y - 150); mundo.invocar('morcego', en.x + 110, en.y - 150);
    if (en.fase2 || mundo.jogs.length > 1) mundo.invocar('morcego', en.x, en.y - 200);
  } else if (a === 'serras') {
    const n = en.fase2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const dir = i === 2 ? -en.d : en.d;
      proj(en.x + dir * (60 + i * 10), chaoY - 26, dir * (360 - i * 70), 0, 5, 0.8, 5);
    }
  } else if (a === 'punho') {
    const sx = en.x + en.d * 60, sy = en.y - 100;
    const ang = Math.atan2(m.y - 40 - sy, m.x - sx);
    const leque = en.fase2 ? [-0.14, 0.14] : [0];
    for (const da of leque) proj(sx, sy, Math.cos(ang + da) * 640, Math.sin(ang + da) * 640, 6, 1.1, 3);
  } else if (a === 'pisao') {
    mundo.fx && mundo.fx('tremor', en.x, chaoY);
    for (let i = 0; i < 13; i++) for (const s of [-1, 1]) zona(en.x + s * (80 + i * 66), 0.06 + i * 0.055, 'vapor', 0.32, 0.85);
    if (en.fase2) for (let i = 0; i < 8; i++) for (const s of [-1, 1]) zona(en.x + s * (110 + i * 66), 0.9 + i * 0.055, 'vapor', 0.32, 0.85);
  } else if (a === 'areia') {
    for (const j of vivos) zona(j.x, 0.8, 'areia', 0.55);
    if (en.fase2) for (const j of vivos) { zona(j.x - 130, 1.15, 'areia', 0.55); zona(j.x + 130, 1.15, 'areia', 0.55); }
  } else if (a === 'lancas') {
    const sx = en.x + en.d * 30, sy = en.y - 120;
    const n = en.fase2 ? 7 : 5, base = Math.atan2(m.y - 40 - sy, m.x - sx);
    for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * 0.17; proj(sx, sy, Math.cos(ang) * 470, Math.sin(ang) * 470, 4, 0.75); }
  } else if (a === 'escaravelhos') {
    en.nInv = (en.nInv || 0) + 1;
    for (const k of [-1, 0, 1]) mundo.invocar('escaravelho', en.x + k * 70, chaoY);
    if (mundo.jogs.length > 1) mundo.invocar('escaravelho', en.x + en.d * 140, chaoY);
  }
}

// área que machuca o herói em cada golpe corpo a corpo (null = nada agora)
export function caixaGolpe3(en) {
  if (en.estado !== 'golpe') return null;
  const t = en.tE || 0, f = en.d < 0 ? -1 : 1;
  if (en.ataque === 'garra') return t > 0.3 && t < 0.52 ? { x: f > 0 ? en.x - 10 : en.x - 140, y: en.y - 120, w: 150, h: 120 } : null;
  if (en.ataque === 'vapor') return t > 0.08 && t < 0.85 ? { x: f > 0 ? en.x + 30 : en.x - 290, y: en.y - 130, w: 260, h: 110 } : null;
  if (en.ataque === 'sombra') return t > 0.3 && t < 0.58 ? { x: en.x - 150, y: en.y - 130, w: 300, h: 130 } : null;
  return null;
}

// acertou o herói? (cada projétil tem um tamanho)
export function projAcerta(q, x, y, h) {
  if (q.tipo === 3) return Math.abs(q.x - x) < 28 && y > q.y - 30 && y - h < q.y + 40;
  if (q.tipo === 5) return Math.abs(q.x - x) < 32 && q.y + 26 > y - h && q.y - 26 < y;
  if (q.tipo === 6) return Math.abs(q.x - x) < 28 && q.y + 18 > y - h && q.y - 18 < y;
  return Math.abs(q.x - x) < 18 && q.y > y - h && q.y < y;
}

// zonas de chão (espinhos de cristal, gêiser de sangue, vapor, pilar de areia)
export function caixaZona3(z) {
  if (z.tipo === 'sangue') return { x: z.x - 30, y: z.y - 120, w: 60, h: 120 };
  if (z.tipo === 'vapor') return { x: z.x - 30, y: z.y - 56, w: 60, h: 56 };
  if (z.tipo === 'areia') return { x: z.x - 36, y: z.y - 150, w: 72, h: 150 };
  return { x: z.x - 24, y: z.y - 80, w: 48, h: 80 };
}
export function desenharZona3(c, z, agoraT) {
  if (!z.tipo) return false;
  const cores = { sangue: ['255,40,70', '#ff3355', '#8a0a1e'], vapor: ['255,200,140', '#fff1dc', '#c9b49a'], areia: ['255,200,110', '#ffd98a', '#b8863a'] }[z.tipo];
  if (!cores) return false;
  c.save();
  if (agoraT < z.espera) {
    // aviso no chão: mancha que pulsa
    const k = agoraT / z.espera;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(${cores[0]},${0.18 + k * 0.5})`;
    const w = z.tipo === 'areia' ? 38 : 30;
    c.beginPath(); c.ellipse(z.x, z.y - 2, w * (0.6 + k * 0.4), 6, 0, 0, 7); c.fill();
    if (z.tipo === 'areia' || z.tipo === 'sangue') {   // grãos/gotas subindo
      for (let i = 0; i < 4; i++) { const yy = z.y - ((agoraT * 60 + i * 9) % 30); c.fillRect(z.x - w * 0.6 + i * w * 0.4, yy, 3, 3); }
    }
  } else if (agoraT < z.espera + z.dur) {
    const k = (agoraT - z.espera) / z.dur;
    const sobe = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (k > 0.7 ? (1 - k) / 0.3 : 1);
    const H = (z.tipo === 'areia' ? 160 : z.tipo === 'sangue' ? 125 : 60) * sobe;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho(`rgba(${cores[0]},.7)`, 48), z.x - 50, z.y - H - 30, 100, H + 50);
    c.globalCompositeOperation = 'source-over';
    if (z.tipo === 'sangue') {
      const g = c.createLinearGradient(0, z.y - H, 0, z.y); g.addColorStop(0, '#ff8a9a'); g.addColorStop(0.3, cores[1]); g.addColorStop(1, cores[2]);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(z.x - 20, z.y);
      for (let i = 0; i <= 6; i++) c.lineTo(z.x - 20 + i * 6.6 + Math.sin(agoraT * 30 + i) * 3, z.y - H * (0.75 + 0.25 * Math.sin(i * 1.3 + agoraT * 20)));
      c.lineTo(z.x + 20, z.y); c.closePath(); c.fill();
      c.fillStyle = cores[1];
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + agoraT * 4; c.beginPath(); c.arc(z.x + Math.cos(a) * 26 * sobe, z.y - H + Math.sin(a * 1.7) * 14, 4, 0, 7); c.fill(); }
    } else if (z.tipo === 'vapor') {
      c.globalAlpha = 0.85 * (1 - k * 0.6);
      for (let i = 0; i < 5; i++) {
        const r = 14 + i * 5 * sobe;
        c.fillStyle = i < 2 ? cores[1] : 'rgba(230,220,205,.8)';
        c.beginPath(); c.arc(z.x + Math.sin(i * 2.1 + agoraT * 9) * 10, z.y - 8 - i * 11 * sobe, r, 0, 7); c.fill();
      }
      c.globalAlpha = 1; c.fillStyle = '#ffb35a'; c.fillRect(z.x - 22, z.y - 4, 44, 4);
    } else {
      const g = c.createLinearGradient(z.x - 30, 0, z.x + 30, 0); g.addColorStop(0, cores[2]); g.addColorStop(0.5, cores[1]); g.addColorStop(1, cores[2]);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(z.x - 30, z.y);
      for (let i = 0; i <= 8; i++) c.lineTo(z.x - 30 + i * 7.5 + Math.sin(agoraT * 18 + i * 2) * 4, z.y - H * (0.85 + 0.15 * Math.sin(i * 2.3)));
      c.lineTo(z.x + 30, z.y); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,240,200,.7)';
      for (let i = 0; i < 8; i++) c.fillRect(z.x - 28 + ((i * 17 + agoraT * 120) % 56), z.y - H * ((i * 0.13 + agoraT * 2) % 1), 3, 3);
    }
  }
  c.restore();
  return true;
}

// ---------- desenho dos chefões ----------
const CONT = '#140d22';
// altura do chão da arena do chefe (para o Anúbis afundar na areia)
let CHAO_Y = 0;
export function chaoDaArena(nv) { CHAO_Y = nv.chefe ? chaoDe(nv) : 0; }
export function desenharChefe3(c, en, t, bioma, f) {
  const fase2 = en.hp < en.mhp * 0.5;
  if (en.tipo === 'conde') conde(c, en, t, f, fase2);
  else if (en.tipo === 'engrenagem') engrenagem(c, en, t, f, fase2);
  else if (en.tipo === 'anubis') anubis(c, en, t, f, fase2);
}

function aura(c, cor, w, h, y) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho(cor, 96), -w / 2, y - h / 2, w, h);
  c.restore();
}

function conde(c, en, t, f, fase2) {
  const prep = en.estado === 'prepara', golpe = en.estado === 'golpe', a = en.ataque;
  // virou morcegos: só a nuvem
  if (a === 'garra' && ((prep && en.tE > 0.25) || (golpe && en.tE < 0.12))) {
    aura(c, 'rgba(255,40,70,.55)', 240, 240, -80);
    c.fillStyle = '#1a0610'; c.strokeStyle = '#ff3355'; c.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const ang = t * 5 + i * 0.7, r = 30 + (i % 3) * 22;
      const x = Math.cos(ang) * r, y = -80 + Math.sin(ang * 1.3) * r * 0.7, asa = Math.sin(t * 30 + i) * 6;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 10, y - 8 - asa, x - 18, y - 2); c.lineTo(x - 8, y + 2); c.lineTo(x, y + 4);
      c.lineTo(x + 8, y + 2); c.lineTo(x + 18, y - 2); c.quadraticCurveTo(x + 10, y - 8 - asa, x, y); c.fill(); c.stroke();
    }
    return;
  }
  aura(c, prep ? 'rgba(255,40,70,.8)' : fase2 ? 'rgba(255,30,60,.55)' : 'rgba(180,20,50,.4)', 300, 320, -80);
  c.scale(f, 1);
  const bob = Math.sin(t * 2.2) * 3;
  // capa (atrás): abre quando prepara
  const abre = prep ? Math.min(1, en.tE / 0.4) : golpe ? 1 : 0.15;
  const ondula = Math.sin(t * 3) * 6;
  const gc = c.createLinearGradient(0, -130, 0, 0); gc.addColorStop(0, '#2a0610'); gc.addColorStop(1, '#0a0206');
  c.fillStyle = gc; c.strokeStyle = CONT; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-14, -112 + bob);
  c.quadraticCurveTo(-60 - abre * 40, -80, -50 - abre * 50 + ondula, 6);
  for (let i = 0; i < 5; i++) c.lineTo(-40 - abre * 40 + i * (20 + abre * 18) + ondula * 0.5, i % 2 ? -6 : 6);
  c.quadraticCurveTo(30 + abre * 50, -60, 14, -112 + bob); c.closePath(); c.fill(); c.stroke();
  // forro vermelho
  c.fillStyle = '#9a0c26';
  c.beginPath(); c.moveTo(-10, -108 + bob); c.quadraticCurveTo(-40 - abre * 30, -70, -34 - abre * 40, -6); c.lineTo(20 + abre * 40, -6); c.quadraticCurveTo(24 + abre * 30, -60, 10, -108 + bob); c.closePath(); c.fill();
  // pernas
  c.fillStyle = '#16101a';
  c.beginPath(); c.rect(-12, -50, 10, 48); c.rect(3, -50, 10, 48); c.fill(); c.stroke();
  // tronco: casaca
  c.translate(0, bob);
  const gt = c.createLinearGradient(-20, -120, 20, -40); gt.addColorStop(0, '#3a0a18'); gt.addColorStop(1, '#16040a');
  c.fillStyle = gt;
  c.beginPath(); c.moveTo(-20, -48); c.lineTo(-24, -108); c.lineTo(-10, -118); c.lineTo(12, -118); c.lineTo(24, -106); c.lineTo(20, -48); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8e2d0'; c.beginPath(); c.moveTo(-6, -116); c.lineTo(0, -96); c.lineTo(6, -116); c.closePath(); c.fill();   // gravata
  c.fillStyle = '#e8c76a'; c.fillRect(-20, -54, 40, 5);
  c.fillStyle = '#ff2a4a'; c.beginPath(); c.arc(0, -96, 3.5, 0, 7); c.fill();   // broche
  // gola alta
  c.fillStyle = '#9a0c26'; c.strokeStyle = CONT; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-14, -116); c.lineTo(-26, -142); c.lineTo(-10, -126); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(14, -116); c.lineTo(26, -142); c.lineTo(10, -126); c.closePath(); c.fill(); c.stroke();
  // cabeça
  c.fillStyle = '#e9dce4';
  c.beginPath(); c.ellipse(1, -128, 11, 13, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#0e0a12';   // cabelo para trás com bico
  c.beginPath(); c.moveTo(-12, -128); c.quadraticCurveTo(-12, -146, 2, -144); c.quadraticCurveTo(14, -144, 12, -132); c.lineTo(4, -136); c.lineTo(0, -130); c.lineTo(-4, -138); c.closePath(); c.fill();
  c.fillStyle = prep || fase2 ? '#ff2a4a' : '#ffb3c0'; c.fillRect(3, -131, 7, 2.5);
  c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,40,70,.9)', 24), -4, -142, 22, 22); c.restore();
  // braço com garras
  let ang = 0.5;
  if (prep && a !== 'garra') ang = -1.6 * Math.min(1, en.tE / 0.4);
  if (golpe && a === 'garra') ang = en.tE < 0.3 ? -2.2 : 1.3;
  else if (golpe) ang = 1.1;
  c.save(); c.translate(14, -108); c.rotate(-ang + 1.2);
  c.fillStyle = '#2a0610'; c.beginPath(); c.rect(-5, 0, 10, 36); c.fill(); c.stroke();
  c.fillStyle = '#e9dce4'; c.beginPath(); c.arc(0, 40, 6, 0, 7); c.fill();
  c.strokeStyle = '#ff3355'; c.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 4, 44); c.lineTo(i * 6, 60); c.stroke(); }
  c.restore();
  // rastro da garra
  if (golpe && a === 'garra' && en.tE > 0.28 && en.tE < 0.6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,60,90,.85)'; c.lineWidth = 6;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(20, -70, 80 + i * 14, -1.1, 0.9); c.stroke(); }
    c.restore();
  }
  // sangue mágico na mão quando prepara onda/chuva
  if (prep && (a === 'onda' || a === 'chuva' || a === 'morcegos')) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = 20 + en.tE * 40;
    c.drawImage(brilho('rgba(255,30,60,.95)', 32), 30 - k / 2, -150 - k / 2, k, k);
    c.restore();
  }
}

function engrenagem(c, en, t, f, fase2) {
  const prep = en.estado === 'prepara', golpe = en.estado === 'golpe', a = en.ataque;
  aura(c, prep ? 'rgba(255,120,40,.7)' : fase2 ? 'rgba(255,140,60,.45)' : 'rgba(255,190,90,.25)', 320, 300, -80);
  c.scale(f, 1);
  const andando = en.estado === 'persegue';
  const ph = andando ? t * 5 : 0;
  // pisão: levanta o corpo e desce com tudo
  let pul = 0;
  if (a === 'pisao' && prep) pul = -Math.sin(Math.min(1, en.tE / 0.8) * Math.PI / 2) * 40;
  c.translate(0, pul);
  const lat = '#b08a4a', ferro = '#4a4a56', escuro = '#2a2a33';
  c.strokeStyle = CONT; c.lineWidth = 3;
  // pernas grossas com pistão
  for (const s of [-1, 1]) {
    const lev = Math.sin(ph + (s > 0 ? Math.PI : 0)) * 5;
    c.fillStyle = ferro; c.beginPath(); c.rect(s * 26 - 14, -52 + lev, 28, 52 - lev - pul); c.fill(); c.stroke();
    c.fillStyle = lat; c.beginPath(); c.rect(s * 26 - 18, -10 - pul, 36, 10); c.fill(); c.stroke();
  }
  // corpo-caldeira
  const g = c.createLinearGradient(-50, -150, 50, -50); g.addColorStop(0, '#d9b070'); g.addColorStop(0.5, lat); g.addColorStop(1, '#5a4220');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-46, -54); c.lineTo(-54, -110); c.quadraticCurveTo(-50, -140, -20, -142); c.lineTo(22, -142); c.quadraticCurveTo(52, -140, 54, -110); c.lineTo(46, -54); c.closePath(); c.fill(); c.stroke();
  // rebites
  c.fillStyle = '#6a5228';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-40 + i * 16, -60, 2.5, 0, 7); c.fill(); c.beginPath(); c.arc(-40 + i * 16, -132, 2.5, 0, 7); c.fill(); }
  // fornalha no peito
  const fogo = prep ? 1.4 : fase2 ? 1.15 : 1;
  c.fillStyle = escuro; c.beginPath(); c.arc(0, -96, 22, 0, 7); c.fill(); c.stroke();
  c.save(); c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho('rgba(255,120,30,.95)', 48), -30 * fogo, -96 - 30 * fogo, 60 * fogo, 60 * fogo);
  c.restore();
  c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(0, -96, 10 + Math.sin(t * 12) * 2, 0, 7); c.fill();
  c.strokeStyle = escuro; c.lineWidth = 3;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8, -116); c.lineTo(i * 8, -76); c.stroke(); }
  // engrenagem gigante nas costas girando
  c.save(); c.translate(-46, -120); c.rotate(t * (fase2 ? 3 : 1.5));
  c.fillStyle = ferro; c.strokeStyle = CONT; c.lineWidth = 2.5;
  c.beginPath(); for (let i = 0; i < 20; i++) { const ag = i * Math.PI / 10, r = i % 2 ? 22 : 30; c.lineTo(Math.cos(ag) * r, Math.sin(ag) * r); } c.closePath(); c.fill(); c.stroke();
  c.fillStyle = lat; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.stroke();
  c.restore();
  // chaminés soltando fumaça
  for (const s of [-1, 1]) {
    c.fillStyle = escuro; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.rect(s * 22 - 6, -170, 12, 30); c.fill(); c.stroke();
    c.fillStyle = 'rgba(200,200,190,.35)';
    for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3 + (s > 0 ? 0.5 : 0)) % 1; c.beginPath(); c.arc(s * 22 + k * 14, -172 - k * 60, 6 + k * 14, 0, 7); c.fill(); }
  }
  // cabeça: elmo com visor
  c.fillStyle = ferro; c.strokeStyle = CONT; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-16, -142); c.lineTo(-18, -164); c.quadraticCurveTo(0, -176, 20, -164); c.lineTo(18, -142); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = prep || fase2 ? '#ff6a2a' : '#ffd27a'; c.fillRect(-4, -160, 20, 5);
  c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,140,40,.9)', 24), -4, -172, 28, 28); c.restore();
  // braço da frente: canhão de vapor / punho-foguete
  let ang = 0.3;
  if (prep && a === 'punho') ang = -0.15 - Math.min(1, en.tE / 0.5) * 0.3;
  else if (prep && a === 'vapor') ang = 0;
  else if (prep && a === 'serras') ang = 0.9;
  else if (golpe && a === 'vapor') ang = 0;
  c.save(); c.translate(40, -118); c.rotate(ang);
  c.fillStyle = lat; c.strokeStyle = CONT; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill(); c.stroke();
  c.fillStyle = ferro; c.beginPath(); c.rect(0, -12, 50, 24); c.fill(); c.stroke();
  // punho (some quando foi lançado)
  if (!(golpe && a === 'punho')) {
    c.fillStyle = lat; c.beginPath(); c.roundRect ? c.roundRect(46, -17, 30, 34, 6) : c.rect(46, -17, 30, 34); c.fill(); c.stroke();
    c.strokeStyle = '#6a5228'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(66, -12 + i * 10); c.lineTo(76, -12 + i * 10); c.stroke(); }
  } else {
    c.fillStyle = '#ff8a3a'; c.beginPath(); c.arc(52, 0, 9, 0, 7); c.fill();
  }
  // bico de vapor
  if (prep && a === 'vapor') {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30);
    c.drawImage(brilho('rgba(255,255,240,.9)', 32), 50, -26, 52, 52);
    c.restore();
  }
  c.restore();
  // jato de vapor
  if (golpe && a === 'vapor') {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = Math.min(1, en.tE / 0.12) * (en.tE > 0.75 ? Math.max(0, (0.9 - en.tE) / 0.15) : 1);
    for (let i = 0; i < 14; i++) {
      const p = ((t * 3 + i / 14) % 1), x = 90 + p * 230, y = -118 + Math.sin(i * 2.3 + t * 8) * p * 50;
      c.globalAlpha = k * (1 - p) * 0.9;
      c.drawImage(brilho('rgba(255,250,235,.9)', 32), x - 16 - p * 30, y - 16 - p * 30, 32 + p * 60, 32 + p * 60);
    }
    c.restore();
  }
  // fagulhas na fase 2
  if (fase2) {
    c.fillStyle = '#ffb35a';
    for (let i = 0; i < 5; i++) { const k = (t * 1.5 + i * 0.2) % 1; c.fillRect(-30 + i * 14 + Math.sin(i * 7 + t) * 6, -70 - k * 80, 2.5, 2.5); }
  }
}

function anubis(c, en, t, f, fase2) {
  const prep = en.estado === 'prepara', golpe = en.estado === 'golpe', a = en.ataque;
  // afundando na areia: corta o que está abaixo do chão
  const afunda = a === 'sombra' && (prep || golpe);
  if (afunda) {
    c.save();
    c.beginPath(); c.rect(-220, -420, 440, 420 + (CHAO_Y ? CHAO_Y - en.y : 0)); c.clip();
  }
  aura(c, prep ? 'rgba(255,210,110,.75)' : fase2 ? 'rgba(80,230,210,.55)' : 'rgba(80,220,200,.35)', 320, 340, -90);
  c.scale(f, 1);
  const ouro = '#e8c27a', azul = '#1f3a7a', pele = '#151820';
  c.strokeStyle = CONT; c.lineWidth = 3;
  // saiote dourado e pernas
  c.fillStyle = pele;
  c.beginPath(); c.rect(-14, -40, 11, 40); c.rect(4, -40, 11, 40); c.fill(); c.stroke();
  c.fillStyle = ouro;
  c.beginPath(); c.moveTo(-24, -70); c.lineTo(24, -70); c.lineTo(30, -36); c.lineTo(-30, -36); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#a8865a'; c.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 9, -68); c.lineTo(i * 11, -38); c.stroke(); }
  // tronco
  c.strokeStyle = CONT; c.lineWidth = 3;
  c.fillStyle = pele;
  c.beginPath(); c.moveTo(-22, -70); c.lineTo(-30, -122); c.lineTo(30, -122); c.lineTo(22, -70); c.closePath(); c.fill(); c.stroke();
  // colar largo listrado
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i % 2 ? azul : ouro;
    c.beginPath(); c.ellipse(0, -122, 34 - i * 2, 18 - i * 3, 0, 0, Math.PI); c.fill();
  }
  // cabeça de chacal
  c.fillStyle = pele; c.strokeStyle = CONT; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-12, -124); c.lineTo(-14, -146); c.lineTo(-8, -152); c.lineTo(14, -150); c.lineTo(36, -140); c.lineTo(34, -134); c.lineTo(14, -132); c.lineTo(10, -124); c.closePath(); c.fill(); c.stroke();
  // orelhas altas
  c.beginPath(); c.moveTo(-10, -150); c.lineTo(-14, -186); c.lineTo(0, -154); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -152); c.lineTo(2, -188); c.lineTo(10, -152); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = ouro; c.beginPath(); c.moveTo(-11, -156); c.lineTo(-13, -176); c.lineTo(-5, -156); c.fill();
  // touca listrada caindo nos ombros
  for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? azul : ouro; c.fillRect(-18, -146 + i * 7, 8, 7); }
  // olho
  c.fillStyle = prep || fase2 ? '#7dffe8' : '#ffd27a'; c.fillRect(8, -146, 9, 3);
  c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho(prep || fase2 ? 'rgba(80,255,220,.95)' : 'rgba(255,210,110,.9)', 24), 0, -158, 26, 26); c.restore();
  // cajado (com cabeça de animal estilizada)
  let ang = 0.15;
  if (prep && a === 'lancas') ang = -0.9;
  else if (prep && a === 'areia') ang = -0.4 - Math.sin(t * 20) * 0.05;
  else if (golpe && a === 'sombra') ang = en.tE < 0.3 ? -1.4 : 1.5;
  else if (golpe) ang = 0.6;
  c.save(); c.translate(28, -110); c.rotate(ang);
  c.fillStyle = pele; c.beginPath(); c.rect(-5, -4, 10, 26); c.fill(); c.stroke();
  c.strokeStyle = ouro; c.lineWidth = 5;
  c.beginPath(); c.moveTo(0, 90); c.lineTo(0, -70); c.stroke();
  c.beginPath(); c.moveTo(0, 90); c.lineTo(-6, 98); c.moveTo(0, 90); c.lineTo(6, 98); c.stroke();
  c.fillStyle = ouro; c.strokeStyle = CONT; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-3, -70); c.lineTo(10, -82); c.lineTo(14, -76); c.lineTo(4, -66); c.closePath(); c.fill(); c.stroke();
  c.save(); c.globalCompositeOperation = 'lighter';
  const k = prep ? 30 + en.tE * 30 : 18;
  c.drawImage(brilho('rgba(80,255,220,.9)', 32), 6 - k / 2, -76 - k / 2, k, k);
  c.restore();
  c.restore();
  // giro do cajado (sombra)
  if (golpe && a === 'sombra' && en.tE > 0.28 && en.tE < 0.6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,215,130,.85)'; c.lineWidth = 8;
    c.beginPath(); c.ellipse(0, -70, 150, 40, 0, 0, 7); c.stroke();
    c.restore();
  }
  // anel de hieróglifos girando na fase 2
  if (fase2) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(120,255,230,.8)';
    for (let i = 0; i < 8; i++) { const ag = t * 1.5 + i * 0.785; c.fillRect(Math.cos(ag) * 60 - 3, -100 + Math.sin(ag) * 18 - 6, 6, 12); }
    c.restore();
  }
  if (afunda) {
    c.restore();
    // redemoinho de areia onde ele afunda/surge
    const gy = CHAO_Y ? CHAO_Y - en.y : 0;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,200,110,.6)', 48), -90, gy - 50, 180, 70);
    c.restore();
    c.fillStyle = 'rgba(232,194,122,.85)';
    for (let i = 0; i < 10; i++) { const ag = t * 6 + i * 0.63; c.beginPath(); c.arc(Math.cos(ag) * 60, gy - 6 - Math.abs(Math.sin(ag * 1.3)) * 22, 4, 0, 7); c.fill(); }
  }
}

// projéteis novos: 3 meia-lua de sangue · 4 lança dourada · 5 serra rolando · 6 punho-foguete
export function desenharProjetil3(c, p, t) {
  if (p.tipo < 3 || p.tipo > 6) return false;
  c.save(); c.translate(p.x, p.y);
  const dir = p.vx < 0 ? -1 : 1;
  if (p.tipo === 3) {
    c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,30,60,.85)', 48), -46, -50, 92, 100);
    c.scale(dir, 1);
    c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(-20, 0, 24, 0); g.addColorStop(0, 'rgba(120,0,20,0)'); g.addColorStop(0.6, '#d6233f'); g.addColorStop(1, '#ffb3c0');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-6, -38); c.quadraticCurveTo(34, 0, -6, 38); c.quadraticCurveTo(14, 0, -6, -38); c.fill();
    c.fillStyle = '#ff3355';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-14 - i * 9, Math.sin(t * 20 + i) * 18, 3 - i * 0.5, 0, 7); c.fill(); }
  } else if (p.tipo === 4) {
    c.rotate(Math.atan2(p.vy, p.vx));
    c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(80,255,220,.7)', 32), -10, -16, 46, 32);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#e8c27a'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(-34, 0); c.lineTo(14, 0); c.stroke();
    c.fillStyle = '#7dffe8'; c.strokeStyle = CONT; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(12, -6); c.lineTo(30, 0); c.lineTo(12, 6); c.closePath(); c.fill(); c.stroke();
  } else if (p.tipo === 5) {
    c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,150,40,.6)', 32), -34, -34, 68, 68);
    c.globalCompositeOperation = 'source-over';
    // faíscas no chão
    c.fillStyle = '#ffd27a';
    for (let i = 0; i < 4; i++) { const k = (t * 6 + i * 0.25) % 1; c.fillRect(-dir * (8 + k * 30), 24 - k * 22 + Math.sin(i * 3) * 4, 2.5, 2.5); }
    c.rotate(t * 14 * dir);
    c.fillStyle = '#8a8a96'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 21 : 27; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b08a4a'; c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#4a4a56';
    for (let i = 0; i < 4; i++) { const a = i * 1.57; c.beginPath(); c.arc(Math.cos(a) * 16, Math.sin(a) * 16, 3, 0, 7); c.fill(); }
  } else if (p.tipo === 6) {
    c.rotate(Math.atan2(p.vy, p.vx));
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const k = (t * 8 + i / 5) % 1; c.drawImage(brilho('rgba(255,120,30,.8)', 32), -30 - k * 40, -12 - k * 6, 24 + k * 12, 24 + k * 12); }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#b08a4a'; c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.beginPath(); c.rect(-16, -14, 30, 28); c.fill(); c.stroke();
    c.fillStyle = '#4a4a56'; c.beginPath(); c.rect(-26, -8, 12, 16); c.fill(); c.stroke();
    c.strokeStyle = '#6a5228'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(6, -9 + i * 9); c.lineTo(14, -9 + i * 9); c.stroke(); }
  }
  c.restore();
  return true;
}
