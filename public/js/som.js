// Sons gerados na hora (sem arquivos) + uma música ambiente simples.
let ctx = null, mestre = null, musGain = null, ligado = true;
export function iniciarSom() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    mestre = ctx.createGain(); mestre.gain.value = 0.5; mestre.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = 0.16; musGain.connect(mestre);
  } catch { ctx = null; }
}
export function alternarSom() { ligado = !ligado; if (mestre) mestre.gain.value = ligado ? 0.5 : 0; return ligado; }

function tom(freq, dur, tipo = 'sine', vol = 0.3, deslize = 0, atraso = 0, destino) {
  if (!ctx || !ligado) return;
  const t = ctx.currentTime + atraso;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t);
  if (deslize) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + deslize), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(destino || mestre); o.start(t); o.stop(t + dur + 0.05);
}
let ruidoBuf = null;
function ruido(dur, vol = 0.3, freq = 1200, q = 1, atraso = 0) {
  if (!ctx || !ligado) return;
  if (!ruidoBuf) { ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + atraso;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ruidoBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.4), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(mestre); s.start(t); s.stop(t + dur + 0.05);
}

export const som = {
  golpe: (forte) => ruido(forte ? 0.22 : 0.14, forte ? 0.35 : 0.22, forte ? 900 : 1800, 0.8),
  acerto: (forte) => { tom(forte ? 90 : 140, 0.12, 'square', 0.18, -60); ruido(0.08, 0.3, 600, 1.5); },
  magia: () => { tom(880, 0.18, 'triangle', 0.15, 600); tom(1320, 0.12, 'sine', 0.08, 400, 0.03); },
  pulo: () => tom(300, 0.12, 'sine', 0.12, 260),
  rolar: () => ruido(0.2, 0.15, 500, 0.6),
  dano: () => { tom(180, 0.25, 'sawtooth', 0.2, -120); ruido(0.15, 0.25, 400, 1); },
  quebra: () => { for (let i = 0; i < 4; i++) tom(1200 + Math.random() * 1600, 0.25, 'triangle', 0.08, -300, i * 0.03); ruido(0.18, 0.2, 3000, 2); },
  cristal: () => tom(1568 + Math.random() * 300, 0.15, 'sine', 0.1, 200),
  habilidade: () => { tom(220, 0.4, 'sawtooth', 0.12, 440); tom(440, 0.4, 'triangle', 0.12, 880, 0.05); ruido(0.3, 0.2, 2000, 0.7); },
  cura: () => [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.5, 'sine', 0.12, 0, i * 0.08)),
  portal: () => [392, 523, 659, 784, 1046].forEach((f, i) => tom(f, 0.6, 'triangle', 0.12, 0, i * 0.07)),
  bencao: () => [659, 784, 988, 1318].forEach((f, i) => tom(f, 0.7, 'sine', 0.13, 0, i * 0.1)),
  chefe: () => { tom(55, 1.2, 'sawtooth', 0.3, -20); tom(82, 1.2, 'sawtooth', 0.2, -30, 0.1); },
  tremor: () => { tom(50, 0.5, 'sine', 0.4, -20); ruido(0.4, 0.3, 200, 0.7); },
  morte: () => [392, 330, 262, 196].forEach((f, i) => tom(f, 0.5, 'triangle', 0.15, 0, i * 0.18)),
  pocao: () => { tom(400, 0.3, 'sine', 0.15, 500); tom(600, 0.3, 'sine', 0.1, 700, 0.1); },
};

// música: acordes lentos em menor + arpejo cristalino
let musTimer = null, passo = 0;
const ACORDES = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];   // Am F G Em
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
export function musica(tocar, intensa = false) {
  if (musTimer) { clearInterval(musTimer); musTimer = null; }
  if (!tocar || !ctx) return;
  passo = 0;
  const bpm = intensa ? 132 : 92, dt = 60 / bpm / 2;
  musTimer = setInterval(() => {
    if (!ligado || !ctx || ctx.state !== 'running') return;
    const ac = ACORDES[Math.floor(passo / 16) % 4];
    if (passo % 16 === 0) ac.forEach(n => tom(mf(n - 12), dt * 16, 'triangle', 0.07, 0, 0, musGain));
    if (passo % 16 === 0) tom(mf(ac[0] - 24), dt * 16, 'sine', 0.12, 0, 0, musGain);
    const arp = [0, 1, 2, 1, 2, 0, 2, 1];
    if (passo % 2 === 0 || intensa) tom(mf(ac[arp[passo % 8]] + 12), dt * 1.8, 'sine', 0.06, 0, 0, musGain);
    if (intensa && passo % 4 === 0) ruido(0.08, 0.12, 120, 1);
    passo++;
  }, dt * 1000);
}
