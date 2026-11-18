// Cripta de Cristal — laço principal, combate, telas e multiplayer.
import { T, clamp, lerp, sinal, rng, hash, toca } from './util.js';
import { gerarNivel, bloco, biomaDo, ehChefe, BIOMAS, ANDARES_POR_CICLO, tiposDoTema } from './nivel.js';
import { criarFundo, desenharFundo, desenharAtmosfera, criarBlocos, desenharEnfeite, desenharPortal, varianteBloco, brilho, rgba, cristal } from './arte.js';
const brilhoArte = brilho;
import { CLASSES, ORDEM, nomeClasse, calcularPose, desenharHeroi } from './herois.js';
import { DEFS, TIPOS, ESTADOS, criarInimigo, atualizarInimigo, caixaGolpe, danoGolpe, corpo, desenharInimigo, desenharProjetil, desenharZona, caixaZona } from './inimigos.js';
import { moverCorpo, solido } from './fisica.js';
import { ctrl, consumir, temPedido, ligarControles } from './controles.js';
import { som, iniciarSom, musica, alternarSom } from './som.js';
import * as rede from './rede.js';
import { carregarSprites, pontaArma } from './sprites.js';
import * as esp from './espetaculo.js';
carregarSprites(['cavaleiro_m', 'cavaleiro_f', 'mago_f', 'mago_m']);

const $ = s => document.querySelector(s);
const cv = $('#tela'), ctx = cv.getContext('2d');
const TOQUE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (TOQUE) document.body.classList.add('touch');
const params = new URLSearchParams(location.search);

// ---------- tamanho da tela ----------
const VISTA_H = 640;                 // altura visível do mundo (pixels do mundo)
let DPR = 1, LW = 0, LH = 0, ESC = 1, VW = 0;
function redimensionar() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  LW = innerWidth; LH = innerHeight;
  cv.width = Math.round(LW * DPR); cv.height = Math.round(LH * DPR);
  ESC = cv.height / VISTA_H; VW = cv.width / ESC;
  if (P) prepararArte();
  fundoMenu = null;
}
addEventListener('resize', redimensionar);

// ---------- estado geral ----------
const G = {
  modo: null, codigo: null, meta: null, players: {}, sairSala: null, sairPartida: null,
  classe: localStorage.getItem('cc_classe') || 'cavaleiro',
  sexo: localStorage.getItem('cc_sexo') || 'm',
  nome: localStorage.getItem('cc_nome') || '',
  tela: 'inicio', heroi: null, run: null, rede: { estado: {}, inimigos: null, golpes: {} },
  pausado: false, altarAndar: -1, hostAusenteT: 0,
};
let P = null;                         // partida (andar atual)
const uidSolo = 'eu';
const meuUid = () => G.modo === 'sala' ? rede.meuId() : uidSolo;

// ---------- telas ----------
function mostrar(id) {
  document.querySelectorAll('.tela').forEach(s => s.classList.remove('ativa'));
  if (id) $('#' + id).classList.add('ativa');
  G.tela = id || 'jogo';
  const jogando = !id || ['telaAltar', 'telaFim', 'telaPausa'].includes(id);
  $('#hud').classList.toggle('escondido', !jogando || !P);
  document.body.classList.toggle('jogando', jogando && !!P);
}
let avisoTimer = null;
function aviso(txt, sub = '', ms = 2600) {
  const a = $('#aviso'); a.innerHTML = txt + (sub ? `<small>${sub}</small>` : '');
  a.classList.add('on'); clearTimeout(avisoTimer); avisoTimer = setTimeout(() => a.classList.remove('on'), ms);
}

// ---------- multiplicadores de dificuldade ----------
function multAndar(andar, nJog) {
  return { vida: (1 + 0.3 * (andar - 1)) * (1 + 0.5 * (nJog - 1)), dano: (1 + 0.13 * (andar - 1)) * (1 + 0.1 * (nJog - 1)), vel: 1 + 0.03 * Math.min(10, andar - 1), agil: Math.max(0.55, 1 - 0.08 * (andar - 1) - 0.06 * (nJog - 1)) };
}

// ---------- herói ----------
function criarHeroi(classe, sexo) {
  const C = CLASSES[classe];
  return {
    classe, sexo, x: 0, y: 0, vx: 0, vy: 0, w: 26, h: 68, d: 1, hp: C.vida, mhp: C.vida,
    anim: 'parado', fase: 0, passo: 0, combo: 0, comboT: 0, atkT: 0, atk: null, acertados: new Set(), tiroFeito: false, corteFeito: false, ak: 0,
    habCd: 0, habT: 0, habDur: 0, habAcertados: new Set(), rolarT: 0, rolarCd: 0, invT: 0, feridoT: 0, coyote: 0, pulos: 0, descerT: 0, cortouPulo: false,
    pocoes: 2, pocoesMax: 2, cristais: 0, mods: { dano: 1, vel: 1, atkVel: 1, cd: 1, rouba: 0, crit: 0.06, def: 1 }, bencaos: [],
    caido: false, reviveT: 0, furiaT: 0, seguro: { x: 0, y: 0 }, naPorta: false, fx: null, fxId: 0,
    golpesVistos: new Map(), zonasVistas: new Set(), mortos: 0, esp: 0, ecos: {}, contLamina: 0,
  };
}

// ---------- partida ----------
function iniciarAndar(andar, semente) {
  const nv = gerarNivel(semente, andar);
  const nJog = Math.max(1, jogadoresOnline().length);
  const h = G.heroi;
  P = {
    andar, semente, nv, bioma: nv.bioma, ciclo: Math.floor((andar - 1) / ANDARES_POR_CICLO) + 1,
    host: souHost(), eu: h, outros: {}, ini: new Map(), proj: [], zonas: [], meteoros: [], tiros: [], loot: [], fx: [], parts: [], nums: [],
    cam: { x: 0, y: 0 }, tremor: 0, paraT: 0, t: 0, nextId: 500000 + Math.floor(Math.random() * 1e5), mult: multAndar(andar, nJog),
    golpeFila: [], golpeN: 0, golpeUlt: {}, envT: 0, envIniT: 0, checarT: 0, projRemovidos: new Set(), fxVistos: {}, chefeMorto: false,
    visto: new Set(), recebeuIni: false, status: 'jogando', inicioT: performance.now(),
    cmb: { n: 0, t: 0, max: 0, pulso: 0 }, lentoT: 0, arenas: [],
    fantasmas: [], espFx: [], luas: [], raios: [], brasas: [], espFila: [], cutin: null, espAtivo: null, impacto: null, fantT: 0,
  };
  // posiciona o herói
  const idx = Math.max(0, jogadoresOnline().indexOf(meuUid()));
  h.x = nv.inicio.x + idx * 34; h.y = nv.inicio.y; h.vx = h.vy = 0; h.caido = false; h.naPorta = false;
  h.atk = null; h.habT = 0; h.rolarT = 0; h.invT = 1.5; h.golpesVistos.clear(); h.zonasVistas.clear(); h.seguro = { x: h.x, y: h.y };
  if (h.hp <= 0) h.hp = Math.round(h.mhp * 0.3);
  if (P.host) popularAndar(nv, andar, semente, nJog);
  P.arenas = (nv.arenas || []).map(a => ({ ...a, foi: false }));
  P.cam.x = h.x - VW / 2; P.cam.y = h.y - VISTA_H * 0.68;
  prepararArte();
  mostrar(null);
  const chefe = nv.chefe;
  aviso(chefe ? 'O Trono do Prisma' : P.bioma.nome, `Andar ${andar}${P.ciclo > 1 ? ' · Ciclo ' + P.ciclo : ''}`, 3200);
  musica(true, chefe);
  if (chefe) setTimeout(() => som.chefe(), 600);
  atualizarBotoesHud();
}
// monstros do andar: elites aparecem mais nos andares fundos; com amigos, vem mais gente
function popularAndar(nv, andar, semente, nJog) {
  const r = rng(semente * 13 + andar * 7);
  const pElite = Math.min(0.3, 0.07 + 0.06 * ((andar - 1) % ANDARES_POR_CICLO) + 0.08 * (P.ciclo - 1));
  for (const sp of nv.spawns) {
    P.ini.set(sp.id, criarInimigo(sp, P.mult, sp.tipo !== 'chefe' && r() < pElite));
    if (sp.tipo === 'chefe') continue;
    for (let k = 1; k < nJog; k++) if (r() < 0.5) {
      const id = ++P.nextId, dx = (r() < 0.5 ? -1 : 1) * 60;
      const x = solido(nv, sp.x + dx, sp.y + 4) || sp.tipo === 'morcego' ? sp.x + dx : sp.x;
      P.ini.set(id, criarInimigo({ id, tipo: DEFS[sp.tipo].pesado ? 'esqueleto' : sp.tipo, x, y: sp.y }, P.mult, r() < pElite * 0.5));
    }
  }
}
// emboscada: ao pisar numa arena, surge uma leva de monstros por portais
function checarEmboscadas(jogs) {
  for (const a of P.arenas || []) {
    if (a.foi || !jogs.some(j => j.vivo && j.x > a.x0 + T * 3 && j.x < a.x1 - T * 3 && Math.abs(j.y - a.y) < T * 3)) continue;
    a.foi = true;
    const n = 2 + jogs.length - 1 + (P.andar >= 3 ? 1 : 0) + (P.ciclo > 1 ? 1 : 0);
    const tipos = tiposDoTema(P.bioma.tema, P.andar).flatMap(([t, p]) => Array(Math.max(1, Math.round(p))).fill(t));
    for (let i = 0; i < n; i++) {
      const id = ++P.nextId, tipo = tipos[Math.floor(Math.random() * tipos.length)];
      const x = a.x0 + T * 2 + (a.x1 - a.x0 - T * 4) * ((i + 0.5) / n);
      const voa = tipo === 'morcego' || tipo === 'gargula';
      const en = criarInimigo({ id, tipo, x, y: voa ? a.y - T * 3 : a.y }, P.mult, Math.random() < 0.12);
      en.estado = 'persegue';
      P.ini.set(id, en);
      P.fx.push({ tipo: 'runa', x, y: en.y - 50, t: 0, dur: 0.6 });
    }
    som.emboscada();
    aviso('Emboscada!', '', 1400);
  }
}
function prepararArte() {
  if (!P) return;
  P.fundo = criarFundo(P.bioma, cv.width, cv.height, P.semente + P.andar);
  P.blocos = criarBlocos(P.bioma, ESC);
  // blocos totalmente cercados viram "fundo escuro" (mais leve de desenhar)
  const nv = P.nv, inter = new Uint8Array(nv.w * nv.h);
  for (let y = 1; y < nv.h - 1; y++) for (let x = 1; x < nv.w - 1; x++) {
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (bloco(nv, x + dx, y + dy) !== 1) { ok = false; break; }
    inter[y * nv.w + x] = ok ? 1 : 0;
  }
  P.interior = inter;
}
function pararPartida() {
  P = null; musica(false);
  if (G.sairPartida) { G.sairPartida(); G.sairPartida = null; }
}

// ---------- sessão (solo ou sala) ----------
function souHost() { return G.modo === 'solo' || (G.meta && G.meta.host === rede.meuId()); }
function jogadoresOnline() {
  if (G.modo === 'solo') return [uidSolo];
  return Object.entries(G.players).filter(([, p]) => p.online).sort((a, b) => (a[1].entrou || 0) - (b[1].entrou || 0)).map(([u]) => u);
}
function mudarMeta(d) {
  if (G.modo === 'solo') { Object.assign(G.meta, d); aoMeta({ ...G.meta }); }
  else rede.atualizarMeta(G.codigo, d).catch(e => console.warn(e));
}
function novaSemente() { return 1 + Math.floor(Math.random() * 1e9); }

function aoMeta(m) {
  if (!m) return;
  const antes = G.meta;
  G.meta = m;
  if (P) P.host = souHost();
  if (m.run && m.run !== G.run) { G.run = m.run; G.heroi = criarHeroi(G.classe, G.sexo); }
  if (m.status === 'lobby') {
    if (P) pararPartida();
    if (G.modo === 'sala' && !['telaSala', 'telaHeroi'].includes(G.tela)) mostrar('telaSala');
    atualizarSala();
  } else if (m.status === 'jogando') {
    if (!G.heroi) G.heroi = criarHeroi(G.classe, G.sexo);
    if (!P || P.andar !== m.andar || P.semente !== m.semente) {
      if (G.modo === 'sala' && !G.sairPartida) G.sairPartida = rede.ouvirPartida(G.codigo, aoRede);
      iniciarAndar(m.andar, m.semente);
    } else if (G.tela !== 'telaPausa') mostrar(null);
  } else if (m.status === 'altar') {
    if (G.altarAndar !== m.andar) abrirAltar(m.andar);
  } else if (m.status === 'fim') {
    mostrarFim(false);
  } else if (m.status === 'vitoria') {
    mostrarFim(true);
  }
  if (P && antes && antes.host !== m.host && P.host) virarHost();
}
function aoRede(st, k) {
  G.rede = st;
  if (!P) return;
  if (k === 'inimigos' && !P.host) receberInimigos(st.inimigos);
  if (k === 'golpes' && P.host) aplicarGolpesRemotos(st.golpes);
}

// anfitrião saiu: quem entrou primeiro assume os monstros
function virarHost() {
  for (const [id, r] of P.ini) {
    const en = criarInimigo({ id, tipo: r.tipo, x: r.x, y: r.y }, P.mult, !!r.elite);
    en.hp = r.hp; en.mhp = r.mhp; en.d = r.d; en.arm = r.arm || 0; en.marm = r.marm || 0; en.armT = r.armT || 0;
    P.ini.set(id, en);
  }
  aviso('Você virou o anfitrião', 'o outro jogador saiu');
}

// ---------- rede: monstros ----------
const nE = e => ESTADOS.indexOf(e), nT = t => TIPOS.indexOf(t);
const ATQ_CHEFE = ['espinhos', 'investida', 'rajada', 'invocar'];
function enviarInimigos() {
  const e = [];
  for (const en of P.ini.values()) e.push([en.id, nT(en.tipo), Math.round(en.x), Math.round(en.y), Math.max(0, Math.round(en.hp)), en.mhp, en.d, nE(en.estado), Math.round(en.tE * 100), en.ac, en.tipo === 'chefe' ? ATQ_CHEFE.indexOf(en.ataque) : -1, en.elite ? 1 : 0, Math.max(0, Math.round(en.arm)), en.marm, Math.round((en.atordT || 0) * 10)]);
  const p = P.proj.map(q => [q.id, Math.round(q.x), Math.round(q.y), Math.round(q.vx), Math.round(q.vy), q.tipo, q.dano]);
  const z = P.zonas.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.espera, q.dur, q.dano, Math.round((P.t - q.criado) * 1000)]);
  rede.enviarInimigos(G.codigo, { an: P.andar, sm: P.semente, e, p: p.length ? p : 0, z: z.length ? z : 0, m: [...P.visto].slice(-40) });
}
function receberInimigos(s) {
  if (!s || s.an !== P.andar || s.sm !== P.semente) return;
  P.recebeuIni = true;
  const vivos = new Set();
  for (const a of s.e || []) {
    const [id, ti, x, y, hp, mhp, d, es, tE, ac, atq, el, arm, marm, at10] = a;
    vivos.add(id);
    let r = P.ini.get(id);
    if (!r) {
      if (P.visto.has(id)) continue;
      const esc = el ? 1.2 : 1;
      r = { id, tipo: TIPOS[ti], x, y, tx: x, ty: y, w: Math.round(DEFS[TIPOS[ti]].w * esc), h: Math.round(DEFS[TIPOS[ti]].h * esc), flash: 0, mult: P.mult, elite: !!el, arm, marm };
      P.ini.set(id, r);
      if (P.recebeuIni && P.t > 2) P.fx.push({ tipo: 'runa', x, y: y - 50, t: 0, dur: 0.6 });
    }
    r.tx = x; r.ty = y; r.hp = hp; r.mhp = mhp; r.d = d; r.ac = ac; r.ataque = ATQ_CHEFE[atq];
    if (r.arm > 0 && arm <= 0 && marm > 0) efeitoQuebra(r);
    r.arm = arm || 0; r.marm = marm || 0; r.atordT = (at10 || 0) / 10; if (arm <= 0 && marm > 0) r.armT = r.armT || 6;
    const novoEstado = ESTADOS[es];
    if (novoEstado !== r.estado) { r.estado = novoEstado; r.tE = tE / 100; }
  }
  for (const [id, r] of P.ini) if (!vivos.has(id)) matarInimigo(r);
  // projéteis
  const pv = new Set();
  for (const q of s.p || []) {
    const [id, x, y, vx, vy, tipo, dano] = q;
    pv.add(id);
    if (P.projRemovidos.has(id)) continue;
    const ex = P.proj.find(o => o.id === id);
    if (ex) { ex.x = lerp(ex.x, x, 0.5); ex.y = lerp(ex.y, y, 0.5); ex.vx = vx; ex.vy = vy; }
    else P.proj.push({ id, x, y, vx, vy, tipo, dano, vida: 4 });
  }
  P.proj = P.proj.filter(o => pv.has(o.id));
  // zonas do chefe
  const zv = new Set();
  for (const q of s.z || []) {
    const [id, x, y, espera, dur, dano, idade] = q;
    zv.add(id);
    if (!P.zonas.find(o => o.id === id)) P.zonas.push({ id, x, y, espera, dur, dano, criado: P.t - idade / 1000 });
  }
  P.zonas = P.zonas.filter(o => zv.has(o.id) || P.t - o.criado < o.espera + o.dur);
}
function aplicarGolpesRemotos(golpes) {
  for (const [u, lista] of Object.entries(golpes || {})) {
    if (u === meuUid()) continue;
    const ult = P.golpeUlt[u] || 0;
    let max = ult;
    for (const [n, g] of Object.entries(lista || {})) {
      const k = +n;
      if (k <= ult || !Array.isArray(g)) continue;
      max = Math.max(max, k);
      for (const [id, dano, kb, forte, lanca] of g) {
        const en = P.ini.get(id);
        if (en) ferirInimigo(en, dano, kb, !!forte, false, !!lanca);
      }
    }
    P.golpeUlt[u] = max;
  }
}

// ---------- combate ----------
function ferirInimigo(en, dano, kbx, forte, meu, lanca) {
  if (!(en.hp > 0)) return;
  en.hp -= dano; en.flash = 0.12;
  const d = DEFS[en.tipo];
  if (!P.host) return;
  if (en.hp <= 0) { matarInimigo(en); return; }
  if (en.arm > 0) {
    // com armadura: não se abala, mas a armadura vai rachando
    en.arm -= dano; en.vx = (en.vx || 0) + kbx / 10;
    if (en.arm <= 0) quebrarArmadura(en);
    return;
  }
  const quebrado = en.marm > 0;
  const pesado = d.pesado && !quebrado;
  en.vx = (en.vx || 0) + kbx / (pesado ? 6 : 1);
  const noAr = !d.voa && en.noChao === false;
  if (lanca && !pesado && !d.voa) { en.vy = d.pesado ? -560 : -820; en.estado = 'atordoado'; en.tE = 0; en.atordT = 0.9; en.noChao = false; return; }
  if (noAr) { en.vy = Math.min(en.vy, -300); en.estado = 'atordoado'; en.tE = 0; en.atordT = Math.max(en.atordT || 0, 0.4); return; }
  if (!d.voa && !pesado) en.vy = -110 * (forte ? 1.6 : 0.5);
  if (!pesado && (forte || en.estado !== 'golpe')) { if (en.estado !== 'atordoado' || !(en.atordT > 0.5)) en.atordT = 0; en.estado = 'atordoado'; en.tE = 0; }
}
function quebrarArmadura(en) {
  en.arm = 0; en.armT = 6; en.estado = 'atordoado'; en.tE = 0; en.atordT = en.tipo === 'chefe' ? 2.4 : 1.8; en.vx = 0;
  efeitoQuebra(en);
}
function efeitoQuebra(en) {
  numero(en.x, en.y - en.h - 24, 'QUEBROU!', '#7fd8ff', true);
  P.fx.push({ tipo: 'anel', x: en.x, y: en.y - en.h / 2, t: 0, dur: 0.45, cor: '#7fd8ff', raio: en.w * 1.6 });
  for (let i = 0; i < 26; i++) { const a = Math.random() * 7, v = 150 + Math.random() * 350; P.parts.push({ x: en.x, y: en.y - en.h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, vida: 0.8, max: 0.8, cor: '#bfe9ff', tam: 3 + Math.random() * 4, grav: 1, caco: true, rot: Math.random() * 6 }); }
  P.tremor = Math.max(P.tremor, 12); P.paraT = Math.max(P.paraT, 0.12);
  som.quebraArmadura();
}
function golpear(en, base, kb, forte, x, y, lanca = false, deEco = false) {
  const h = P.eu, C = CLASSES[h.classe];
  // contador de combo: cada acerto seguido aumenta o dano (até +30%)
  const cb = P.cmb; cb.n++; cb.t = 1.8; cb.pulso = 1; if (cb.n > cb.max) cb.max = cb.n;
  if ([10, 20, 35, 50].includes(cb.n)) som.marcoCombo(cb.n);
  let dano = base * h.mods.dano * (h.furiaT > 0 ? 1.5 : 1) * (1 + Math.min(0.3, cb.n * 0.012));
  if (en.marm > 0 && en.arm <= 0) dano *= 1.5;
  // no ar, cada acerto segura o herói um pouquinho (combo aéreo)
  if (!h.noChao && h.atk && !h.atk.tiro && h.arHits < 6) { h.arHits++; h.vy = Math.min(h.vy, -170); }
  const crit = h.critT > 0 || Math.random() < h.mods.crit;
  if (crit) dano *= 2;
  // escudo: o cavaleiro sombrio defende golpes fracos que vêm pela frente
  const def = DEFS[en.tipo];
  if (def.escudo && en.estado !== 'golpe' && en.estado !== 'atordoado' && sinal((x ?? h.x) - en.x) === en.d && !forte && !lanca && !(en.arm <= 0 && en.marm > 0)) {
    dano *= 0.15; numero(en.x, en.y - en.h - 20, 'DEFENDEU', '#9fb0cc', false); som.defendeu();
  }
  dano = Math.max(1, Math.round(dano * (0.92 + Math.random() * 0.16)));
  const kx = h.d * kb;
  numero(x ?? en.x, (y ?? en.y - en.h) - 6, dano, crit ? '#ffe28a' : '#fff', crit);
  faiscas(x ?? en.x, y ?? en.y - en.h / 2, C.cor, forte ? 14 : 8);
  en.flash = 0.12;
  som.acerto(forte);
  P.paraT = Math.max(P.paraT, forte ? 0.075 : 0.035);
  P.tremor = Math.max(P.tremor, forte ? 7 : 3);
  esp.aoAcertar(en, dano, crit, deEco);
  if (!deEco && forte && h.atk && (h.atk.especial || h.combo === C.ataques.length - 1 || crit)) esp.impacto(x ?? en.x, y ?? en.y - en.h / 2, 1);
  const rouba = (C.rouba || 0) + h.mods.rouba;
  if (rouba > 0 && !h.caido) h.hp = Math.min(h.mhp, h.hp + dano * rouba);
  if (P.host) ferirInimigo(en, dano, kx, forte, true, lanca);
  else {
    P.golpeFila.push([en.id, dano, Math.round(kx), forte ? 1 : 0, lanca ? 1 : 0]); en.hp -= dano;
    if (en.arm > 0) { en.arm -= dano; if (en.arm <= 0) efeitoQuebra(en); }
  }
}
function matarInimigo(en) {
  if (P.visto.has(en.id)) return;
  P.visto.add(en.id);
  P.ini.delete(en.id);
  const d = DEFS[en.tipo];
  const cx = en.x, cy = (en.ty ?? en.y) - en.h / 2;
  som.quebra();
  for (let i = 0; i < (en.tipo === 'chefe' ? 80 : 22); i++) {
    const a = Math.random() * 7, v = 120 + Math.random() * 380;
    P.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, vida: 0.9 + Math.random() * 0.5, max: 1.4, cor: P.bioma.cristal[Math.floor(Math.random() * 2)], tam: 3 + Math.random() * 5, grav: 1, caco: true, rot: Math.random() * 6 });
  }
  P.tremor = Math.max(P.tremor, en.tipo === 'chefe' ? 22 : 6);
  P.eu.mortos++;
  esp.aoMatar(en);
  if (en.elite || DEFS[en.tipo].pesado) esp.impacto(cx, cy, 2);
  // tesouro (cada jogador ganha o seu)
  const valor = Math.round(d.cristais * (1 + 0.2 * (P.andar - 1)));
  const n = Math.min(8, valor);
  for (let i = 0; i < n; i++) P.loot.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 300, vy: -200 - Math.random() * 300, t: 0, tipo: 'c', v: Math.ceil(valor / n) });
  const sorte = hash(en.id * 31 + P.andar * 1009 + P.semente % 1000);
  if (sorte < (['golem', 'automato'].includes(en.tipo) ? 0.35 : en.tipo === 'chefe' ? 1 : en.tipo === 'escaravelho' ? 0.03 : 0.09)) P.loot.push({ x: cx, y: cy, vx: 0, vy: -380, t: 0, tipo: 'p' });
  if (en.tipo === 'chefe') {
    P.chefeMorto = true;
    aviso('O Guardião caiu!', 'o Trono do Prisma é seu', 3500);
    if (P.host) setTimeout(() => { if (P && P.chefeMorto) mudarMeta({ status: 'vitoria' }); }, 3200);
  }
}

function ferirHeroi(dano, kdir) {
  const h = P.eu;
  if (h.caido || P.status !== 'jogando' || P.chefeMorto) return;
  // esquiva perfeita: o golpe chegou bem no comecinho do blink
  if (h.rolarT > 0 && h.rolarT > ROLAR - 0.2 && !h.perfeitoUsado) { esquivaPerfeita(); return; }
  if (h.invT > 0) return;
  P.cmb.n = 0;
  dano = Math.max(1, Math.round(dano * h.mods.def));
  esp.ganharEspecial(4);
  h.hp -= dano; h.invT = 0.85; h.feridoT = 0.22;
  h.vx = kdir * 280; h.vy = -280; h.atk = null;
  numero(h.x, h.y - h.h - 10, dano, '#ff5a7a', false);
  P.tremor = Math.max(P.tremor, 9); P.paraT = 0.06;
  som.dano();
  vermelho = 0.5;
  if (h.hp <= 0) {
    h.hp = 0;
    som.morte();
    if (G.modo === 'solo') { h.caido = true; setTimeout(() => mudarMeta({ status: 'fim' }), 1400); }
    else { h.caido = true; h.reviveT = 0; aviso('Você caiu!', 'fique perto de um amigo pra levantar', 3500); }
  }
}
let vermelho = 0;
function esquivaPerfeita() {
  const h = P.eu;
  h.perfeitoUsado = true; h.critT = 1.8; h.invT = Math.max(h.invT, 0.6); esp.ganharEspecial(10);
  P.lentoT = 0.6;
  aviso('ESQUIVA PERFEITA', 'próximos golpes: crítico', 1300);
  P.fx.push({ tipo: 'anel', x: h.x, y: h.y - 45, t: 0, dur: 0.5, cor: '#ffffff', raio: 110 });
  som.perfeito();
}
const ROLAR = 0.3;   // duração do blink (esquiva)

// caixa de acerto do ataque à frente do herói
function caixaAtaque(h, at) {
  const cy = h.y - h.h * 0.55;
  return { x: h.d > 0 ? h.x - 8 : h.x - at.alc + 8, y: cy - at.alt / 2, w: at.alc, h: at.alt };
}

// ---------- habilidades ----------
function usarHabilidade(h) {
  const C = CLASSES[h.classe];
  h.habCd = C.habCd * h.mods.cd; h.habAcertados.clear(); h.atk = null;
  const mx = (ctrl.dir ? 1 : 0) - (ctrl.esq ? 1 : 0); if (mx) h.d = mx;
  som.habilidade();
  h.fxId++;
  const fx = (tipo) => { h.fx = [h.fxId, tipo, Math.round(h.x), Math.round(h.y), h.d]; efeitoHab(tipo, h.x, h.y, h.d, true); };
  if (h.classe === 'cavaleiro') { h.habT = h.habDur = 0.38; h.invT = Math.max(h.invT, 0.45); fx('investida'); }
  else if (h.classe === 'vampiro') { h.habT = h.habDur = 0.26; h.invT = Math.max(h.invT, 0.4); fx('revoada'); }
  else if (h.classe === 'monge') { h.habT = h.habDur = 0.42; h.invT = Math.max(h.invT, 0.3); h.vy = h.noChao ? -260 : 340; fx('voadora'); }
  else if (h.classe === 'lobisomem') {
    h.habT = h.habDur = 0.5; h.furiaT = 6.5; fx('uivo');
    for (const en of P.ini.values()) if (Math.hypot(en.x - h.x, en.y - h.y) < 170) { h.d = sinal(en.x - h.x) || h.d; golpear(en, 24, 420, true); }
  } else if (h.classe === 'mago') {
    h.habT = h.habDur = 0.45; fx('chuva');
  } else if (h.classe === 'padre') {
    h.habT = h.habDur = 0.55; fx('luz');
    h.hp = Math.min(h.mhp, h.hp + h.mhp * 0.35);
    numero(h.x, h.y - h.h - 20, '+' + Math.round(h.mhp * 0.35), '#9fffb0', true);
    som.cura();
    for (const en of P.ini.values()) if (Math.hypot(en.x - h.x, (en.y - en.h / 2) - (h.y - 34)) < 230) golpear(en, 40, 260, true);
  }
}
// efeito visual da habilidade (o meu e o dos outros)
function efeitoHab(tipo, x, y, d, meu, cor) {
  if (tipo === 'chuva') {
    const nv = P.nv;
    for (let i = 0; i < 7; i++) {
      const mx = x + d * (110 + i * 70) + (Math.random() - 0.5) * 30;
      let gy = y;
      const tx = Math.floor(mx / T);
      for (let ty = Math.floor((y - 300) / T); ty < nv.h; ty++) { const k = bloco(nv, tx, ty); if (k === 1 || k === 2) { gy = ty * T; break; } }
      P.meteoros.push({ x: mx - d * 160, y: gy - 560, alvoX: mx, alvoY: gy, t: -i * 0.09, dur: 0.42, meu });
    }
  } else if (tipo === 'luz') {
    P.fx.push({ tipo: 'luz', x, y, t: 0, dur: 0.9 });
    for (let i = 0; i < 30; i++) P.parts.push({ x: x + (Math.random() - 0.5) * 200, y: y - Math.random() * 30, vx: 0, vy: -100 - Math.random() * 220, vida: 1, max: 1, cor: '#fff3b0', tam: 3 + Math.random() * 3, grav: 0 });
  } else if (tipo === 'uivo') {
    P.fx.push({ tipo: 'anel', x, y: y - 40, t: 0, dur: 0.6, cor: '#ffb04d', raio: 190 });
  } else if (tipo === 'revoada') {
    for (let i = 0; i < 14; i++) P.parts.push({ x: x + (Math.random() - 0.5) * 30, y: y - 40 + (Math.random() - 0.5) * 40, vx: d * (300 + Math.random() * 500), vy: (Math.random() - 0.5) * 200, vida: 0.5, max: 0.5, cor: '#2a0d1a', tam: 7, grav: 0, morcego: true });
  } else if (tipo === 'investida' || tipo === 'voadora') {
    P.fx.push({ tipo: 'rastro', x, y, t: 0, dur: 0.4, d, cor: tipo === 'investida' ? '#9fd3ff' : '#ffd23f' });
  }
}

// ---------- atualização do herói local ----------
function atualizarEu(dt) {
  const h = P.eu, C = CLASSES[h.classe], nv = P.nv;
  for (const k of ['comboT', 'habCd', 'rolarCd', 'invT', 'feridoT', 'coyote', 'descerT', 'furiaT']) h[k] = Math.max(0, h[k] - dt);
  if (h.caido) {
    h.anim = 'caido'; h.vx *= Math.pow(0.01, dt); h.grav = 1; h.descer = false;
    moverCorpo(h, dt, nv);
    // levanta se um amigo ficar perto
    let perto = false;
    for (const o of Object.values(P.outros)) if (!o.st.cai && Math.hypot(o.x - h.x, o.y - h.y) < 80) perto = true;
    h.reviveT = perto ? h.reviveT + dt : Math.max(0, h.reviveT - dt);
    if (h.reviveT > 2) reviver(0.4);
    return;
  }
  const furia = h.furiaT > 0;
  const velMax = C.vel * h.mods.vel * (furia ? 1.22 : 1);
  const atkVel = h.mods.atkVel * (furia ? 1.4 : 1);
  const mx = (ctrl.dir ? 1 : 0) - (ctrl.esq ? 1 : 0);

  // rolar
  if (h.rolarT <= 0 && h.habT <= 0 && h.rolarCd <= 0 && consumir('rolar', 160)) {
    h.rolarT = ROLAR; h.rolarCd = 0.45; h.perfeitoUsado = false; esp.aoBlink(h.x, h.y); if (mx) h.d = mx; h.invT = Math.max(h.invT, 0.32); h.atk = null; som.rolar();
    efeitoBlink(h.x, h.y, CLASSES[h.classe].cor, h.classe);
  }
  // habilidade
  if (h.rolarT <= 0 && h.habT <= 0 && h.habCd <= 0 && consumir('hab', 160)) usarHabilidade(h);
  // poção
  if (h.pocoes > 0 && h.hp < h.mhp && consumir('pocao', 160)) {
    h.pocoes--; const c = Math.round(h.mhp * 0.45); h.hp = Math.min(h.mhp, h.hp + c);
    numero(h.x, h.y - h.h - 18, '+' + c, '#9fffb0', true); som.pocao();
    for (let i = 0; i < 16; i++) P.parts.push({ x: h.x + (Math.random() - 0.5) * 30, y: h.y - Math.random() * 60, vx: 0, vy: -80 - Math.random() * 120, vida: 0.8, max: 0.8, cor: '#9fffb0', tam: 3, grav: 0 });
    atualizarBotoesHud();
  }
  // especial
  if (consumir('esp', 200)) { if (esp.soltarEspecial()) atualizarBotoesHud(); }
  // ataque carregado (segurar o botão): lançador nos guerreiros, orbe gigante nos magos
  h.critT = Math.max(0, (h.critT || 0) - dt);
  if (ctrl.segura.atacar && h.rolarT <= 0 && h.habT <= 0 && !h.cargaUsada) {
    h.cargaT = (h.cargaT || 0) + dt;
    if (h.cargaT > 0.32) {
      h.cargaUsada = true;
      const base = C.ataques[0];
      h.atk = base.tiro ? { dur: 0.5, ini: 0.16, fim: 0.17, dano: Math.round(base.dano * 2.3), tiro: { vel: 560, raio: 22, perfura: true }, kb: 380, forte: true, lanca: true, especial: true }
        : { dur: 0.44, ini: 0.1, fim: 0.28, dano: Math.round(base.dano * 1.25), alc: Math.max(90, base.alc || 80), alt: 140, kb: 60, tipo: 'subida', forte: true, lanca: true, especial: true };
      h.combo = 2; h.atkT = 0; h.acertados.clear(); h.tiroFeito = false; h.corteFeito = false; h.ak++;
      if (base.tiro) { const alvo = inimigoMaisPerto(h, 900); if (alvo) h.d = sinal(alvo.x - h.x) || h.d; }
      som.carregado();
    }
  } else if (!ctrl.segura.atacar) { h.cargaT = 0; h.cargaUsada = false; }
  // ataque (com combo e "fila" de botão)
  const ats = C.ataques;
  if (h.rolarT <= 0 && h.habT <= 0 && temPedido('atacar', 380)) {
    const at = h.atk;
    const livre = !at || h.atkT >= at.fim / atkVel;
    if (livre) {
      consumir('atacar', 400);
      h.combo = (at && !at.especial || h.comboT > 0) ? (h.combo + 1) % ats.length : 0;
      h.atk = ats[h.combo]; h.atkT = 0; h.acertados.clear(); h.tiroFeito = false; h.corteFeito = false; h.ak++;
      if (mx) h.d = mx;
      if (h.atk.tiro) { const alvo = inimigoMaisPerto(h, 900); if (alvo) h.d = sinal(alvo.x - h.x) || h.d; }
      som.golpe(h.atk.forte);
    }
  }
  if (h.atk) {
    const at = h.atk, dur = at.dur / atkVel, ini = at.ini / atkVel, fim = at.fim / atkVel;
    h.atkT += dt;
    // rastro de imagens fantasmas durante o golpe
    P.fantT -= dt;
    if (P.fantT <= 0 && h.atkT > ini * 0.5 && h.atkT < fim + 0.06) { P.fantT = 0.045; esp.fantasma(h.classe, h.sexo, calcularPose(h, P.t), h.x, h.y, h.d, C.cor, at.forte ? 0.3 : 0.2); }
    if (h.atkT >= ini && !h.corteFeito) {
      h.corteFeito = true;
      if (h.noChao && !at.lanca) h.vx += h.d * (at.forte ? 260 : 140);
      if (at.lanca && !at.tiro && h.noChao) { h.vy = -700; h.cortouPulo = true; }
      if (!at.tiro) efeitoCorte(h.x, h.y, h.d, at, C.cor, h.combo);
    }
    if (at.tiro && h.atkT >= ini && !h.tiroFeito) {
      h.tiroFeito = true; som.magia();
      const pt = pontaArma(h.classe, h.sexo) || [62, -62];
      const sx = h.x + h.d * pt[0], sy = h.y + pt[1];
      // mira automática: no inimigo mais perto à frente; sem ninguém, vai reto
      const alvo = inimigoMaisPerto(h, 900, true);
      let ang = h.d > 0 ? 0 : Math.PI;
      if (alvo) ang = Math.atan2((alvo.y - alvo.h / 2) - sy, alvo.x - sx);
      P.tiros.push({ x: sx, y: sy, vx: Math.cos(ang) * at.tiro.vel, vy: Math.sin(ang) * at.tiro.vel, raio: at.tiro.raio, dano: at.dano, kb: at.kb, perfura: at.tiro.perfura, forte: !!at.forte, lanca: !!at.lanca, acertados: new Set(), vida: 1.2 });
    }
    if (!at.tiro && h.atkT >= ini && h.atkT <= fim) {
      const cx = caixaAtaque(h, at);
      for (const en of P.ini.values()) {
        if (h.acertados.has(en.id) || !(en.hp > 0)) continue;
        if (toca(cx, corpo(en))) { h.acertados.add(en.id); golpear(en, at.dano, at.kb, !!at.forte, clamp(en.x, cx.x, cx.x + cx.w), clamp(en.y - en.h / 2, cx.y, cx.y + cx.h), !!at.lanca); }
      }
    }
    if (h.atkT >= dur) { h.atk = null; h.comboT = 0.32; if (h.combo === ats.length - 1) h.comboT = 0; }
  }

  // pulo
  if (temPedido('pular', 150)) {
    const sobrePlataforma = h.noChao && bloco(nv, Math.floor(h.x / T), Math.floor((h.y + 2) / T)) === 2;
    if (ctrl.baixo && sobrePlataforma) { consumir('pular'); h.descerT = 0.25; }
    else if ((h.noChao || h.coyote > 0) && h.rolarT <= 0) { consumir('pular'); h.vy = -830; h.coyote = 0; h.pulos = 1; h.cortouPulo = false; som.pulo(); poeira(h.x, h.y, 6); }
    else if (C.puloDuplo && h.pulos < 2 && !h.noChao && h.habT <= 0) {
      consumir('pular'); h.vy = -760; h.pulos = 2; h.cortouPulo = false; som.pulo();
      P.fx.push({ tipo: 'anel', x: h.x, y: h.y, t: 0, dur: 0.35, cor: '#ffd23f', raio: 40 });
    }
  }
  if (!ctrl.segura.pular && h.vy < -280 && !h.cortouPulo && h.habT <= 0) { h.vy *= 0.5; h.cortouPulo = true; }

  // movimento horizontal
  h.grav = 1;
  if (h.noChao) h.arHits = 0;
  if (h.atk && !h.noChao && !h.atk.lanca && h.vy > -100) { h.grav = 0.3; h.vy = Math.min(h.vy, 140); }
  if (h.rolarT > 0) {
    h.rolarT -= dt;
    if (h.rolarT <= 0) efeitoBlink(h.x, h.y, CLASSES[h.classe].cor, h.classe);
    h.vx = h.d * 1000 * (0.6 + 0.4 * (h.rolarT / ROLAR)); h.grav = 0; h.vy = 0;
  } else if (h.habT > 0) {
    h.habT -= dt;
    const k = h.classe;
    if (k === 'cavaleiro') { h.vx = h.d * 760; h.grav = 0.2; h.vy = Math.min(h.vy, 0); }
    else if (k === 'vampiro') { h.vx = h.d * 1150; h.grav = 0; h.vy = 0; }
    else if (k === 'monge') { h.vx = h.d * 800; h.grav = 0; }
    else { h.vx *= Math.pow(0.001, dt); }
    if (k === 'cavaleiro' || k === 'vampiro' || k === 'monge') {
      const box = { x: h.x - 34, y: h.y - h.h - 6, w: 68, h: h.h + 12 };
      for (const en of P.ini.values()) {
        if (h.habAcertados.has(en.id) || !(en.hp > 0)) continue;
        if (toca(box, corpo(en))) { h.habAcertados.add(en.id); golpear(en, k === 'cavaleiro' ? 32 : k === 'vampiro' ? 26 : 34, k === 'cavaleiro' ? 520 : 300, true); }
      }
      if (Math.random() < 0.8) P.parts.push({ x: h.x - h.d * 10, y: h.y - 20 - Math.random() * 40, vx: -h.d * 60, vy: 0, vida: 0.3, max: 0.3, cor: k === 'vampiro' ? '#ff4d6d' : CLASSES[k].cor, tam: 4, grav: 0 });
    }
    if (h.habT <= 0 && (k === 'cavaleiro' || k === 'vampiro' || k === 'monge')) h.vx *= 0.3;
  } else {
    let alvo = mx * velMax;
    if (h.atk) alvo *= 0.35;
    const acel = h.noChao ? 4800 : 3200;
    if (h.feridoT <= 0) h.vx = Math.abs(alvo - h.vx) < acel * dt ? alvo : h.vx + Math.sign(alvo - h.vx) * acel * dt;
    if (mx && !h.atk) h.d = mx;
  }
  h.descer = h.descerT > 0;
  const estavaNoChao = h.noChao;
  moverCorpo(h, dt, nv);
  if (h.noChao) { h.coyote = 0.1; h.pulos = 0; if (!estavaNoChao && h.vy === 0) poeira(h.x, h.y, 3); }
  // lugar seguro (para voltar depois de cair nos espinhos)
  if (h.noChao && !h.espinho && bloco(nv, Math.floor((h.x - 14) / T), Math.floor((h.y + 4) / T)) === 1 && bloco(nv, Math.floor((h.x + 14) / T), Math.floor((h.y + 4) / T)) === 1) h.seguro = { x: h.x, y: h.y };
  if (h.espinho || h.y > nv.h * T + 100) {
    const inv = h.invT; h.invT = 0;
    ferirHeroi(18, 0);
    if (!h.caido) { h.x = h.seguro.x; h.y = h.seguro.y; h.vx = h.vy = 0; h.invT = 1.2; }
    else { h.x = h.seguro.x; h.y = h.seguro.y; h.vx = h.vy = 0; }
    if (inv > h.invT) h.invT = inv;
  }

  // animação
  if (h.habT > 0) { h.anim = 'hab'; h.fase = 1 - h.habT / h.habDur; h.ataqueInfo = { fimRel: 0.3 }; }
  else if (h.atk) { h.anim = 'atacar'; h.fase = h.atkT / (h.atk.dur / atkVel); h.ataqueInfo = { fimRel: h.atk.fim / h.atk.dur }; }
  else if (h.rolarT > 0) { h.anim = 'rolar'; h.fase = 1 - h.rolarT / ROLAR; }
  else if (h.feridoT > 0) { h.anim = 'ferido'; h.fase = 1 - h.feridoT / 0.22; }
  else if (!h.noChao) h.anim = h.vy < 0 ? 'pular' : 'cair';
  else if (Math.abs(h.vx) > 20) h.anim = 'correr';
  else h.anim = 'parado';
  h.passo += Math.abs(h.vx) * dt * 0.045;

  // perigos dos monstros
  const meuCorpo = { x: h.x - h.w / 2, y: h.y - h.h, w: h.w, h: h.h };
  for (const en of P.ini.values()) {
    const cx = caixaGolpe(en);
    if (!cx || h.golpesVistos.get(en.id) === en.ac) continue;
    if (toca(cx, meuCorpo)) {
      h.golpesVistos.set(en.id, en.ac);
      const puxa = DEFS[en.tipo].puxa;
      ferirHeroi(danoGolpe(en), puxa ? sinal(en.x - h.x) : sinal(h.x - en.x));
      if (puxa && !h.caido && h.rolarT <= 0) { h.vx = sinal(en.x - h.x) * 520; h.vy = -160; }
    }
  }
  for (const z of P.zonas) {
    const idade = P.t - z.criado;
    if (idade < z.espera || idade > z.espera + z.dur || h.zonasVistas.has(z.id)) continue;
    if (toca(caixaZona(z), meuCorpo)) { h.zonasVistas.add(z.id); ferirHeroi(z.dano, sinal(h.x - z.x)); h.vy = -600; }
  }
  for (const q of P.proj) {
    if (P.projRemovidos.has(q.id)) continue;
    if (Math.abs(q.x - h.x) < 18 && q.y > h.y - h.h && q.y < h.y) {
      P.projRemovidos.add(q.id); ferirHeroi(q.dano, sinal(q.vx));
      faiscas(q.x, q.y, '#ff4d6d', 8);
    }
  }
  // portal
  const pt = nv.portal;
  h.naPorta = !!pt && Math.abs(h.x - pt.x) < 50 && Math.abs(h.y - pt.y) < 60;
}
function reviver(frac) {
  const h = P.eu;
  h.caido = false; h.hp = Math.max(h.hp, Math.round(h.mhp * frac)); h.invT = 2; h.reviveT = 0;
  som.cura(); aviso('De pé!', '', 1500);
}

// ---------- efeitos ----------
function efeitoCorte(x, y, d, at, cor, combo) {
  P.fx.push({ tipo: at.tipo || 'corte', x, y, d, t: 0, dur: at.forte ? 0.28 : 0.2, cor, alc: at.alc || 70, alt: at.alt || 60, forte: !!at.forte, combo });
}
// inimigo vivo mais perto (opcional: só os que estão na frente)
function inimigoMaisPerto(h, raio, soFrente) {
  let melhor = null, md = raio;
  for (const en of P.ini.values()) {
    if (!(en.hp > 0)) continue;
    if (soFrente && sinal(en.x - h.x) !== h.d && Math.abs(en.x - h.x) > 20) continue;
    const d = Math.hypot(en.x - h.x, (en.y - en.h / 2) - (h.y - 50));
    if (d < md) { md = d; melhor = en; }
  }
  return melhor;
}
esp.ligarEspetaculo({
  P: () => P, golpear, som, impacto: esp.impacto, inimigoMaisPerto,
  livre: (x, y) => !solido(P.nv, x, y - 20) && !solido(P.nv, x, y - 60),
  enviarFx: tipo => { const h = P.eu; h.fxId++; h.fx = [h.fxId, tipo, Math.round(h.x), Math.round(h.y), h.d]; },
});
function efeitoBlink(x, y, cor, classe) {
  if (classe === 'mago') {
    // portal arcano: círculo de runas + faíscas de cristal azul e lilás
    P.fx.push({ tipo: 'runa', x, y: y - 50, t: 0, dur: 0.45 });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 7, v = 40 + Math.random() * 160;
      P.parts.push({ x: x + Math.cos(a) * 10, y: y - 50 + Math.sin(a) * 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, vida: 0.6, max: 0.6, cor: i % 2 ? '#9fd8ff' : '#d6b3ff', tam: 2 + Math.random() * 3, grav: -0.1 });
    }
    return;
  }
  P.fx.push({ tipo: 'anel', x, y: y - 45, t: 0, dur: 0.25, cor, raio: 45 });
  for (let i = 0; i < 12; i++) { const a = Math.random() * 7, v = 80 + Math.random() * 200; P.parts.push({ x, y: y - 20 - Math.random() * 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.3, max: 0.3, cor: '#fff', tam: 2 + Math.random() * 2, grav: 0 }); }
}
function numero(x, y, v, cor, grande) { P.nums.push({ x: x + (Math.random() - 0.5) * 16, y, v, cor, t: 0, grande }); }
function faiscas(x, y, cor, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 100 + Math.random() * 300; P.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.35, max: 0.35, cor, tam: 2 + Math.random() * 3, grav: 0.3 }); }
}
function poeira(x, y, n) {
  for (let i = 0; i < n; i++) P.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 2, vx: (Math.random() - 0.5) * 120, vy: -30 - Math.random() * 60, vida: 0.4, max: 0.4, cor: 'rgba(200,190,240,.6)', tam: 3 + Math.random() * 3, grav: 0 });
}

function atualizarEfeitos(dt) {
  const nv = P.nv;
  for (const p of P.parts) { p.vy += 1400 * (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; if (p.rot !== undefined) p.rot += dt * 8; }
  P.parts = P.parts.filter(p => p.vida > 0);
  if (P.parts.length > 500) P.parts.splice(0, P.parts.length - 500);
  for (const f of P.fx) f.t += dt;
  P.fx = P.fx.filter(f => f.t < f.dur);
  for (const n of P.nums) { n.t += dt; n.y -= 50 * dt; }
  P.nums = P.nums.filter(n => n.t < 0.9);
  // tiros do mago
  const h = P.eu;
  for (const s of P.tiros) {
    s.x += s.vx * dt; s.y += (s.vy || 0) * dt; s.vida -= dt;
    if (Math.random() < 0.7) P.parts.push({ x: s.x, y: s.y + (Math.random() - 0.5) * 8, vx: -s.vx * 0.05, vy: 0, vida: 0.25, max: 0.25, cor: '#c79bff', tam: s.raio * 0.4, grav: 0 });
    if (solido(nv, s.x, s.y)) { s.vida = 0; faiscas(s.x, s.y, '#c79bff', 6); continue; }
    for (const en of P.ini.values()) {
      if (s.acertados.has(en.id) || !(en.hp > 0)) continue;
      const b = corpo(en);
      if (s.x + s.raio > b.x && s.x - s.raio < b.x + b.w && s.y + s.raio > b.y && s.y - s.raio < b.y + b.h) {
        s.acertados.add(en.id); h.d = sinal(s.vx); golpear(en, s.dano, s.kb, s.forte, s.x, s.y, s.lanca);
        if (!s.perfura) { s.vida = 0; break; }
      }
    }
  }
  P.tiros = P.tiros.filter(s => s.vida > 0);
  // meteoros (Chuva de Cristais)
  for (const m of P.meteoros) {
    m.t += dt;
    if (m.t >= m.dur && !m.caiu) {
      m.caiu = true; P.tremor = Math.max(P.tremor, 5); som.quebra();
      P.fx.push({ tipo: 'anel', x: m.alvoX, y: m.alvoY - 10, t: 0, dur: 0.35, cor: '#c79bff', raio: 75 });
      faiscas(m.alvoX, m.alvoY - 10, '#e8d5ff', 12);
      if (m.meu) for (const en of P.ini.values()) {
        if (Math.abs(en.x - m.alvoX) < 80 && Math.abs((en.y - en.h / 2) - (m.alvoY - 30)) < 110) { h.d = sinal(en.x - m.alvoX) || 1; golpear(en, 27, 220, true); }
      }
    }
  }
  P.meteoros = P.meteoros.filter(m => m.t < m.dur + 0.05);
  // tesouro
  for (const l of P.loot) {
    l.t += dt;
    if (l.t < 0.55 || h.caido) {
      l.vy += 1500 * dt; l.x += l.vx * dt; l.vx *= Math.pow(0.3, dt);
      const ny = l.y + l.vy * dt;
      if (solido(nv, l.x, ny) || bloco(nv, Math.floor(l.x / T), Math.floor(ny / T)) === 2 && l.vy > 0) { l.vy *= -0.35; l.vx *= 0.7; } else l.y = ny;
    } else {
      const dx = h.x - l.x, dy = (h.y - 34) - l.y, d = Math.hypot(dx, dy) || 1;
      const v = 300 + l.t * 900;
      l.x += dx / d * v * dt; l.y += dy / d * v * dt;
      if (d < 26) {
        l.pego = true;
        if (l.tipo === 'c') { h.cristais += l.v; som.cristal(); }
        else {
          if (h.pocoes < h.pocoesMax) { h.pocoes++; numero(h.x, h.y - 90, '+1 🧪', '#9fffb0', true); }
          else { const c = Math.round(h.mhp * 0.15); h.hp = Math.min(h.mhp, h.hp + c); numero(h.x, h.y - 90, '+' + c, '#9fffb0', true); }
          som.pocao(); atualizarBotoesHud();
        }
      }
    }
  }
  P.loot = P.loot.filter(l => !l.pego && l.t < 25);
}

// ---------- outros jogadores ----------
function atualizarOutros(dt) {
  const est = G.rede.estado || {};
  const online = new Set(jogadoresOnline());
  for (const [u, st] of Object.entries(est)) {
    if (u === meuUid() || !st || st.and !== P.andar || !online.has(u)) { if (P.outros[u] && (!st || !online.has(u))) delete P.outros[u]; continue; }
    let o = P.outros[u];
    if (!o) o = P.outros[u] = { x: st.x, y: st.y, passo: 0, ak: st.ak, st, fxId: st.fx ? st.fx[0] : 0 };
    o.st = st;
    o.x = lerp(o.x, st.x + (st.vx || 0) * 0.06, Math.min(1, dt * 14));
    o.y = lerp(o.y, st.y + (st.vy || 0) * 0.03, Math.min(1, dt * 14));
    o.passo += Math.abs(st.vx || 0) * dt * 0.045;
    if ((st.a === 'rolar') !== (o.ultA === 'rolar')) efeitoBlink(st.x, st.y, CLASSES[st.c]?.cor || '#fff', st.c);
    o.ultA = st.a;
    if (st.ak !== o.ak) {
      o.ak = st.ak;
      const C = CLASSES[st.c];
      const at = C && C.ataques[st.cb || 0];
      if (at && st.a === 'atacar' && !at.tiro) efeitoCorte(st.x, st.y, st.d, at, C.cor, st.cb);
    }
    if (st.fx && st.fx[0] !== o.fxId) {
      o.fxId = st.fx[0];
      const [, tipo, fx, fy, fd] = st.fx;
      if (tipo.startsWith('esp_')) esp.efeitoEspecial(tipo.slice(4), fx, fy, fd, false);
      else efeitoHab(tipo, fx, fy, fd, false);
      if (tipo === 'luz' && Math.hypot(fx - P.eu.x, fy - P.eu.y) < 270) {
        const h = P.eu;
        if (h.caido) reviver(0.35);
        else { const c = Math.round(h.mhp * 0.35); h.hp = Math.min(h.mhp, h.hp + c); numero(h.x, h.y - h.h - 20, '+' + c, '#9fffb0', true); som.cura(); }
      }
    }
  }
}
function meuEstado() {
  const h = P.eu;
  return {
    x: Math.round(h.x), y: Math.round(h.y), vx: Math.round(h.vx), vy: Math.round(h.vy), d: h.d, a: h.anim, f: Math.round(h.fase * 100) / 100,
    cb: h.combo, ak: h.ak, c: h.classe, s: h.sexo, n: G.nome || 'Herói', hp: Math.round(h.hp), mhp: h.mhp, cai: h.caido, por: h.naPorta,
    and: P.andar, fu: h.furiaT > 0, ch: h.noChao ? 1 : 0, rv: Math.round(h.reviveT * 10) / 10,
    ps: P.tiros.length ? P.tiros.map(s => [Math.round(s.x), Math.round(s.y), Math.round(s.vx), s.raio, Math.round(s.vy || 0)]) : 0,
    fx: h.fx || 0, t: rede.agora(),
  };
}

// ---------- laço do anfitrião ----------
function simularHost(dt) {
  const jogs = [];
  const h = P.eu;
  jogs.push({ x: h.x, y: h.y, vivo: !h.caido });
  for (const o of Object.values(P.outros)) jogs.push({ x: o.st.x, y: o.st.y, vivo: !o.st.cai });
  const mundo = {
    nv: P.nv, jogs, proj: P.proj, zonas: P.zonas,
    novoId: () => ++P.nextId,
    invocar: (tipo, x, y) => { const id = ++P.nextId; P.ini.set(id, criarInimigo({ id, tipo, x, y }, P.mult)); P.fx.push({ tipo: 'runa', x, y: y - 50, t: 0, dur: 0.6 }); },
    fx: (tipo, x, y) => {
      if (tipo === 'tremor') { P.tremor = Math.max(P.tremor, 10); som.tremor(); }
      if (tipo === 'piscar') for (let i = 0; i < 14; i++) { const a = Math.random() * 7; P.parts.push({ x, y: y + (Math.random() - 0.5) * 50, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 30, vida: 0.5, max: 0.5, cor: 'rgba(180,190,200,.5)', tam: 8 + Math.random() * 8, grav: 0 }); }
    },
  };
  for (const z of P.zonas) if (z.criado === undefined) z.criado = P.t;
  checarEmboscadas(jogs);
  for (const en of [...P.ini.values()]) {
    const perto = jogs.some(j => Math.abs(j.x - en.x) < VW * 0.9 + 300 && Math.abs(j.y - en.y) < 900);
    if (!perto && en.tipo !== 'chefe') continue;
    atualizarInimigo(en, dt, mundo);
    if (en.y > P.nv.h * T + 200) { en.hp = 0; matarInimigo(en); }
  }
  for (const z of P.zonas) if (z.criado === undefined) z.criado = P.t;
  // projéteis
  for (const q of P.proj) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt;
    if (solido(P.nv, q.x, q.y)) q.vida = 0;
    for (const j of jogs) if (j.vivo && Math.abs(q.x - j.x) < 18 && q.y > j.y - 68 && q.y < j.y) q.vida = 0;
  }
  P.proj = P.proj.filter(q => q.vida > 0 && !P.projRemovidos.has(q.id));
  P.zonas = P.zonas.filter(z => P.t - z.criado < z.espera + z.dur + 0.2);
}
function simularReplicas(dt) {
  for (const r of P.ini.values()) {
    r.x = lerp(r.x, r.tx, Math.min(1, dt * 12)); r.y = lerp(r.y, r.ty, Math.min(1, dt * 12));
    r.tE = (r.tE || 0) + dt; r.flash = Math.max(0, (r.flash || 0) - dt);
  }
  for (const q of P.proj) { q.x += q.vx * dt; q.y += q.vy * dt; }
  P.proj = P.proj.filter(q => !P.projRemovidos.has(q.id));
}

// verificações do anfitrião: portal, derrota, altar
function checarHost() {
  const ids = jogadoresOnline();
  const est = G.rede.estado || {};
  const h = P.eu;
  const estados = ids.map(u => u === meuUid() ? { por: h.naPorta, cai: h.caido, and: P.andar } : est[u]).filter(Boolean);
  if (G.meta.status === 'jogando' && !P.chefeMorto) {
    if (estados.length && estados.every(s => s.cai)) { mudarMeta({ status: 'fim' }); return; }
    const vivos = estados.filter(s => !s.cai);
    if (P.nv.portal && vivos.length && vivos.every(s => s.por && s.and === P.andar) && estados.length >= ids.length) {
      mudarMeta({ status: 'altar', andar: P.andar + 1 });
    }
  }
}
function checarAltarHost() {
  if (!G.meta || G.meta.status !== 'altar' || !souHost()) return;
  const ids = jogadoresOnline();
  if (ids.every(u => (G.players[u] || {}).pronto === G.meta.andar)) mudarMeta({ status: 'jogando', semente: novaSemente() });
}

// ---------- câmera e desenho ----------
let fundoMenu = null, tMenu = 0;
function desenhar() {
  const c = ctx;
  if (!P) { desenharMenu(); return; }
  const h = P.eu, nv = P.nv;
  // câmera
  const alvoX = h.x - VW / 2 + h.d * 70, alvoY = h.y - VISTA_H * 0.68;
  P.cam.x = lerp(P.cam.x, alvoX, 0.1); P.cam.y = lerp(P.cam.y, alvoY, 0.12);
  P.cam.x = clamp(P.cam.x, 0, nv.w * T - VW); P.cam.y = clamp(P.cam.y, 0, nv.h * T - VISTA_H);
  const tr = P.tremor;
  const sx = (Math.random() - 0.5) * tr, sy = (Math.random() - 0.5) * tr;
  const camX = P.cam.x + sx, camY = P.cam.y + sy;
  c.setTransform(1, 0, 0, 1, 0, 0);
  desenharFundo(c, P.fundo, camX * ESC, camY * ESC, cv.width, cv.height, P.t);
  c.setTransform(ESC, 0, 0, ESC, -camX * ESC, -camY * ESC);
  const t = P.t;
  const x0 = Math.max(0, Math.floor(camX / T) - 1), x1 = Math.min(nv.w - 1, Math.ceil((camX + VW) / T) + 1);
  const y0 = Math.max(0, Math.floor(camY / T) - 1), y1 = Math.min(nv.h - 1, Math.ceil((camY + VISTA_H) / T) + 1);
  const visivel = (x, y, m = 200) => x > camX - m && x < camX + VW + m && y > camY - m && y < camY + VISTA_H + m;
  // enfeites de fundo
  for (const e of nv.enfeites) if (e.t !== 'cristal' && visivel(e.x, e.y, 300)) desenharEnfeite(c, e, P.bioma, t);
  // blocos
  const B = P.blocos;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = nv.tiles[y * nv.w + x];
    if (!k) continue;
    const px = x * T, py = y * T;
    if (k === 1) {
      if (P.interior[y * nv.w + x]) { c.drawImage(B.fundoEscuro, px, py, T + 0.6, T + 0.6); continue; }
      c.drawImage(B.textura, (x % B.N) * B.S, (y % B.N) * B.S, B.S, B.S, px, py, T + 0.6, T + 0.6);
      if (bloco(nv, x, y - 1) !== 1) c.drawImage(B.topo, px, py, T + 0.6, T);
      if (bloco(nv, x, y + 1) !== 1) c.drawImage(B.baixo, px, py, T, T);
      if (bloco(nv, x - 1, y) !== 1) c.drawImage(B.lado, px, py, T, T);
      if (bloco(nv, x + 1, y) !== 1) { c.save(); c.translate(px + T, py); c.scale(-1, 1); c.drawImage(B.lado, 0, 0, T, T); c.restore(); }
    } else if (k === 2) c.drawImage(B.plataforma, px, py, T + 0.6, T);
    else if (k === 3) c.drawImage(B.espinhos, px, py, T, T);
  }
  for (const e of nv.enfeites) if (e.t === 'cristal' && visivel(e.x, e.y)) desenharEnfeite(c, e, P.bioma, t);
  // portal
  if (nv.portal && visivel(nv.portal.x, nv.portal.y, 300)) desenharPortal(c, nv.portal, P.bioma, t, h.naPorta);
  // zonas do chefe
  for (const z of P.zonas) desenharZona(c, z, P.bioma, P.t - z.criado);
  // tesouro
  for (const l of P.loot) {
    if (!visivel(l.x, l.y)) continue;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho(l.tipo === 'c' ? rgba(P.bioma.luz, 0.8) : 'rgba(120,255,160,.9)', 24), l.x - 14, l.y - 14, 28, 28); c.restore();
    if (l.tipo === 'c') cristal(c, l.x, l.y + 6, 13, 7, P.bioma.cristal, Math.sin(t * 5 + l.x) * 0.4);
    else { c.fillStyle = '#9fffb0'; c.strokeStyle = '#140d22'; c.lineWidth = 2; c.beginPath(); c.arc(l.x, l.y, 8, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#6b4a2b'; c.fillRect(l.x - 3, l.y - 13, 6, 5); }
  }
  // monstros
  for (const en of P.ini.values()) {
    if (!visivel(en.x, en.y)) continue;
    desenharInimigo(c, en, t, P.bioma);
    if (en.flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = en.flash / 0.12 * 0.8; c.drawImage(brilho('rgba(255,255,255,.9)', 48), en.x - en.w, en.y - en.h - 10, en.w * 2, en.h + 20); c.restore(); }
  }
  // outros heróis
  for (const [u, o] of Object.entries(P.outros)) {
    const st = o.st;
    const pose = calcularPose({ anim: st.a, fase: st.f, passo: o.passo, combo: st.cb, classe: st.c, vy: st.vy, ataqueInfo: { fimRel: fimRelDe(st) } }, t);
    desenharHeroiMundo(c, o.x, o.y, st.d, st.c, st.s, pose, t, { vx: st.vx, furia: st.fu, alpha: 1, chao: st.ch !== 0 });
    // nome e vida
    c.font = '700 13px Nunito, sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(o.x - 24, o.y - 100, 48, 5);
    c.fillStyle = st.cai ? '#888' : '#7dffb0'; c.fillRect(o.x - 24, o.y - 100, 48 * clamp(st.hp / st.mhp, 0, 1), 5);
    c.fillStyle = '#fff'; c.fillText(st.n || '', o.x, o.y - 106);
    if (st.cai) { c.fillStyle = '#ffe28a'; c.fillText(st.rv > 0 ? 'levantando…' : '⬇ ajude!', o.x, o.y - 120); }
    if (st.ps) for (const [x, y, vx, r, vy] of st.ps) {
      const id = clamp((Date.now() - (st.t || 0)) / 1000, 0, 0.12);
      const ex = x + vx * id, ey = y + (vy || 0) * id;
      c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(199,155,255,.9)', 32), ex - r * 2.2, ey - r * 2.2, r * 4.4, r * 4.4); c.restore();
    }
  }
  // eu
  const pose = calcularPose(h, t);
  let alpha = 1;
  if (h.invT > 0 && !h.caido && h.rolarT <= 0 && h.habT <= 0) alpha = Math.sin(t * 40) > 0 ? 0.45 : 1;
  if (h.classe === 'vampiro' && h.habT > 0) alpha = 0.15;
  if (h.furiaT > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,90,40,.7)', 64), h.x - 60, h.y - 110, 120, 120); c.restore(); }
  desenharHeroiMundo(c, h.x, h.y, h.d, h.classe, h.sexo, pose, t, { vx: h.vx, furia: h.furiaT > 0, alpha, chao: !!h.noChao });
  if (h.cargaT > 0.1 && !h.cargaUsada && ctrl.segura.atacar) {
    const k = clamp((h.cargaT - 0.1) / 0.22, 0, 1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.4 + 0.6 * k;
    c.drawImage(brilho(rgba(CLASSES[h.classe].cor, 0.9), 64), h.x - 50 - k * 20, h.y - 100 - k * 20, 100 + k * 40, 110 + k * 40);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(h.x, h.y - 50, 60 * (1 - k) + 18, 0, 7); c.stroke();
    c.restore();
  }
  if (h.critT > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.3 * Math.sin(P.t * 20); c.drawImage(brilho('rgba(255,226,138,.8)', 48), h.x - 45, h.y - 105, 90, 115); c.restore(); }
  if (h.caido) {
    c.strokeStyle = '#ffe28a'; c.lineWidth = 4; c.beginPath(); c.arc(h.x, h.y - 50, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (h.reviveT / 2)); c.stroke();
  }
  esp.desenharMundo(c, t);
  // tiros do mago
  for (const s of P.tiros) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(199,155,255,.95)', 32), s.x - s.raio * 2.4, s.y - s.raio * 2.4, s.raio * 4.8, s.raio * 4.8);
    c.restore();
    c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy || 0, s.vx) + Math.PI / 2);
    cristal(c, 0, s.raio, s.raio * 2.6, s.raio * 1.1, ['#ffffff', '#c79bff', '#7c4dff'], 0); c.restore();
  }
  // meteoros
  for (const m of P.meteoros) {
    if (m.t < 0) continue;
    const k = clamp(m.t / m.dur, 0, 1);
    const mx = lerp(m.x, m.alvoX, k), my = lerp(m.y, m.alvoY - 10, k * k);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(199,155,255,.9)', 48), mx - 30, my - 30, 60, 60); c.restore();
    c.save(); c.translate(mx, my); c.rotate(Math.atan2(m.alvoY - m.y, m.alvoX - m.x) - Math.PI / 2);
    cristal(c, 0, -10, 40, 16, ['#ffffff', '#c79bff', '#5a2ea8'], Math.PI); c.restore();
  }
  // projéteis inimigos
  for (const q of P.proj) if (visivel(q.x, q.y)) desenharProjetil(c, q, P.bioma, t);
  // efeitos
  for (const f of P.fx) desenharFx(c, f);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of P.parts) {
    const a = clamp(p.vida / p.max, 0, 1);
    c.globalAlpha = a; c.fillStyle = p.cor;
    if (p.morcego) { c.globalCompositeOperation = 'source-over'; c.beginPath(); c.moveTo(p.x - 8, p.y - 3); c.lineTo(p.x, p.y + 2); c.lineTo(p.x + 8, p.y - 3); c.lineTo(p.x, p.y - 1); c.fill(); c.globalCompositeOperation = 'lighter'; }
    else if (p.caco) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.tam / 2, -p.tam, p.tam, p.tam * 2); c.restore(); }
    else c.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
  }
  c.restore(); c.globalAlpha = 1;
  // números
  c.textAlign = 'center';
  for (const n of P.nums) {
    const a = 1 - n.t / 0.9;
    c.globalAlpha = a; c.font = `900 ${n.grande ? 26 : 20}px Nunito, sans-serif`;
    c.lineWidth = 4; c.strokeStyle = '#140d22'; c.strokeText(n.v, n.x, n.y); c.fillStyle = n.cor; c.fillText(n.v, n.x, n.y);
  }
  c.globalAlpha = 1;

  // tela: luz, bruma, vinheta e HUD
  c.setTransform(1, 0, 0, 1, 0, 0);
  desenharAtmosfera(c, P.fundo, camX * ESC, camY * ESC, cv.width, cv.height, P.t);
  const g = c.createLinearGradient(0, cv.height * 0.65, 0, cv.height);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.bioma.bruma);
  c.fillStyle = g; c.fillRect(0, cv.height * 0.65, cv.width, cv.height * 0.35);
  if (vermelho > 0) { c.fillStyle = `rgba(255,30,60,${vermelho * 0.35})`; c.fillRect(0, 0, cv.width, cv.height); }
  if (P.lentoT > 0) { c.fillStyle = `rgba(150,200,255,${Math.min(0.22, P.lentoT * 0.4)})`; c.fillRect(0, 0, cv.width, cv.height); }
  desenharVinheta(c);
  desenharHud(c);
  esp.desenharTela(c, cv.width, cv.height, (x, y) => [(x - camX) * ESC, (y - camY) * ESC]);
}
function fimRelDe(st) { const C = CLASSES[st.c]; const at = C && C.ataques[st.cb || 0]; return at ? at.fim / at.dur : 0.6; }
function desenharHeroiMundo(c, x, y, d, classe, sexo, pose, t, extra) {
  c.save(); c.translate(x, y); c.scale(d < 0 ? -1 : 1, 1);
  c.globalAlpha = extra.alpha ?? 1;
  // sombra
  if (extra.chao !== false) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 18, 4, 0, 0, 7); c.fill(); }
  if (pose.src && pose.src.anim === 'rolar') {
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    if (classe === 'mago') {
      // blink arcano: rastro de orbes e estrelinhas de cristal
      for (let i = 0; i < 9; i++) {
        const k = i / 8, x0 = -10 - k * 150, y0 = -50 + Math.sin(t * 18 + i * 1.3) * 18 * k;
        c.globalAlpha = 0.85 * (1 - k);
        const r = 26 * (1 - k * 0.6);
        c.drawImage(brilhoArte(i % 2 ? 'rgba(159,216,255,.9)' : 'rgba(200,150,255,.9)', 32), x0 - r, y0 - r, r * 2, r * 2);
        c.fillStyle = '#ffffff';
        const e = 5 * (1 - k) * (0.6 + 0.4 * Math.sin(t * 30 + i));
        c.beginPath(); c.moveTo(x0, y0 - e * 2); c.lineTo(x0 + e * 0.5, y0); c.lineTo(x0, y0 + e * 2); c.lineTo(x0 - e * 0.5, y0); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(x0 - e * 2, y0); c.lineTo(x0, y0 + e * 0.5); c.lineTo(x0 + e * 2, y0); c.lineTo(x0, y0 - e * 0.5); c.closePath(); c.fill();
      }
      c.restore();
      desenharHeroi(c, classe, sexo, pose, t, extra);
      c.restore();
      return;
    }
    // blink: tracinhos de velocidade atrás do herói
    const cor = CLASSES[classe]?.cor || '#fff';
    for (let i = 0; i < 9; i++) {
      const y0 = -10 - i * 10, ini = -8 - ((i * 37) % 23), len = 40 + ((i * 53 + Math.floor(t * 30) * 17) % 70);
      c.globalAlpha = 0.35 + 0.5 * ((i * 29) % 7) / 7;
      c.strokeStyle = i % 3 ? cor : '#ffffff'; c.lineWidth = i % 3 ? 2.5 : 1.5;
      c.beginPath(); c.moveTo(ini, y0); c.lineTo(ini - len, y0); c.stroke();
    }
    c.restore();
  }
  desenharHeroi(c, classe, sexo, pose, t, extra);
  c.restore();
}
let vinheta = null;
function desenharVinheta(c) {
  if (!vinheta || vinheta.width !== cv.width || vinheta.height !== cv.height) {
    vinheta = document.createElement('canvas'); vinheta.width = cv.width; vinheta.height = cv.height;
    const v = vinheta.getContext('2d');
    const g = v.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.width * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,2,20,.6)');
    v.fillStyle = g; v.fillRect(0, 0, cv.width, cv.height);
  }
  c.drawImage(vinheta, 0, 0);
}
function desenharFx(c, f) {
  const k = f.t / f.dur;
  c.save(); c.globalCompositeOperation = 'lighter';
  if (f.tipo === 'corte' || f.tipo === 'garra') {
    c.translate(f.x + f.d * 6, f.y - 40); c.scale(f.d, 1);
    const r = f.alc * 0.85, n = f.tipo === 'garra' ? 3 : 1;
    const ini = f.combo % 2 ? 1.3 : -1.6, fim = f.combo % 2 ? -1.0 : 1.2;
    for (let i = 0; i < n; i++) {
      c.globalAlpha = (1 - k) * (f.forte ? 1 : 0.85);
      c.strokeStyle = f.cor; c.lineWidth = (f.forte ? 14 : 9) * (1 - k * 0.5) - i * 2;
      c.beginPath();
      const rr = r - i * 10;
      const a0 = ini, a1 = lerp(ini, fim, Math.min(1, k * 2.2));
      c.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.globalAlpha *= 0.8; c.stroke();
    }
  } else if (f.tipo === 'subida') {
    // lançador: arco de baixo pra cima
    c.translate(f.x + f.d * 30, f.y - 30); c.scale(f.d, 1);
    c.globalAlpha = 1 - k; c.strokeStyle = f.cor; c.lineWidth = 16 * (1 - k * 0.5);
    c.beginPath(); c.arc(0, 0, 70, Math.PI * 0.5, Math.PI * 0.5 - Math.PI * 1.1 * Math.min(1, k * 2.5), true); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
  } else if (f.tipo === 'estocada') {
    c.translate(f.x, f.y - 46); c.scale(f.d, 1);
    c.globalAlpha = 1 - k; c.strokeStyle = f.cor; c.lineWidth = 6 * (1 - k);
    c.beginPath(); c.moveTo(10, 0); c.lineTo(10 + f.alc * Math.min(1, k * 3), 0); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  } else if (f.tipo === 'soco') {
    c.translate(f.x + f.d * (f.alc - 10), f.y - 46);
    c.globalAlpha = 1 - k; c.fillStyle = f.cor;
    const r = (f.forte ? 30 : 18) * (0.5 + k);
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
  } else if (f.tipo === 'anel') {
    c.globalAlpha = 1 - k; c.strokeStyle = f.cor; c.lineWidth = 8 * (1 - k) + 1;
    c.beginPath(); c.ellipse(f.x, f.y, f.raio * (0.3 + k * 0.8), f.raio * (0.3 + k * 0.8) * 0.7, 0, 0, 7); c.stroke();
  } else if (f.tipo === 'luz') {
    c.globalAlpha = Math.sin(k * Math.PI);
    const g = c.createLinearGradient(f.x - 70, 0, f.x + 70, 0);
    g.addColorStop(0, 'rgba(255,243,176,0)'); g.addColorStop(0.5, 'rgba(255,243,176,.85)'); g.addColorStop(1, 'rgba(255,243,176,0)');
    c.fillStyle = g; c.fillRect(f.x - 70, f.y - 700, 140, 700);
    c.drawImage(brilho('rgba(255,243,176,.9)', 96), f.x - 230, f.y - 140, 460, 280);
  } else if (f.tipo === 'runa') {
    // círculo mágico em pé (de lado), girando e sumindo
    const ab = Math.min(1, k * 4), some = 1 - Math.max(0, (k - 0.5) * 2);
    c.globalAlpha = some; c.translate(f.x, f.y);
    c.drawImage(brilho('rgba(159,216,255,.8)', 64), -50, -75, 100, 150);
    c.strokeStyle = '#bfe6ff'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, 0, 16 * ab, 58 * ab, 0, 0, 7); c.stroke();
    c.strokeStyle = '#d6b3ff'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 0, 11 * ab, 42 * ab, 0, 0, 7); c.stroke();
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) { const a = f.t * 6 + i * 0.628; c.fillRect(Math.cos(a) * 14 * ab - 1.5, Math.sin(a) * 50 * ab - 1.5, 3, 3); }
  } else if (f.tipo === 'rastro') {
    c.globalAlpha = (1 - k) * 0.7; c.fillStyle = f.cor;
    c.fillRect(Math.min(f.x, f.x - f.d * 160), f.y - 60, 160, 50);
  }
  c.restore();
}

function px(v) { return v * DPR; }
function desenharHud(c) {
  const h = P.eu, C = CLASSES[h.classe];
  const s = DPR;
  c.save(); c.scale(s, s);
  const x = 14 + (TOQUE ? 6 : 0), y = 12;
  // vida
  c.fillStyle = 'rgba(10,6,30,.7)'; roundRect(c, x, y, 230, 76, 12); c.fill();
  c.strokeStyle = 'rgba(199,155,255,.5)'; c.lineWidth = 1.5; c.stroke();
  c.font = '800 13px Cinzel, serif'; c.fillStyle = '#e8d5ff'; c.textAlign = 'left';
  c.fillText(`${G.nome || 'Herói'} · ${nomeClasse(h.classe, h.sexo)}`, x + 10, y + 18);
  c.fillStyle = '#2a1430'; roundRect(c, x + 10, y + 26, 210, 14, 7); c.fill();
  const fr = clamp(h.hp / h.mhp, 0, 1);
  const gv = c.createLinearGradient(x + 10, 0, x + 220, 0); gv.addColorStop(0, '#ff4d6d'); gv.addColorStop(1, '#ff9a7a');
  c.fillStyle = gv; roundRect(c, x + 10, y + 26, Math.max(0.01, 210 * fr), 14, 7); c.fill();
  c.font = '800 11px Nunito, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center';
  c.fillText(`${Math.ceil(h.hp)} / ${h.mhp}`, x + 115, y + 37);
  // barra do especial
  const fe = clamp((h.esp || 0) / esp.ESP_MAX, 0, 1), cheio = fe >= 1;
  c.fillStyle = '#1c1238'; roundRect(c, x + 10, y + 45, 210, 8, 4); c.fill();
  const ge = c.createLinearGradient(x + 10, 0, x + 220, 0); ge.addColorStop(0, '#7c4dff'); ge.addColorStop(1, cheio ? '#ffe28a' : '#c79bff');
  c.fillStyle = ge; roundRect(c, x + 10, y + 45, Math.max(0.01, 210 * fe), 8, 4); c.fill();
  if (cheio) { c.save(); c.globalAlpha = 0.5 + 0.5 * Math.sin(P.t * 10); c.strokeStyle = '#ffe28a'; c.lineWidth = 2; roundRect(c, x + 9, y + 44, 212, 10, 5); c.stroke(); c.restore(); }
  c.textAlign = 'left'; c.font = '800 13px Nunito, sans-serif'; c.fillStyle = '#fff';
  c.fillText(`🧪 ${h.pocoes}/${h.pocoesMax}   💎 ${h.cristais}`, x + 10, y + 69);
  if (cheio) { c.font = '900 12px Cinzel, serif'; c.fillStyle = '#ffe28a'; c.textAlign = 'right'; c.fillText(TOQUE ? 'ESPECIAL!' : 'ESPECIAL [U]', x + 220, y + 69); c.textAlign = 'left'; }
  // habilidade (no teclado)
  if (!TOQUE) {
    const hx = x + 240, hy = y + 4;
    c.fillStyle = 'rgba(10,6,30,.7)'; c.beginPath(); c.arc(hx + 26, hy + 27, 26, 0, 7); c.fill();
    c.fillStyle = h.habCd > 0 ? 'rgba(120,120,140,.8)' : C.cor;
    c.font = '800 11px Cinzel, serif'; c.textAlign = 'center'; c.fillText(C.hab, hx + 26, hy + 25);
    c.font = '800 11px Nunito, sans-serif'; c.fillText(h.habCd > 0 ? h.habCd.toFixed(1) : '[K]', hx + 26, hy + 39);
    if (h.habCd > 0) { c.strokeStyle = C.cor; c.lineWidth = 3; c.beginPath(); c.arc(hx + 26, hy + 27, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - h.habCd / (C.habCd * h.mods.cd))); c.stroke(); }
  }
  // aliados
  let ay = y + 86;
  for (const o of Object.values(P.outros)) {
    const st = o.st;
    c.fillStyle = 'rgba(10,6,30,.6)'; roundRect(c, x, ay, 160, 22, 8); c.fill();
    c.fillStyle = '#fff'; c.font = '700 11px Nunito, sans-serif'; c.textAlign = 'left';
    c.fillText((st.cai ? '💀 ' : '') + (st.n || ''), x + 8, ay + 15);
    c.fillStyle = '#2a1430'; c.fillRect(x + 80, ay + 8, 72, 6);
    c.fillStyle = '#7dffb0'; c.fillRect(x + 80, ay + 8, 72 * clamp(st.hp / st.mhp, 0, 1), 6);
    ay += 26;
    // seta se estiver fora da tela
    const sx = (o.x - P.cam.x) * ESC / s, sy = (o.y - 40 - P.cam.y) * ESC / s;
    if (sx < 0 || sx > LW || sy < 0 || sy > LH) {
      const cx = clamp(sx, 30, LW - 30), cy = clamp(sy, 90, LH - 30);
      const a = Math.atan2(sy - cy, sx - cx);
      c.save(); c.translate(cx, cy); c.rotate(a);
      c.fillStyle = st.cai ? '#ffe28a' : CLASSES[st.c]?.cor || '#fff';
      c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -9); c.lineTo(-8, 9); c.closePath(); c.fill(); c.restore();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(st.n || '', cx, cy - 14);
    }
  }
  // andar
  c.textAlign = 'center'; c.font = '800 14px Cinzel, serif'; c.fillStyle = 'rgba(232,213,255,.85)';
  if (!P.nv.chefe) c.fillText(`Andar ${P.andar} · ${P.bioma.nome}`, Math.max(LW / 2, 420), 24);
  // chefe
  const chefe = [...P.ini.values()].find(e => e.tipo === 'chefe');
  if (chefe) {
    const w = Math.min(520, LW - 400), bx = Math.max(LW / 2 - w / 2, 300), by = 10;
    c.fillStyle = 'rgba(10,6,30,.75)'; roundRect(c, bx - 6, by - 4, w + 12, 30, 10); c.fill();
    c.fillStyle = '#3a1030'; c.fillRect(bx, by + 12, w, 9);
    const gb = c.createLinearGradient(bx, 0, bx + w, 0); gb.addColorStop(0, '#ff4fc8'); gb.addColorStop(1, '#ffb3ec');
    c.fillStyle = gb; c.fillRect(bx, by + 12, w * clamp(chefe.hp / chefe.mhp, 0, 1), 9);
    c.font = '800 12px Cinzel, serif'; c.fillStyle = '#ffd6f4'; c.fillText(DEFS.chefe.nome, bx + w / 2, by + 9);
  }
  // contador de combo
  const cb = P.cmb;
  if (cb.n >= 3) {
    const cx = LW - 40, cy = LH * 0.32, esc = 1 + cb.pulso * 0.25;
    c.save(); c.translate(cx, cy); c.scale(esc, esc); c.textAlign = 'right';
    c.font = '900 44px Nunito, sans-serif'; c.lineWidth = 6; c.strokeStyle = '#140d22';
    const cor = cb.n >= 50 ? '#ff7ad9' : cb.n >= 35 ? '#ff9a5a' : cb.n >= 20 ? '#ffe28a' : cb.n >= 10 ? '#9fe8ff' : '#ffffff';
    c.strokeText(cb.n, 0, 0); c.fillStyle = cor; c.fillText(cb.n, 0, 0);
    c.font = '800 14px Cinzel, serif'; c.strokeText('GOLPES', 0, 20); c.fillText('GOLPES', 0, 20);
    const nota = cb.n >= 50 ? 'LENDÁRIO!' : cb.n >= 35 ? 'Brutal!' : cb.n >= 20 ? 'Estiloso!' : cb.n >= 10 ? 'Bom!' : '';
    if (nota) { c.font = '900 18px Cinzel, serif'; c.strokeText(nota, 0, 44); c.fillText(nota, 0, 44); }
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-90, 54, 90, 3); c.fillStyle = cor; c.fillRect(-90, 54, 90 * clamp(cb.t / 1.8, 0, 1), 3);
    c.restore();
  }
  // portal / espera
  if (h.naPorta && G.modo === 'sala') {
    const est = G.rede.estado || {};
    const ids = jogadoresOnline();
    const n = ids.filter(u => u === meuUid() ? h.naPorta : est[u]?.por).length;
    c.font = '800 16px Cinzel, serif'; c.fillStyle = '#fff';
    c.fillText(`No portal: ${n}/${ids.length} — esperando os outros…`, LW / 2, LH * 0.3);
  }
  if (h.caido) {
    c.font = '800 20px Cinzel, serif'; c.fillStyle = '#ffe28a';
    c.fillText('Você caiu! Um amigo precisa ficar do seu lado', LW / 2, LH * 0.3);
  }
  c.restore();
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function desenharMenu() {
  const c = ctx;
  if (!fundoMenu) fundoMenu = criarFundo(BIOMAS[0], cv.width, cv.height, 3);
  tMenu += 1 / 60;
  c.setTransform(1, 0, 0, 1, 0, 0);
  desenharFundo(c, fundoMenu, tMenu * 40, 0, cv.width, cv.height, tMenu);
  desenharAtmosfera(c, fundoMenu, tMenu * 40, 0, cv.width, cv.height, tMenu);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 137.5 + tMenu * 20 * (1 + i % 3)) % (cv.width + 40)) - 20;
    const y = cv.height - ((i * 91 + tMenu * 30 * (1 + i % 4)) % cv.height);
    c.globalAlpha = 0.3 + 0.3 * Math.sin(tMenu * 2 + i);
    c.drawImage(brilho('rgba(199,155,255,.9)', 16), x - 6 * DPR, y - 6 * DPR, 12 * DPR, 12 * DPR);
  }
  c.restore();
  desenharVinheta(c);
}

// ---------- laço ----------
let ultimo = performance.now();
function quadro(agoraMs) {
  requestAnimationFrame(quadro);
  let dt = Math.min(1 / 30, (agoraMs - ultimo) / 1000);
  ultimo = agoraMs;
  if (P && !(G.modo === 'solo' && G.pausado)) passo(dt);
  desenhar();
  if (G.tela === 'telaHeroi') desenharPreviews(agoraMs / 1000);
  if (G.tela === 'telaSala') desenharMiniaturas(agoraMs / 1000);
}
function passo(dt) {
  vermelho = Math.max(0, vermelho - dt * 1.5);
  P.tremor = Math.max(0, P.tremor - dt * 40);
  const jogando = G.meta && G.meta.status === 'jogando';
  P.status = jogando ? 'jogando' : G.meta?.status;
  // pausa curtinha do impacto (só o meu mundo)
  const dtReal = dt;
  if (P.cutin) dt *= 0.03;
  if (P.paraT > 0) { P.paraT -= dt; dt *= 0.08; }
  if (P.lentoT > 0) { P.lentoT -= dt; dt *= 0.32; }
  if (P.cmb.t > 0) { P.cmb.t -= dt; if (P.cmb.t <= 0) P.cmb.n = 0; }
  P.cmb.pulso = Math.max(0, P.cmb.pulso - dt * 4);
  P.t += dt;
  if (G.modo === 'sala') atualizarOutros(dt);
  if (jogando) atualizarEu(dt);
  if (P.host) simularHost(dt); else simularReplicas(dt);
  atualizarEfeitos(dt);
  esp.atualizar(dt, dtReal);
  if (G.tela === null || G.tela === 'jogo') atualizarBotaoHab();
  // rede
  if (G.modo === 'sala') {
    P.envT -= dt;
    if (P.envT <= 0) {
      P.envT = 0.08;
      rede.enviarEstado(G.codigo, meuEstado()).catch(() => {});
      if (P.golpeFila.length) {
        P.golpeN++;
        rede.enviarGolpe(G.codigo, P.golpeN, P.golpeFila).catch(() => {});
        if (P.golpeN > 40) rede.apagarGolpe(G.codigo, P.golpeN - 40).catch(() => {});
        P.golpeFila = [];
      }
    }
    if (P.host) {
      P.envIniT -= dt;
      if (P.envIniT <= 0) { P.envIniT = 0.1; enviarInimigos(); }
    }
    vigiarHost(dt);
  }
  P.checarT -= dt;
  if (P.host && P.checarT <= 0 && jogando) {
    P.checarT = 0.25;
    if (G.modo === 'solo') {
      if (P.eu.naPorta && !P.chefeMorto) mudarMeta({ status: 'altar', andar: P.andar + 1 });
    } else checarHost();
  }
}
function vigiarHost(dt) {
  if (!G.meta || souHost()) { G.hostAusenteT = 0; return; }
  const hp = G.players[G.meta.host];
  if (!hp || !hp.online) {
    G.hostAusenteT += dt;
    if (G.hostAusenteT > 3 && jogadoresOnline()[0] === rede.meuId()) { G.hostAusenteT = -10; mudarMeta({ host: rede.meuId() }); }
  } else G.hostAusenteT = 0;
}

let ultCd = -1;
function atualizarBotaoHab() {
  if (!TOQUE || !P) return;
  const pe = clamp((P.eu.esp || 0) / esp.ESP_MAX, 0, 1);
  const be = $('#bEsp'); be.style.setProperty('--carga', pe); be.classList.toggle('pronto', pe >= 1);
  const h = P.eu, C = CLASSES[h.classe];
  const v = h.habCd > 0 ? Math.round(h.habCd / (C.habCd * h.mods.cd) * 40) / 40 : 0;
  if (v !== ultCd) { ultCd = v; $('#bHab').style.setProperty('--cd', v); }
}
function atualizarBotoesHud() {
  if (!P) return;
  $('#nPocao').textContent = P.eu.pocoes;
  $('#habNome').textContent = CLASSES[P.eu.classe].hab;
}

// ---------- altar ----------
const BENCAOS = [
  { id: 'lamina', ic: '🗡️', nome: 'Lâmina Afiada', txt: '+20% de dano', f: h => { h.mods.dano *= 1.2; } },
  { id: 'coracao', ic: '💜', nome: 'Coração de Cristal', txt: '+30 de vida máxima', f: h => { h.mhp += 30; h.hp += 30; } },
  { id: 'pes', ic: '🪶', nome: 'Pés Alados', txt: '+12% de velocidade', f: h => { h.mods.vel *= 1.12; } },
  { id: 'maos', ic: '⚡', nome: 'Mãos Ligeiras', txt: '+15% de velocidade de ataque', f: h => { h.mods.atkVel *= 1.15; } },
  { id: 'arcano', ic: '🔮', nome: 'Recarga Arcana', txt: 'Habilidade volta 25% mais rápido', f: h => { h.mods.cd *= 0.75; } },
  { id: 'sangue', ic: '🩸', nome: 'Sede de Sangue', txt: 'Recupera 5% do dano que causa', f: h => { h.mods.rouba += 0.05; } },
  { id: 'olho', ic: '🎯', nome: 'Olho de Águia', txt: '+12% de chance de crítico (dano dobrado)', f: h => { h.mods.crit += 0.12; } },
  { id: 'pedra', ic: '🛡️', nome: 'Pele de Pedra', txt: 'Leva 15% menos dano', f: h => { h.mods.def *= 0.85; } },
  { id: 'elixir', ic: '✨', nome: 'Elixir Celeste', txt: 'Cura toda a vida agora', f: h => { h.hp = h.mhp; } },
];
function abrirAltar(andar) {
  G.altarAndar = andar;
  const h = G.heroi;
  if (h.caido) { h.caido = false; h.hp = Math.round(h.mhp * 0.3); }
  h.pocoes = h.pocoesMax;
  som.portal();
  const r = rng(Date.now());
  if (!h.ecos) h.ecos = {};
  const ecos = esp.ECOS.filter(e => (h.ecos[e.id] || 0) < 3).map(e => ({ ...e, txt: h.ecos[e.id] ? `${e.txt} — nível ${h.ecos[e.id] + 1}` : e.txt, f: hh => { hh.ecos[e.id] = (hh.ecos[e.id] || 0) + 1; } }));
  const ecoSorteado = ecos.sort(() => r() - 0.5).slice(0, 1);
  const resto = [...BENCAOS, ...ecos.filter(e => !ecoSorteado.includes(e))].sort(() => r() - 0.5).slice(0, 2);
  const ops = [...ecoSorteado, ...resto].sort(() => r() - 0.5);
  const box = $('#bencaos'); box.innerHTML = '';
  $('#altarSub').textContent = `Antes do andar ${andar}${ehChefe(andar) ? ' — o chefe espera!' : ''} · escolha uma bênção`;
  $('#altarEspera').textContent = '';
  for (const b of ops) {
    const el = document.createElement('button'); el.className = 'bencao';
    el.innerHTML = `<span class="ic">${b.ic}</span><b>${b.nome}</b><small>${b.txt}</small>`;
    el.onclick = () => {
      b.f(h); h.bencaos.push(b.id); som.bencao();
      box.querySelectorAll('button').forEach(x => x.disabled = true); el.classList.add('escolhida'); el.disabled = false;
      if (G.modo === 'solo') mudarMeta({ status: 'jogando', semente: novaSemente() });
      else { rede.atualizarEu(G.codigo, { pronto: andar }); $('#altarEspera').textContent = 'Esperando os outros escolherem…'; }
    };
    box.appendChild(el);
  }
  atualizarLoja();
  mostrar('telaAltar');
}
function atualizarLoja() {
  const h = G.heroi, preco = 40 + 30 * (h.pocoesMax - 2);
  $('#precoFrasco').textContent = preco; $('#altarCristais').textContent = h.cristais;
  $('#bComprarFrasco').disabled = h.cristais < preco || h.pocoesMax >= 5;
}
$('#bComprarFrasco').onclick = () => {
  const h = G.heroi, preco = 40 + 30 * (h.pocoesMax - 2);
  if (h.cristais < preco) return;
  h.cristais -= preco; h.pocoesMax++; h.pocoes = h.pocoesMax; som.cristal(); atualizarLoja();
};

// ---------- fim ----------
function mostrarFim(vitoria) {
  if (G.tela === 'telaFim') return;
  const h = G.heroi;
  musica(false);
  $('#fimTitulo').textContent = vitoria ? 'Vitória!' : 'Fim da jornada';
  $('#fimTexto').textContent = vitoria ? 'O Guardião do Prisma caiu. Dá pra continuar descendo — fica mais difícil!' : (G.modo === 'solo' ? 'Você caiu na cripta…' : 'Todo o grupo caiu na cripta…');
  $('#fimStats').innerHTML = `<span>Andar ${P ? P.andar : G.meta.andar}</span><span>👹 ${h ? h.mortos : 0} monstros</span><span>💎 ${h ? h.cristais : 0} cristais</span>`;
  const host = souHost();
  $('#bContinuar').hidden = !(vitoria && host);
  $('#bDeNovo').hidden = !host;
  $('#fimEspera').textContent = host ? '' : 'Esperando o anfitrião decidir…';
  mostrar('telaFim');
  if (vitoria) som.bencao(); else som.morte();
}
$('#bContinuar').onclick = () => mudarMeta({ status: 'altar', andar: (P ? P.andar : G.meta.andar) + 1 });
$('#bDeNovo').onclick = () => {
  if (G.modo === 'solo') comecarSolo();
  else { mudarMeta({ status: 'lobby' }); rede.limparPartida(G.codigo).catch(() => {}); }
};
$('#bMenu').onclick = () => irMenu();

// ---------- pausa ----------
function pausar() {
  if (!P || G.tela === 'telaAltar' || G.tela === 'telaFim') return;
  G.pausado = true;
  $('#pausaAviso').textContent = G.modo === 'sala' ? 'Com amigos o jogo continua rolando!' : '';
  mostrar('telaPausa');
}
$('#bPausa').onclick = pausar;
addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') { if (G.tela === 'telaPausa') continuar(); else if (P && (G.tela === null || G.tela === 'jogo')) pausar(); } });
function continuar() { G.pausado = false; mostrar(null); ultimo = performance.now(); }
$('#bContinuarPausa').onclick = continuar;
$('#bFlashes').textContent = esp.config.flashes ? '⚡ Flashes de impacto: ligados' : '⚡ Flashes de impacto: desligados';
$('#bFlashes').onclick = () => { const on = esp.alternarFlashes(); $('#bFlashes').textContent = on ? '⚡ Flashes de impacto: ligados' : '⚡ Flashes de impacto: desligados'; };
$('#bSom').onclick = () => { const on = alternarSom(); $('#bSom').textContent = on ? '🔊 Som ligado' : '🔇 Som desligado'; };
$('#bDesistir').onclick = () => irMenu();

// ---------- menu e sala ----------
function irMenu() {
  pararPartida();
  if (G.sairSala) { G.sairSala(); G.sairSala = null; }
  G.modo = null; G.codigo = null; G.meta = null; G.heroi = null; G.run = null; G.pausado = false; G.altarAndar = -1;
  mostrar('telaInicio');
}
$('#nome').value = G.nome;
$('#nome').addEventListener('input', e => { G.nome = e.target.value.trim().slice(0, 14); localStorage.setItem('cc_nome', G.nome); });
let depoisDoHeroi = null;
function escolherHeroi(depois) { depoisDoHeroi = depois; montarCartas(); mostrar('telaHeroi'); }

$('#bSolo').onclick = () => { iniciarSom(); escolherHeroi(() => comecarSolo()); };
function comecarSolo() {
  pararPartida();
  G.modo = 'solo'; G.altarAndar = -1; G.pausado = false;
  G.meta = { host: uidSolo, status: 'lobby', andar: 1 };
  mudarMeta({ status: 'jogando', andar: 1, semente: Number(params.get('semente')) || novaSemente(), run: Date.now() });
}
$('#bCriar').onclick = async () => {
  iniciarSom();
  const erro = $('#erroInicio'); erro.textContent = 'Conectando…';
  try {
    await rede.conectar();
    await usarApelido();
    const code = await rede.criarSala();
    erro.textContent = '';
    escolherHeroi(() => entrarNaSala(code));
  } catch (e) { console.error(e); erro.textContent = 'Não consegui conectar. Tente de novo.'; }
};
$('#bEntrar').onclick = async () => {
  iniciarSom();
  const code = $('#codigo').value.trim().toUpperCase();
  const erro = $('#erroInicio');
  if (!/^[A-Z]{4}$/.test(code)) { erro.textContent = 'O código tem 4 letras.'; return; }
  erro.textContent = 'Conectando…';
  try {
    await rede.conectar();
    await usarApelido();
    const m = await rede.lerMeta(code);
    if (!m) { erro.textContent = 'Sala não encontrada.'; return; }
    erro.textContent = '';
    escolherHeroi(() => entrarNaSala(code));
  } catch (e) { console.error(e); erro.textContent = 'Não consegui conectar. Tente de novo.'; }
};
async function usarApelido() {
  if (G.nome) return;
  const p = await rede.lerPerfil();
  if (p && p.tag) { G.nome = p.tag; $('#nome').value = p.tag; localStorage.setItem('cc_nome', p.tag); }
}
async function entrarNaSala(code) {
  G.modo = 'sala'; G.codigo = code; G.altarAndar = -1;
  $('#codigoSala').textContent = code;
  mostrar('telaSala');
  if (G.sairSala) G.sairSala();
  G.sairSala = await rede.entrarSala(code, publico(), st => {
    G.players = st.players;
    const antes = G.meta && G.meta.status;
    aoMeta(st.meta);
    if (G.meta && G.meta.status === 'altar') checarAltarHost();
    atualizarSala();
    if (!antes && st.meta && st.meta.status !== 'lobby' && st.meta.status !== 'jogando' && st.meta.status !== 'altar') mostrar('telaSala');
  });
}
const publico = () => ({ name: (G.nome || 'Herói').slice(0, 14), classe: G.classe, sexo: G.sexo });
function atualizarSala() {
  if (G.modo !== 'sala') return;
  const ul = $('#listaJogadores'); ul.innerHTML = '';
  for (const u of jogadoresOnline()) {
    const p = G.players[u];
    const li = document.createElement('li');
    li.innerHTML = `<canvas width="96" height="96" data-classe="${p.classe}" data-sexo="${p.sexo}"></canvas><div><b></b><small>${nomeClasse(p.classe || 'cavaleiro', p.sexo)}</small></div>${G.meta && G.meta.host === u ? '<span class="coroa">👑</span>' : ''}`;
    li.querySelector('b').textContent = p.name || 'Herói';
    ul.appendChild(li);
  }
  const host = souHost();
  $('#bComecar').hidden = !host; $('#esperando').hidden = host;
}
$('#bComecar').onclick = () => {
  rede.limparPartida(G.codigo).catch(() => {});
  mudarMeta({ status: 'jogando', andar: 1, semente: novaSemente(), run: Date.now() });
};
$('#bTrocarHeroi').onclick = () => escolherHeroi(() => { rede.atualizarEu(G.codigo, publico()); mostrar('telaSala'); atualizarSala(); });
$('#bSairSala').onclick = () => irMenu();
$('#bComo').onclick = () => mostrar('telaComo');
$('#bFecharComo').onclick = () => mostrar('telaInicio');

// ---------- escolha do herói ----------
function montarCartas() {
  const box = $('#cartas'); box.innerHTML = '';
  for (const k of ORDEM) {
    const el = document.createElement('button'); el.className = 'carta' + (k === G.classe ? ' ativa' : '');
    el.innerHTML = `<canvas width="240" height="240" data-k="${k}"></canvas><span>${nomeClasse(k, G.sexo)}</span>`;
    el.onclick = () => { G.classe = k; localStorage.setItem('cc_classe', k); montarCartas(); };
    box.appendChild(el);
  }
  const C = CLASSES[G.classe];
  $('#heroiNome').textContent = nomeClasse(G.classe, G.sexo);
  $('#heroiDesc').textContent = C.desc;
  const alcance = C.ataques[0].tiro ? 'Longe' : C.ataques[0].alc > 75 ? 'Médio' : 'Curto';
  $('#heroiStats').innerHTML = `<span>❤️ Vida ${C.vida}</span><span>👟 Velocidade ${C.vel}</span><span>🎯 Alcance ${alcance}</span><span>✨ ${C.hab} · ${C.habCd}s</span>`;
  $('#bHomem').classList.toggle('ativo', G.sexo === 'm'); $('#bMulher').classList.toggle('ativo', G.sexo === 'f');
}
$('#bHomem').onclick = () => { G.sexo = 'm'; localStorage.setItem('cc_sexo', 'm'); montarCartas(); };
$('#bMulher').onclick = () => { G.sexo = 'f'; localStorage.setItem('cc_sexo', 'f'); montarCartas(); };
$('#bConfirmarHeroi').onclick = () => { if (depoisDoHeroi) depoisDoHeroi(); };
$('#bVoltarHeroi').onclick = () => { if (G.modo === 'sala') mostrar('telaSala'); else irMenu(); };

const demo = { anim: 'parado', fase: 0, passo: 0, combo: 0, classe: 'cavaleiro', ataqueInfo: { fimRel: 0.6 } };
function desenharPreviews(t) {
  document.querySelectorAll('#cartas canvas').forEach(cvs => {
    const c = cvs.getContext('2d'), k = cvs.dataset.k;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvs.width, cvs.height);
    const ret = esp.retratoDe(k, G.sexo, true);
    if (ret) { c.drawImage(ret, 95, 20, 250, 250, 0, 0, cvs.width, cvs.height); return; }
    c.setTransform(2.3, 0, 0, 2.3, 120, 224);
    desenharHeroi(c, k, G.sexo, calcularPose({ anim: 'parado', classe: k }, t + ORDEM.indexOf(k)), t, {});
  });
  // destaque: alterna parado / correndo / atacando
  const cvs = $('#previewGrande'), c = cvs.getContext('2d');
  const ciclo = t % 4;
  demo.classe = G.classe;
  const C = CLASSES[G.classe];
  if (ciclo < 1.6) { demo.anim = 'parado'; }
  else if (ciclo < 2.6) { demo.anim = 'correr'; demo.passo = t * 9; }
  else {
    demo.anim = 'atacar';
    const n = C.ataques.length, dur = 1.4 / n, i = Math.min(n - 1, Math.floor((ciclo - 2.6) / dur));
    demo.combo = i; demo.fase = ((ciclo - 2.6) % dur) / dur; demo.ataqueInfo = { fimRel: C.ataques[i].fim / C.ataques[i].dur };
  }
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvs.width, cvs.height);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho(rgba(C.cor, 0.45), 96), 120, 120, 480, 480); c.restore();
  const ret = esp.retratoDe(G.classe, G.sexo, true);
  if (ret) {
    // retrato desenhado: flutua de leve, sem pixelar
    const ph = cvs.height * 0.98, pw = ph * ret.naturalWidth / ret.naturalHeight;
    c.drawImage(ret, (cvs.width - pw) / 2, cvs.height - ph + Math.sin(t * 1.6) * 6, pw, ph);
    return;
  }
  c.setTransform(5, 0, 0, 5, 330, 640);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 0, 20, 4, 0, 0, 7); c.fill();
  desenharHeroi(c, G.classe, G.sexo, calcularPose(demo, t), t, { furia: false });
}
function desenharMiniaturas(t) {
  document.querySelectorAll('#listaJogadores canvas').forEach(cvs => {
    const c = cvs.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 96, 96);
    const ret = esp.retratoDe(cvs.dataset.classe || 'cavaleiro', cvs.dataset.sexo, true);
    if (ret) { c.drawImage(ret, 95, 20, 250, 250, 0, 0, 96, 96); return; }
    c.setTransform(1, 0, 0, 1, 48, 92);
    desenharHeroi(c, cvs.dataset.classe || 'cavaleiro', cvs.dataset.sexo, calcularPose({ anim: 'parado' }, t), t, {});
  });
}

// ---------- início ----------
ligarControles(() => !!P && (G.tela === null || G.tela === 'jogo'));
addEventListener('pointerdown', () => iniciarSom(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && P && G.modo === 'solo') pausar(); });
redimensionar();
requestAnimationFrame(quadro);
if (params.has('auto')) { G.classe = params.get('classe') || G.classe; G.sexo = params.get('sexo') || G.sexo; comecarSolo(); }
if (params.has('debug')) window.__cc = { G, get P() { return P; }, ctrl, mudarMeta };
