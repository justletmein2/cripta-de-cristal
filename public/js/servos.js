// Servos de sangue do Vampiro/Vampira: o monstro marcado que morre levanta do seu lado, vermelho, por alguns segundos.
// Ficam numa lista própria (não na lista de inimigos), então nada no jogo os confunde com monstros.
import { desenharInimigo } from './inimigos.js';
import { brilho } from './arte.js';

export const SERVO = { dur: 8, max: 2, cd: 0.75 };

let tela = null, tc = null;
const LADO = 320, PE = 270;   // área de rascunho (o monstro é desenhado ali e pintado de vermelho)
export function desenharServo(c, sv, t, bioma) {
  if (!tela) { tela = document.createElement('canvas'); tela.width = tela.height = LADO * 2; tc = tela.getContext('2d'); }
  const sumir = Math.min(1, Math.max(0, sv.vida) / 0.8), surgir = Math.min(1, (sv.idade || 0) / 0.5);
  // brilho atrás
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 * sumir;
  c.drawImage(brilho('rgba(255,30,60,.8)', 64), sv.x - sv.w * 1.4, sv.y - sv.h * 1.5, sv.w * 2.8, sv.h * 1.9);
  c.restore();
  // o monstro, num rascunho, tingido de sangue
  tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1;
  tc.clearRect(0, 0, tela.width, tela.height);
  tc.setTransform(2, 0, 0, 2, 0, 0);
  const proxy = { ...sv, estado: sv.estado === 'prepara' ? 'persegue' : sv.estado, x: LADO / 2, y: PE, hp: 1, mhp: 1, marm: 0, arm: 0, elite: false, flash: sv.flash || 0 };
  tc.save(); desenharInimigo(tc, proxy, t, bioma); tc.restore();
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = 'source-atop';
  tc.fillStyle = 'rgba(170,0,30,.62)'; tc.fillRect(0, 0, tela.width, tela.height);
  tc.globalCompositeOperation = 'source-over';
  c.save();
  c.globalAlpha = sumir;
  // levantando do chão: corta de baixo pra cima
  if (surgir < 1) { c.beginPath(); c.rect(sv.x - LADO / 2, sv.y - sv.h * 1.3 * surgir - 10, LADO, sv.h * 1.3 * surgir + 12); c.clip(); }
  c.drawImage(tela, sv.x - LADO / 2, sv.y - PE, LADO, LADO);
  c.restore();
  // olhos acesos e gotas
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = sumir * surgir;
  const ox = sv.x + sv.d * sv.w * 0.18, oy = sv.y - sv.h * 0.82;
  c.drawImage(brilho('rgba(255,60,80,.95)', 24), ox - 12, oy - 12, 24, 24);
  c.fillStyle = '#ff2a4a';
  for (let i = 0; i < 3; i++) { const k = (t * 1.3 + i / 3 + sv.id * 0.1) % 1; c.fillRect(sv.x + (i - 1) * sv.w * 0.3, sv.y - sv.h * 0.6 + k * sv.h * 0.6, 2.5, 4); }
  c.restore();
  // tempo que falta: arco fininho em cima da cabeça
  c.save(); c.globalAlpha = 0.8 * sumir; c.strokeStyle = '#ff4d6d'; c.lineWidth = 3;
  c.beginPath(); c.arc(sv.x, sv.y - sv.h - 16, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, sv.vida) / SERVO.dur); c.stroke();
  c.restore();
}

// marca de sangue no monstro (presas pingando em cima da cabeça)
export function desenharMarca(c, en, t) {
  const x = en.x, y = en.y - en.h - 26 + Math.sin(t * 4 + en.id) * 3;
  c.save(); c.translate(x, y);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6 + en.id);
  c.drawImage(brilho('rgba(255,30,60,.9)', 24), -16, -16, 32, 32);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = '#ffe6ea'; c.strokeStyle = '#5a0010'; c.lineWidth = 1.5;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7 - 3, -6); c.lineTo(s * 7 + 3, -6); c.lineTo(s * 6, 6); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#ff2a4a';
  const k = (t * 1.5 + en.id * 0.3) % 1;
  c.beginPath(); c.arc(-6, 8 + k * 12, 2.2 * (1 - k), 0, 7); c.arc(6, 8 + ((k + 0.5) % 1) * 12, 2.2 * (1 - (k + 0.5) % 1), 0, 7); c.fill();
  c.restore();
}

// "dá pra morder": presas grandes piscando em cima do monstro (só na tela do vampiro)
export function desenharMordivel(c, en, t) {
  const x = en.x, y = en.y - en.h - 40;
  const p = 1 + Math.sin(t * 12) * 0.12;
  c.save(); c.translate(x, y); c.scale(p, p);
  c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,40,70,.95)', 32), -26, -26, 52, 52);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgba(30,0,10,.85)'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
  c.strokeStyle = '#ff4d6d'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#fff';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6 - 3.5, -6); c.lineTo(s * 6 + 3.5, -6); c.lineTo(s * 5, 8); c.closePath(); c.fill(); }
  c.restore();
}
