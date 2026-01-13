import { detectarModoTela, deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, obterInfoRankingAtual } from "./utils.js";

const MODO_VISITANTE = document.body.dataset.modoVisitante === "true";
sessionStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");
localStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");

let tema_atual = null;
let tipo_pergunta = null;
const mensagem = document.getElementById("mensagem");
const temas = [
"Artes", "Astronomia", "Biologia", "Esportes", "Filosofia", "Geografia", "História", "Mídia", "Música", "Química", "Tecnologia", "Variedades"
];

// Widgets do modal alertando confirmação de e-mail necessária
const modal = document.getElementById("modal-email-confirmacao");
const msgModal = document.getElementById("modal-msg");

if (MODO_VISITANTE) {

  // Gera ID de visitante para o usuário caso não tenha
  let idVisitante = localStorage.getItem("id_visitante");
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante)
  }

  // Cria pontuações de usuário como visitante (obs: esta função está repetida na tela de pesquisa)
  if (!localStorage.getItem("pontuacoes_visitante")) {
      const pontuacoes = {};

      const temas = [
        "Artes", "Astronomia", "Biologia", "Esportes", "Filosofia",
        "Geografia", "História", "Mídia", "Música",
        "Química", "Tecnologia", "Variedades"
      ];

      temas.forEach(tema => {
        pontuacoes[tema] = 1500;
      });
      localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes));
  }

  // Cria as informações de perguntas e dicas restantes do usuário
  if (!localStorage.getItem("perguntas_restantes_visitante")) {
    localStorage.setItem("perguntas_restantes_visitante", 100);
  }
  if (!localStorage.getItem("dicas_restantes_visitante")) {
    localStorage.setItem("dicas_restantes_visitante", 20);
  }

  // Cria armazenamento de ids de perguntas já respondidas no localStorage
  if (!localStorage.getItem("visitante_respondidas")) {
    localStorage.setItem("visitante_respondidas", JSON.stringify({ objetiva: [], discursiva: []}));
  }

  // APENAS PARA DESENVOLVEDOR, SEMPRE COMENTAR QUANDO LANÇAR NOVAS VERSÕES
  // localStorage.setItem("visitante_respondidas", JSON.stringify({ objetiva: [], discursiva: []}));

  // Envia uma vez para o backend (PROVÁVEL REMOÇÃO EM BREVE DO TRECHO ABAIXO)
  fetch("/api/registrar_visitante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_visitante: idVisitante })
  });
}
else {
  // exibirModalEmailConfirmacao();

  // Implementa função para botão de fechar modal
  const btnFecharModal = document.getElementById("btn-fechar-modal");
  btnFecharModal.addEventListener("click", async () => {
    fecharModalEmail()
  });

  // Implementa função para botão de reenviar e-mail de confirmação
  const btnReenviarEmail = document.getElementById("btn-reenviar-email");
  btnReenviarEmail.addEventListener("click", async () => {
    reenviarEmailConfirmacao()
  });
}

document.getElementById("btn-pesquisa").style.display = "";
document.getElementById("btn-doacoes").style.display = "";
document.getElementById("btn-logout").style.display = ""

async function iniciarQuiz(event) {
  // Atualiza o tema atual, modo de jogo e tipo de pergunta no localStorage
  tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  tipo_pergunta = document.querySelector('input[name="tipo-de-pergunta"]:checked').value;
  localStorage.setItem("tema_atual", tema_atual);
  localStorage.setItem("modo_jogo", 'desafio');
  localStorage.setItem("tipo_pergunta", tipo_pergunta);

  if (!tema_atual || !tipo_pergunta) {
    console.error("Tema ou tipo de pergunta não definidos na URL.");
    return;
  }

  if (sessionStorage["modoVisitante"] === "false" && localStorage.getItem("perguntas_restantes") <= 0) {
    exibirMensagem(mensagem, 'Você precisa aguardar para obter mais perguntas no modo desafio', 'red')
    return;
  }
  exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false)

  // Carrega as perguntas para o quiz
  try {
    if (!MODO_VISITANTE) {
      const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`)
      if (response.ok) {
        const data = await response.json();

        // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
        localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
        localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisar se pode prosseguir com o quiz de acordo com o estoque de perguntas
        const perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"));
        const encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE)
        
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
      const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`)

      if (response.ok) {
        const data = await response.json();
        
        // Elimina perguntas já respondidas pelo visitante
        const respondidas = JSON.parse(localStorage.getItem("visitante_respondidas"));
        const idsRespondidas = respondidas[tipo_pergunta] || [];
        Object.keys(data.perguntas).forEach(dificuldade => {
          if (!Array.isArray(data.perguntas[dificuldade])) return;

          data.perguntas[dificuldade] = data.perguntas[dificuldade].filter(
            p => !idsRespondidas.includes(p.id_pergunta)
          );
        });

        // Analisa se há perguntas disponíveis para prosseguir com o quiz
        const encerrar_quiz = deveEncerrarQuiz(data["perguntas"], MODO_VISITANTE);
        const haPerguntas = Object.values(data.perguntas).some(arr => arr.length > 0);
        if (!haPerguntas || encerrar_quiz) {
          exibirMensagem(
            mensagem,
            `É necessário criar uma conta para ter aceso a mais perguntas ${tipo_pergunta}s no tema ${tema_atual}`,
            'orange'
          )
          registrarEvento("Perguntas esgotadas", tema_atual);
          return
        }
        registrarEvento("Tema escolhido", tema_atual)
        
        // Grava pontuações do usuário e perguntas no localStorage
        localStorage.setItem("pontuacoes_usuario", localStorage.getItem("pontuacoes_visitante"));
        localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisa os rankings atuais do usuário
        const rankings_usuario = {};
        temas.forEach( tema => {
          const ranking_no_tema = obterInfoRankingAtual(tema, MODO_VISITANTE).ranking;
          rankings_usuario[tema] = ranking_no_tema;
        })
        localStorage.setItem("rankings_usuario", JSON.stringify(rankings_usuario))
        mensagem.style.opacity = 0
        
        window.location.href = `/quiz?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`;
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
    tipo_pergunta = "discursiva";
    localStorage.setItem("tipo_pergunta", tipo_pergunta);
  }

  // Marca os inputs na tela com os valores recuperados
  const tipoRadio = document.querySelector(`input[name="tipo-de-pergunta"][value="${tipo_pergunta}"]`);
  if (tipoRadio) tipoRadio.checked = true;
}

async function carregarRegrasPontuacao() {
    
    const response = await fetch("/api/regras_pontuacao");
    const data = await response.json();

    if (!data.success) {
        console.error("Erro ao carregar regras de pontuação");
        return;
    }

    localStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao));
}

function exibirModalEmailConfirmacao() {
  if (modal) modal.classList.remove("hidden");
}

function fecharModalEmail() {
  if (modal) modal.classList.add("hidden");
}

function reenviarEmailConfirmacao() {
  if (sessionStorage.getItem("email_reenviado_neste_login")) {
    msgModal.innerText = "O e-mail de confirmação já foi reenviado neste login.";
    msgModal.style.display = "block";
    msgModal.style.color = "#b26a00";
    return;
  }

  fetch("/reenviar-email-confirmacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  })
  .then(res => res.json())
  .then(data => {
    msgModal.style.display = "block";

    if (data.success) {
      sessionStorage.setItem("email_reenviado_neste_login", "true");
      msgModal.innerText = "E-mail de confirmação reenviado com sucesso.";
      msgModal.style.color = "green";
    } else {
      msgModal.innerText = data.message || "Não foi possível reenviar o e-mail.";
      msgModal.style.color = "red";
    }
  })
  .catch(() => {
    msgModal.style.display = "block";
    msgModal.innerText = "Erro de comunicação com o servidor.";
    msgModal.style.color = "red";
  });
}

function registrarEvento(evento) {
  // Registra a escolha do tema no SQL
  fetch("/log/visitante", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      evento: evento,
      tema: tema_atual,
      modo_tela_usuario: detectarModoTela()
    })
  }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  // Carrega as regras de pontuações
  carregarRegrasPontuacao()

  // Implementa a função de clique no botão de pesquisa
  document.getElementById("btn-pesquisa").addEventListener("click", async () => {
    const response = await fetchAutenticado("/pesquisa");
    if (response.ok) {
      window.location.href = "/pesquisa";
    }
  });

  // Implementa a função de clique no botão de doações
  document.getElementById("btn-doacoes").addEventListener("click", async () => {
    if (!MODO_VISITANTE) {
      const response = await fetchAutenticado("/doações");
      if (response.ok) {
        window.location.href = "/doações";
      }
    }
    else {
      window.location.href = "/doações";
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
    nome_usuario.textContent = "Visitante"
    perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes_visitante")}/60`
    dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes_visitante")}/20`
  }
  else {
    nome_usuario.textContent = localStorage.getItem("nome_usuario")
    perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}/60`
    dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes")}/20`
  }
  // Carrega as preferências de modo de jogo e tipo de pergunta
  carregarPreferenciasQuiz();
})
