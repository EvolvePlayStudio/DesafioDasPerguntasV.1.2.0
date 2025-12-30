import { deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, obterInfoRankingAtual } from "./utils.js";

const MODO_VISITANTE =
  document.body.dataset.modoVisitante === "true";

sessionStorage.setItem(
  "modoVisitante",
  MODO_VISITANTE ? "true" : "false"
);

let tipo_pergunta = null;
const mensagem = document.getElementById("mensagem");

// Abaixo estão códigos relacionados à mensagem que aparece quando o usuário entra no modo visitante ou loga pela primeira vez
const overlayVisitante = document.getElementById("overlay-visitante");
const btnEntendi = document.getElementById("btn-entendi");

const modalOnboarding = document.getElementById("modal-onboarding");
const btnOnboardingOk = document.getElementById("btn-onboarding-ok");

if (sessionStorage.getItem("modoVisitante") === "true") {
  const jaViuAviso = sessionStorage.getItem("avisoVisitanteExibido");

  if (!jaViuAviso) {
    overlayVisitante.classList.remove("hidden");
  }
}
else {
  const onboarding_concluido = localStorage.getItem("onboarding_concluido");
  if (onboarding_concluido === "false") {
    // Mandei printar no terminal, sei que está chegando aqui
    modalOnboarding.classList.remove("hidden");
  }
}

async function iniciarQuiz(event) {
  // Atualiza o tema atual e modo de jogo no localStorage
  const tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  localStorage.setItem("tema_atual", tema_atual)
  localStorage.setItem("modo_jogo", 'desafio')

  // Atualiza o tipo de pergunta no localStorage (objetiva ou discursiva)
  tipo_pergunta = document.querySelector('input[name="tipo-de-pergunta"]:checked').value;
  localStorage.setItem("tipo_pergunta", tipo_pergunta)

  if (!tema_atual || !tipo_pergunta) {
    console.error("Tema ou tipo de pergunta não definidos na URL.");
    return;
  }

  if (sessionStorage["modoVisitante"] === "false" && localStorage.getItem("perguntas_restantes") <= 0) {
    exibirMensagem(mensagem, 'Você precisa aguardar para obter mais perguntas no modo desafio', 'red')
    return;
  }
  
  console.log("Modo visitante?", sessionStorage["modoVisitante"])
  exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false)

  // Carrega as perguntas para o quiz
  try {
    if (sessionStorage["modoVisitante"] === "false") {
      const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`)
      if (response.ok) {
        const data = await response.json();

        // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
        localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
        localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisar se pode prosseguir com o quiz de acordo com o estoque de perguntas
        const perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"));
        const encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade)
        
        // Analisa o ranking atual do usuário (ATENÇÃO, já procura ranking na função deveEncerrarQuiz, o que pode ser uma perda de eficiência aqui)
        const rankings_usuario = {};
        Object.keys(data["pontuacoes_usuario"]).forEach(tema => {
          const ranking_no_tema = obterInfoRankingAtual(tema).ranking
          rankings_usuario[tema] = ranking_no_tema
        })
        localStorage.setItem("rankings_usuario", JSON.stringify(rankings_usuario))
      
        // Chama a tela de quiz ou exibe mensagem caso não haja perguntas disponíveis
        const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
        const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)

        if (ha_perguntas_disponiveis && !encerrar_quiz) {
          mensagem.style.opacity = 0
          window.location.href = `/quiz?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`;
        }
        else {
          exibirMensagem(mensagem, `Você não possui novas perguntas ${tipo_pergunta}s disponíveis neste tema no momento`, 'red')
        }
      }
    }
    else { // Modo visitante
      localStorage.setItem("modo_jogo", 'revisao')
      const response = await fetch(`/api/perguntas?tema=${tema_atual}&modo=revisao&tipo-de-pergunta=${tipo_pergunta}`)

      if (response.ok) {
        const data = await response.json();

        localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
        localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        const rankings_usuario = {};
        Object.keys(data["pontuacoes_usuario"]).forEach(tema => {
          rankings_usuario[tema] = "Estudante"
        })

        localStorage.setItem("rankings_usuario", JSON.stringify(rankings_usuario))
        mensagem.style.opacity = 0
        window.location.href = `/quiz?tema=${tema_atual}&modo=revisao&tipo-de-pergunta=${tipo_pergunta}`;
      }
    }
  }
  catch (error) {
    console.error("Erro ao carregar perguntas", error)
  }
}

function carregarPreferenciasQuiz() {
  // Pega valores salvos
  tipo_pergunta = localStorage.getItem("tipo_pergunta");

  // Se não existirem, define valores padrão
  if (!tipo_pergunta) {
    tipo_pergunta = "objetiva";
    localStorage.setItem("tipo_pergunta", tipo_pergunta);
  }

  // Marca os inputs na tela com os valores recuperados
  const tipoRadio = document.querySelector(`input[name="tipo-de-pergunta"][value="${tipo_pergunta}"]`);
  if (tipoRadio) tipoRadio.checked = true;
}

document.addEventListener("DOMContentLoaded", () => {
  // Implementa a função de clique no botão de doações
  document.getElementById("btn-doacoes").addEventListener("click", async () => {
    if (sessionStorage.getItem("modoVisitante") === "false") {
      const response = await fetchAutenticado("/doações");
      if (response.ok) {
        window.location.href = "/doações";
      }
    }
    else {
      window.location.href = "/doações";
    }
    });
  
  // Implementa função de clique no botão para confirmar mensagem ao entrar em Home como visitante
  btnEntendi.addEventListener("click", () => {
    overlayVisitante.classList.add("hidden");
    sessionStorage.setItem("avisoVisitanteExibido", "true");
  });

  // Implementa função de clique no botão para confirmar mensagem ao logar pela primeira vez
  btnOnboardingOk.addEventListener("click", async () => {
    modalOnboarding.classList.add("hidden");
    try {
      await fetchAutenticado("/api/onboarding/concluir", {
        method: "POST",
        credentials: "include"
      });
      localStorage.setItem("onboarding_concluido", "true");
    }
    catch (e) {
      console.error("Erro ao concluir onboarding");
    }
  });

  // Implementa a função de clique no botão de pesquisa
  document.getElementById("btn-pesquisa").addEventListener("click", async () => {
    if (sessionStorage.getItem("modoVisitante") === "false") {
      const response = await fetchAutenticado("/pesquisa");
      if (response.ok) {
        window.location.href = "/pesquisa";
      }
    }
    else {
      exibirMensagem(mensagem, "É preciso criar uma conta para acessar o mecanismo de pesquisa de perguntas", 'red')
    }
  });

  // Implementa a função de clique no botão de logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    window.location.href = "/"
  })

  // Implementa a função de ir para a página home
  document.getElementById("link-home").addEventListener("click", async (e) => {
    e.preventDefault();
    window.location.href = "/home";
  });

  // Implementa a função de clique nos temas
  document.querySelectorAll(".tema-card").forEach(card => {
  card.addEventListener("click", iniciarQuiz);
  });

  // Define as variáveis do cabeçalho
  const nome_usuario = document.getElementById("user-name")
  const perguntas_restantes = document.getElementById("perguntas-count")
  const dicas_restantes = document.getElementById("dicas-count")

  // Define o nome de usuário, as perguntas e dicas disponíveis e máximas para o usuário
  if (sessionStorage.getItem("modoVisitante") === "true") {
    console.log("Estou no modo visitante")
    nome_usuario.textContent = "Visitante"
    perguntas_restantes.textContent = "100/100"
    dicas_restantes.textContent = "20/20"
  }
  else {
    console.log("Não estou no modo visitante")
    nome_usuario.textContent = localStorage.getItem("nome_usuario")
    perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}/100`
    dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes")}/20`
  }
  // Carrega as preferências de modo de jogo e tipo de pergunta
  carregarPreferenciasQuiz();
})
