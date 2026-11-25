/* QuizGen — PWA de quiz que gera perguntas a partir de pesquisas na internet
   (Gemini + Pesquisa Google, chave gratuita do próprio usuário). Wikipédia excluída. */
{
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LV = {facil:{n:'Fácil',c:'d1'}, medio:{n:'Médio',c:'d2'}, dificil:{n:'Difícil',c:'d3'}};
const ORDER = ['facil','medio','dificil'];
const SUGS = ['Revolução Francesa','Python','Sistema solar','Corpo humano','Segunda Guerra Mundial','Brasil Colônia'];
const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.8-flash','gemini-3.6-flash','gemini-flash-latest'];
const BLOCK = /wikipedia|wikiwand|wikimedia|wiki\.org|dbpedia/i;

const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let S = {topic:'', qs:[], run:[], i:0, ans:[], seen:[], srcs:[], wrong:[]};
let hist = store.get('qg_hist', []);
let redoMode = false;

function show(v){ document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === 'v-'+v)); $('hero').hidden = v !== 'home'; window.scrollTo(0,0); }

/* ---------------- configurações ---------------- */
function cfg(){ return {key: store.get('qg_key',''), model: store.get('qg_model', DEFAULT_MODEL) || DEFAULT_MODEL}; }
function openCfg(){ const c = cfg(); $('key').value = c.key; $('model').value = c.model; $('cfgok').hidden = true; show('cfg'); }
$('cfg').onclick = openCfg;
$('cfgback').onclick = () => show('home');
$('cf').addEventListener('submit', e => {
  e.preventDefault();
  store.set('qg_key', $('key').value.trim());
  store.set('qg_model', $('model').value.trim() || DEFAULT_MODEL);
  $('cfgok').hidden = false;
  if (pending){ const t = pending; pending = null; setTimeout(() => start(t), 400); }
});
let pending = null;

/* ---------------- histórico ---------------- */
function renderHist(){
  const ul = $('hist');
  if (!hist.length){ ul.innerHTML = '<li class="empty">Nenhum tema ainda. Pesquise algo acima para começar.</li>'; return; }
  ul.innerHTML = hist.map((h,k) => {
    const d = new Date(h.at).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'});
    const det = h.per ? ORDER.filter(l => h.per[l]).map(l => LV[l].n+' '+h.per[l][0]+'/'+h.per[l][1]).join(' · ') : '';
    const p = h.tot ? h.ok / h.tot : 0, cls = p >= .7 ? 's-hi' : p >= .4 ? 's-md' : 's-lo';
    return `<li><button class="h" data-k="${k}"><span class="ic">${esc(String(h.topic).trim().charAt(0).toUpperCase())}</span><span class="t">${esc(h.topic)}<span class="d">${esc(d)}${det ? ' · '+esc(det) : ''}</span></span><span class="score ${cls}">${Number(h.ok)||0}/${Number(h.tot)||0}</span></button></li>`;
  }).join('') + '<li><button class="clr" id="clr">Limpar histórico</button></li>';
}
$('hist').addEventListener('click', e => {
  if (e.target.id === 'clr'){ hist = []; store.set('qg_hist', hist); renderHist(); return; }
  const b = e.target.closest('button[data-k]'); if (!b) return;
  const h = hist[+b.dataset.k]; if (h){ $('q').value = h.topic; start(h.topic); }
});

/* ---------------- pesquisa + geração ---------------- */
function buildPrompt(topic, avoid){
  return `Você é um professor especialista. Tema do quiz: "${topic}".

PASSO 1 — PESQUISA: use a Pesquisa Google para reunir informações sobre o tema em várias fontes confiáveis da internet: sites de universidades, órgãos de governo, museus, enciclopédias como a Britannica, documentação oficial, revistas científicas, portais educacionais e veículos jornalísticos reconhecidos. NÃO use a Wikipédia nem sites que copiam a Wikipédia (adicione -site:wikipedia.org às buscas). Confira cada fato em mais de uma fonte quando possível.

PASSO 2 — QUIZ: com base no que pesquisou, crie EXATAMENTE 15 perguntas de múltipla escolha em português do Brasil:
- 5 de nível "facil": conceitos básicos e definições
- 5 de nível "medio": aplicação e relação entre ideias
- 5 de nível "dificil": detalhes, exceções e raciocínio

Regras:
- Exatamente 4 alternativas por pergunta e apenas UMA correta.
- Só use fatos corretos e confirmados na pesquisa. Na dúvida, não use.
- Nenhuma pergunta pode repetir ou ser variação de outra.
- Alternativas erradas plausíveis para quem não domina o tema; nada absurdo ou óbvio; sem "todas/nenhuma das anteriores".
- Alternativas com tamanho e estilo parecidos.
- "explicacao": 1 a 2 frases curtas dizendo por que a resposta está certa.
${avoid.length ? `\nNÃO repita nem reformule estas perguntas já usadas:\n${avoid.map(q => '- '+q).join('\n')}\n` : ''}
Responda SOMENTE com um array JSON válido, sem texto antes ou depois e sem markdown:
[{"nivel":"facil","pergunta":"...","alternativas":["...","...","...","..."],"correta":0,"explicacao":"..."}]`;
}

async function callGemini(prompt){
  const {key, model} = cfg();
  const models = [...new Set([model, ...FALLBACK_MODELS])];
  let lastErr;
  for (const m of models){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
    let r, j;
    try{
      r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        contents:[{role:'user', parts:[{text: prompt}]}],
        tools:[{google_search:{}}],
        generationConfig:{temperature:0.6}
      })});
      j = await r.json().catch(() => ({}));
    }catch(e){ const er = new Error('rede'); er.kind = 'net'; throw er; }
    if (r.ok){
      const c = (j.candidates || [])[0] || {};
      const text = ((c.content && c.content.parts) || []).map(p => p.text || '').join('');
      const chunks = (c.groundingMetadata && c.groundingMetadata.groundingChunks) || [];
      const srcs = chunks.map(x => x.web).filter(w => w && w.uri && !BLOCK.test((w.title||'')+' '+w.uri));
      if (!text){ lastErr = Object.assign(new Error('vazio'), {kind:'empty'}); continue; }
      if (m !== model) store.set('qg_model', m);
      return {text, srcs};
    }
    const msg = (j.error && j.error.message) || ('HTTP '+r.status);
    lastErr = Object.assign(new Error(msg), {status:r.status});
    if (r.status === 404 || /not found|not supported/i.test(msg)) continue;   // modelo não existe → tenta o próximo
    throw lastErr;
  }
  throw lastErr;
}

function parse(x){
  if (typeof x === 'string'){
    x = x.replace(/```json|```/g, '');
    const a = x.indexOf('['), b = x.lastIndexOf(']');
    if (a < 0 || b < a) throw new Error('formato');
    x = JSON.parse(x.slice(a, b+1));
  }
  if (!Array.isArray(x)) throw new Error('formato');
  const seen = new Set(), out = {facil:[], medio:[], dificil:[]};
  for (const q of x){
    const nv = String(q.nivel || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const alts = Array.isArray(q.alternativas) ? q.alternativas.map(a => String(a).trim()) : [];
    const c = Number(q.correta);
    if (!out[nv] || alts.length !== 4 || new Set(alts.map(a => a.toLowerCase())).size !== 4 || !(c >= 0 && c < 4) || !q.pergunta) continue;
    const key = String(q.pergunta).toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(key)) continue; seen.add(key);
    const idx = [0,1,2,3].sort(() => Math.random() - .5);      // embaralha mantendo a correta
    out[nv].push({nivel:nv, pergunta:String(q.pergunta), alternativas: idx.map(j => alts[j]), correta: idx.indexOf(c), explicacao: String(q.explicacao || '')});
  }
  const qs = ORDER.flatMap(l => out[l].slice(0, 5));
  if (qs.length < 12) throw new Error('poucas');
  return qs;
}

function renderSrcs(ul, wrap){
  const seen = new Set(), list = S.srcs.filter(s => { const k = s.title || s.uri; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  wrap.hidden = !list.length;
  ul.innerHTML = list.map(s => /^https:\/\//.test(s.uri) ? `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener">${esc(s.title || s.uri)}</a></li>` : `<li>${esc(s.title || s.uri)}</li>`).join('');
}

const TIPS = ['Buscando fontes confiáveis na internet…','Cruzando informações entre os sites…','Escolhendo alternativas plausíveis…','Separando fácil, médio e difícil…','Escrevendo as explicações…'];
let tipT = null;
function loadErr(msg, showCfg){
  clearInterval(tipT); $('lbar').hidden = true;
  $('lt').textContent = 'Não deu certo desta vez'; $('lp').textContent = '';
  $('lerr').textContent = msg; $('lerr').hidden = false; $('lacts').hidden = false;
  $('retry').textContent = showCfg ? 'Abrir configurações' : 'Tentar de novo';
  $('retry').onclick = showCfg ? openCfg : () => start(S.topic, true);
}
async function start(topic, again){
  topic = String(topic || '').trim(); if (!topic) return;
  if (!cfg().key){ pending = topic; openCfg(); return; }
  if (!again || topic !== S.topic) S.seen = [];
  S.topic = topic;
  $('lt').textContent = 'Pesquisando “'+topic+'”'; $('lp').textContent = TIPS[0];
  $('lerr').hidden = true; $('lacts').hidden = true; $('lbar').hidden = false;
  show('load');
  let t = 1; clearInterval(tipT); tipT = setInterval(() => { $('lp').textContent = TIPS[t++ % TIPS.length]; }, 3000);
  try{
    const {text, srcs} = await callGemini(buildPrompt(topic, S.seen.slice(-30)));
    S.qs = parse(text); S.srcs = srcs;
    S.seen.push(...S.qs.map(q => q.pergunta));
    clearInterval(tipT);
    $('ptitle').textContent = topic; renderSrcs($('psrc'), $('psrc-wrap'));
    show('pick');
  }catch(e){
    if (e.kind === 'net') loadErr('Sem conexão com a internet. Verifique sua rede e tente de novo.');
    else if (e.status === 400 && /api key/i.test(e.message)) loadErr('A chave da API parece inválida. Confira nas configurações.', true);
    else if (e.status === 401 || e.status === 403) loadErr('A chave não tem permissão. Gere uma nova em aistudio.google.com/apikey.', true);
    else if (e.status === 429) loadErr('O limite gratuito da sua chave foi atingido por agora. Espere alguns minutos e tente de novo.');
    else if (e.status === 404) loadErr('Modelo não encontrado. Confira o nome do modelo nas configurações.', true);
    else loadErr('A resposta veio incompleta. Tente gerar de novo.');
  }
}
$('f').addEventListener('submit', e => { e.preventDefault(); $('q').blur(); start($('q').value); });
$('sugs').innerHTML = SUGS.map(s => `<button class="chip" type="button">${esc(s)}</button>`).join('');
$('sugs').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b){ $('q').value = b.textContent; start(b.textContent); } });
$('back').onclick = () => show('home');

/* ---------------- quiz ---------------- */
$('v-pick').addEventListener('click', e => {
  const b = e.target.closest('.lvl'); if (!b) return;
  const l = b.dataset.l;
  begin(l === 'todos' ? S.qs : S.qs.filter(q => q.nivel === l), false);
});
function begin(list, redo){ redoMode = redo; S.run = list; S.i = 0; S.ans = []; show('quiz'); renderQ(); }
function renderQ(){
  const q = S.run[S.i], lv = LV[q.nivel];
  const same = S.run.filter(x => x.nivel === q.nivel), pos = same.indexOf(q) + 1;
  $('qtag').className = 'tag '+lv.c; $('qtag').textContent = (redoMode ? 'Revisão • ' : '') + lv.n + ' • ' + pos + '/' + same.length;
  $('qbar').innerHTML = S.run.map((_,j) => `<i class="${j < S.ans.length ? (S.ans[j].ok ? 'ok' : 'bad') : j === S.i ? 'cur' : ''}"></i>`).join('');
  $('qtext').textContent = q.pergunta;
  $('opts').innerHTML = q.alternativas.map((a,k) => `<button class="opt" data-k="${k}"><span class="l">${'ABCD'[k]}</span><span>${esc(a)}</span></button>`).join('');
  $('qexp').innerHTML = ''; $('next').hidden = true;
  const c = $('qcard'); c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip');
}
$('opts').addEventListener('click', e => {
  const b = e.target.closest('.opt'); if (!b || b.disabled) return;
  const q = S.run[S.i], k = +b.dataset.k, ok = k === q.correta;
  S.ans.push({q, k, ok});
  $('opts').querySelectorAll('.opt').forEach(o => {
    const j = +o.dataset.k; o.disabled = true;
    o.classList.add(j === q.correta ? 'ok' : j === k ? 'bad' : 'dim');
  });
  $('qexp').innerHTML = `<div class="exp ${ok ? 'okb' : 'bad'}"><b>${ok ? 'Você acertou!' : 'Não foi dessa vez'}</b><span></span></div>`;
  $('qexp').querySelector('span').textContent = (ok ? '' : 'Resposta certa: ' + 'ABCD'[q.correta] + '. ') + q.explicacao;
  $('next').textContent = S.i === S.run.length - 1 ? 'Ver resultado' : 'Próxima'; $('next').hidden = false;
  $('qbar').children[S.i].className = ok ? 'ok' : 'bad';
  $('next').scrollIntoView({behavior:'smooth', block:'nearest'});
});
$('next').onclick = () => { if (++S.i < S.run.length) renderQ(); else result(); };
$('quit').onclick = () => { if (S.ans.length) result(); else show('pick'); };

/* ---------------- resultado ---------------- */
function result(){
  const done = S.ans, ok = done.filter(a => a.ok).length, tot = done.length;
  const per = {}; for (const a of done){ const p = per[a.q.nivel] || (per[a.q.nivel] = [0,0]); p[1]++; if (a.ok) p[0]++; }
  $('rtopic').textContent = S.topic + (redoMode ? ' · revisão dos erros' : '');
  $('rscore').textContent = ok + ' de ' + tot;
  const pct = tot ? ok / tot : 0;
  $('rmsg').textContent = pct === 1 ? 'Gabaritou! Domínio total.' : pct >= .7 ? 'Mandou bem! Você conhece o tema.' : pct >= .4 ? 'Bom começo — revise os erros abaixo.' : 'Vale estudar mais um pouco. Veja as explicações.';
  $('rpct').textContent = Math.round(pct * 100) + '%';
  const arc = $('rarc'); arc.style.transition = 'none'; arc.style.strokeDashoffset = 264;
  requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.transition = 'stroke-dashoffset .8s ease'; arc.style.strokeDashoffset = 264 * (1 - pct); }));
  $('rper').innerHTML = ORDER.map(l => { const v = per[l], f = v ? v[0]/v[1] : 0, col = f >= .7 ? 'var(--ok)' : f >= .4 ? 'var(--warn)' : 'var(--bad)';
    return `<div><small>${LV[l].n}</small><b>${v ? v[0]+'/'+v[1] : '—'}</b><div class="mini"><i style="width:${Math.round(f*100)}%;background:${col}"></i></div></div>`; }).join('');
  const wr = done.filter(a => !a.ok);
  $('rwrong').innerHTML = wr.length ? wr.map(a => `<li><div class="q">${esc(a.q.pergunta)}</div><div class="a">✓ ${esc(a.q.alternativas[a.q.correta])}</div><div class="y">Sua resposta: ${esc(a.q.alternativas[a.k])}</div><div class="e">${esc(a.q.explicacao)}</div></li>`).join('') : '<li class="allok">Nenhum erro. Parabéns!</li>';
  $('redo').hidden = !wr.length; S.wrong = wr.map(a => a.q);
  renderSrcs($('rsrc'), $('rsrc-wrap'));
  if (!redoMode && tot){
    hist.unshift({topic:S.topic, ok, tot, per, at:Date.now()});
    hist = hist.slice(0, 50); store.set('qg_hist', hist); renderHist();
  }
  show('res');
  if (pct >= .7) confetti();
}
$('redo').onclick = () => begin(S.wrong.slice(), true);
$('newq').onclick = () => start(S.topic, true);
$('newt').onclick = () => { $('q').value = ''; show('home'); $('q').focus(); };
$('home').onclick = () => { renderHist(); show('home'); };

/* ---------------- confete ---------------- */
function confetti(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('confetti'), cx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.scale(dpr, dpr);
  const cols = ['#2350ff','#ffd23f','#5eead4','#ff6f62','#ffffff'];
  const P = Array.from({length:110}, () => ({x: innerWidth/2, y: innerHeight*.32, vx:(Math.random()-.5)*11, vy:-Math.random()*11-3, r:Math.random()*360, vr:(Math.random()-.5)*14, w:6+Math.random()*6, h:4+Math.random()*4, c:cols[Math.random()*cols.length|0]}));
  let f = 0;
  (function tick(){
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P){ p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r*Math.PI/180); cx.globalAlpha = Math.max(0, 1 - f/110); cx.fillStyle = p.c; cx.fillRect(-p.w/2, -p.h/2, p.w, p.h); cx.restore(); }
    if (++f < 110) requestAnimationFrame(tick); else cx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------------- abertura animada ---------------- */
{
  const sp = $('splash');
  let seen = false; try{ seen = sessionStorage.getItem('qg_splash') === '1'; sessionStorage.setItem('qg_splash','1'); }catch(e){}
  const hide = () => { sp.classList.add('out'); setTimeout(() => sp.remove(), 550); };
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) sp.remove();
  else { sp.addEventListener('click', hide); setTimeout(hide, 2500); }
}

/* ---------------- instalação + diagnóstico ---------------- */
let deferredPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|TikTok|; wv\)/i.test(navigator.userAgent);
function updInst(){ $('instbtn').hidden = isStandalone(); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; updInst(); if ($('v-inst').classList.contains('on')) openInst(); });
addEventListener('appinstalled', () => { deferredPrompt = null; updInst(); });
$('instbtn').onclick = openInst;
$('instback').onclick = () => show('home');
$('repair').onclick = async () => {
  $('repair').disabled = true; $('repair').textContent = 'Reparando…';
  try{ for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); }catch(e){}
  try{ for (const k of await caches.keys()) await caches.delete(k); }catch(e){}
  location.replace(location.pathname + '?r=' + Date.now());
};
$('instgo').onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try{ await deferredPrompt.userChoice; }catch(e){}
  deferredPrompt = null; openInst();
};
const okFetch = async (u, type) => { try{ const r = await fetch(u, {cache:'no-store'}); if (!r.ok) return false; if (type && !(r.headers.get('content-type')||'').includes(type)) return false; if (type === 'json') await r.json(); return true; }catch(e){ return false; } };
async function swOK(){
  if (!('serviceWorker' in navigator)) return false;
  try{
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register('sw.js');
    return await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 6000))]);
  }catch(e){ return false; }
}
async function openInst(){
  show('inst');
  const done = isStandalone();
  $('inst-done').hidden = !done;
  $('inst-now').hidden = done || !deferredPrompt;
  $('inst-ios').hidden = done || !isIOS;
  $('inst-and').hidden = done || isIOS || !!deferredPrompt;
  const man = document.querySelector('link[rel=manifest]').href;
  const checks = [
    ['Endereço seguro (https)', async () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
      'Abra pelo endereço do GitHub Pages (https://SEU-USUARIO.github.io/NOME-DO-REPOSITÓRIO/), e não pela página do repositório nem por um arquivo baixado.'],
    ['Navegador comum', async () => !inAppBrowser,
      'Você abriu o link dentro de outro app (Instagram, Facebook…). Toque nos três pontinhos e escolha “Abrir no navegador”.'],
    ['Arquivo do app (manifest)', () => okFetch(man, 'json'),
      'O arquivo manifest.webmanifest não foi encontrado. Envie-o para a MESMA pasta do index.html.'],
    ['Ícones', async () => { try{ const m = await (await fetch(man, {cache:'no-store'})).json(); const ic = (m.icons || []).map(i => new URL(i.src, man).href);
        if (!ic.length) return false; for (const u of ic) if (!(await okFetch(u, 'image'))) return false; return true; }catch(e){ return false; } },
      'Algum ícone do manifesto não foi encontrado. Toque em “Reparar app” abaixo; se continuar, envie os ícones para a MESMA pasta do index.html.'],
    ['Modo offline (service worker)', swOK,
      'O arquivo sw.js não foi encontrado ou não carregou. Envie-o para a MESMA pasta do index.html e recarregue a página.'],
  ];
  const ul = $('diag');
  ul.innerHTML = checks.map(c => `<li class="wait"><i>…</i><span>${esc(c[0])}</span></li>`).join('');
  const res = await Promise.all(checks.map(c => c[1]().catch(() => false)));
  const tips = [];
  ul.innerHTML = checks.map((c, k) => { if (!res[k]) tips.push(c[2]); return `<li class="${res[k] ? '' : 'no'}"><i>${res[k] ? '✓' : '✕'}</i><span>${esc(c[0])}${res[k] ? '' : `<small>${esc(c[2])}</small>`}</span></li>`; }).join('');
  $('diagtip').textContent = tips.length ? 'Corrija os itens em vermelho e recarregue a página.'
    : isIOS ? 'Está tudo certo. No iPhone, siga os passos acima pelo botão Compartilhar.'
    : deferredPrompt ? '' : 'Está tudo certo. Se o botão não aparecer, use o menu ⋮ do Chrome. Se o app já foi instalado antes, ele pode estar na sua lista de apps.';
}
updInst();

/* ---------------- início, offline e PWA ---------------- */
const net = () => { $('offline').hidden = navigator.onLine; };
addEventListener('online', net); addEventListener('offline', net); net();
renderHist();
if ('serviceWorker' in navigator){
  const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded){ reloaded = true; location.reload(); } });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => r.update()).catch(() => {}));
}
}
