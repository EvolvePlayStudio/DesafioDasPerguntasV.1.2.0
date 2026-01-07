import { detectarModoTela, deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, obterInfoRankingAtual } from "./utils.js";

const MODO_VISITANTE =
  document.body.dataset.modoVisitante === "true";

sessionStorage.setItem(
  "modoVisitante",
  MODO_VISITANTE ? "true" : "false"
);

let tipo_pergunta = null;
const mensagem = document.getElementById("mensagem");

// Widgets da mensagem inicial para quem se cadastrou
const modalOnboarding = document.getElementById("modal-onboarding");
const btnOnboardingOk = document.getElementById("btn-onboarding-ok");

// Widgets da mensagem inicial para quem entra no modo visitante
const overlayVisitante = document.getElementById("overlay-visitante");
const btnEntendi = document.getElementById("btn-entendi");
const tituloModal = document.getElementById('titulo-modal');
const conteudoModal = document.getElementById('conteudo-modal');
const tituloInicialVisitante = tituloModal.innerText;
const CONTEUDO_AVISO_VISITANTE = `
  <p>
    Se estiver navegando por smartphone ou tablet e o modo <strong>“Site para computador”</strong> estiver desativado:
  </p>
  <ul>
    <li>Elementos como pontuação e ranking podem ficar ocultos durante o quiz</li>
    <li>Elementos da interface ficam desajustados, com quebras de linhas indevidas e outros problemas</li>
  </ul>
  <p>
    <a href="#" id="link-tutorial">
      Ver como ativar o modo “Site para computador”
    </a>
  </p>

  <p>
    Além disso, tenha em mente que no modo visitante:
  </p>

  <ul>
    <li>Sua pontuação não é salva</li>
    <li>A quantidade de perguntas é limitada</li>
    <li>Não há pesquisa nem revisão de perguntas</li>
  </ul>

  <p>
    Para liberar mais de 1000 perguntas exclusivas e outras funcionalidades do jogo, será necessário criar uma conta.
  </p>
`
const conteudoInicialVisitante = CONTEUDO_AVISO_VISITANTE;
const CONTEUDO_TUTORIAL_MODO_DESKTOP = `
  <p>
    Siga os passos abaixo para ativar o modo
    <strong>“Site para computador”</strong>
    <span class="exemplo-navegador">(exemplo no navegador Chrome):</span>
  </p>

  <ol class="tutorial-lista">
    <li>
      <span>Toque nos três pontos no canto superior direito</span>
      <img src="static/img/ModoSiteParaComputadorComSeta01.jpg" alt="Abrir menu do navegador">
    </li>

    <li>
      <span>Ative a opção “Site para computador”</span>
      <img src="static/img/ModoSiteParaComputadorComSeta02.jpg" alt="Ativar site para computador">
    </li>

    <li>
      <span>Recarregue a página, se necessário</span>
    </li>
  </ol>

  <p>
    Após ativar, a pontuação e o ranking aparecerão corretamente durante o quiz.
  </p>
`;

if (sessionStorage.getItem("modoVisitante") === "true") {
  // Muda o texto do botão de logout para "criar conta"
  document.getElementById("btn-logout").textContent = "Criar conta";
  document.getElementById("btn-tutorial").style.display = "";

  // Evita repetição do aviso para quem entra
  const jaViuAviso = sessionStorage.getItem("avisoVisitanteExibido");
  
  if (!jaViuAviso) {
    abrirTutorial();
  }

  // Gera ID de visitante para o usuário caso não tenha
  let idVisitante = localStorage.getItem("id_visitante");
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante);
  }

  // Envia uma vez para o backend
  fetch("/api/registrar_visitante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_visitante: idVisitante })
  });
}
else {
  document.getElementById("btn-pesquisa").style.display = ""
  document.getElementById("btn-doacoes").style.display = ""
  const onboarding_concluido = localStorage.getItem("onboarding_concluido");
  if (onboarding_concluido === "false") {
    // Mandei printar no terminal, sei que está chegando aqui
    modalOnboarding.classList.remove("hidden");
  }
}
document.getElementById("btn-logout").style.display = ""

function abrirTutorial() {
  tituloModal.innerText = tituloInicialVisitante;
  conteudoModal.innerHTML = conteudoInicialVisitante;

  document.getElementById('btn-voltar-tutorial').classList.add('hidden')
  overlayVisitante.classList.remove('hidden');
  overlayVisitante.querySelector('.modal').classList.remove('tutorial-aberto');

  overlayVisitante.classList.remove('hidden');

  registrarAcessoPagina("tutorial_modo_tela_aberto");
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
      // Registra a escolha do tema no SQL
      fetch("/log/visitante", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          evento: "Tema escolhido",
          tema: tema_atual,
          id_visitante: localStorage.getItem("id_visitante"),
          modo_tela_usuario: detectarModoTela()
        })
      }).catch(() => {});
      
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

async function carregarRegrasPontuacao() {
    
    const response = await fetch("/api/regras_pontuacao");
    const data = await response.json();

    if (!data.success) {
        console.error("Erro ao carregar regras de pontuação");
        console.log("Erro ao carregar regras de pontuação")
        return;
    }

    localStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao));
}

function registrarAcessoPagina(pagina) {
  fetch("/log/pagina", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pagina,
    })
  }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  // Carrega as regras de pontuações
  carregarRegrasPontuacao()

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

  // Implementa clique no botão para abrir o tutorial
  document.getElementById('btn-tutorial').addEventListener('click', () => {
    abrirTutorial();
  });

  // Implementa função de clique no link do tutorial para ver como ativar "Site para computador"
  conteudoModal.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'link-tutorial') {
    e.preventDefault();

    tituloModal.innerText = 'Como ativar o modo Site para computador';
    conteudoModal.innerHTML = CONTEUDO_TUTORIAL_MODO_DESKTOP;

    const modal = overlayVisitante.querySelector('.modal');
    modal.classList.add('tutorial-aberto');

    document.getElementById('btn-voltar-tutorial').classList.remove('hidden');

    registrarAcessoPagina("tutorial_modo_tela_passos");
  }
  });
  
  // Implementa função de clique no botão para confirmar mensagem ao entrar em Home como visitante
  btnEntendi.addEventListener("click", () => {
    overlayVisitante.classList.add("hidden");
    sessionStorage.setItem("avisoVisitanteExibido", "true");

    registrarAcessoPagina("tutorial_modo_tela_fechou");
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

  // Implementa função de clique no botão para voltar à primeira parte do tutorial
  document.getElementById('btn-voltar-tutorial').addEventListener('click', () => {
    tituloModal.innerText = tituloInicialVisitante;
    conteudoModal.innerHTML = conteudoInicialVisitante;

    const modal = overlayVisitante.querySelector('.modal');
    modal.classList.remove('tutorial-aberto');

    document.getElementById('btn-voltar-tutorial').classList.add('hidden');

    registrarAcessoPagina("tutorial_modo_tela_voltar");
  });

  // Implementa a função de clique no botão de pesquisa
  document.getElementById("btn-pesquisa").addEventListener("click", async () => {
    const response = await fetchAutenticado("/pesquisa");
    if (response.ok) {
      window.location.href = "/pesquisa";
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
    perguntas_restantes.textContent = "100/100"
    dicas_restantes.textContent = "20/20"
  }
  else {
    nome_usuario.textContent = localStorage.getItem("nome_usuario")
    perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}/100`
    dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes")}/20`
  }
  // Carrega as preferências de modo de jogo e tipo de pergunta
  carregarPreferenciasQuiz();
})
