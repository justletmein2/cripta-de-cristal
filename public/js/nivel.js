// Gera as fases (sempre a mesma fase para a mesma semente, então todo mundo vê igual).
// Blocos: 0 vazio, 1 pedra, 2 plataforma (dá pra subir por baixo), 3 espinhos de cristal
import { T, rng, hash } from './util.js';

export const BIOMAS = [
  { tema: 'cristal', nome: 'Catacumbas Prismáticas', ceu: ['#07051a', '#1d1150', '#4a2381'], cristal: ['#c79bff', '#7c4dff', '#3b1d8f'], pedra: ['#2b2547', '#1a1630', '#3d3563'], topo: '#8f7bd8', luz: '#b48cff', bruma: 'rgba(120,80,220,.18)' },
  { tema: 'cristal', nome: 'Jardins de Quartzo', ceu: ['#03121a', '#0b3442', '#1f6a6e'], cristal: ['#9fffe9', '#2fd6c0', '#106a6a'], pedra: ['#1f3338', '#12221f', '#2d4a4c'], topo: '#6fe0b5', luz: '#7dffd8', bruma: 'rgba(60,200,180,.16)' },
  { tema: 'cristal', nome: 'Cidadela Celeste', ceu: ['#0a0c24', '#25306b', '#7a6bb8'], cristal: ['#fff2b8', '#ffc94d', '#b5751c'], pedra: ['#3a3550', '#24203a', '#575073'], topo: '#e8d08a', luz: '#ffe28a', bruma: 'rgba(255,210,120,.13)' },
  { tema: 'cristal', nome: 'Trono do Prisma', ceu: ['#12030f', '#3d0b3a', '#8a1f6a'], cristal: ['#ffb3ec', '#ff4fc8', '#8a1270'], pedra: ['#2e1a33', '#1b0f20', '#46284d'], topo: '#ff8fd6', luz: '#ff7ad9', bruma: 'rgba(255,80,200,.15)' },
];
// fases temáticas (sorteadas a cada andar)
export const TEMAS = [
  { tema: 'gotico', nome: 'Castelo Carmesim', ceu: ['#0a0208', '#2a0614', '#5a0f22'], cristal: ['#ff9aa8', '#d6233f', '#5a0a18'], pedra: ['#2a2228', '#16101a', '#3a3038'], topo: '#8a3a4a', luz: '#ff5a6a', bruma: 'rgba(200,30,60,.15)' },
  { tema: 'londres', nome: 'Londres Enevoada', ceu: ['#05100f', '#163330', '#3f6158'], cristal: ['#ffe2a0', '#e8a93a', '#7a5418'], pedra: ['#3a2e2c', '#1e1817', '#4e403b'], topo: '#7aa69a', luz: '#ffcf7a', bruma: 'rgba(170,200,190,.22)' },
  { tema: 'egito', nome: 'Tumba de Anúbis', ceu: ['#070a22', '#1f2a5a', '#c77a3a'], cristal: ['#9ff5ea', '#2fa8a0', '#11524d'], pedra: ['#8a6a44', '#4a3820', '#a8865a'], topo: '#e8c27a', luz: '#ffd27a', bruma: 'rgba(230,180,110,.15)' },
];
export const ANDARES_POR_CICLO = 4;      // 3 fases + chefe
export const ehChefe = andar => andar % ANDARES_POR_CICLO === 0;
// cada ciclo termina com um chefão diferente (Conde → Lorde Engrenagem → Anúbis → Guardião, e recomeça)
const CHEFES = [{ tipo: 'conde', tema: 'gotico' }, { tipo: 'engrenagem', tema: 'londres' }, { tipo: 'anubis', tema: 'egito' }, { tipo: 'chefe', tema: 'cristal' }];
export const chefeDo = andar => CHEFES[(Math.floor(andar / ANDARES_POR_CICLO) - 1) % CHEFES.length];
const SORTEIO = [[BIOMAS[0], 1], [BIOMAS[1], 1], [BIOMAS[2], 1], [TEMAS[0], 2], [TEMAS[1], 2], [TEMAS[2], 2]];
export function biomaDo(andar, semente = 1) {
  if (ehChefe(andar)) { const ch = chefeDo(andar); return ch.tema === 'cristal' ? BIOMAS[3] : TEMAS.find(b => b.tema === ch.tema); }
  const tot = SORTEIO.reduce((a, b) => a + b[1], 0);
  let v = hash(semente * 7 + andar * 131) * tot;
  for (const [b, p] of SORTEIO) if ((v -= p) < 0) return b;
  return BIOMAS[0];
}

// monstros de cada tema (tipo, peso); os pesados aparecem menos no primeiro andar do ciclo
const TIPOS_TEMA = {
  cristal: [['esqueleto', 4], ['morcego', 3], ['conjurador', 2], ['golem', 2]],
  gotico: [['esqueleto', 3], ['morcego', 3], ['gargula', 3], ['cavaleiroSombrio', 3], ['conjurador', 1]],
  londres: [['assassino', 3], ['automato', 2], ['esqueleto', 2], ['morcego', 2], ['conjurador', 2]],
  egito: [['mumia', 3], ['escaravelho', 3], ['conjurador', 2], ['esqueleto', 1], ['golem', 1]],
};
const PESADOS = ['golem', 'automato', 'cavaleiroSombrio'];
export function tiposDoTema(tema, andar) {
  const nivel = ((andar - 1) % ANDARES_POR_CICLO) + 1;
  return (TIPOS_TEMA[tema] || TIPOS_TEMA.cristal).map(([t, p]) => [t, PESADOS.includes(t) && nivel === 1 ? p * 0.5 : p]);
}

// gera e confere se dá pra chegar no fim; se não der, tenta outra variação (sempre igual pra todos)
export function gerarNivel(semente, andar) {
  for (let t = 0; t < 12; t++) {
    const nv = gerarNivelBruto(semente + t * 7717, andar);
    nv.semente = semente;
    if (nv.chefe || alcancavel(nv)) return nv;
  }
  return gerarNivelBruto(semente, andar);
}

// confere se existe caminho do começo até o portal (pulo de ~3 blocos de altura e ~5 de distância)
export function alcancavel(nv) {
  const vazio = (x, y) => bloco(nv, x, y) === 0;
  const pe = (x, y) => x > 0 && x < nv.w - 1 && y > 1 && vazio(x, y) && vazio(x, y - 1) && (bloco(nv, x, y + 1) === 1 || bloco(nv, x, y + 1) === 2);
  const ini = [Math.floor(nv.inicio.x / T), Math.floor(nv.inicio.y / T) - 1];
  const fimX = nv.portal ? Math.floor(nv.portal.x / T) : nv.w - 3;
  const vis = new Set([ini + '']), fila = [ini];
  while (fila.length) {
    const [x, y] = fila.pop();
    if (x >= fimX) return true;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -3; dy <= 10; dy++) {
      const nx = x + dx, ny = y + dy;
      if (!pe(nx, ny) || vis.has(nx + ',' + ny)) continue;
      let ok = true;
      const p = dx > 0 ? 1 : -1;
      for (let xi = x; dx && xi !== nx + p && ok; xi += p) {
        const y0 = Math.max(1, Math.min(y, ny) - 1 - (Math.abs(dx) >= 3 || dy < 0 ? 1 : 0));
        for (let yy = y0; yy <= Math.min(y, ny); yy++) if (bloco(nv, xi, yy) === 1 || bloco(nv, xi, yy) === 3) ok = false;
      }
      if (!dx) for (let yy = ny - 1; yy <= y; yy++) if (bloco(nv, x, yy) === 1) ok = false;
      if (ok) { vis.add(nx + ',' + ny); fila.push([nx, ny]); }
    }
  }
  return false;
}

function gerarNivelBruto(semente, andar) {
  const r = rng(semente * 977 + andar * 131);
  const H = 26;
  const chefe = ehChefe(andar);
  const W = chefe ? 64 : 150 + Math.min(60, andar * 10);
  const tiles = new Uint8Array(W * H);
  const chao = new Int16Array(W).fill(H - 6);   // linha do topo do chão por coluna
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = v; };
  const spawns = [], enfeites = [], arenas = [], objetos = [], armadilhas = [];
  let nid = 1, oid = 1;
  const tema = biomaDo(andar, semente).tema;
  const TIPO_ARM = { gotico: 'pendulo', londres: 'vapor', egito: 'dardo', cristal: 'espinho' }[tema] || 'espinho';
  const temMercador = !chefe && r.chance(0.6);
  let mercadorFeito = false, desafioFeito = false;
  const obj = (t, x, y, extra = {}) => objetos.push({ id: oid++, t, x: x * T + T / 2, y: y * T, ...extra });
  const inimigo = (tipo, x, y) => {
    if (tipo === 'escaravelho') { for (let k = -1; k <= 1; k++) spawns.push({ id: nid++, tipo, x: x * T + T / 2 + k * 30, y: y * T }); return; }
    spawns.push({ id: nid++, tipo, x: x * T + T / 2, y: y * T });
  };
  const pesos = tiposDoTema(biomaDo(andar, semente).tema, andar);
  const sortearTipo = () => {
    let tot = pesos.reduce((s, p) => s + p[1], 0), v = r() * tot;
    for (const [t, p] of pesos) { if ((v -= p) < 0) return t; }
    return pesos[0][0];
  };
  const plataforma = (x0, x1, y) => { for (let x = x0; x <= x1; x++) if (!tiles[y * W + x]) set(x, y, 2); };

  if (chefe) {
    const g = H - 6;
    chao.fill(g);
    plataforma(10, 15, g - 4); plataforma(W - 16, W - 11, g - 4); plataforma(27, 36, g - 7);
    const ch = chefeDo(andar);
    spawns.push({ id: nid++, tipo: ch.tipo, x: (W - 18) * T, y: (g - 1) * T });
    if (ch.tema === 'cristal') enfeites.push({ t: 'trono', x: (W / 2) * T, y: g * T });
    else for (const tx of [6, 20, 44, 58]) enfeites.push({ t: 'tocha', x: tx * T, y: (g - 2) * T });
    if (ch.tema !== 'cristal') enfeites.push({ t: 'estandarte', x: 24 * T, y: (g - 12) * T }, { t: 'estandarte', x: 40 * T, y: (g - 12) * T });
  } else {
    let g = H - 7, x = 0;
    const ir = (n, alt) => { for (let i = 0; i < n && x < W; i++) chao[x++] = alt; };
    ir(10, g);
    const fim = W - 14;
    while (x < fim) {
      const tipo = r.pick(['plano', 'plano', 'degrau', 'degrau', 'fosso', 'torre', 'arena', 'pontes']);
      if (tipo === 'plano') {
        const n = r.int(6, 11), x0 = x; ir(n, g);
        if (temMercador && !mercadorFeito && x0 > W * 0.4 && n >= 7) {
          // parada do mercador: sem monstros aqui
          mercadorFeito = true; obj('mercador', x0 + 3, g);
          enfeites.push({ t: 'tocha', x: (x0 + 1) * T, y: (g - 2) * T });
          continue;
        }
        if (r.chance(0.75)) inimigo(sortearTipo(), x0 + r.int(2, n - 2), g - 1);
        if (n >= 8 && r.chance(0.35)) inimigo(sortearTipo(), x0 + n - 2, g - 1);
        if (r.chance(0.45)) { const px = x0 + r.int(1, Math.max(1, n - 5)); plataforma(px, px + r.int(2, 4), g - 3); if (r.chance(0.5)) inimigo('morcego', px + 1, g - 6); }
        const sorte = r();
        if (sorte < 0.45 && n >= (TIPO_ARM === 'dardo' ? 8 : 6)) {
          // armadilha do tema
          const ax = TIPO_ARM === 'dardo' ? x0 + n - 1 : x0 + Math.floor(n / 2);
          armadilhas.push({ id: armadilhas.length + 1, t: TIPO_ARM, x: ax * T + T / 2, y: g * T, tx: ax, d: -1, fase: r() * 3 });
        } else if (sorte < 0.66) {
          obj('barril', x0 + r.int(1, n - 2), g);
          if (r.chance(0.4)) obj('barril', x0 + n - 1, g);
        } else if (sorte < 0.82) {
          // prisioneiro numa jaula, com um guarda do lado
          obj('jaula', x0 + n - 3, g, { v: r.int(0, 2) });
          inimigo(sortearTipo(), x0 + n - 5, g - 1);
        }
      } else if (tipo === 'degrau') {
        g = Math.max(9, Math.min(H - 4, g + r.pick([-2, -1, 1, 2])));
        const n = r.int(4, 8), x0 = x; ir(n, g);
        if (r.chance(0.55)) inimigo(sortearTipo(), x0 + Math.floor(n / 2), g - 1);
      } else if (tipo === 'fosso') {
        const n = r.int(2, 4), x0 = x;
        ir(n, H - 2);   // buraco com espinhos
        if (n >= 4) plataforma(x0 + 1, x0 + 2, g - 1);
        ir(r.int(3, 5), g);
      } else if (tipo === 'torre') {
        const sobe = r.int(4, 6), n = r.int(7, 11), x0 = x;
        // escada de plataformas até o alto
        plataforma(x0 - 4, x0 - 2, g - 2); if (sobe > 4) plataforma(x0 - 2, x0, g - 4);
        g = Math.max(8, g - sobe); ir(n, g);
        inimigo(r.chance(0.5) ? 'conjurador' : sortearTipo(), x0 + Math.floor(n / 2), g - 1);
        enfeites.push({ t: 'estandarte', x: (x0 + 1) * T, y: (g - 4) * T });
        if (r.chance(0.5)) obj('bau', x0 + n - 2, g);   // prêmio de quem subiu
        // descida com degraus
        const desce = r.int(2, 5); g = Math.min(H - 4, g + desce); ir(2, g);
      } else if (tipo === 'arena') {
        const n = r.int(14, 18), x0 = x; ir(n, g);
        const q = r.int(3, 4);
        const desafio = !desafioFeito && r.chance(0.55);
        if (desafio) { desafioFeito = true; obj('bau', x0 + n - 2, g, { tranc: true, arena: arenas.length }); }
        arenas.push({ x0: x0 * T, x1: (x0 + n) * T, y: g * T, desafio });
        if (r.chance(0.5)) obj('barril', x0 + 2, g);
        for (let i = 0; i < q; i++) inimigo(sortearTipo(), x0 + 3 + Math.floor((n - 6) * i / Math.max(1, q - 1)), g - 1);
        plataforma(x0 + 4, x0 + 8, g - 3); plataforma(x0 + n - 9, x0 + n - 5, g - 5);
        enfeites.push({ t: 'tocha', x: (x0 + 2) * T, y: (g - 2) * T }, { t: 'tocha', x: (x0 + n - 2) * T, y: (g - 2) * T });
      } else if (tipo === 'pontes') {
        // sequência de plataformas sobre um abismo raso de espinhos
        const n = r.int(9, 13), x0 = x;
        ir(n, H - 2);
        for (let px = x0 + 1, i = 0; px < x0 + n - 2; px += 4, i++) plataforma(px, px + 1, g - (i % 2));
        if (r.chance(0.6)) inimigo('morcego', x0 + Math.floor(n / 2), g - 4);
        ir(3, g);
      }
    }
    // zona final sempre plana e segura (é onde fica o portal): o último trecho (fosso, pontes...)
    // podia passar do limite e jogar o portal no fundo de um buraco com espinhos
    for (let k = fim; k < W; k++) chao[k] = g;
    x = W;
    for (let i = armadilhas.length - 1; i >= 0; i--) if (armadilhas[i].tx >= fim - 2) armadilhas.splice(i, 1);
    for (let i = objetos.length - 1; i >= 0; i--) if ((objetos[i].t === 'barril' || objetos[i].t === 'jaula') && objetos[i].x >= (fim - 1) * T) objetos.splice(i, 1);
    // plataformas soltas que sobraram em cima da zona final
    for (let k = fim; k < W; k++) for (let y = 0; y < H; y++) if (tiles[y * W + k] === 2) tiles[y * W + k] = 0;
  }

  // preenche chão, teto e paredes
  for (let x = 0; x < W; x++) {
    const g = chao[x];
    for (let y = g; y < H; y++) set(x, y, 1);
    if (g >= H - 2) set(x, g - 1, 3);
  }
  // teto: segue o chão de longe (caverna), sem apertar as plataformas
  // piso de cada coluna = chão (se não for buraco) ou a plataforma mais alta; buraco sem plataforma herda o vizinho
  const piso = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    let p = chao[x] >= H - 2 ? 99 : chao[x];
    for (let y = 0; y < H; y++) if (tiles[y * W + x] === 2) { p = Math.min(p, y); break; }
    piso[x] = p;
  }
  for (let x = 0; x < W; x++) if (piso[x] === 99) {
    let a = x, b = x;
    while (a > 0 && piso[a] === 99) a--;
    while (b < W - 1 && piso[b] === 99) b++;
    piso[x] = Math.min(piso[a] === 99 ? H - 7 : piso[a], piso[b] === 99 ? H - 7 : piso[b]);
  }
  // teto: fica sempre bem acima do piso mais alto por perto (nunca vira parede que fecha a passagem)
  for (let x = 0; x < W; x++) {
    let alto = 99;
    for (let k = -5; k <= 5; k++) { const xx = x + k; if (xx >= 0 && xx < W) alto = Math.min(alto, piso[xx]); }
    const teto = Math.max(0, alto - 8 - (Math.sin(x * 0.45) > 0.6 ? 1 : 0));
    for (let y = 0; y < teto; y++) set(x, y, 1);
  }
  for (let y = 0; y < H; y++) { set(0, y, 1); set(W - 1, y, 1); }

  // enfeites: cristais no chão e no teto
  for (let x = 2; x < W - 2; x++) {
    if (r.chance(0.13) && tiles[(chao[x] - 1) * W + x] === 0) enfeites.push({ t: 'cristal', x: x * T + r() * T, y: chao[x] * T, s: 0.6 + r() * 0.8, v: r() });
    if (r.chance(0.1)) {
      let y = 0; while (y < H && tiles[y * W + x] === 1) y++;
      if (y > 0 && y < H - 4) enfeites.push({ t: 'estalactite', x: x * T + r() * T, y: y * T, s: 0.5 + r() * 0.9, v: r() });
    }
    if (!chefe && r.chance(0.035)) enfeites.push({ t: 'corrente', x: x * T + T / 2, y: 0, s: 2 + r.int(1, 5) });
  }

  // pêndulos ficam pendurados no teto
  for (const a of armadilhas) if (a.t === 'pendulo') {
    let y = 0; while (y < H && tiles[y * W + a.tx] === 1) y++;
    a.ay = y * T; a.L = Math.max(80, a.y - 56 - a.ay); a.amp = Math.min(0.95, Math.max(0.35, 170 / a.L));
  }
  const gi = chao[3];
  const gf = chao[W - 6];
  return {
    w: W, h: H, tiles, chao, spawns, enfeites, arenas, objetos, armadilhas, chefe, andar,
    bioma: biomaDo(andar, semente),
    inicio: { x: 3 * T, y: gi * T },
    portal: chefe ? null : { x: (W - 6) * T, y: gf * T },
    semente,
  };
}

export const bloco = (nv, tx, ty) => (tx < 0 || tx >= nv.w) ? 1 : (ty < 0 ? 0 : ty >= nv.h ? 1 : nv.tiles[ty * nv.w + tx]);
