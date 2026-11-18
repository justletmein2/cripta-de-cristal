// Espetáculo do combate: quadro de impacto, imagens fantasmas, especial com corte de cena e ecos.
// O jogo principal passa um "J" com o que este módulo precisa (estado da partida e funções de dano/efeito).
import { brilho, rgba, cristal } from './arte.js';
import { CLASSES, nomeClasse, calcularPose, desenharHeroi } from './herois.js';
import { temSprite } from './sprites.js';
import { clamp, sinal } from './util.js';

let J = null;
export function ligarEspetaculo(api) { J = api; }
export const config = { flashes: localStorage.getItem('cc_flashes') !== '0' };
export function alternarFlashes() { config.flashes = !config.flashes; localStorage.setItem('cc_flashes', config.flashes ? '1' : '0'); return config.flashes; }

// ---------- retratos pro corte de cena ----------
const retratos = {};
for (const n of ['cavaleiro_f', 'cavaleiro_m', 'mago_f']) { const i = new Image(); i.src = `sprites/retrato_${n}.webp`; retratos[n] = i; }

// ---------- quadro de impacto ----------
let ultimoImpacto = 0;
export function impacto(x, y, forca = 1) {
  const P = J.P();
  if (!config.flashes || P.t - ultimoImpacto < 0.4) return;
  ultimoImpacto = P.t;
  P.impacto = { x, y, t: 0, dur: 0.07 + 0.03 * forca, rot: Math.random() };
}

// ---------- imagens fantasmas (rastro do herói) ----------
export function fantasma(classe, sexo, pose, x, y, d, cor, vida = 0.25) {
  const P = J.P();
  P.fantasmas.push({ classe, sexo, pose, x, y, d, cor, t: 0, vida });
  if (P.fantasmas.length > 40) P.fantasmas.shift();
}

// ---------- especial ----------
const ESPECIAIS = {
  cavaleiro: { nome: 'CORTE ASTRAL', cor: 'rgba(110,170,255,.95)' },
  mago: { nome: 'JULGAMENTO PRISMÁTICO', cor: 'rgba(170,110,255,.95)' },
  vampiro: { nome: 'BANQUETE RUBRO', cor: 'rgba(200,30,60,.95)' },
  lobisomem: { nome: 'LUA SELVAGEM', cor: 'rgba(255,150,40,.95)' },
  monge: { nome: 'CEM PUNHOS', cor: 'rgba(255,200,40,.95)' },
  padre: { nome: 'JUÍZO CELESTIAL', cor: 'rgba(255,235,150,.95)' },
};
export const ESP_MAX = 100;
export function ganharEspecial(v) { const h = J.P().eu; h.esp = Math.min(ESP_MAX, (h.esp || 0) + v); }
export function podeEspecial() { const P = J.P(), h = P.eu; return (h.esp || 0) >= ESP_MAX && !P.cutin && !P.espAtivo && !h.caido; }

export function soltarEspecial() {
  const P = J.P(), h = P.eu;
  if (!podeEspecial()) return false;
  h.esp = 0; h.invT = Math.max(h.invT, 2.2); h.atk = null;
  const E = ESPECIAIS[h.classe];
  P.cutin = { t: 0, dur: 0.85, classe: h.classe, sexo: h.sexo, nome: E.nome, cor: E.cor };
  J.som.especial();
  return true;
}
// alvos na tela, perto do herói
function alvosNaTela(raioX = 600, raioY = 300, cx, cy) {
  const P = J.P(), h = P.eu;
  cx = cx ?? h.x; cy = cy ?? h.y - 40;
  return [...P.ini.values()].filter(e => e.hp > 0 && Math.abs(e.x - cx) < raioX && Math.abs((e.y - e.h / 2) - cy) < raioY);
}
function agendar(t, fn) { J.P().espFila.push({ t, fn }); }

// executa o especial depois do corte de cena (chamado pelo atualizar)
function executar(classe) {
  const P = J.P(), h = P.eu, base = CLASSES[classe].ataques[0].dano;
  P.espAtivo = { t: 0, classe, dur: 1.4 };
  J.enviarFx('esp_' + classe);
  efeitoEspecial(classe, h.x, h.y, h.d, true);
  const bater = (alvos, mult, kb = 120, lanca = false) => { for (const e of alvos) { h.d = sinal(e.x - h.x) || h.d; J.golpear(e, base * mult, kb, true, e.x, e.y - e.h / 2, lanca); } };
  if (classe === 'cavaleiro') {
    // atravessa a tela deixando fantasmas e corta tudo
    const dx = h.d * 420;
    for (let i = 0; i < 7; i++) agendar(i * 0.04, () => { fantasma(h.classe, h.sexo, calcularPose({ anim: 'atacar', fase: (i % 3) / 3 + 0.2, combo: i % 3, classe: h.classe, ataqueInfo: { fimRel: 0.67 } }, P.t), h.x, h.y, h.d, '#9fe8ff', 0.5); const nx = h.x + dx / 7; if (J.livre(nx, h.y)) h.x = nx; });
    for (let k = 0; k < 4; k++) agendar(0.32 + k * 0.1, () => { const a = alvosNaTela(); bater(a, 1.6, 160); if (k === 3) { J.impacto(h.x, h.y - 50, 2); bater(a, 2.4, 420); } });
  } else if (classe === 'mago') {
    const alvo = J.inimigoMaisPerto(h, 700) || { x: h.x + h.d * 260, y: h.y };
    P.espAtivo.cx = alvo.x; P.espAtivo.cy = alvo.y;
    for (let k = 0; k < 4; k++) agendar(0.35 + k * 0.15, () => { const a = alvosNaTela(300, 240, alvo.x, alvo.y - 40); bater(a, 1.5, 80, k === 0); if (k === 3) J.impacto(alvo.x, alvo.y - 60, 2); });
  } else if (classe === 'vampiro') {
    for (let k = 0; k < 5; k++) agendar(0.2 + k * 0.14, () => { const a = alvosNaTela(); bater(a, 1.1, 60); h.hp = Math.min(h.mhp, h.hp + h.mhp * 0.06 * a.length); if (k === 4) J.impacto(h.x, h.y - 50, 1); });
  } else if (classe === 'lobisomem') {
    for (let k = 0; k < 8; k++) agendar(0.1 + k * 0.07, () => { const a = alvosNaTela(320, 220); bater(a, 0.8, 140); if (a[0]) fantasma(h.classe, h.sexo, calcularPose({ anim: 'atacar', fase: 0.5, combo: k % 3, classe: h.classe, ataqueInfo: { fimRel: 0.6 } }, P.t), a[0].x - h.d * 40, a[0].y, h.d, '#ffb04d', 0.3); if (k === 7) J.impacto(h.x, h.y - 50, 2); });
  } else if (classe === 'monge') {
    for (let k = 0; k < 12; k++) agendar(0.08 + k * 0.05, () => { const a = alvosNaTela(220, 140, h.x + h.d * 110); bater(a, 0.5, 40); if (k === 11) { bater(a, 2.2, 520); J.impacto(h.x + h.d * 100, h.y - 50, 2); } });
  } else if (classe === 'padre') {
    for (let k = 0; k < 3; k++) agendar(0.3 + k * 0.2, () => { const a = alvosNaTela(); bater(a, 1.6, 60); if (k === 2) J.impacto(h.x, h.y - 50, 1); });
    h.hp = Math.min(h.mhp, h.hp + h.mhp * 0.5);
  }
}

// efeito visual do especial (o meu e o dos amigos)
export function efeitoEspecial(classe, x, y, d, meu) {
  const P = J.P();
  P.espFx.push({ classe, x, y, d, t: 0, dur: 1.4, cx: x + d * 260, cy: y, seed: Math.random() * 99 });
  J.som.especialSolto(classe);
}

// ---------- ecos (bênçãos que viram efeitos automáticos) ----------
export const ECOS = [
  { id: 'eco_lamina', ic: '👻', nome: 'Eco: Lâmina Fantasma', txt: 'A cada 3 golpes, uma cópia dourada sua ataca junto' },
  { id: 'eco_raio', ic: '⚡', nome: 'Eco: Corrente de Raios', txt: 'Críticos soltam um raio que pula entre monstros' },
  { id: 'eco_orbe', ic: '🔮', nome: 'Eco: Orbe Satélite', txt: 'Um cristal gira em volta de você e bate em quem chegar perto' },
  { id: 'eco_brasa', ic: '🔥', nome: 'Eco: Rastro de Brasas', txt: 'O blink deixa um rastro de fogo que queima' },
  { id: 'eco_estilhaco', ic: '💎', nome: 'Eco: Estilhaço', txt: 'Monstros que você derruba explodem em cacos' },
];
export const nivelEco = (h, id) => (h.ecos && h.ecos[id]) || 0;

// chamado a cada golpe que eu acerto
export function aoAcertar(en, dano, crit, deEco) {
  const P = J.P(), h = P.eu;
  ganharEspecial(deEco ? 0.6 : 2.4);
  en.meuGolpeT = P.t;
  if (deEco) return;
  const nl = nivelEco(h, 'eco_lamina');
  if (nl && ++h.contLamina >= 3) {
    h.contLamina = 0;
    const lado = sinal(en.x - h.x) || h.d;
    fantasma(h.classe, h.sexo, calcularPose({ anim: 'atacar', fase: 0.55, combo: 2, classe: h.classe, ataqueInfo: { fimRel: 0.67 } }, P.t), en.x - lado * 50, en.y, lado, '#ffd86b', 0.4);
    P.luas.push({ x: en.x, y: en.y - en.h / 2, d: lado, t: 0, dur: 0.3, cor: 'rgba(255,216,107,.9)', r: 70 });
    J.golpear(en, dano * (0.5 + 0.2 * nl), 140, true, en.x, en.y - en.h / 2, false, true);
  }
  const nr = nivelEco(h, 'eco_raio');
  if (nr && crit) {
    const pts = [en];
    let atual = en;
    for (let i = 0; i < 2 + nr; i++) {
      let prox = null, md = 280;
      for (const o of P.ini.values()) { if (pts.includes(o) || !(o.hp > 0)) continue; const dd = Math.hypot(o.x - atual.x, o.y - atual.y); if (dd < md) { md = dd; prox = o; } }
      if (!prox) break;
      pts.push(prox); atual = prox;
    }
    if (pts.length > 1) {
      P.raios.push({ pts: pts.map(p => [p.x, p.y - p.h / 2]), t: 0, dur: 0.3 });
      for (const o of pts.slice(1)) J.golpear(o, dano * (0.35 + 0.15 * nr), 60, false, o.x, o.y - o.h / 2, false, true);
      J.som.raio();
    }
  }
}
export function aoMatar(en) {
  const P = J.P(), h = P.eu;
  if (!(P.t - (en.meuGolpeT ?? -9) < 0.6)) return;
  ganharEspecial(3);
  const ne = nivelEco(h, 'eco_estilhaco');
  if (!ne) return;
  P.fx.push({ tipo: 'anel', x: en.x, y: en.y - en.h / 2, t: 0, dur: 0.35, cor: '#bfe9ff', raio: 110 });
  for (const o of P.ini.values()) if (o.hp > 0 && Math.hypot(o.x - en.x, o.y - en.y) < 130) J.golpear(o, 14 + 10 * ne, 220, true, o.x, o.y - o.h / 2, false, true);
}
export function aoBlink(x, y) {
  const P = J.P(), h = P.eu;
  if (nivelEco(h, 'eco_brasa')) P.brasas.push({ x0: x, y, t: 0, dur: 1.3, x1: x, nivel: nivelEco(h, 'eco_brasa'), tick: 0 });
}

// ---------- atualização ----------
export function atualizar(dt, dtReal) {
  const P = J.P(), h = P.eu;
  if (P.impacto) { P.impacto.t += dtReal; if (P.impacto.t > P.impacto.dur) P.impacto = null; }
  if (P.cutin) {
    P.cutin.t += dtReal;
    if (P.cutin.t >= P.cutin.dur) { const cl = P.cutin.classe; P.cutin = null; executar(cl); }
  }
  for (const f of P.fantasmas) f.t += dt;
  P.fantasmas = P.fantasmas.filter(f => f.t < f.vida);
  for (const f of P.espFx) f.t += dt;
  P.espFx = P.espFx.filter(f => f.t < f.dur);
  for (const l of P.luas) l.t += dt;
  P.luas = P.luas.filter(l => l.t < l.dur);
  for (const r of P.raios) r.t += dt;
  P.raios = P.raios.filter(r => r.t < r.dur);
  if (P.espAtivo) {
    P.espAtivo.t += dt;
    for (const a of P.espFila) if (!a.feito && P.espAtivo.t >= a.t) { a.feito = true; a.fn(); }
    if (P.espAtivo.t > P.espAtivo.dur) { P.espAtivo = null; P.espFila = []; }
  }
  // orbe satélite
  const no = nivelEco(h, 'eco_orbe');
  if (no && !h.caido) {
    h.orbeA = (h.orbeA || 0) + dt * 4;
    h.orbeT = (h.orbeT || 0) - dt;
    const ox = h.x + Math.cos(h.orbeA) * 70, oy = h.y - 45 + Math.sin(h.orbeA) * 40;
    h.orbe = [ox, oy];
    if (h.orbeT <= 0) for (const e of P.ini.values()) {
      if (e.hp > 0 && Math.abs(e.x - ox) < e.w / 2 + 22 && Math.abs((e.y - e.h / 2) - oy) < e.h / 2 + 22) { h.orbeT = 0.45; J.golpear(e, 8 + 6 * no, 120, false, ox, oy, false, true); break; }
    }
  } else h.orbe = null;
  // brasas do blink
  for (const b of P.brasas) {
    b.t += dt; if (h.rolarT > 0 && b.t < 0.35) b.x1 = h.x;
    b.tick -= dt;
    if (b.tick <= 0) {
      b.tick = 0.25;
      const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
      for (const e of P.ini.values()) if (e.hp > 0 && e.x > x0 - 20 && e.x < x1 + 20 && Math.abs(e.y - b.y) < 70) J.golpear(e, 5 + 4 * b.nivel, 30, false, e.x, e.y - e.h / 2, false, true);
    }
  }
  P.brasas = P.brasas.filter(b => b.t < b.dur);
}

// ---------- desenho no mundo ----------
export function desenharMundo(c, t) {
  const P = J.P();
  // brasas
  for (const b of P.brasas) {
    const a = 1 - b.t / b.dur, x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let x = x0; x <= x1; x += 22) {
      const k = Math.sin(t * 14 + x) * 0.3 + 0.7;
      c.globalAlpha = a * k; c.drawImage(brilho('rgba(255,120,30,.9)', 32), x - 18, b.y - 34 * k, 36, 36);
      c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(x - 5, b.y); c.quadraticCurveTo(x, b.y - 26 * k, x + 5, b.y); c.fill();
    }
    c.restore();
  }
  // fantasmas
  for (const f of P.fantasmas) {
    const a = (1 - f.t / f.vida) * 0.55;
    c.save(); c.translate(f.x, f.y); c.scale(f.d < 0 ? -1 : 1, 1);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
    desenharHeroi(c, f.classe, f.sexo, f.pose, t, {});
    c.globalAlpha = a * 0.6; c.drawImage(brilho(rgba(f.cor, 0.8), 48), -50, -110, 100, 120);
    c.restore();
  }
  // luas (cortes crescentes)
  for (const l of P.luas) lua(c, l.x, l.y, l.r * (0.8 + l.t / l.dur * 0.4), l.d, 1 - l.t / l.dur, l.cor, 10);
  // raios em cadeia
  for (const r of P.raios) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - r.t / r.dur; c.lineJoin = 'round';
    for (let k = 0; k < r.pts.length - 1; k++) for (const [w, cor] of [[9, 'rgba(127,216,255,.35)'], [3, '#ffffff']]) {
      const [x0, y0] = r.pts[k], [x1, y1] = r.pts[k + 1];
      c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0);
      for (let i = 1; i < 7; i++) c.lineTo(x0 + (x1 - x0) * i / 7 + (Math.random() - 0.5) * 26, y0 + (y1 - y0) * i / 7 + (Math.random() - 0.5) * 26);
      c.lineTo(x1, y1); c.stroke();
    }
    for (const [x, y] of r.pts) c.drawImage(brilho('rgba(127,216,255,.9)', 48), x - 36, y - 36, 72, 72);
    c.restore();
  }
  // orbe satélite
  const h = P.eu;
  if (h.orbe) {
    const [ox, oy] = h.orbe;
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(199,155,255,.9)', 32), ox - 22, oy - 22, 44, 44); c.restore();
    c.save(); c.translate(ox, oy + 8); cristal(c, 0, 0, 18, 9, ['#ffffff', '#c79bff', '#5a2ea8'], h.orbeA); c.restore();
  }
  // efeitos dos especiais
  for (const f of P.espFx) desenharEspFx(c, f, t);
}

function lua(c, x, y, r, d, a, cor, esp) {
  c.save(); c.translate(x, y); c.scale(d, 1); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, a); c.lineCap = 'round';
  for (const [w, cc] of [[esp * 3.2, cor.replace(/[\d.]+\)$/, '0.25)')], [esp * 1.8, cor], [esp * 0.7, '#ffffff']]) {
    c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.arc(-r * 0.3, 0, r, -1.1, 1.1); c.stroke();
  }
  c.restore();
}

function desenharEspFx(c, f, t) {
  const k = f.t / f.dur;
  c.save(); c.globalCompositeOperation = 'lighter';
  if (f.classe === 'cavaleiro') {
    // cortes gigantes em lua e uma linha que atravessa
    if (f.t > 0.3) {
      const a = 1 - (f.t - 0.3) / (f.dur - 0.3);
      lua(c, f.x + f.d * 420, f.y - 70, 230, f.d, a, 'rgba(159,232,255,.9)', 14);
      lua(c, f.x + f.d * 380, f.y - 40, 300, -f.d, a * 0.8, 'rgba(199,155,255,.9)', 12);
      const gy = f.y - 60, w = 1200;
      const g = c.createLinearGradient(0, gy - 14, 0, gy + 14);
      g.addColorStop(0, 'rgba(159,232,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(159,232,255,0)');
      c.fillStyle = g; c.fillRect(f.x - w / 2 + f.d * 300, gy - 14, w, 28);
    }
  } else if (f.classe === 'mago') {
    const cx = f.cx, cy = f.cy, a = Math.min(1, f.t * 4) * (1 - Math.max(0, (k - 0.7) / 0.3));
    c.globalAlpha = a;
    c.save(); c.translate(cx, cy - 4); c.scale(1, 0.28); c.rotate(t * 0.8);
    for (const [r, w, cor] of [[300, 5, '#bfe6ff'], [250, 2, '#d6b3ff'], [190, 4, '#bfe6ff'], [120, 2, '#ffffff']]) { c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
    c.strokeStyle = '#d6b3ff'; c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 6; i++) { const ang = i * Math.PI * 4 / 6 + 0.3; c.lineTo(Math.cos(ang) * 250, Math.sin(ang) * 250); } c.stroke();
    c.drawImage(brilho('rgba(159,216,255,.7)', 128), -320, -320, 640, 640);
    c.restore();
    if (f.t > 0.35) {
      const sobe = Math.min(1, (f.t - 0.35) * 5);
      c.globalCompositeOperation = 'source-over';
      for (let i = -3; i <= 3; i++) cristal(c, cx + i * 70, cy, (220 - Math.abs(i) * 40) * sobe, 34, ['#ffffff', '#9fd8ff', '#3b6dbf'], i * 0.08);
      c.globalCompositeOperation = 'lighter';
    }
    for (let i = 0; i < 8; i++) {
      const fase = ((f.t * 2 + i * 0.37 + f.seed) % 1);
      const x = cx + (((i * 97) % 520) - 260), y = cy - 600 + fase * 600;
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 50, y - 100); c.lineTo(x, y); c.stroke();
      c.drawImage(brilho('rgba(214,179,255,.9)', 32), x - 16, y - 16, 32, 32);
    }
  } else if (f.classe === 'vampiro') {
    const a = Math.sin(k * Math.PI);
    c.globalAlpha = a * 0.6; c.drawImage(brilho('rgba(200,20,50,.9)', 128), f.x - 500, f.y - 400, 1000, 600);
    c.globalAlpha = a; c.strokeStyle = '#ff4d6d'; c.lineWidth = 4;
    c.save(); c.translate(f.x, f.y - 4); c.scale(1, 0.3); c.rotate(-t);
    c.beginPath(); c.arc(0, 0, 260, 0, 7); c.stroke(); c.beginPath();
    for (let i = 0; i <= 5; i++) { const ang = i * Math.PI * 4 / 5; c.lineTo(Math.cos(ang) * 260, Math.sin(ang) * 260); } c.stroke(); c.restore();
    for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2 + t; const rr = 300 * (1 - k); c.fillStyle = '#ff3355'; c.beginPath(); c.arc(f.x + Math.cos(ang) * rr, f.y - 50 + Math.sin(ang) * rr * 0.5, 5, 0, 7); c.fill(); }
  } else if (f.classe === 'lobisomem') {
    const a = 1 - k;
    c.globalAlpha = a * 0.5; c.drawImage(brilho('rgba(255,240,200,.9)', 128), f.x - 120, f.y - 600, 240, 300);
    for (let i = 0; i < 8; i++) { if (f.t < 0.1 + i * 0.07) break; const x = f.x + f.d * (60 + ((i * 53) % 240)), y = f.y - 40 - ((i * 37) % 80); c.globalAlpha = a; c.strokeStyle = '#ffb04d'; c.lineWidth = 6; for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(x - 40, y - 40 + j * 14); c.lineTo(x + 40, y + 40 + j * 14); c.stroke(); } }
  } else if (f.classe === 'monge') {
    const a = 1 - k;
    for (let i = 0; i < 14; i++) { const x = f.x + f.d * (60 + Math.random() * 120), y = f.y - 20 - Math.random() * 70; c.globalAlpha = a; c.drawImage(brilho('rgba(255,210,63,.9)', 32), x - 20, y - 20, 40, 40); c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); }
  } else if (f.classe === 'padre') {
    const a = Math.sin(k * Math.PI);
    for (let i = -4; i <= 4; i++) {
      const x = f.x + i * 140;
      const g = c.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, 'rgba(255,243,176,0)'); g.addColorStop(0.5, `rgba(255,243,176,${a * 0.9})`); g.addColorStop(1, 'rgba(255,243,176,0)');
      c.fillStyle = g; c.fillRect(x - 40, f.y - 800, 80, 800);
    }
  }
  c.restore();
}

// ---------- desenho na tela (por cima de tudo) ----------
export function desenharTela(c, W, H, mundoParaTela) {
  const P = J.P();
  if (P.impacto) {
    // negativo preto e branco + linhas de velocidade + estrela (sem ctx.filter, que não funciona no Safari)
    const [ix, iy] = mundoParaTela(P.impacto.x, P.impacto.y);
    c.save();
    c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'difference'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(0,0,0,.85)';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 + P.impacto.rot, r0 = H * (0.16 + Math.random() * 0.1);
      c.lineWidth = 2 + Math.random() * 5;
      c.beginPath(); c.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); c.lineTo(ix + Math.cos(a) * W, iy + Math.sin(a) * W); c.stroke();
    }
    estrela(c, ix, iy, H * 0.25, 8, '#ffffff', P.impacto.rot); estrela(c, ix, iy, H * 0.14, 6, '#000000', P.impacto.rot + 0.5); estrela(c, ix, iy, H * 0.08, 8, '#ffffff', 0.1);
    c.restore();
  }
  if (P.cutin) desenharCutin(c, W, H, P.cutin);
}
function estrela(c, cx, cy, r, pontas, cor, rot) {
  c.save(); c.translate(cx, cy); c.rotate(rot); c.fillStyle = cor; c.beginPath();
  for (let i = 0; i < pontas * 2; i++) { const a = i * Math.PI / pontas, rr = i % 2 ? r * 0.18 : r * (i % 4 === 0 ? 1 : 0.7); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.restore();
}
function desenharCutin(c, W, H, ci) {
  const k = ci.t / ci.dur;
  const entra = Math.min(1, ci.t / 0.12), sai = k > 0.85 ? (k - 0.85) / 0.15 : 0;
  c.save();
  c.fillStyle = `rgba(5,2,16,${0.6 * (1 - sai)})`; c.fillRect(0, 0, W, H);
  c.translate(W / 2 + (1 - entra) * -W + sai * W, H / 2); c.rotate(-0.18);
  const bh = H * 0.42;
  const g = c.createLinearGradient(-W, 0, W, 0); g.addColorStop(0, 'rgba(10,6,30,.95)'); g.addColorStop(0.5, ci.cor); g.addColorStop(1, 'rgba(10,6,30,.95)');
  c.fillStyle = g; c.fillRect(-W, -bh / 2, W * 2, bh);
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(-W, -bh / 2); c.lineTo(W, -bh / 2); c.moveTo(-W, bh / 2); c.lineTo(W, bh / 2); c.stroke();
  c.save(); c.beginPath(); c.rect(-W, -bh / 2, W * 2, bh); c.clip();
  c.globalAlpha = 0.35; c.strokeStyle = '#fff';
  for (let i = 0; i < 30; i++) { const y = -bh / 2 + ((i * 53.7) % bh), off = (ci.t * 3000 + i * 300) % (W * 2); c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo(-W + off, y); c.lineTo(-W + off - 300, y); c.stroke(); }
  c.globalAlpha = 1;
  const ret = retratos[`${ci.classe}_${ci.sexo === 'f' ? 'f' : 'm'}`];
  const deslize = ci.t * 40;
  if (ret && ret.complete && ret.naturalWidth) {
    const ph = bh * 1.5, pw = ph * ret.naturalWidth / ret.naturalHeight;
    c.drawImage(ret, -W * 0.36 - deslize, -bh * 0.6, pw, ph);
  } else {
    // sem retrato: o próprio herói, grande
    c.save(); c.translate(-W * 0.26 - deslize, bh * 0.62); c.scale(bh / 85, bh / 85);
    desenharHeroi(c, ci.classe, ci.sexo, calcularPose({ anim: "parado", classe: ci.classe }, 0), 0, {});
    c.restore();
  }
  c.restore();
  let tam = Math.round(H * 0.1);
  c.font = `900 ${tam}px Cinzel, serif`;
  const caber = W * 0.44; const mw = c.measureText(ci.nome).width; if (mw > caber) { tam = Math.floor(tam * caber / mw); c.font = `900 ${tam}px Cinzel, serif`; }
  c.textAlign = 'left'; c.lineWidth = 8; c.strokeStyle = '#140d22';
  c.strokeText(ci.nome, W * 0.0, bh * 0.08); c.fillStyle = '#ffffff'; c.fillText(ci.nome, W * 0.0, bh * 0.08);
  c.font = `800 ${Math.round(H * 0.04)}px Cinzel, serif`; c.fillStyle = '#ffe28a'; c.fillText('ESPECIAL', W * 0.0, -bh * 0.18);
  c.restore();
}
