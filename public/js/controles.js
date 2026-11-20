// Teclado e controles de toque (joystick + botões).
export const ctrl = {
  esq: false, dir: false, baixo: false, cima: false,
  segura: { pular: false, atacar: false },
  apertou: { pular: 0, atacar: 0, hab: 0, rolar: 0, pocao: 0, esp: 0, usar: 0 },
};
const apertar = a => { ctrl.apertou[a] = performance.now(); };
export function consumir(a, janela = 140) {
  const t = ctrl.apertou[a];
  if (t && performance.now() - t < janela) { ctrl.apertou[a] = 0; return true; }
  return false;
}
export const temPedido = (a, janela = 140) => ctrl.apertou[a] && performance.now() - ctrl.apertou[a] < janela;

const TECLAS = {
  ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowDown: 'baixo', KeyS: 'baixo',
  Space: 'pular', KeyW: 'pular', ArrowUp: 'pular', KeyJ: 'atacar', KeyX: 'atacar', KeyK: 'hab', KeyC: 'hab',
  KeyL: 'rolar', ShiftLeft: 'rolar', ShiftRight: 'rolar', KeyQ: 'pocao', KeyH: 'pocao', KeyU: 'esp', KeyI: 'esp', KeyE: 'usar', Enter: 'usar',
};
export let ativo = false;
export function ligarControles(estaJogando) {
  addEventListener('keydown', e => {
    const a = TECLAS[e.code]; if (!a || !estaJogando()) return;
    e.preventDefault();
    if (a === 'esq' || a === 'dir' || a === 'baixo') ctrl[a] = true;
    else { if (!e.repeat) apertar(a); if (a in ctrl.segura) ctrl.segura[a] = true; }
    if (a === 'pular') ctrl.cima = true;
  });
  addEventListener('keyup', e => {
    const a = TECLAS[e.code]; if (!a) return;
    if (a === 'esq' || a === 'dir' || a === 'baixo') ctrl[a] = false;
    if (a in ctrl.segura) ctrl.segura[a] = false;
    if (a === 'pular') ctrl.cima = false;
  });
  addEventListener('blur', () => { ctrl.esq = ctrl.dir = ctrl.baixo = ctrl.cima = false; ctrl.segura.pular = ctrl.segura.atacar = false; });

  // toque
  const joy = document.getElementById('joy'), base = document.getElementById('joyBase'), pino = document.getElementById('joyPino');
  let toqueJoy = null, cx = 0, cy = 0;
  const mover = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const m = Math.hypot(dx, dy), max = 50;
    if (m > max) { dx = dx / m * max; dy = dy / m * max; }
    pino.style.transform = `translate(${dx}px,${dy}px)`;
    ctrl.esq = dx < -14; ctrl.dir = dx > 14; ctrl.baixo = dy > 28;
  };
  joy.addEventListener('touchstart', e => {
    e.preventDefault();
    if (toqueJoy !== null) return;
    const t = e.changedTouches[0]; toqueJoy = t.identifier;
    const r = joy.getBoundingClientRect();
    cx = t.clientX; cy = t.clientY;
    base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px'; base.classList.add('on');
    mover(cx, cy);
  }, { passive: false });
  joy.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === toqueJoy) mover(t.clientX, t.clientY);
  }, { passive: false });
  const soltar = e => {
    for (const t of e.changedTouches) if (t.identifier === toqueJoy) {
      toqueJoy = null; ctrl.esq = ctrl.dir = ctrl.baixo = false; base.classList.remove('on'); pino.style.transform = '';
    }
  };
  joy.addEventListener('touchend', soltar); joy.addEventListener('touchcancel', soltar);

  document.querySelectorAll('[data-acao]').forEach(b => {
    const a = b.dataset.acao;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); apertar(a); if (a in ctrl.segura) ctrl.segura[a] = true; if (a === 'pular') ctrl.cima = true;
      b.classList.add('apertado');
    }, { passive: false });
    const fim = e => { e.preventDefault(); if (a in ctrl.segura) ctrl.segura[a] = false; if (a === 'pular') ctrl.cima = false; b.classList.remove('apertado'); };
    b.addEventListener('touchend', fim); b.addEventListener('touchcancel', fim);
    b.addEventListener('mousedown', e => { e.preventDefault(); apertar(a); if (a in ctrl.segura) ctrl.segura[a] = true; });
    b.addEventListener('mouseup', () => { if (a in ctrl.segura) ctrl.segura[a] = false; });
  });
}
