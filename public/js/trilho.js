// Cripta de Cristal — MODO TRILHO (fliperama de mira, "on-rails", em primeira pessoa).
// A câmera anda sozinha pela fase e para nos encontros. O jogador só ataca e se defende com o dedo:
//   cavaleiro / lobisomem  → CORTE (arrasta o dedo por cima do inimigo) e APARA golpes de perto
//   monge                  → TOQUE rápido (soco) e APARA golpes de perto
//   mago / vampiro         → TIRO com toque (munição; arrasta pra baixo pra recarregar) e DERRUBA o que é arremessado
//   padre                  → não ataca: toca no painel pra CURAR, toca no refém caído pra REVIVER
// Multiplayer: o anfitrião simula tudo (monstros, arremessos, reféns, vida de todos) e manda uma "foto"
// ~10x por segundo; cada jogador manda só as ações (acertos, aparos, curas) pelo canal de golpes.
import { clamp, lerp, rng, hash } from './util.js';
import { BIOMAS, TEMAS, tiposDoTema } from './nivel.js';
import { criarFundo, desenharFundo, desenharAtmosfera, brilho, rgba, cristal, mistura } from './arte.js';
import { DEFS, TIPOS, desenharInimigo } from './inimigos.js';
import { CLASSES, nomeClasse, desenharHeroi, calcularPose } from './herois.js';
import { retratoDe, ESPECIAIS, config as espConfig } from './espetaculo.js';
import { som, musica } from './som.js';

// ---------- classes no trilho ----------
export const CT = {
  cavaleiro: { gesto: 'corte', defende: 'perto', vida: 130, dano: 20, cor: '#8fb8ff' },
  lobisomem: { gesto: 'corte', defende: 'perto', vida: 150, dano: 24, cor: '#ffa23a', garras: true },
  monge: { gesto: 'toque', defende: 'perto', vida: 125, dano: 9, cor: '#ffd24a' },
  // magia: sem munição; cadência e tempo de viagem equilibram
  mago: { gesto: 'tiro', defende: 'longe', vida: 100, dano: 20, cad: 0.2, vel: 1250, cor: '#c79bff' },
  vampiro: { gesto: 'tiro', defende: 'longe', vida: 105, dano: 28, cad: 0.32, vel: 1000, rouba: 0.15, cor: '#ff2a4a' },
  padre: { gesto: 'cura', defende: null, vida: 110, cor: '#ffe9a0', cargas: 4 },
};
export const DICA = {
  corte: 'Segure o dedo e passe pelos inimigos: cada corte seguido sem soltar aumenta o dano. Corte quem brilha vermelho pra APARAR.',
  toque: 'Toque nos inimigos pra socar (toques rápidos = combo). Toque em quem brilha vermelho pra APARAR. Toque no seu retrato pra DEFENDER.',
  tiro: 'Toque pra lançar magia. Derrube o que voa na sua direção. Toque no seu retrato pra DEFENDER.',
  mago: 'Toque pra lançar magia. DESENHE na tela: ⚡ zigue-zague = raio em cadeia · ◯ círculo = congela · 〰 linha tremida = lança de fogo.',
  cura: 'Toque no seu retrato ou no do amigo pra curar (e defender). Toque no refém caído pra reviver.',
};
const COR_JOG = ['#5ee0ff', '#ff6fb5', '#ffd84a', '#7dff8a'];
const ESTS = ['anda', 'prepara', 'golpe', 'recupera', 'atordoado', 'morto', 'espera'];
const PAPEIS = ['perto', 'longe', 'captor', 'atirador'];
const ATAQUES = ['rajada', 'investida', 'invocar', 'duplo', 'arremesso'];
const PROJ = ['orbe', 'osso', 'adaga', 'garrafa', 'fogo'];
const REF_E = ['preso', 'livre', 'morto', 'salvo'];
// cada fase: encontros, miniboss no meio e chefão no fim (os dois em DUELO)
const FASES = [
  { bioma: TEMAS[0], mini: 'cavaleiroSombrio', nomeMini: 'Cavaleiro de Sangue', nomeChefe: 'Conde Carmesim' },
  { bioma: TEMAS[1], mini: 'automato', nomeMini: 'Colosso a Vapor', nomeChefe: 'Rei das Sombras' },
  { bioma: TEMAS[2], mini: 'mumia', nomeMini: 'Sacerdote Mumificado', nomeChefe: 'Avatar de Anúbis' },
  { bioma: BIOMAS[3], mini: 'golem', nomeMini: 'Golem do Prisma', nomeChefe: 'Guardião do Prisma' },
];
const VOAM = ['morcego', 'gargula'];

let R = null, A = null;            // partida e "API" do jogo principal
export const ativo = () => !!R;
export const runAtual = () => R && R.run;

// ---------- início / fim ----------
// cfg: { run, semente, jogadores:[{uid,classe,sexo,nome}], eu, host, solo }
export function iniciar(api, cfg) {
  A = api;
  const jog = cfg.jogadores.map((j, i) => {
    const C = CT[j.classe] || CT.cavaleiro;
    return { ...j, i, hp: C.vida, mhp: C.vida, vivo: true, cor: COR_JOG[i % 4], pose: null, poseN: -1, alvoFx: null };
  });
  const euI = Math.max(0, jog.findIndex(j => j.uid === cfg.eu));
  const C = CT[jog[euI].classe] || CT.cavaleiro;
  R = {
    run: cfg.run, semente: cfg.semente, host: cfg.host, solo: cfg.solo, jog, euI, C,
    t: 0, fase: 0, seg: 0, segT: 0, estado: 'viagem', camX: 0, anda: true, vel: 0,
    ini: new Map(), proj: new Map(), ref: new Map(), novoId: 1,
    fila: [], ondas: [], ondaT: 0,
    ev: [], evN: 0, evVisto: 0, golpesVistos: new Set(),
    envT: 0, envEstT: 0, golpeN: 0, golpeFila: [],
    cadT: 0, magias: [], feitCd: { raio: 0, gelo: 0, fogo: 0 }, runa: null, guardaT: 0, guardaCd: 0, cargas: C.cargas || 0, cargaT: 0, esp: 0,
    cmb: { n: 0, t: 0 }, placar: 0, pontos: 0,
    fx: [], nums: [], rastro: [], toques: new Map(),
    cutin: null, lento: 0, tremor: 0, vermelho: 0, aviso: null, banner: null,
    locais: new Map(),      // previsão local de vida dos inimigos (cliente)
    sumidos: new Set(),     // arremessos que eu derrubei (some na hora, antes da foto do anfitrião)
    fundo: null, fundoKey: '', dicaT: jog[euI].classe === 'mago' ? 14 : 7,
    ultimaFoto: 0, fim: null, mortos: 0, salvos: 0, perdidos: 0,
  };
  R.bioma = FASES[0].bioma;
  R.camD = 0; R.lat = 0; R.props = gerarProps(0); R.fxExplodidos = new Set(); R.explodidos = new Set(); R.coberturas = new Set(); R.emboscadas = new Set();
  if (R.host) montarFase(0);
  ligarEntrada();
  musica(true);
  if (new URLSearchParams(location.search).has('debug')) window.__tr = { R: () => R, fase: f => { montarFase(f); ev('fase', f); }, alvos: () => alvosNaTela().map(a => ({ k: a.k, id: a.o.id, est: a.o.estado, papel: a.o.papel, x: a.ret ? a.ret.x + a.ret.w / 2 : a.x, y: a.ret ? a.ret.y + a.ret.h * 0.45 : a.y, ret: a.ret })) };
  mostrarBanner();
}
export function ressincronizar() { if (!R) return; R.envT = 0; R.envEstT = 0; R.ultimaFoto = R.t; }
export function parar() { R = null; musica(false); }
export function resumo() {
  if (!R) return null;
  return { fase: R.fase + 1, nomeFase: R.bioma.nome, placar: R.placar, mortos: R.mortos, salvos: R.salvos, perdidos: R.perdidos };
}
export function virarHost() {
  if (!R || R.host) return;
  R.host = true;
  // continua de onde a última foto parou
  R.seq = gerarSeq(R.fase); R.segT = 0;
  for (const en of R.ini.values()) { en.tE = 0; if (en.estado === 'golpe') en.estado = 'recupera'; en.cd = 1 + Math.random(); }
  R.ondas = []; R.fila = [];
  if (!R.ini.size && R.estado !== 'viagem') R.segT = 99;
  A.aviso('Você virou o anfitrião', 'o outro jogador saiu');
}

// ---------- fases (só o anfitrião) ----------
function gerarSeq(f) {
  const V = d => ({ tipo: 'viagem', dur: d });
  return [V(3.6), { tipo: 'encontro', ondas: 2 }, V(3), { tipo: 'encontro', ondas: 2, refem: true }, V(3.4), { tipo: 'duelo', mini: true },
    V(3), { tipo: 'encontro', ondas: 2, refem: f > 0 }, V(3.6), { tipo: 'duelo', chefe: true }];
}
function montarFase(f) {
  R.fase = f; R.bioma = FASES[f].bioma; R.seq = gerarSeq(f); R.seg = 0; R.segT = 0;
  R.camD = 0; R.props = gerarProps(f); R.fxExplodidos = new Set(); R.explodidos = new Set(); R.coberturas = new Set(); R.emboscadas = new Set();
  R.estado = 'viagem'; R.ini.clear(); R.proj.clear(); R.ref.clear(); R.ondas = []; R.fila = [];
  R.rnd = rng(R.semente * 31 + f * 977);
}
const nJog = () => R.jog.length;
const multVida = () => (1 + 0.45 * (nJog() - 1)) * (1 + R.fase * 0.22);
function vivosIdx() { return R.jog.filter(j => j.vivo).map(j => j.i); }
function alvoAleatorio() { const v = vivosIdx(); return v.length ? v[Math.floor(R.rnd() * v.length)] : 0; }

function criarInimigoT(tipo, papel, opt = {}) {
  const d = DEFS[tipo];
  const elite = !!opt.elite;
  // capangas morrem com 1-2 acertos (estilo Virtua Cop); elites e pesados aguentam mais
  const base = opt.duelo === 'chefe' ? 950 : opt.duelo === 'mini' ? 480 : elite ? d.vida * 2.2 : papel === 'atirador' ? 18 : d.pesado ? 45 : 26;
  const vida = Math.round(base * multVida());
  const id = R.novoId++;
  const en = {
    id, tipo, papel, elite, X: opt.X ?? (R.rnd() * 2.2 - 1.1), z: opt.z ?? (1.55 + R.rnd() * 0.35), hp: vida, mhp: vida,
    estado: 'anda', tE: 0, alvo: alvoAleatorio(), cd: 1 + R.rnd() * 1.5, flash: 0,
    zAlvo: papel === 'perto' ? (VOAM.includes(tipo) ? 0.46 : 0.36 + R.rnd() * 0.06) : 0.95 + R.rnd() * 0.35,
    Xalvo: 0, fase: R.rnd() * 6, refem: opt.refem || 0, ataque: 'rajada',
    vel: tipo === 'escaravelho' ? 0.5 : (d.pesado ? 0.13 : 0.2) * (VOAM.includes(tipo) ? 1.4 : 1),
    pesado: !!d.pesado || elite || !!opt.duelo,
    duelo: opt.duelo || null, post: 0, vulnT: 0, pontos: [], pontoT: 2.5, ciclo: 0,
    alt: opt.alt || 0, cobX: opt.cobX ?? null, sai: opt.sai ?? null, cob: opt.cob || 0,
  };
  if (papel === 'atirador') { en.estado = 'espera'; en.cd = 0.3 + R.rnd() * 1.2; en.zAlvo = en.z; en.exp = 0; }
  // onde ele para: sempre dentro da tela (perto da câmera a tela "estreita")
  const lim = Math.min(1.1, 1.25 * en.zAlvo);
  en.Xalvo = papel === 'captor' ? en.X : (R.rnd() * 2 - 1) * lim;
  R.ini.set(id, en);
  return en;
}
function proximaOnda(segm, k) {
  const tema = R.bioma.tema;
  const tipos = tiposDoTema(tema, R.fase + 1);
  const tot = tipos.reduce((a, b) => a + b[1], 0);
  const sortear = () => { let v = R.rnd() * tot; for (const [t, p] of tipos) if ((v -= p) < 0) return t; return tipos[0][0]; };
  const n = Math.round(4 + R.fase * 0.8 + k * 1.5 + (nJog() - 1) * 2);
  for (let i = 0; i < n; i++) {
    const tipo = sortear();
    let papel = 'perto';
    if (tipo === 'conjurador') papel = R.rnd() < 0.5 ? 'longe' : 'atirador';
    else if (!VOAM.includes(tipo) && !DEFS[tipo].pesado && tipo !== 'escaravelho' && R.rnd() < 0.6) papel = 'atirador';
    R.fila.push({ t: i * (0.35 + R.rnd() * 0.4), tipo, papel });
  }
  if (segm.refem && k === 0) {
    const nr = nJog() > 1 ? 2 : 1;
    for (let i = 0; i < nr; i++) R.fila.push({ t: 0.2 + i * 0.6, refem: true });
  }
  if (R.rnd() < 0.5) R.fila.push({ t: 1 + R.rnd() * 2, civil: true });
}
// cria um inimigo usando o cenário: atiradores ficam escondidos atrás de colunas, caixotes e
// cantos de parede (ou em janelas, em Londres e no castelo) e só saem pra mirar; os outros saem de trás e avançam
function nascer(tipo, papel, elite, zMin, zMax) {
  // só o que aparece na tela (perto da câmera a tela "estreita")
  const naTela = (X, z) => Math.abs(X) < 1.3 * z;
  const perto = (R.props || []).filter(p => p.tipo !== 'cerca' && p.tipo !== 'lapide' && !R.explodidos.has(p.i) && p.d - R.camD > zMin && p.d - R.camD < zMax && !R.coberturas.has(p.i) && naTela(propX(p), p.d - R.camD));
  if (papel === 'atirador') {
    const janela = (R.bioma.tema === 'londres' || R.bioma.tema === 'gotico') && R.rnd() < 0.3;
    let d0 = R.camD + zMin + R.rnd() * (zMax - zMin);
    const parede = l => Math.abs(cX(d0) + l * largC(d0) * 0.9) < 1.3 * (d0 - R.camD);
    if (janela && (parede(-1) || parede(1))) {
      const d = d0, lado = parede(-1) && (!parede(1) || R.rnd() < 0.5) ? -1 : 1;
      const Xp = cX(d) + lado * largC(d);
      return criarInimigoT(tipo, papel, { elite, X: Xp - lado * 0.12, z: d - R.camD, alt: R.bioma.tema === 'londres' ? 1.35 : 1.1, cobX: Xp - lado * 0.12, sai: Xp - lado * 0.12, cob: 3 });
    }
    if (perto.length && R.rnd() < 0.75) {
      const pr = perto[Math.floor(R.rnd() * perto.length)]; R.coberturas.add(pr.i);
      const X = propX(pr), dentro = -Math.sign(X || 1);
      const baixo = pr.tipo === 'caixote' || pr.tipo === 'barril' || pr.tipo === 'explosivo' || pr.tipo === 'braseiro' || pr.tipo === 'cristais';
      // atrás de caixote: abaixa e levanta; atrás de coluna: sai de lado
      return criarInimigoT(tipo, papel, { elite, X, z: pr.d - R.camD + 0.06, cobX: X, sai: baixo ? X : X + dentro * 0.3, cob: baixo ? 2 : 1 });
    }
    // canto de parede: aparece na porta/canto da parede lateral (se a parede estiver na tela)
    if (parede(-1) || parede(1)) {
      const lado = parede(-1) && (!parede(1) || R.rnd() < 0.5) ? -1 : 1, Xw = cX(d0) + lado * largC(d0);
      return criarInimigoT(tipo, papel, { elite, X: Xw - lado * 0.28, z: d0 - R.camD, cobX: Xw - lado * 0.28, sai: Xw - lado * 0.28, cob: 3 });
    }
    // sem cobertura à vista: aparece "do nada" no fundo (sobe de uma escada, sai de uma porta ao fundo)
    const z = Math.max(zMin + 0.3, zMax - 0.2), X = (R.rnd() * 2 - 1) * 1.1 * z;
    return criarInimigoT(tipo, papel, { elite, X: cX(R.camD + z) + X * 0.6, z, cobX: cX(R.camD + z) + X * 0.6, sai: cX(R.camD + z) + X * 0.6, cob: 3 });
  }
  if (perto.length && R.rnd() < 0.6) {
    const pr = perto[Math.floor(R.rnd() * perto.length)];
    return criarInimigoT(tipo, papel, { elite, X: propX(pr), z: pr.d - R.camD + 0.05 });
  }
  const lado = R.rnd() < 0.4;
  return criarInimigoT(tipo, papel, { elite, X: lado ? (R.rnd() < 0.5 ? -1.9 : 1.9) : undefined, z: lado ? 0.9 + R.rnd() * 0.5 : undefined });
}
function criarRefem() {
  const capt = R.bioma.tema === 'egito' ? 'mumia' : R.bioma.tema === 'londres' ? 'assassino' : 'esqueleto';
  const X = (R.rnd() < 0.5 ? -1 : 1) * (0.35 + R.rnd() * 0.45), z = 0.8 + R.rnd() * 0.25;
  const id = R.novoId++;
  const en = criarInimigoT(capt, 'captor', { X: X + 0.13 * Math.sign(X), z: z + 0.05 });
  en.zAlvo = en.z; en.Xalvo = en.X; en.refem = id; en.cd = 3 + R.rnd() * 2; en.prazo = 16;
  R.ref.set(id, { id, X, z, estado: 'preso', t: 0, captor: en.id, look: Math.floor(R.rnd() * 4) });
  ev('refem', id);
}
function criarCivil() {
  const id = R.novoId++, de = R.rnd() < 0.5 ? -1 : 1;
  R.ref.set(id, { id, X: -de * 1.8, z: 0.75 + R.rnd() * 0.4, estado: 'livre', t: 0, vx: de * (0.55 + R.rnd() * 0.25), civil: true, look: Math.floor(R.rnd() * 4) });
}

// ---------- eventos (anfitrião → todos) ----------
function ev(...e) { R.ev.push([++R.evN, ...e]); if (R.ev.length > 60) R.ev.splice(0, R.ev.length - 60); aplicarEvento([R.evN, ...e]); }
function aplicarEvento(e) {
  const [n, tipo, a, b, c] = e;
  if (n <= R.evVisto) return;
  R.evVisto = n;
  const eu = R.euI;
  if (tipo === 'dano') {
    const j = R.jog[a]; if (!j) return;
    j.pose = { tipo: 'dano', t: 0 }; j.tremor = 0.4;
    if (a === eu) { R.vermelho = 1; R.tremor = 10; som.dano(); }
    painelNumero(a, '-' + b, '#ff5a6a');
  } else if (tipo === 'aparo') {
    const en = R.ini.get(a);
    if (en) { const p = projetar(en.X, en.z); fxAparo(p.x, p.y - p.h * 0.6, p.s); }
    som.defendeu(); som.perfeito(); R.lento = Math.max(R.lento, 0.25);
    texto('APARADO!', '#ffe9a0');
  } else if (tipo === 'quebra') {
    const p = R.proj.get(a); if (p) { const q = posProj(p); estilhaco(q.x, q.y, q.s, corProj(p)); }
    R.proj.delete(a); som.quebra();
  } else if (tipo === 'refemMorto') {
    const r = R.ref.get(a); if (r) { r.estado = 'morto'; r.t = 0; }
    texto(b >= 0 ? 'REFÉM ATINGIDO!' : 'REFÉM PERDIDO…', '#ff5a6a'); som.morte();
    if (b === eu) { R.vermelho = 1; }
  } else if (tipo === 'refemSalvo') {
    texto(b ? 'REFÉM REVIVIDO!' : 'REFÉM SALVO!', '#9dffb0'); som.cura();
  } else if (tipo === 'cura') {
    const j = R.jog[a]; if (j) { j.pose = { tipo: 'cura', t: 0 }; painelNumero(a, '+' + b, '#9dffb0'); }
    som.cura();
  } else if (tipo === 'revive') {
    texto(`${R.jog[a]?.nome || 'Herói'} voltou!`, '#9dffb0'); som.cura();
  } else if (tipo === 'caiu') {
    texto(`${R.jog[a]?.nome || 'Herói'} caiu!`, '#ff5a6a');
  } else if (tipo === 'esp') {
    const j = R.jog[a]; if (j) iniciarCutin(j);
  } else if (tipo === 'fase') {
    R.fase = a; R.bioma = FASES[a].bioma; R.fundo = null; mostrarBanner(); som.portal();
  } else if (tipo === 'duelo') {
    const F = FASES[R.fase];
    R.duelo = { nome: b === 2 ? F.nomeChefe : F.nomeMini, chefe: b === 2, t: 0 };
    texto(b === 2 ? F.nomeChefe.toUpperCase() : F.nomeMini.toUpperCase(), b === 2 ? '#ff8fd6' : '#ffd27a', 2.6);
    if (b === 2) som.chefe(); else som.emboscada();
    R.dicaDuelo = 5;
  } else if (tipo === 'revela') {
    const en = R.ini.get(a);
    texto(b > 1 ? 'PONTOS FRACOS EXPOSTOS!' : 'PONTO FRACO EXPOSTO!', '#ffe9a0', 1.6); som.quebraArmadura?.(); som.perfeito();
    R.lento = Math.max(R.lento, 0.45); R.tremor = 12;
    R.fx.push({ tipo: 'flash', t: 0, dur: 0.25, cor: 'rgba(255,240,170,.9)' });
    if (en) { const r = retInimigo(en); R.fx.push({ tipo: 'racha', x: r.cx, y: r.cy, t: 0, dur: 0.6, r: Math.max(r.w, r.h) * 0.6, seed: Math.random() }); }
  } else if (tipo === 'fecha') {
    texto('Ele se recompôs!', '#c8c8d8', 0.9);
  } else if (tipo === 'explode') {
    const pr = R.props[a]; if (pr && !R.fxExplodidos.has(pr.i)) { R.fxExplodidos.add(pr.i); R.explodidos.add(pr.i); fxExplosao(pr); }
  } else if (tipo === 'disparo') {
    // o atirador dispara: clarão na arma e um risco até o retrato do alvo
    const en = R.ini.get(a), r = retPainel(b);
    if (en && r) { const q = retInimigo(en); const cor = R.bioma.tema === 'londres' ? '#ffe9a0' : en.tipo === 'conjurador' ? '#c79bff' : '#ff9a6a'; R.fx.push({ tipo: 'tiroInimigo', x0: q.cx + (en.X > 0 ? -1 : 1) * q.w * 0.3, y0: q.y + q.h * 0.35, x1: r.x + r.w / 2, y1: r.y + r.h * 0.4, t: 0, dur: 0.2, cor }); }
    som.disparoInimigo?.() || som.golpe(true);
  } else if (tipo === 'emboscada') {
    som.emboscada(); texto('EMBOSCADA!', '#ff8a6a', 1);
  } else if (tipo === 'feitico') {
    if (a === R.euI) return;      // quem lançou já viu
    const [k, ...xs] = c || [];
    if (b === 0) { const pts = (c || []).map(id => R.ini.get(id)).filter(Boolean).map(en => { const r = retInimigo(en); return { x: r.cx, y: r.cy }; }); fxRelampago(pts.length ? pts : [{ x: W / 2, y: H / 2 }]); som.trovao(); }
    else if (b === 1) { fxGelo(c[0] / 1000 * W, c[1] / 1000 * H, c[2]); for (const id of c.slice(3)) { const en = R.ini.get(id); if (en) en.gelo = en.duelo ? 1.6 : 4.5; } som.gelo(); }
    else if (b === 2) { const a0 = { x: c[0] / 1000 * W, y: c[1] / 1000 * H }, a1 = { x: c[2] / 1000 * W, y: c[3] / 1000 * H }; fxFogo(reamostrar([a0, a1], 12)); som.fogo(); }
  } else if (tipo === 'bloqueio') {
    const r = retPainel(a); if (r) { R.fx.push({ tipo: 'anel', x: r.x + r.w / 2, y: r.y + r.h / 2, t: 0, dur: 0.35, cor: '#cfe9ff', r: r.h * 0.6 }); faiscas(r.x + r.w / 2, r.y + r.h * 0.4, '#cfe9ff', 12, 300); }
    if (a === R.euI) { som.defendeu(); texto('DEFENDEU!', '#cfe9ff', 0.8); }
  } else if (tipo === 'derrotado') {
    texto(b === 2 ? 'CHEFÃO DERROTADO!' : 'MINIBOSS DERROTADO!', '#9dffb0', 2.4); som.bencao(); R.duelo = null; R.tremor = 16;
  } else if (tipo === 'refem') {
    texto('Cuidado com o refém!', '#ffe9a0', 1.6);
  } else if (tipo === 'morreu') {
    const en = R.ini.get(a); if (en) { en.estado = 'morto'; en.tE = 0; }
  }
}

// ---------- simulação (anfitrião) ----------
function simular(dt) {
  const S = R.seq[R.seg];
  R.segT += dt;
  if (!S) return;
  if (S.tipo === 'viagem') {
    R.estado = 'viagem';
    const alvo = PARADAS[R.seq.slice(0, R.seg + 1).filter(x => x.tipo === 'viagem').length - 1] ?? R.camD + 2;
    // emboscada no corredor: a câmera para quando aparecem inimigos (como no Virtua Cop)
    const emb = EMBOSCADAS.find(e => !R.emboscadas.has(e) && e < alvo - 0.6 && R.camD >= e - 0.01 && R.camD < e + 0.5);
    if (emb != null) {
      R.emboscadas.add(emb); R.embT = 0;
      const tipos = tiposDoTema(R.bioma.tema, R.fase + 1).filter(([t]) => !DEFS[t].pesado && !VOAM.includes(t));
      const n = 3 + Math.floor(R.rnd() * 2) + R.fase + (nJog() - 1) * 2;
      for (let i = 0; i < n; i++) R.fila.push({ t: i * 0.3, tipo: (tipos[Math.floor(R.rnd() * tipos.length)] || ['esqueleto'])[0], papel: R.rnd() < 0.8 ? 'atirador' : 'perto' });
      if (R.rnd() < 0.35) R.fila.push({ t: 0.8, civil: true });
      ev('emboscada');
    }
    const ameaca = [...R.ini.values()].some(e => e.estado !== 'morto' && e.z > 0.3) || R.fila.length > 0;
    if (R.embT != null) R.embT += dt;
    // parado enquanto houver inimigo na frente (até ~9s); depois segue em frente e eles vão ficando pra trás
    R.anda = !(ameaca && R.embT != null && R.embT < 9);
    if (!ameaca) R.embT = null;
    if (R.anda) {
      const antes = R.camD;
      R.camD = Math.min(alvo, R.camD + R.vel * dt * 1.0);
      if (alvo - R.camD < 0.7) R.vel = Math.max(0.2, Math.min(R.vel, (alvo - R.camD) / 0.7));
      const passo = R.camD - antes;   // o mundo chega mais perto enquanto a câmera anda
      for (const en of R.ini.values()) { en.z -= passo; en.zAlvo -= passo; }
      for (const r of R.ref.values()) r.z -= passo;
      for (const q of R.proj.values()) q.z0 -= passo;
      for (const [id, en] of R.ini) if (en.z < 0.22) R.ini.delete(id);
      for (const [id, r] of R.ref) if (r.z < 0.25) R.ref.delete(id);
    }
    soltarFila(dt, 0.7, 1.8);
    if (R.camD >= alvo - 0.002 && !ameaca) { R.camD = alvo; avancar(); return; }
  } else {
    R.anda = false;
    if (R.estado !== 'luta') {
      R.estado = 'luta'; R.ondas = []; R.fila = []; R.onda = 0;
      if (S.tipo === 'duelo') {
        const F = FASES[R.fase];
        const en = S.chefe ? criarInimigoT('chefe', 'longe', { X: 0, z: 1.3, duelo: 'chefe' }) : criarInimigoT(F.mini, 'perto', { X: 0, z: 1.5, duelo: 'mini' });
        en.zAlvo = S.chefe ? 1.1 : 0.62; en.Xalvo = 0; en.cd = 2.2;
        ev('duelo', en.id, S.chefe ? 2 : 1);
      } else proximaOnda(S, 0);
    }
    soltarFila(dt, 0.6, 1.7);
    const vivos = [...R.ini.values()].filter(e => e.estado !== 'morto').length;
    const presos = [...R.ref.values()].some(r => r.estado === 'preso');
    if (!vivos && !R.fila.length && !presos) {
      R.onda++;
      if (S.tipo !== 'duelo' && R.onda < S.ondas) proximaOnda(S, R.onda);
      else { R.fimLutaT = (R.fimLutaT || 0) + dt; if (R.fimLutaT > 1.2) { R.fimLutaT = 0; avancar(); return; } }
    }
  }
  for (const en of R.ini.values()) simularInimigo(en, dt);
  for (const [id, en] of R.ini) if (en.estado === 'morto' && en.tE > 0.6) R.ini.delete(id);
  for (const p of R.proj.values()) {
    p.tt += dt;
    if (p.tt >= p.dur) { R.proj.delete(p.id); ferirJog(p.alvo, p.dano, R.ini.get(p.de)); }
  }
  for (const r of R.ref.values()) {
    r.t += dt;
    if (r.civil) { r.X += r.vx * dt; if (Math.abs(r.X) > 2.4 && r.t > 1) R.ref.delete(r.id); }
    else if (r.estado === 'livre' || r.estado === 'salvo') { r.X += Math.sign(r.X || 1) * dt * 0.9; if (r.t > 2.5) R.ref.delete(r.id); }
    else if (r.estado === 'morto' && r.t > 9) R.ref.delete(r.id);
  }
}
function soltarFila(dt, zMin, zMax) {
  for (let i = R.fila.length - 1; i >= 0; i--) {
    const f = R.fila[i]; f.t -= dt;
    if (f.t > 0) continue;
    R.fila.splice(i, 1);
    if (f.refem) criarRefem();
    else if (f.civil) criarCivil();
    else nascer(f.tipo, f.papel, f.elite, zMin, zMax);
  }
}
function avancar() {
  R.seg++; R.segT = 0; R.estado = 'viagem'; R.ini.clear(); R.proj.clear(); R.coberturas.clear(); R.embT = null;
  for (const [id, r] of R.ref) if (r.estado !== 'preso') R.ref.delete(id);
  if (R.seg >= R.seq.length) {
    if (R.fase >= FASES.length - 1) { terminar(true); return; }
    // próxima fase: quem caiu volta
    for (const j of R.jog) { if (!j.vivo) { j.vivo = true; j.hp = Math.round(j.mhp * 0.4); ev('revive', j.i); } j.hp = Math.min(j.mhp, j.hp + Math.round(j.mhp * 0.3)); }
    montarFase(R.fase + 1);
    ev('fase', R.fase);
  }
}
function terminar(vitoria) {
  if (R.fim) return;
  R.fim = vitoria ? 'vitoria' : 'fim';
  A.mudarMeta({ status: R.fim });
}
function simularInimigo(en, dt) {
  en.tE += dt; en.flash = Math.max(0, en.flash - dt);
  if (en.estado === 'morto') return;
  const d = DEFS[en.tipo];
  if (!R.jog[en.alvo] || !R.jog[en.alvo].vivo) en.alvo = alvoAleatorio();
  if (en.queima > 0) {      // queimadura: dano a cada meio segundo
    en.queima -= dt; en.qT = (en.qT || 0) + dt;
    if (en.qT >= 0.5) { en.qT = 0; en.hp -= Math.round(5 * (1 + R.fase * 0.15) * (en.duelo ? 0.4 : 1)); en.flash = 0.06; if (en.hp <= 0) { matar(en, en.queimaDe || 0); return; } }
  }
  if (en.gelo > 0) { en.gelo -= dt; return; }     // congelado: não anda nem ataca
  if (en.duelo) { simularDuelo(en, dt); return; }
  // rede de segurança: ninguém fica preso fora da tela
  if (Math.abs(en.X) > 1.45 * Math.max(0.3, en.z) && !en.duelo && en.papel !== 'captor') { en.fora = (en.fora || 0) + dt; if (en.fora > 3) { en.X = Math.sign(en.X) * 1.0 * en.z; en.cobX = en.sai = en.X; en.cob = 3; en.fora = 0; } } else en.fora = 0;
  if (en.papel === 'atirador') { simularAtirador(en, dt); return; }
  if (en.estado === 'atordoado') { if (en.tE > 1.4) { en.estado = 'anda'; en.tE = 0; en.cd = 0.8; } return; }
  // anda até a posição
  en.fase += dt;
  const passo = en.vel * dt * (en.estado === 'anda' ? 1 : 0.15);
  if (en.papel === 'perto') {
    if (en.tipo === 'assassino' && en.z > 0.75 && en.tE > 1.6 && en.estado === 'anda') { en.z = 0.42; en.X = R.rnd() * 1 - 0.5; en.tE = 0; en.sumiu = 0.3; }
    en.z = Math.max(en.zAlvo, en.z - passo);
    en.X = lerp(en.X, en.Xalvo, dt * 0.8);
  } else if (en.papel === 'longe') {
    en.z = Math.max(en.zAlvo, en.z - passo);
    en.X = clamp(en.Xalvo + Math.sin(en.fase * 0.7) * 0.35, -1.3, 1.3);
  }
  const chegou = Math.abs(en.z - en.zAlvo) < 0.02;
  if (en.estado === 'anda' && (chegou || en.papel !== 'perto')) {
    en.cd -= dt;
    if (en.cd <= 0 && (chegou || en.z < 1.4)) { en.estado = 'prepara'; en.tE = 0; en.alvo = alvoAleatorio(); }
    if (en.papel === 'captor') { en.prazo -= dt; if (en.prazo <= 0) executarRefem(en); }
  } else if (en.estado === 'prepara') {
    const prep = en.papel === 'perto' ? (en.duelo ? 0.8 : en.pesado ? 1.15 : 0.85) : 0.6;
    if (en.tE >= prep) {
      en.estado = 'golpe'; en.tE = 0;
      if (en.papel === 'perto') ferirJog(en.alvo, Math.round((en.pesado ? 16 : 9) * (1 + R.fase * 0.12) * (en.elite ? 1.4 : 1)), en);
      else lancar(en);
    }
  } else if (en.estado === 'golpe') {
    if (en.tE >= 0.22) { en.estado = 'recupera'; en.tE = 0; }
  } else if (en.estado === 'recupera') {
    if (en.tE >= (en.papel === 'perto' ? (en.duelo ? 0.6 : 1.0) : 0.2)) {
      en.estado = 'anda'; en.tE = 0; en.cd = en.papel === 'perto' ? (en.duelo ? 0.3 : 0.4 + R.rnd() * 0.6) : 1.8 + R.rnd() * 1.6;
      if (en.duelo && ++en.ciclo % 3 === 0) { for (const j of vivosIdx()) { lancar(en, j); lancar(en, j, undefined, 0.35); } }
    }
  }
}
// tempo de mira encolhe com as fases (no Virtua Cop o anel fica "sempre laranja/vermelho" no fim)
const miraDur = () => Math.max(0.95, 1.9 - R.fase * 0.22 - (nJog() - 1) * 0.05);
function simularAtirador(en, dt) {
  const sair = en.sai ?? en.X;
  if (en.estado === 'espera') {                       // escondido (não dá pra acertar)
    en.X = lerp(en.X, en.cobX ?? en.X, dt * 10); en.exp = Math.max(0, (en.exp || 0) - dt * 6);
    en.cd -= dt;
    // só alguns miram ao mesmo tempo; os outros aparecem e se escondem de novo (finta)
    const mirando = [...R.ini.values()].filter(e => e.papel === 'atirador' && e.estado === 'prepara').length;
    if (en.cd <= 0) { en.estado = 'anda'; en.tE = 0; en.finta = mirando >= nJog() + 1 || R.rnd() < 0.2; }
  } else if (en.estado === 'anda') {                  // saindo da cobertura
    en.X = lerp(en.X, sair, dt * 9); en.exp = Math.min(1, (en.exp || 0) + dt * 5);
    if (en.tE > 0.28) {
      if (en.finta) { if (en.tE > 0.75) { en.estado = 'espera'; en.tE = 0; en.cd = 0.6 + R.rnd() * 1.2; } }
      else { en.estado = 'prepara'; en.tE = 0; en.alvo = alvoAleatorio(); en.mira = miraDur() * (0.9 + R.rnd() * 0.25); }
    }
  } else if (en.estado === 'prepara') {               // mirando: anel verde → amarelo → vermelho
    en.X = lerp(en.X, sair, dt * 9); en.exp = 1;
    if (en.tE >= (en.mira || 1.6)) {
      en.estado = 'golpe'; en.tE = 0;
      ev('disparo', en.id, en.alvo);
      ferirJog(en.alvo, Math.round(7 * (1 + R.fase * 0.12) * (en.elite ? 1.5 : 1)), en);
    }
  } else if (en.estado === 'golpe') {
    if (en.tE > 0.25) { en.estado = 'recupera'; en.tE = 0; }
  } else if (en.estado === 'recupera') {
    if (en.tE > 0.35) { en.estado = 'espera'; en.tE = 0; en.cd = 1 + R.rnd() * 1.6; }
  } else if (en.estado === 'atordoado') { if (en.tE > 1) { en.estado = 'espera'; en.tE = 0; en.cd = 0.8; } }
}
// ---------- DUELO (miniboss e chefão) ----------
// Loop: ele é agressivo e quase não sente golpe no corpo. Quando ele ataca, quem APARA (espadachins/monge no
// golpe de perto), DEFENDE (toque no próprio retrato) ou DERRUBA os arremessos (magos/vampiros) faz ele cambalear
// e EXPOR pontos fracos por alguns segundos. Acertar os pontos fracos é o que tira vida de verdade.
const ATQ_DUELO = { mini: [['investida', 5], ['duplo', 3], ['arremesso', 2]], chefe: [['investida', 4], ['duplo', 2], ['rajada', 3], ['invocar', 1]] };
const PREP = { investida: 0.95, duplo: 0.7, arremesso: 0.65, rajada: 0.8, invocar: 0.9 };
function simularDuelo(en, dt) {
  en.fase += dt;
  const chefe = en.duelo === 'chefe', zLonge = chefe ? 1.05 : 0.75;
  // aberto: cambaleia e mostra os pontos fracos
  if (en.vulnT > 0) {
    en.vulnT -= dt; en.estado = 'atordoado';
    en.z = lerp(en.z, zLonge + 0.15, dt * 2);
    for (const p of en.pontos) p.t += dt;
    if (en.vulnT <= 0) { en.vulnT = 0; en.pontos = []; en.estado = 'recupera'; en.tE = 0; ev('fecha', en.id); }
    return;
  }
  if (en.estado === 'anda') {
    // não fica parado: troca de lugar o tempo todo
    en.trocaT = (en.trocaT || 0) - dt;
    if (en.trocaT <= 0) { en.trocaT = 0.7 + R.rnd() * 0.6; en.Xalvo = (R.rnd() * 2 - 1) * (chefe ? 0.55 : 0.45); }
    en.X = lerp(en.X, en.Xalvo, dt * 3.5);
    en.z = lerp(en.z, zLonge, dt * 2.5);
    en.cd -= dt;
    if (en.cd <= 0) {
      const lista = ATQ_DUELO[en.duelo], tot = lista.reduce((a, b) => a + b[1], 0);
      let v = R.rnd() * tot; en.ataque = lista[0][0];
      for (const [k, p] of lista) if ((v -= p) < 0) { en.ataque = k; break; }
      if (en.ataque === 'invocar' && R.ini.size > 4) en.ataque = 'rajada';
      en.estado = 'prepara'; en.tE = 0; en.alvo = alvoAleatorio(); en.golpes = en.ataque === 'duplo' ? 2 : 1;
    }
  } else if (en.estado === 'prepara') {
    const perto = en.ataque === 'investida' || en.ataque === 'duplo';
    if (perto) { en.z = lerp(en.z, chefe ? 0.55 : 0.42, dt * 3); en.X = lerp(en.X, 0, dt * 2); }
    en.papel = perto ? 'perto' : 'longe';
    if (en.tE >= PREP[en.ataque]) {
      en.estado = 'golpe'; en.tE = 0;
      const dano = Math.round((chefe ? 16 : 12) * (1 + R.fase * 0.12));
      if (perto) { ferirJog(en.alvo, dano, en); R.tremor = 10; }
      else if (en.ataque === 'arremesso') { lancar(en, en.alvo); lancar(en, en.alvo, undefined, 0.3); }
      else if (en.ataque === 'rajada') { for (const j of vivosIdx()) for (let k = 0; k < 2; k++) lancar(en, j, 'fogo', k * 0.28); }
      else { for (let k = 0; k < nJog(); k++) criarInimigoT(R.rnd() < 0.5 ? 'esqueleto' : 'morcego', R.rnd() < 0.4 ? 'longe' : 'perto'); }
    }
  } else if (en.estado === 'golpe') {
    if (en.tE >= 0.22) {
      if (en.golpes > 1) { en.golpes--; en.estado = 'prepara'; en.tE = PREP.duplo - 0.42; en.alvo = alvoAleatorio(); }   // segundo golpe vem rápido
      else { en.estado = 'recupera'; en.tE = 0; }
    }
  } else if (en.estado === 'recupera') {
    en.z = lerp(en.z, zLonge, dt * 2.5);
    if (en.tE >= 0.45) { en.estado = 'anda'; en.tE = 0; en.papel = chefe ? 'longe' : 'perto'; en.cd = (chefe ? 0.9 : 0.7) + R.rnd() * 0.7; }
  } else if (en.estado === 'atordoado') { en.estado = 'anda'; en.tE = 0; }
}
// defesa bem-sucedida: ele cambaleia e expõe pontos fracos
function revelar(en, n) {
  if (!en || !en.duelo || en.vulnT > 0 || en.estado === 'morto') return;
  n = Math.min(4, n);
  const dur = 3.2 + 0.45 * (n - 1) + 0.3 * (nJog() - 1);
  en.vulnT = dur; en.estado = 'atordoado'; en.tE = 0; en.golpes = 0;
  en.pontos = [];
  const usados = [];
  for (let i = 0; i < n; i++) {
    let ox, oy, t = 0;
    do { ox = (R.rnd() * 2 - 1) * 0.3; oy = 0.15 + R.rnd() * 0.6; t++; } while (t < 10 && usados.some(([a, b]) => Math.hypot(a - ox, (b - oy) * 0.8) < 0.22));
    usados.push([ox, oy]);
    en.pontos.push({ id: R.novoId++, ox, oy, t: -i * 0.12, vida: dur });
  }
  ev('revela', en.id, n);
}
function lancar(en, alvo = en.alvo, tipo, atraso = 0) {
  const id = R.novoId++;
  if (!tipo) tipo = en.tipo === 'conjurador' ? 'orbe' : en.tipo === 'esqueleto' ? 'osso' : en.tipo === 'assassino' ? 'adaga' : en.tipo === 'automato' ? 'garrafa' : 'orbe';
  const dur = (tipo === 'fogo' ? 1.5 : 1.25) * (1 + (en.z - 1) * 0.3);
  R.proj.set(id, { id, de: en.id, X0: en.X, z0: en.z, h0: VOAM.includes(en.tipo) ? 0.9 : 0.62, tt: -atraso, dur, alvo, tipo, dano: Math.round((tipo === 'fogo' ? 12 : 8) * (1 + R.fase * 0.12)) });
}
function executarRefem(en) {
  const r = R.ref.get(en.refem);
  if (r && r.estado === 'preso') { R.perdidos++; ev('refemMorto', r.id, -1); }
  en.papel = 'perto'; en.zAlvo = 0.4; en.estado = 'anda'; en.tE = 0;
}
function ferirJog(i, dano, fonte) {
  const j = R.jog[i];
  if (!j || !j.vivo || R.fim) return;
  if (j.guardaT > 0) {   // defendeu tocando no retrato
    ev('bloqueio', i);
    if (fonte && fonte.duelo) revelar(fonte, 1);
    return;
  }
  j.hp = Math.max(0, j.hp - dano);
  ev('dano', i, dano);
  if (j.hp <= 0) {
    j.vivo = false; ev('caiu', i);
    if (!R.jog.some(x => x.vivo)) terminar(false);
  }
}
function curarJog(i, v) {
  const j = R.jog[i]; if (!j || R.fim) return;
  if (!j.vivo) { j.vivo = true; j.hp = Math.round(j.mhp * 0.5); ev('revive', i); return; }
  const antes = j.hp; j.hp = Math.min(j.mhp, j.hp + v);
  if (j.hp > antes) ev('cura', i, j.hp - antes);
}
function matar(en, quem) {
  en.estado = 'morto'; en.tE = 0; en.hp = 0; R.mortos++;
  R.placar += en.duelo === 'chefe' ? 5000 : en.duelo === 'mini' ? 1500 : en.elite ? 600 : 100;
  if (en.duelo) ev('derrotado', en.id, en.duelo === 'chefe' ? 2 : 1);
  ev('morreu', en.id);
  if (en.papel === 'captor') {
    const r = R.ref.get(en.refem);
    if (r && r.estado === 'preso') { r.estado = 'salvo'; r.t = 0; R.salvos++; R.placar += 500; ev('refemSalvo', r.id, 0); for (const j of R.jog) if (j.vivo) curarJog(j.i, 6); }
  }
}

// ações (de qualquer jogador; o anfitrião aplica)
// [1 acerto, id, dano] [2 aparo, id, dano] [3 derruba arremesso, id] [4 acerta refém, id] [5 cura, jogador, valor]
// [6 revive refém, id] [7 especial] [8 revive jogador, idx]
function aplicarAcao(quem, a) {
  const [tipo, id, v] = a;
  const C = CT[R.jog[quem]?.classe] || CT.cavaleiro;
  if (R.fim) return;
  if (tipo === 1 || tipo === 2) {
    const en = R.ini.get(id); if (!en || en.estado === 'morto') return;
    let dano = v;
    const aparavel = en.papel !== 'longe' || (en.tipo === 'chefe' && en.ataque === 'investida');
    if (tipo === 2 && C.defende === 'perto' && aparavel && en.vulnT <= 0 && (en.estado === 'prepara' || (en.estado === 'golpe' && en.tE < 0.15))) {
      ev('aparo', id);
      if (en.duelo) revelar(en, 1 + nJog());
      else { en.estado = 'atordoado'; en.tE = 0; en.z = Math.min(en.z + 0.1, 1.3); dano *= 2; }
    }
    if (en.duelo) dano = Math.max(1, Math.round(dano * 0.08));    // no corpo, quase nada
    else if (en.estado === 'atordoado') dano = Math.round(dano * 1.3);
    en.hp -= dano; en.flash = 0.12;
    if (en.papel === 'perto' && en.tipo !== 'chefe' && !en.pesado) en.z = Math.min(en.z + 0.012, 2);
    if (C.rouba) curarJog(quem, Math.max(1, Math.round(dano * C.rouba)));
    R.placar += 10;
    if (en.hp <= 0) matar(en, quem);
  } else if (tipo === 3) {
    if (C.defende !== 'longe' && !a[3]) return;
    const q = R.proj.get(id);
    if (q) {
      R.placar += 30; ev('quebra', id);
      // derrubou o arremesso do chefe: se era o último da leva, ele fica exposto
      const dono = R.ini.get(q.de);
      if (dono && dono.duelo && ![...R.proj.values()].some(o => o.de === dono.id)) revelar(dono, 1 + (nJog() > 1 ? 1 : 0));
    }
  } else if (tipo === 4) {
    const r = R.ref.get(id); if (!r || (r.estado !== 'preso' && r.estado !== 'livre')) return;
    const capt = r.captor && R.ini.get(r.captor);
    r.estado = 'morto'; r.t = 0; R.perdidos++; R.placar = Math.max(0, R.placar - 500);
    ev('refemMorto', id, quem);
    ferirJog(quem, 10);
    if (capt && capt.estado !== 'morto') { capt.papel = 'perto'; capt.zAlvo = 0.4; }
  } else if (tipo === 5) {
    curarJog(id, v);
  } else if (tipo === 6) {
    const r = R.ref.get(id); if (!r || r.estado !== 'morto') return;
    r.estado = 'salvo'; r.t = 0; R.perdidos = Math.max(0, R.perdidos - 1); R.salvos++; R.placar += 500; ev('refemSalvo', id, 1);
  } else if (tipo === 7) {
    especialHost(quem);
  } else if (tipo === 9) {
    const en = R.ini.get(id); if (!en || !en.duelo || en.estado === 'morto' || !(en.vulnT > 0)) return;
    if (!en.pontos.some(p => p.id === v)) return;
    const dano = clamp(a[3] || 20, 1, 200);
    en.hp -= dano; en.flash = 0.12; R.placar += 40;
    if (C.rouba) curarJog(quem, Math.max(1, Math.round(dano * C.rouba)));
    if (en.hp <= 0) matar(en, quem);
  } else if (tipo === 15) {
    const pr = R.props[id]; if (!pr || R.explodidos.has(pr.i)) return;
    R.explodidos.add(pr.i);
    const ex = propX(pr), ez = pr.d - R.camD;
    for (const en of [...R.ini.values()]) {
      if (en.estado === 'morto' || Math.hypot(en.X - ex, (en.z - ez) * 1.6) > 0.75) continue;
      const d = Math.round(80 * (1 + R.fase * 0.2) * (en.duelo ? 0.3 : 1));
      en.hp -= d; en.flash = 0.2; if (en.estado !== 'morto' && !en.duelo) { en.estado = 'atordoado'; en.tE = 0; }
      if (en.hp <= 0) matar(en, quem);
    }
    R.placar += 50;
    ev('explode', id);
  } else if (tipo === 12) {
    ev('feitico', quem, a[1], a.slice(2));
  } else if (tipo === 13) {
    const en = R.ini.get(id); if (!en || en.estado === 'morto') return;
    en.gelo = en.duelo ? 1.6 : 4.5;
    if (en.estado === 'prepara' || en.estado === 'golpe') { en.estado = en.duelo ? 'recupera' : 'anda'; en.tE = 0; en.golpes = 0; }
  } else if (tipo === 14) {
    const en = R.ini.get(id); if (!en || en.estado === 'morto') return;
    en.queima = 4; en.queimaDe = quem;
  } else if (tipo === 10) {
    const j = R.jog[quem]; if (j) j.guardaT = 0.75;
  } else if (tipo === 8) {
    const j = R.jog[id]; if (j && !j.vivo) curarJog(id, 0);
  }
}
function especialHost(quem) {
  const j = R.jog[quem]; if (!j) return;
  ev('esp', quem);
  R.lento = 1.1;
  const cl = j.classe;
  const todos = [...R.ini.values()].filter(e => e.estado !== 'morto');
  const bater = (en, d) => {
    if (en.duelo) { if (en.vulnT > 0) d *= 1.5; else { revelar(en, 2); d *= 0.5; } }
    en.hp -= d; en.flash = 0.2;
    if (en.estado !== 'morto' && !en.duelo) { en.estado = 'atordoado'; en.tE = 0; }
    if (en.hp <= 0) matar(en, quem);
  };
  if (cl === 'padre') {
    for (const x of R.jog) curarJog(x.i, 60);
    for (const r of R.ref.values()) if (r.estado === 'morto') { r.estado = 'salvo'; r.t = 0; R.salvos++; R.perdidos = Math.max(0, R.perdidos - 1); }
    for (const id of [...R.proj.keys()]) ev('quebra', id, 0);
  } else if (cl === 'monge') {
    todos.sort((a, b) => a.z - b.z).slice(0, 3).forEach(en => bater(en, Math.round(110 * (1 + R.fase * 0.2))));
  } else {
    const d = Math.round({ cavaleiro: 65, lobisomem: 70, mago: 55, vampiro: 50 }[cl] * (1 + R.fase * 0.2));
    todos.forEach(en => bater(en, d));
    if (cl === 'mago') for (const id of [...R.proj.keys()]) ev('quebra', id, 0);
    if (cl === 'vampiro') curarJog(quem, 30);
  }
}

// ---------- rede ----------
function foto() {
  const e = [], p = [], r = [];
  for (const en of R.ini.values()) e.push([en.id, TIPOS.indexOf(en.tipo), Math.round(en.X * 100), Math.round(en.z * 1000), Math.max(0, Math.round(en.hp)), en.mhp, ESTS.indexOf(en.estado), Math.round(en.tE * 100), en.alvo, en.elite ? 1 : 0, PAPEIS.indexOf(en.papel), en.refem || 0, ATAQUES.indexOf(en.ataque), en.duelo === 'chefe' ? 2 : en.duelo ? 1 : 0, Math.round(en.post || 0), Math.round((en.vulnT || 0) * 10), en.pontos && en.pontos.length ? en.pontos.map(q => [q.id, Math.round(q.ox * 100), Math.round(q.oy * 100), Math.round(q.t * 10), Math.round(q.vida * 10)]) : 0, Math.round(Math.max(0, en.gelo || 0) * 10), en.queima > 0 ? 1 : 0, Math.round((en.alt || 0) * 100), en.cob || 0]);
  for (const q of R.proj.values()) p.push([q.id, Math.round(q.X0 * 100), Math.round(q.h0 * 100), Math.round(q.z0 * 1000), Math.round(q.tt * 100), Math.round(q.dur * 100), q.alvo, PROJ.indexOf(q.tipo)]);
  for (const q of R.ref.values()) r.push([q.id, Math.round(q.X * 100), Math.round(q.z * 1000), REF_E.indexOf(q.estado), Math.round(q.t * 10), q.civil ? 1 : 0, q.look || 0, q.captor || 0]);
  const j = {};
  for (const x of R.jog) j[x.i] = [x.hp, x.mhp, x.vivo ? 1 : 0];
  return { tr: 1, ex: [...R.explodidos], run: R.run, f: R.fase, sg: R.seg, st: R.estado, an: R.anda ? 1 : 0, cd: Math.round(R.camD * 1000), sc: R.placar, mo: R.mortos, sv: R.salvos, pd: R.perdidos, e, p: p.length ? p : 0, r: r.length ? r : 0, j, ev: R.ev.slice(-30) };
}
function receberFoto(s) {
  if (!s || !s.tr || s.run !== R.run) return;
  R.ultimaFoto = R.t;
  if (s.f !== R.fase || !R.props) { R.fase = s.f; R.bioma = FASES[s.f].bioma; R.fundo = null; R.props = gerarProps(s.f); R.camD = s.cd / 1000; R.explodidos = new Set(); R.fxExplodidos = new Set(); }
  R.camDAlvo = (s.cd || 0) / 1000;
  R.seg = s.sg; R.estado = s.st; R.anda = !!s.an; R.placar = s.sc; R.mortos = s.mo; R.salvos = s.sv; R.perdidos = s.pd;
  const vistos = new Set();
  for (const a of s.e || []) {
    const [id, ti, X, z, hp, mhp, est, tE, alvo, elite, papel, refem, atq, du, post, vt, pts, gel, qm, alt, cob] = a;
    vistos.add(id);
    let en = R.ini.get(id);
    if (!en) { en = { id, tipo: TIPOS[ti], X: X / 100, z: z / 1000, flash: 0 }; R.ini.set(id, en); }
    en.tX = X / 100; en.tz = z / 1000; en.hp = Math.min(hp, R.locais.get(id) ?? hp); R.locais.delete(id);
    en.mhp = mhp; const ne = ESTS[est]; if (ne !== en.estado) { en.estado = ne; en.tE = tE / 100; }
    en.alvo = alvo; en.elite = !!elite; en.papel = PAPEIS[papel]; en.refem = refem; en.ataque = ATAQUES[atq] || 'rajada';
    en.pesado = !!DEFS[en.tipo]?.pesado || en.elite || !!du;
    en.duelo = du === 2 ? 'chefe' : du === 1 ? 'mini' : null; en.post = post || 0; en.vulnT = (vt || 0) / 10;
    en.gelo = (gel || 0) / 10; en.queima = qm ? 1 : 0; en.alt = (alt || 0) / 100; en.cob = cob || 0;
    en.pontos = (pts || []).map(q => ({ id: q[0], ox: q[1] / 100, oy: q[2] / 100, t: q[3] / 10, vida: q[4] / 10 }));
  }
  for (const [id, en] of R.ini) if (!vistos.has(id)) { if (en.estado !== 'morto') { en.estado = 'morto'; en.tE = 0; } }
  const pv = new Set();
  for (const a of s.p || []) {
    const [id, X0, h0, z0, tt, dur, alvo, ti] = a;
    pv.add(id);
    if (R.sumidos.has(id)) continue;
    let q = R.proj.get(id);
    if (!q) { q = { id }; R.proj.set(id, q); }
    Object.assign(q, { X0: X0 / 100, h0: h0 / 100, z0: z0 / 1000, dur: dur / 100, alvo, tipo: PROJ[ti] });
    if (q.tt == null || Math.abs(q.tt - tt / 100) > 0.15) q.tt = tt / 100;
  }
  for (const id of [...R.proj.keys()]) if (!pv.has(id)) R.proj.delete(id);
  for (const id of [...R.sumidos]) if (!pv.has(id)) R.sumidos.delete(id);
  const rv = new Set();
  for (const a of s.r || []) {
    const [id, X, z, est, t, civil, look, captor] = a;
    rv.add(id);
    let q = R.ref.get(id);
    if (!q) { q = { id, X: X / 100 }; R.ref.set(id, q); }
    Object.assign(q, { tX: X / 100, z: z / 1000, estado: REF_E[est], civil: !!civil, look, captor });
    if (q.t == null || Math.abs(q.t - t / 10) > 0.3) q.t = t / 10;
  }
  for (const id of [...R.ref.keys()]) if (!rv.has(id)) R.ref.delete(id);
  for (const [i, v] of Object.entries(s.j || {})) { const j = R.jog[i]; if (j) { j.hp = v[0]; j.mhp = v[1]; j.vivo = !!v[2]; } }
  for (const e of s.ev || []) aplicarEvento(e);
  for (const i of s.ex || []) R.explodidos.add(i);
}
export function aoRede(st, k) {
  if (!R) return;
  if (k === 'inimigos' && !R.host) receberFoto(st.inimigos);
  if (k === 'golpes' && R.host) {
    for (const [uid, lotes] of Object.entries(st.golpes || {})) {
      const i = R.jog.findIndex(j => j.uid === uid);
      if (i < 0 || i === R.euI) continue;
      for (const [n, lote] of Object.entries(lotes || {})) {
        const k2 = uid + ':' + n;
        if (R.golpesVistos.has(k2)) continue;
        R.golpesVistos.add(k2);
        if (Array.isArray(lote) && lote[0] === R.run) for (const a of lote.slice(1)) if (Array.isArray(a)) aplicarAcao(i, a);
      }
    }
  }
  if (k === 'estado') {
    for (const [uid, e] of Object.entries(st.estado || {})) {
      const j = R.jog.find(x => x.uid === uid);
      if (!j || j.i === R.euI || !e || e.run !== R.run) continue;
      j.cargas = e.cg; j.espV = e.esp; j.guarda = e.gd;
      if (e.pn !== j.poseN && e.pz) { j.poseN = e.pn; j.pose = { tipo: e.pz[0], ang: e.pz[1], x: e.pz[2] / 1000, y: e.pz[3] / 1000, t: 0 }; if (e.pz[0] !== 'dano') raioRemoto(j); }
    }
  }
}
function acao(a) {
  if (R.host) aplicarAcao(R.euI, a);
  else R.golpeFila.push(a);
}

// ---------- câmera / projeção ----------
let W = 0, H = 0, DPR = 1;
function horizonte() { return H * 0.55 + (R ? Math.sin(R.camD * 11) * 3.5 * R.vel : 0); }
// a câmera vira (yaw) pra acompanhar as curvas e inclina um pouquinho (roll)
function projetar(X, z, alt = 0) {
  if (R && R.yaw) { const co = Math.cos(R.yaw), si = Math.sin(R.yaw); const X2 = X * co - z * si; z = Math.max(0.06, X * si + z * co); X = X2; }
  const s = 1 / z, y0 = horizonte();
  let x = W / 2 + X * W * 0.3 * s, y = y0 + H * 0.16 * s - alt * H * 0.21 * s;
  if (R && R.roll) { const co = Math.cos(R.roll), si = Math.sin(R.roll), dx = x - W / 2, dy = y - y0; x = W / 2 + dx * co - dy * si; y = y0 + dx * si + dy * co; }
  return { x, y, s, h: H * 0.21 * s, esc: H * 0.21 * s / 70 };
}
function posProj(q) {
  const k = clamp(q.tt / q.dur, 0, 1);
  const z = lerp(q.z0, 0.13, k * k * 0.3 + k * 0.7);
  const lado = ladoPainel(q.alvo);
  const X = lerp(q.X0, lado * 0.33, k);
  const alt = lerp(q.h0, 0.75, k);
  const p = projetar(X, z, alt);
  return { x: p.x, y: p.y, s: p.s, k };
}
function ladoPainel(i) { const r = retPainel(i); return r ? ((r.x + r.w / 2) / W - 0.5) * 2 * 0.9 : 0; }

// ---------- entrada (toque / mouse) ----------
let ligado = false;
function ligarEntrada() {
  if (ligado) return;
  ligado = true;
  const cv = document.getElementById('tela');
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    if (!R || !A.emJogo()) return;
    e.preventDefault();
    const p = pos(e);
    R.toques.set(e.pointerId, { x0: p.x, y0: p.y, x: p.x, y: p.y, t0: R.t, path: [{ ...p, t: R.t }], ult: new Map(), acertos: 0, dist: 0 });
    // botão do especial
    const b = botaoEsp();
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.15) { R.toques.get(e.pointerId).botao = true; tentarEspecial(); return; }
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (!R) return;
    const tq = R.toques.get(e.pointerId); if (!tq || tq.botao) return;
    const p = pos(e);
    const ult = tq.path[tq.path.length - 1];
    tq.dist += Math.hypot(p.x - ult.x, p.y - ult.y);
    tq.path.push({ ...p, t: R.t }); if (tq.path.length > (R.jog[R.euI].classe === 'mago' ? 400 : 40)) tq.path.shift();
    tq.x = p.x; tq.y = p.y;
    if (R.C.gesto === 'corte' && tq.dist > 12) cortar(tq, ult, tq.path[tq.path.length - 1]);
  });
  const fim = e => {
    if (!R) return;
    const tq = R.toques.get(e.pointerId); R.toques.delete(e.pointerId);
    if (!tq || tq.botao) return;
    const dur = R.t - tq.t0;
    if (tq.acertos >= 3) texto(`CORRENTE x${tq.acertos}!`, '#bcd4ff', 0.8);
    if (R.jog[R.euI].classe === 'mago' && tq.dist > 70) { feitico(tq.path); return; }
    if (tq.dist < 22 && dur < 0.45) tocar(tq.x0, tq.y0);
  };
  cv.addEventListener('pointerup', fim);
  cv.addEventListener('pointercancel', fim);
  cv.addEventListener('contextmenu', e => { if (R) { e.preventDefault(); defender(); } });
  addEventListener('keydown', e => {
    if (!R || !A.emJogo()) return;
    if (e.code === 'Space' || e.code === 'KeyF') defender();
    if (e.code === 'KeyU' || e.code === 'KeyE') tentarEspecial();
  });
}
// o que está embaixo do dedo (do mais perto da câmera para o mais longe)
function alvosNaTela() {
  const l = [];
  for (const q of R.proj.values()) { if (q.tt < 0) continue; const p = posProj(q); l.push({ k: 'proj', o: q, x: p.x, y: p.y, r: Math.max(26, 30 * p.s), z: 0 }); }
  for (const r of R.ref.values()) {
    if (r.estado === 'salvo') continue;
    const p = projetar(r.X, r.z);
    const w = 26 * p.esc, h = (r.estado === 'morto' ? 30 : 66) * p.esc;
    l.push({ k: 'ref', o: r, ret: { x: p.x - w / 2, y: p.y - h, w, h }, z: r.z - 0.001 });
  }
  for (const pr of R.props || []) {
    if (pr.tipo !== 'explosivo' || R.explodidos.has(pr.i)) continue;
    const z = pr.d - R.camD; if (z < 0.3 || z > 3.2) continue;
    const p = projetar(propX(pr), z), w = 46 * p.esc, h = 64 * p.esc;
    l.push({ k: 'barril', o: { id: pr.i }, pr, ret: { x: p.x - w / 2, y: p.y - h, w, h }, z: z + 0.02 });
  }
  for (const en of R.ini.values()) {
    if (en.estado === 'morto') continue;
    if (en.papel === 'atirador' && en.estado === 'espera') continue;      // escondido: não dá pra acertar
    const ret = retInimigo(en);
    l.push({ k: 'ini', o: en, ret, z: en.z });
    for (const p of en.pontos || []) { if (p.t < 0) continue; const q = posPonto(en, p); l.push({ k: 'ponto', o: p, en, x: q.x, y: q.y, r: q.r, ret: { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }, z: en.z - 0.0005 }); }
  }
  return l.sort((a, b) => a.z - b.z);
}
function retInimigo(en) {
  const d = DEFS[en.tipo] || { w: 30, h: 70 };
  const p = projetar(en.X, en.z, (VOAM.includes(en.tipo) ? 0.55 : 0) + (en.alt || 0));
  const esc = p.esc * escInimigo(en);
  const w = Math.max(d.w, 34) * esc * 1.25, h = d.h * esc * 1.05 * (en.cob === 2 ? 0.75 : 1);
  const base = VOAM.includes(en.tipo) ? p.y + h * 0.5 : p.y;
  return { x: p.x - w / 2, y: base - h, w, h, cx: p.x, cy: base - h / 2, esc };
}
function escInimigo(en) { return (en.elite ? 1.2 : 1) * (en.tipo === 'chefe' ? 1.25 : en.duelo === 'mini' ? 1.7 : 1); }
function posPonto(en, p) { const r = retInimigo(en); return { x: r.x + r.w * (0.5 + p.ox), y: r.y + r.h * p.oy, r: Math.max(24, r.w * 0.13) }; }
const dentro = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
function tocar(x, y) {
  const C = R.C, eu = R.jog[R.euI];
  if (!eu.vivo) return;
  // painéis (padre cura tocando no painel)
  for (const j of R.jog) {
    const r = retPainel(j.i);
    if (r && dentro({ x, y }, r)) {
      if (C.gesto === 'cura') { curarTocar(j); if (j.i === R.euI) defender(true); }
      else if (j.i === R.euI) defender();
      return;
    }
  }
  const lista = alvosNaTela();
  if (C.gesto === 'cura') {
    for (const a of lista) if (a.k === 'ref' && a.o.estado === 'morto' && dentro({ x, y }, a.ret)) {
      if (R.cargas < 1) { semCarga(); return; }
      R.cargas--; acao([6, a.o.id]); minhaPose('cura', x, y); fxCura(x, y); return;
    }
    fxToque(x, y, '#ffe9a0', 0.5);
    return;
  }
  if (C.gesto === 'tiro') { lancarMagia(x, y, lista); return; }
  minhaPose('soco', x, y);
  let acertou = false;
  for (const a of lista) {
    if (a.k === 'proj') {
      if (Math.hypot(x - a.x, y - a.y) > a.r) continue;
      if (C.defende !== 'longe') continue;    // espadachins e monge não derrubam o que voa
      R.sumidos.add(a.o.id); const q = posProj(a.o); estilhaco(q.x, q.y, q.s, corProj(a.o));
      if (!R.host) R.proj.delete(a.o.id);
      acao([3, a.o.id]); ganhar(8); combo(); som.quebra(); acertou = true; break;
    }
    if (a.k === 'ponto') {
      if (Math.hypot(x - a.x, y - a.y) > a.r * 1.25) continue;
      quebrarPonto(a); acertou = true; break;
    }
    if (!dentro({ x, y }, a.ret)) continue;
    if (a.k === 'barril') { explodirBarril(a.pr); acertou = true; break; }
    if (a.k === 'ref') {
      if (a.o.estado !== 'preso' && a.o.estado !== 'livre') continue;
      acao([4, a.o.id]); fxToque(x, y, '#ff5a6a', 1); acertou = true; break;
    }
    if (a.k === 'ini') { acertarInimigo(a.o, x, y, C.gesto === 'toque'); acertou = true; break; }
  }
  if (!acertou) { fxToque(x, y, C.cor, 0.6); if (C.gesto === 'tiro') som.magia(); else som.golpe(false); }
}
// ---------- magia que viaja (mago / vampiro) ----------
// sai da faixa da tela do jogador (metade esquerda/direita, terço do meio…) e leva um tempo pra chegar
function faixaX(i) { const n = R.jog.length; return W * (i + 0.5) / n; }
function lancarMagia(x, y, lista) {
  if (R.cadT > 0) return;
  R.cadT = R.C.cad;
  // prioridade: o que vem voando > ponto fraco > refém/inimigo embaixo do dedo
  let alvo = null;
  for (const a of lista) {
    if (a.k === 'proj' || a.k === 'ponto') { if (Math.hypot(x - a.x, y - a.y) <= a.r * 1.3) { alvo = a; break; } continue; }
    if (dentro({ x, y }, a.ret)) { alvo = a; break; }
  }
  const x0 = faixaX(R.euI), y0 = H + 10;
  const dur = clamp(Math.hypot(x - x0, y - y0) / R.C.vel, 0.18, 0.6);
  R.magias.push({ x0, y0, x, y, t: 0, dur, alvo: alvo && { k: alvo.k, id: alvo.o.id, en: alvo.en && alvo.en.id }, dx: alvo ? x - (alvo.x ?? alvo.ret.x + alvo.ret.w / 2) : 0, dy: alvo ? y - (alvo.y ?? alvo.ret.y + alvo.ret.h / 2) : 0, sangue: R.jog[R.euI].classe === 'vampiro', meu: true });
  minhaPose('tiro', x, y);
  if (R.jog[R.euI].classe === 'mago') som.disparo(); else som.magia();
}
// onde o alvo está agora (a magia persegue o alvo)
function posAlvoMagia(m) {
  const a = m.alvo; if (!a) return null;
  if (a.k === 'proj') { const q = R.proj.get(a.id); if (!q || R.sumidos.has(a.id)) return null; const p = posProj(q); return { x: p.x, y: p.y }; }
  if (a.k === 'ini') { const en = R.ini.get(a.id); if (!en || en.estado === 'morto') return null; const r = retInimigo(en); return { x: r.cx + m.dx * 0.5, y: r.cy + m.dy * 0.5 }; }
  if (a.k === 'ponto') { const en = R.ini.get(a.en); const p = en && (en.pontos || []).find(q => q.id === a.id); if (!p) return null; return posPonto(en, p); }
  if (a.k === 'ref') { const r = R.ref.get(a.id); if (!r || (r.estado !== 'preso' && r.estado !== 'livre')) return null; const p = projetar(r.X, r.z); return { x: p.x, y: p.y - 40 * p.esc }; }
  if (a.k === 'barril') { const pr = R.props[a.id]; if (!pr || R.explodidos.has(pr.i)) return null; const p = projetar(propX(pr), pr.d - R.camD); return { x: p.x, y: p.y - 30 * p.esc }; }
  return null;
}
function atualizarMagias(dt) {
  for (const m of R.magias) {
    m.t += dt;
    const alvo = posAlvoMagia(m);
    if (alvo) { m.x = alvo.x; m.y = alvo.y; }
    if (m.t >= m.dur && !m.feito) { m.feito = true; if (m.meu) chegarMagia(m, !!alvo); else { faiscas(m.x, m.y, m.sangue ? '#ff2a4a' : '#e6d4ff', 6); } }
  }
  R.magias = R.magias.filter(m => m.t < m.dur + 0.05);
}
function chegarMagia(m, vivo) {
  const C = R.C, a = m.alvo;
  if (!a || !vivo) { fxToque(m.x, m.y, C.cor, 0.7); faiscas(m.x, m.y, m.sangue ? '#ff2a4a' : '#e6d4ff', 6); return; }
  if (a.k === 'proj') {
    const q = R.proj.get(a.id); R.sumidos.add(a.id);
    if (q) { const p = posProj(q); estilhaco(p.x, p.y, p.s, corProj(q)); }
    if (!R.host) R.proj.delete(a.id);
    acao([3, a.id]); ganhar(8); combo(); som.quebra(); return;
  }
  if (a.k === 'ponto') { const en = R.ini.get(a.en); if (en) quebrarPonto({ en, o: { id: a.id }, x: m.x, y: m.y }); return; }
  if (a.k === 'ref') { acao([4, a.id]); fxToque(m.x, m.y, '#ff5a6a', 1); return; }
  if (a.k === 'barril') { const pr = R.props[a.id]; if (pr) explodirBarril(pr); return; }
  if (a.k === 'ini') { const en = R.ini.get(a.id); if (en) { acertarInimigo(en, m.x, m.y, false); if (!m.sangue) som.impactoMagico(); } }
}
// ---------- feitiços desenhados (Mago / Maga) ----------
// zigue-zague → RAIO em cadeia · círculo → GELO (congela) · linha tremida → LANÇA DE FOGO (queima)
const FEIT = {
  raio: { nome: 'RAIO EM CADEIA', cd: 5, cor: '#9fe8ff' },
  gelo: { nome: 'PRISÃO DE GELO', cd: 6, cor: '#bff4ff' },
  fogo: { nome: 'LANÇA DE FOGO', cd: 4, cor: '#ffa040' },
};
function reamostrar(pts, n) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (tot <= 0) return pts.slice(0, 1);
  const passo = tot / (n - 1); let acc = 0; L.push({ x: pts[0].x, y: pts[0].y });
  let a = { x: pts[0].x, y: pts[0].y };
  for (let i = 1; i < pts.length; i++) {
    let b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= passo && d > 0) { const t = (passo - acc) / d; a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; L.push(a); d = Math.hypot(b.x - a.x, b.y - a.y); acc = 0; }
    acc += d; a = b;
  }
  while (L.length < n) L.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return L;
}
const compr = p => { let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return t; };
const giro = (a, b, c2) => { let d = Math.atan2(c2.y - b.y, c2.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function reconhecer(pts) {
  if (pts.length < 6) return null;
  const p = reamostrar(pts, 40), g = reamostrar(pts, 12);
  const L = compr(p), corda = Math.hypot(p[39].x - p[0].x, p[39].y - p[0].y);
  const xs = p.map(q => q.x), ys = p.map(q => q.y);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys), diag = Math.hypot(bw, bh);
  let soma = 0; for (let i = 1; i < 39; i++) soma += giro(p[i - 1], p[i], p[i + 1]);
  let cantos = 0, ultimo = -9;
  for (let i = 1; i < 11; i++) if (Math.abs(giro(g[i - 1], g[i], g[i + 1])) > 1.2 && i - ultimo > 1) { cantos++; ultimo = i; }
  const fechado = corda < diag * 0.35;
  if (fechado && Math.abs(soma) > 4.4 && Math.min(bw, bh) > Math.max(bw, bh) * 0.35) return 'gelo';
  if (!fechado && cantos >= 2) return 'raio';
  if (!fechado && corda > 110 && corda / L > 0.5) return 'fogo';
  if (fechado && Math.abs(soma) > 3.5) return 'gelo';
  return null;
}
function inimigosVivos() { return [...R.ini.values()].filter(e => e.estado !== 'morto'); }
function feitico(path) {
  const tipo = reconhecer(path);
  const pts = path.map(q => ({ x: q.x, y: q.y }));
  if (!tipo) { som.runaFalhou(); R.runa = { pts, t: 0, cor: '#8a8aa0', nome: '' }; return; }
  if (R.feitCd[tipo] > 0) { som.runaFalhou(); R.runa = { pts, t: 0, cor: '#8a8aa0', nome: '' }; texto(`${FEIT[tipo].nome}: espere ${Math.ceil(R.feitCd[tipo])}s`, '#c8c8d8', 0.9); return; }
  R.feitCd[tipo] = FEIT[tipo].cd;
  R.runa = { pts, t: 0, cor: FEIT[tipo].cor, nome: FEIT[tipo].nome };
  som.runa(); ganhar(6); R.lento = Math.max(R.lento, 0.12);
  const mf = 1 + R.fase * 0.15;
  const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
  minhaPose('tiro', cx, cy);
  if (tipo === 'raio') {
    // cai no inimigo mais perto do desenho e pula pros vizinhos
    const vivos = inimigosVivos().map(en => ({ en, r: retInimigo(en) }));
    if (!vivos.length) { fxRelampago([{ x: cx, y: cy }]); som.trovao(); return; }
    vivos.sort((a, b) => Math.hypot(a.r.cx - cx, a.r.cy - cy) - Math.hypot(b.r.cx - cx, b.r.cy - cy));
    const cadeia = [vivos.shift()];
    while (cadeia.length < 6 && vivos.length) {
      const u = cadeia[cadeia.length - 1].r;
      vivos.sort((a, b) => Math.hypot(a.r.cx - u.cx, a.r.cy - u.cy) - Math.hypot(b.r.cx - u.cx, b.r.cy - u.cy));
      if (Math.hypot(vivos[0].r.cx - u.cx, vivos[0].r.cy - u.cy) > 340) break;
      cadeia.push(vivos.shift());
    }
    const danos = [26, 22, 19, 16, 14, 12];
    cadeia.forEach((c2, k) => { const d = Math.round(danos[k] * mf); acao([1, c2.en.id, d]); c2.en.flash = 0.2; numero(c2.r.cx, c2.r.y, d, '#9fe8ff', k === 0); if (!R.host) { c2.en.hp = Math.max(0, c2.en.hp - (c2.en.duelo ? Math.round(d * 0.08) : d)); R.locais.set(c2.en.id, c2.en.hp); } });
    fxRelampago(cadeia.map(c2 => ({ x: c2.r.cx, y: c2.r.cy })));
    acao([12, 0, ...cadeia.map(c2 => c2.en.id)]);
    combo(); R.tremor = 12; som.trovao();
  } else if (tipo === 'gelo') {
    let raio = pts.reduce((a, q) => a + Math.hypot(q.x - cx, q.y - cy), 0) / pts.length;
    raio = Math.max(60, raio * 1.25);
    const ids = [];
    for (const en of inimigosVivos()) { const r = retInimigo(en); if (Math.hypot(r.cx - cx, r.cy - cy) < raio + Math.max(r.w, r.h) * 0.35) { ids.push(en.id); acao([13, en.id]); acao([1, en.id, Math.round(8 * mf)]); en.gelo = en.duelo ? 1.6 : 4.5; } }
    for (const q of R.proj.values()) { const pp = posProj(q); if (Math.hypot(pp.x - cx, pp.y - cy) < raio) { R.sumidos.add(q.id); estilhaco(pp.x, pp.y, pp.s, '#bff4ff'); acao([3, q.id, 1]); } }
    fxGelo(cx, cy, raio);
    acao([12, 1, Math.round(cx / W * 1000), Math.round(cy / H * 1000), Math.round(raio), ...ids]);
    som.gelo(); R.tremor = 6;
  } else {
    const lin = reamostrar(pts, 16);
    const ids = [];
    for (const en of inimigosVivos()) {
      const r = retInimigo(en);
      for (let i = 1; i < lin.length; i++) if (segRet(lin[i - 1], lin[i], r)) { ids.push(en.id); break; }
    }
    ids.forEach((id, k) => { const en = R.ini.get(id); const r = retInimigo(en); const d = Math.round(28 * mf); acao([1, id, d]); acao([14, id]); en.queima = 4; en.flash = 0.2; numero(r.cx, r.y, d, '#ffa040', true); });
    fxFogo(lin);
    const a0 = lin[0], a1 = lin[lin.length - 1];
    acao([12, 2, Math.round(a0.x / W * 1000), Math.round(a0.y / H * 1000), Math.round(a1.x / W * 1000), Math.round(a1.y / H * 1000), ...ids]);
    som.fogo(); R.tremor = 8; if (ids.length) combo();
  }
}
function fxRelampago(pts) {
  R.fx.push({ tipo: 'relampago', pts, t: 0, dur: 0.45 });
  R.fx.push({ tipo: 'flash', t: 0, dur: 0.18, cor: 'rgba(200,240,255,.9)' });
  for (const q of pts) { faiscas(q.x, q.y, '#dff8ff', 10, 420, 300); R.fx.push({ tipo: 'impacto', x: q.x, y: q.y, t: 0, dur: 0.18, r: 110 }); }
}
function fxGelo(x, y, r) {
  R.fx.push({ tipo: 'geada', x, y, r, t: 0, dur: 0.7, seed: Math.random() });
  for (let i = 0; i < 26; i++) { const a = Math.random() * 7, v = r * (1.5 + Math.random() * 2); R.fx.push({ tipo: 'floco', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 40, t: 0, dur: 0.6 + Math.random() * 0.4, tam: 3 + Math.random() * 4 }); }
}
function fxFogo(lin) {
  R.fx.push({ tipo: 'lanca', pts: lin, t: 0, dur: 0.75 });
  for (const q of lin) faiscas(q.x, q.y, Math.random() < 0.5 ? '#ffb040' : '#ff5a20', 2, 160, -260);
}
// defender tocando no próprio retrato (todo mundo pode)
function defender(semSom) {
  if (R.guardaCd > 0 || !R.jog[R.euI].vivo) return;
  R.guardaT = 0.7; R.guardaCd = 1.1;
  acao([10]);
  minhaPose('guarda', 0, 0);
  if (!semSom) som.defendeu();
}
function acertarInimigo(en, x, y, podeAparar, multi = 1) {
  const C = R.C;
  let dano = C.dano * multi;
  if (C.gesto === 'toque') { dano += Math.min(10, R.cmb.n * 0.5); }
  dano = Math.round(dano * (1 + R.fase * 0.15));
  const aparavel = en.papel !== 'longe' || (en.tipo === 'chefe' && en.ataque === 'investida');
  const aparo = podeAparar && C.defende === 'perto' && aparavel && !(en.vulnT > 0) && (en.estado === 'prepara' || (en.estado === 'golpe' && en.tE < 0.15));
  acao([aparo ? 2 : 1, en.id, dano]);
  // previsão local (antes da foto do anfitrião)
  let mostra = aparo && !en.duelo ? dano * 2 : dano, blindado = false;
  if (en.duelo) { mostra = Math.max(1, Math.round(dano * 0.08)); blindado = true; }
  if (!R.host) { en.hp = Math.max(0, en.hp - mostra); R.locais.set(en.id, en.hp); en.flash = 0.12; }
  else en.flash = 0.12;
  numero(x, y - 10, blindado ? mostra : mostra, aparo ? '#ffe9a0' : blindado ? '#9a9ab0' : en.vulnT > 0 ? '#ffd24a' : '#fff', aparo || en.vulnT > 0);
  if (blindado && !aparo && (R.blindT || 0) < R.t) { R.blindT = R.t + 3; texto(en.vulnT > 0 ? 'Acerte os PONTOS FRACOS dourados!' : 'Espere ele atacar: APARE ou DEFENDA!', '#c8c8d8', 1.3); }
  fxGolpe(x, y, C, en);
  ganhar(aparo ? 12 : 3); combo();
  if (aparo) { R.lento = Math.max(R.lento, 0.25); }
  som.acerto(aparo || C.gesto === 'tiro');
  R.tremor = Math.max(R.tremor, aparo ? 6 : 2.5);
}
// ponto fraco: só existe com o chefe aberto; cada acerto tira vida de verdade
function explodirBarril(pr) {
  if (R.explodidos.has(pr.i)) return;
  if (!R.host) { R.explodidos.add(pr.i); R.fxExplodidos.add(pr.i); fxExplosao(pr); }
  acao([15, pr.i]);
}
function fxExplosao(pr) {
  const z = pr.d - R.camD, p = projetar(propX(pr), Math.max(0.25, z));
  const r = 160 * p.esc * 1.4;
  R.fx.push({ tipo: 'explosao', x: p.x, y: p.y - 30 * p.esc, r, t: 0, dur: 0.6 });
  R.fx.push({ tipo: 'flash', t: 0, dur: 0.2, cor: 'rgba(255,190,90,.8)' });
  for (const cor of ['#ffd27a', '#ff7a20', '#ff3a20', '#5a4a40']) faiscas(p.x, p.y - 30 * p.esc, cor, 8, 520, 700);
  R.tremor = 16; som.explosao?.() || som.quebraArmadura?.(); som.fogo();
}
function quebrarPonto(a, mult = 1) {
  const dano = Math.round(R.C.dano * mult * 1.6 * (1 + R.fase * 0.15) + (R.C.gesto === 'toque' ? Math.min(10, R.cmb.n * 0.5) : 0));
  acao([9, a.en.id, a.o.id, dano]);
  if (!R.host) { a.en.hp = Math.max(0, a.en.hp - dano); R.locais.set(a.en.id, a.en.hp); }
  a.en.flash = 0.12;
  estilhaco(a.x, a.y, 1.2, '#ffe9a0'); R.fx.push({ tipo: 'impacto', x: a.x, y: a.y, t: 0, dur: 0.15, r: 90 });
  ganhar(4); combo(); som.acerto(true); R.tremor = Math.max(R.tremor, 4);
  numero(a.x, a.y - 20, dano, '#ffd24a', true);
  if (R.C.gesto === 'tiro') minhaPose('tiro', a.x, a.y);
}
// o corte fica ativo enquanto o dedo encosta; cada acerto seguido sem soltar aumenta o multiplicador (teto x3)
function multCorte(tq) { return Math.min(3, 1 + 0.2 * tq.acertos); }
function cortar(tq, a, b) {
  const v = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1 / 120, (b.t || R.t) - (a.t || R.t - 1 / 60));
  if (v < 220) return;
  if (!tq.somT || R.t - tq.somT > 0.22) { tq.somT = R.t; som.golpe(tq.acertos >= 4); minhaPose('corte', b.x, b.y, Math.atan2(b.y - a.y, b.x - a.x)); }
  for (const al of alvosNaTela()) {
    if (al.k === 'proj') continue;
    const chave = al.k + al.o.id;
    if (R.t - (tq.ult.get(chave) ?? -9) < 0.28) continue;      // o mesmo alvo pode ser cortado de novo depois de um instante
    if (!segRet(a, b, al.ret)) continue;
    tq.ult.set(chave, R.t);
    if (al.k === 'ref') { if (al.o.estado === 'preso' || al.o.estado === 'livre') acao([4, al.o.id]); continue; }
    if (al.k === 'barril') { explodirBarril(al.pr); continue; }
    const mult = multCorte(tq);
    tq.acertos++;
    if (al.k === 'ponto') { quebrarPonto(al, mult); continue; }
    const cx = clamp((a.x + b.x) / 2, al.ret.x, al.ret.x + al.ret.w), cy = clamp((a.y + b.y) / 2, al.ret.y, al.ret.y + al.ret.h);
    acertarInimigo(al.o, cx, cy, true, mult * (v > 1400 ? 1.15 : 1));
    if (tq.acertos >= 2) R.nums.push({ x: b.x + 24, y: b.y - 24, v: 'x' + mult.toFixed(1), cor: '#bcd4ff', t: 0, grande: tq.acertos >= 5 });
  }
}
// segmento cruza retângulo?
function segRet(a, b, r) {
  if (dentro(a, r) || dentro(b, r)) return true;
  const L = [[r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]];
  for (const [x1, y1, x2, y2] of L) if (cruza(a.x, a.y, b.x, b.y, x1, y1, x2, y2)) return true;
  return false;
}
function cruza(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (!d) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

function curarTocar(j) {
  if (R.cargas < 1) { semCarga(); return; }
  if (!j.vivo) { if (R.cargas < 2) { semCarga(); return; } R.cargas -= 2; acao([8, j.i]); }
  else { R.cargas--; acao([5, j.i, 28]); }
  const r = retPainel(j.i); minhaPose('cura', r.x + r.w / 2, r.y + r.h / 2); fxCura(r.x + r.w / 2, r.y + r.h * 0.4);
}
function semCarga() { som.defendeu(); texto('Sem fé! Espere recarregar', '#ffe9a0', 1); }
function ganhar(v) { R.esp = Math.min(100, R.esp + v); }
function combo() { R.cmb.n++; R.cmb.t = 1.4; R.cmb.pulso = 1; if (R.cmb.n % 10 === 0) som.marcoCombo(R.cmb.n); }
function tentarEspecial() {
  if (R.esp < 100 || R.cutin || !R.jog[R.euI].vivo) return;
  R.esp = 0; acao([7]);
}
function minhaPose(tipo, x, y, ang) {
  const j = R.jog[R.euI];
  j.pose = { tipo, x: x / W, y: y / H, ang: ang || 0, t: 0 };
  j.poseN = (j.poseN || 0) + 1;
  if (tipo === 'soco') raioDoPainel(j, x, y);
}

// ---------- passo ----------
export function passo(dt) {
  if (!R) return;
  const dtReal = dt;
  if (R.cutin) { R.cutin.t += dtReal; if (R.cutin.t > 1.0) { fxEspecial(R.cutin.j); R.cutin = null; } dt *= 0.05; }
  if (R.lento > 0) { R.lento -= dtReal; dt *= 0.3; }
  R.t += dt;
  R.tremor = Math.max(0, R.tremor - dtReal * 30);
  R.vermelho = Math.max(0, R.vermelho - dtReal * 1.6);
  if (R.cmb.t > 0) { R.cmb.t -= dt; if (R.cmb.t <= 0) R.cmb.n = 0; }
  R.cmb.pulso = Math.max(0, (R.cmb.pulso || 0) - dtReal * 4);
  R.dicaT -= dtReal;
  for (const k in R.feitCd) R.feitCd[k] = Math.max(0, R.feitCd[k] - dtReal);
  if (R.runa) { R.runa.t += dtReal; if (R.runa.t > 0.7) R.runa = null; }
  R.cadT = Math.max(0, R.cadT - dt); R.guardaT = Math.max(0, R.guardaT - dt); R.guardaCd = Math.max(0, R.guardaCd - dt);
  atualizarMagias(dtReal);
  if (R.C.cargas) { R.cargaT += dt; if (R.cargaT > 3 && R.cargas < R.C.cargas) { R.cargaT = 0; R.cargas++; } }
  if (R.anda) { R.vel = lerp(R.vel, 1, dt * 2); } else R.vel = lerp(R.vel, 0, dt * 4);
  R.camX += R.vel * dt * 60;
  if (!R.host) { R.camD += R.vel * dt * 1.0; if (R.camDAlvo != null) R.camD = lerp(R.camD, R.camDAlvo, dt * 4); }
  if (R.dicaDuelo > 0) R.dicaDuelo -= dtReal;
  // virar a câmera na direção do corredor à frente
  let foco = 0, peso = 0;
  for (const en of R.ini.values()) if (en.papel === 'atirador' && en.estado === 'prepara') { const k = clamp(en.tE / (en.mira || 1.6), 0, 1); foco += Math.atan2(en.X, Math.max(0.3, en.z)) * k; peso += k; }
  let yawAlvo = Math.atan2(curva(R.camD + 1.3) - curva(R.camD), 1.3) * 0.9 + (peso ? clamp(foco / Math.max(1, peso) * 0.18, -0.1, 0.1) : 0);
  // parado numa emboscada: a câmera vira pra onde estão os inimigos
  if (R.estado === 'viagem' && !R.anda) {
    const vivos = [...R.ini.values()].filter(e => e.estado !== 'morto' && e.z > 0.3);
    if (vivos.length) yawAlvo = clamp(vivos.reduce((a, e) => a + Math.atan2(e.X, e.z), 0) / vivos.length, -0.7, 0.7);
  }
  R.yaw = lerp(R.yaw || 0, yawAlvo, Math.min(1, dtReal * 3));
  R.roll = (yawAlvo - R.yaw) * 0.6 + R.yaw * 0.08;
  if (R.host) simular(dt);
  else {
    for (const en of R.ini.values()) {
      en.tE = (en.tE || 0) + dt; en.flash = Math.max(0, (en.flash || 0) - dt); if (en.gelo > 0) en.gelo -= dt;
      if (en.tX != null) { en.X = lerp(en.X, en.tX, dt * 8); en.z = lerp(en.z, en.tz, dt * 8); }
    }
    for (const [id, en] of R.ini) if (en.estado === 'morto' && en.tE > 0.6) R.ini.delete(id);
    for (const q of R.proj.values()) q.tt += dt;
    for (const r of R.ref.values()) { r.t += dt; if (r.tX != null) r.X = lerp(r.X, r.tX, dt * 6); }
  }
  for (const j of R.jog) { if (j.pose) j.pose.t += dtReal; j.tremor = Math.max(0, (j.tremor || 0) - dtReal); }
  atualizarFx(dtReal);
  // rede
  if (!R.solo) {
    R.envEstT -= dtReal;
    if (R.envEstT <= 0) {
      R.envEstT = 0.08;
      const eu = R.jog[R.euI], p = eu.pose;
      A.enviarEstado({ run: R.run, cg: R.cargas, gd: R.guardaT > 0 ? 1 : 0, esp: Math.round(R.esp), pn: eu.poseN, pz: p ? [p.tipo, Math.round((p.ang || 0) * 100) / 100, Math.round(p.x * 1000), Math.round(p.y * 1000)] : 0 });
      if (R.golpeFila.length) { R.golpeN++; A.enviarGolpe(R.golpeN, [R.run, ...R.golpeFila]); if (R.golpeN > 40) A.apagarGolpe(R.golpeN - 40); R.golpeFila = []; }
    }
    if (R.host) { R.envT -= dtReal; if (R.envT <= 0) { R.envT = 0.1; A.enviarInimigos(foto()); } }
  }
}

// ---------- efeitos ----------
function atualizarFx(dt) {
  for (const f of R.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; } }
  R.fx = R.fx.filter(f => f.t < f.dur);
  for (const n of R.nums) n.t += dt;
  R.nums = R.nums.filter(n => n.t < 0.9);
  if (R.aviso) { R.aviso.t += dt; if (R.aviso.t > R.aviso.dur) R.aviso = null; }
  if (R.banner) { R.banner.t += dt; if (R.banner.t > 3) R.banner = null; }
}
function numero(x, y, v, cor, grande) { R.nums.push({ x: x + (Math.random() - 0.5) * 14, y, v, cor, t: 0, grande }); }
function painelNumero(i, v, cor) { const r = retPainel(i); if (r) R.nums.push({ x: r.x + r.w / 2, y: r.y + 10, v, cor, t: 0, grande: true }); }
function texto(txt, cor, dur = 1.3) { R.aviso = { txt, cor, t: 0, dur }; }
function mostrarBanner() { R.banner = { t: 0, fase: R.fase + 1, nome: R.bioma.nome }; }
function faiscas(x, y, cor, n, vel = 260, g = 500) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = vel * (0.4 + Math.random()); R.fx.push({ tipo: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g, t: 0, dur: 0.35 + Math.random() * 0.25, cor, tam: 2 + Math.random() * 3 }); }
}
function fxToque(x, y, cor, f = 1) { R.fx.push({ tipo: 'anel', x, y, t: 0, dur: 0.3, cor, r: 28 * f }); }
function fxGolpe(x, y, C, en) {
  if (C.gesto === 'tiro') {
    if (R.jog[R.euI].classe === 'vampiro') { R.fx.push({ tipo: 'talho', x, y, t: 0, dur: 0.3, ang: Math.random() * 3, r: 40 }); faiscas(x, y, '#ff2a4a', 10, 320, 900); }
    else {
      R.fx.push({ tipo: 'prisma', x, y, t: 0, dur: 0.38, r: 54, a0: Math.random() * 6 });
      for (const cor of ['#ff9ad5', '#9ad5ff', '#c79bff', '#fff2a0']) faiscas(x, y, cor, 3, 360, 300);
    }
  } else if (C.gesto === 'toque') {
    R.fx.push({ tipo: 'soco', x, y, t: 0, dur: 0.22, cor: C.cor, r: 44 }); faiscas(x, y, '#ffe9a0', 6);
  } else {
    faiscas(x, y, C.garras ? '#ffb46a' : '#dfe9ff', 8, 340);
  }
  R.fx.push({ tipo: 'impacto', x, y, t: 0, dur: 0.12, r: 70 });
}
function fxAparo(x, y, s) {
  R.fx.push({ tipo: 'aparo', x, y, t: 0, dur: 0.45, r: 60 * Math.min(2, s) });
  faiscas(x, y, '#fff2b0', 18, 420);
}
function fxCura(x, y) { R.fx.push({ tipo: 'cruz', x, y, t: 0, dur: 0.6 }); faiscas(x, y, '#fff2b0', 10, 160, -200); }
function estilhaco(x, y, s, cor) { R.fx.push({ tipo: 'anel', x, y, t: 0, dur: 0.3, cor, r: 40 * s * 0.6 }); faiscas(x, y, cor, 14, 360); }
function raioDoPainel(j, x, y) {
  const r = retPainel(j.i); if (!r) return;
  const C = CT[j.classe];
  const mx = r.x + r.w * (j.i === R.euI ? 0.78 : 0.22), my = r.y + r.h * 0.35;
  R.fx.push({ tipo: 'raio', x0: mx, y0: my, x, y, t: 0, dur: C.gesto === 'tiro' ? 0.16 : 0.1, cor: C.cor, sangue: j.classe === 'vampiro', soco: C.gesto === 'toque' });
}
function raioRemoto(j) {
  const p = j.pose; if (!p) return;
  const x = p.x * W, y = p.y * H;
  const C = CT[j.classe];
  if (p.tipo === 'tiro') { const x0 = faixaX(j.i); R.magias.push({ x0, y0: H + 10, x, y, t: 0, dur: clamp(Math.hypot(x - x0, y - H) / C.vel, 0.18, 0.6), sangue: j.classe === 'vampiro', meu: false }); }
  if (p.tipo === 'soco') raioDoPainel(j, x, y);
  if (p.tipo === 'corte') R.fx.push({ tipo: 'corteRemoto', x, y, ang: p.ang, t: 0, dur: 0.25, cor: C.cor });
  if (p.tipo === 'cura') fxCura(x, y);
}
function corProj(q) { return q.tipo === 'fogo' ? '#ff7ad9' : q.tipo === 'orbe' ? '#c79bff' : q.tipo === 'osso' ? '#f0e8d0' : q.tipo === 'adaga' ? '#cfd8e8' : '#9fe0a0'; }
function iniciarCutin(j) {
  R.cutin = { j, t: 0 };
  som.especial(); som.especialSolto?.(j.classe);
}
function fxEspecial(j) {
  const cl = j.classe;
  R.tremor = 16;
  R.fx.push({ tipo: 'flash', t: 0, dur: 0.35, cor: (ESPECIAIS[cl] || ESPECIAIS.cavaleiro).cor });
  R.fx.push({ tipo: 'esp_' + cl, t: 0, dur: 0.9, seed: Math.random() * 100 });
}

// ---------- desenho ----------
export function desenhar(ctx, cw, ch, dpr) {
  if (!R) return;
  DPR = dpr; W = cw / dpr; H = ch / dpr;
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  // cenário
  const key = R.fase + ':' + cw + 'x' + ch;
  if (!R.fundo || R.fundoKey !== key) { R.fundo = criarFundo(R.bioma, cw, ch * 0.62, R.semente + R.fase * 17); R.fundoKey = key; }
  const tr = R.tremor ? [(Math.random() - 0.5) * R.tremor * dpr, (Math.random() - 0.5) * R.tremor * dpr] : [0, 0];
  c.translate(tr[0], tr[1]);
  c.fillStyle = R.bioma.ceu[0]; c.fillRect(-20, -20, cw + 40, ch + 40);
  if (R.bioma.tema === 'londres') desenharFundo(c, R.fundo, (R.camX + (R.yaw || 0) * 900) * dpr, 0, cw, ch * 0.62, R.t);
  c.setTransform(dpr, 0, 0, dpr, tr[0], tr[1]);
  // mundo: tudo que está dentro do corredor é desenhado junto com o trecho de parede da mesma profundidade,
  // assim uma parede mais perto TAMPA o que está atrás dela (não dá pra ver o que vem depois da curva)
  const coisas = [];
  for (const en of R.ini.values()) coisas.push({ z: en.z + (en.papel === 'captor' ? 0.001 : 0), f: () => desenharInimigoT(c, en) });
  for (const r of R.ref.values()) coisas.push({ z: r.z, f: () => desenharRefem(c, r) });
  for (const pr of R.props || []) { const z = pr.d - R.camD; if (z > 0.15 && z < 6) coisas.push({ z, f: () => desenharProp(c, pr, z) }); }
  coisas.sort((a, b) => b.z - a.z);
  desenharCorredor(c, coisas);
  for (const q of R.proj.values()) if (q.tt >= 0 && !R.sumidos.has(q.id)) desenharProj(c, q);
  desenharMagias(c);
  // névoa / luz do tema
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (R.bioma.tema === 'londres') { c.globalAlpha = 0.5; desenharAtmosfera(c, R.fundo, R.camX * dpr, 0, cw, ch, R.t); c.globalAlpha = 1; }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  desenharFx(c);
  desenharRastros(c);
  desenharPaineis(c);
  desenharHud(c);
  if (R.cutin) desenharCutin(c);
  // vermelho de dano
  if (R.vermelho > 0) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.45 * R.vermelho})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}
// ---------- corredores e salões (estilo Doom / Duke: paredes, teto e chão em perspectiva) ----------
// A câmera anda por um corredor que faz curvas; em cada parada ele se abre num salão onde acontece o encontro.
const PASSO = 0.3;
const PARADAS = [2.4, 7.9, 13.4, 18.9, 24.4];         // onde a câmera para (uma por trecho de viagem)
const SALA_INI = 0.3, SALA_FIM = 2.8;
const EMBOSCADAS = [1.1, 5.2, 6.7, 10.7, 12.2, 16.2, 17.7, 21.7, 23.2];   // paradas curtas no meio dos corredores
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function salaEm(d) {
  let m = 0;
  for (const P of PARADAS) m = Math.max(m, suave(P + SALA_INI - 0.3, P + SALA_INI, d) * (1 - suave(P + SALA_FIM, P + SALA_FIM + 0.3, d)));
  return m;
}
function retaEm(d) {   // perto das paradas o corredor fica reto (a sala fica bem na frente da câmera)
  let m = 0;
  for (const P of PARADAS) m = Math.max(m, suave(P - 0.9, P - 0.4, d) * (1 - suave(P + SALA_FIM + 0.1, P + SALA_FIM + 0.6, d)));
  return m;
}
function paradaDe(d) { return PARADAS.find(P => d >= P - 1 && d <= P + SALA_FIM + 0.7) ?? PARADAS[0]; }
function curvaBase(d) { const f = (R.semente % 97) * 0.13 + R.fase; return 0.95 * Math.sin(d * 0.55 + f) + 0.45 * Math.sin(d * 0.23 + f * 2.1); }
function curva(d) {
  const k = retaEm(d);
  if (k <= 0) return curvaBase(d);
  return lerp(curvaBase(d), curvaBase(paradaDe(d) - 0.4), k);
}
function cX(d) { return curva(d) - curva(R.camD); }
function largC(d) { return 1.2 + 1.35 * salaEm(d); }
function altoC(d) { return (R.bioma.tema === 'londres' ? 4.4 : 2.6) + 1.4 * salaEm(d); }
const TEMA_COR = {
  gotico: { parede: '#3a2a30', parede2: '#2e2026', chao: ['#2a2024', '#231a1e'], teto: '#1a1216', tapete: '#6a1020', junta: '#140c10' },
  londres: { parede: '#5a3a30', parede2: '#4a3028', chao: ['#3a3a40', '#33333a'], teto: null, junta: '#2a1a14' },
  egito: { parede: '#9a7a4a', parede2: '#8a6a3c', chao: ['#7a5e38', '#6e5432'], teto: '#1a2a5a', junta: '#5a4426' },
  cristal: { parede: '#463b72', parede2: '#3a3060', chao: ['#2a2446', '#241f3c'], teto: '#1a1430', junta: '#120e22' },
};
function quad(c, a, b, d, e, cor) { c.fillStyle = cor; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); c.fill(); }
function desenharCorredor(c, coisas = []) {
  const b = R.bioma, tema = b.tema, T = TEMA_COR[tema] || TEMA_COR.cristal;
  const aberto = !T.teto;
  const nevoa = tema === 'londres' ? mistura(b.ceu[2], '#2a3a38', 0.4) : mistura(b.ceu[0], T.parede2, 0.35);
  if (!aberto) { c.fillStyle = nevoa; c.fillRect(0, 0, W, H); }
  const dMin = R.camD + 0.14, dMax = R.camD + 6.4;
  const P = (X, z, a) => projetar(X, z, a);
  const luzes = [];
  let ci = 0;
  while (ci < coisas.length && coisas[ci].z >= dMax - R.camD) coisas[ci++].f();
  const acender = () => {
    if (!luzes.length) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const l of luzes) { c.globalAlpha = l.a; c.drawImage(brilho(l.cor, 48), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
    c.restore(); luzes.length = 0;
  };
  for (let i = Math.floor(dMax / PASSO); i >= Math.floor(dMin / PASSO); i--) {
    const da = Math.max(dMin, i * PASSO), db = (i + 1) * PASSO;
    if (db <= da) continue;
    const za = da - R.camD, zb = db - R.camD;
    const ca = cX(da), cb = cX(db), wa = largC(da), wb = largC(db), ha = altoC(da), hb = altoC(db);
    const nev = clamp((za - 0.6) / 6.4, 0, 1) ** 0.8;
    const tint = (cor, k = 0) => mistura(k ? mistura(cor, '#000000', k) : cor, nevoa, nev);
    const h = hash(i * 7.31 + R.fase * 3.7);
    const LA0 = P(ca - wa, za, 0), LB0 = P(cb - wb, zb, 0), LA1 = P(ca - wa, za, ha), LB1 = P(cb - wb, zb, hb);
    const RA0 = P(ca + wa, za, 0), RB0 = P(cb + wb, zb, 0), RA1 = P(ca + wa, za, ha), RB1 = P(cb + wb, zb, hb);
    // chão
    quad(c, LA0, RA0, RB0, LB0, tint(T.chao[i & 1]));
    if (tema === 'gotico') quad(c, P(ca - 0.32, za, 0), P(ca + 0.32, za, 0), P(cb + 0.32, zb, 0), P(cb - 0.32, zb, 0), tint(T.tapete, (i & 1) * 0.08));
    if (tema === 'londres') { for (const s2 of [-1, 1]) quad(c, P(ca + s2 * wa, za, 0), P(ca + s2 * wa * 0.78, za, 0), P(cb + s2 * wb * 0.78, zb, 0), P(cb + s2 * wb, zb, 0), tint('#5a5a60', (i & 1) * 0.06)); }
    if (tema === 'cristal' && h < 0.35) { c.strokeStyle = rgba(b.luz, 0.5 * (1 - nev)); c.lineWidth = 2; const m = P(lerp(ca, cb, 0.5) + (h - 0.17) * 3, (za + zb) / 2, 0); c.beginPath(); c.moveTo(LA0.x * 0.5 + RA0.x * 0.5, LA0.y); c.lineTo(m.x, m.y); c.stroke(); }
    c.strokeStyle = tint(T.junta); c.lineWidth = 1; c.beginPath(); c.moveTo(LA0.x, LA0.y); c.lineTo(RA0.x, RA0.y); c.stroke();
    // teto
    if (!aberto) {
      quad(c, LA1, RA1, RB1, LB1, tint(T.teto, (i & 1) * 0.1));
      if (tema === 'egito' && h > 0.3) { c.fillStyle = rgba('#ffd27a', 0.7 * (1 - nev)); for (let k = 0; k < 3; k++) { const q = P(lerp(ca - wa, ca + wa, hash(i * 3 + k)), za + (zb - za) * hash(i * 5 + k), ha); c.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); } }
      if ((tema === 'gotico' || tema === 'cristal') && i % 3 === 0) { c.strokeStyle = tint(T.junta); c.lineWidth = 3; c.beginPath(); c.moveTo(LA1.x, LA1.y); c.lineTo(RA1.x, RA1.y); c.stroke(); }
    }
    // paredes
    for (const lado of [-1, 1]) {
      const A0 = lado < 0 ? LA0 : RA0, B0 = lado < 0 ? LB0 : RB0, A1 = lado < 0 ? LA1 : RA1, B1 = lado < 0 ? LB1 : RB1;
      quad(c, A0, B0, B1, A1, tint(lado < 0 ? T.parede : T.parede2, (h * 0.12)));
      // juntas de pedra / tijolo
      c.strokeStyle = tint(T.junta); c.lineWidth = 1;
      const passoA = tema === 'londres' ? 0.35 : 0.5;
      c.beginPath();
      for (let a = passoA; a < Math.min(ha, hb); a += passoA) { const p1 = P(ca + lado * wa, za, a), p2 = P(cb + lado * wb, zb, a); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); }
      c.moveTo(A0.x, A0.y); c.lineTo(A1.x, A1.y);
      c.stroke();
      // rodapé
      quad(c, A0, B0, P(cb + lado * wb, zb, 0.18), P(ca + lado * wa, za, 0.18), tint(T.junta, 0.2));
      decorarParede(c, tema, lado, i, da, db, za, zb, nev, luzes, T);
    }
    acender();
    while (ci < coisas.length && coisas[ci].z >= za) coisas[ci++].f();
  }
  while (ci < coisas.length) coisas[ci++].f();
  // escuridão no fundo do corredor
  const yh = horizonte();
  const g = c.createRadialGradient(W / 2 + cX(R.camD + 6) * W * 0.05, yh, 0, W / 2, yh, W * 0.7);
  g.addColorStop(0, rgba(nevoa, 0)); g.addColorStop(1, rgba('#000000', tema === 'londres' ? 0.1 : 0.32));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
// enfeites presos na parede de um trecho (lado -1 esquerda, 1 direita)
function decorarParede(c, tema, lado, i, da, db, za, zb, nev, luzes, T) {
  const h = hash(i * 13.7 + lado * 5.1 + R.fase);
  const naSala = salaEm((da + db) / 2) > 0.5;
  const ponto = (f, a) => { const d = lerp(da, db, f), z = lerp(za, zb, f); return projetar(cX(d) + lado * largC(d) * 0.995, z, a); };
  const area = (f1, f2, a1, a2) => [ponto(f1, a1), ponto(f2, a1), ponto(f2, a2), ponto(f1, a2)];
  const vis = 1 - nev;
  const pinta = (pts, cor) => { c.fillStyle = cor; c.beginPath(); pts.forEach((q, k) => k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fill(); };
  const tocha = (f, a, cor = 'rgba(255,170,80,.95)') => {
    const q = ponto(f, a), s = projetar(0, lerp(za, zb, f)).s;
    c.fillStyle = mistura('#3a2a20', '#000000', 0.2); c.fillRect(q.x - 2 * s, q.y, 4 * s, 10 * s);
    c.fillStyle = mistura('#ffb040', '#ffffff', 0.2 + 0.2 * Math.sin(R.t * 13 + i));
    c.beginPath(); c.moveTo(q.x - 4 * s, q.y); c.quadraticCurveTo(q.x, q.y - (16 + Math.sin(R.t * 11 + i * 2) * 3) * s, q.x + 4 * s, q.y); c.fill();
    luzes.push({ x: q.x, y: q.y - 6 * s, r: 55 * s, cor, a: 0.75 * vis });
  };
  if (tema === 'gotico') {
    if (h < 0.3 || (naSala && h < 0.55)) {        // vitral alto em arco
      const pts = area(0.15, 0.85, 0.9, 2.1);
      pinta(pts, mistura('#14080c', '#000', 0));
      const cores = ['#d6233f', '#7c4dff', '#e8a93a', '#2fa8a0'];
      const [p0, p1, p2, p3] = pts;
      for (let k = 0; k < 4; k++) {
        const t0 = k / 4, t1 = (k + 1) / 4;
        pinta([{ x: lerp(p0.x, p1.x, 0.1), y: lerp(p0.y, p3.y, t0 * 0.92) }, { x: lerp(p0.x, p1.x, 0.9), y: lerp(p1.y, p2.y, t0 * 0.92) }, { x: lerp(p0.x, p1.x, 0.9), y: lerp(p1.y, p2.y, t1 * 0.92) }, { x: lerp(p0.x, p1.x, 0.1), y: lerp(p0.y, p3.y, t1 * 0.92) }], rgba(cores[(k + i) % 4], 0.85 * vis));
      }
      const topo = ponto(0.5, 2.35);
      c.fillStyle = rgba('#d6233f', 0.8 * vis); c.beginPath(); c.moveTo(p3.x, p3.y); c.quadraticCurveTo(topo.x, topo.y - 4, p2.x, p2.y); c.closePath(); c.fill();
      luzes.push({ x: (p0.x + p1.x) / 2, y: (p0.y + p3.y) / 2, r: Math.abs(p1.x - p0.x) * 2.2 + 20, cor: 'rgba(220,60,100,.6)', a: 0.35 * vis });
    } else if (h < 0.55) tocha(0.5, 1.35);
    else if (h < 0.72) {                              // estandarte
      const pts = area(0.3, 0.7, 1.0, 2.2); pinta(pts, mistura('#8a1028', '#000000', nev * 0.6));
      const q = ponto(0.5, 1.6); c.fillStyle = rgba('#e8c27a', 0.8 * vis); c.beginPath(); c.arc(q.x, q.y, 3 * projetar(0, lerp(za, zb, 0.5)).s, 0, 7); c.fill();
    } else if (h < 0.82) {                            // quadro antigo
      const pts = area(0.2, 0.8, 1.0, 1.7); pinta(pts, rgba('#b88a3a', vis)); pinta(area(0.27, 0.73, 1.07, 1.63), rgba('#3a2a3a', vis));
    }
  } else if (tema === 'londres') {
    // fachadas: janelas acesas em dois andares, portas e placas
    for (const [a1, a2] of [[1.3, 1.9], [2.5, 3.1], [3.6, 4.1]]) {
      if (hash(i * 3.3 + a1 + lado) < 0.25) continue;
      const pts = area(0.2, 0.8, a1, a2);
      const acesa = hash(i * 9.1 + a1 * 3 + lado) < 0.6;
      pinta(pts, acesa ? rgba('#ffcf7a', 0.85 * vis + 0.1) : rgba('#1a1a22', vis));
      if (acesa) luzes.push({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[2].y) / 2, r: Math.abs(pts[1].x - pts[0].x) * 1.6 + 10, cor: 'rgba(255,200,110,.6)', a: 0.3 * vis });
      c.strokeStyle = rgba('#1a1210', vis); c.lineWidth = 1.5; c.beginPath(); c.moveTo((pts[0].x + pts[1].x) / 2, pts[0].y); c.lineTo((pts[3].x + pts[2].x) / 2, pts[3].y); c.stroke();
    }
    if (h < 0.3) { pinta(area(0.25, 0.75, 0.18, 1.05), rgba('#1e1410', vis)); const q = ponto(0.5, 1.15); c.fillStyle = rgba('#ffcf7a', vis); c.fillRect(q.x - 2, q.y - 2, 4, 4); }
    else if (h < 0.42) { pinta(area(0.1, 0.9, 1.05, 1.25), rgba('#2a4a3a', vis)); }
    if (i % 4 === 0) { const q = ponto(0, 4.4); c.strokeStyle = rgba('#2a1a14', vis); c.lineWidth = 3; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(ponto(1, 4.4).x, ponto(1, 4.4).y); c.stroke(); }
  } else if (tema === 'egito') {
    // faixa de hieróglifos dourada
    const fx = area(0, 1, 1.55, 1.95); pinta(fx, rgba('#c8a26a', vis));
    c.fillStyle = rgba('#5a3a1a', vis);
    for (let k = 0; k < 3; k++) { const q = ponto(0.2 + k * 0.3, 1.75), s = projetar(0, lerp(za, zb, 0.2 + k * 0.3)).s; const g = Math.floor(hash(i * 3 + k + lado) * 4); if (g === 0) c.fillRect(q.x - 2 * s, q.y - 4 * s, 4 * s, 8 * s); else if (g === 1) { c.beginPath(); c.arc(q.x, q.y, 3.5 * s, 0, 7); c.fill(); } else if (g === 2) { c.beginPath(); c.moveTo(q.x - 4 * s, q.y + 4 * s); c.lineTo(q.x, q.y - 4 * s); c.lineTo(q.x + 4 * s, q.y + 4 * s); c.fill(); } else c.fillRect(q.x - 4 * s, q.y - 1 * s, 8 * s, 2 * s); }
    if (h < 0.3) tocha(0.5, 1.1);
    else if (h < 0.5 || (naSala && h < 0.7)) {     // nicho com estátua
      pinta(area(0.25, 0.75, 0.18, 1.4), rgba('#3a2a18', vis));
      const q = ponto(0.5, 0.2), s = projetar(0, lerp(za, zb, 0.5)).s;
      c.fillStyle = rgba('#1a1a24', vis); c.fillRect(q.x - 5 * s, q.y - 34 * s, 10 * s, 34 * s); c.beginPath(); c.moveTo(q.x - 5 * s, q.y - 34 * s); c.lineTo(q.x - 3 * s, q.y - 44 * s); c.lineTo(q.x, q.y - 38 * s); c.lineTo(q.x + 3 * s, q.y - 44 * s); c.lineTo(q.x + 5 * s, q.y - 34 * s); c.fill();
      c.fillStyle = rgba('#ffd27a', vis); c.fillRect(q.x - 5 * s, q.y - 30 * s, 10 * s, 2 * s);
    }
  } else {
    // cristal: veios brilhantes e cristais saindo da parede
    if (h < 0.45) {
      const q0 = ponto(0.1, 0.3 + h * 2), q1 = ponto(0.6, 1 + h * 1.5), q2 = ponto(0.95, 0.6 + h);
      c.strokeStyle = rgba(R.bioma.luz, 0.7 * vis); c.lineWidth = 2; c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.lineTo(q2.x, q2.y); c.stroke();
      luzes.push({ x: q1.x, y: q1.y, r: 30 * projetar(0, lerp(za, zb, 0.6)).s, cor: rgba(R.bioma.luz, 0.7), a: 0.4 * vis });
    }
    if (h > 0.6) { const q = ponto(0.5, 0), s = projetar(0, lerp(za, zb, 0.5)).s; c.save(); c.globalAlpha = vis; c.translate(q.x, q.y); c.scale(s * 0.7, s * 0.7); cristal(c, -lado * 6, 0, 60, 14, R.bioma.cristal, -lado * 0.5); cristal(c, -lado * 18, 0, 36, 10, R.bioma.cristal, -lado * 0.8); c.restore(); }
  }
}
function desenharChao(c) {
  const y0 = horizonte();
  const b = R.bioma;
  const g = c.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, mistura(b.pedra[1], b.ceu[2], 0.45)); g.addColorStop(0.35, b.pedra[0]); g.addColorStop(1, b.pedra[1]);
  c.fillStyle = g; c.fillRect(0, y0, W, H - y0);
  // linhas que correm em direção à câmera (sensação de andar)
  c.strokeStyle = rgba(b.topo, 0.22); c.lineWidth = 1.2;
  const off = (R.camD * 5.5) % 1;
  for (let k = 0; k < 14; k++) {
    const z = 3.2 / (1 + k + off * 1 - 0) ;
    const zz = 0.25 + (k - off * 1 + 1) * 0.18;
    const p = projetar(0, Math.max(0.2, zz));
    if (p.y > H || p.y < y0) continue;
    c.globalAlpha = clamp((p.y - y0) / (H * 0.2), 0, 1) * 0.9;
    c.beginPath(); c.moveTo(0, p.y); c.lineTo(W, p.y); c.stroke();
  }
  c.globalAlpha = 1;
  for (let i = -8; i <= 8; i++) {
    const a = projetar(i * 0.5, 3), bb = projetar(i * 0.5, 0.22);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(bb.x, bb.y); c.stroke();
  }
  // brilho do horizonte
  const gh = c.createLinearGradient(0, y0 - 30, 0, y0 + 50);
  gh.addColorStop(0, rgba(b.luz, 0)); gh.addColorStop(0.5, rgba(b.luz, 0.18)); gh.addColorStop(1, rgba(b.luz, 0));
  c.fillStyle = gh; c.fillRect(0, y0 - 30, W, 80);
}
const fake = {};
function desenharInimigoT(c, en) {
  const d = DEFS[en.tipo] || DEFS.esqueleto;
  const voa = VOAM.includes(en.tipo);
  const p = projetar(en.X, en.z, (voa ? 0.55 : 0) + (en.alt || 0));
  const morto = en.estado === 'morto';
  // atirador: quanto está exposto (0 escondido, 1 fora)
  if (en.papel === 'atirador') en.expV = lerp(en.expV ?? 0, en.estado === 'espera' ? 0 : 1, 0.25);
  if (en.cob === 3) {
    // janela/porta escura na parede: é dali que ele aparece
    const pw = 40 * p.esc, ph = (en.alt ? 70 : 96) * p.esc;
    c.fillStyle = 'rgba(8,4,10,.85)'; c.fillRect(p.x - pw / 2, p.y - ph, pw, ph);
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.strokeRect(p.x - pw / 2, p.y - ph, pw, ph);
    if ((en.expV ?? 1) < 0.03 && !morto) return;
  }
  const esc = p.esc * escInimigo(en) / (en.elite ? 1.2 : 1);
  c.save();
  if (en.cob === 3 && !morto) c.globalAlpha = en.expV ?? 1;
  if (morto) c.globalAlpha = clamp(1 - en.tE / 0.5, 0, 1);
  if (en.tipo === 'assassino' && en.estado === 'anda' && en.z > 0.7) c.globalAlpha *= 0.35;
  // sombra
  if (!voa && !en.alt) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x, p.y, d.w * esc * 0.8, d.w * esc * 0.18, 0, 0, 7); c.fill(); }
  c.translate(p.x, voa ? p.y + d.h * esc * 0.5 : p.y);
  if (en.cob === 2 && !morto) c.translate(0, (1 - (en.expV ?? 1)) * d.h * esc * 0.75);     // agachado atrás do caixote
  if (en.cob === 3 && !morto) c.translate(0, (1 - (en.expV ?? 1)) * d.h * esc * 0.3);
  if (morto) { c.rotate(en.tE * 1.5 * (en.X > 0 ? 1 : -1)); c.translate(0, en.tE * 40); }
  c.scale(esc, esc);
  Object.assign(fake, {
    id: en.id, tipo: en.tipo, x: 0, y: 0, d: en.X > 0.15 ? -1 : en.X < -0.15 ? 1 : (en.id % 2 ? 1 : -1),
    estado: en.estado === 'anda' ? 'persegue' : en.estado === 'morto' ? 'recupera' : en.estado,
    tE: en.gelo > 0 ? 0 : en.tE || 0, w: Math.round(d.w * (en.elite ? 1.2 : 1)), h: Math.round(d.h * (en.elite ? 1.2 : 1)), elite: en.elite,
    atordT: en.estado === 'atordoado' ? 1 : 0, hp: en.hp, mhp: en.mhp, flash: 0, ataque: en.ataque, arm: 0, marm: 0, vx: 0, vy: 0, golpeado: 0,
  });
  desenharInimigo(c, fake, R.t, R.bioma);
  // congelado: bloco de gelo por cima
  if (en.gelo > 0) {
    c.save(); c.globalAlpha = 0.55; c.fillStyle = '#bff4ff'; c.strokeStyle = '#ffffff'; c.lineWidth = 2 / esc;
    c.beginPath(); c.moveTo(-d.w * 0.9, 4); c.lineTo(-d.w * 1.0, -d.h * 0.7); c.lineTo(-d.w * 0.4, -d.h * 1.12); c.lineTo(d.w * 0.6, -d.h * 1.05); c.lineTo(d.w * 1.0, -d.h * 0.5); c.lineTo(d.w * 0.85, 4); c.closePath(); c.fill(); c.globalAlpha = 0.9; c.stroke();
    c.beginPath(); c.moveTo(-d.w * 0.4, -d.h * 1.12); c.lineTo(-d.w * 0.1, -d.h * 0.3); c.moveTo(d.w * 0.6, -d.h * 1.05); c.lineTo(d.w * 0.2, -d.h * 0.5); c.stroke();
    c.restore();
  }
  if (en.queima > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,120,30,.8)', 48), -d.w * 1.3, -d.h * 1.3, d.w * 2.6, d.h * 1.6);
    for (let i = 0; i < 5; i++) { const x = (i - 2) * d.w * 0.35, hh = d.h * (0.3 + 0.2 * Math.sin(R.t * 14 + i * 2 + en.id)); c.fillStyle = i % 2 ? '#ffb040' : '#ff5a20'; c.beginPath(); c.moveTo(x - 7, -d.h * 0.2); c.quadraticCurveTo(x, -d.h * 0.2 - hh * 2, x + 7, -d.h * 0.2); c.fill(); }
    c.restore();
  }
  // clarão do acerto
  if (en.flash > 0) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = en.flash / 0.12;
    c.drawImage(brilho('rgba(255,255,255,.9)', 48), -d.w * 1.2, -d.h * 1.2, d.w * 2.4, d.h * 1.4);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  c.restore();
  if (morto) return;
  const r = retInimigo(en);
  // MIRA (Virtua Cop): anel que gira e fecha, verde → amarelo → vermelho piscando
  if (en.papel === 'atirador' && en.estado === 'prepara') {
    const k = clamp(en.tE / (en.mira || miraDur()), 0, 1);
    const cor = k < 0.5 ? '#5dff7a' : k < 0.8 ? '#ffd84a' : (Math.floor(R.t * 16) % 2 ? '#ff2a3a' : '#ffffff');
    const rr2 = Math.max(r.w, r.h * 0.6) * (1.25 - k * 0.6), cx = r.cx, cy = r.y + r.h * 0.35;
    c.save(); c.strokeStyle = cor; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = R.t * 3 + i * Math.PI / 2; c.beginPath(); c.arc(cx, cy, rr2, a, a + 1.0); c.stroke(); }
    c.beginPath(); c.moveTo(cx - rr2 - 8, cy); c.lineTo(cx - rr2 * 0.6, cy); c.moveTo(cx + rr2 * 0.6, cy); c.lineTo(cx + rr2 + 8, cy); c.moveTo(cx, cy - rr2 - 8); c.lineTo(cx, cy - rr2 * 0.6); c.moveTo(cx, cy + rr2 * 0.6); c.lineTo(cx, cy + rr2 + 8); c.stroke();
    c.fillStyle = R.jog[en.alvo]?.cor || '#fff'; c.beginPath(); c.arc(cx + rr2 * 0.72, cy - rr2 * 0.72, 4, 0, 7); c.fill();
    c.restore();
  }
  // aviso de golpe: anel que fecha + cor do jogador alvo
  if (en.estado === 'prepara' && en.papel !== 'atirador') {
    const prep = en.duelo ? (PREP[en.ataque] || 0.8) : en.papel === 'perto' ? (en.pesado ? 1.15 : 0.85) : 0.6;
    const k = clamp(en.tE / prep, 0, 1);
    const cor = R.jog[en.alvo]?.cor || '#fff';
    c.save();
    c.strokeStyle = cor; c.lineWidth = 3; c.globalAlpha = 0.9;
    const rr = Math.max(r.w, r.h) * (1.1 - k * 0.55);
    c.beginPath(); c.arc(r.cx, r.cy, rr, 0, 7); c.stroke();
    if (en.papel === 'perto') {
      c.fillStyle = '#ff3355'; c.font = `900 ${Math.round(14 + 10 * k)}px system-ui`; c.textAlign = 'center';
      c.fillText('!', r.cx, r.y - 8);
    }
    c.restore();
  }
  // barra de vida
  if (!en.duelo && (en.hp < en.mhp || en.elite)) {
    const bw = Math.max(40, r.w * 0.9), bx = r.cx - bw / 2, by = r.y - 14;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(bx - 1, by - 1, bw + 2, 6);
    c.fillStyle = en.elite ? '#ffc94d' : '#ff5a6a';
    c.fillRect(bx, by, bw * clamp(en.hp / en.mhp, 0, 1), 4);
  }
  if (en.duelo) desenharDuelo(c, en, r);
}
// pontos fracos, brilho de vulnerável
function desenharDuelo(c, en, r) {
  c.save();
  if (en.vulnT > 0) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + 0.35 * Math.sin(R.t * 12);
    c.drawImage(brilho('rgba(255,230,140,.9)', 64), r.x - r.w * 0.4, r.y - r.h * 0.2, r.w * 1.8, r.h * 1.4);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.font = '900 20px system-ui'; c.textAlign = 'center'; c.fillStyle = '#ffe9a0'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4;
    const ly = Math.max(84, r.y - 10);
    c.strokeText('EXPOSTO!', r.cx, ly); c.fillText('EXPOSTO!', r.cx, ly);
  }
  for (const p of en.pontos || []) {
    if (p.t < 0) continue;
    const q = posPonto(en, p), k = clamp(p.t / p.vida, 0, 1), pulso = 1 + 0.12 * Math.sin(R.t * 14 + p.id);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(brilho('rgba(255,220,90,.95)', 48), q.x - q.r * 2 * pulso, q.y - q.r * 2 * pulso, q.r * 4 * pulso, q.r * 4 * pulso);
    c.globalCompositeOperation = 'source-over';
    cristal(c, q.x, q.y + q.r * 0.55, q.r * 1.2 * pulso, q.r * 0.6, ['#fffbe0', '#ffd24a', '#a8701a'], 0);
    c.strokeStyle = '#fff6c8'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(q.x, q.y, q.r * 1.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(q.x - q.r * 1.5, q.y); c.lineTo(q.x - q.r * 0.7, q.y); c.moveTo(q.x + q.r * 0.7, q.y); c.lineTo(q.x + q.r * 1.5, q.y); c.moveTo(q.x, q.y - q.r * 1.5); c.lineTo(q.x, q.y - q.r * 0.7); c.moveTo(q.x, q.y + q.r * 0.7); c.lineTo(q.x, q.y + q.r * 1.5); c.stroke();
  }
  c.restore();
}

// ---------- cenário que passa (gerado por fase) ----------
const OBJ_TEMA = {
  gotico: [['pilar', 3], ['candelabro', 2], ['lapide', 2], ['gargulaEst', 1]],
  londres: [['poste', 3], ['caixote', 2], ['barril', 2], ['cerca', 2]],
  egito: [['obelisco', 2], ['estatua', 2], ['coluna', 3], ['braseiro', 2]],
  cristal: [['cristais', 3], ['pilarCristal', 2], ['lapide', 1]],
};
function gerarProps(f) {
  const r = rng((R.semente || 1) * 13 + f * 101);
  const tema = FASES[f].bioma.tema, lista = OBJ_TEMA[tema] || OBJ_TEMA.cristal;
  const tot = lista.reduce((a, b) => a + b[1], 0);
  const out = [];
  // nas salas: colunas nas laterais (dão cobertura pros inimigos)
  for (const P of PARADAS) {
    const col = tema === 'londres' ? 'poste' : tema === 'egito' ? 'coluna' : tema === 'cristal' ? 'pilarCristal' : 'pilar';
    for (const dd of [0.75, 1.45, 2.15]) for (const lado of [-1, 1]) out.push({ d: P + dd + (r() - 0.5) * 0.1, lado, k: 0.72, tipo: col, esconde: true, v: r() });
    // algo no meio da sala, às vezes
    if (r() < 0.6) out.push({ d: P + 1.3 + r() * 0.6, lado: r() < 0.5 ? -1 : 1, k: 0.25 + r() * 0.2, tipo: tema === 'londres' ? 'caixote' : tema === 'egito' ? 'braseiro' : tema === 'cristal' ? 'cristais' : 'candelabro', esconde: true, v: r() });
  }
  // nos corredores: coisas encostadas nas paredes
  for (let d = 0.6; d < 29; d += 0.35 + r() * 0.55) {
    if (salaEm(d) > 0.2) continue;
    let v = r() * tot, tipo = lista[0][0];
    for (const [t, p] of lista) if ((v -= p) < 0) { tipo = t; break; }
    if (r() < 0.12) tipo = 'explosivo';
    out.push({ d, lado: r() < 0.5 ? -1 : 1, k: tipo === 'explosivo' ? 0.6 : 0.78, tipo, v: r() });
  }
  // barris explosivos nos salões (atire neles perto dos inimigos!)
  for (const P of PARADAS) for (let k = 0; k < 2; k++) out.push({ d: P + 0.9 + r() * 1.4, lado: r() < 0.5 ? -1 : 1, k: 0.35 + r() * 0.35, tipo: 'explosivo', v: r() });
  out.forEach((p, i) => { p.i = i; });
  return out;
}
function propX(pr) { return cX(pr.d) + pr.lado * largC(pr.d) * pr.k; }
function desenharProp(c, pr, z) {
  const p = projetar(propX(pr), z);
  const a = clamp((z - 0.2) / 0.18, 0, 1) * clamp((5 - z) / 1.2, 0, 1);
  if (a <= 0) return;
  const b = R.bioma, CONT = '#120a18';
  c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.scale(p.esc, p.esc);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = CONT; c.lineWidth = 3;
  const pedra = b.pedra[0], escura = b.pedra[1], clara = b.pedra[2];
  const brilhoEm = (x, y, cor, rr) => { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (0.7 + 0.2 * Math.sin(R.t * 7 + pr.v * 9)); c.drawImage(brilho(cor, 48), x - rr, y - rr, rr * 2, rr * 2); c.restore(); };
  const t = pr.tipo;
  if (t === 'arco') {
    const w = W * 0.3 * (1 / z) * 1.25 / p.esc;
    c.fillStyle = pedra;
    for (const s of [-1, 1]) { c.fillRect(s * w - 22, -320, 44, 320); c.strokeRect(s * w - 22, -320, 44, 320); }
    c.beginPath(); c.moveTo(-w - 22, -320); c.quadraticCurveTo(0, -520, w + 22, -320); c.lineTo(w - 22, -320); c.quadraticCurveTo(0, -470, -w + 22, -320); c.closePath();
    c.fillStyle = b.tema === 'cristal' ? b.cristal[1] : clara; c.fill(); c.stroke();
  } else if (t === 'pilar' || t === 'coluna') {
    c.fillStyle = t === 'coluna' ? '#c8a26a' : pedra; c.fillRect(-20, -300, 40, 300); c.strokeRect(-20, -300, 40, 300);
    c.fillStyle = t === 'coluna' ? '#e0c08a' : clara; c.fillRect(-28, -312, 56, 16); c.strokeRect(-28, -312, 56, 16); c.fillRect(-28, -16, 56, 16); c.strokeRect(-28, -16, 56, 16);
    if (t === 'coluna') { c.strokeStyle = '#7a5a2a'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.strokeRect(-10, -270 + i * 42, 8, 14); c.beginPath(); c.arc(8, -262 + i * 42, 5, 0, 7); c.stroke(); } }
    else { c.fillStyle = '#8a1028'; c.beginPath(); c.moveTo(-16, -280); c.lineTo(16, -280); c.lineTo(16, -170); c.lineTo(0, -185); c.lineTo(-16, -170); c.closePath(); c.fill(); c.stroke(); }
  } else if (t === 'candelabro' || t === 'braseiro' || t === 'poste') {
    const alto = t === 'poste' ? 220 : t === 'candelabro' ? 150 : 70;
    c.fillStyle = '#2a2230'; c.fillRect(-4, -alto, 8, alto); c.strokeRect(-4, -alto, 8, alto);
    c.fillRect(-16, -8, 32, 8);
    if (t === 'poste') { c.fillStyle = '#ffe6a0'; c.fillRect(-12, -alto - 26, 24, 26); c.strokeRect(-12, -alto - 26, 24, 26); brilhoEm(0, -alto - 14, 'rgba(255,210,120,.9)', 90); }
    else if (t === 'candelabro') { for (const x of [-22, 0, 22]) { c.fillStyle = '#f4ecd8'; c.fillRect(x - 4, -alto - 22, 8, 22); brilhoEm(x, -alto - 28, 'rgba(255,170,90,.9)', 30); } c.strokeStyle = '#2a2230'; c.lineWidth = 5; c.beginPath(); c.moveTo(-22, -alto); c.lineTo(22, -alto); c.stroke(); }
    else { c.fillStyle = '#8a6a3a'; c.beginPath(); c.moveTo(-26, -alto); c.lineTo(26, -alto); c.lineTo(14, -alto + 22); c.lineTo(-14, -alto + 22); c.closePath(); c.fill(); c.stroke(); brilhoEm(0, -alto - 20, 'rgba(255,140,40,.95)', 60); c.fillStyle = '#ffb040'; c.beginPath(); c.moveTo(-14, -alto); c.quadraticCurveTo(0, -alto - 50 - Math.sin(R.t * 9) * 8, 14, -alto); c.fill(); }
  } else if (t === 'explosivo') {
    if (R.explodidos.has(pr.i)) { c.restore(); return; }
    const tema = b.tema;
    if (tema === 'egito') { c.fillStyle = '#b8682a'; c.beginPath(); c.ellipse(0, -30, 20, 30, 0, 0, 7); c.fill(); c.stroke(); c.fillRect(-8, -66, 16, 10); c.strokeRect(-8, -66, 16, 10); }
    else if (tema === 'cristal') { cristal(c, 0, 0, 70, 18, ['#ffd0d0', '#ff3a4a', '#7a0a1a'], 0); }
    else { c.fillStyle = tema === 'gotico' ? '#5a3a20' : '#a8241c'; c.fillRect(-20, -58, 40, 58); c.strokeRect(-20, -58, 40, 58); c.strokeStyle = '#2a2a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(-20, -44); c.lineTo(20, -44); c.moveTo(-20, -14); c.lineTo(20, -14); c.stroke(); }
    // símbolo de perigo
    c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(0, -42); c.lineTo(9, -26); c.lineTo(-9, -26); c.closePath(); c.fill();
    c.fillStyle = '#1a1010'; c.fillRect(-1.5, -38, 3, 7); c.fillRect(-1.5, -29, 3, 2);
    brilhoEm(0, -30, 'rgba(255,90,40,.6)', 40);
  } else if (t === 'lapide') {
    c.fillStyle = clara; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-22, -46); c.arc(0, -46, 22, Math.PI, 0); c.lineTo(22, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = escura; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -56); c.lineTo(0, -24); c.moveTo(-9, -44); c.lineTo(9, -44); c.stroke();
  } else if (t === 'gargulaEst' || t === 'estatua') {
    c.fillStyle = t === 'estatua' ? '#2a2a3a' : '#5a5468';
    c.fillRect(-26, -40, 52, 40); c.strokeRect(-26, -40, 52, 40);
    c.beginPath(); c.moveTo(-16, -40); c.lineTo(-14, -120); c.lineTo(14, -120); c.lineTo(16, -40); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-14, -120); c.lineTo(-8, -150); c.lineTo(0, -132); c.lineTo(8, -150); c.lineTo(14, -120); c.closePath(); c.fill(); c.stroke();
    if (t === 'estatua') { c.fillStyle = '#e8c27a'; c.fillRect(-14, -112, 28, 6); c.fillStyle = '#ffd27a'; c.fillRect(-6, -134, 4, 4); c.fillRect(2, -134, 4, 4); }
    else { c.fillStyle = '#ff5a6a'; c.fillRect(-6, -134, 4, 4); c.fillRect(2, -134, 4, 4); }
  } else if (t === 'obelisco') {
    c.fillStyle = '#c8a26a'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(-12, -280); c.lineTo(0, -310); c.lineTo(12, -280); c.lineTo(18, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#7a5a2a'; c.lineWidth = 2; for (let i = 0; i < 7; i++) c.strokeRect(-6, -250 + i * 32, 12, 12);
  } else if (t === 'caixote' || t === 'barril') {
    if (t === 'caixote') { c.fillStyle = '#8a6438'; c.fillRect(-30, -56, 60, 56); c.strokeRect(-30, -56, 60, 56); c.beginPath(); c.moveTo(-30, -56); c.lineTo(30, 0); c.moveTo(30, -56); c.lineTo(-30, 0); c.stroke(); }
    else { c.fillStyle = '#7a4a2a'; c.beginPath(); c.ellipse(0, -32, 24, 32, 0, 0, 7); c.fill(); c.stroke(); c.strokeStyle = '#3a3a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(-23, -46); c.lineTo(23, -46); c.moveTo(-23, -18); c.lineTo(23, -18); c.stroke(); }
  } else if (t === 'cerca') {
    c.strokeStyle = '#1a1a22'; c.lineWidth = 5;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16, -90); c.stroke(); c.fillStyle = '#1a1a22'; c.beginPath(); c.moveTo(i * 16 - 6, -90); c.lineTo(i * 16, -104); c.lineTo(i * 16 + 6, -90); c.fill(); }
    c.beginPath(); c.moveTo(-54, -70); c.lineTo(54, -70); c.moveTo(-54, -20); c.lineTo(54, -20); c.stroke();
  } else if (t === 'cristais' || t === 'pilarCristal') {
    const h0 = t === 'pilarCristal' ? 260 : 120;
    cristal(c, 0, 0, h0, h0 * 0.22, b.cristal, 0);
    if (t === 'cristais') { cristal(c, -26, 0, h0 * 0.6, h0 * 0.16, b.cristal, -0.3); cristal(c, 24, 0, h0 * 0.7, h0 * 0.16, b.cristal, 0.25); }
    brilhoEm(0, -h0 * 0.5, rgba(b.luz, 0.6), h0 * 0.6);
  }
  c.restore();
}
const ROUPAS = [['#c9a26a', '#6a4a2a'], ['#7a9ac9', '#2a3a6a'], ['#c97a8a', '#6a2a3a'], ['#9ac97a', '#3a5a2a']];
function desenharRefem(c, r) {
  const p = projetar(r.X, r.z);
  const esc = p.esc;
  c.save(); c.translate(p.x, p.y); c.scale(esc, esc);
  if (r.estado === 'salvo' || (r.civil && r.estado === 'livre')) c.globalAlpha = r.estado === 'salvo' ? clamp(1 - r.t / 2.5, 0, 1) : 1;
  const [roupa, escura] = ROUPAS[r.look % 4];
  if (r.estado === 'morto') {
    c.rotate(-1.4); c.globalAlpha = 0.85;
  }
  const corre = r.civil || r.estado === 'livre' || r.estado === 'salvo';
  const ph = corre ? R.t * 10 : 0;
  c.lineCap = 'round'; c.strokeStyle = '#1a1020'; c.lineWidth = 2.5;
  // pernas
  c.strokeStyle = escura; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-4, -28); c.lineTo(-4 - Math.sin(ph) * 8, 0); c.moveTo(4, -28); c.lineTo(4 + Math.sin(ph) * 8, 0); c.stroke();
  // vestido/casaco
  c.fillStyle = roupa; c.strokeStyle = '#1a1020'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-11, -26); c.lineTo(-8, -54); c.lineTo(8, -54); c.lineTo(11, -26); c.closePath(); c.fill(); c.stroke();
  // braços (presos atrás ou balançando)
  c.strokeStyle = roupa; c.lineWidth = 5;
  if (r.estado === 'preso') { c.beginPath(); c.moveTo(-8, -50); c.lineTo(-4, -36); c.moveTo(8, -50); c.lineTo(4, -36); c.stroke(); c.strokeStyle = '#8a6a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -36); c.lineTo(6, -36); c.stroke(); }
  else { c.beginPath(); c.moveTo(-8, -50); c.lineTo(-14, -38 + Math.sin(ph) * 6); c.moveTo(8, -50); c.lineTo(14, -38 - Math.sin(ph) * 6); c.stroke(); }
  // cabeça
  c.fillStyle = '#f2d0b4'; c.strokeStyle = '#1a1020'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, -62, 8, 0, 7); c.fill(); c.stroke();
  c.fillStyle = ['#5a3a1a', '#d8b060', '#2a1a10', '#b8b8b8'][r.look % 4];
  c.beginPath(); c.arc(0, -65, 8, Math.PI, 0); c.fill();
  // rosto assustado
  c.fillStyle = '#1a1020'; c.fillRect(-4, -63, 2, 2); c.fillRect(2, -63, 2, 2);
  c.beginPath(); c.arc(0, -57.5, 1.8, 0, 7); c.fill();
  c.restore();
  if (r.estado === 'preso') {
    c.save(); c.fillStyle = '#ffe9a0'; c.font = `700 ${Math.round(clamp(11 * p.s, 10, 16))}px system-ui`; c.textAlign = 'center';
    c.globalAlpha = 0.7 + 0.3 * Math.sin(R.t * 6); c.fillText('REFÉM', p.x, p.y - 74 * esc); c.restore();
  }
  if (r.estado === 'morto' && R.C.gesto === 'cura') {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 + 0.3 * Math.sin(R.t * 5);
    c.drawImage(brilho('rgba(255,235,150,.8)', 48), p.x - 40 * esc, p.y - 50 * esc, 80 * esc, 60 * esc); c.restore();
    c.save(); c.fillStyle = '#fff2b0'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.fillText('toque pra reviver', p.x, p.y - 30 * esc); c.restore();
  }
}
function desenharProj(c, q) {
  const p = posProj(q);
  const r = 9 * p.s;
  const cor = corProj(q);
  c.save(); c.translate(p.x, p.y);
  c.globalCompositeOperation = 'lighter';
  c.drawImage(brilho(rgba(cor, 0.8), 32), -r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
  c.globalCompositeOperation = 'source-over';
  c.rotate(R.t * (q.tipo === 'orbe' || q.tipo === 'fogo' ? 2 : 12));
  if (q.tipo === 'osso') {
    c.fillStyle = '#efe6cf'; c.strokeStyle = '#2a2018'; c.lineWidth = 1.5;
    c.fillRect(-r * 1.3, -r * 0.25, r * 2.6, r * 0.5);
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 1.3, -r * 0.25, r * 0.35, 0, 7); c.arc(s * r * 1.3, r * 0.25, r * 0.35, 0, 7); c.fill(); }
  } else if (q.tipo === 'adaga') {
    c.fillStyle = '#dfe6f2'; c.strokeStyle = '#2a2a3a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(r * 1.6, 0); c.lineTo(-r * 0.2, -r * 0.3); c.lineTo(-r * 0.2, r * 0.3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#6a4a2a'; c.fillRect(-r * 0.9, -r * 0.18, r * 0.7, r * 0.36);
  } else if (q.tipo === 'garrafa') {
    c.fillStyle = '#5aa06a'; c.strokeStyle = '#1a2a1a'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 0, r * 0.6, r, 0, 0, 7); c.fill(); c.stroke(); c.fillRect(-r * 0.2, -r * 1.6, r * 0.4, r * 0.7);
  } else {
    cristal(c, 0, r * 0.9, r * 2.2, r * 0.9, q.tipo === 'fogo' ? ['#ffd0f0', '#ff4fc8', '#8a1270'] : R.bioma.cristal, 0);
  }
  c.restore();
  // de quem é o alvo
  const cor2 = R.jog[q.alvo]?.cor || '#fff';
  c.save(); c.strokeStyle = cor2; c.lineWidth = 2; c.globalAlpha = 0.5 + 0.5 * p.k;
  c.beginPath(); c.arc(p.x, p.y, r * 2.4, 0, 7); c.stroke(); c.restore();
}
// magias em voo: o mago solta um cristal prismático com rastro; o vampiro, uma meia-lua de sangue
function desenharMagias(c) {
  for (const m of R.magias) {
    const k = clamp(m.t / m.dur, 0, 1), e = 1 - (1 - k) * (1 - k);
    const px = lerp(m.x0, m.x, e), py = lerp(m.y0, m.y, e) - Math.sin(k * Math.PI) * 30;
    const ang = Math.atan2(m.y - m.y0, m.x - m.x0);
    m.rastro = m.rastro || []; m.rastro.push({ x: px, y: py }); if (m.rastro.length > 9) m.rastro.shift();
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const tam = 1 + (1 - k) * 0.6;
    if (m.sangue) {
      for (let i = 1; i < m.rastro.length; i++) { const a = m.rastro[i - 1], b = m.rastro[i]; c.strokeStyle = `rgba(255,40,70,${i / m.rastro.length * 0.7})`; c.lineWidth = 10 * i / m.rastro.length; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.translate(px, py); c.rotate(ang);
      c.drawImage(brilho('rgba(255,30,60,.9)', 32), -36 * tam, -36 * tam, 72 * tam, 72 * tam);
      c.globalCompositeOperation = 'source-over';
      const r = 16 * tam;
      c.fillStyle = '#c8102e'; c.beginPath(); c.moveTo(-r * 0.15, -r * 1.2); c.quadraticCurveTo(r * 1.1, 0, -r * 0.15, r * 1.2); c.quadraticCurveTo(r * 0.45, 0, -r * 0.15, -r * 1.2); c.fill();
      c.strokeStyle = '#ffe3ea'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 0.12, -r * 1.15); c.quadraticCurveTo(r * 1.05, 0, -r * 0.12, r * 1.15); c.stroke();
    } else {
      const cores = ['#ff9ad5', '#ffd27a', '#9affc8', '#9ad5ff', '#c79bff'];
      for (let i = 1; i < m.rastro.length; i++) { const a = m.rastro[i - 1], b = m.rastro[i]; c.strokeStyle = cores[(i + Math.floor(R.t * 20)) % 5]; c.globalAlpha = i / m.rastro.length * 0.8; c.lineWidth = 9 * i / m.rastro.length; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.globalAlpha = 1; c.translate(px, py); c.rotate(ang + Math.PI / 2 + R.t * 8);
      c.drawImage(brilho('rgba(200,160,255,.95)', 32), -34 * tam, -34 * tam, 68 * tam, 68 * tam);
      cristal(c, 0, 12 * tam, 26 * tam, 9 * tam, ['#ffffff', '#d8c0ff', '#7c4dff'], 0);
    }
    c.restore();
  }
}
function desenharFx(c) {
  for (const f of R.fx) {
    const k = f.t / f.dur;
    c.save();
    if (f.tipo === 'p') { c.globalAlpha = 1 - k; c.fillStyle = f.cor; c.fillRect(f.x - f.tam / 2, f.y - f.tam / 2, f.tam, f.tam); }
    else if (f.tipo === 'anel') { c.globalAlpha = 1 - k; c.strokeStyle = f.cor; c.lineWidth = 3 * (1 - k) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * (0.4 + k), 0, 7); c.stroke(); }
    else if (f.tipo === 'impacto') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
      c.drawImage(brilho('rgba(255,255,255,.95)', 48), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    } else if (f.tipo === 'estrela') {
      c.translate(f.x, f.y); c.rotate(k * 2); c.globalAlpha = 1 - k; c.fillStyle = f.cor;
      const R0 = f.r * (0.5 + k * 0.6);
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? R0 * 0.25 : R0; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
    } else if (f.tipo === 'soco') {
      c.translate(f.x, f.y); c.globalAlpha = 1 - k; c.strokeStyle = f.cor; c.lineWidth = 4;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * f.r * 0.3 * (1 + k), Math.sin(a) * f.r * 0.3 * (1 + k)); c.lineTo(Math.cos(a) * f.r * (0.6 + k * 0.5), Math.sin(a) * f.r * (0.6 + k * 0.5)); c.stroke(); }
    } else if (f.tipo === 'talho') {
      c.translate(f.x, f.y); c.rotate(f.ang); c.globalAlpha = 1 - k; c.lineCap = 'round';
      const L = f.r * (0.6 + k * 0.8);
      c.strokeStyle = '#7a0016'; c.lineWidth = 10 * (1 - k) + 2; c.beginPath(); c.moveTo(-L, 0); c.lineTo(L, 0); c.stroke();
      c.strokeStyle = '#ff3355'; c.lineWidth = 5 * (1 - k) + 1; c.stroke();
      c.strokeStyle = '#ffe0e6'; c.lineWidth = 1.5; c.stroke();
    } else if (f.tipo === 'aparo') {
      c.translate(f.x, f.y); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
      c.drawImage(brilho('rgba(255,240,170,.95)', 64), -f.r * 1.5, -f.r * 1.5, f.r * 3, f.r * 3);
      c.strokeStyle = '#fff6c8'; c.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * f.r * (1 + k), Math.sin(a) * f.r * (1 + k)); c.stroke(); }
    } else if (f.tipo === 'cruz') {
      c.translate(f.x, f.y - k * 30); c.globalAlpha = 1 - k; c.fillStyle = '#fff2b0';
      c.fillRect(-4, -16, 8, 32); c.fillRect(-12, -8, 24, 8);
    } else if (f.tipo === 'raio') {
      c.globalAlpha = 1 - k; c.lineCap = 'round';
      const mx = lerp(f.x0, f.x, Math.min(1, k * 2.5)), my = lerp(f.y0, f.y, Math.min(1, k * 2.5));
      const x1 = lerp(f.x0, f.x, Math.max(0, k * 2.5 - 0.6)), y1 = lerp(f.y0, f.y, Math.max(0, k * 2.5 - 0.6));
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = f.sangue ? '#ff2a4a' : f.cor; c.lineWidth = f.soco ? 8 : 6;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(mx, my); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    } else if (f.tipo === 'corte' || f.tipo === 'corteRemoto') {
      c.translate(f.x, f.y); c.rotate(f.ang); c.globalAlpha = 1 - k; c.lineCap = 'round';
      c.strokeStyle = f.cor; c.lineWidth = 6 * (1 - k); c.beginPath(); c.moveTo(-90, 0); c.lineTo(90, 0); c.stroke();
    } else if (f.tipo === 'prisma') {
      // estilhaço prismático: seis lascas coloridas girando pra fora
      c.translate(f.x, f.y); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
      c.drawImage(brilho('rgba(220,190,255,.9)', 48), -f.r, -f.r, f.r * 2, f.r * 2);
      const cores = ['#ff9ad5', '#ffd27a', '#9affc8', '#9ad5ff', '#c79bff', '#ffffff'];
      for (let i = 0; i < 6; i++) { const a = f.a0 + i * Math.PI / 3 + k * 1.5, d = f.r * (0.2 + k * 0.9); c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + Math.PI / 2); c.fillStyle = cores[i]; c.beginPath(); c.moveTo(0, -9 * (1 - k * 0.5)); c.lineTo(3, 0); c.lineTo(0, 9 * (1 - k * 0.5)); c.lineTo(-3, 0); c.closePath(); c.fill(); c.restore(); }
      c.strokeStyle = '#fff'; c.lineWidth = 2 * (1 - k); c.beginPath(); c.arc(0, 0, f.r * (0.3 + k * 0.7), 0, 7); c.stroke();
    } else if (f.tipo === 'relampago') {
      // raio caindo do alto no primeiro e saltando de um inimigo pro outro
      c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
      const pisca = k < 0.6 ? 1 : (Math.floor(f.t * 30) % 2 ? 0.3 : 1 - k);
      const zig = (a, b, amp) => { const n = 9, pts = [a]; for (let i = 1; i < n; i++) { const t = i / n; pts.push({ x: lerp(a.x, b.x, t) + (Math.random() - 0.5) * amp, y: lerp(a.y, b.y, t) + (Math.random() - 0.5) * amp }); } pts.push(b); return pts; };
      const linha = (pts, w, cor) => { c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); };
      const segs = [zig({ x: f.pts[0].x + (Math.random() - 0.5) * 60, y: -20 }, f.pts[0], 60)];
      for (let i = 1; i < f.pts.length; i++) if (k > i * 0.06) segs.push(zig(f.pts[i - 1], f.pts[i], 40));
      c.globalAlpha = pisca;
      for (const sg of segs) { linha(sg, 14, 'rgba(120,200,255,.35)'); linha(sg, 5, '#9fe8ff'); linha(sg, 2, '#ffffff'); }
      for (const q of f.pts) c.drawImage(brilho('rgba(160,230,255,.9)', 48), q.x - 60, q.y - 60, 120, 120);
    } else if (f.tipo === 'geada') {
      c.translate(f.x, f.y); c.globalAlpha = 1 - k;
      c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(170,230,255,.8)', 64), -f.r * 1.4, -f.r * 1.4, f.r * 2.8, f.r * 2.8);
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#e8fbff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, f.r * (0.5 + k * 0.7), 0, 7); c.stroke();
      const rr2 = rng(Math.floor(f.seed * 1e6));
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + rr2() * 0.3, d = f.r * (0.6 + k * 0.6); c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + Math.PI / 2); cristal(c, 0, 10, 26 * (1 - k * 0.4), 7, ['#ffffff', '#bff4ff', '#4aa8d8'], 0); c.restore(); }
    } else if (f.tipo === 'floco') {
      c.globalAlpha = 1 - k; c.fillStyle = '#e8fbff'; c.translate(f.x, f.y); c.rotate(f.t * 6);
      c.fillRect(-f.tam / 2, -0.8, f.tam, 1.6); c.fillRect(-0.8, -f.tam / 2, 1.6, f.tam);
    } else if (f.tipo === 'lanca') {
      // lança de fogo percorre o desenho e deixa um rastro em chamas
      const n = f.pts.length, cab = Math.min(n - 1, Math.floor(clamp(k / 0.35, 0, 1) * (n - 1)));
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
      c.globalAlpha = 1 - clamp((k - 0.35) / 0.65, 0, 1);
      for (const [w, cor] of [[22, 'rgba(255,80,20,.35)'], [10, '#ff7a20'], [4, '#ffe08a']]) {
        c.strokeStyle = cor; c.lineWidth = w; c.beginPath();
        for (let i = 0; i <= cab; i++) { const q = f.pts[i], tw = Math.sin(R.t * 30 + i) * 3; i ? c.lineTo(q.x + tw, q.y - tw) : c.moveTo(q.x, q.y); }
        c.stroke();
      }
      const q = f.pts[cab], ant = f.pts[Math.max(0, cab - 1)], ang = Math.atan2(q.y - ant.y, q.x - ant.x);
      if (k < 0.4) { c.save(); c.translate(q.x, q.y); c.rotate(ang); c.drawImage(brilho('rgba(255,160,60,.95)', 48), -50, -50, 100, 100); c.fillStyle = '#fff2c0'; c.beginPath(); c.moveTo(34, 0); c.lineTo(-10, -9); c.lineTo(-4, 0); c.lineTo(-10, 9); c.closePath(); c.fill(); c.restore(); }
    } else if (f.tipo === 'tiroInimigo') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.lineCap = 'round';
      const mx = lerp(f.x0, f.x1, Math.min(1, k * 3)), my = lerp(f.y0, f.y1, Math.min(1, k * 3));
      c.strokeStyle = f.cor; c.lineWidth = 5; c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(mx, my); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.drawImage(brilho(rgba(f.cor, 0.95), 32), f.x0 - 26, f.y0 - 26, 52, 52);
    } else if (f.tipo === 'explosao') {
      c.translate(f.x, f.y); c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 1 - k; c.drawImage(brilho('rgba(255,170,60,.95)', 64), -f.r * (0.6 + k), -f.r * (0.6 + k), f.r * (1.2 + k * 2), f.r * (1.2 + k * 2));
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) { const a = i * 0.7 + f.r, d = f.r * (0.2 + k * 0.8); c.fillStyle = i % 3 === 0 ? '#ffe08a' : i % 3 === 1 ? '#ff7a20' : '#5a4a40'; c.globalAlpha = (1 - k) * 0.9; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d * 0.7 - k * f.r * 0.4, f.r * 0.25 * (1 - k * 0.5), 0, 7); c.fill(); }
      c.strokeStyle = '#fff2c0'; c.lineWidth = 3 * (1 - k); c.globalAlpha = 1 - k; c.beginPath(); c.arc(0, 0, f.r * (0.4 + k * 1.2), 0, 7); c.stroke();
    } else if (f.tipo === 'racha') {
      const rr2 = rng(Math.floor(f.seed * 1e6)); c.translate(f.x, f.y); c.globalAlpha = 1 - k; c.strokeStyle = '#fff2b0'; c.lineWidth = 3; c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { let x = 0, y = 0, a = rr2() * 7; c.beginPath(); c.moveTo(0, 0); for (let s2 = 0; s2 < 4; s2++) { a += (rr2() - 0.5) * 1.2; x += Math.cos(a) * f.r * 0.25 * Math.min(1, k * 4); y += Math.sin(a) * f.r * 0.25 * Math.min(1, k * 4); c.lineTo(x, y); } c.stroke(); }
    } else if (f.tipo === 'flash') {
      if (espConfig.flashes) { c.globalAlpha = (1 - k) * 0.7; c.fillStyle = f.cor; c.fillRect(0, 0, W, H); }
    } else if (f.tipo.startsWith('esp_')) desenharEspFx(c, f, k);
    c.restore();
  }
  for (const n of R.nums) {
    const k = n.t / 0.9;
    c.save(); c.globalAlpha = 1 - k * k; c.fillStyle = n.cor; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3;
    c.font = `900 ${n.grande ? 24 : 17}px system-ui`; c.textAlign = 'center';
    const y = n.y - k * 40; c.strokeText(n.v, n.x, y); c.fillText(n.v, n.x, y); c.restore();
  }
}
function desenharEspFx(c, f, k) {
  const cl = f.tipo.slice(4);
  const r = rng(Math.floor(f.seed * 1000));
  c.globalCompositeOperation = 'lighter';
  if (cl === 'cavaleiro' || cl === 'lobisomem') {
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = -0.5 + r() * 1.0, y = H * (0.2 + r() * 0.6), d = clamp(k * 3 - i * 0.25, 0, 1);
      if (!d) continue;
      c.save(); c.translate(W / 2, y); c.rotate(a); c.globalAlpha = 1 - k;
      c.strokeStyle = cl === 'lobisomem' ? '#ffb46a' : '#bcd4ff'; c.lineWidth = 10 * (1 - k) + 2;
      c.beginPath(); c.moveTo(-W * 0.7 * d, 0); c.lineTo(W * 0.7 * d, 0); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.restore();
    }
  } else if (cl === 'mago') {
    for (let i = 0; i < 9; i++) {
      const x = W * (0.1 + r() * 0.8), y = H * (0.45 + r() * 0.3), h = H * 0.4 * clamp(k * 3 - i * 0.15, 0, 1);
      c.globalAlpha = 1 - k; cristal(c, x, y, h, h * 0.25, ['#f0e2ff', '#a57bff', '#4a2a9a'], 0);
    }
  } else if (cl === 'vampiro') {
    for (let i = 0; i < 40; i++) {
      const x = r() * W, y = (r() * H * 0.8 + k * H * 0.6) % H;
      c.globalAlpha = 1 - k; c.fillStyle = r() < 0.5 ? '#ff2a4a' : '#9a0020';
      c.beginPath(); c.ellipse(x, y, 3, 10, 0, 0, 7); c.fill();
    }
    c.globalAlpha = (1 - k) * 0.5; c.fillStyle = '#5a0010'; c.fillRect(0, 0, W, H);
  } else if (cl === 'monge') {
    for (let i = 0; i < 18; i++) {
      const x = W * (0.15 + r() * 0.7), y = H * (0.25 + r() * 0.45), d = clamp(k * 4 - i * 0.18, 0, 1);
      if (!d || d >= 1) continue;
      c.globalAlpha = 1 - d; c.strokeStyle = '#ffd24a'; c.lineWidth = 4;
      c.beginPath(); c.arc(x, y, 20 + d * 40, 0, 7); c.stroke();
    }
  } else if (cl === 'padre') {
    for (let i = 0; i < 8; i++) {
      const x = W * (0.1 + i * 0.115), w = 30 + r() * 30;
      c.globalAlpha = (1 - k) * 0.6;
      const g = c.createLinearGradient(x, 0, x, H); g.addColorStop(0, 'rgba(255,240,180,.9)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      c.fillStyle = g; c.fillRect(x - w / 2, 0, w, H);
    }
  }
}
function linhaRuna(c, pts, cor, alfa, larg) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = alfa;
  for (const [w, col] of [[larg * 3.2, rgba(cor, 0.25)], [larg, cor], [larg * 0.35, '#ffffff']]) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
  }
  c.restore();
}
function desenharRastros(c) {
  if (R.runa) {
    const k = R.runa.t / 0.7;
    linhaRuna(c, R.runa.pts, R.runa.cor, 1 - k, 6 + k * 10);
    if (R.runa.nome) {
      const q = R.runa.pts[Math.floor(R.runa.pts.length / 2)];
      c.save(); c.globalAlpha = 1 - k; c.font = '900 20px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = R.runa.cor; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4;
      c.strokeText(R.runa.nome, q.x, q.y - 30 - k * 20); c.fillText(R.runa.nome, q.x, q.y - 30 - k * 20); c.restore();
    }
  }
  if (R.jog[R.euI].classe === 'mago') {
    for (const tq of R.toques.values()) if (tq.dist > 30) {
      linhaRuna(c, tq.path, '#c79bff', 0.9, 5);
      const u = tq.path[tq.path.length - 1];
      if (Math.random() < 0.6) R.fx.push({ tipo: 'p', x: u.x, y: u.y, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, g: 0, t: 0, dur: 0.4, cor: Math.random() < 0.5 ? '#e6d4ff' : '#9ad5ff', tam: 2 + Math.random() * 2 });
    }
  }
  // rastro da lâmina enquanto o dedo arrasta
  if (R.C.gesto !== 'corte') return;
  for (const tq of R.toques.values()) {
    const pts = tq.path.filter(p => R.t - p.t < 0.14);
    if (pts.length < 2) continue;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
    for (let i = 1; i < pts.length; i++) {
      const k = i / pts.length;
      c.strokeStyle = R.C.garras ? `rgba(255,170,80,${k})` : `rgba(160,200,255,${k})`;
      c.lineWidth = 3 + k * 12;
      c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${k})`; c.lineWidth = 2 + k * 3; c.stroke();
    }
    c.restore();
  }
}

// ---------- painéis dos jogadores ----------
const imgsPainel = {};
function imgPainel(classe, sexo) {
  const k = classe + '_' + sexo;
  if (!(k in imgsPainel)) { const i = new Image(); i.src = `sprites/painel_${k}.webp`; imgsPainel[k] = i; i.onerror = () => { imgsPainel[k] = null; }; }
  const i = imgsPainel[k];
  return i && i.complete && i.naturalWidth ? i : null;
}
// cada jogador tem sua faixa da tela (2 jogadores: metades; 3: terços…); o retrato fica embaixo dela
function retPainel(i) {
  const n = R.jog.length;
  if (i < 0 || i >= n) return null;
  const ph = Math.min(H * (n > 2 ? 0.25 : 0.32), 230), pw = ph * 0.75, m = 10;
  const x = n === 1 || i === 0 ? m : i === n - 1 ? W - m - pw : faixaX(i) - pw / 2;
  return { x, y: H - ph - m, w: pw, h: ph };
}
function desenharPaineis(c) {
  for (const j of R.jog) {
    const r = retPainel(j.i); if (!r) continue;
    const C = CT[j.classe] || CT.cavaleiro;
    c.save();
    const sh = j.tremor ? (Math.random() - 0.5) * 8 * j.tremor : 0;
    c.translate(sh, 0);
    // moldura
    rr(c, r.x, r.y, r.w, r.h, 10);
    c.fillStyle = 'rgba(10,6,24,.72)'; c.fill();
    c.save(); c.clip();
    const img = imgPainel(j.classe, j.sexo) || retratoDe(j.classe, j.sexo);
    // movimento do herói ligado à ação (até termos o vídeo dos braços)
    const p = j.pose; let dx = 0, dy = 0, rot = 0, esc = 1;
    if (p) {
      const k = clamp(p.t / 0.22, 0, 1), e = Math.sin(k * Math.PI);
      if (p.tipo === 'corte') { dx = Math.cos(p.ang || 0) * 14 * e; dy = Math.sin(p.ang || 0) * 8 * e; rot = (Math.cos(p.ang || 0) > 0 ? 0.08 : -0.08) * e; }
      else if (p.tipo === 'tiro' || p.tipo === 'soco') { const ax = (p.x * W) - (r.x + r.w / 2), ay = (p.y * H) - (r.y + r.h / 2), m = Math.hypot(ax, ay) || 1; dx = ax / m * 9 * e; dy = ay / m * 6 * e; esc = 1 + 0.04 * e; }
      else if (p.tipo === 'dano') { dx = -10 * e; rot = -0.06 * e; }
      else if (p.tipo === 'recarga') { dy = 12 * e; rot = 0.05 * e; }
      else if (p.tipo === 'cura') esc = 1 + 0.05 * e;
    }
    const resp = Math.sin(R.t * 2.2 + j.i) * 2;
    if (img) {
      const ih = r.h * 1.06 * esc, iw = ih * img.naturalWidth / img.naturalHeight;
      c.translate(r.x + r.w / 2 + dx, r.y + r.h + resp + dy); c.rotate(rot);
      if (!j.vivo) c.filter = 'grayscale(1) brightness(.5)';
      c.drawImage(img, -iw / 2, -ih, iw, ih);
      c.filter = 'none';
    } else {
      c.translate(r.x + r.w / 2 + dx, r.y + r.h * 0.95 + dy);
      const pose = calcularPose({ anim: 'parado', animT: R.t, vx: 0, vy: 0, noChao: true, d: 1, atk: null, classe: j.classe }, R.t);
      c.scale(r.h / 110, r.h / 110);
      desenharHeroi(c, j.classe, j.sexo, pose, R.t);
    }
    c.restore();
    // brilho da ação
    if (p && p.t < 0.25) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - p.t / 0.25;
      const corA = p.tipo === 'dano' ? 'rgba(255,40,60,.9)' : p.tipo === 'cura' ? 'rgba(255,240,170,.9)' : rgba(C.cor, 0.9);
      c.drawImage(brilho(corA, 48), r.x - 10, r.y - 10, r.w + 20, r.h + 20); c.restore();
    }
    // borda na cor do jogador
    rr(c, r.x, r.y, r.w, r.h, 10);
    c.lineWidth = 3; c.strokeStyle = j.cor; c.stroke();
    // nome e vida
    c.font = '700 12px system-ui'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.fillText((j.nome || 'Herói').slice(0, 12), r.x + 8, r.y + 16);
    const hb = { x: r.x + 6, y: r.y + r.h - 14, w: r.w - 12, h: 8 };
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(hb.x - 1, hb.y - 1, hb.w + 2, hb.h + 2);
    c.fillStyle = j.hp / j.mhp > 0.3 ? '#ff5a7a' : '#ff2a2a'; c.fillRect(hb.x, hb.y, hb.w * clamp(j.hp / j.mhp, 0, 1), hb.h);
    if (!j.vivo) { c.fillStyle = '#ff8a9a'; c.font = '900 16px system-ui'; c.textAlign = 'center'; c.fillText('CAÍDO', r.x + r.w / 2, r.y + r.h / 2); }
    // feitiços do mago (recarga)
    if (j.i === R.euI && j.classe === 'mago') {
      const ic = [['raio', '⚡'], ['gelo', '❄'], ['fogo', '🔥']];
      ic.forEach(([k, sym], n) => {
        const x = r.x + r.w - 14, y = r.y + 30 + n * 24, cd = R.feitCd[k] / FEIT[k].cd;
        c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill();
        c.font = '12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = cd > 0 ? 0.35 : 1; c.fillText(sym, x, y + 1); c.globalAlpha = 1;
        if (cd > 0) { c.strokeStyle = FEIT[k].cor; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd)); c.stroke(); }
        c.textBaseline = 'alphabetic';
      });
    }
    // fé (padre) e escudo (defesa)
    const eu = j.i === R.euI;
    const cg = eu ? R.cargas : j.cargas;
    if (eu ? R.guardaT > 0 : j.guarda) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8;
      c.drawImage(brilho('rgba(150,210,255,.9)', 64), r.x - 14, r.y - 14, r.w + 28, r.h + 28);
      c.globalCompositeOperation = 'source-over'; c.strokeStyle = '#cfe9ff'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(r.x + r.w / 2, r.y + r.h * 0.25); c.lineTo(r.x + r.w * 0.78, r.y + r.h * 0.35); c.lineTo(r.x + r.w * 0.72, r.y + r.h * 0.65); c.lineTo(r.x + r.w / 2, r.y + r.h * 0.78); c.lineTo(r.x + r.w * 0.28, r.y + r.h * 0.65); c.lineTo(r.x + r.w * 0.22, r.y + r.h * 0.35); c.closePath(); c.stroke();
      c.restore();
    }
    if (C.gesto === 'cura' && cg != null) {
      for (let k = 0; k < C.cargas; k++) { c.fillStyle = k < cg ? '#ffe9a0' : 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(hb.x + 6 + k * 14, hb.y - 7, 4.5, 0, 7); c.fill(); }
    }
    // perigo: algo vindo pra este jogador
    let perigo = 0;
    for (const q of R.proj.values()) if (q.alvo === j.i) perigo = Math.max(perigo, clamp(q.tt / q.dur, 0, 1));
    for (const en of R.ini.values()) if (en.alvo === j.i && en.estado === 'prepara' && en.papel === 'perto') perigo = Math.max(perigo, 0.7);
    if (perigo > 0.5) { rr(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 12); c.strokeStyle = `rgba(255,50,70,${(perigo - 0.5) * 2 * (0.6 + 0.4 * Math.sin(R.t * 20))})`; c.lineWidth = 4; c.stroke(); }
    c.restore();
  }
  // botão do especial (só o meu)
  const b = botaoEsp();
  c.save();
  c.fillStyle = 'rgba(10,6,24,.75)'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
  c.strokeStyle = R.C.cor; c.lineWidth = 4;
  c.beginPath(); c.arc(b.x, b.y, b.r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * R.esp / 100); c.stroke();
  c.fillStyle = R.esp >= 100 ? '#fff' : 'rgba(255,255,255,.5)'; c.font = '900 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (R.esp >= 100) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.5 * Math.sin(R.t * 8); c.drawImage(brilho(rgba(R.C.cor, 0.9), 48), b.x - b.r * 1.6, b.y - b.r * 1.6, b.r * 3.2, b.r * 3.2); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  c.fillText('ESP', b.x, b.y);
  c.restore();
}
function botaoEsp() { const r = retPainel(R.euI); const dir = r.x + r.w / 2 < W * 0.6; return { x: dir ? r.x + r.w + 34 : r.x - 34, y: r.y + r.h - 34, r: 26 }; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function desenharHud(c) {
  c.save();
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '700 14px system-ui';
  const emDuelo = [...R.ini.values()].some(e => e.duelo && e.estado !== 'morto');
  c.globalAlpha = 0.85; if (!emDuelo) c.fillText(`Fase ${R.fase + 1} · ${R.bioma.nome}`, W / 2, 24);
  c.font = '900 16px system-ui'; c.textAlign = 'right'; c.fillText(String(R.placar).padStart(6, '0'), W - 70, 24);
  c.globalAlpha = 1;
  if (R.cmb.n >= 3) {
    c.textAlign = 'right'; c.font = `900 ${Math.round(22 + 8 * R.cmb.pulso)}px system-ui`;
    c.fillStyle = '#ffe9a0'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4;
    c.strokeText(`${R.cmb.n} HITS`, W - 70, 54); c.fillText(`${R.cmb.n} HITS`, W - 70, 54);
  }
  const du = [...R.ini.values()].find(e => e.duelo && e.estado !== 'morto');
  if (du) {
    const bw = Math.min(W * 0.5, 420), bx = W / 2 - bw / 2, by = 24;
    const nome = du.duelo === 'chefe' ? FASES[R.fase].nomeChefe : FASES[R.fase].nomeMini;
    c.textAlign = 'center'; c.font = '900 13px Georgia, serif'; c.fillStyle = du.duelo === 'chefe' ? '#ff8fd6' : '#ffd27a';
    c.fillText(nome.toUpperCase(), W / 2, by - 4);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 2, by, bw + 4, 18);
    c.fillStyle = du.duelo === 'chefe' ? '#ff4fc8' : '#ff7a3a'; c.fillRect(bx, by + 2, bw * clamp(du.hp / du.mhp, 0, 1), 8);
    if (du.vulnT > 0) { c.fillStyle = `rgba(255,240,170,${0.6 + 0.4 * Math.sin(R.t * 12)})`; c.fillRect(bx, by + 12, bw * clamp(du.vulnT / 4.5, 0, 1), 4); }
    c.font = '700 10px system-ui'; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillText(du.vulnT > 0 ? 'EXPOSTO — ataquem os pontos fracos!' : du.estado === 'prepara' ? 'VAI ATACAR — apare ou defenda!' : '', W / 2, by + 30);
    if (R.dicaDuelo > 0) {
      c.globalAlpha = clamp(R.dicaDuelo, 0, 1); c.font = '600 13px system-ui';
      const txt = 'Ele quase não sente golpe. Espere o ataque: APARE (espada/monge), DERRUBE o arremesso (magia) ou toque no seu retrato pra DEFENDER. Aí ele expõe os PONTOS FRACOS!';
      dicaRodape(c, txt); c.globalAlpha = 1;
    }
  }
  if (R.aviso) {
    const k = R.aviso.t / R.aviso.dur;
    c.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
    c.textAlign = 'center'; c.font = '900 26px system-ui'; c.fillStyle = R.aviso.cor; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 5;
    const y = H * (R.duelo ? 0.4 : 0.3) - Math.min(1, R.aviso.t * 6) * 10;
    c.strokeText(R.aviso.txt, W / 2, y); c.fillText(R.aviso.txt, W / 2, y);
    c.globalAlpha = 1;
  }
  if (R.banner) {
    const k = R.banner.t / 3;
    c.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, H * 0.38, W, 70);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '700 14px system-ui'; c.fillText(`FASE ${R.banner.fase}`, W / 2, H * 0.38 + 24);
    c.font = '900 28px Georgia, serif'; c.fillStyle = R.bioma.luz; c.fillText(R.banner.nome, W / 2, H * 0.38 + 56);
    c.globalAlpha = 1;
  }
  if (R.dicaT > 0 && !R.banner) {
    c.globalAlpha = clamp(R.dicaT, 0, 1);
    dicaRodape(c, R.jog[R.euI].classe === 'mago' ? DICA.mago : DICA[R.C.gesto]);
    c.globalAlpha = 1;
  }
  if (!R.host && !R.solo && R.t - R.ultimaFoto > 2.5 && R.t > 3) { c.fillStyle = '#ffd27a'; c.font = '700 13px system-ui'; c.textAlign = 'center'; c.fillText('esperando o anfitrião…', W / 2, H * 0.5); }
  c.restore();
}
// dica no rodapé, entre os painéis (quebra em duas linhas se precisar)
function dicaRodape(c, txt) {
  const r = retPainel(R.euI);
  const outros = R.jog.filter(j => j.i !== R.euI).map(j => retPainel(j.i).x);
  const esq = r.x + r.w + 70, dir = (outros.length ? Math.min(...outros) : W) - 10;
  const larg = Math.max(160, dir - esq), cx = (esq + dir) / 2;
  c.font = '600 13px system-ui'; c.textAlign = 'center';
  const pal = txt.split(' '), linhas = [''];
  for (const w of pal) { const t = (linhas[linhas.length - 1] + ' ' + w).trim(); if (c.measureText(t).width > larg - 20 && linhas[linhas.length - 1]) linhas.push(w); else linhas[linhas.length - 1] = t; }
  const h = linhas.length * 17 + 10, y = H - 14 - h;
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(cx - larg / 2, y, larg, h);
  c.fillStyle = '#fff'; linhas.forEach((l, i) => c.fillText(l, cx, y + 18 + i * 17));
}
function desenharCutin(c) {
  const k = R.cutin.t, j = R.cutin.j;
  const E = ESPECIAIS[j.classe] || ESPECIAIS.cavaleiro;
  const ent = clamp(k / 0.18, 0, 1), sai = clamp((k - 0.8) / 0.2, 0, 1);
  c.save();
  c.fillStyle = `rgba(0,0,0,${0.55 * (1 - sai)})`; c.fillRect(0, 0, W, H);
  c.translate(W / 2, H / 2); c.rotate(-0.12);
  const bh = H * 0.34;
  c.translate((1 - ent) * -W + sai * W, 0);
  c.fillStyle = E.cor; c.fillRect(-W, -bh / 2, W * 2, bh);
  c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 10; i++) c.fillRect(-W + ((i * 173 + k * 900) % (W * 2)), -bh / 2 + i * bh / 10, 120, 2);
  const img = retratoDe(j.classe, j.sexo);
  if (img) {
    const ph = bh * 1.5, pw = ph * img.naturalWidth / img.naturalHeight;
    c.save(); c.beginPath(); c.rect(-W, -bh / 2 - bh * 0.6, W * 2, bh * 1.1 + bh * 0.6); c.clip();
    c.drawImage(img, -W * 0.36 - pw / 2 + k * 20, bh / 2 - ph, pw, ph); c.restore();
  }
  c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 6;
  let fs = Math.round(bh * 0.24); c.font = `900 ${fs}px Georgia, serif`;
  while (c.measureText(E.nome).width > W * 0.44 && fs > 12) { fs -= 2; c.font = `900 ${fs}px Georgia, serif`; }
  c.textAlign = 'left'; c.strokeText(E.nome, -W * 0.08, bh * 0.08); c.fillText(E.nome, -W * 0.08, bh * 0.08);
  c.font = `700 ${Math.round(fs * 0.45)}px system-ui`; c.fillText(j.nome || nomeClasse(j.classe, j.sexo), -W * 0.08, -bh * 0.18);
  c.restore();
}
