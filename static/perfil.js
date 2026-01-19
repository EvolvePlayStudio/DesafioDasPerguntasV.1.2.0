const MODO_VISITANTE = localStorage.getItem("modoVisitante") === "true";
let pontuacoes = {};
let animando = false;
const select = document.getElementById("ordenacao");

document.addEventListener("DOMContentLoaded", iniciarPerfil);

async function iniciarPerfil() {
  try {
    if (MODO_VISITANTE) {
      pontuacoes = JSON.parse(localStorage.getItem("pontuacoes_visitante")) || {};
    } else {
      pontuacoes = await buscarPontuacoesBackend();
    }

    // Ordem padrão: maior pontuação
    ordenarTemas("pontuacao-desc", pontuacoes);
    await animarBarrasSequencialmente(pontuacoes);

  } catch (erro) {
    console.error("Erro ao inicializar perfil:", erro);
    aplicarPontuacoes(pontuacoes); // fallback visual
  }
}

document.getElementById("ordenacao").addEventListener("change", (e) => {
  if (animando || !pontuacoes) return;

  ordenarTemas(e.target.value, pontuacoes);
});

document.getElementById("btn-voltar-menu").addEventListener("click", () => {
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

    requestAnimationFrame(() => {
      barra.style.width = percentual + "%";
    });
  });
}

async function animarBarrasSequencialmente(pontuacoes) {
  animando = true;
  
  select.disabled = true;

  const TEMAS_MAX_PONTOS = 5000;
  const temas = document.querySelectorAll(".tema-item");

  for (const temaItem of temas) {
    const tema = temaItem.dataset.tema;
    const pontos = pontuacoes[tema] || 0;

    const barra = temaItem.querySelector(".barra-progresso");
    const spanPontos = temaItem.querySelector(".tema-pontos");

    const percentual = Math.min((pontos / TEMAS_MAX_PONTOS) * 100, 100);
    const duracao = calcularDuracao(percentual);

    spanPontos.textContent = `${pontos} pts`;

    barra.style.transition = "none";
    barra.style.width = "0%";
    barra.offsetWidth;

    barra.style.transition = `width ${duracao}ms cubic-bezier(0.4,0,0.2,1)`;

    await animarBarraAte(barra, percentual);
    await new Promise(r => setTimeout(r, 80));
  }

  animando = false;
  select.disabled = false;
}

function aplicarPontuacoes(pontuacoes) {
  const TEMAS_MAX_PONTOS = 5000;

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

  } catch (erro) {
    console.error("Falha ao buscar pontuações do servidor:", erro);
    return {}; // fallback seguro
  }
}

function calcularDuracao(percentual) {
  const DURACAO_MAX = 900; // ms
  const DURACAO_MIN = 350; // ms

  return (
    DURACAO_MAX -
    (percentual / 100) * (DURACAO_MAX - DURACAO_MIN)
  );
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

    if (modo === "pontuacao-asc") {
      return (pontuacoes[temaA] || 0) - (pontuacoes[temaB] || 0);
    }

    return 0;
  });

  temas.forEach(t => lista.appendChild(t));
}