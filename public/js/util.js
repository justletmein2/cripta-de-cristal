// Pequenas ferramentas usadas em todo o jogo.
export const T = 48;                       // tamanho de um bloco do cenário, em pixels do mundo
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sinal = v => v < 0 ? -1 : 1;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// sorteio repetível: a mesma semente gera a mesma fase em todos os celulares
export function rng(semente) {
  let a = (semente >>> 0) || 1;
  const r = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  r.int = (min, max) => min + Math.floor(r() * (max - min + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}
export function hash(n) { return rng(n * 2654435761)(); }

// retângulos se encostam?
export const toca = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// canvas fora da tela (para desenhar uma vez e reaproveitar)
export function tela(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
