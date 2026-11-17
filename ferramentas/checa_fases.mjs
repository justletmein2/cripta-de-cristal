// Confere se as fases geradas sempre têm caminho até o portal. Uso: node ferramentas/checa_fases.mjs
import { gerarNivel, alcancavel } from '../public/js/nivel.js';
let ruins = 0, tot = 0;
for (let s = 1; s <= 500; s++) for (let a = 1; a <= 3; a++) { tot++; if (!alcancavel(gerarNivel(s * 7919, a))) ruins++; }
console.log('fases impossíveis:', ruins, 'de', tot);
