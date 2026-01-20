import { deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, obterInfoRankingAtual, temas_disponiveis } from "./utils.js";

const MODO_VISITANTE = document.body.dataset.modoVisitante === "true";
sessionStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");
localStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");

let tema_atual = null;
let tipo_pergunta = null;
const mensagem = document.getElementById("mensagem");
let permitir_escolher_tema = true;

// Widgets do modal alertando confirmação de e-mail necessária
const modal = document.getElementById("modal-email-confirmacao");
const texto_email_usuario = document.getElementById("email-usuario");
const msgModal = document.getElementById("modal-msg");

const perguntas_restantes = document.getElementById("perguntas-count")

// Botões no cabeçalho da página
const btn_criar_conta = document.getElementById("btn-criar-conta");
const btn_perfil = document.getElementById("btn-perfil");
const btn_pesquisa = document.getElementById("btn-pesquisa");
const btn_doacoes = document.getElementById("btn-doacoes");
const btn_logout = document.getElementById("btn-logout");

const radios_tipo_pergunta = document.querySelectorAll('.opcoes input[type="radio"]')

if (MODO_VISITANTE) {
  btn_criar_conta.style.display = "";
  btn_criar_conta.addEventListener("click", async () => {
    localStorage.setItem("ir_para_aba_registro", true);
    await fetch("/pagina_destino", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destino: "registro" })
    });

    window.location.href = "/";
  });

  // Gera ID de visitante para o usuário caso não tenha
  let idVisitante = localStorage.getItem("id_visitante");
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante)
  }

  // Cria pontuações de usuário como visitante (obs: esta função está repetida na tela de pesquisa)
  if (!localStorage.getItem("pontuacoes_visitante")) {
      const pontuacoes = {};
      temas_disponiveis.forEach(tema => {
        pontuacoes[tema] = 1500;
      });
      localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes));
  }

  // Cria as informações de perguntas e dicas restantes do usuário
  if (!localStorage.getItem("perguntas_restantes_visitante")) {
    localStorage.setItem("perguntas_restantes_visitante", 60);
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

  // Registra o id de visitante em session no backend
  fetch("/api/registrar_visitante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_visitante: idVisitante })
  });
}
else {
  btn_doacoes.style.display = "";
  exibirModalEmailConfirmacao();

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

btn_perfil.style.display = "";
btn_pesquisa.style.display = "";
btn_logout.style.display = "";

async function iniciarQuiz(event) {
  function desbloquearBotoes() {
    permitir_escolher_tema = true;
    radios_tipo_pergunta.forEach(radio => {
      radio.onclick = null;
  })};

  if (!permitir_escolher_tema) return;

  // Bloqueia alteração no tipo de pergunta ou on tema quando se está iniciando quiz
  radios_tipo_pergunta.forEach(radio => {
    radio.onclick = (e) =>
      e.preventDefault();
  });
  permitir_escolher_tema = false;

  // Atualiza o tema atual, modo de jogo e tipo de pergunta no localStorage
  tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  tipo_pergunta = document.querySelector('input[name="tipo-de-pergunta"]:checked').value;
  localStorage.setItem("tema_atual", tema_atual);
  localStorage.setItem("modo_jogo", 'desafio');
  localStorage.setItem("tipo_pergunta", tipo_pergunta);

  if (!tema_atual || !tipo_pergunta) {
    console.error("Tema ou tipo de pergunta não definidos na URL.");
    desbloquearBotoes();
    return;
  }

  // Mensagem avisando que as perguntas acabaram
  if (parseInt(perguntas_restantes.textContent) <= 0) {
    if (!MODO_VISITANTE) {
      exibirMensagem(mensagem, `Você precisa aguardar para poder responder novas perguntas`, 'orange')
    }
    else {
      exibirMensagem(
        mensagem, `É necessário criar uma conta para ter aceso ao conteúdo completo do jogo`, 'orange'
      ) 
    }
    desbloquearBotoes();
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
          exibirMensagem(mensagem, `Você não possui novas perguntas ${tipo_pergunta}s disponíveis para o tema ${tema_atual} no momento`, 'orange')
          desbloquearBotoes();
          return
        }
      }
    }
    else {
      const response = await fetch(`/api/perguntas?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`)
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
          desbloquearBotoes();
          return
        }
        
        // Grava pontuações do usuário e perguntas no localStorage
        localStorage.setItem("pontuacoes_usuario", localStorage.getItem("pontuacoes_visitante"));
        localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisa os rankings atuais do usuário
        const rankings_usuario = {};
        temas_disponiveis.forEach( tema => {
          const ranking_no_tema = obterInfoRankingAtual().ranking;
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
    // Permite alterar novamente o tipo de pergunta e tema
    desbloquearBotoes();
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

async function exibirModalEmailConfirmacao() {
  try {
      const response = await fetch('/pegar_email_confirmado', {
          method: 'GET',
          credentials: 'include' 
      });

      if (!response.ok) throw new Error("Erro na requisição");

      const dados = await response.json();
      const email_confirmado = dados.email_confirmado;
      const email_usuario = dados.email_usuario;

      if (modal && !email_confirmado) {
        texto_email_usuario.textContent = `${email_usuario}`

        
        modal.classList.remove("hidden");
      }
  } catch (error) {
      console.error("Erro ao buscar e-mail do usuário:", error);
  }
}

function fecharModalEmail() {
  if (modal) modal.classList.add("hidden");
}

function reenviarEmailConfirmacao() {

  if (sessionStorage.getItem("email_reenviado_neste_login")) {
    msgModal.innerText = "Um e-mail de confirmação já foi enviado recentemente";
    msgModal.style.display = "block";
    msgModal.style.color = "orange";
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
      msgModal.innerText = "E-mail de confirmação reenviado com sucesso";
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

document.addEventListener("DOMContentLoaded", () => {

  // Carrega as regras de pontuações
  carregarRegrasPontuacao()

  // Implementa a função de clique no botão de perfil
  btn_perfil.addEventListener("click", async () => {
    window.location.href = "/perfil";
  });

  // Implementa a função de clique no botão de pesquisa
  btn_pesquisa.addEventListener("click", async () => {
    const response = await fetchAutenticado("/pesquisa");
    if (response.ok) {
      window.location.href = "/pesquisa";
    }
  });

  // Implementa a função de clique no botão de doações
  btn_doacoes.addEventListener("click", async () => {
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
  btn_logout.addEventListener("click", async () => {
    await fetch("/pagina_destino", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destino: "login_de_home" })
    });

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
  
  radios_tipo_pergunta.forEach(radio => {
    radio.disabled = false;
  })

})
