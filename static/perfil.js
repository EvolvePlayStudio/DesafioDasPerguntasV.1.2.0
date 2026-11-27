import { playSound } from "./sound.js"
import { maxPontuacaoTema, maxPontuacaoTotal, pontuacaoTemaPadraoVisitantes, registrarLog, sincronizarPontuacoesVisitante} from "./utils.js";

const MODO_VISITANTE = localStorage.getItem("modoVisitante") === "true";
let pontuacoes = {};
let animando = false;
const select = document.getElementById("ordenacao");
const barraProgressoTotal = document.getElementById("barra-progresso-total");
const spanPontosTotais = document.getElementById("pontos-totais");
const spanPorcentagemProgresso = document.getElementById("porcentagem-progresso");
const ORDEM_TIER = {bronze: 1, prata: 2, ouro: 3};
let filtroConquistasAtual = "todas";
const formatadorNumero = new Intl.NumberFormat("pt-BR");
const selectFiltroConquistas = document.getElementById("filtro-conquistas");
const MEDALHAS_TIER = {bronze: "🥉", prata: "🥈", ouro: "🥇"};
const CONQUISTAS_CATALOGO = [
  // 1. Volume Geral
  { id: "respondidas_bronze", tier: "bronze", titulo: "Primeiros Passos", descricao: "Responda 10 perguntas.", meta: 10 },
  { id: "respondidas_prata", tier: "prata", titulo: "Ritmo Constante", descricao: "Responda 400 perguntas.", meta: 400 },
  { id: "respondidas_ouro", tier: "ouro", titulo: "Veterano do Quiz", descricao: "Responda 1.200 perguntas.", meta: 1200 },

  // 2. Ranking
  { id: "ranking_bronze", tier: "bronze", titulo: "Caminho do Estudante", descricao: "Alcance o ranking Estudante em 1 tema ou Aprendiz em 6.", meta: 6 },
  { id: "ranking_prata", tier: "prata", titulo: "Caminho do Sábio", descricao: "Alcance o ranking Sábio em 1 tema ou Estudante em 6.", meta: 6 },
  { id: "ranking_ouro", tier: "ouro", titulo: "Lenda Viva", descricao: "Alcance o ranking Lenda em 1 tema ou Sábio em 6.", meta: 6 },

  // 3. Pontos — Ciências da Natureza (Astronomia, Biologia, Física, Química)
  { id: "natureza_bronze", tier: "bronze", titulo: "Curioso da Natureza", descricao: "Atinja 4.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 4000 },
  { id: "natureza_prata", tier: "prata", titulo: "Explorador da Natureza", descricao: "Atinja 8.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 8000 },
  { id: "natureza_ouro", tier: "ouro", titulo: "Mestre da Natureza", descricao: "Atinja 12.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 12000 },

  // 4. Pontos — Ciências Humanas (História, Geografia, Filosofia)
  { id: "humanas_bronze", tier: "bronze", titulo: "Aprendiz de Humanas", descricao: "Atinja 3.000 pontos somados em História, Geografia e Filosofia.", meta: 3000 },
  { id: "humanas_prata", tier: "prata", titulo: "Explorador de Humanas", descricao: "Atinja 6.000 pontos somados em História, Geografia e Filosofia.", meta: 6000 },
  { id: "humanas_ouro", tier: "ouro", titulo: "Mestre em Humanas", descricao: "Atinja 9.000 pontos somados em História, Geografia e Filosofia.", meta: 9000 },

  // 5. Pontos — Artes e Cultura (Artes, Música, Mídia)
  { id: "cultura_bronze", tier: "bronze", titulo: "Primeira Cena", descricao: "Atinja 3.000 pontos somados em Artes, Mídia e Música.", meta: 3000 },
  { id: "cultura_prata", tier: "prata", titulo: "Cultura e Expressão", descricao: "Atinja 6.000 pontos somados em Artes, Mídia e Música.", meta: 6000 },
  { id: "cultura_ouro", tier: "ouro", titulo: "Mestre das Artes", descricao: "Atinja 9.000 pontos somados em Artes, Mídia e Música.", meta: 9000 },

  // 6. Pontos — Esportes e Variedades (Esportes, Variedades)
  { id: "variedades_bronze", tier: "bronze", titulo: "Jogo e Cotidiano", descricao: "Atinja 2.000 pontos somados em Esportes e Variedades.", meta: 2000 },
  { id: "variedades_prata", tier: "prata", titulo: "Versátil em Ação", descricao: "Atinja 4.000 pontos somados em Esportes e Variedades.", meta: 4000 },
  { id: "variedades_ouro", tier: "ouro", titulo: "Mestre do Repertório", descricao: "Atinja 6.000 pontos somados em Esportes e Variedades.", meta: 6000 },

  // 7. Acertos em Nível Específico
  { id: "superando_medio", tier: "bronze", titulo: "Superando o Médio", descricao: "Acerte 25 perguntas de nível Médio em qualquer tema.", meta: 25 },
  { id: "superando_dificil", tier: "prata", titulo: "Superando o Difícil", descricao: "Acerte 25 perguntas de nível Difícil em qualquer tema.", meta: 25 },
  { id: "superando_extremo", tier: "ouro", titulo: "Superando o Extremo", descricao: "Acerte 25 perguntas de nível Extremo em qualquer tema.", meta: 25 },

  // 8. Avaliações com Estrelas
  { id: "avaliador_bronze", tier: "bronze", titulo: "Avaliador", descricao: "Avalie 10 perguntas com estrelas.", meta: 10 },
  { id: "avaliador_prata", tier: "prata", titulo: "Crítico Frequente", descricao: "Avalie 100 perguntas com estrelas.", meta: 100 },
  { id: "avaliador_ouro", tier: "ouro", titulo: "Referência da Comunidade", descricao: "Avalie 300 perguntas com estrelas.", meta: 300 },

  // 9. Progresso Total
  { id: "progresso_bronze", tier: "bronze", titulo: "Impulso Inicial", descricao: "Alcance 10% de progresso total (6.000 pts).", meta: 10 },
  { id: "progresso_prata", tier: "prata", titulo: "Base Sólida", descricao: "Alcance 30% de progresso total (18.000 pts).", meta: 30 },
  { id: "progresso_ouro", tier: "ouro", titulo: "Domínio Avançado", descricao: "Alcance 60% de progresso total (36.000 pts).", meta: 60 }
];


document.addEventListener("DOMContentLoaded", () => {
  configurarAbas();
  iniciarPerfil();
});

function formatarValorConquista(valor) {
  return formatadorNumero.format(Number(valor) || 0);
}

if (selectFiltroConquistas) {
  selectFiltroConquistas.addEventListener("change", (e) => {
    if (MODO_VISITANTE) return;
    playSound("click");
    renderizarConquistas(CONQUISTAS_CATALOGO, estadoConquistas, e.target.value);
  });
}

function renderizarAvisoVisitanteConquistas() {
  const lista = document.getElementById("lista-conquistas");
  const filtro = document.getElementById("filtro-conquistas");
  if (filtro) filtro.style.display = "none";
  if (!lista) return;

  lista.innerHTML = `
    <div class="aviso-visitante-conquistas">
      <p class="aviso-visitante-titulo">🔒 Conquistas disponíveis para contas cadastradas</p>
      <p class="aviso-visitante-texto">Crie uma conta para liberar as conquistas e salvar seu progresso de troféus.</p>
    </div>
  `;
}

function configurarAbas() {
  const abas = document.querySelectorAll(".aba-btn");
  const paineis = document.querySelectorAll(".painel-aba");

  abas.forEach(aba => {
    aba.addEventListener("click", () => {
      playSound("click");
      // Rola a scroll para o topo ao trocar de aba
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: "instant" });

      const alvo = aba.getAttribute("aria-controls");
      abas.forEach(btn => btn.setAttribute("aria-selected", String(btn === aba)));
      paineis.forEach(painel => {painel.classList.toggle("ativo", painel.id === alvo)});

      if (alvo === "painel-conquistas" || alvo.includes("conquista")) {
        registrarLog('Perfil - Conquistas');
        if (MODO_VISITANTE) {renderizarAvisoVisitanteConquistas()}
        else {renderizarConquistas(CONQUISTAS_CATALOGO, estadoConquistas, filtroConquistasAtual)};
      }
    });
  });
}

function renderizarConquistas(catalogo, estadoUsuario = {}, filtro = filtroConquistasAtual) {
  const lista = document.getElementById("lista-conquistas");
  if (!lista) return;

  filtroConquistasAtual = filtro;

  const itensOrdenados = [...catalogo].sort((a, b) => {
    const pesoA = ORDEM_TIER[a.tier] ?? 99;
    const pesoB = ORDEM_TIER[b.tier] ?? 99;
    return pesoA - pesoB;
  });

  const itensFiltrados = itensOrdenados.filter(item => {
    const info = estadoUsuario[item.id] || {};
    const desbloqueada = Boolean(info.desbloqueada);

    if (filtro === "desbloqueadas") return desbloqueada;
    if (filtro === "bronze" || filtro === "prata" || filtro === "ouro") {
      return item.tier === filtro;
    }
    return true;
  });

  lista.innerHTML = "";

  if (itensFiltrados.length === 0) {
    lista.innerHTML = `<p class="conquista-descricao">Nenhuma conquista encontrada para este filtro.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  itensFiltrados.forEach(item => {
    const info = estadoUsuario[item.id] || {};
    const atual = Math.min(info.atual ?? 0, item.meta);
    const desbloqueada = Boolean(info.desbloqueada);
    const atualFormatado = formatarValorConquista(atual);
    const metaFormatada = formatarValorConquista(item.meta);

    const card = document.createElement("div");
    card.className = `conquista-card${desbloqueada ? " desbloqueada" : ""}`;
    card.innerHTML = `
      <div class="conquista-cabecalho">
        <span class="conquista-medalha">${MEDALHAS_TIER[item.tier] ?? "🏅"}</span>
        <span class="conquista-titulo">${item.titulo}</span>
      </div>
      <p class="conquista-descricao">${item.descricao}</p>
      <span class="conquista-progresso">${desbloqueada ? "Desbloqueada" : `${atualFormatado} / ${metaFormatada}`}</span>
    `;

    fragment.appendChild(card);
  });

  lista.appendChild(fragment);
}

let estadoConquistas = {};

async function buscarDadosPerfilBackend() {
  try {
    const res = await fetch("/api/perfil", {
      headers: { "Accept": "application/json" }
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const dados = await res.json();
    return {
      pontuacoes: dados.pontuacoes || {},
      conquistas: dados.conquistas || {}
    };
  }
  catch (erro) {
    console.error("Falha ao buscar dados do perfil:", erro);
    return { pontuacoes: {}, conquistas: {} };
  }
}

async function iniciarPerfil() {
  try {
    if (MODO_VISITANTE) {
      sincronizarPontuacoesVisitante(pontuacaoTemaPadraoVisitantes);
      pontuacoes = JSON.parse(localStorage.getItem("pontuacoes_visitante")) || {};
      renderizarAvisoVisitanteConquistas();
    }
    else {
      const dadosPerfil = await buscarDadosPerfilBackend();
      pontuacoes = dadosPerfil.pontuacoes;
      estadoConquistas = dadosPerfil.conquistas;
      renderizarConquistas(CONQUISTAS_CATALOGO, estadoConquistas, "todas");
    }

    // Ordem padrão: maior pontuação
    ordenarTemas("pontuacao-desc", pontuacoes);
    document.querySelectorAll(".tema-label").forEach(label => {
      label.style.opacity = "1";
    });
    await animarBarrasSequencialmente(pontuacoes);
  }
  catch (erro) {
    console.error("Erro ao inicializar perfil:", erro);
    aplicarPontuacoes(pontuacoes);
  }
}

document.getElementById("ordenacao").addEventListener("change", (e) => {
  if (animando || !pontuacoes) return;
  ordenarTemas(e.target.value, pontuacoes);
});

document.getElementById("btn-voltar-menu").addEventListener("click", () => {
  playSound("click");
  window.location.href = "/home";
});

function animarBarraAte(barra, percentual) {
  return new Promise(resolve => {
    const onEnd = (e) => {
      if (e.propertyName === "width") {
        barra.removeEventListener("transitionend", onEnd);
        resolve();
      }
    };

    barra.addEventListener("transitionend", onEnd);
    requestAnimationFrame(() => barra.style.width = percentual + "%");
  });
}

async function animarBarrasSequencialmente(pontuacoes) {
  animando = true;
  select.disabled = true;
  const temas = Array.from(document.getElementById("lista-temas").children);

  const totalFinal = Object.values(pontuacoes).reduce((acc, val) => acc + val, 0);
  const percentualTotal = Math.min((totalFinal / maxPontuacaoTotal) * 100, 100);

  // Animação da barra e porcentagem de progresso total
  animarBarraAte(barraProgressoTotal, percentualTotal),
  animarNumero(spanPontosTotais, 0, totalFinal, 7000, maxPontuacaoTotal),
  animarPorcentagem(spanPorcentagemProgresso, 0, percentualTotal, 7000)

  for (const temaItem of temas) {
    const tema = temaItem.dataset.tema;
    const pontos = pontuacoes[tema] || 0;
    if (pontos === 0) continue;

    const barraTema = temaItem.querySelector(".barra-progresso");
    const spanPontosTema = temaItem.querySelector(".tema-pontos");

    const percentualTema = Math.min((pontos / maxPontuacaoTema) * 100, 100);
    const duracao = calcularDuracao(percentualTema);

    barraTema.style.transition = "none";
    barraTema.style.width = "0%";
    barraTema.offsetWidth;
    barraTema.style.transition = `width ${duracao}ms cubic-bezier(0.4,0,0.2,1)`;
    await Promise.all([
      animarBarraAte(barraTema, percentualTema),
      animarNumero(spanPontosTema, 0, pontos, duracao, maxPontuacaoTema),
    ]);
    
    //await new Promise(r => setTimeout(r, 80)); // pausa entre as animações
  }

  animando = false;
  select.disabled = false;
}

function animarPorcentagem(elemento, inicio, fim, duracao) {
  return new Promise(resolve => {
    if (!elemento) {
      resolve();
      return;
    }
    const inicioTempo = performance.now();

    function atualizar(tempoAtual) {
      const progresso = Math.min((tempoAtual - inicioTempo) / duracao, 1);
      const valorAtual = inicio + (fim - inicio) * progresso;

      elemento.textContent = `(${valorAtual.toFixed(1)}%)`;

      if (progresso < 1) requestAnimationFrame(atualizar);
      else {
        elemento.textContent = `(${fim.toFixed(1)}%)`;
        resolve();
      }
    }

    requestAnimationFrame(atualizar);
  });
}

function animarNumero(elemento, inicio, fim, duracao, maxPontos) {
  return new Promise(resolve => {
    const inicioTempo = performance.now();

    function atualizar(tempoAtual) {
      const progresso = Math.min((tempoAtual - inicioTempo) / duracao, 1);
      const valorAtual = Math.floor(inicio + (fim - inicio) * progresso);

      elemento.textContent = `${valorAtual} / ${maxPontos} pts`;

      if (progresso < 1) requestAnimationFrame(atualizar);
      else resolve();
    }

    requestAnimationFrame(atualizar);
  });
}

function aplicarPontuacoes(pontuacoes) {
  document.querySelectorAll(".tema-item").forEach(item => {
    const tema = item.dataset.tema;
    const pontos = pontuacoes[tema] || 0;
    const spanPontos = item.querySelector(".tema-pontos");
    const barra = item.querySelector(".barra-progresso");
    spanPontos.textContent = `${pontos} pts`;
    const percentual = Math.min((pontos / maxPontuacaoTema) * 100, 100);
    barra.style.width = `${percentual}%`;
  });
}

function calcularDuracao(percentual) {
  const DURACAO_MAX = 900; // ms
  const DURACAO_MIN = 350; // ms
  return (DURACAO_MAX - (percentual / 100) * (DURACAO_MAX - DURACAO_MIN));
}

function ordenarTemas(modo, pontuacoes) {
  const lista = document.getElementById("lista-temas");
  const temas = Array.from(lista.children);

  temas.sort((a, b) => {
    const temaA = a.dataset.tema;
    const temaB = b.dataset.tema;

    if (modo === "nome-tema") {
      return temaA.localeCompare(temaB);
    }

    if (modo === "pontuacao-desc") {
      return (pontuacoes[temaB] || 0) - (pontuacoes[temaA] || 0);
    }

    return 0;
  });

  temas.forEach(t => lista.appendChild(t));
}