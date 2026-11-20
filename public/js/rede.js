// Conexão com o Firebase do Forma Palavras (mesmo projeto, mesmo login, mesmo perfil).
// Os dados da Cripta ficam num caminho próprio: cripta/rooms/{CODIGO}/...
//   meta               estado da sala (anfitrião, status, andar, semente, ciclo)
//   players/{uid}      quem está na sala (nome, classe, sexo, pronto)
//   estado/{uid}       posição/animação de cada herói (cada um escreve o seu, ~12x por segundo)
//   inimigos           foto dos monstros e projéteis (só o anfitrião escreve)
//   golpes/{uid}/{n}   golpes que um jogador acertou nos monstros (o anfitrião aplica)
// Com ?local=1 tudo roda num "banco de teste" no próprio navegador (cada aba é um jogador).
import { firebaseConfig } from './config.js';

const V = '11.0.2';
const params = new URLSearchParams(location.search);
export const LOCAL = params.has('local');
const SALAS = 'cripta/rooms/';
const PERFIS = 'cacapalavras/profiles/';
let B = null, uid = null, offset = 0;

async function backendFirebase() {
  const [{ initializeApp, getApps }, A, D] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
  ]);
  // mesmo nome de app do Forma Palavras: assim o login de lá vale aqui
  const app = getApps().find(a => a.name === 'cacapalavras') || initializeApp(firebaseConfig, 'cacapalavras');
  const auth = A.getAuth(app), db = D.getDatabase(app);
  await auth.authStateReady();
  if (!auth.currentUser) await A.signInAnonymously(auth);
  D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  const ref = p => D.ref(db, p);
  const u = auth.currentUser;
  return {
    uid: u.uid,
    get: async p => (await D.get(ref(p))).val(),
    set: (p, v) => D.set(ref(p), v),
    update: (p, v) => D.update(ref(p), v),
    remove: p => D.remove(ref(p)),
    on: (p, cb) => D.onValue(ref(p), s => cb(s.val())),
    aoSair: (p, v) => D.onDisconnect(ref(p)).update(v),
    conectado: cb => D.onValue(ref('.info/connected'), s => cb(!!s.val())),
  };
}

// banco de teste: cada caminho "folha" vira uma chave do localStorage (abas não se atropelam)
function backendLocal() {
  const PREF = 'ccdb:';
  const ouvintes = [];
  const montar = prefixo => {
    let raiz;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith(PREF)) continue;
      const p = k.slice(PREF.length);
      if (p !== prefixo && !p.startsWith(prefixo + '/')) continue;
      let v; try { v = JSON.parse(localStorage.getItem(k)); } catch { continue; }
      if (p === prefixo) { raiz = v; continue; }
      if (typeof raiz !== 'object' || raiz == null) raiz = {};
      const ks = p.slice(prefixo.length + 1).split('/');
      let o = raiz; for (const x of ks.slice(0, -1)) { o[x] = o[x] || {}; o = o[x]; }
      o[ks[ks.length - 1]] = v;
    }
    return raiz ?? null;
  };
  const avisar = () => ouvintes.forEach(([p, cb]) => cb(montar(p)));
  addEventListener('storage', e => { if (e.key && e.key.startsWith(PREF)) avisar(); });
  let id = sessionStorage.getItem('cc_local_uid');
  if (!id) { id = 'u' + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('cc_local_uid', id); }
  const saidas = [];
  addEventListener('pagehide', () => saidas.forEach(([p, v]) => api.update(p, v)));
  const api = {
    uid: id,
    get: async p => montar(p),
    set: async (p, v) => {
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith(PREF + p + '/')) localStorage.removeItem(k); }
      if (v == null) localStorage.removeItem(PREF + p); else localStorage.setItem(PREF + p, JSON.stringify(v));
      avisar();
    },
    update: async (p, v) => { let a; try { a = JSON.parse(localStorage.getItem(PREF + p)); } catch {} localStorage.setItem(PREF + p, JSON.stringify({ ...(a || {}), ...v })); avisar(); },
    remove: async p => { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k === PREF + p || k.startsWith(PREF + p + '/')) localStorage.removeItem(k); } avisar(); },
    on: (p, cb) => { const o = [p, cb]; ouvintes.push(o); setTimeout(() => cb(montar(p))); return () => { const i = ouvintes.indexOf(o); if (i >= 0) ouvintes.splice(i, 1); }; },
    aoSair: (p, v) => saidas.push([p, v]),
  };
  return api;
}

let conectando = null;
export function conectar() {
  if (!conectando) conectando = (async () => {
    B = LOCAL ? backendLocal() : await backendFirebase();
    uid = B.uid;
    return uid;
  })().catch(e => { conectando = null; throw e; });
  return conectando;
}
export const agora = () => Date.now() + offset;
export const meuId = () => uid;

// perfil do Forma Palavras (só lemos o apelido)
export async function lerPerfil() { try { return (await B.get(PERFIS + uid)) || null; } catch { return null; } }

// ---------- salas ----------
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export async function criarSala() {
  for (let t = 0; t < 8; t++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    if (await B.get(SALAS + code + '/meta')) continue;
    await B.set(SALAS + code + '/meta', { host: uid, status: 'lobby', andar: 0, ciclo: 1, semente: 1, criada: agora() });
    return code;
  }
  throw new Error('Não consegui criar a sala, tente de novo');
}
export const lerMeta = code => B.get(SALAS + code + '/meta');
// Presença: quando o celular perde a conexão por um instante (tela bloqueada, 4G oscilando), o Firebase
// marca o jogador como "offline" e, sem isto, ele nunca mais voltava a "online" pros outros — o herói
// sumia da tela dos amigos, mesmo ele continuando a jogar. Agora a gente remarca sempre que reconecta.
let presenca = null;
export async function entrarSala(code, publico, cb) {
  const eu = `${SALAS}${code}/players/${uid}`;
  let saindo = false;
  const marcar = () => { if (saindo) return; B.update(eu, { online: true }); B.aoSair(eu, { online: false }); };
  await B.update(eu, { ...publico, online: true, entrou: agora() });
  B.aoSair(eu, { online: false });
  presenca = marcar;
  const st = { meta: null, players: {} };
  const offs = [
    B.on(SALAS + code + '/meta', v => { st.meta = v; cb(st); }),
    B.on(SALAS + code + '/players', v => {
      st.players = v || {};
      if (st.players[uid] && st.players[uid].online === false) marcar();   // alguém (o servidor) me marcou offline: volto
      cb(st);
    }),
    B.conectado ? B.conectado(ok => { if (ok) marcar(); }) : null,
  ];
  return () => { saindo = true; presenca = null; offs.forEach(f => typeof f === 'function' && f()); B.update(eu, { online: false }); };
}
// botão "Ressincronizar": remarca presença (e quem chama reabre a escuta da partida)
export function remarcarPresenca() { if (presenca) presenca(); }
export const atualizarMeta = (code, d) => B.update(SALAS + code + '/meta', d);
export const atualizarEu = (code, d) => B.update(`${SALAS}${code}/players/${uid}`, d);
export async function limparPartida(code) {
  await Promise.all(['estado', 'inimigos', 'golpes'].map(k => B.remove(SALAS + code + '/' + k)));
}
export const enviarEstado = (code, e) => B.set(`${SALAS}${code}/estado/${uid}`, e);
export const enviarInimigos = (code, e) => B.set(`${SALAS}${code}/inimigos`, e);
export const enviarGolpe = (code, n, g) => B.set(`${SALAS}${code}/golpes/${uid}/${n}`, g);
export const apagarGolpe = (code, n) => B.remove(`${SALAS}${code}/golpes/${uid}/${n}`);
export function ouvirPartida(code, cb) {
  const st = { estado: {}, inimigos: null, golpes: {} };
  const offs = ['estado', 'inimigos', 'golpes'].map(k => B.on(SALAS + code + '/' + k, v => { st[k] = v || (k === 'inimigos' ? null : {}); cb(st, k); }));
  return () => offs.forEach(f => f && f());
}
