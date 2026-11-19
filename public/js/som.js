// Sons gerados na hora (sem arquivos): tudo passa por um compressor e um reverb de "salão de cristal".
let ctx = null, mestre = null, seco = null, eco = null, musGain = null, ligado = true;
let ruidoBuf = null;

export function iniciarSom() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    mestre = ctx.createGain(); mestre.gain.value = 0.6;
    comp.connect(mestre); mestre.connect(ctx.destination);
    seco = ctx.createGain(); seco.connect(comp);
    // reverb: resposta ao impulso feita de ruído que decai (soa como uma caverna)
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    conv.buffer = ir;
    eco = ctx.createGain(); eco.gain.value = 0.32;
    eco.connect(conv); conv.connect(comp);
    musGain = ctx.createGain(); musGain.gain.value = 0.2; musGain.connect(seco);
    const musEco = ctx.createGain(); musEco.gain.value = 0.5; musGain.connect(musEco); musEco.connect(eco);
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}
export function alternarSom() { ligado = !ligado; if (mestre) mestre.gain.value = ligado ? 0.6 : 0; return ligado; }

const ok = () => ctx && ligado && ctx.state === 'running';
function saida(g, rev) {
  g.connect(seco);
  if (rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(eco); }
}
// tom com envelope (ataque, decaimento) e deslize de altura
function tom(f, dur, { tipo = 'sine', vol = 0.3, ate = 0, atraso = 0, ataque = 0.005, rev = 0.2, destino = null, pan = 0 } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + atraso;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let fim = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); fim = p; }
  o.connect(g);
  if (destino) fim.connect(destino); else saida(fim, rev);
  o.start(t); o.stop(t + dur + 0.05);
}
// ruído filtrado com varredura de frequência (vento, corte, estalo)
function ruido(dur, { vol = 0.3, de = 1200, ate = 400, q = 1, tipo = 'bandpass', atraso = 0, ataque = 0.004, rev = 0.15 } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + atraso;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ruidoBuf; s.loop = true;
  f.type = tipo; f.frequency.setValueAtTime(de, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, ate), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); saida(g, rev);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
// sino de cristal: parciais inarmônicas
function sino(f, dur, vol = 0.12, atraso = 0, rev = 0.6) {
  for (const [k, v] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.93, 0.15]]) tom(f * k, dur / Math.sqrt(k), { vol: vol * v, atraso, ataque: 0.002, rev });
}
const var_ = (v, p = 0.08) => v * (1 + (Math.random() - 0.5) * p * 2);

export const som = {
  // espada cortando o ar
  golpe: (forte) => {
    ruido(forte ? 0.28 : 0.17, { vol: forte ? 0.32 : 0.22, de: var_(forte ? 2800 : 3600), ate: forte ? 500 : 900, q: 1.4, ataque: 0.03 });
    if (forte) tom(var_(220), 0.25, { tipo: 'triangle', vol: 0.06, ate: 120 });
  },
  // impacto: baque grave + estalo + brilho metálico
  acerto: (forte) => {
    tom(var_(forte ? 140 : 190), forte ? 0.22 : 0.14, { vol: forte ? 0.5 : 0.35, ate: 45, rev: 0.05 });
    ruido(0.07, { vol: forte ? 0.45 : 0.3, de: 2600, ate: 800, q: 0.8, rev: 0.1 });
    tom(var_(forte ? 1900 : 2400, 0.15), 0.12, { tipo: 'square', vol: 0.035, ate: 1200, rev: 0.3 });
    if (forte) ruido(0.3, { vol: 0.15, de: 400, ate: 90, q: 0.7, tipo: 'lowpass' });
  },
  // mago: zumbido cristalino que sobe
  disparo: () => {
    tom(var_(520), 0.18, { tipo: 'triangle', vol: 0.08, ate: 1560, rev: 0.5 });
    tom(var_(1560), 0.12, { tipo: 'sine', vol: 0.045, ate: 3120, atraso: 0.03, rev: 0.6 });
    ruido(0.12, { vol: 0.07, de: 9000, ate: 4000, q: 3, rev: 0.4 });
  },
  impactoMagico: () => {
    sino(var_(1318, 0.06), 0.55, 0.045);
    tom(var_(260), 0.14, { vol: 0.22, ate: 80, rev: 0.1 });
    ruido(0.1, { vol: 0.14, de: 5000, ate: 1500, q: 1, rev: 0.3 });
  },
  runa: () => [784, 1175, 1568, 2349].forEach((f, i) => sino(f, 0.7, 0.045, i * 0.035)),
  runaFalhou: () => { tom(300, 0.25, { tipo: 'triangle', vol: 0.07, ate: 140, rev: 0.3 }); ruido(0.2, { vol: 0.06, de: 1200, ate: 300, q: 1 }); },
  trovao: () => {
    ruido(0.07, { vol: 0.7, de: 9000, ate: 3500, q: 0.5, rev: 0.2 });
    ruido(1.5, { vol: 0.5, de: 900, ate: 50, q: 0.6, tipo: 'lowpass', ataque: 0.02, rev: 0.9 });
    tom(55, 1.1, { tipo: 'sawtooth', vol: 0.16, ate: 28, rev: 0.6 });
    ruido(0.05, { vol: 0.4, de: 7000, ate: 3000, q: 0.7, atraso: 0.12, rev: 0.3 });
  },
  gelo: () => {
    ruido(0.6, { vol: 0.2, de: 9000, ate: 5000, q: 4, ataque: 0.05, rev: 0.6 });
    [2093, 2637, 3136, 3951].forEach((f, i) => sino(f, 0.9, 0.035, i * 0.05));
    tom(180, 0.3, { tipo: 'triangle', vol: 0.1, ate: 90 });
    ruido(0.15, { vol: 0.25, de: 6000, ate: 2500, q: 1.2, atraso: 0.05 });
  },
  fogo: () => {
    ruido(0.75, { vol: 0.42, de: 350, ate: 2600, q: 0.7, ataque: 0.04, rev: 0.3 });
    ruido(0.5, { vol: 0.2, de: 3000, ate: 700, q: 1.5, atraso: 0.12, rev: 0.3 });
    tom(var_(90), 0.55, { tipo: 'sawtooth', vol: 0.12, ate: 42, rev: 0.4 });
  },
  explosao: () => {
    ruido(0.06, { vol: 0.7, de: 6000, ate: 2000, q: 0.5, rev: 0.2 });
    ruido(1.2, { vol: 0.6, de: 700, ate: 40, q: 0.5, tipo: 'lowpass', ataque: 0.01, rev: 0.7 });
    tom(48, 0.9, { tipo: 'sine', vol: 0.4, ate: 25, rev: 0.4 });
  },
  disparoInimigo: () => {
    ruido(0.09, { vol: 0.35, de: 3500, ate: 900, q: 0.8, rev: 0.25 });
    tom(var_(160), 0.12, { tipo: 'square', vol: 0.06, ate: 70, rev: 0.2 });
  },
  crepita: () => ruido(0.05, { vol: 0.06, de: var_(3200, 0.3), ate: 1500, q: 2, rev: 0.1 }),
  magia: () => {
    tom(var_(660), 0.35, { tipo: 'sine', vol: 0.12, ate: 1320, rev: 0.6 });
    tom(var_(990), 0.3, { tipo: 'triangle', vol: 0.06, ate: 1980, atraso: 0.02, rev: 0.6 });
    ruido(0.25, { vol: 0.12, de: 6000, ate: 2500, q: 2, rev: 0.5 });
  },
  pulo: () => { ruido(0.14, { vol: 0.12, de: 900, ate: 2200, q: 0.8 }); tom(320, 0.1, { vol: 0.05, ate: 520 }); },
  // blink: sucção + estalo
  rolar: () => {
    ruido(0.22, { vol: 0.25, de: 500, ate: 5000, q: 1.2, ataque: 0.1, rev: 0.3 });
    tom(1400, 0.18, { tipo: 'sine', vol: 0.06, ate: 300, atraso: 0.04, rev: 0.4 });
  },
  dano: () => {
    tom(210, 0.3, { tipo: 'sawtooth', vol: 0.16, ate: 70, rev: 0.1 });
    ruido(0.18, { vol: 0.3, de: 900, ate: 200, q: 0.8 });
    tom(90, 0.25, { vol: 0.35, ate: 40, rev: 0 });
  },
  // monstro estilhaçando em cristais
  quebra: () => {
    ruido(0.12, { vol: 0.3, de: 5000, ate: 1500, q: 0.8, rev: 0.4 });
    for (let i = 0; i < 5; i++) sino(var_(1400 + i * 380, 0.2), 0.7, 0.05, i * 0.025, 0.7);
    tom(110, 0.2, { vol: 0.25, ate: 50, rev: 0.1 });
  },
  quebraArmadura: () => {
    ruido(0.35, { vol: 0.45, de: 3500, ate: 300, q: 0.6, rev: 0.5 });
    tom(70, 0.5, { vol: 0.5, ate: 30, rev: 0.2 });
    for (let i = 0; i < 6; i++) sino(var_(900 + i * 300, 0.3), 1.0, 0.05, 0.03 * i, 0.8);
  },
  cristal: () => sino(var_(2093, 0.06), 0.45, 0.05, 0, 0.5),
  habilidade: () => {
    ruido(0.5, { vol: 0.22, de: 300, ate: 4000, q: 1, ataque: 0.2, rev: 0.6 });
    tom(110, 0.6, { tipo: 'sawtooth', vol: 0.08, ate: 440, rev: 0.4 });
    sino(880, 1.2, 0.08, 0.2);
  },
  carregado: () => {
    tom(330, 0.25, { tipo: 'square', vol: 0.06, ate: 990, rev: 0.4 });
    ruido(0.3, { vol: 0.2, de: 600, ate: 4500, q: 1.5, ataque: 0.05, rev: 0.4 });
  },
  perfeito: () => {
    tom(1760, 0.9, { vol: 0.12, ate: 880, rev: 0.9 });
    ruido(0.6, { vol: 0.2, de: 4000, ate: 300, q: 0.8, tipo: 'lowpass', rev: 0.8 });
    sino(1318, 1.4, 0.1, 0.05, 0.9);
  },
  marcoCombo: (n) => { const base = n >= 50 ? 1568 : n >= 35 ? 1318 : n >= 20 ? 1175 : 1046; [0, 4, 7, 12].forEach((s, i) => sino(base * Math.pow(2, s / 12), 0.8, 0.05, i * 0.05)); },
  emboscada: () => { tom(55, 1.0, { tipo: 'sawtooth', vol: 0.18, ate: 40, rev: 0.6 }); ruido(0.8, { vol: 0.2, de: 200, ate: 2000, q: 0.8, ataque: 0.3, rev: 0.7 }); },
  // corte de cena do especial: sucção + coral
  especial: () => {
    ruido(0.7, { vol: 0.35, de: 200, ate: 6000, q: 0.9, ataque: 0.5, rev: 0.6 });
    [0, 3, 7, 12].forEach((s, i) => tom(220 * Math.pow(2, s / 12), 1.2, { tipo: 'sawtooth', vol: 0.04, ataque: 0.25, atraso: i * 0.03, rev: 0.8 }));
    sino(1760, 1.6, 0.08, 0.6, 0.9);
  },
  especialSolto: (cl) => {
    tom(60, 0.9, { vol: 0.6, ate: 25, rev: 0.4 });
    ruido(0.9, { vol: 0.4, de: 6000, ate: 200, q: 0.6, rev: 0.7 });
    if (cl === 'mago' || cl === 'padre') [0, 4, 7, 11, 14].forEach((s, i) => sino(880 * Math.pow(2, s / 12), 1.6, 0.06, i * 0.07));
    else for (let i = 0; i < 4; i++) ruido(0.2, { vol: 0.3, de: 4000, ate: 600, q: 1.2, atraso: 0.3 + i * 0.1, ataque: 0.02 });
  },
  defendeu: () => { tom(var_(1800), 0.18, { tipo: 'square', vol: 0.06, ate: 1500, rev: 0.4 }); ruido(0.06, { vol: 0.25, de: 5000, ate: 3000, q: 2 }); },
  raio: () => { ruido(0.18, { vol: 0.3, de: 8000, ate: 2000, q: 0.5, rev: 0.3 }); tom(var_(1200), 0.12, { tipo: 'square', vol: 0.04, ate: 300 }); },
  cura: () => [523, 659, 784, 1046].forEach((f, i) => sino(f, 1.0, 0.07, i * 0.08)),
  portal: () => [392, 523, 659, 784, 1046].forEach((f, i) => sino(f, 1.4, 0.07, i * 0.07)),
  bencao: () => [659, 784, 988, 1318].forEach((f, i) => sino(f, 1.6, 0.08, i * 0.1)),
  chefe: () => { tom(55, 1.6, { tipo: 'sawtooth', vol: 0.25, ate: 35, rev: 0.7 }); tom(82, 1.6, { tipo: 'sawtooth', vol: 0.15, ate: 50, atraso: 0.1, rev: 0.7 }); ruido(1.2, { vol: 0.2, de: 150, ate: 600, q: 0.6, ataque: 0.4, rev: 0.8 }); },
  tremor: () => { tom(48, 0.6, { vol: 0.5, ate: 28, rev: 0.3 }); ruido(0.5, { vol: 0.3, de: 220, ate: 60, q: 0.6, tipo: 'lowpass' }); },
  morte: () => [392, 330, 262, 196].forEach((f, i) => sino(f, 1.2, 0.08, i * 0.2)),
  pocao: () => { tom(400, 0.3, { vol: 0.12, ate: 900, rev: 0.4 }); [0.06, 0.12, 0.18].forEach(a => tom(var_(1200, 0.3), 0.08, { vol: 0.05, ate: 1800, atraso: a, rev: 0.4 })); },
};

// música: pad em menor com acordes lentos, baixo, arpejo cristalino e, no chefe, percussão
let musTimer = null, passo = 0;
const ACORDES = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 62]];   // Am7 Fmaj7 G Em7
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function pad(notas, dur) {
  if (!ok()) return;
  const t = ctx.currentTime;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
  f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1400, t + dur * 0.5); f.frequency.linearRampToValueAtTime(500, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g); g.connect(musGain);
  for (const n of notas) for (const det of [-7, 7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(n - 12); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.1);
  }
}
export function musica(tocar, intensa = false) {
  if (musTimer) { clearInterval(musTimer); musTimer = null; }
  if (!tocar || !ctx) return;
  passo = 0;
  const bpm = intensa ? 128 : 88, dt = 60 / bpm / 2;
  musTimer = setInterval(() => {
    if (!ok()) return;
    const ac = ACORDES[Math.floor(passo / 16) % 4];
    if (passo % 16 === 0) pad(ac, dt * 16);
    if (passo % 4 === 0) tom(mf(ac[0] - 24), dt * 3.5, { tipo: 'triangle', vol: intensa ? 0.16 : 0.1, destino: musGain });
    const arp = [0, 2, 1, 3, 2, 1, 3, 2];
    if (passo % 2 === 0 || intensa) tom(mf(ac[arp[passo % 8]] + 12), dt * 2.5, { vol: 0.045, destino: musGain, pan: (passo % 4 < 2 ? -0.3 : 0.3) });
    if (passo % 32 === 28) sino(mf(ac[3] + 24), 2, 0.025, 0, 0.9);
    if (intensa) {
      if (passo % 4 === 0) tom(150, 0.18, { vol: 0.35, ate: 45, rev: 0.05, destino: musGain });
      if (passo % 8 === 4) ruido(0.12, { vol: 0.12, de: 2500, ate: 900, q: 0.7 });
      if (passo % 2 === 1) ruido(0.04, { vol: 0.04, de: 9000, ate: 7000, q: 1, tipo: 'highpass', rev: 0 });
    }
    passo++;
  }, dt * 1000);
}
