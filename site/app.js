'use strict';

/* ================= Utilidades ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const semMovimento = matchMedia('(prefers-reduced-motion: reduce)');

const cache = {};
function carregar(nome) {
  if (!cache[nome]) {
    cache[nome] = fetch(`data/${nome}.json`, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`Não foi possível carregar data/${nome}.json (erro ${r.status}).`);
      return r.json();
    }).catch(e => { delete cache[nome]; throw e; });
  }
  return cache[nome];
}
const carregarMateria = id => carregar(id).catch(() => ({ materia: id, aulas: [], flashcards: [], questoes: [], mapa: null }));
const todasMaterias = () => Promise.all(G.materias.map(m => carregarMateria(m.id)));

// Datas "AAAA-MM-DD" sempre no fuso local
const paraData = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const diasAte = s => Math.round((paraData(s) - hoje()) / 86400000);
const fmtData = (s, opt = { weekday: 'short', day: 'numeric', month: 'short' }) => paraData(s).toLocaleDateString('pt-BR', opt).replace(/\./g, '');
const falta = s => {
  const n = diasAte(s);
  if (n < 0) return n === -1 ? 'ontem' : `há ${-n} dias`;
  return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `${n} dias`;
};
const porData = (a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''));
const embaralhar = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Markdown com fórmulas ($...$ e $$...$$) renderizadas pelo KaTeX
function md(texto, inline = false) {
  if (!texto) return '';
  const formulas = [];
  const guardar = (m, bloco) => { formulas.push([m, bloco]); return `@@F${formulas.length - 1}@@`; };
  const t = String(texto)
    .replace(/\\\$/g, '@@DOLAR@@') // "\$" é cifrão de verdade, não fórmula
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => guardar(m, true))
    .replace(/\$([^$\n]+?)\$/g, (_, m) => guardar(m, false));
  const html = DOMPurify.sanitize(inline ? marked.parseInline(t) : marked.parse(t)).replace(/@@DOLAR@@/g, '$');
  return html.replace(/@@F(\d+)@@/g, (_, i) => {
    const [m, bloco] = formulas[i];
    try { return katex.renderToString(m, { displayMode: bloco, throwOnError: false }); }
    catch { return esc(m); }
  });
}

/* ================= Ícones (Phosphor duotone) ================= */
const ICONES = {
  hoje: 'house', materias: 'books', agenda: 'calendar-blank', arquivos: 'folder-simple',
  livro: 'book-open', slide: 'presentation', doc: 'file-text', lista: 'list-checks', link: 'link',
  video: 'play-circle', cards: 'cards', prova: 'exam', fogo: 'fire', xp: 'lightning', mapa: 'tree-structure',
  aula: 'chalkboard-teacher', ant: 'caret-left', prox: 'caret-right', busca: 'magnifying-glass', hora: 'clock', fora: 'arrow-square-out'
};
const ic = nome => `<i class="ph-duotone ph-${ICONES[nome] || nome}" aria-hidden="true"></i>`;

/* ================= Animações (inspiradas no React Bits) ================= */
const Anim = {
  // BlurText: cada palavra entra desfocada e vem do alto
  blur(el, atraso = 0) {
    if (semMovimento.matches) return;
    const nos = [...el.childNodes];
    el.textContent = '';
    let i = 0;
    nos.forEach(n => {
      if (n.nodeType !== 3) { el.appendChild(n); return; }
      n.textContent.split(/(\s+)/).forEach(p => {
        if (!p) return;
        if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); return; }
        const s = document.createElement('span');
        s.className = 'palavra'; s.textContent = p;
        s.style.animationDelay = `${atraso + i++ * 70}ms`;
        el.appendChild(s);
      });
    });
  },
  // CountUp: número sobe até o valor final
  contar(el) {
    const fim = +el.dataset.contar;
    if (semMovimento.matches || !fim) { el.textContent = fim; return; }
    const t0 = performance.now(), dur = Math.min(1200, 300 + fim * 40);
    const passo = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(fim * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(passo);
    };
    el.textContent = '0';
    requestAnimationFrame(passo);
  },
  // Barras crescem do zero
  barras(raiz) {
    $$('[data-w]', raiz).forEach(b => {
      if (semMovimento.matches) { b.style.width = b.dataset.w; return; }
      b.style.width = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.width = b.dataset.w; }));
    });
  },
  // ClickSpark: faíscas saindo do ponto do clique
  faisca(x, y, cor = 'var(--azul)', qtd = 8, raio = 26) {
    if (semMovimento.matches) return;
    const box = document.createElement('div');
    box.className = 'faiscas';
    box.style.cssText = `left:${x}px;top:${y}px;--fc:${cor};--r:${raio}px`;
    for (let i = 0; i < qtd; i++) {
      const f = document.createElement('i');
      f.style.setProperty('--a', `${(360 / qtd) * i}deg`);
      box.appendChild(f);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 650);
  },
  // Comemoração maior (gabaritou, terminou revisão)
  festa(el) {
    if (semMovimento.matches || !el) return;
    const r = el.getBoundingClientRect();
    const cores = G.materias.map(m => m.cor);
    for (let k = 0; k < 4; k++) setTimeout(() =>
      Anim.faisca(r.left + r.width * (.2 + Math.random() * .6), r.top + r.height * (.2 + Math.random() * .5), cores[k % cores.length], 12, 46), k * 120);
  },
  aplicar(raiz = app) {
    $$('[data-blur]', raiz).forEach(el => Anim.blur(el, +el.dataset.blur || 0));
    $$('[data-contar]', raiz).forEach(Anim.contar);
    Anim.barras(raiz);
  }
};

// Faísca em todo botão clicado
document.addEventListener('click', e => {
  const b = e.target.closest('.botao, .alternativa');
  if (b && !b.disabled) Anim.faisca(e.clientX, e.clientY, getComputedStyle(b).getPropertyValue('--c').trim() || undefined);
});
// SpotlightCard: luz que segue o cursor nos cartões
document.addEventListener('pointermove', e => {
  const c = e.target.closest?.('.spot');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
});

/* ================= Progresso (salvo no navegador) ================= */
const Progresso = {
  chave: 'lousa:progresso:v1',
  ler() {
    try { return { xp: 0, provas: [], cards: {}, dias: [], ...JSON.parse(localStorage.getItem(this.chave) || '{}') }; }
    catch { return { xp: 0, provas: [], cards: {}, dias: [] }; }
  },
  salvar(p) {
    const d = iso(hoje());
    if (!p.dias.includes(d)) p.dias = [...p.dias, d].slice(-120);
    try { localStorage.setItem(this.chave, JSON.stringify(p)); } catch { /* modo privado */ }
  },
  ganharXp(n) { const p = this.ler(); p.xp += n; this.salvar(p); desenharPerfil(); }
};
const XP_NIVEL = n => 50 * (n - 1) ** 2;
const nivel = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
function sequencia(dias) {
  const set = new Set(dias);
  const d = hoje();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1); // ainda dá tempo de estudar hoje
  let n = 0;
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
// Leitner: acertou sobe de caixa (revisa mais tarde), errou volta para a caixa 1
const INTERVALOS = [0, 1, 2, 4, 7, 15];
const devidos = (cards, p) => { const h = iso(hoje()); return cards.filter(c => !p.cards[c.id] || p.cards[c.id].proxima <= h); };
const dominados = (cards, p) => cards.filter(c => (p.cards[c.id]?.caixa || 0) >= 3).length;

/* ================= Tipos ================= */
const TIPOS_AVISO = { prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade', exercicio: 'Lista', aviso: 'Aviso' };
const TIPOS_ARQUIVO = {
  slide: { rotulo: 'Slides', icone: 'slide' }, livro: { rotulo: 'Livro', icone: 'livro' },
  pdf: { rotulo: 'PDF', icone: 'doc' }, lista: { rotulo: 'Lista', icone: 'lista' },
  link: { rotulo: 'Link', icone: 'link' }, outro: { rotulo: 'Outro', icone: 'doc' }
};
const ICONE_REF = { video: 'video', artigo: 'doc', livro: 'livro', exercicios: 'lista', site: 'link' };

let G = null;
const materiaPorId = id => G.materias.find(m => m.id === id);
const cor = m => m ? `style="--cor:${esc(m.cor)}"` : '';
const tagExemplo = x => x?.exemplo ? ' <span class="exemplo" title="Conteúdo de demonstração">exemplo</span>' : '';

/* ================= Molduras ================= */
async function desenharMolduras(caminho) {
  const atual = (caminho.match(/^\/materia\/([\w-]+)/) || [])[1];
  const secao = atual || caminho.startsWith('/materias') ? 'materias' : caminho.startsWith('/calendario') ? 'agenda' : caminho.startsWith('/arquivos') ? 'arquivos' : 'hoje';
  const dados = await todasMaterias();
  const p = Progresso.ler();
  const link = (href, nome, rotulo, ativo) => `<a href="${href}" class="${ativo ? 'ativo' : ''}" ${ativo ? 'aria-current="page"' : ''}>${ic(nome)}<span>${rotulo}</span></a>`;

  $('#menu').innerHTML = `
    ${link('#/', 'hoje', 'Hoje', secao === 'hoje')}
    ${link('#/calendario', 'agenda', 'Agenda', secao === 'agenda')}
    ${link('#/arquivos', 'arquivos', 'Arquivos', secao === 'arquivos')}
    <div class="grupo">Matérias</div>
    ${G.materias.map((m, i) => {
      const n = devidos(dados[i].flashcards, p).length;
      return `<a href="#/materia/${m.id}" ${cor(m)} class="${m.id === atual ? 'ativo' : ''}">
        <span class="pincel"><i></i></span><span>${esc(m.nome)}</span>
        ${n ? `<span class="cont" title="${plural(n, 'card', 'cards')} para revisar">${n}</span>` : ''}</a>`;
    }).join('')}`;

  $('#barra-mobile').innerHTML = `
    ${link('#/', 'hoje', 'Hoje', secao === 'hoje')}
    ${link('#/materias', 'materias', 'Matérias', secao === 'materias')}
    ${link('#/calendario', 'agenda', 'Agenda', secao === 'agenda')}
    ${link('#/arquivos', 'arquivos', 'Arquivos', secao === 'arquivos')}`;

  $('#rodape').textContent = 'Conteúdo gerado com IA a partir das fotos da lousa. Na dúvida, vale o que o professor passou.';
  desenharPerfil();
}

function desenharPerfil() {
  const p = Progresso.ler();
  const n = nivel(p.xp), base = XP_NIVEL(n), prox = XP_NIVEL(n + 1);
  const seq = sequencia(p.dias);
  $('#perfil').innerHTML = `
    <div class="perfil-linha"><span class="nivel-selo">${n}</span>
      <div><b>Nível ${n}</b><small>${p.xp} / ${prox} XP</small></div>
      ${seq ? `<span class="fogo" title="${plural(seq, 'dia seguido', 'dias seguidos')}">${ic('fogo')}${seq}</span>` : ''}</div>
    <div class="nivel-barra"><i style="width:${(p.xp - base) / (prox - base) * 100}%"></i></div>`;
  $('#xp-mini').innerHTML = `${seq ? `<span class="fogo">${ic('fogo')}${seq}</span>` : ''}<span>${ic('xp')}${p.xp}</span>`;
}

/* ================= Início ================= */
async function paginaInicio() {
  const dados = await todasMaterias();
  const p = Progresso.ler();
  const futuros = G.avisos.filter(a => diasAte(a.data) >= 0).sort(porData);
  const destaque = futuros.find(a => a.tipo === 'prova') || futuros[0];

  const tarefas = [];
  G.materias.forEach((m, i) => {
    const n = devidos(dados[i].flashcards, p).length;
    if (n) tarefas.push(`<a class="tarefa spot" href="#/materia/${m.id}/flashcards" ${cor(m)}>
      <span class="tarefa-ic">${ic('cards')}</span>
      <span class="txt"><b>${plural(n, 'card', 'cards')} para revisar</b><span class="sub">${esc(m.nome)}</span></span></a>`);
  });
  G.recomendacoes.forEach(r => {
    const m = materiaPorId(r.materia);
    tarefas.push(`<a class="tarefa spot" href="${esc(r.link || '#/')}" ${cor(m)}>
      <span class="tarefa-ic">${ic('aula')}</span>
      <span class="txt"><b>${esc(r.titulo)}${tagExemplo(r)}</b><span class="sub">${esc(r.texto)}</span></span></a>`);
  });

  const ini = hoje(); ini.setDate(ini.getDate() - ini.getDay());
  const feitos = new Set(p.dias);
  const semana = [...Array(7)].map((_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d; });
  const seq = sequencia(p.dias);
  const hojeS = iso(hoje());

  app.innerHTML = `
    <h1 class="oculto">Hoje</h1>
    <div class="topo-inicio">
      ${quadroDestaque(destaque)}
      <section class="painel ritmo spot" aria-label="Sequência de estudo">
        <div class="ritmo-num">${ic('fogo')}<b data-contar="${seq}">${seq}</b><span>${seq === 1 ? 'dia seguido' : 'dias seguidos'}</span></div>
        <div class="semana">${semana.map((d, i) => `<div class="${iso(d) === hojeS ? 'hoje' : ''}"><i class="${feitos.has(iso(d)) ? 'feito' : ''}" style="animation-delay:${i * 50}ms"></i><span>${d.toLocaleDateString('pt-BR', { weekday: 'narrow' })}</span></div>`).join('')}</div>
      </section>
    </div>

    ${tarefas.length ? `<section class="secao"><h2>Para hoje</h2><div class="tarefas">${tarefas.join('')}</div></section>` : ''}

    <section class="secao">
      <h2>Matérias</h2>
      <div class="materias">${G.materias.map((m, i) => cartaoMateria(m, dados[i], p)).join('')}</div>
    </section>

    ${futuros.length ? `<section class="secao">
      <div class="secao-cab"><h2>Próximas datas</h2><a href="#/calendario">Agenda</a></div>
      <ul class="agenda">${futuros.slice(0, 4).map(linhaEvento).join('')}</ul></section>` : ''}`;
}

function quadroDestaque(a) {
  const pinceis = G.materias.slice(0, 3).map(m => `<i style="background:${esc(m.cor)}"></i>`).join('');
  if (!a) return `<section class="quadro">
      <span class="rotulo">Próxima prova</span>
      <p class="titulo escrever">Nada marcado</p>
      <div class="pinceis" aria-hidden="true">${pinceis}</div></section>`;
  const m = materiaPorId(a.materia);
  const n = diasAte(a.data);
  return `<section class="quadro" ${cor(m)} aria-label="Próxima data importante">
    <span class="rotulo">${a.tipo === 'prova' ? 'Próxima prova' : 'Próxima entrega'}${m ? `, ${esc(m.nome)}` : ''}${tagExemplo(a)}</span>
    <p class="titulo escrever">${esc(a.titulo)}</p>
    <div class="contagem">${n === 0 ? '<b>hoje!</b>' : n === 1 ? '<b>amanhã</b>' : `faltam <b data-contar="${n}">${n}</b> dias`}
      <span class="detalhe">${ic('hora')}${fmtData(a.data, { weekday: 'short', day: 'numeric', month: 'short' })}${a.hora ? `, ${esc(a.hora)}` : ''}</span></div>
    ${m ? `<div class="acoes"><a class="botao peq" href="#/materia/${m.id}/provas">${ic('prova')}Mini prova</a><a class="botao peq" href="#/materia/${m.id}/flashcards">${ic('cards')}Cards</a></div>` : ''}
    <div class="pinceis" aria-hidden="true">${pinceis}</div>
  </section>`;
}

function cartaoMateria(m, d, p) {
  const total = d.flashcards.length;
  const pct = total ? Math.round(dominados(d.flashcards, p) / total * 100) : 0;
  return `<a class="materia spot" href="#/materia/${m.id}" ${cor(m)}>
    <span class="sigla">${esc(m.sigla)}</span>
    <h3>${esc(m.nome)}</h3>
    <div class="nums">
      <span title="Aulas">${ic('aula')}${d.aulas.length}</span>
      <span title="Flashcards">${ic('cards')}${total}</span>
      <span title="Questões">${ic('prova')}${d.questoes.length}</span>
    </div>
    <div class="dominio" title="Quanto dos cards você já domina"><span class="barra"><i data-w="${pct}%"></i></span><span>${pct}%</span></div>
  </a>`;
}

function linhaEvento(a) {
  const m = materiaPorId(a.materia);
  const dt = paraData(a.data);
  const n = diasAte(a.data);
  return `<li class="evento-linha" ${cor(m)}>
    <div class="dia-bloco"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>
    <div class="ev-txt"><b>${esc(a.titulo)}</b>${tagExemplo(a)}
      <span class="sub"><span class="tipo">${TIPOS_AVISO[a.tipo] || 'Aviso'}</span>${m ? ` ${esc(m.nome)}` : ''}</span></div>
    <span class="falta ${n >= 0 && n <= 3 ? 'perto' : ''}">${falta(a.data)}</span>
  </li>`;
}

async function paginaListaMaterias() {
  const dados = await todasMaterias();
  const p = Progresso.ler();
  app.innerHTML = `<h1 data-blur>Matérias</h1><div class="materias">${G.materias.map((m, i) => cartaoMateria(m, dados[i], p)).join('')}</div>`;
}

/* ================= Matéria ================= */
let indicadorAnterior = null; // posição da pílula das abas, para ela deslizar
async function paginaMateria(id, aba = 'aulas', query = {}) {
  const m = materiaPorId(id);
  if (!m) return naoEncontrado();
  const d = await carregarMateria(id);
  const p = Progresso.ler();
  const pct = d.flashcards.length ? Math.round(dominados(d.flashcards, p) / d.flashcards.length * 100) : 0;
  const abas = [['aulas', 'Aulas', 'aula'], ['flashcards', 'Cards', 'cards'], ['provas', 'Provas', 'prova'], ['mapa', 'Mapa', 'mapa']];
  app.innerHTML = `
    <div ${cor(m)}>
      <header class="cab-materia">
        <div><h1 data-blur>${esc(m.nome)}</h1>
          <div class="nums"><span>${ic('aula')}${d.aulas.length}</span><span>${ic('cards')}${d.flashcards.length}</span><span>${ic('prova')}${d.questoes.length}</span></div></div>
        ${d.flashcards.length ? `<div class="anel" style="--p:${pct}" title="Quanto dos cards você já domina"><b data-contar="${pct}">${pct}</b>%</div>` : ''}
      </header>
      <nav class="segmentos" aria-label="Seções da matéria"><span class="indicador"></span>${abas.map(([k, r, i]) => `<a href="#/materia/${id}/${k}" class="${k === aba ? 'ativo' : ''}" ${k === aba ? 'aria-current="page"' : ''}>${ic(i)}${r}</a>`).join('')}</nav>
      <div id="aba" class="entra"></div>
    </div>`;
  moverIndicador(id);
  const el = $('#aba');
  if (aba === 'mapa') return abaMapa(el, m, d);
  if (aba === 'flashcards') return abaFlashcards(el, m, d, query.aula);
  if (aba === 'provas') return abaProvas(el, m, d, query.aula);
  return abaAulas(el, m, d);
}

function moverIndicador(id) {
  const nav = $('.segmentos'), ind = $('.indicador', nav), at = $('a.ativo', nav);
  if (!at) return;
  const alvo = { x: at.offsetLeft, w: at.offsetWidth };
  const de = indicadorAnterior?.id === id ? indicadorAnterior : null;
  ind.style.transition = 'none';
  ind.style.transform = `translateX(${(de || alvo).x}px)`;
  ind.style.width = `${(de || alvo).w}px`;
  if (de && !semMovimento.matches) requestAnimationFrame(() => requestAnimationFrame(() => {
    ind.style.transition = '';
    ind.style.transform = `translateX(${alvo.x}px)`;
    ind.style.width = `${alvo.w}px`;
  }));
  indicadorAnterior = { id, ...alvo };
}

function abaAulas(el, m, d) {
  // mais recentes primeiro; na mesma data (ex.: partes do guia) mantém a ordem do arquivo
  const aulas = d.aulas.map((a, i) => [a, i]).sort((x, y) => y[0].data.localeCompare(x[0].data) || x[1] - y[1]).map(x => x[0]);
  if (!aulas.length) { el.innerHTML = vazio('aula', 'Nenhuma aula ainda', `Postem as fotos no canal de ${esc(m.nome)}.`); return; }
  el.innerHTML = `<ol class="linha-tempo">${aulas.map((a, i) => `<li style="animation-delay:${i * 60}ms">
    <a class="aula-item spot" href="#/materia/${m.id}/aula/${esc(a.id)}">
      <span class="quando">${a.origem === 'guia' ? 'Guia de estudos' : (a.data_aproximada ? 'por volta de ' : '') + fmtData(a.data, { day: 'numeric', month: 'short' })}</span>
      <h3>${esc(a.titulo)}${tagExemplo(a)}</h3>
      <div>${(a.topicos || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
    </a></li>`).join('')}</ol>`;
}

function abaMapa(el, m, d) {
  if (!d.mapa || !(d.mapa.filhos || []).length) { el.innerHTML = vazio('mapa', 'Mapa vazio', 'Ele aparece com as primeiras aulas.'); return; }
  const no = (n, nivelNo) => {
    const filhos = n.filhos || [];
    const link = n.aula ? `<a href="#/materia/${m.id}/aula/${esc(n.aula)}" title="Abrir aula">${ic('fora')}</a>` : '';
    const cls = `no n${Math.min(nivelNo, 3)}`;
    if (!filhos.length) return `<li><span class="${cls}">${md(n.titulo, true)}${link}</span></li>`;
    return `<li><details ${nivelNo < 2 ? 'open' : ''}><summary class="${cls}">${md(n.titulo, true)}${link}</summary>
      <ul>${filhos.map(f => no(f, nivelNo + 1)).join('')}</ul></details></li>`;
  };
  el.innerHTML = `<div class="mapa painel"><ul>${no(d.mapa, 0)}</ul></div>`;
}

function seletorAula(d, atual, idSel) {
  return `<select id="${idSel}" aria-label="Aula"><option value="">Todas as aulas</option>${[...d.aulas].sort(porData).map(a =>
    `<option value="${esc(a.id)}" ${a.id === atual ? 'selected' : ''}>${fmtData(a.data, { day: '2-digit', month: '2-digit' })}: ${esc(a.titulo)}</option>`).join('')}</select>`;
}

const vazio = (icone, titulo, texto) => `<div class="vazio">${ic(icone)}<b>${titulo}</b>${texto ? `<span>${texto}</span>` : ''}</div>`;

/* ================= Flashcards ================= */
function abaFlashcards(el, m, d, filtroAula) {
  if (!d.flashcards.length) { el.innerHTML = vazio('cards', 'Sem cards ainda', 'Eles chegam junto com as aulas.'); return; }
  const todos = d.flashcards.filter(c => !filtroAula || c.aula === filtroAula);
  const p = Progresso.ler();
  const dev = devidos(todos, p);

  el.innerHTML = `<section class="painel inicio-cards spot">
      <div class="pilha" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="inicio-txt">
        <div class="contador"><b data-contar="${dev.length}">${dev.length}</b> para revisar</div>
        <div class="acoes">
          <button class="botao cheio" id="f-rev" ${dev.length ? '' : 'disabled'}>Revisar agora</button>
          <button class="botao" id="f-todos">Todos (${todos.length})</button>
        </div>
        ${d.aulas.length > 1 ? seletorAula(d, filtroAula, 'f-aula') : ''}
      </div>
    </section>`;
  $('#f-aula')?.addEventListener('change', e => location.hash = `#/materia/${m.id}/flashcards${e.target.value ? '?aula=' + e.target.value : ''}`);
  $('#f-rev').onclick = () => sessaoFlash(el, m, d, embaralhar(dev).slice(0, 20), filtroAula);
  $('#f-todos').onclick = () => sessaoFlash(el, m, d, embaralhar(todos), filtroAula);
}

let teclasFlash = null;
function sessaoFlash(el, m, d, fila, filtroAula) {
  let i = 0, acertos = 0, virado = false;
  const sair = () => { document.removeEventListener('keydown', teclasFlash); teclasFlash = null; };
  const responder = (sabia, botao) => {
    if (!virado) return;
    const c = fila[i];
    const p = Progresso.ler();
    const caixa = sabia ? Math.min((p.cards[c.id]?.caixa || 0) + 1, 5) : 1;
    const prox = hoje(); prox.setDate(prox.getDate() + (sabia ? INTERVALOS[caixa] : 0));
    p.cards[c.id] = { caixa, proxima: iso(prox) };
    Progresso.salvar(p);
    if (sabia) acertos++;
    const card = $('#card');
    card.classList.add(sabia ? 'sai-dir' : 'sai-esq');
    i++;
    setTimeout(mostrar, semMovimento.matches ? 0 : 260);
  };
  const virar = () => { virado = !virado; $('#card').classList.toggle('virado', virado); $('#f-botoes').classList.add('visivel'); };

  if (teclasFlash) document.removeEventListener('keydown', teclasFlash);
  teclasFlash = e => {
    if (!$('#card')) return sair();
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); virar(); }
    else if (e.key === '1' || e.key === 'ArrowLeft') responder(false);
    else if (e.key === '2' || e.key === 'ArrowRight') responder(true);
  };
  document.addEventListener('keydown', teclasFlash);

  function mostrar() {
    virado = false;
    if (i >= fila.length) {
      sair();
      Progresso.ganharXp(fila.length * 2);
      desenharMolduras(location.hash.replace(/^#/, '').split('?')[0]);
      el.innerHTML = `<div class="flash-area painel fim">
        <p class="nota"><b data-contar="${acertos}">${acertos}</b>/${fila.length}</p>
        <p class="sub">+${fila.length * 2} XP</p>
        <button class="botao cheio" id="f-volta">Voltar</button></div>`;
      Anim.aplicar(el);
      Anim.festa($('.fim', el));
      $('#f-volta').onclick = () => abaFlashcards(el, m, d, filtroAula);
      return;
    }
    const c = fila[i];
    el.innerHTML = `<div class="flash-area">
      <div class="flash-topo"><span>${i + 1}/${fila.length}</span><span>${esc(c.topico || '')}</span></div>
      <div class="progresso"><i style="width:${i / fila.length * 100}%"></i></div>
      <div class="flash entra-card" id="card" tabindex="0" role="button" aria-label="Virar o card">
        <div class="flash-interno">
          <div class="flash-face"><div class="md">${md(c.frente)}</div></div>
          <div class="flash-face verso"><div class="md">${md(c.verso)}</div></div>
        </div>
      </div>
      <div class="flash-resp" id="f-botoes">
        <button class="botao nao" id="f-errei">Não sei <kbd>1</kbd></button>
        <button class="botao sim" id="f-sabia">Sei <kbd>2</kbd></button>
      </div></div>`;
    $('#card').onclick = virar;
    $('#card').focus({ preventScroll: true });
    $('#f-errei').onclick = () => responder(false);
    $('#f-sabia').onclick = () => responder(true);
  }
  mostrar();
}

/* ================= Mini prova ================= */
function abaProvas(el, m, d, filtroAula) {
  if (!d.questoes.length) { el.innerHTML = vazio('prova', 'Sem questões ainda', 'Elas chegam junto com as aulas.'); return; }
  const historico = Progresso.ler().provas.filter(p => p.materia === m.id).slice(-5).reverse();
  el.innerHTML = `<div class="escolha">
    <section class="painel spot">
      <h2>Nova mini prova</h2>
      ${d.aulas.length > 1 ? `<label class="campo">Conteúdo ${seletorAula(d, filtroAula, 'p-aula')}</label>` : ''}
      <div class="qtd" role="radiogroup" aria-label="Quantidade de questões">
        ${[5, 10, 20].map(n => `<label><input type="radio" name="qtd" value="${n}" ${n === 10 ? 'checked' : ''}><span>${n}</span></label>`).join('')}
        <label><input type="radio" name="qtd" value="999"><span>Todas</span></label>
      </div>
      <button class="botao cheio largo" id="p-ir">Começar</button>
    </section>
    ${historico.length ? `<section class="painel"><h2>Últimas</h2><ul class="historico">${historico.map(h => {
      const pc = Math.round(h.acertos / h.total * 100);
      return `<li><span>${fmtData(h.data, { day: 'numeric', month: 'short' })}</span><span class="mini-barra"><i data-w="${pc}%"></i></span><b>${h.acertos}/${h.total}</b></li>`;
    }).join('')}</ul></section>` : ''}</div>`;
  const filtro = () => $('#p-aula')?.value || '';
  $('#p-aula')?.addEventListener('change', () => { $('#p-ir').disabled = !d.questoes.some(q => !filtro() || q.aula === filtro()); });
  $('#p-ir').onclick = () => {
    const a = filtro();
    fazerProva(el, m, d, embaralhar(d.questoes.filter(q => !a || q.aula === a)).slice(0, +$('input[name=qtd]:checked').value), a);
  };
}

function normalizar(q) {
  if (q.tipo === 'vf') return { ...q, opcoes: [{ t: 'Verdadeiro', ok: q.correta === true }, { t: 'Falso', ok: q.correta === false }] };
  if (q.tipo === 'multipla') return { ...q, opcoes: embaralhar(q.alternativas.map((t, i) => ({ t, ok: i === q.correta }))) };
  return { ...q };
}

function fazerProva(el, m, d, questoes, filtroAula) {
  const qs = questoes.map(normalizar);
  el.innerHTML = `<form id="prova" class="prova">
    <div class="prova-status" id="p-status"><div class="progresso"><i style="width:0"></i></div><span>0/${qs.length}</span></div>
    ${qs.map((q, i) => `
    <fieldset class="questao" data-i="${i}">
      <legend class="num">${i + 1}</legend>
      <div class="md enunciado">${md(q.enunciado)}</div>
      ${q.opcoes ? `<div class="alternativas">${q.opcoes.map((o, j) => `<label class="alternativa"><input type="radio" name="q${i}" value="${j}"><span class="letra">${'ABCDEFG'[j]}</span><div class="md">${md(o.t, true)}</div></label>`).join('')}</div>`
        : `<textarea aria-label="Sua resposta" placeholder="Sua resposta"></textarea>`}
      <div class="fb"></div>
    </fieldset>`).join('')}
    <div class="acoes" id="p-acoes"><button class="botao cheio" type="submit">Corrigir</button>
    <button class="botao" type="button" id="p-cancelar">Desistir</button></div></form>`;
  $('#p-cancelar').onclick = () => abaProvas(el, m, d, filtroAula);
  window.scrollTo(0, 0);

  $('#prova').addEventListener('input', () => {
    const feitas = qs.filter((q, i) => {
      const b = $(`.questao[data-i="${i}"]`);
      return q.opcoes ? $('input:checked', b) : $('textarea', b).value.trim();
    }).length;
    $('#p-status .progresso i').style.width = `${feitas / qs.length * 100}%`;
    $('#p-status span').textContent = `${feitas}/${qs.length}`;
  });

  $('#prova').onsubmit = e => {
    e.preventDefault();
    if (!$('#p-acoes')) return;
    $('#p-acoes').remove();
    $('#p-status').remove();
    let acertos = 0;
    const abertas = [];
    qs.forEach((q, i) => {
      const bloco = $(`.questao[data-i="${i}"]`);
      const fb = $('.fb', bloco);
      if (q.opcoes) {
        const marcada = $(`input[name="q${i}"]:checked`, bloco);
        const lbls = $$('.alternativa', bloco);
        q.opcoes.forEach((o, j) => { if (o.ok) lbls[j].classList.add('certa'); });
        const ok = marcada && q.opcoes[+marcada.value].ok;
        if (marcada && !ok) lbls[+marcada.value].classList.add('errada');
        if (ok) acertos++;
        bloco.classList.add(ok ? 'q-ok' : 'q-nok');
        if (q.explicacao) fb.innerHTML = `<details class="feedback"><summary>Por quê?</summary><div class="md">${md(q.explicacao)}</div></details>`;
      } else {
        abertas.push(i);
        fb.innerHTML = `<div class="feedback"><div class="md">${md(q.resposta)}</div>
          <div class="acoes"><button type="button" class="botao peq" data-ok="1">Acertei</button><button type="button" class="botao peq" data-ok="0">Errei</button></div></div>`;
      }
      $$('input,textarea', bloco).forEach(x => x.disabled = true);
    });

    const total = qs.length;
    const p = Progresso.ler();
    const registro = { materia: m.id, data: iso(hoje()), acertos, total, aula: filtroAula || null };
    p.provas.push(registro);
    p.xp += acertos * 10;
    Progresso.salvar(p); desenharPerfil();

    const placar = document.createElement('div');
    placar.className = 'painel resultado';
    let pendentes = abertas.length;
    const desenhar = () => {
      placar.innerHTML = `<p class="nota"><b>${registro.acertos}</b>/${total}</p>
        <span class="sub">${pendentes ? `Corrija ${pendentes === 1 ? 'a aberta' : `as ${pendentes} abertas`} abaixo` : `+${registro.acertos * 10} XP`}</span>
        <button class="botao cheio" type="button" id="p-nova">Outra prova</button>`;
      if (!pendentes && registro.acertos === total) Anim.festa(placar);
    };
    desenhar();
    $('#prova').prepend(placar);
    placar.addEventListener('click', ev => { if (ev.target.id === 'p-nova') abaProvas(el, m, d, filtroAula); });

    abertas.forEach(i => {
      const bloco = $(`.questao[data-i="${i}"]`);
      $$('[data-ok]', bloco).forEach(b => b.onclick = () => {
        const ok = b.dataset.ok === '1';
        if (ok) {
          const p2 = Progresso.ler();
          p2.provas[p2.provas.length - 1].acertos++; p2.xp += 10;
          Progresso.salvar(p2); desenharPerfil();
          registro.acertos++;
        }
        bloco.classList.add(ok ? 'q-ok' : 'q-nok');
        $('.acoes', bloco).remove();
        pendentes--; desenhar();
      });
    });
    window.scrollTo({ top: 0, behavior: semMovimento.matches ? 'auto' : 'smooth' });
  };
}

/* ================= Aula ================= */
async function paginaAula(mid, aid) {
  const m = materiaPorId(mid);
  if (!m) return naoEncontrado();
  const d = await carregarMateria(mid);
  const a = d.aulas.find(x => x.id === aid);
  if (!a) return naoEncontrado();
  const nCards = d.flashcards.filter(c => c.aula === a.id).length;
  const nQs = d.questoes.filter(q => q.aula === a.id).length;
  const refs = a.referencias || [];

  app.innerHTML = `<article ${cor(m)}>
    <a class="voltar" href="#/materia/${m.id}">${ic('ant')}${esc(m.nome)}</a>
    <header class="cab-aula">
      <span class="quando">${a.origem === 'guia' ? 'Do guia de estudos da turma' : a.data_aproximada ? `Data aproximada: por volta de ${fmtData(a.data, { day: 'numeric', month: 'long' })}` : fmtData(a.data, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <h1 data-blur>${esc(a.titulo)}</h1>${tagExemplo(a)}
      <div>${(a.topicos || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
    </header>

    ${nCards || nQs ? `<div class="praticar">
      ${nCards ? `<a class="botao cheio" href="#/materia/${m.id}/flashcards?aula=${esc(a.id)}">${ic('cards')}${plural(nCards, 'card', 'cards')}</a>` : ''}
      ${nQs ? `<a class="botao" href="#/materia/${m.id}/provas?aula=${esc(a.id)}">${ic('prova')}${plural(nQs, 'questão', 'questões')}</a>` : ''}
    </div>` : ''}

    ${a.fotos.length ? `<div class="galeria">${a.fotos.map((f, i) => `<button type="button" data-src="${esc(f)}" aria-label="Ampliar foto ${i + 1}"><img src="${esc(f)}" loading="lazy" alt="Foto ${i + 1} da lousa"></button>`).join('')}</div>` : ''}

    <div class="leitura">
      <section class="bloco-texto resumo md">${md(a.resumo)}</section>
      ${a.transcricao ? `<details class="na-lousa bloco-texto"><summary>Lousa</summary><div class="md">${md(a.transcricao)}</div></details>` : ''}
      ${a.aprofundamento ? `<section class="bloco-texto"><h2>Explicação</h2><div class="md">${md(a.aprofundamento)}</div></section>` : ''}
      ${(a.videos || []).length ? `<section class="bloco-texto"><h2>Assistir</h2><div class="videos">${a.videos.map(v =>
        `<a class="video spot" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">
          <span class="thumb"><img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" loading="lazy" alt=""><i class="ph-duotone ph-play-circle" aria-hidden="true"></i></span>
          <b>${esc(v.titulo)}</b><span class="sub">${esc(v.canal)}</span></a>`).join('')}</div></section>` : ''}
      ${refs.length ? `<section class="bloco-texto"><h2>Para ler</h2><div class="refs">${refs.map(r =>
        `<a class="ref spot" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="ref-ic">${ic(ICONE_REF[r.tipo] || 'link')}</span>
          <span><b>${esc(r.titulo)}</b>${r.descricao ? `<span class="sub">${esc(r.descricao)}</span>` : ''}</span>${ic('fora')}</a>`).join('')}</div></section>` : ''}
    </div>
  </article>`;
  $$('.galeria button').forEach(b => b.onclick = () => abrirFoto(b.dataset.src));
}

/* ================= Agenda ================= */
let mesCal = null;
function paginaCalendario(query) {
  if (!mesCal) { const h = hoje(); mesCal = new Date(h.getFullYear(), h.getMonth(), 1); }
  const filtro = query.materia || '';
  const avisos = G.avisos.filter(a => !filtro || a.materia === filtro).sort(porData);
  const ano = mesCal.getFullYear(), mes = mesCal.getMonth();
  const inicio = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
  const hojeS = iso(hoje());
  const dias = [...Array(42)].map((_, i) => { const dt = new Date(inicio); dt.setDate(inicio.getDate() + i); return dt; });
  const doMes = avisos.filter(a => { const dt = paraData(a.data); return dt.getMonth() === mes && dt.getFullYear() === ano; });

  app.innerHTML = `
    <div class="cal-cab">
      <h1>${mesCal.toLocaleDateString('pt-BR', { month: 'long' })} <span class="sub">${ano}</span></h1>
      <div class="acoes">
        <button class="botao peq icone-so" id="c-ant" aria-label="Mês anterior">${ic('ant')}</button>
        <button class="botao peq" id="c-hoje">Hoje</button>
        <button class="botao peq icone-so" id="c-prox" aria-label="Próximo mês">${ic('prox')}</button>
      </div>
    </div>
    <div class="filtro-materias" role="group" aria-label="Filtrar por matéria">
      <a href="#/calendario" class="${!filtro ? 'ativo' : ''}">Todas</a>
      ${G.materias.map(m => `<a href="#/calendario?materia=${m.id}" ${cor(m)} class="${m.id === filtro ? 'ativo' : ''}"><i></i>${esc(m.sigla)}</a>`).join('')}
    </div>
    <div class="cal">
      ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(s => `<div class="dsem">${s}</div>`).join('')}
      ${dias.map(dt => {
        const s = iso(dt);
        const evs = avisos.filter(a => a.data === s);
        return `<div class="dia ${dt.getMonth() !== mes ? 'fora' : ''} ${s === hojeS ? 'hoje' : ''}"><span class="n">${dt.getDate()}</span>
          ${evs.map(a => `<span class="ev" ${cor(materiaPorId(a.materia))} title="${esc(a.titulo)}">${esc(a.titulo)}</span>`).join('')}</div>`;
      }).join('')}
    </div>
    ${doMes.length ? `<ul class="agenda secao">${doMes.map(linhaEvento).join('')}</ul>` : ''}`;
  const mudar = n => { mesCal = new Date(ano, mes + n, 1); paginaCalendario(query); };
  $('#c-ant').onclick = () => mudar(-1);
  $('#c-prox').onclick = () => mudar(1);
  $('#c-hoje').onclick = () => { mesCal = null; paginaCalendario(query); };
}

/* ================= Arquivos ================= */
function paginaArquivos(query) {
  let mat = query.materia || '';
  app.innerHTML = `<h1 data-blur>Arquivos</h1>
    <div class="busca">${ic('busca')}<input type="search" id="a-busca" placeholder="Buscar" aria-label="Buscar arquivos"></div>
    <div class="filtro-materias" role="group" aria-label="Filtrar por matéria">
      <button type="button" data-m="" class="${!mat ? 'ativo' : ''}">Todas</button>
      ${G.materias.map(m => `<button type="button" data-m="${m.id}" ${cor(m)} class="${m.id === mat ? 'ativo' : ''}"><i></i>${esc(m.sigla)}</button>`).join('')}
    </div>
    <div id="a-lista"></div>`;
  const desenhar = () => {
    const busca = $('#a-busca').value.trim().toLowerCase();
    const itens = G.arquivos.filter(a => (!mat || a.materia === mat)
      && (!busca || (a.titulo + ' ' + (a.descricao || '')).toLowerCase().includes(busca)))
      .sort((a, b) => (b.adicionado_em || '').localeCompare(a.adicionado_em || ''));
    $('#a-lista').innerHTML = itens.length ? `<div class="arquivos">${itens.map(a => {
      const m = materiaPorId(a.materia), t = TIPOS_ARQUIVO[a.tipo] || TIPOS_ARQUIVO.outro;
      return `<a class="arquivo spot" href="${esc(a.arquivo || a.url)}" target="_blank" rel="noopener" ${cor(m)}>
        <span class="icone">${ic(t.icone)}</span>
        <span class="arq-txt"><b>${esc(a.titulo)}</b><span class="sub">${t.rotulo}${m ? `, ${esc(m.sigla)}` : ''}${a.descricao ? `. ${esc(a.descricao)}` : ''}</span></span>
        ${ic('fora')}</a>`;
    }).join('')}</div>` : vazio('arquivos', 'Nada encontrado', busca || mat ? 'Tente outro filtro.' : 'Postem PDFs no canal de arquivos.');
  };
  $('#a-busca').oninput = desenhar;
  $$('.filtro-materias button').forEach(b => b.onclick = () => {
    mat = b.dataset.m;
    $$('.filtro-materias button').forEach(x => x.classList.toggle('ativo', x === b));
    desenhar();
  });
  desenhar();
}

function naoEncontrado() {
  app.innerHTML = vazio('busca', 'Página não encontrada', '<a href="#/">Voltar ao início</a>');
}

/* ================= Navegação ================= */
function abrirFoto(src) { const lb = $('#lightbox'); $('img', lb).src = src; lb.hidden = false; $('button', lb).focus(); }
$('#lightbox').onclick = e => { if (e.target.tagName !== 'IMG') $('#lightbox').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lightbox').hidden = true; });

const ROTAS = [
  [/^\/?$/, () => paginaInicio()],
  [/^\/materias$/, () => paginaListaMaterias()],
  [/^\/materia\/([\w-]+)\/aula\/([\w-]+)$/, m => paginaAula(m[1], m[2])],
  [/^\/materia\/([\w-]+)(?:\/(aulas|mapa|flashcards|provas))?$/, (m, q) => paginaMateria(m[1], m[2], q)],
  [/^\/calendario$/, (m, q) => paginaCalendario(q)],
  [/^\/arquivos$/, (m, q) => paginaArquivos(q)],
];

async function rotear() {
  const [caminho, qs] = location.hash.replace(/^#/, '').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  try {
    if (!G) G = await carregar('geral');
    await desenharMolduras(caminho);
    const rota = ROTAS.find(([re]) => re.test(caminho));
    if (rota) await rota[1](caminho.match(rota[0]), query); else naoEncontrado();
    Anim.aplicar();
  } catch (e) {
    console.error(e);
    const local = location.protocol === 'file:';
    app.innerHTML = vazio('busca', 'Não foi possível abrir', esc(e.message) + (local ? '<br>Abra pelo servidor: <code>python -m http.server 8000 -d site</code>' : ''));
  }
}

let ultimoCaminho = location.hash.split('?')[0];
window.addEventListener('hashchange', () => {
  const caminho = location.hash.split('?')[0];
  const mudouPagina = caminho.replace(/\/(aulas|mapa|flashcards|provas)$/, '') !== ultimoCaminho.replace(/\/(aulas|mapa|flashcards|provas)$/, '');
  if (mudouPagina) app.classList.remove('pagina-entra');
  rotear().then(() => {
    if (mudouPagina) { void app.offsetWidth; app.classList.add('pagina-entra'); }
    if (caminho !== ultimoCaminho) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
    ultimoCaminho = caminho;
  });
});
rotear();
