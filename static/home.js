import { deveEncerrarQuiz, obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem, idsReservados, idsVisitantesReservados, obterInfoRankingAtual, pontuacaoTemaPadraoVisitantes, registrarInteracaoAnuncio, sincronizarPontuacoesVisitante, slugify, temas_disponiveis } from "./utils.js";
import { playSound } from "./sound.js";

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
  const maxEnergiaVisitantes = 30;
  const maxEnergiaUsuarios = 500;
  localStorage.setItem("modoVisitante", MODO_VISITANTE ? "true" : "false");
  localStorage.setItem('limite_energia', maxEnergiaUsuarios);
  const idsUsuariosIsentos = ['291', '439'] // Usuários que não recebem convite para compra de energia
  const isAdmin = window.ADS_CONFIG.isAdmin;
  const controleLogs = {};

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

    // Verifica e inicializa o controle de perguntas respondidas por tema e dificuldade no localStorage
    if (!localStorage.getItem("respondidas_visitante_por_dificuldade")) {
      const dicRespondidasPorDificuldade = {};
      const dificuldades = ['Fácil', 'Médio', 'Difícil', 'Extremo'];

      // Para cada tema, cria uma chave para cada nível de dificuldade
      temas_disponiveis.forEach(tema => {
        dificuldades.forEach(nivel => {
          let chaveComposta = `${tema}_${nivel}`;
          dicRespondidasPorDificuldade[chaveComposta] = 0; // Começa com zero respostas respondidas
        });
      });

      // Salva no localStorage convertido em string JSON
      localStorage.setItem("respondidas_visitante_por_dificuldade", JSON.stringify(dicRespondidasPorDificuldade));
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

  function abrirModal({titulo = "", corpoHTML = "", textoPrimario = null, textoSecundario = null, onPrimario = null, onSecundario = null, modalReenvioEmail = false, 
    ativarBotaoPrimario = true, ativarBotaoSecundario = true
  }) {
    // Bloqueia interação geral
    btnModalPrimario.disabled = true;
    btnModalSecundario.disabled = true;
    setTimeout(() => {
      if (ativarBotaoPrimario) btnModalPrimario.disabled = false;
      if (ativarBotaoSecundario) btnModalSecundario.disabled = false;
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
    //if (window.ADS_CONFIG.isAdmin) sessionStorage.removeItem("anuncios_vistos");

    // 1. Obtém o horário atual de Brasília/São Paulo
    const agoraSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));

    function configurarBanner(container, produto) {
      const linkElement = container.querySelector(".link-anuncio-geral");
      const imgProd = container.querySelector(".produto-container img");
      const imgLogo = container.querySelector(".logo-container img");
      
      // Carrega o logotipo do provedor
      if (produto.provedor === 'Amazon') {
        imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoAmazon";
      }
      else if (produto.provedor === 'Mercado Livre'){
        imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoMercadoLivre03";
      }
      else {
        imgLogo.src = "";
      }
      
      if (linkElement) {
        linkElement.setAttribute('data-id-anuncio', produto.id);
        linkElement.setAttribute('data-provedor-anuncio', produto.provedor);
        linkElement.setAttribute('data-tipo-midia-anuncio', produto.tipo_midia);
        linkElement.href = produto.link;

        // 1. REGISTRO DE IMPRESSÃO (Garante que só registra 1 impressão por ID de anúncio renderizado nesta sessão)
        const chaveImpressaoSessao = `imp_${produto.id}`;
        if (typeof registrarInteracaoAnuncio === 'function' && !sessionStorage.getItem(chaveImpressaoSessao)) {
          sessionStorage.setItem(chaveImpressaoSessao, 'true');
          registrarInteracaoAnuncio(linkElement, 'Impressão', produto.tema);
        }

        // 2. REGISTRO DE CLIQUE LIMPO (Remove qualquer listener anterior do elemento clonado/atual)
        if (linkElement._clickhandler) {
          linkElement.removeEventListener('click', linkElement._clickhandler);
        }

        linkElement._clickhandler = function(e) {
          // Evita múltiplos disparos num curto espaço de tempo (debounce de 1 segundo)
          const agora = Date.now();
          if (linkElement._ultimoClique && (agora - linkElement._ultimoClique < 1000)) {
            return;
          }
          linkElement._ultimoClique = agora;

          registrarInteracaoAnuncio(linkElement, 'Clique', produto.tema);
        };

        // Adiciona o listener apenas no 'click' geral (o navegador já lida com botão do meio abrindo o href nativamente)
        linkElement.addEventListener('click', linkElement._clickhandler);
      }

      if (imgProd) imgProd.src = produto.imagem;
    }


    // --- FUNÇÃO AUXILIAR: SELEÇÃO POR PRIORIDADE COM ROTAÇÃO NO SESSIONSTORAGE ---
    function selecionarMelhorAnuncio(lista) {
      if (!lista || lista.length === 0) return null;

      // Ordena por prioridade (maior número = maior prioridade)
      // Em caso de empate na prioridade, desempata aleatoriamente
      const listaOrdenada = [...lista].sort((a, b) => {
        const prioA = Number(a.prioridade || 0);
        const prioB = Number(b.prioridade || 0);
        if (prioB !== prioA) return prioB - prioA;
        return 0.5 - Math.random(); 
      });

      // Carrega os IDs já vistos da sessionStorage
      let vistos = JSON.parse(sessionStorage.getItem("anuncios_vistos") || "[]");

      // Procura o anúncio de maior prioridade que AINDA NÃO foi visto
      let escolhido = listaOrdenada.find(a => !vistos.includes(a.id));

      // Se todos os anúncios da lista já foram vistos nesta sessão, reseta o histórico para essa lista
      if (!escolhido) {
        const idsLista = listaOrdenada.map(a => a.id);
        vistos = vistos.filter(id => !idsLista.includes(id));
        escolhido = listaOrdenada[0];
      }

      // Salva o ID escolhido no sessionStorage para a rotação das próximas páginas
      if (escolhido) {
        vistos.push(escolhido.id);
        sessionStorage.setItem("anuncios_vistos", JSON.stringify(vistos));
      }

      return escolhido;
    }

    try {
      const resposta = await fetch('/api/obter_anuncios?tema=Banner horizontal');
      const dados = await resposta.json();

      // 2. Filtra anúncios válidos (não expirados e de acordo com a permissão do usuário)
      const filtrarValidos = (lista) => (lista || []).filter(a => {
        const expira = new Date(a.oferta_expira_em);
        return expira > agoraSP && (
          window.ADS_CONFIG.isAdmin || 
          (a.disponivel_visitantes === true && MODO_VISITANTE) || 
          (a.disponivel_usuarios && !MODO_VISITANTE)
        );
      });

      const anunciosAmazon = filtrarValidos(dados['Amazon']);
      const anunciosML = filtrarValidos(dados['Mercado Livre']);

      // Lista unificada com todos os anúncios válidos disponíveis
      const todosAnunciosValidos = [...anunciosAmazon, ...anunciosML];

      if (!window.ADS_CONFIG.isMobile) {
        // --- DESKTOP: Amazon na Esquerda, Mercado Livre na Direita ---
        
        // Amazon (Esquerda)
        const melhorAmazon = selecionarMelhorAnuncio(anunciosAmazon);
        if (melhorAmazon) {
          configurarBanner(bannerTopoEsquerda, melhorAmazon);
          bannerTopoEsquerda.style.visibility = "visible";
        } else {
          bannerTopoEsquerda.style.visibility = "hidden";
        }

        // Mercado Livre (Direita)
        const melhorML = selecionarMelhorAnuncio(anunciosML);
        if (melhorML) {
          configurarBanner(bannerTopoDireita, melhorML);
          bannerTopoDireita.style.visibility = "visible";
        } else {
          bannerTopoDireita.style.visibility = "hidden";
        }

      } else {
        // --- MOBILE: Sempre exibe no bannerTopoEsquerda o melhor entre TODOS ---
        
        const melhorGeralMobile = selecionarMelhorAnuncio(todosAnunciosValidos);
        if (melhorGeralMobile) {
          configurarBanner(bannerTopoEsquerda, melhorGeralMobile);
          bannerTopoEsquerda.style.visibility = "visible";
        } else {
          bannerTopoEsquerda.style.visibility = "hidden";
        }

        // O banner da direita fica oculto no mobile
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

  if (isAdmin && !MODO_VISITANTE) inserirBotaoModoTeste();
  exibirAnuncios();

  function registrarLog(textoLog) {
    const agora = Date.now();
    const ultimoEnvio = controleLogs[textoLog] || 0;

    // Intervalo de 20 segundos (20000 milissegundos)
    if (agora - ultimoEnvio < 20000) {
      return; // Ignora o envio se foi registrado há menos de 20 segundos
    }
    controleLogs[textoLog] = agora;

    try {
      fetch('/api/registrar-acesso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pagina: textoLog,
          id_visitante: idVisitante
        })
      })
    } catch (error) {
      console.warn('Não foi possível registrar log');
    }
  }

  async function iniciarQuiz(event) {

    try { // Registra tentativa de início de quiz caso seja o primeiro login na conta do usuário
      if (!MODO_VISITANTE) {
        let jaTentouAntes = localStorage.getItem('primeira_tentativa_inicio_quiz');
        // if (window.ADS_CONFIG.isAdmin) jaTentouAntes = false;
        if (!jaTentouAntes) registrarLog('Tentativa de iniciar Quiz');
      }
    } catch (error) {console.error("Erro no bloco de rastreamento:", error)};

    function desbloquearBotoes() {permitir_escolher_tema = true};

    // Retorna caso não seja permitido iniciar o quiz
    const config = window.ADS_CONFIG;
    if (config.registrandoModoTeste) {
      registrarLog('Retorno - registrando modo teste');
      return;
    }
    if (!permitir_escolher_tema) {
      //registrarLog('Retorno - não foi permitido escolher tema');
      return;
    } 

    playSound("click");
    permitir_escolher_tema = false; // Para não tentar iniciar outro enquanto um quiz é carregado

    // Atualiza o tema atual, modo de jogo e tipo de pergunta no localStorage
    tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
    localStorage.setItem("tema_atual", tema_atual);
    localStorage.setItem("modo_jogo", 'desafio');

    if (!tema_atual) {
      console.error("Tema não definidos na URL");
      desbloquearBotoes();
      registrarLog('Retorno - tema não definido');
      return;
    };

    // Decide se deve exibie mensagem avisando que as perguntas acabaram
    let perguntas_restantes_atuais = parseInt(perguntas_restantes?.textContent.split("/")[0] ?? "0", 10);
    // if (isAdmin) perguntas_restantes_atuais = 0;

    let temBonusParaEsteTema = false;
    if (!MODO_VISITANTE && window.bonusTemasAtuais && Array.isArray(window.bonusTemasAtuais)) {
      const bonusDoTema = window.bonusTemasAtuais.find(b => b.tema === tema_atual);
      if (bonusDoTema && bonusDoTema.perguntas_bonus_restantes > 0) {
        temBonusParaEsteTema = true;
      }
    }
    if (perguntas_restantes_atuais <= 0 && !temBonusParaEsteTema) {
      if (!MODO_VISITANTE) {
        exibirMensagem(mensagem, `Energia esgotada, aguarde a recarga diária ou realize a compra de energia para responder novas perguntas`, corMensagemAlerta, true, false, 'flex');
      }
      else {
        exibirMensagem(mensagem, `É necessário criar uma conta para ter acesso ao conteúdo completo do jogo`, corMensagemAlerta, true, false, 'flex');
      }
      desbloquearBotoes();
      registrarLog('Retorno - sem energia');
      return;
    }
    exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false, false, 'flex')

    // Carrega as perguntas para o quiz
    try {
      // Reinicia variáveis do session de quizzes anteriores
      sessionStorage.removeItem("ultima_dificuldade_usada");
      sessionStorage.removeItem("repeticoes_dificuldade");
      sessionStorage.removeItem("erros_consecutivos");
      sessionStorage.removeItem("acertos_consecutivos");
      sessionStorage.removeItem("marcos_niveis");

      if (!MODO_VISITANTE) {
        const rankingUsuario = obterInfoRankingAtual(tema_atual).ranking;
        const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio&ranking-usuario=${rankingUsuario}`)
        
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

          
          if (ha_perguntas_disponiveis && !encerrar_quiz) {
            localStorage.removeItem("perguntas_respondidas");
            // Pega os anúncios que serão utilizados na tela de quiz
            /*
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
            }*/
            // Salva no localStorage o bônus de energia do usuário para ler na tela de quiz caso tenha no tema escolhido
            let maiorBonusTema = 0;
            if (window.bonusTemasAtuais && Array.isArray(window.bonusTemasAtuais)) {
              const bonusDoTema = window.bonusTemasAtuais.find(b => b.tema === tema_atual);
              if (bonusDoTema) {
                maiorBonusTema = bonusDoTema.perguntas_bonus_restantes;
              }
            }
            sessionStorage.setItem("perguntas_bonus_restantes", maiorBonusTema);
            window.location.href = `/quiz/${encodeURIComponent(slugify(tema_atual))}`;
            mensagem.style.opacity = 0;
            permitir_escolher_tema = true;
          }
          else {
            exibirMensagem(mensagem, `Você não possui perguntas disponíveis no tema ${tema_atual} no momento`, corMensagemAlerta, true, false, 'flex');
            desbloquearBotoes();
            registrarLog(`Retorno - sem perguntas no tema ${tema_atual}`);
            return;
          }
        }
      }
      else { // modo visitante
        const url = `/api/perguntas?tema=${encodeURIComponent(tema_atual)}&modo=desafio`;
        const response = await fetch(url);
        if (response.ok) {
          // 1. Pega as perguntas no backend
          const data = await response.json();
          // 2. Elimina perguntas já respondidas individualmente pelo ID
          const idsRespondidas = JSON.parse(localStorage.getItem("visitante_respondidas") ?? "[]");
          // 3. Recupera o progresso de quantidade respondida por Tema e Dificuldade
          const progressoPorDificuldade = JSON.parse(localStorage.getItem("respondidas_visitante_por_dificuldade") ?? "{}");
          // 4. Cotas máximas permitidas para visitantes
          const cotasVisitante = {'Fácil': 1, 'Médio': 2, 'Difícil': 2, 'Extremo': 0};

          Object.keys(data.perguntas).forEach(dificuldade => {
            if (!Array.isArray(data.perguntas[dificuldade])) return;

            // Primeiro tira as que ele já respondeu nominalmente
            let perguntasDisponiveis = data.perguntas[dificuldade].filter(
              p => !idsRespondidas.includes(p.id_pergunta)
            );

            // Calcula quantas ele já respondeu neste tema/dificuldade específica
            let chaveProgresso = `${tema_atual}_${dificuldade}`;
            let jaRespondidasNesteNivel = progressoPorDificuldade[chaveProgresso] || 0;
            let limiteMaximo = cotasVisitante[dificuldade] || 0;

            // Descobre quantas vagas ainda restam para completar a cota
            let vagasRestantes = limiteMaximo - jaRespondidasNesteNivel;

            // Se a vaga jáestiver esgotada, zera a lista dessa dificuldade
            if (vagasRestantes <= 0) {
              data.perguntas[dificuldade] = [];
            } else {
              // Caso contrário, corta o array para pegar apenas a quantidade exata que falta
              data.perguntas[dificuldade] = perguntasDisponiveis.slice(0, vagasRestantes);
            }
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
          mensagem.style.opacity = 0;
          permitir_escolher_tema = true;
        }
        else {
          exibirMensagem(mensagem, `Não foi possível iniciar o quiz no tema ${tema_atual}`, corMensagemAlerta, true, false, 'flex');
          desbloquearBotoes();
        }
      }
    }
    catch (error) {
      console.error("Erro ao carregar perguntas", error)
      // Permite alterar novamente o tipo de pergunta e tema
      exibirMensagem(mensagem, `Ocorreu um erro e não foi possível iniciar o seu quiz, tente novamente mais tarde`, 'red', true, false, 'flex');
      desbloquearBotoes();
      registrarLog(`Erro: ${error}`);
    }
  }

  async function exibirModalEmailOuEnergia() {
    const emailConfirmado = localStorage.getItem("email_confirmado") === "true";
    const emailUsuario = localStorage.getItem("email_usuario") || "";
      
    // --- FUNÇÃO 2: Modal de Energia Baixa ---
    function exibirModalEnergiaBaixa() {
      const eIsento = idsUsuariosIsentos.includes(idUsuario); // Usuários que já responderam muitas perguntas
      const perguntasRestantesAtual = parseInt(localStorage.getItem('perguntas_restantes') || '500');
      let deveExibir = sessionStorage.getItem('exibir_modal_sem_energia') === 'true' && !eIsento && perguntasRestantesAtual == 0;
      //if (isAdmin) deveExibir = true;

      if (deveExibir) {
        // Registra na base o aparecimento do modal de energia esgotada
        try {
          fetch("/api/registrar-acesso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagina: "Modal de energia baixa" })
          });
        } catch (err) {console.warn("Falha ao registrar abertura do modal de energia baixa:", err)};
        sessionStorage.setItem('exibir_modal_sem_energia', false); // Para não exibir mais de 1 vez
        abrirModal({
          titulo: "⚡ Sua energia acabou!",
          corpoHTML: `
            <p>Adquira mais energia para continuar respondendo novas perguntas e subir no ranking.</p>
          `,
          textoPrimario: "Adquirir Energia",
          textoSecundario: "Esperar Recarga Gratuita",
          onPrimario: () => {window.location.href = "/recarga-de-energia"},
          onSecundario: () => {modal.classList.add("hidden")}
        });
      }
    }

    // --- FUNÇÃO 1: Modal de Confirmação de E-mail ---
    function exibirModalConfirmacaoEmail(onCloseCallback) {
      // Registra na base o aparecimento do modal de confirmação de e-mail
      try {
        fetch("/api/registrar-acesso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pagina: "Modal de confirmação de e-mail" })
        });
      } catch (err) {console.warn("Falha ao registrar abertura do modal de confirmação de email:", err)};
      abrirModal({
        textoPrimario: "Fechar",
        textoSecundario: "Reenviar e-mail",
        onPrimario: () => {
          modal.classList.add("hidden");
          localStorage.setItem("modal_confirmacao_email_exibido", "true");
          msgModal.style.display = 'none'; // Remove mensagem para não ficar no próximo modal
          
          // Dispara o próximo passo (abre o modal de plano inicial)
          if (typeof onCloseCallback === 'function') onCloseCallback();
        },
        onSecundario: () => {
          // --- CONTROLE DE FREQUÊNCIA DE REENVIO (1 vez por dia / 24 horas) ---
          const ULTIMO_ENVIO_CHAVE = "ultimo_horario_email_reenviado";
          const ultimoEnvio = localStorage.getItem(ULTIMO_ENVIO_CHAVE);
          const agora = new Date().getTime();
          const UM_DIA_EM_MS = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
          const podeReenviar = !ultimoEnvio || (agora - parseInt(ultimoEnvio) > UM_DIA_EM_MS);

          if (!podeReenviar) {
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
              localStorage.setItem(ULTIMO_ENVIO_CHAVE, agora.toString());
              msgModal.innerText = "O e-mail de confirmação foi reenviado";
              msgModal.style.color = "lime";
            } else {
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

    // --- FLUXO PRINCIPAL ---
    try {
      // --- CONTROLE DE FREQUÊNCIA DO MODAL DE E-MAIL (1 vez por dia) ---
      const CHAVE_TEMPO_AVISO_EMAIL = "ultimo_horario_aviso_email_exibido";
      //if (idsReservados.includes(Number(idUsuario))) localStorage.removeItem(CHAVE_TEMPO_AVISO_EMAIL);
      const ultimoAvisoEmail = localStorage.getItem(CHAVE_TEMPO_AVISO_EMAIL);
      const agora = new Date().getTime();
      const UM_DIA_EM_MS = 24 * 60 * 60 * 1000; // 24 horas

      // Deve exibir se o e-mail NÃO está confirmado e (nunca apareceu OU já passou 1 dia)
      const deveExibirAvisoEmail = !emailConfirmado && (!ultimoAvisoEmail || (agora - parseInt(ultimoAvisoEmail) > UM_DIA_EM_MS));
      if (deveExibirAvisoEmail) {
        localStorage.setItem(CHAVE_TEMPO_AVISO_EMAIL, agora.toString());
        exibirModalConfirmacaoEmail(exibirModalEnergiaBaixa);
        spanEmail.textContent = emailUsuario;
      } else exibirModalEnergiaBaixa();
    } catch (e) {
      console.error("Erro ao tentar gerenciar modais de entrada", e);
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

  function animarAtualizacaoEnergia(data) {
    let valorInicial = data.perguntas_restantes - (data.energia_ganha || 0);
    if (valorInicial < 0) valorInicial = 0;

    if (perguntas_restantes) {
      localStorage.setItem('perguntas_restantes', data.perguntas_restantes);
      perguntas_restantes.textContent = `${valorInicial}/${maxEnergiaUsuarios}`;
    }

    const elBonus = document.getElementById('energia-bonus');
    if (elBonus) {
      const ganho = data.energia_ganha ? `+${data.energia_ganha}` : ''; 
      elBonus.textContent = ganho;
      elBonus.style.opacity = '1';
      elBonus.style.display = 'inline';

      setTimeout(() => {
        let duracaoTotal = 2000; // Ajuste o tempo total aqui se quiser mais lento/rápido
        let passos = Math.abs(data.perguntas_restantes - valorInicial);
        if (passos === 0) passos = 1;
        let intervaloTempo = Math.max(Math.floor(duracaoTotal / passos), 60);
        
        let valorAtual = valorInicial;
        let timerContagem = setInterval(() => {
          if (valorAtual < data.perguntas_restantes) {
            valorAtual++;
          } else if (valorAtual > data.perguntas_restantes) {
            valorAtual--;
          }

          if (perguntas_restantes) {
            perguntas_restantes.textContent = `${valorAtual}/${maxEnergiaUsuarios}`;
          }

          if (valorAtual === data.perguntas_restantes) {
            clearInterval(timerContagem);

            setTimeout(() => {
              elBonus.style.opacity = '0';
              setTimeout(() => {
                elBonus.style.display = 'none';
              }, 800);
            }, 3000);
          }
        }, intervaloTempo);
      }, 1000); // 1 segundo de espera antes de subir os números
    }
  }

  function atualizarBadgesBonus(bonusArray) {
    if (!bonusArray || bonusArray.length === 0) return;

    bonusArray.forEach(bonus => {
      const badge = document.querySelector(`.bonus-badge[data-tema-badge="${bonus.tema}"]`);
      if (badge) {
        badge.innerHTML = `🎁 +${bonus.perguntas_bonus_restantes}`;
        badge.title = `Bônus ativo: ${bonus.perguntas_bonus_restantes} perguntas gratuitas em ${bonus.tema}!`;
        badge.classList.add('ativo'); // Adiciona a classe CSS que força a exibição
      }
    });
  }

  // Função que roda a cada 5 segundos
  function verificarAtualizacaoEnergia() {
    if (document.visibilityState !== 'visible' || MODO_VISITANTE) return;
    //if (isAdmin) console.log("Verificando mudança de dia");
    //if (isAdmin) localStorage.removeItem('ultima_data_verificacao');

    // Pega a data local correta no formato YYYY-MM-DD respeitando o fuso do Brasil
    const hoje = new Date().toLocaleDateString('en-CA');
    
    // Recupera a última data salva no localStorage do navegador
    const ultimaDataVerificada = localStorage.getItem('ultima_data_verificacao');

    // Se a data de hoje for diferente da última salva, o dia virou!
    if (ultimaDataVerificada !== hoje) {
      localStorage.setItem('ultima_data_verificacao', hoje);
      if (isAdmin) console.log("Virada de dia detectada pelo navegador! Atualizando energia...");

      // Chama a rota do backend para processar a recarga de energia do novo dia
      fetch('/api/recarregar_energia_usuario', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'}
      })
      .then(response => response.json()) // Serve para acessar data.perguntas_restantes por exemplo
      .then(data => {
        if (data.success) {
          localStorage.setItem('ultima_data_verificacao', hoje);
          animarAtualizacaoEnergia(data);
          if (data.bonus_energia && data.bonus_energia.length > 0 && isAdmin) {
            console.log("🎁 Bônus de temas disponíveis:", data.bonus_energia);
          }
          atualizarBadgesBonus(data.bonus_energia);
          window.bonusTemasAtuais = data.bonus_energia;
        } else console.warn("Não foi possível atualizar a energia:", data.message);
      })
      .catch(error => {
        console.error("Erro na requisição de energia:", error);
      });
    }
  }

  if (!MODO_VISITANTE) {
    setInterval(verificarAtualizacaoEnergia, 5000); // Dispara a verificação a cada 5 segundos (5000 ms)
    // Chama a rota do backend para processar a recarga de energia do novo dia
    fetch('/api/recarregar_energia_usuario', {
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    })
    .then(response => response.json()) // Serve para acessar data.perguntas_restantes por exemplo
    .then(data => {
      if (data.success) {
        animarAtualizacaoEnergia(data);
        if (data.bonus_energia && data.bonus_energia.length > 0 && isAdmin) {
          console.log("🎁 Bônus de temas disponíveis:", data.bonus_energia);
        }
        atualizarBadgesBonus(data.bonus_energia);
        window.bonusTemasAtuais = data.bonus_energia;
        permitir_escolher_tema = true;
      } else console.warn("Não foi possível atualizar a energia:", data.message);
      exibirModalEmailOuEnergia();
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
      id_visitante: idVisitante,
      id_usuario: idUsuario
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
    permitir_escolher_tema = true;

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
