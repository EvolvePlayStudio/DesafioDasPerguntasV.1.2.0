import { deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, idsReservados, idsVisitantesReservados, obterInfoRankingAtual, pontuacaoTemaPadraoVisitantes, registrarInteracaoAnuncio, sincronizarPontuacoesVisitante, slugify, temas_disponiveis } from "./utils.js";
import { playSound } from "./sound.js";

let permitir_escolher_tema = false;
let tema_atual = null;
const MODO_VISITANTE = document.body.dataset.modoVisitante === "true";
sessionStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");
const idUsuario = sessionStorage.getItem("id_usuario");
const idVisitante = localStorage.getItem("id_visitante")
console.log("ID de visitante: ", idVisitante);

// 1. Lê os parâmetros brutos que o Google/Microsoft injetaram na URL
const urlParams = new URLSearchParams(window.location.search);
const utmSource = urlParams.get('utm_source');

let plataformaIdentificada = null;
let midiaIdentificada = null;

// 2. Traduz os parâmetros brutos para os nomes limpos que você escolheu
if (utmSource === 'google') {
    plataformaIdentificada = 'GoogleAds';
    midiaIdentificada = 'cpc';
} else if (utmSource === 'microsoft' || utmSource === 'bing') {
    plataformaIdentificada = 'MicrosoftAds';
    midiaIdentificada = 'cpc';
}

// 3. Se identificou tráfego pago, salva no localStorage e envia pro Python
if (plataformaIdentificada) {
    localStorage.setItem('usuario_origem', plataformaIdentificada);
    localStorage.setItem('usuario_midia', midiaIdentificada);
}

// Caso ocorra erro de não conseguir pegar id de usuário
if (!MODO_VISITANTE && !idUsuario) {
  localStorage.setItem("auth_message", "Sessão expirada");
  window.location.href = "/login";
};

const mensagem = document.getElementById("mensagem");

// Widgets do modal
const modal = document.getElementById("modal");
const msgModal = document.getElementById("modal-msg");
const btnModalPrimario = document.getElementById("btn-modal-primario");
const btnModalSecundario = document.getElementById("btn-modal-secundario");
const spanEmail = modal.querySelector("#email-usuario");

// Widgets do cabeçalho da página
const userName = document.querySelectorAll(".user-name");
const perguntas_restantes = document.querySelectorAll(".perguntas-count");
const btn_criar_conta = document.querySelectorAll(".btn-criar-conta");
const btn_perfil = document.querySelectorAll(".btn-perfil");
const btn_opcoes = document.querySelectorAll(".btn-opcoes");
const btn_pesquisa = document.querySelectorAll(".btn-pesquisa");
const btn_doacoes = document.querySelectorAll(".btn-doacoes");
const btn_logout = document.querySelectorAll(".btn-logout");
let btnsHeader;

const corMensagemPerguntasEsgotadas = 'yellow'
if (MODO_VISITANTE) {
  btnsHeader = [btn_perfil, btn_pesquisa, btn_doacoes, btn_logout];
  permitir_escolher_tema = true;
  btn_criar_conta.forEach(btn => {
    btn.style.display = "";
    btn.addEventListener("click", async () => {
      sessionStorage.setItem("ir_para_aba_registro", true);
      await fetch("/pagina_destino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagina_destino: "Home -> Registro" })
      });

      window.location.href = "/";
    });

  })
  
  /*
  localStorage.removeItem("pontuacoes_visitante");
  localStorage.removeItem("perguntas_restantes_visitante");
  localStorage.removeItem("visitante_respondidas");*/
 
  // Gera ID de visitante para o usuário caso não tenha
  let idVisitante = localStorage.getItem("id_visitante");
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante);
  }

  // Cria as informações de perguntas restantes do usuário
  if (!localStorage.getItem("perguntas_restantes_visitante")) {
    localStorage.setItem("perguntas_restantes_visitante", 60);
  }

  // Cria pontuações de usuário como visitante
  sincronizarPontuacoesVisitante(pontuacaoTemaPadraoVisitantes);

  // Cria armazenamento de ids de perguntas já respondidas no localStorage
  if (!localStorage.getItem("visitante_respondidas")) {
    localStorage.setItem("visitante_respondidas", JSON.stringify([]));
  }
  permitir_escolher_tema = true;

  // Registra o id de visitante em session no backend
  fetch("/api/registrar_visitante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_visitante: idVisitante })
  }).catch(() => console.warn("Falha ao registrar modo visitante"));
}
else {
  btnsHeader = [btn_opcoes, btn_doacoes, btn_perfil, btn_pesquisa, btn_logout];

  if (sessionStorage.getItem("modal_confirmacao_email_exibido") === "false") {
    exibirModalConfirmacaoEmail();
  }
  else {
    permitir_escolher_tema = true;
  }
}

// Renderiza os botões do header
btnsHeader.forEach(conjuntoBtn => {conjuntoBtn.forEach(btn => {btn.style.display = ""})});

function abrirModal({titulo = "", corpoHTML = "", textoPrimario = null, textoSecundario = null, onPrimario = null, onSecundario = null, modalReenvioEmail = false}) {

  // Bloqueia interação geral
  permitir_escolher_tema = false;
  btnModalPrimario.disabled = true;
  btnModalSecundario.disabled = true;
  setTimeout(() => {
    btnModalPrimario.disabled = false;
    btnModalSecundario.disabled = false;
  }, 1000);

  // Conteúdo
  if (!modalReenvioEmail) {
    modal.querySelector("h3").textContent = titulo;
    modal.querySelector("#texto-modal").innerHTML = corpoHTML;
  }
  if (spanEmail) spanEmail.textContent = "";

  // Botão primário
  if (textoPrimario) {
    btnModalPrimario.textContent = textoPrimario;
    btnModalPrimario.style.display = "";
    btnModalPrimario.onclick = onPrimario;
  }
  else {
    btnModalPrimario.style.display = "none";
  }

  // Botão secundário
  if (textoSecundario) {
    btnModalSecundario.textContent = textoSecundario;
    btnModalSecundario.style.display = "";
    btnModalSecundario.onclick = onSecundario;
  }
  else {
    btnModalSecundario.style.display = "none";
  }

  // Exibe o modal
  modal.classList.remove("hidden");
}

const containerAnuncios = document.getElementById("container-anuncios-topo");
const bannerTopoEsquerda = document.getElementById("banner-topo-esquerda");
const bannerTopoDireita = document.getElementById("banner-topo-direita");

const modoTesteWrapper = document.getElementById("modo-teste-wrapper");
const checkModoTeste = document.getElementById("modo-teste-toggle");
const modoTeste = JSON.parse(sessionStorage.getItem("modo_teste") ?? "false");

async function exibirAnuncios() {
  // 1. Obtém o horário atual de Brasília/São Paulo
  const agoraSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));

  function configurarBanner(container, produto) {
    const link = container.querySelector(".link-anuncio-geral");
    const imgProd = container.querySelector(".produto-container img");
    const imgLogo = container.querySelector(".logo-container img");

    // Carrega o logotipo do provedor
    if (produto.provedor === 'Amazon') {
      imgLogo.src = "https://github.com/EvolvePlayStudio/assets-quiz/blob/main/logotipoAmazon.png?raw=true";
    }
    else if (produto.provedor === 'Mercado Livre'){
      imgLogo.src = "https://github.com/EvolvePlayStudio/assets-quiz/blob/main/logotipoMercadoLivre03.png?raw=true"; 
    }
    else {
      imgLogo.src = "";
    }
    
    if (link) {
      link.setAttribute('data-id-anuncio', produto.id);
      link.setAttribute('data-provedor-anuncio', produto.provedor);
      link.setAttribute('data-tipo-midia-anuncio', produto.tipo_midia);
      link.href = produto.link;

      // Chama função para registrar impressão
      registrarInteracaoAnuncio(link, 'Impressão', produto.tema);

      // Função para registrar clique (primeiro remove a do banner anterior)
      if (link._clickhandler) {
        link.removeEventListener('click', link._clickhandler);
      }
      link._clickhandler = function() {
        registrarInteracaoAnuncio(link, 'Clique', produto.tema)
      }
      link.addEventListener('click', link._clickhandler);
      link.addEventListener('auxclick', function(e) {
        if (e.button === 1) { // 1 faz referência ao botão do meio do mouse
          link._clickhandler();}
      });
    }
    if (imgProd) imgProd.src = produto.imagem;
  }

  try {
    const resposta = await fetch("/api/obter_anuncios_home");
    const dados = await resposta.json();

    // 2. Filtra e limpa as listas (remove expirados e valida provedor)
    const filtrarValidos = (lista) => (lista || []).filter(a => {
      const expira = new Date(a.oferta_expira_em);
      // Mantém apenas se a data de expiração for maior que agora
      return expira > agoraSP && (window.ADS_CONFIG.isAdmin || a.disponivel_visitantes === true && MODO_VISITANTE || a.disponivel_usuarios && !MODO_VISITANTE);
    });

    const anunciosAmazon = filtrarValidos(dados['Amazon']);
    const anunciosML = filtrarValidos(dados['Mercado Livre']);

    // Juntamos todos os anúncios válidos disponíveis em uma única lista para sortear
    const todosAnuncios = [...anunciosAmazon, ...anunciosML];

    if (todosAnuncios.length > 0) {
      containerAnuncios.style.display = 'grid';
    }

    if (!window.ADS_CONFIG.isMobile) {
      // Exibição Amazon (esquerda)
      if (anunciosAmazon.length > 0) {
        const aleatorioAmazon = anunciosAmazon[Math.floor(Math.random() * anunciosAmazon.length)];
        configurarBanner(bannerTopoEsquerda, aleatorioAmazon);
        bannerTopoEsquerda.style.visibility = "visible";
      }
      else {
        bannerTopoEsquerda.style.visibility = "hidden";
      }

      // Exibição Mercado Livre (Direita)
      if (anunciosML.length > 0) {
        const aleatorioML = anunciosML[Math.floor(Math.random() * anunciosML.length)];
        configurarBanner(bannerTopoDireita, aleatorioML);
        bannerTopoDireita.style.visibility = "visible";
      }
      else {
        bannerTopoDireita.style.visibility = "hidden";
      }
    }
    else {
      if (todosAnuncios.length > 0) {
        const anuncioSorteado = todosAnuncios[Math.floor(Math.random() * todosAnuncios.length)];
        configurarBanner(bannerTopoEsquerda, anuncioSorteado);
        bannerTopoEsquerda.style.visibility = "visible";
        bannerTopoDireita.style.visibility = "hidden";
      } else {
        bannerTopoEsquerda.style.visibility = "hidden"; 
      }
      bannerTopoEsquerda.style.justifySelf = "center";
      bannerTopoDireita.style.visibility = "hidden";
      bannerTopoDireita.style.display = "none";
    }
  }
  catch (erro) {
    console.error("Falha ao carregar anúncios:", erro);
  }
}

// Coloca botão de modo teste
function inserirBotaoModoTeste() {
  // Registra no backend se modo teste for selecionado (apenas para admin)
  async function registrarModoTeste() {
    const config = window.ADS_CONFIG;
    config.registrandoModoTeste = true;
  
    sessionStorage.setItem("modo_teste", checkModoTeste.checked);
    await fetch("/api/modo_teste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modo_teste: checkModoTeste.checked})
    }).catch(() => console.warn("Falha ao registrar modo teste"));
    config.registrandoModoTeste = false;
  }

  modoTesteWrapper.style.display = 'flex';
  if (modoTeste) checkModoTeste.checked = modoTeste;
  if (checkModoTeste) {
    registrarModoTeste();
    checkModoTeste.addEventListener("change", () => {registrarModoTeste()});
  };
}

if (window.ADS_CONFIG.isAdmin && !MODO_VISITANTE) inserirBotaoModoTeste();
else exibirAnuncios();

async function iniciarQuiz(event) {
  function desbloquearBotoes() {
    permitir_escolher_tema = true;
  };

  const config = window.ADS_CONFIG;
  if (config.registrandoModoTeste) return;
  if (!permitir_escolher_tema) return;
  playSound("click");
  permitir_escolher_tema = false;

  // Atualiza o tema atual, modo de jogo e tipo de pergunta no localStorage
  tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  sessionStorage.setItem("tema_atual", tema_atual);
  sessionStorage.setItem("modo_jogo", 'desafio');

  if (!tema_atual) {
    console.error("Tema não definidos na URL");
    desbloquearBotoes();
    return;
  };

  // Mensagem avisando que as perguntas acabaram
  const perguntas_restantes_atuais = parseInt(perguntas_restantes[0]?.textContent.split("/")[0] ?? "0", 10);
  // const perguntas_restantes_atuais = 0;

  if (perguntas_restantes_atuais <= 0) {
    if (!MODO_VISITANTE) {
      exibirMensagem(mensagem, `Energia esgotada, retorne amanhã para poder responder novas perguntas`, corMensagemPerguntasEsgotadas, true, false, 'flex');
    }
    else {
      exibirMensagem(mensagem, `É necessário criar uma conta para ter acesso ao conteúdo completo do jogo`, corMensagemPerguntasEsgotadas, true, false, 'flex');
    }
    desbloquearBotoes();
    return;
  }
  exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false, false, 'flex')

  // Carrega as perguntas para o quiz
  try {
    if (!MODO_VISITANTE) {
      const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio`)

      if (response.ok) {
        const data = await response.json();

        // Ids de perguntas que devem ser respondidas primeiro pelos usuários
        sessionStorage.setItem("ids_prioritarios", JSON.stringify(data["ids_prioritarios"] ?? []));

        // Atualiza as pontuações do usuário no tema e as perguntas no sessionStorage
        sessionStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
        sessionStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisar se pode prosseguir com o quiz de acordo com o estoque de perguntas
        const perguntas_por_dificuldade = JSON.parse(sessionStorage.getItem("perguntas"));
        const encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE)
        
        // Analisa o ranking atual do usuário (ATENÇÃO, já procura ranking na função deveEncerrarQuiz, o que pode ser uma perda de eficiência aqui)
        const rankings_jogador = {};
        Object.keys(data["pontuacoes_usuario"]).forEach(tema => {
          const ranking_no_tema = obterInfoRankingAtual(tema).ranking
          rankings_jogador[tema] = ranking_no_tema;
        });
        sessionStorage.setItem("rankings_jogador", JSON.stringify(rankings_jogador))
      
        // Chama a tela de quiz ou exibe mensagem caso não haja perguntas disponíveis
        const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
        const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)

        if (ha_perguntas_disponiveis && !encerrar_quiz) {
          try {
              // 1. Faz a requisição
              const resposta = await fetch("/api/obter_todos_anuncios");
              // 2. Transforma em objeto JSON
              const dados = await resposta.json();
              // 3. Salva como STRING (o sessionStorage só aceita strings)
              sessionStorage.setItem("anuncios", JSON.stringify(dados));
          }
          catch (erro) {
              console.error("Falha ao carregar anúncios:", erro);
              // Opcional: define um objeto vazio para não quebrar o quiz
              sessionStorage.setItem("anuncios", JSON.stringify({}));
          }
          window.location.href = `/quiz/${encodeURIComponent(slugify(tema_atual))}`;
        }
        else {
          exibirMensagem(mensagem, `Você não possui novas perguntas disponíveis para o tema ${tema_atual} no momento`, corMensagemPerguntasEsgotadas, true, false, 'flex');
          desbloquearBotoes();
          return;
        }
      }
    }
    else { // modo visitante
      const response = await fetch(`/api/perguntas?tema=${tema_atual}&modo=desafio`)
      if (response.ok) {
        const data = await response.json();
        
        // Elimina perguntas já respondidas pelo visitante
        const idsRespondidas = JSON.parse(localStorage.getItem("visitante_respondidas") ?? "[]");
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
          exibirMensagem(mensagem, `É necessário criar uma conta para ter aceso a mais perguntas no tema ${tema_atual}`, corMensagemPerguntasEsgotadas, true, false, 'flex');
          desbloquearBotoes();
          return
        }
        
        // Grava pontuações do usuário e perguntas no sessionStorage
        sessionStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

        // Analisa os rankings atuais do usuário (AQUI NÃO É NECESSÁRIO OBTER INFORMAÇÃO DE RANKING PARA TODOS OS TEMAS, MAS SÓ PARA O DO QUIZ QUE SERÁ FEITO, MUDANÇA NO FUTURO SERÁ FEITA)
        const rankings_jogador = {};
        temas_disponiveis.forEach( tema => {
          const ranking_no_tema = obterInfoRankingAtual(tema).ranking;
          rankings_jogador[tema] = ranking_no_tema;
        })
        sessionStorage.setItem("rankings_jogador", JSON.stringify(rankings_jogador));
        
        // Analisa os anúncios que tem apara exibir
        try {
          const resposta = await fetch("/api/obter_todos_anuncios");
          const dados = await resposta.json();
          sessionStorage.setItem("anuncios", JSON.stringify(dados));
        }
        catch (erro) {
          console.error("Falha ao carregar anúncios:", erro);
          sessionStorage.setItem("anuncios", JSON.stringify({}));
        }

        // Chama a tela de quiz
        //mensagem.style.opacity = 0
        window.location.href = `/quiz/${encodeURIComponent(slugify(tema_atual))}`;
      }
    }
  }
  catch (error) {
    console.error("Erro ao carregar perguntas", error)
    // Permite alterar novamente o tipo de pergunta e tema
    desbloquearBotoes();
  }
}

async function exibirModalConfirmacaoEmail() {
  permitir_escolher_tema = false;
  try {
    const response = await fetch("/pegar_email_confirmado", {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) throw new Error();

    const { email_confirmado, email_usuario } = await response.json();

    if (email_confirmado) {
      permitir_escolher_tema = true;
      return;
    }

    abrirModal({
      textoPrimario: "Fechar",
      textoSecundario: "Reenviar e-mail",
      onPrimario: () => {
        modal.classList.add("hidden");
        sessionStorage.setItem("modal_confirmacao_email_exibido", "true");
        permitir_escolher_tema = true;
      },
      onSecundario: () => {
        if (sessionStorage.getItem("email_reenviado_neste_login") === "true") {
          msgModal.innerText = "Um e-mail de confirmação já foi enviado recentemente";
          msgModal.style.display = "block";
          msgModal.style.color = "orange";
          return;
        }

        msgModal.innerText = "Enviando e-mail de confirmação...";
        msgModal.style.display = "block";
        msgModal.style.color = "orange";

        fetch("/reenviar-email-confirmacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            sessionStorage.setItem("email_reenviado_neste_login", "true");
            msgModal.innerText = "E-mail de confirmação reenviado com sucesso";
            msgModal.style.color = "green";
          }
          else {
            msgModal.innerText = data.message || "Não foi possível reenviar o e-mail.";
            msgModal.style.color = "red";
          }
        })
        .catch(() => {
          msgModal.innerText = "Erro de comunicação com o servidor.";
          msgModal.style.color = "red";
        });
      },
      modalReenvioEmail: true
    });

    // Preenche o e-mail destacado
    spanEmail.textContent = email_usuario;

  }
  catch (e) {
    permitir_escolher_tema = true;
    console.error("Erro ao tentar abrir modal de confirmação de e-mail", e);
  }
}

function exibirModalRegistroVisitante(marco) {
  abrirModal({
    titulo: `Você atingiu o marco de ${marco} perguntas 🎯`,
    corpoHTML: `
    Considere se registrar para obter as seguintes vantagens:
      <ul>
        <li>📚 Acesso a mais de 1500 perguntas</li>
        <li>🏆 Pontuações e rankings salvos</li>
        <li>⭐ Revisão inteligente com perguntas favoritadas</li>
      </ul>
    `,
    textoPrimario: "Continuar como visitante",
    textoSecundario: "Criar uma conta",
    onPrimario: () => {
      sessionStorage.setItem(`modal_registro_fechado_${marco}`, "true");
      modal.classList.add("hidden");
      permitir_escolher_tema = true;
    },
    onSecundario: async () => {
      sessionStorage.setItem("ir_para_aba_registro", true);
      await fetch("/pagina_destino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagina_destino: "Modal de Registro -> Registro" })
      });
      window.location.href = "/";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Envia os dados para o app.py (Flask) caso o usuário não seja um admin
  try {
    if (!idsReservados.includes(idUsuario) && !idsVisitantesReservados.includes(idVisitante)) {
      fetch('/api/registrar-acesso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            pagina: 'Home',
            origem: plataformaIdentificada,
            midia: midiaIdentificada,
            id_visitante: idVisitante
        })
    })
    .then(response => response.json())
    .catch(error => console.error("Erro ao registrar acesso:", error));
    }
  }
  catch (e) {
    console.error("Erro ao registrar acesso: ", e);
  }
  // Adiciona áudio no clique dos botões
  if (btnModalPrimario) {
    btnModalPrimario.addEventListener("click", () => playSound("click"));
  }
  if (btnModalSecundario) {
    btnModalSecundario.addEventListener("click", () => playSound("click"));
  }
  document.querySelectorAll('input[type="radio"]').forEach(cb => {
    cb.addEventListener('change', () => playSound("checkbox"));
  })
  
  // Carrega as regras de pontuações do jogo
  let data;
  try {
    const response = await fetch("/api/regras_pontuacao");
    data = await response.json();

    if (data.success) {
      sessionStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao));
    };
  }
  catch(e) {
    console.error("Erro ao carregar regras de pontuação", e);
  };

  // Implementa a função de clique no botão de perfil
  if (btn_perfil) {
    btn_perfil.forEach(btn => {
      btn.addEventListener("click", async () => {
        playSound("click");
        window.location.href = "/perfil";
      });
    });
  };

  // Implementa a função de clique no botão de opções
  if (btn_opcoes) {
    btn_opcoes.forEach(btn => {
      btn.addEventListener("click", async () => {
        playSound("click");
        window.location.href = "/opcoes";
      });
    });
  };

  // Implementa a função de clique no botão de pesquisa
  if (btn_pesquisa) {
    btn_pesquisa.forEach(btn => {
      btn.addEventListener("click", async () => {
        playSound("click");
        const response = await fetchAutenticado("/pesquisa");
        if (response.ok) window.location.href = "/pesquisa";
      });
    });
  };

  // Implementa a função de clique no botão de doações
  if (btn_doacoes) {
    btn_doacoes.forEach(btn => {
      btn.addEventListener("click", async () => {
        playSound("click");
        if (!MODO_VISITANTE) {
          const response = await fetchAutenticado("/doações");
          if (response.ok) window.location.href = "/doações";
        }
        else window.location.href = "/doações";
      });
    });
  };

  // Implementa a função de clique no botão de logout
  if (btn_logout) {
    btn_logout.forEach(btn => {
      btn.addEventListener("click", async () => {
        playSound("click");
        await fetch("/pagina_destino", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pagina_destino: "Home -> Login" })
        });
        window.location.href = "/";
      });
    });
  };

  // Implementa a função de ir para a página home
  document.getElementById("link-home").addEventListener("click", async (e) => {
    e.preventDefault();
    window.location.href = "/home";
  });

  // Implementa a função de clique nos temas
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", iniciarQuiz);
  });

  // Define o nome de usuário e a quantidade de perguntas restantes para responder
  if (MODO_VISITANTE) {
    userName.forEach(n => {
      n.textContent = "Visitante";
    });
    perguntas_restantes.forEach(p => {
      p.textContent = `${localStorage.getItem("perguntas_restantes_visitante")}/60`;
    });

    // Decide se deve exibir modal para convidar a fazer registro
    const respondidas = JSON.parse(localStorage.getItem("visitante_respondidas"));
    const totalRespondidas = (respondidas.objetiva?.length || 0) + (respondidas.discursiva?.length || 0);

    const MARCO = 15;
    const marcoAtual = Math.floor(totalRespondidas / MARCO) * MARCO;
    const chaveRecusa = `modal_registro_fechado_${marcoAtual}`;

    if (totalRespondidas >= 15 && !sessionStorage.getItem(chaveRecusa)) {
      exibirModalRegistroVisitante(marcoAtual);
    };
  }
  else {
    userName.forEach(n => {
      n.textContent = sessionStorage.getItem("nome_usuario");
    });
    perguntas_restantes.forEach(p => {
      p.textContent = `${sessionStorage.getItem("perguntas_restantes")}/80`;
    });
  }
})
