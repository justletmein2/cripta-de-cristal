// Inimigos das fases temáticas: inteligência e desenho.
//  Castelo Carmesim: gárgula (mergulha do alto) e cavaleiro sombrio (escudo na frente)
//  Londres Enevoada: autômato a vapor (pesado, jato de vapor) e assassino da névoa (some e aparece nas costas)
//  Tumba de Anúbis: múmia (atadura que puxa) e escaravelho (pequeno, rápido, em bando)
import { T, clamp, sinal } from './util.js';
import { moverCorpo, temChaoFrente, paredeFrente, solido } from './fisica.js';
import { brilho, rgba } from './arte.js';

export const DEFS2 = {
  gargula: { vida: 70, vel: 150, w: 44, h: 48, dano: 18, alcance: 340, prep: 0.6, golpe: 1.0, recup: 1.1, visao: 560, voa: true, cristais: 6, nome: 'Gárgula' },
  cavaleiroSombrio: { vida: 115, vel: 85, w: 34, h: 76, dano: 20, alcance: 92, prep: 0.55, golpe: 0.3, recup: 0.7, visao: 480, cristais: 8, escudo: true, nome: 'Cavaleiro Sombrio' },
  automato: { vida: 190, vel: 50, w: 58, h: 92, dano: 24, alcance: 150, prep: 0.9, golpe: 0.5, recup: 0.9, visao: 480, pesado: true, cristais: 11, nome: 'Autômato a Vapor' },
  assassino: { vida: 55, vel: 150, w: 30, h: 72, dano: 19, alcance: 70, prep: 0.38, golpe: 0.16, recup: 0.6, visao: 520, cristais: 7, nome: 'Assassino da Névoa' },
  mumia: { vida: 120, vel: 48, w: 34, h: 74, dano: 16, alcance: 175, prep: 0.7, golpe: 0.3, recup: 0.9, visao: 440, cristais: 8, puxa: true, nome: 'Múmia' },
  escaravelho: { vida: 20, vel: 190, w: 28, h: 18, dano: 9, alcance: 170, prep: 0.4, golpe: 0.45, recup: 0.5, visao: 420, cristais: 2, nome: 'Escaravelho' },
};
export const ARMADURA2 = { gargula: 40, automato: 90 };

const muda = (en, e) => { en.estado = e; en.tE = 0; };

// IA: devolve true se tratou o monstro
export function atualizarInimigo2(en, dt, mundo, alvo, dist, d) {
  const nv = mundo.nv, dx = alvo ? alvo.x - en.x : 0, vel = d.vel * (en.mult.vel || 1), agil = en.mult.agil || 1;
  if (en.tipo === 'gargula') {
    if (en.estado === 'ronda') {
      en.vx = Math.sin(en.tE * 1.1 + en.id) * 40; en.vy = Math.cos(en.tE * 1.4) * 25;
      if (alvo && dist < d.visao) muda(en, 'persegue');
    } else if (en.estado === 'persegue') {
      if (!alvo) muda(en, 'ronda');
      else {
        const tx = alvo.x - sinal(dx) * 160, ty = alvo.y - 190;
        en.vx += clamp(tx - en.x, -1, 1) * 700 * dt; en.vy += clamp(ty - en.y, -1, 1) * 700 * dt;
        en.vx = clamp(en.vx, -vel, vel); en.vy = clamp(en.vy, -vel, vel); en.d = sinal(dx);
        if (en.tE > 1.5 * agil && dist < d.alcance + 80) { muda(en, 'prepara'); en.mira = { x: alvo.x, y: alvo.y }; }
      }
    } else if (en.estado === 'prepara') {
      en.vx *= 0.9; en.vy = -50;
      if (en.tE > d.prep) {
        muda(en, 'golpe'); en.ac++;
        const ang = Math.atan2(en.mira.y - en.y, en.mira.x - en.x);
        en.vx = Math.cos(ang) * 720; en.vy = Math.sin(ang) * 720;
      }
    } else if (en.estado === 'golpe') {
      if (solido(nv, en.x, en.y + 4) || nv.tiles[Math.floor((en.y + 4) / T) * nv.w + Math.floor(en.x / T)] === 2 || en.tE > d.golpe) {
        muda(en, 'recupera'); en.vx = 0; en.vy = 0; mundo.fx && mundo.fx('tremor', en.x, en.y);
      }
    } else if (en.estado === 'recupera') {
      en.vx = 0; en.vy = en.tE > d.recup * agil * 0.7 ? -160 : 0;
      if (en.tE > d.recup * agil) muda(en, 'persegue');
    }
    const nx = en.x + en.vx * dt, ny = en.y + en.vy * dt;
    if (!solido(nv, nx + sinal(en.vx) * 22, en.y - 24)) en.x = nx; else en.vx *= -0.3;
    if (!solido(nv, en.x, ny - 48) && !solido(nv, en.x, ny)) en.y = ny; else en.vy = 0;
    return true;
  }
  if (en.tipo === 'assassino') {
    en.visivel = en.estado === 'prepara' || en.estado === 'golpe' || (alvo && dist < 170);
    if (en.estado === 'ronda') {
      en.vx = 0; if (alvo && dist < d.visao) muda(en, 'persegue');
    } else if (en.estado === 'persegue') {
      if (!alvo) { muda(en, 'ronda'); }
      else {
        en.d = sinal(dx);
        en.vx = en.d * vel;
        if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) en.vx = 0;
        // some na névoa e aparece nas costas do herói
        if (en.tE > 1.1 * agil && dist < 420 && Math.abs(alvo.y - en.y) < 80) {
          const lado = sinal(en.x - alvo.x) || 1, nx = alvo.x - lado * 75;
          if (!solido(nv, nx, en.y - 20) && (solido(nv, nx, en.y + 6) || nv.tiles[Math.floor((en.y + 6) / T) * nv.w + Math.floor(nx / T)] === 2)) {
            mundo.fx && mundo.fx('piscar', en.x, en.y - 36);
            en.x = nx; en.d = sinal(alvo.x - en.x); en.vx = 0;
            mundo.fx && mundo.fx('piscar', en.x, en.y - 36);
            muda(en, 'prepara'); return true;
          }
          en.tE = 0.5;
        }
        if (Math.abs(dx) < d.alcance && Math.abs(alvo.y - en.y) < 70) { muda(en, 'prepara'); en.vx = 0; }
      }
    } else if (en.estado === 'prepara') {
      en.vx = 0; if (en.tE > d.prep) { muda(en, 'golpe'); en.ac++; en.vx = en.d * 220; }
    } else if (en.estado === 'golpe') {
      en.vx *= Math.pow(0.02, dt); if (en.tE > d.golpe) muda(en, 'recupera');
    } else if (en.estado === 'recupera') {
      en.vx = 0; if (en.tE > d.recup * agil) muda(en, 'persegue');
    }
    moverCorpo(en, dt, nv);
    return true;
  }
  if (en.tipo === 'escaravelho' || en.tipo === 'cavaleiroSombrio' || en.tipo === 'mumia' || en.tipo === 'automato') {
    if (en.estado === 'ronda') {
      if (en.tE > 2) { en.tE = 0; en.d = -en.d; }
      en.vx = en.d * vel * 0.4;
      if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) { en.d = -en.d; en.vx = 0; }
      if (alvo && dist < d.visao && Math.abs(alvo.y - en.y) < 200) muda(en, 'persegue');
    } else if (en.estado === 'persegue') {
      if (!alvo || dist > d.visao * 1.5) muda(en, 'ronda');
      else {
        en.d = sinal(dx); en.vx = en.d * vel;
        if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) en.vx = 0;
        if (Math.abs(dx) < d.alcance && Math.abs(alvo.y - en.y) < 70 && en.tE > 0.3) { muda(en, 'prepara'); en.vx = 0; }
      }
    } else if (en.estado === 'prepara') {
      en.vx *= Math.pow(0.001, dt);
      if (en.tE > d.prep) {
        muda(en, 'golpe'); en.ac++;
        if (en.tipo === 'escaravelho') en.vx = en.d * 480;
        if (en.tipo === 'cavaleiroSombrio') en.vx = en.d * 340;
        if (en.tipo === 'automato' && en.ac % 3 === 0 && alvo) {
          // de vez em quando atira uma engrenagem em vez do vapor
          const sx = en.x + en.d * 30, sy = en.y - 60, ang = Math.atan2(alvo.y - 35 - sy, alvo.x - sx);
          mundo.proj.push({ id: mundo.novoId(), x: sx, y: sy, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380, tipo: 2, dano: Math.round(d.dano * 0.8 * en.mult.dano), vida: 3 });
          en.tiro = true;
        } else en.tiro = false;
      }
    } else if (en.estado === 'golpe') {
      if (en.tipo === 'escaravelho') { if (!temChaoFrente(en, nv, en.d) || paredeFrente(en, nv, en.d)) en.vx = 0; }
      else en.vx *= Math.pow(0.02, dt);
      if (en.tE > d.golpe) muda(en, 'recupera');
    } else if (en.estado === 'recupera') {
      en.vx = 0; if (en.tE > d.recup * agil) muda(en, 'persegue');
    }
    moverCorpo(en, dt, nv);
    return true;
  }
  return false;
}

export function caixaGolpe2(en) {
  const f = en.d > 0;
  if (en.tipo === 'gargula') return { x: en.x - 24, y: en.y - 48, w: 48, h: 48 };
  if (en.tipo === 'cavaleiroSombrio') return { x: f ? en.x : en.x - 86, y: en.y - 62, w: 86, h: 50 };
  if (en.tipo === 'automato') return en.tiro ? null : { x: f ? en.x + 10 : en.x - 170, y: en.y - 80, w: 160, h: 76 };
  if (en.tipo === 'assassino') return { x: f ? en.x - 6 : en.x - 76, y: en.y - 66, w: 82, h: 58 };
  if (en.tipo === 'mumia') return { x: f ? en.x + 6 : en.x - 182, y: en.y - 54, w: 176, h: 22 };
  if (en.tipo === 'escaravelho') return { x: en.x - 16, y: en.y - 20, w: 32, h: 20 };
  return null;
}

// ---------- desenho ----------
const CONT = '#140d22';
const linha = (c, x1, y1, x2, y2, w, cor) => { c.strokeStyle = CONT; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = cor; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

export function desenharInimigo2(c, en, t, bioma, f) {
  const prep = en.estado === 'prepara', golpe = en.estado === 'golpe', anda = en.estado === 'persegue' || en.estado === 'ronda';
  const ph = anda ? t * 9 + en.id : 0;
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = CONT; c.lineWidth = 2.5;
  if (en.tipo === 'gargula') {
    c.scale(f, 1);
    const pousada = en.estado === 'recupera';
    const asa = pousada ? 0.2 : Math.sin(t * (golpe ? 2 : 10) + en.id) * 0.6;
    const pedra = '#6a6478', escura = '#4a4558';
    for (const s of [-1, 1]) {
      c.save(); c.translate(-4, -34); c.scale(s === -1 ? 1 : -0.7, 1); c.rotate(golpe ? -0.9 : asa - 0.3);
      c.fillStyle = escura; c.beginPath(); c.moveTo(0, 0); c.lineTo(-40, -26); c.lineTo(-34, -6); c.lineTo(-42, 4); c.lineTo(-26, 4); c.lineTo(-30, 14); c.lineTo(-8, 8); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.fillStyle = pedra; c.beginPath(); c.ellipse(0, -26, 16, 20, 0.3, 0, 7); c.fill(); c.stroke();
    // cabeça com chifres
    c.beginPath(); c.ellipse(12, -44, 10, 9, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = escura; c.beginPath(); c.moveTo(6, -50); c.lineTo(0, -64); c.lineTo(10, -52); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(14, -52); c.lineTo(16, -66); c.lineTo(19, -50); c.fill(); c.stroke();
    c.fillStyle = prep || golpe ? '#ff3355' : bioma.luz; c.beginPath(); c.arc(16, -45, 2.5, 0, 7); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho(prep || golpe ? 'rgba(255,50,80,.9)' : rgba(bioma.luz, 0.7), 16), 8, -53, 16, 16); c.restore();
    // garras
    linha(c, -4, -8, -8, 0, 4, pedra); linha(c, 6, -8, 8, 0, 4, pedra);
  } else if (en.tipo === 'cavaleiroSombrio') {
    c.scale(f, 1);
    const metal = '#3a3a4a', claro = '#5a5a70';
    linha(c, -3, -36, -3 - Math.sin(ph) * 9, -18, 6, metal); linha(c, -3 - Math.sin(ph) * 9, -18, -5 - Math.sin(ph) * 12, 0, 6, metal);
    linha(c, 3, -36, 3 + Math.sin(ph) * 9, -18, 6, metal); linha(c, 3 + Math.sin(ph) * 9, -18, 5 + Math.sin(ph) * 12, 0, 6, metal);
    // capa
    c.fillStyle = '#5a0a18'; c.beginPath(); c.moveTo(-8, -66); c.quadraticCurveTo(-24, -34, -20, -6); c.lineTo(-6, -14); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = metal; c.beginPath(); c.moveTo(-11, -68); c.lineTo(11, -68); c.lineTo(10, -36); c.lineTo(-10, -36); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#8a1020'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -66); c.lineTo(0, -40); c.stroke(); c.strokeStyle = CONT;
    // elmo com fenda vermelha
    c.fillStyle = claro; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-9, -68); c.lineTo(-9, -84); c.quadraticCurveTo(0, -94, 10, -84); c.lineTo(10, -68); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = prep ? '#ff3355' : '#c41e3a'; c.fillRect(1, -80, 10, 3);
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,40,70,.8)', 16), 0, -88, 18, 18); c.restore();
    // lança
    const a = prep ? -0.2 : golpe ? 0.05 : 0.35;
    c.save(); c.translate(6, -54); c.rotate(a);
    c.fillStyle = '#4a3a2a'; c.fillRect(-18, -2.5, 80, 5); c.fillStyle = '#9aa0b5'; c.beginPath(); c.moveTo(62, -6); c.lineTo(80, 0); c.lineTo(62, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // escudo na frente
    const ativo = en.estado !== 'golpe' && en.estado !== 'atordoado';
    c.save(); c.translate(16, -52); c.globalAlpha = ativo ? 1 : 0.6;
    c.fillStyle = '#2a2a38'; c.beginPath(); c.moveTo(-6, -22); c.lineTo(10, -20); c.lineTo(12, 10); c.quadraticCurveTo(4, 26, -4, 28); c.quadraticCurveTo(-10, 12, -8, -6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#8a1020'; c.lineWidth = 2; c.beginPath(); c.moveTo(2, -16); c.lineTo(2, 20); c.moveTo(-5, -2); c.lineTo(10, -2); c.stroke();
    if (ativo) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.drawImage(brilho('rgba(150,170,255,.8)', 32), -16, -26, 34, 56); }
    c.restore();
  } else if (en.tipo === 'automato') {
    c.scale(f, 1);
    const latao = '#b08a4a', ferro = '#4a4a56';
    const bob = anda ? Math.abs(Math.sin(t * 4 + en.id)) * 2 : 0;
    c.fillStyle = ferro;
    c.beginPath(); c.rect(-22, -30 + Math.sin(ph) * 2, 16, 30); c.fill(); c.stroke();
    c.beginPath(); c.rect(6, -30 - Math.sin(ph) * 2, 16, 30); c.fill(); c.stroke();
    c.translate(0, -bob);
    // caldeira
    const g = c.createLinearGradient(-26, -90, 26, -30); g.addColorStop(0, '#d9b070'); g.addColorStop(1, '#7a5a2a');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -60, 28, 32, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = '#5a4020'; c.lineWidth = 2; for (const y of [-78, -60, -42]) { c.beginPath(); c.moveTo(-26, y); c.lineTo(26, y); c.stroke(); }
    c.strokeStyle = CONT; c.lineWidth = 2.5;
    // fornalha
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho(prep ? 'rgba(255,80,40,.95)' : 'rgba(255,150,60,.85)', 32), -4, -70, 30, 30); c.restore();
    c.fillStyle = prep ? '#ff7a3a' : '#ffb04d'; c.beginPath(); c.rect(4, -62, 12, 9); c.fill(); c.stroke();
    // chaminé com fumaça
    c.fillStyle = ferro; c.fillRect(-14, -104, 10, 18); c.strokeRect(-14, -104, 10, 18);
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#d8dde0';
    for (let i = 0; i < 4; i++) { const k = (t * 1.5 + i * 0.25) % 1; c.beginPath(); c.arc(-9 - k * 10, -110 - k * 40, 5 + k * 10, 0, 7); c.fill(); }
    c.restore();
    // cabeça-visor
    c.fillStyle = latao; c.beginPath(); c.arc(10, -92, 10, 0, 7); c.fill(); c.stroke();
    c.fillStyle = prep ? '#ff3355' : '#7fd8ff'; c.beginPath(); c.arc(14, -92, 4, 0, 7); c.fill();
    // braço-canhão de vapor
    const a = prep ? -0.3 : golpe ? 0 : 0.5;
    c.save(); c.translate(18, -62); c.rotate(a);
    c.fillStyle = ferro; c.beginPath(); c.rect(0, -8, 34, 16); c.fill(); c.stroke();
    c.fillStyle = latao; c.beginPath(); c.rect(30, -11, 10, 22); c.fill(); c.stroke();
    c.restore();
    if (golpe && !en.tiro) {
      c.save(); c.globalAlpha = 0.6 * (1 - en.tE / 0.5);
      for (let i = 0; i < 9; i++) { const k = (en.tE * 3 + i / 9) % 1; c.fillStyle = '#eef3f5'; c.beginPath(); c.arc(56 + k * 120, -62 + Math.sin(i * 2.3) * 22 * k, 10 + k * 26, 0, 7); c.fill(); }
      c.restore();
    }
  } else if (en.tipo === 'assassino') {
    // quase invisível na névoa até chegar perto
    c.globalAlpha *= en.visivel ? 1 : 0.22;
    c.scale(f, 1);
    const capa = '#1c1e26';
    linha(c, -2, -34, -2 - Math.sin(ph) * 10, -17, 5, '#2a2c36'); linha(c, -2 - Math.sin(ph) * 10, -17, -4 - Math.sin(ph) * 13, 0, 5, '#14151a');
    linha(c, 2, -34, 2 + Math.sin(ph) * 10, -17, 5, '#2a2c36'); linha(c, 2 + Math.sin(ph) * 10, -17, 4 + Math.sin(ph) * 13, 0, 5, '#14151a');
    c.fillStyle = capa; c.beginPath(); c.moveTo(-10, -66); c.quadraticCurveTo(-22, -40, -18, -14); c.lineTo(14, -24); c.lineTo(10, -66); c.closePath(); c.fill(); c.stroke();
    // cartola e cachecol
    c.fillStyle = '#101116'; c.fillRect(-10, -92, 20, 16); c.strokeRect(-10, -92, 20, 16); c.fillRect(-14, -78, 28, 4);
    c.fillStyle = '#d8d2c8'; c.beginPath(); c.arc(2, -70, 8, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#7a1020'; c.fillRect(-8, -64, 18, 5);
    c.fillStyle = prep || golpe ? '#ff3355' : '#9ff'; c.fillRect(4, -73, 4, 2);
    // lâmina
    const a = prep ? -2.0 : golpe ? 1.3 : 0.8;
    c.save(); c.translate(6, -54); c.rotate(-a + Math.PI / 2);
    c.fillStyle = '#d0d6e0'; c.beginPath(); c.moveTo(0, -2); c.lineTo(34, 0); c.lineTo(0, 2); c.closePath(); c.fill(); c.stroke();
    c.restore();
    if (!en.visivel) { c.globalAlpha = 0.5; c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(180,200,210,.5)', 32), -30, -90, 60, 90); c.restore(); }
  } else if (en.tipo === 'mumia') {
    c.scale(f, 1);
    const pano = '#d8ccae', sombra = '#a89a78';
    linha(c, -3, -36, -3 - Math.sin(ph * 0.6) * 7, -18, 7, sombra); linha(c, -3 - Math.sin(ph * 0.6) * 7, -18, -4 - Math.sin(ph * 0.6) * 9, 0, 6, sombra);
    linha(c, 3, -36, 3 + Math.sin(ph * 0.6) * 7, -18, 7, pano); linha(c, 3 + Math.sin(ph * 0.6) * 7, -18, 4 + Math.sin(ph * 0.6) * 9, 0, 6, pano);
    c.fillStyle = pano; c.beginPath(); c.moveTo(-11, -68); c.lineTo(11, -68); c.lineTo(10, -34); c.lineTo(-10, -34); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = sombra; c.lineWidth = 1.5; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-10, -66 + i * 6); c.lineTo(10, -63 + i * 6); c.stroke(); }
    c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.fillStyle = pano; c.beginPath(); c.arc(2, -78, 10, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = sombra; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-7, -84 + i * 4); c.lineTo(11, -82 + i * 4); c.stroke(); }
    c.strokeStyle = CONT; c.lineWidth = 2.5;
    c.fillStyle = prep ? '#ff3355' : '#2fe8d0'; c.beginPath(); c.arc(7, -79, 2.2, 0, 7); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho(prep ? 'rgba(255,50,80,.9)' : 'rgba(47,232,208,.8)', 16), 0, -86, 14, 14); c.restore();
    // braços esticados + atadura chicoteando
    linha(c, 4, -60, 22, -56, 6, pano);
    if (golpe || prep) {
      const alc = golpe ? 170 * Math.min(1, en.tE / 0.12) : 10;
      c.strokeStyle = pano; c.lineWidth = 5; c.beginPath(); c.moveTo(22, -56);
      for (let i = 1; i <= 10; i++) c.lineTo(22 + alc * i / 10, -56 + Math.sin(i * 1.4 + t * 20) * 4);
      c.stroke();
    }
  } else if (en.tipo === 'escaravelho') {
    c.scale(f, 1);
    const rola = golpe ? t * 30 : 0;
    // perninhas
    c.strokeStyle = '#1a1a10'; c.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { const p = Math.sin(t * 20 + i) * 3; c.beginPath(); c.moveTo(i * 7, -6); c.lineTo(i * 9 + p, 0); c.stroke(); }
    c.save(); c.translate(0, -10); c.rotate(rola);
    const g = c.createLinearGradient(-14, -10, 14, 8); g.addColorStop(0, '#5ff0d8'); g.addColorStop(0.5, '#1a8a7a'); g.addColorStop(1, '#0a3a35');
    c.fillStyle = g; c.strokeStyle = CONT; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 0, 14, 9, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke();
    c.fillStyle = '#c9a54a'; c.beginPath(); c.ellipse(13, 0, 5, 5, 0, 0, 7); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = prep || golpe ? '#ff3355' : '#ffe28a'; c.beginPath(); c.arc(15, -11, 1.6, 0, 7); c.fill();
  }
}

export function desenharProjetil2(c, p, t) {
  if (p.tipo !== 2) return false;
  // engrenagem girando
  c.save(); c.translate(p.x, p.y); c.rotate(t * 12);
  c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(brilho('rgba(255,170,60,.7)', 32), -22, -22, 44, 44); c.restore();
  c.fillStyle = '#b08a4a'; c.strokeStyle = CONT; c.lineWidth = 2;
  c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 9 : 13; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#4a4a56'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
  c.restore();
  return true;
}
