// Movimento com colisão nos blocos. Corpo: x = centro, y = pés, w/h = tamanho.
import { T } from './util.js';
import { bloco } from './nivel.js';

export const GRAV = 2300;

export function moverCorpo(b, dt, nv, voa = false) {
  if (!voa) b.vy = Math.min(b.vy + GRAV * dt * (b.grav ?? 1), 1150);
  const hw = b.w / 2;
  // horizontal
  b.x += b.vx * dt;
  b.parede = 0;
  const y0 = Math.floor((b.y - b.h + 2) / T), y1 = Math.floor((b.y - 2) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + hw) / T);
    for (let ty = y0; ty <= y1; ty++) if (bloco(nv, tx, ty) === 1) { b.x = tx * T - hw - 0.01; b.vx = 0; b.parede = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor((b.x - hw) / T);
    for (let ty = y0; ty <= y1; ty++) if (bloco(nv, tx, ty) === 1) { b.x = (tx + 1) * T + hw + 0.01; b.vx = 0; b.parede = -1; break; }
  }
  // vertical
  const yAntes = b.y;
  b.y += b.vy * dt;
  b.noChao = false;
  const x0 = Math.floor((b.x - hw + 1) / T), x1 = Math.floor((b.x + hw - 1) / T);
  if (b.vy >= 0) {
    const ty = Math.floor(b.y / T);
    for (let tx = x0; tx <= x1; tx++) {
      const k = bloco(nv, tx, ty);
      if (k === 1 || (k === 2 && !b.descer && yAntes <= ty * T + 1)) { b.y = ty * T; b.vy = 0; b.noChao = true; break; }
    }
  } else {
    const ty = Math.floor((b.y - b.h) / T);
    for (let tx = x0; tx <= x1; tx++) if (bloco(nv, tx, ty) === 1) { b.y = (ty + 1) * T + b.h; b.vy = 0; break; }
  }
  // espinhos (metade de baixo do bloco)
  b.espinho = false;
  const tyE = Math.floor((b.y - 4) / T);
  for (let tx = x0; tx <= x1; tx++) if (bloco(nv, tx, tyE) === 3 && b.y - 4 > tyE * T + T * 0.45) b.espinho = true;
}

// tem chão logo à frente? (para os monstros não caírem de beirada)
export function temChaoFrente(b, nv, d) {
  const tx = Math.floor((b.x + d * (b.w / 2 + 6)) / T), ty = Math.floor((b.y + 4) / T);
  const k = bloco(nv, tx, ty);
  return k === 1 || k === 2;
}
export function paredeFrente(b, nv, d) {
  const tx = Math.floor((b.x + d * (b.w / 2 + 4)) / T), ty = Math.floor((b.y - 10) / T);
  return bloco(nv, tx, ty) === 1;
}
export function solido(nv, x, y) { return bloco(nv, Math.floor(x / T), Math.floor(y / T)) === 1; }
