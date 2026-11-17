// Gera as fases (sempre a mesma fase para a mesma semente, então todo mundo vê igual).
// Blocos: 0 vazio, 1 pedra, 2 plataforma (dá pra subir por baixo), 3 espinhos de cristal
import { T, rng } from './util.js';

export const BIOMAS = [
  { nome: 'Catacumbas Prismáticas', ceu: ['#07051a', '#1d1150', '#4a2381'], cristal: ['#c79bff', '#7c4dff', '#3b1d8f'], pedra: ['#2b2547', '#1a1630', '#3d3563'], topo: '#8f7bd8', luz: '#b48cff', bruma: 'rgba(120,80,220,.18)' },
  { nome: 'Jardins de Quartzo', ceu: ['#03121a', '#0b3442', '#1f6a6e'], cristal: ['#9fffe9', '#2fd6c0', '#106a6a'], pedra: ['#1f3338', '#12221f', '#2d4a4c'], topo: '#6fe0b5', luz: '#7dffd8', bruma: 'rgba(60,200,180,.16)' },
  { nome: 'Cidadela Celeste', ceu: ['#0a0c24', '#25306b', '#7a6bb8'], cristal: ['#fff2b8', '#ffc94d', '#b5751c'], pedra: ['#3a3550', '#24203a', '#575073'], topo: '#e8d08a', luz: '#ffe28a', bruma: 'rgba(255,210,120,.13)' },
  { nome: 'Trono do Prisma', ceu: ['#12030f', '#3d0b3a', '#8a1f6a'], cristal: ['#ffb3ec', '#ff4fc8', '#8a1270'], pedra: ['#2e1a33', '#1b0f20', '#46284d'], topo: '#ff8fd6', luz: '#ff7ad9', bruma: 'rgba(255,80,200,.15)' },
];
export const ANDARES_POR_CICLO = 4;      // 3 fases + chefe
export const ehChefe = andar => andar % ANDARES_POR_CICLO === 0;
export const biomaDo = andar => BIOMAS[(andar - 1) % ANDARES_POR_CICLO];

const TIPOS_POR_ANDAR = {
  1: [['esqueleto', 5], ['morcego', 3], ['conjurador', 1]],
  2: [['esqueleto', 4], ['morcego', 3], ['conjurador', 2], ['golem', 2]],
  3: [['esqueleto', 3], ['morcego', 3], ['conjurador', 3], ['golem', 3]],
};

export function gerarNivel(semente, andar) {
  const r = rng(semente * 977 + andar * 131);
  const H = 26;
  const chefe = ehChefe(andar);
  const W = chefe ? 64 : 150 + Math.min(60, andar * 10);
  const tiles = new Uint8Array(W * H);
  const chao = new Int16Array(W).fill(H - 6);   // linha do topo do chão por coluna
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = v; };
  const spawns = [], enfeites = [];
  let nid = 1;
  const inimigo = (tipo, x, y) => spawns.push({ id: nid++, tipo, x: x * T + T / 2, y: y * T });
  const pesos = TIPOS_POR_ANDAR[((andar - 1) % ANDARES_POR_CICLO) + 1] || TIPOS_POR_ANDAR[3];
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
    spawns.push({ id: nid++, tipo: 'chefe', x: (W - 18) * T, y: (g - 1) * T });
    enfeites.push({ t: 'trono', x: (W / 2) * T, y: g * T });
  } else {
    let g = H - 7, x = 0;
    const ir = (n, alt) => { for (let i = 0; i < n && x < W; i++) chao[x++] = alt; };
    ir(10, g);
    const fim = W - 14;
    while (x < fim) {
      const tipo = r.pick(['plano', 'plano', 'degrau', 'degrau', 'fosso', 'torre', 'arena', 'pontes']);
      if (tipo === 'plano') {
        const n = r.int(6, 11), x0 = x; ir(n, g);
        if (r.chance(0.55)) inimigo(sortearTipo(), x0 + r.int(2, n - 2), g - 1);
        if (r.chance(0.45)) { const px = x0 + r.int(1, Math.max(1, n - 5)); plataforma(px, px + r.int(2, 4), g - 3); if (r.chance(0.5)) inimigo('morcego', px + 1, g - 6); }
      } else if (tipo === 'degrau') {
        g = Math.max(9, Math.min(H - 4, g + r.pick([-2, -1, 1, 2])));
        const n = r.int(4, 8), x0 = x; ir(n, g);
        if (r.chance(0.4)) inimigo(sortearTipo(), x0 + Math.floor(n / 2), g - 1);
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
        // descida com degraus
        const desce = r.int(2, 5); g = Math.min(H - 4, g + desce); ir(2, g);
      } else if (tipo === 'arena') {
        const n = r.int(14, 18), x0 = x; ir(n, g);
        const q = r.int(2, 4);
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
    while (x < W) chao[x++] = g;
  }

  // preenche chão, teto e paredes
  for (let x = 0; x < W; x++) {
    const g = chao[x];
    for (let y = g; y < H; y++) set(x, y, 1);
    if (g >= H - 2) set(x, g - 1, 3);
  }
  // teto: segue o chão de longe (caverna), sem apertar as plataformas
  for (let x = 0; x < W; x++) {
    let alto = chao[x];
    for (let y = 0; y < H; y++) if (tiles[y * W + x] === 2) { alto = Math.min(alto, y); break; }
    for (let k = -3; k <= 3; k++) { const xx = x + k; if (xx >= 0 && xx < W) alto = Math.min(alto, chao[xx] >= H - 2 ? alto : chao[xx]); }
    const teto = Math.max(0, alto - 9 - (Math.sin(x * 0.45) > 0.6 ? 1 : 0));
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

  const gi = chao[3];
  const gf = chao[W - 6];
  return {
    w: W, h: H, tiles, chao, spawns, enfeites, chefe, andar,
    bioma: biomaDo(andar),
    inicio: { x: 3 * T, y: gi * T },
    portal: chefe ? null : { x: (W - 6) * T, y: gf * T },
    semente,
  };
}

export const bloco = (nv, tx, ty) => (tx < 0 || tx >= nv.w) ? 1 : (ty < 0 ? 0 : ty >= nv.h ? 1 : nv.tiles[ty * nv.w + tx]);
