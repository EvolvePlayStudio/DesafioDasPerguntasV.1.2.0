import { playSound } from "./sound.js"
import { pontuacaoTemaPadraoVisitantes, sincronizarPontuacoesVisitante} from "./utils.js";

const MODO_VISITANTE = sessionStorage.getItem("modoVisitante") === "true";
let pontuacoes = {};
let animando = false;
let temas = document.querySelectorAll(".tema-item");
const select = document.getElementById("ordenacao");
const TEMAS_MAX_PONTOS = 5000;
const TOTAL_MAX_PONTOS = TEMAS_MAX_PONTOS * (temas.length - 1);
const barraProgressoTotal = document.getElementById("barra-progresso-total");
const spanPontosTotais = document.getElementById("pontos-totais");

document.addEventListener("DOMContentLoaded", iniciarPerfil);

async function iniciarPerfil() {
  try {
    if (MODO_VISITANTE) {
      sincronizarPontuacoesVisitante(pontuacaoTemaPadraoVisitantes);
      pontuacoes = JSON.parse(localStorage.getItem("pontuacoes_visitante")) || {};
    }
    else pontuacoes = await buscarPontuacoesBackend();

    // Ordem padrão: maior pontuação
    ordenarTemas("pontuacao-desc", pontuacoes);
    document.querySelectorAll(".tema-label").forEach(label => {
      label.style.opacity = "1";
    });
    await animarBarrasSequencialmente(pontuacoes);
  }
  catch (erro) {
    console.error("Erro ao inicializar perfil:", erro);
    aplicarPontuacoes(pontuacoes); // fallback visual
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
  const percentualTotal = Math.min((totalFinal / TOTAL_MAX_PONTOS) * 100, 100);

  // Animação da barra de progresso total
  animarBarraAte(barraProgressoTotal, percentualTotal),
  animarNumero(spanPontosTotais, 0, totalFinal, 7000, TOTAL_MAX_PONTOS)

  for (const temaItem of temas) {
    const tema = temaItem.dataset.tema;
    const pontos = pontuacoes[tema] || 0;
    if (pontos === 0) continu

    const barraTema = temaItem.querySelector(".barra-progresso");
    const spanPontosTema = temaItem.querySelector(".tema-pontos");

    const percentualTema = Math.min((pontos / TEMAS_MAX_PONTOS) * 100, 100);
    const duracao = calcularDuracao(percentualTema);

    barraTema.style.transition = "none";
    barraTema.style.width = "0%";
    barraTema.offsetWidth;
    barraTema.style.transition = `width ${duracao}ms cubic-bezier(0.4,0,0.2,1)`;
    await Promise.all([
      animarBarraAte(barraTema, percentualTema),
      animarNumero(spanPontosTema, 0, pontos, duracao, TEMAS_MAX_PONTOS),
    ]);
    
    //await new Promise(r => setTimeout(r, 80)); // pausa entre as animações
  }

  animando = false;
  select.disabled = false;
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
    const percentual = Math.min((pontos / TEMAS_MAX_PONTOS) * 100, 100);
    barra.style.width = `${percentual}%`;
  });
}

async function buscarPontuacoesBackend() {
  try {
    const res = await fetch("/api/pontuacoes", {
      headers: { "Accept": "application/json" }
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const dados = await res.json();
    return dados || {};

  }
  catch (erro) {
    console.error("Falha ao buscar pontuações do servidor:", erro);
    return {}; // fallback seguro
  }
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