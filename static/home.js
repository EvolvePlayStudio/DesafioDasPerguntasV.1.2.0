import { deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, idsReservados, idsVisitantesReservados, obterInfoRankingAtual, pontuacaoTemaPadraoVisitantes, registrarInteracaoAnuncio, sincronizarPontuacoesVisitante, slugify, temas_disponiveis } from "./utils.js";
import { playSound } from "./sound.js";;

document.addEventListener("DOMContentLoaded", async () => {

  // Exige ir para o login caso a versão do app tenha sido modificada
  function validateAppVersionHome() { // Depois pode ir para o utils
    if (!localStorage.getItem('app_version')) {
      localStorage.setItem("auth_message", "Sua sessão expirou devido a uma atualização recente do sistema. Por favor, logue novamente");
      window.location.href = '/login';
    }
  }

  let permitir_escolher_tema = false;
  let tema_atual = null;
  let idVisitante = localStorage.getItem("id_visitante");
  const idUsuario = localStorage.getItem("id_usuario");
  const MODO_VISITANTE = document.body.dataset.modoVisitante === "true";
  const maxEnergiaVisitantes = 80;
  const maxEnergiaUsuarios = 500;
  localStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");
  localStorage.setItem('limite_energia', maxEnergiaUsuarios);
  const idsUsuariosIsentos = ['291'] // Usuários que não recebem convite para compra de energia

  if (!MODO_VISITANTE) { // Verifica se deve expirar a sessão
    if (!idUsuario) { // Caso o id de usuário não tenha sido identificado
      localStorage.setItem("auth_message", "Sessão expirada");
      window.location.href = "/login";
    }
    validateAppVersionHome();
  }

  const mensagem            = document.getElementById("mensagem");

  // Widgets do modal
  const modal               = document.getElementById("modal");
  const msgModal            = document.getElementById("modal-msg");
  const btnModalPrimario    = document.getElementById("btn-modal-primario");
  const btnModalSecundario  = document.getElementById("btn-modal-secundario");
  const spanEmail           = modal.querySelector("#email-usuario");

  // Widgets dos anúncios no topo
  const bannerTopoEsquerda  = document.getElementById("banner-topo-esquerda");
  const bannerTopoDireita   = document.getElementById("banner-topo-direita");

  // Widgets do cabeçalho da página
  const userName            = document.getElementById("user-name");
  const perguntas_restantes = document.getElementById("perguntas-count");
  const btn_criar_conta     = document.getElementById("btn-criar-conta");
  const btn_perfil          = document.getElementById("btn-perfil");
  const btn_opcoes          = document.getElementById("btn-opcoes");
  const btn_pesquisa        = document.getElementById("btn-pesquisa");
  const btn_doacoes         = document.getElementById("btn-doacoes");
  const btn_logout          = document.getElementById("btn-logout");
  let btnsHeader;

  // Widgets do modo teste (para desenvolvedor testar perguntas recém-lançadas)
  const modoTesteWrapper    = document.getElementById("modo-teste-wrapper");
  const checkModoTeste      = document.getElementById("modo-teste-toggle");
  const modoTeste           = JSON.parse(sessionStorage.getItem("modo_teste") ?? "false");
  const corMensagemAlerta   = 'yellow'

  /*
  if (idsVisitantesReservados.includes(idVisitante)) {
    localStorage.removeItem("pontuacoes_visitante");
    localStorage.removeItem("perguntas_restantes_visitante");
    localStorage.removeItem("visitante_respondidas");
    sessionStorage.removeItem("id_pergunta_ativa");
  }*/
  
  // Gera ID de visitante para o usuário caso não tenha
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante);
  }

  if (MODO_VISITANTE) {
    btnsHeader = [btn_perfil, btn_pesquisa, btn_doacoes, btn_logout];
    permitir_escolher_tema = true;
    btn_criar_conta.style.display = "";
    btn_criar_conta.addEventListener("click", async () => {
      sessionStorage.setItem("ir_para_aba_registro", true);
      await fetch("/pagina_destino", { // Registra na base acesso à aba de registro pelo botão de criar conta
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagina_destino: "Home -> Registro" })
      });
      window.location.href = "/";
    })

    // Cria as informações de perguntas restantes do usuário
    if (!localStorage.getItem("perguntas_restantes_visitante")) {
      localStorage.setItem("perguntas_restantes_visitante", maxEnergiaVisitantes);
    }

    // Cria pontuações de usuário como visitante
    sincronizarPontuacoesVisitante(pontuacaoTemaPadraoVisitantes);

    // Cria armazenamento de ids de perguntas já respondidas no localStorage
    if (!localStorage.getItem("visitante_respondidas")) {
      localStorage.setItem("visitante_respondidas", JSON.stringify([]));
    }

    fetch("/api/registrar_visitante", { // Registra o id de visitante em session no backend
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_visitante: idVisitante })
    }).catch(() => console.warn("Falha ao registrar modo visitante"));
  }
  else {
    btnsHeader = [btn_opcoes, btn_doacoes, btn_perfil, btn_pesquisa, btn_logout];
  }

  // Renderiza os botões do header
  btnsHeader.forEach(btn => {btn.style.display = ""});

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

  async function exibirAnuncios() {
    // 1. Obtém o horário atual de Brasília/São Paulo
    const agoraSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));

    function configurarBanner(container, produto) {
      const link = container.querySelector(".link-anuncio-geral");
      const imgProd = container.querySelector(".produto-container img");
      const imgLogo = container.querySelector(".logo-container img");
      // Carrega o logotipo do provedor
      if (produto.provedor === 'Amazon') {
        imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoAmazon"
      }
      else if (produto.provedor === 'Mercado Livre'){
        imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoMercadoLivre03"
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

      if (window.ADS_CONFIG.isAdmin) {
        console.log(`Quantidade de anúncios da Amazon: ${anunciosAmazon.length}`);
        console.log(`Quantidade de anúncios do ML: ${anunciosML.length}`);
      }

      // Junta todos os anúncios válidos disponíveis em uma única lista para sortear
      const todosAnuncios = [...anunciosAmazon, ...anunciosML];

      if (!window.ADS_CONFIG.isMobile) {
        // Exibição Amazon (esquerda)
        if (anunciosAmazon.length > 0) {
          const aleatorioAmazon = anunciosAmazon[Math.floor(Math.random() * anunciosAmazon.length)];
          if (window.ADS_CONFIG.isAdmin) {
            console.log("Configurando banner da Amazon...");
          }  
          
          configurarBanner(bannerTopoEsquerda, aleatorioAmazon);
          bannerTopoEsquerda.style.visibility = "visible";
        }
        else {
          if (window.ADS_CONFIG.isAdmin) {
            console.log("Não há anúncios da Amazon para exibir");
          }
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
  exibirAnuncios();

  async function iniciarQuiz(event) {

    function desbloquearBotoes() {permitir_escolher_tema = true};

    const config = window.ADS_CONFIG;
    if (config.registrandoModoTeste) return;
    if (!permitir_escolher_tema) return;
    playSound("click");
    permitir_escolher_tema = false;

    // Atualiza o tema atual, modo de jogo e tipo de pergunta no localStorage
    tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
    localStorage.setItem("tema_atual", tema_atual);
    localStorage.setItem("modo_jogo", 'desafio');

    if (!tema_atual) {
      console.error("Tema não definidos na URL");
      desbloquearBotoes();
      return;
    };

    // Mensagem avisando que as perguntas acabaram
    const perguntas_restantes_atuais = parseInt(perguntas_restantes?.textContent.split("/")[0] ?? "0", 10);
    // const perguntas_restantes_atuais = 0;

    if (perguntas_restantes_atuais <= 0) {
      if (!MODO_VISITANTE) {
        exibirMensagem(mensagem, `Energia esgotada, aguarde a recarga diária ou obtenha pacotes de energia para responder novas perguntas`, corMensagemAlerta, true, false, 'flex');
      }
      else {
        exibirMensagem(mensagem, `É necessário criar uma conta para ter acesso ao conteúdo completo do jogo`, corMensagemAlerta, true, false, 'flex');
      }
      desbloquearBotoes();
      return;
    }
    exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false, false, 'flex')

    // Carrega as perguntas para o quiz
    try {
      if (!MODO_VISITANTE) {
        const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio`)
        
        // Pode ser bom tratar quase a resposta não seja ok
        if (response.ok) {
          const data = await response.json();

          // Ids de perguntas que devem ser respondidas primeiro pelos usuários
          localStorage.setItem("ids_prioritarios", JSON.stringify(data["ids_prioritarios"] ?? []));

          // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
          localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
          localStorage.setItem("pontuacao_anterior", JSON.parse(localStorage.getItem("pontuacoes_usuario"))[tema_atual]);
          localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

          // Analisar se pode prosseguir com o quiz de acordo com o estoque de perguntas
          const perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"));
          const encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE)
          
          // Analisa o ranking atual do usuário (ATENÇÃO, já procura ranking na função deveEncerrarQuiz, o que pode ser uma perda de eficiência aqui)
          const rankings_jogador = {};
          Object.keys(data["pontuacoes_usuario"]).forEach(tema => {
            const ranking_no_tema = obterInfoRankingAtual(tema).ranking
            rankings_jogador[tema] = ranking_no_tema;
          });
          localStorage.setItem("rankings_jogador", JSON.stringify(rankings_jogador))
        
          // Chama a tela de quiz ou exibe mensagem caso não haja perguntas disponíveis
          const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
          const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)

          // Pega os anúncios que serão utilizados na tela de quiz
          if (ha_perguntas_disponiveis && !encerrar_quiz) {
            localStorage.removeItem("perguntas_respondidas");
            try {
                // 1. Faz a requisição
                const resposta = await fetch("/api/obter_todos_anuncios"); // Não serve para nada por enquanto, anúncios em quiz foram removidos
                // 2. Transforma em objeto JSON
                const dados = await resposta.json();
                // 3. Salva como STRING (o Storage só aceita strings)
                localStorage.setItem("anuncios", JSON.stringify(dados));
            }
            catch (erro) {
                console.error("Falha ao carregar anúncios:", erro);
                // Opcional: define um objeto vazio para não quebrar o quiz
                localStorage.setItem("anuncios", JSON.stringify({}));
            }

            window.location.href = `/quiz/${encodeURIComponent(slugify(tema_atual))}`;
          }
          else {
            exibirMensagem(mensagem, `Você não possui perguntas disponíveis no tema ${tema_atual} no momento`, corMensagemAlerta, true, false, 'flex');
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
            exibirMensagem(mensagem, `É necessário criar uma conta para acessar mais perguntas no tema ${tema_atual}`, corMensagemAlerta, true, false, 'flex');
            desbloquearBotoes();
            return
          }
          
          // Grava as perguntas e a pontuação antes de inicar o quiz do visitante no localStorage
          localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));
          localStorage.setItem("pontuacao_anterior", JSON.parse(localStorage.getItem("pontuacoes_visitante"))[tema_atual]);
          localStorage.removeItem("perguntas_respondidas");
          
          // Analisa os rankings atuais do usuário (AQUI NÃO É NECESSÁRIO OBTER INFORMAÇÃO DE RANKING PARA TODOS OS TEMAS, MAS SÓ PARA O DO QUIZ QUE SERÁ FEITO, MUDANÇA NO FUTURO SERÁ FEITA)
          const rankings_jogador = {};
          temas_disponiveis.forEach( tema => {
            const ranking_no_tema = obterInfoRankingAtual(tema).ranking;
            rankings_jogador[tema] = ranking_no_tema;
          })
          localStorage.setItem("rankings_jogador", JSON.stringify(rankings_jogador));
          
          // Analisa os anúncios que tem apara exibir
          try {
            const resposta = await fetch("/api/obter_todos_anuncios");
            const dados = await resposta.json();
            localStorage.setItem("anuncios", JSON.stringify(dados));
          }
          catch (erro) {
            console.error("Falha ao carregar anúncios:", erro);
            localStorage.setItem("anuncios", JSON.stringify({}));
          }

          // Chama a tela de quiz
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

  async function exibirModalEmailOuEnergia() {
    // Função para exixbir modal para ir para tela de energia
    function exibirModalEnergia() {
      // --- CONTROLE DE FREQUÊNCIA DO MODAL DE ENERGIA (Exibir a cada 3 dias) ---
      const ULTIMA_EXIBICAO_CHAVE = "ultima_vez_modal_energia_exibido";
      
      //if (idsReservados.includes(parseInt(idUsuario))) localStorage.removeItem(ULTIMA_EXIBICAO_CHAVE);
      
      const ultimaExibicao = localStorage.getItem(ULTIMA_EXIBICAO_CHAVE);
      const agora = new Date().getTime();
      const TRES_DIAS_EM_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias em milissegundos

      // Verifica se já passou 3 dias desde a última exibição (ou se nunca foi exibido)
      const deveExibirModalEnergia = !ultimaExibicao || (agora - parseInt(ultimaExibicao) > TRES_DIAS_EM_MS);
      const eIsento = idsUsuariosIsentos.includes(idUsuario);

      // Pega a energia atual para checar se realmente está baixa (<= 50)
      const perguntasRestantesAtual = parseInt(localStorage.getItem('perguntas_restantes') || '500');
      
      if (deveExibirModalEnergia && !eIsento && perguntasRestantesAtual <= 50) {
        // Registra na base a abertura do modal aguardando o envio com sucesso
        try {
          fetch("/api/registrar-acesso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagina: "Modal de energia" })
          });
        } catch (err) {
          console.warn("Falha ao registrar abertura do modal de energia:", err);
        }

        // Salva o momento atual como última exibição
        localStorage.setItem(ULTIMA_EXIBICAO_CHAVE, agora.toString());

        // Abre o Modal de Oferta de Energia Baixa
        abrirModal({
          titulo: "⚡ Sua energia está acabando!",
          corpoHTML: `
            <p>Adquira mais energia para continuar respondendo novas perguntas e subir no ranking.</p>
          `,
          textoPrimario: "Adquirir Energia",
          textoSecundario: "Continuar Jogando",
          onPrimario: () => {
            window.location.href = "/recarga-de-energia";
          },
          onSecundario: () => {
            modal.classList.add("hidden");
            permitir_escolher_tema = true; // Libera o jogo
          }
        });
      }
    }

    async function exibirModalConfirmacaoEmail() {
       abrirModal({
        textoPrimario: "Fechar",
        textoSecundario: "Reenviar e-mail",
        onPrimario: () => {
          modal.classList.add("hidden");
          localStorage.setItem("modal_confirmacao_email_exibido", "true");
          permitir_escolher_tema = true;
        },
        onSecundario: () => {
          if (localStorage.getItem("email_reenviado_neste_login") === "true") {
            msgModal.innerText = "Um e-mail de confirmação já foi enviado recentemente";
            msgModal.style.display = "block";
            msgModal.style.color = corMensagemAlerta;
            return;
          }

          msgModal.innerText = "Enviando e-mail de confirmação...";
          msgModal.style.display = "block";
          msgModal.style.color = 'rgb(228, 228, 228)';

          fetch("/reenviar-email-confirmacao", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              localStorage.setItem("email_reenviado_neste_login", "true");
              msgModal.innerText = "O e-mail de confirmação foi reenviado";
              msgModal.style.color = "lime";
            }
            else {
              msgModal.innerText = data.message || "Não foi possível reenviar o e-mail";
              msgModal.style.color = "red";
            }
          })
          .catch(() => {
            msgModal.innerText = "Erro de comunicação com o servidor";
            msgModal.style.color = "red";
          });
        },
        modalReenvioEmail: true
      });

    }

    permitir_escolher_tema = false;
    try {
      const response = await fetch("/pegar_email_confirmado", {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) throw new Error();

      const { email_confirmado, email_usuario } = await response.json();

      // Modal para convite de compra de energia
      if (email_confirmado) {
        exibirModalEnergia();
      }
      else {
        exibirModalConfirmacaoEmail();
      }
      // Modal de confirmação de e-mail
     
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
          <li>📚 Acesso a mais de 1000 perguntas</li>
          <li>🏆 Pontuações e rankings salvos</li>
          <li>⭐ Revisão com perguntas favoritadas</li>
          <li>📩 Notificações por e-mail de novidades</li>
        </ul>
      `,
      textoPrimario: "Continuar como visitante",
      textoSecundario: "Criar uma conta",
      onPrimario: () => {
        localStorage.setItem(`modal_registro_fechado_${marco}`, "true");
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

  // Faz a recarga diária de energia do usuário
  if (!MODO_VISITANTE) {
    fetch('/api/recarregar_energia_usuario', {
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    })
    .then(response => response.json()) // Serve para acessar data.perguntas_restantes por exemplo
    .then(data => {
      if (data.success) {
        if (perguntas_restantes) {
          localStorage.setItem('perguntas_restantes', data.perguntas_restantes)
          perguntas_restantes.textContent = `${data.perguntas_restantes}/${maxEnergiaUsuarios}`;
          console.log(`Permitir escolher tema? ${permitir_escolher_tema}`)
        }
      } else console.warn("Não foi possível atualizar a energia:", data.message);

      if (localStorage.getItem("modal_confirmacao_email_exibido") === "false") {
        exibirModalEmailOuEnergia();
      }
      permitir_escolher_tema = true;
    })
    .catch(error => {
        console.error("Erro na requisição de energia:", error);
    });
  }

  // Registra acesso em home na base de dados junto com a origem e mídia do usuário
  // (se veio do Google Ads ou Microsoft Ads por exemplo)
  fetch('/api/registrar-acesso', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        pagina: 'Home',
        id_visitante: idVisitante
    })
  })
  .then(response => response.json()) // Talvez não seja necessário este .then
  .catch(error => console.error("Erro ao registrar acesso:", error));

  // Adiciona áudio no clique dos botões
  if (btnModalPrimario) {
    btnModalPrimario.addEventListener("click", () => playSound("click"));
  }
  if (btnModalSecundario) {
    btnModalSecundario.addEventListener("click", () => playSound("click"));
  }
  // Carrega as regras de pontuações do jogo
  let data;
  try {
    const response = await fetch("/api/regras_pontuacao");
    data = await response.json();

    if (data.success) {
      localStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao));
    };
  }
  catch(e) {
    console.error("Erro ao carregar regras de pontuação", e);
  };
  // Implementa a função de clique no botão de perfil
  if (btn_perfil) {
    btn_perfil.addEventListener("click", async () => {
      playSound("click");
      window.location.href = "/perfil";
    });
  };
  // Implementa a função de clique no botão de opções
  if (btn_opcoes) {
    btn_opcoes.addEventListener("click", async () => {
      playSound("click");
      window.location.href = "/opcoes";
    });
  };
  // Implementa a função de clique no botão de pesquisa
  if (btn_pesquisa) {
    btn_pesquisa.addEventListener("click", async () => {
      playSound("click");
      window.location.href = "/pesquisa";
    });
  };
  // Implementa a função de clique no botão de doações
  if (btn_doacoes) {
    btn_doacoes.addEventListener("click", async () => {
      playSound("click");
      window.location.href = "/recarga-de-energia";
    });
  };
  // Implementa a função de clique no botão de logout
  if (btn_logout) {
    btn_logout.addEventListener("click", async () => {
        playSound("click");
        await fetch("/pagina_destino", { // Registra na base que o usuário foi para a tela de login
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pagina_destino: "Home -> Login" })
        });
        window.location.href = "/";
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
    userName.textContent = "Visitante";
    perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes_visitante")}/${maxEnergiaVisitantes}`;

    // Decide se deve exibir modal para convidar a fazer registro
    const respondidas = JSON.parse(localStorage.getItem("visitante_respondidas"));
    const totalRespondidas = (respondidas?.length || 0);

    const MARCO = 10;
    const marcoAtual = Math.floor(totalRespondidas / MARCO) * MARCO;
    const chaveRecusa = `modal_registro_fechado_${marcoAtual}`;

    if (totalRespondidas >= 10 && !localStorage.getItem(chaveRecusa)) {
      exibirModalRegistroVisitante(marcoAtual);
    };
  }
  else {
    userName.textContent = localStorage.getItem("nome_usuario");
  }
})
