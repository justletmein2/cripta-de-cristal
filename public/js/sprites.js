// Heróis desenhados com arte pronta (folhas de sprite). Quem não tem arte ainda usa o boneco de código.
// Arte do Cavaleiro/Cavaleira: pacotes "Anime Hero" e "Anime Swordswoman" de reinvogames (itch.io),
// montados com ferramentas/montar_sprites.py.
import { clamp } from './util.js';

const K = 0.7;    // pixels do mundo por pixel da folha (herói com ~110px de altura)

// quadros especiais de cada folha
const DEFS = {
  // combo: cada golpe toca só um trecho da folha [início, impacto, fim], pra emendar sem voltar à pose parada
  cavaleiro_m: { pulo: [6, 7, 8, 9, 10, 11], golpe: { atk1: 7, atk2: 6 },
    combo: [['atk1', 3, 7, 9], ['atk2', 3, 6, 9], ['atk1', 4, 7, 15]] },
  // ponta: onde fica a ponta do cajado (pixels do mundo, pés em 0,0, virado pra direita) — de onde sai a magia
  mago_m: { ponta: [117, -73], pulo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], golpe: { atk1: 3 }, combo: [['atk1', 0, 3, 8], ['atk1', 1, 3, 8], ['atk1', 0, 4, 16]], semFerido: true, vaivem: true },
  mago_f: { ponta: [74, -88], pulo: [1, 3, 5, 7, 9, 11, 13], golpe: { atk1: 5 }, combo: [['atk1', 1, 5, 9], ['atk1', 2, 5, 9], ['atk1', 1, 6, 15]], semFerido: true, vaivem: true },
  cavaleiro_f: { pulo: [3, 4, 5, 6, 7, 8, 9], golpe: { atk1: 10 }, ritmo: 0.62,
    combo: [['atk1', 6, 10, 11], ['atk1', 11, 8, 7], ['atk1', 7, 10, 16]] },   // desce, sobe (golpe de volta), desce forte
  // Vampira (vídeo do Flow): garras pra frente, garras pra cima, giro com a perna
  // Vampiro (vídeo do Flow, sem o sabre e as kunais): estica o braço pra lançar o sangue
  vampiro_m: { ponta: [72, -86], pulo: [0, 2, 4, 6, 8, 10, 12, 14, 16], golpe: { atk1: 4 }, combo: [['atk1', 0, 3, 7], ['atk1', 1, 4, 9], ['atk1', 0, 3, 13]], semFerido: true, vaivem: true },
  vampiro_f: { ponta: [58, -80], pulo: [0, 1, 2, 3, 4, 5, 6], golpe: { atk1: 6 }, combo: [['atk1', 1, 5, 8], ['atk1', 8, 17, 18], ['atk2', 0, 4, 14]], semFerido: true, vaivem: true },
};

const cache = {};
let luz = null;
if (typeof document !== 'undefined') {
  luz = document.createElement('canvas'); luz.width = luz.height = 64;
  const g = luz.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(210,190,255,.9)'); r.addColorStop(1, 'rgba(210,190,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
}
export function carregarSprites(nomes) {
  for (const n of nomes) {
    if (cache[n]) continue;
    const s = cache[n] = { img: new Image(), meta: null, ok: false };
    s.img.onload = () => { s.ok = !!s.meta; };
    s.img.src = `sprites/${n}.webp`;
    fetch(`sprites/${n}.json`).then(r => r.json()).then(m => { s.meta = m; s.ok = s.img.complete && s.img.naturalWidth > 0; }).catch(() => {});
  }
}
const nomeDe = (classe, sexo) => `${classe}_${sexo === 'f' ? 'f' : 'm'}`;
export function pontaArma(classe, sexo) { const n = nomeDe(classe, sexo); return temSprite(classe, sexo) && DEFS[n] && DEFS[n].ponta || null; }
export function temSprite(classe, sexo) { const s = cache[nomeDe(classe, sexo)]; return !!(s && s.ok); }

function quadro(nome, src, t) {
  const d = DEFS[nome], a = src.anim;
  const um = (anim, i) => [anim, i];
  if (a === 'correr' || a === 'rolar') return um('correr', (src.passo || t * 10) / (Math.PI * 2) * nQuadros(nome, 'correr') * (d.ritmo || 1));
  if (a === 'pular' || a === 'cair') {
    const k = clamp(((src.vy || 0) + 830) / 1430, 0, 0.999);
    return um('pular', d.pulo[Math.floor(k * d.pulo.length)]);
  }
  if (a === 'atacar') {
    const [anim, ini, imp, fim] = d.combo[(src.combo || 0) % d.combo.length];
    const f = clamp(src.fase || 0, 0, 1), fr = clamp((src.fimRel || 0.6) * 0.7, 0.15, 0.85);
    return um(anim, f < fr ? ini + (f / fr) * (imp - ini) : imp + (f - fr) / (1 - fr) * (fim - imp));
  }
  if (a === 'hab') return um('atk1', d.golpe.atk1);
  if (a === 'ferido') return d.semFerido ? um('parado', 0) : um('ferido', (src.fase || 0) * 99);
  if (a === 'caido') return um('morrer', 999);
  if (d.vaivem) { const n = nQuadros(nome, 'parado'), k = Math.floor(t * 9) % (2 * n - 2); return um('parado', k < n ? k : 2 * n - 2 - k); }
  return um('parado', Math.floor(t * 12));
}
const nQuadros = (nome, anim) => cache[nome].meta.anims[anim].n;

// desenha com os pés em (0,0), virado para a direita
export function desenharSprite(c, classe, sexo, src, t, alpha = 1) {
  const nome = nomeDe(classe, sexo), s = cache[nome];
  let [anim, i] = quadro(nome, src, t);
  const m = s.meta.anims[anim];
  i = Math.floor(i);
  i = (anim === 'parado' || anim === 'correr') ? ((i % m.n) + m.n) % m.n : clamp(i, 0, m.n - 1);
  const sx = (i % m.por) * m.w, sy = m.y + Math.floor(i / m.por) * m.h;
  const k = K * (s.meta.k || 1);
  c.save();
  c.globalAlpha *= alpha;
  if (src.anim === 'ferido' && DEFS[nome].semFerido) c.rotate(-0.18);
  // luz suave atrás, pra arte não sumir no fundo escuro
  if (luz) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.35; c.drawImage(luz, -60, -130, 120, 140); c.restore(); }
  c.drawImage(s.img, sx, sy, m.w, m.h, m.ox * k, m.oy * k, m.w * k, m.h * k);
  c.restore();
}
