import { temSprite, desenharSprite } from './sprites.js';
// Os 6 heróis: números de cada classe e o desenho (boneco articulado, em vetor).
// Cada um tem versão homem e mulher.

export const CLASSES = {
  cavaleiro: {
    nome: 'Cavaleiro', nomeF: 'Cavaleira', cor: '#9fd3ff', vida: 165, vel: 325,
    desc: 'Espada pesada e muita vida. Habilidade: Investida (avança derrubando tudo, sem levar dano).',
    hab: 'Investida', habCd: 5,
    ataques: [
      { dur: 0.36, ini: 0.11, fim: 0.24, dano: 20, alc: 104, alt: 92, kb: 240, tipo: 'corte' },
      { dur: 0.36, ini: 0.11, fim: 0.24, dano: 22, alc: 104, alt: 92, kb: 240, tipo: 'corte' },
      { dur: 0.52, ini: 0.18, fim: 0.32, dano: 38, alc: 124, alt: 112, kb: 460, tipo: 'corte', forte: true },
    ],
  },
  mago: {
    nome: 'Mago', nomeF: 'Maga', cor: '#c79bff', vida: 95, vel: 310,
    desc: 'Ataca de longe com setas de cristal. Habilidade: Chuva de Cristais (meteoros caem à frente).',
    hab: 'Chuva', habCd: 7,
    ataques: [
      { dur: 0.34, ini: 0.12, fim: 0.13, dano: 17, tiro: { vel: 760, raio: 9, perfura: false }, kb: 140 },
      { dur: 0.34, ini: 0.12, fim: 0.13, dano: 17, tiro: { vel: 760, raio: 9, perfura: false }, kb: 140 },
      { dur: 0.5, ini: 0.2, fim: 0.21, dano: 34, tiro: { vel: 640, raio: 16, perfura: true }, kb: 320, forte: true },
    ],
  },
  vampiro: {
    nome: 'Vampiro', nomeF: 'Vampira', cor: '#ff4d6d', vida: 115, vel: 360,
    desc: 'Lâminas de sangue que miram sozinhas e sugam vida. Revoada: vira morcegos, atravessa e marca quem morder. Monstro tonto ou fraco pode ser MORDIDO, e marcado que morre levanta como seu servo.',
    hab: 'Revoada', habCd: 4, rouba: 0.12,
    ataques: [
      // lâminas de sangue: média distância (~260px), atravessam e miram sozinhas
      { dur: 0.26, ini: 0.08, fim: 0.1, dano: 15, tipo: 'estocada', tiro: { vel: 900, raio: 18, perfura: true, sangue: true, vida: 0.3, arco: 1 }, kb: 130 },
      { dur: 0.26, ini: 0.08, fim: 0.1, dano: 15, tipo: 'estocada', tiro: { vel: 900, raio: 18, perfura: true, sangue: true, vida: 0.3, arco: -1 }, kb: 130 },
      { dur: 0.42, ini: 0.14, fim: 0.16, dano: 30, tipo: 'corte', tiro: { vel: 820, raio: 30, perfura: true, sangue: true, vida: 0.36, leque: true }, kb: 320, forte: true },
    ],
  },
  lobisomem: {
    nome: 'Lobisomem', nomeF: 'Loba', cor: '#ffb04d', vida: 145, vel: 350,
    desc: 'Garras largas e selvagens. Habilidade: Fúria Lunar (uiva, empurra todos e fica mais forte e rápido).',
    hab: 'Fúria', habCd: 11,
    ataques: [
      { dur: 0.28, ini: 0.08, fim: 0.18, dano: 17, alc: 70, alt: 70, kb: 180, tipo: 'garra' },
      { dur: 0.28, ini: 0.08, fim: 0.18, dano: 17, alc: 70, alt: 70, kb: 180, tipo: 'garra' },
      { dur: 0.45, ini: 0.14, fim: 0.28, dano: 32, alc: 84, alt: 84, kb: 420, tipo: 'garra', forte: true },
    ],
  },
  monge: {
    nome: 'Monge', nomeF: 'Monja', cor: '#ffd23f', vida: 125, vel: 350, puloDuplo: true,
    desc: 'Socos rapidíssimos e pulo duplo. Habilidade: Chute do Dragão (voadora que atravessa a tela).',
    hab: 'Voadora', habCd: 4,
    ataques: [
      { dur: 0.2, ini: 0.05, fim: 0.12, dano: 11, alc: 58, alt: 44, kb: 90, tipo: 'soco' },
      { dur: 0.2, ini: 0.05, fim: 0.12, dano: 11, alc: 58, alt: 44, kb: 90, tipo: 'soco' },
      { dur: 0.2, ini: 0.05, fim: 0.12, dano: 12, alc: 58, alt: 44, kb: 90, tipo: 'soco' },
      { dur: 0.42, ini: 0.12, fim: 0.25, dano: 30, alc: 70, alt: 60, kb: 440, tipo: 'soco', forte: true },
    ],
  },
  padre: {
    nome: 'Padre', nomeF: 'Sacerdotisa', cor: '#fff3b0', vida: 125, vel: 320,
    desc: 'Maça sagrada e cura em grupo. Habilidade: Luz Sagrada (cura você e os amigos perto e queima os monstros).',
    hab: 'Luz', habCd: 9,
    ataques: [
      { dur: 0.36, ini: 0.12, fim: 0.24, dano: 21, alc: 70, alt: 66, kb: 220, tipo: 'corte' },
      { dur: 0.36, ini: 0.12, fim: 0.24, dano: 21, alc: 70, alt: 66, kb: 220, tipo: 'corte' },
      { dur: 0.5, ini: 0.18, fim: 0.3, dano: 36, alc: 84, alt: 86, kb: 380, tipo: 'corte', forte: true },
    ],
  },
};
export const ORDEM = ['cavaleiro', 'mago', 'vampiro', 'lobisomem', 'monge', 'padre'];
export const nomeClasse = (c, s) => s === 'f' ? CLASSES[c].nomeF : CLASSES[c].nome;

// ---------- aparência ----------
const VISUAL = {
  cavaleiro: { pele: '#f1c9a5', cabeloM: '#6b4a2b', cabeloF: '#f2d16b', roupa: '#c9d3e6', roupa2: '#8d97ad', detalhe: '#e8c76a', capa: '#2f54c8', calca: '#56607a', bota: '#3b4256', luva: '#c9d3e6' },
  mago: { pele: '#efc29b', cabeloM: '#e9e6f2', cabeloF: '#9b5cff', roupa: '#5a2ea8', roupa2: '#3b1d7a', detalhe: '#ffd86b', capa: null, calca: '#3b1d7a', bota: '#2a1450', luva: '#efc29b' },
  vampiro: { pele: '#ece6f3', cabeloM: '#15111c', cabeloF: '#1a1220', roupa: '#44284f', roupa2: '#27142f', detalhe: '#c41e3a', capa: '#8f1028', calca: '#2e1a36', bota: '#170d1c', luva: '#ece6f3' },
  lobisomem: { pele: '#7a6352', peleF: '#b3a596', cabeloM: '#4e3f34', cabeloF: '#e9e1d6', roupa: '#7a6352', roupa2: '#5b493c', detalhe: '#3b3550', capa: null, calca: '#3b3550', bota: '#7a6352', luva: '#7a6352' },
  monge: { pele: '#c98f62', cabeloM: '#2a1d14', cabeloF: '#1d140f', roupa: '#e8862b', roupa2: '#b85f14', detalhe: '#7a2d14', capa: null, calca: '#e8862b', bota: '#c98f62', luva: '#f4ead8' },
  padre: { pele: '#f3d2b3', cabeloM: '#8a6a4a', cabeloF: '#d9a066', roupa: '#f4f1ea', roupa2: '#d8d2c4', detalhe: '#e8c76a', capa: '#e8c76a', calca: '#d8d2c4', bota: '#8a6a4a', luva: '#f3d2b3' },
};
const CONTORNO = '#140d22';

function osso(c, x1, y1, x2, y2, w, cor) {
  c.strokeStyle = CONTORNO; c.lineWidth = w + 3.5;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = cor; c.lineWidth = w;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
const dir = a => [Math.sin(a), Math.cos(a)];
function membro(c, x, y, a1, a2, l1, l2, w1, w2, cor1, cor2) {
  const [s1, c1] = dir(a1), kx = x + s1 * l1, ky = y + c1 * l1;
  const [s2, c2] = dir(a1 + a2), fx = kx + s2 * l2, fy = ky + c2 * l2;
  osso(c, x, y, kx, ky, w1, cor1);
  osso(c, kx, ky, fx, fy, w2, cor2 || cor1);
  return { kx, ky, fx, fy, ang: a1 + a2 };
}
const suave = t => t * t * (3 - 2 * t);

// calcula a pose (ângulos) a partir do estado do herói
export function calcularPose(h, t) {
  const p = {
    pf: 0.12, cf: 0, pt: -0.12, ct: 0,        // pernas: frente/trás (coxa, canela)
    bf: 0.15, af: 0.5, bt: -0.1, at: 0.4,      // braços: frente/trás
    incl: 0, bob: 0, armaOff: Math.PI / 2, rot: 0, deitado: false,
    src: { anim: h.anim, fase: h.fase, combo: h.combo, vy: h.vy, passo: h.passo, fimRel: h.ataqueInfo && h.ataqueInfo.fimRel },
  };
  const e = h.anim;
  const resp = Math.sin(t * 2.4) * 1.2;
  if (e === 'correr') {
    const ph = h.passo;
    p.pf = 0.8 * Math.sin(ph); p.cf = -0.15 - 1.0 * Math.max(0, -Math.cos(ph));
    p.pt = 0.8 * Math.sin(ph + Math.PI); p.ct = -0.15 - 1.0 * Math.max(0, -Math.cos(ph + Math.PI));
    p.bf = -0.7 * Math.sin(ph); p.af = 0.9; p.bt = 0.7 * Math.sin(ph); p.at = 0.9;
    p.incl = 0.12; p.bob = -Math.abs(Math.sin(ph)) * 3;
  } else if (e === 'pular') {
    p.pf = 0.95; p.cf = -1.3; p.pt = -0.25; p.ct = -0.7; p.bf = 2.4; p.af = 0.4; p.bt = -0.8; p.at = 0.6;
  } else if (e === 'cair') {
    p.pf = 0.35; p.cf = -0.5; p.pt = -0.35; p.ct = -0.3; p.bf = 2.0; p.af = 0.5; p.bt = 1.8; p.at = 0.4;
  } else if (e === 'rolar') {
    p.pf = 0.9; p.cf = -0.6; p.pt = -0.9; p.ct = -0.4; p.bf = -1.0; p.af = 0.4; p.bt = -1.2; p.at = 0.3; p.incl = 0.45;
  } else if (e === 'ferido') {
    p.incl = -0.25; p.bf = -0.6; p.bt = -0.9; p.pf = 0.3; p.pt = -0.3;
  } else if (e === 'caido') {
    p.deitado = true; p.pf = 0.1; p.pt = -0.1; p.bf = 2.6; p.bt = 2.2;
  } else if (e === 'parado') {
    p.bob = resp * 0.6; p.bf = -0.45 + Math.sin(t * 2.4) * 0.04; p.af = 1.0;
  }
  if (e === 'atacar' || e === 'hab') {
    const at = h.ataqueInfo || {};
    const f = suave(Math.min(1, h.fase / Math.max(0.01, (at.fimRel ?? 0.6))));
    const cl = h.classe, combo = h.combo || 0;
    p.incl = 0.18; p.pf = 0.5; p.cf = -0.3; p.pt = -0.45; p.ct = -0.2;
    if (e === 'hab' && cl === 'padre') { p.bf = 3.0; p.af = 0.1; p.bt = 2.8; p.at = 0.1; p.incl = -0.1; }
    else if (e === 'hab' && cl === 'lobisomem') { p.bf = 2.4; p.af = 0.8; p.bt = 2.2; p.at = 0.8; p.incl = -0.35; }
    else if (e === 'hab' && cl === 'monge') { p.pf = 1.6; p.cf = 0; p.pt = -0.6; p.ct = -1.4; p.bf = 1.9; p.af = 0.4; p.bt = 2.4; p.at = 0.6; p.incl = 0.5; }
    else if (e === 'hab' && cl === 'cavaleiro') { p.bt = 1.55; p.at = 0.2; p.bf = -0.4; p.af = 0.9; p.incl = 0.3; }
    else if (e === 'hab' && cl === 'mago') { p.bf = 2.8; p.af = 0.2; p.armaOff = 0.2; p.incl = -0.15; }
    else if (cl === 'mago') { p.bf = 0.5 + 1.1 * f; p.af = 0.1; p.armaOff = Math.PI / 2 - 0.9 * f; }
    else if (cl === 'monge') {
      const esq = combo % 2 === 1;
      if (combo === 3) { p.pf = 1.7 * f; p.cf = 0; p.incl = -0.2; p.bf = 0.4; p.bt = 1.0; }
      else if (esq) { p.bt = 0.4 + 1.2 * f; p.at = 0.1 * (1 - f); p.bf = 0.9; p.af = 1.6; }
      else { p.bf = 0.4 + 1.2 * f; p.af = 0.1 * (1 - f); p.bt = 0.9; p.at = 1.6; }
    } else if (cl === 'vampiro' && combo < 2) {
      p.bf = 0.8 + 0.77 * f; p.af = 0.6 * (1 - f); p.armaOff = 0.05; p.incl = 0.25;
    } else if (cl === 'lobisomem') {
      const esq = combo === 1;
      const a = -2.6 + 3.9 * f;
      if (esq) { p.bt = a; p.at = 0.2; p.bf = 0.6; } else { p.bf = a; p.af = 0.2; p.bt = 0.6; }
      if (combo === 2) { p.bt = a; p.at = 0.2; }
    } else {
      p.bf = -2.7 + 4.1 * f; p.af = 0.15; p.armaOff = 0.15 + 0.4 * (1 - f);
    }
  }
  return p;
}

// desenha o herói com os pés em (0,0), virado para a direita (quem chama inverte)
export function desenharHeroi(c, classe, sexo, p, t, extra = {}) {
  if (p.src && temSprite(classe, sexo)) { desenharSprite(c, classe, sexo, p.src, t, p.src.anim === 'rolar' ? 0.18 : 1); return; }
  const V = VISUAL[classe], F = sexo === 'f';
  const pele = classe === 'lobisomem' && F ? V.peleF : V.pele;
  const roupa = classe === 'lobisomem' && F ? V.peleF : V.roupa;
  c.save();
  if (p.src && p.src.anim === 'rolar') c.globalAlpha *= 0.18;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (p.deitado) { c.translate(-30, -6); c.rotate(-Math.PI / 2 + 0.08); c.translate(0, 34); }
  if (p.rot) { c.translate(0, -30 + p.bob); c.rotate(p.rot); c.translate(0, 30 - p.bob); }
  c.translate(0, p.bob);
  const quadril = { x: 0, y: -38 };
  c.save(); c.translate(0, -38); c.rotate(p.incl); c.translate(0, 38);
  const omb = { x: 1, y: -63 };
  const largO = F ? 8 : 11;

  // capa (atrás de tudo)
  if (V.capa) {
    const vento = Math.sin(t * 3) * 3 + (extra.vx ? -Math.min(14, Math.abs(extra.vx) * 0.04) : 0);
    c.fillStyle = V.capa; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    c.beginPath(); c.moveTo(omb.x - 6, omb.y);
    c.quadraticCurveTo(-18 + vento, -36, -22 + vento * 1.6, classe === 'padre' ? -34 : -14);
    c.lineTo(-8 + vento, classe === 'padre' ? -38 : -16); c.lineTo(omb.x + 4, omb.y + 4); c.closePath(); c.fill(); c.stroke();
  }
  // cabelo comprido (atrás)
  if (F && classe !== 'monge') {
    const cab = V.cabeloF;
    c.fillStyle = cab; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    const s = Math.sin(t * 3) * 2;
    c.beginPath(); c.moveTo(-2, -86); c.quadraticCurveTo(-16 + s, -70, -12 + s, classe === 'cavaleiro' ? -60 : -50); c.quadraticCurveTo(-4, -56, 4, -70); c.closePath(); c.fill(); c.stroke();
  }

  // braço de trás
  const bt = membro(c, omb.x - 2, omb.y + 2, p.bt, p.at, 13, 13, 7, 6, classe === 'cavaleiro' ? V.roupa2 : roupaBraco(classe, V, F), classe === 'monge' ? pele : (classe === 'lobisomem' ? pele : (classe === 'cavaleiro' ? V.roupa2 : roupaBraco(classe, V, F))));
  maoEArmaTras(c, classe, V, bt, pele);
  // perna de trás
  membro(c, quadril.x - 2, quadril.y, p.pt, p.ct, 18, 19, 8.5, 7, sombra(V.calca), sombra(V.bota));

  // tronco
  tronco(c, classe, V, F, roupa, pele, t);

  // perna da frente
  membro(c, quadril.x + 2, quadril.y, p.pf, p.cf, 18, 19, 9, 7.5, V.calca, V.bota);

  // saia/túnica longa por cima das pernas
  if (classe === 'mago' || classe === 'padre') {
    const g = c.createLinearGradient(0, -46, 0, -8);
    g.addColorStop(0, roupa); g.addColorStop(1, V.roupa2);
    c.fillStyle = g; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    const abre = Math.min(10, Math.abs(p.pf - p.pt) * 8);
    c.beginPath(); c.moveTo(-9, -44); c.lineTo(8, -44); c.lineTo(13 + abre, -10); c.quadraticCurveTo(0, -6, -14 - abre * 0.6, -10); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = V.detalhe; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(12 + abre, -12); c.quadraticCurveTo(0, -8, -13 - abre * 0.6, -12); c.stroke();
    if (classe === 'padre') { c.fillStyle = V.detalhe; c.fillRect(1, -44, 4, 32); }
  }
  if (classe === 'vampiro') {
    c.fillStyle = V.roupa; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-9, -44); c.lineTo(-17, -16); c.lineTo(-6, -20); c.lineTo(-2, -42); c.closePath(); c.fill(); c.stroke();
  }

  // cabeça
  cabeca(c, classe, V, F, pele, t, extra);
  c.restore(); // inclinação do tronco

  // braço da frente (por cima) — gira junto com o tronco
  c.save(); c.translate(0, -38); c.rotate(p.incl); c.translate(0, 38);
  const bf = membro(c, omb.x + 2, omb.y + 2, p.bf, p.af, 13, 13, 7.5, 6.5, roupaBraco(classe, V, F), classe === 'monge' || classe === 'lobisomem' ? pele : roupaBraco(classe, V, F));
  maoEArma(c, classe, V, bf, p, pele, t, extra);
  c.restore();
  c.restore();
}

const sombra = cor => cor;
function roupaBraco(classe, V, F) {
  if (classe === 'lobisomem') return F ? V.peleF : V.pele;
  if (classe === 'monge') return V.roupa;
  return V.roupa;
}

function tronco(c, classe, V, F, roupa, pele, t) {
  c.strokeStyle = CONTORNO; c.lineWidth = 2.5;
  const path = () => {
    c.beginPath();
    if (F) {
      c.moveTo(-7, -64);
      c.lineTo(5, -65);
      c.quadraticCurveTo(20, -63, 17, -54);   // busto
      c.quadraticCurveTo(15, -48, 6, -48);
      c.quadraticCurveTo(5, -46, 7, -42);
      c.quadraticCurveTo(9, -38, 9, -36);
      c.lineTo(-10, -36);
      c.quadraticCurveTo(-8, -44, -6, -48);
      c.quadraticCurveTo(-9, -56, -7, -64);
    } else {
      c.moveTo(-9, -65); c.lineTo(8, -65);
      c.quadraticCurveTo(12, -58, 9, -50); c.lineTo(9, -36); c.lineTo(-9, -36);
      c.quadraticCurveTo(-11, -50, -9, -65);
    }
    c.closePath();
  };
  // base
  const g = c.createLinearGradient(-10, -64, 12, -38);
  if (classe === 'cavaleiro') { g.addColorStop(0, '#eef3ff'); g.addColorStop(0.5, V.roupa); g.addColorStop(1, V.roupa2); }
  else if (classe === 'lobisomem') { g.addColorStop(0, roupa); g.addColorStop(1, F ? '#8d7f72' : V.roupa2); }
  else { g.addColorStop(0, roupa); g.addColorStop(1, V.roupa2); }
  c.fillStyle = g; path(); c.fill(); c.stroke();

  c.save(); path(); c.clip();
  if (classe === 'cavaleiro') {
    c.strokeStyle = V.detalhe; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-9, -44); c.lineTo(12, -44); c.stroke();
    c.beginPath(); c.moveTo(1, -64); c.lineTo(1, -44); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(F ? 8 : 4, -57, 3, 5, 0.4, 0, 7); c.fill();
    c.fillStyle = V.capa; c.fillRect(-10, -42, 22, 6);
  } else if (classe === 'mago') {
    c.fillStyle = V.detalhe; c.fillRect(-12, -46, 26, 3);
    c.fillStyle = 'rgba(255,216,107,.8)';
    for (let i = 0; i < 4; i++) estrela(c, -4 + (i % 2) * 8, -60 + i * 4, 1.8);
    c.strokeStyle = V.roupa2; c.lineWidth = 3; c.beginPath(); c.moveTo(-2, -65); c.lineTo(4, -48); c.stroke();
  } else if (classe === 'vampiro') {
    c.fillStyle = '#f2ecf5'; c.beginPath(); c.moveTo(-1, -65); c.lineTo(F ? 6 : 8, -65); c.lineTo(3, -52); c.closePath(); c.fill();
    c.fillStyle = V.detalhe; c.beginPath(); c.arc(3, -58, 2.2, 0, 7); c.fill();
    c.strokeStyle = V.detalhe; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-9, -40); c.lineTo(12, -40); c.stroke();
  } else if (classe === 'lobisomem') {
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-6 + i * 3, -60 + (i % 2) * 6); c.lineTo(-8 + i * 3, -55 + (i % 2) * 6); c.stroke(); }
    if (F) { c.fillStyle = '#3b3550'; c.beginPath(); c.moveTo(-8, -62); c.lineTo(14, -62); c.lineTo(13, -51); c.lineTo(-8, -51); c.closePath(); c.fill(); }
    c.fillStyle = V.detalhe; c.fillRect(-10, -40, 22, 4);
  } else if (classe === 'monge') {
    c.fillStyle = pele;
    c.beginPath(); c.moveTo(-1, -66); c.lineTo(F ? 9 : 10, -66); c.lineTo(F ? 6 : 6, -54); c.closePath(); c.fill();
    c.fillStyle = V.detalhe; c.fillRect(-10, -45, 22, 5);
    c.fillStyle = '#5a3a1a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-4 + i * 2.4, -62 + i * 1.4, 1.5, 0, 7); c.fill(); }
  } else if (classe === 'padre') {
    c.fillStyle = V.detalhe; c.fillRect(-1, -65, 5, 30);
    c.fillStyle = '#c9a54a'; c.fillRect(-4, -58, 11, 2.5); c.fillRect(0, -61, 3, 9);
  }
  c.restore();
  if (F) { c.strokeStyle = 'rgba(20,13,34,.45)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(16, -55); c.quadraticCurveTo(14, -48.5, 6, -48.5); c.stroke(); }
}

function estrela(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

function cabeca(c, classe, V, F, pele, t, extra) {
  const hx = 2, hy = -76;
  c.strokeStyle = CONTORNO; c.lineWidth = 2.5;
  // pescoço
  osso(c, 1, -66, 2, -70, 5, pele);
  if (classe === 'lobisomem') {
    const pel = F ? V.peleF : V.pele;
    // orelhas
    c.fillStyle = pel;
    c.beginPath(); c.moveTo(-6, -82); c.lineTo(-4, -96); c.lineTo(2, -85); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-1, -84); c.lineTo(3, -97); c.lineTo(7, -84); c.closePath(); c.fill(); c.stroke();
    // cabeça + focinho
    c.beginPath(); c.ellipse(hx - 1, hy, 9.5, 9, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(hx + 4, hy - 4); c.quadraticCurveTo(hx + 18, hy - 3, hx + 19, hy + 2); c.lineTo(hx + 4, hy + 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1a1018'; c.beginPath(); c.arc(hx + 18.5, hy - 0.5, 2, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx + 9, hy + 4); c.lineTo(hx + 10, hy + 7); c.lineTo(hx + 11, hy + 4); c.fill();
    c.fillStyle = extra.furia ? '#ff3030' : '#ffcc33'; c.beginPath(); c.ellipse(hx + 5, hy - 3, 2.2, 1.6, 0, 0, 7); c.fill();
    // juba
    c.fillStyle = F ? V.cabeloF : V.cabeloM;
    c.beginPath(); c.moveTo(hx - 9, hy - 6); c.quadraticCurveTo(hx - 18, hy + 4, hx - 10, F ? hy + 22 : hy + 12); c.lineTo(hx - 4, hy + 6); c.closePath(); c.fill();
    return;
  }
  // rosto
  c.fillStyle = pele;
  c.beginPath(); c.arc(hx, hy, 9.5, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(hx + 8, hy - 1); c.lineTo(hx + 11, hy + 2); c.lineTo(hx + 8, hy + 3); c.fill();
  // olho
  const olho = classe === 'vampiro' ? '#ff2244' : '#1a1430';
  c.fillStyle = olho; c.beginPath(); c.ellipse(hx + 5, hy - 1.5, 1.6, F ? 2.2 : 1.9, 0, 0, 7); c.fill();
  if (F) { c.strokeStyle = CONTORNO; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hx + 3.5, hy - 4); c.lineTo(hx + 7.5, hy - 4.6); c.stroke(); }
  c.strokeStyle = F ? '#c4485f' : '#7a3a2a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx + 5, hy + 4.5); c.lineTo(hx + 8, hy + 4.2); c.stroke();
  if (classe === 'vampiro') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx + 6, hy + 4.5); c.lineTo(hx + 6.6, hy + 7); c.lineTo(hx + 7.2, hy + 4.5); c.fill(); }
  c.strokeStyle = CONTORNO; c.lineWidth = 2;
  const cab = F ? V.cabeloF : V.cabeloM;

  if (classe === 'cavaleiro') {
    if (F) {
      c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 3, 9.6, Math.PI * 0.9, Math.PI * 2.05); c.fill();
      c.fillStyle = '#c9d3e6'; c.beginPath(); c.moveTo(hx - 10, hy - 4); c.quadraticCurveTo(hx, hy - 16, hx + 10, hy - 6); c.lineTo(hx + 9, hy - 3); c.quadraticCurveTo(hx, hy - 10, hx - 10, hy - 1); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = V.detalhe; c.beginPath(); c.arc(hx + 1, hy - 10, 2, 0, 7); c.fill();
    } else {
      c.fillStyle = '#c9d3e6';
      c.beginPath(); c.arc(hx, hy - 1, 10.5, Math.PI * 0.95, Math.PI * 2.25); c.lineTo(hx + 10, hy + 7); c.lineTo(hx - 9, hy + 7); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = CONTORNO; c.fillRect(hx + 1, hy - 3, 10, 2.4);
      c.strokeStyle = V.detalhe; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, hy - 11); c.lineTo(hx, hy + 6); c.stroke();
      // pluma
      c.fillStyle = '#d8312f'; c.beginPath(); c.moveTo(hx - 2, hy - 11); c.quadraticCurveTo(hx - 16, hy - 20 + Math.sin(t * 4), hx - 20, hy - 4); c.quadraticCurveTo(hx - 10, hy - 10, hx - 2, hy - 8); c.fill();
    }
  } else if (classe === 'mago') {
    if (!F) { c.fillStyle = cab; c.beginPath(); c.moveTo(hx + 2, hy + 2); c.quadraticCurveTo(hx + 12, hy + 6, hx + 6, hy + 18); c.quadraticCurveTo(hx + 1, hy + 10, hx - 3, hy + 3); c.fill(); c.stroke(); }
    else { c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 2, 10, Math.PI * 0.85, Math.PI * 1.95); c.fill(); }
    c.fillStyle = V.roupa; c.strokeStyle = CONTORNO;
    c.beginPath(); c.moveTo(hx - 15, hy - 6); c.quadraticCurveTo(hx, hy - 10, hx + 15, hy - 5); c.lineTo(hx + 4, hy - 11);
    c.quadraticCurveTo(hx - 2 + Math.sin(t * 2) * 2, hy - 26, hx - 14, hy - 34); c.quadraticCurveTo(hx - 4, hy - 20, hx - 7, hy - 11); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = V.detalhe; c.fillRect(hx - 7, hy - 11, 12, 2.5); estrela(c, hx - 3, hy - 19, 2.6);
  } else if (classe === 'vampiro') {
    c.fillStyle = cab;
    if (F) {
      c.beginPath(); c.arc(hx - 1, hy - 2, 10, Math.PI * 0.8, Math.PI * 2.0); c.fill();
      c.fillStyle = V.detalhe; c.fillRect(hx - 4, hy - 11, 2, 7);
    } else {
      c.beginPath(); c.arc(hx - 1, hy - 2, 10, Math.PI * 0.95, Math.PI * 1.9); c.lineTo(hx + 3, hy - 5); c.closePath(); c.fill();
    }
    // gola alta
    c.fillStyle = V.capa; c.beginPath(); c.moveTo(hx - 12, hy + 12); c.lineTo(hx - 15, hy - 4); c.lineTo(hx - 5, hy + 9); c.closePath(); c.fill(); c.stroke();
  } else if (classe === 'monge') {
    if (F) {
      c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 3, 9.7, Math.PI * 0.95, Math.PI * 2.0); c.fill();
      c.beginPath(); c.arc(hx - 5, hy - 12, 4.5, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#d8312f'; c.fillRect(hx - 9, hy - 6, 18, 2.2);
    } else {
      c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.arc(hx - 1, hy - 4, 8, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#5a3a1a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(hx - 4 + i * 3, hy - 8 - (i % 2), 0.9, 0, 7); c.fill(); }
    }
  } else if (classe === 'padre') {
    // auréola
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,230,140,.85)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(hx - 1, hy - 15, 9, 2.6, 0, 0, 7); c.stroke(); c.restore();
    if (F) {
      c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 1, 9.6, Math.PI * 0.85, Math.PI * 1.95); c.fill();
      c.fillStyle = V.roupa; c.beginPath(); c.moveTo(hx - 12, hy + 12); c.quadraticCurveTo(hx - 14, hy - 12, hx + 1, hy - 11); c.quadraticCurveTo(hx + 8, hy - 11, hx + 9, hy - 6); c.quadraticCurveTo(hx - 4, hy - 8, hx - 6, hy + 10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = V.detalhe; c.fillRect(hx - 2, hy - 11, 9, 2);
    } else {
      c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 1, 9.8, Math.PI * 0.85, Math.PI * 1.55); c.lineTo(hx - 1, hy - 6); c.fill();
      c.fillStyle = 'rgba(0,0,0,.1)'; c.beginPath(); c.arc(hx - 1, hy - 7, 4, 0, 7); c.fill();
    }
  }
  if (F && classe !== 'cavaleiro' && classe !== 'monge' && classe !== 'padre' && classe !== 'mago' && classe !== 'vampiro') {
    c.fillStyle = cab; c.beginPath(); c.arc(hx - 1, hy - 2, 10, Math.PI * 0.85, Math.PI * 1.95); c.fill();
  }
}

function maoEArmaTras(c, classe, V, m, pele) {
  if (classe === 'cavaleiro') {
    // escudo no braço de trás
    c.save(); c.translate(m.fx, m.fy - 2);
    c.fillStyle = '#2f54c8'; c.strokeStyle = CONTORNO; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-10, -14); c.lineTo(10, -14); c.lineTo(10, 2); c.quadraticCurveTo(8, 12, 0, 18); c.quadraticCurveTo(-8, 12, -10, 2); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#e8c76a'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#e8c76a'; c.fillRect(-1.5, -10, 3, 20); c.fillRect(-7, -4, 14, 3);
    c.restore();
    return;
  }
  mao(c, classe, V, m, pele);
}
function mao(c, classe, V, m, pele) {
  const cor = classe === 'monge' ? '#f4ead8' : classe === 'cavaleiro' ? '#c9d3e6' : (classe === 'lobisomem' ? m.cor || pele : pele);
  c.fillStyle = cor; c.strokeStyle = CONTORNO; c.lineWidth = 2;
  c.beginPath(); c.arc(m.fx, m.fy, classe === 'monge' ? 4.6 : 3.8, 0, 7); c.fill(); c.stroke();
  if (classe === 'lobisomem') {
    c.strokeStyle = '#f4f0e6'; c.lineWidth = 1.8;
    const [s, k] = [Math.sin(m.ang), Math.cos(m.ang)];
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(m.fx + s * 3 + i * 2 * k, m.fy + k * 3 - i * 2 * s); c.lineTo(m.fx + s * 9 + i * 3 * k, m.fy + k * 9 - i * 3 * s); c.stroke(); }
  }
}

function maoEArma(c, classe, V, m, p, pele, t, extra) {
  const a = m.ang + p.armaOff;
  const [s, k] = [Math.sin(a), Math.cos(a)];
  c.save(); c.translate(m.fx, m.fy); c.rotate(-a + Math.PI / 2);   // eixo +x = direção da arma
  if (classe === 'cavaleiro') {
    c.fillStyle = '#5b3a1e'; c.fillRect(-8, -2.5, 10, 5);
    c.fillStyle = '#e8c76a'; c.fillRect(1, -8, 4, 16);
    const g = c.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9fb0cc');
    c.fillStyle = g; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    c.beginPath(); c.moveTo(5, -3.5); c.lineTo(52, -3); c.lineTo(60, 0); c.lineTo(52, 3); c.lineTo(5, 3.5); c.closePath(); c.fill(); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(159,211,255,.35)'; c.fillRect(8, -1, 46, 2); c.restore();
  } else if (classe === 'mago') {
    c.fillStyle = '#6b4a2b'; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    c.beginPath(); c.rect(-26, -2.5, 82, 5); c.fill(); c.stroke();
    c.fillStyle = '#e8c76a'; c.fillRect(48, -4.5, 6, 9);
    c.save(); c.globalCompositeOperation = 'lighter';
    const pul = 0.8 + 0.2 * Math.sin(t * 6);
    c.fillStyle = 'rgba(199,155,255,.35)'; c.beginPath(); c.arc(62, 0, 16 * pul, 0, 7); c.fill(); c.restore();
    c.save(); c.translate(62, 0); c.rotate(Math.PI / 2);
    c.fillStyle = '#e8d5ff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(6, 0); c.lineTo(0, 10); c.lineTo(-6, 0); c.closePath(); c.fill(); c.stroke();
    c.restore();
  } else if (classe === 'vampiro') {
    c.fillStyle = '#c41e3a'; c.strokeStyle = CONTORNO; c.lineWidth = 1.5;
    c.beginPath(); c.arc(2, 0, 6, -1.4, 1.4); c.fill(); c.stroke();
    c.strokeStyle = CONTORNO; c.lineWidth = 4; c.beginPath(); c.moveTo(4, 0); c.lineTo(58, 0); c.stroke();
    c.strokeStyle = '#e6e9f2'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 0); c.lineTo(58, 0); c.stroke();
  } else if (classe === 'padre') {
    c.fillStyle = '#7a5a2a'; c.strokeStyle = CONTORNO; c.lineWidth = 2;
    c.beginPath(); c.rect(-6, -2.5, 36, 5); c.fill(); c.stroke();
    c.fillStyle = '#e8c76a'; c.beginPath(); c.arc(36, 0, 8, 0, 7); c.fill(); c.stroke();
    for (let i = 0; i < 6; i++) { const aa = i * Math.PI / 3; c.beginPath(); c.moveTo(36 + Math.cos(aa) * 7, Math.sin(aa) * 7); c.lineTo(36 + Math.cos(aa) * 12, Math.sin(aa) * 12); c.stroke(); }
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,243,176,.35)'; c.beginPath(); c.arc(36, 0, 14, 0, 7); c.fill(); c.restore();
  }
  c.restore();
  if (classe !== 'padre' || true) mao(c, classe, V, { ...m, cor: classe === 'lobisomem' ? pele : null }, pele);
}
