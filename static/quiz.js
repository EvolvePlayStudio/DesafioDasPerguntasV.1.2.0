import { detectarModoTela, deveEncerrarQuiz, obterDificuldadesDisponiveis, obterInfoRankingAtual, fetchAutenticado } from "./utils.js"

const MODO_VISITANTE = localStorage.getItem("modoVisitante") === "true";
// Envia erros para a base de dados caso ocorram (necessário enviar a linha onde ocorre o erro para melhor depuração)
window.onerror = function (message) {
  if (!localStorage.getItem("id_visitante") === 'b6c5d32c-c5d8-41aa-811e-aa45c328b372' && !localStorage.getItem("id_usuario") in (4, 6, 16)) {
    fetch("/api/debug/frontend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mensagem: String(message),
      pagina: location.pathname,
      id_visitante: localStorage.getItem("id_visitante"),
      user_agent: navigator.userAgent
    })
  }).catch(() => {});
  }
};

let perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"));
let perguntas_respondidas = [];
let inicio_pergunta;  // horário inicial da pergunta
let pontuacoes_usuario;
const tema_atual = decodeURIComponent(localStorage.getItem("tema_atual"))
if (MODO_VISITANTE) {
  pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_visitante"))
  localStorage.setItem("pontuacao_anterior", pontuacoes_usuario[tema_atual])
}
else {
  pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario"));
}
localStorage.setItem("pontuacao_anterior", pontuacoes_usuario[tema_atual]);

let pergunta_selecionada = null;
let regras_pontuacao = JSON.parse(localStorage.getItem("regras_pontuacao"));
let info_ultimo_ranking = regras_pontuacao[regras_pontuacao.length - 1];
let regras_usuario = null;
let ranking_usuario = null;
const contador_dicas_restantes = document.getElementById("contador-dicas");
const rankings_usuario = JSON.parse(localStorage.getItem("rankings_usuario"));
const modo_jogo = localStorage.getItem("modo_jogo").toLocaleLowerCase();
const tipo_pergunta = localStorage.getItem("tipo_pergunta").toLocaleLowerCase();
const lbl_pontuacao_usuario = document.getElementById('pontuacao');
const lbl_pontos_ganhos = document.getElementById('incremento-pontuacao');
const alternativasContainer = document.getElementById("alternativas-container");
const resultado = document.getElementById('resultado');
const caixa_para_resposta = document.getElementById('resposta-input');
const dica_box = document.getElementById("dica-box");
let alternativaSelecionada = null; // Guarda a letra clicada (A, B, C, D)
let respostasDesdeUltimaForcagem = 0; // Para pegar a pergunta do nível que tem mais a cada x respondidas

// Booleanas
let dica_gasta = false;
let animacao_concluida = false;
let ha_perguntas_disponiveis = false;
let aguardando_proxima = false; // Quando estiver aguardando a próximo pergunta

// Botões
const btn_enviar = document.getElementById("btn-enviar");
const btn_pular = document.getElementById("btn-pular");
const botoes_finalizar_div = document.getElementById("botoes-acao");
const botoes_enviar_div = document.getElementById("botoes-envio");
const alternativaBtns = Array.from(alternativasContainer.querySelectorAll(".alternativa-btn"))

// Variáveis relacionadas ao nível de dificuldade
const PROBABILIDADES_POR_RANKING = {
  Iniciante: { Fácil: 0.65, Médio: 0.35, Difícil: 0.00, Extremo: 0.00 },
  Aprendiz:  { Fácil: 0.40, Médio: 0.45, Difícil: 0.15, Extremo: 0.00 },
  Estudante: { Fácil: 0.20, Médio: 0.50, Difícil: 0.25, Extremo: 0.05 },
  Sábio:     { Fácil: 0.10, Médio: 0.45, Difícil: 0.35, Extremo: 0.10 },
  Lenda:     { Fácil: 0.02, Médio: 0.38, Difícil: 0.40, Extremo: 0.20 }
};
const coresDificuldade = {
    fácil: "green",
    médio: "gold",
    difícil: "red",
    extremo: "#3e16d1"
};
const DIFICULDADES_ORDENADAS = ["Fácil", "Médio", "Difícil", "Extremo"];

// Círculo amarelo com interrogação preta para símbolo de pergunta pulada
const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"
  viewBox="0 0 24 24" style="vertical-align: middle;">
  <g transform="translate(0,-1)">
    <circle cx="12" cy="12" r="11" fill="#FFD700"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
          font-family="Segoe UI Emoji,Segoe UI Symbol,Arial" font-size="13"
          font-weight="700" fill="#111">?</text>
  </g>
</svg>`;
// Tempos para as alternativas
const sleep = ms => new Promise(res => setTimeout(res, ms));
const PAUSA_ANTES_DA_A              = 500;
const GAP_ANTES_DA_LETRA            = 120;
const GAP_LETRA_PARA_TEXTO          = 180;
const GAP_ENTRE_ALTERNATIVAS        = 380;
const VELOCIDADE_LETRA_ENUNCIADO    = 21;
const VELOCIDADE_LETRA_ALTERNATIVAS = 15;

// Variáveis para animação da barra de progresso
let ranking_visual_anterior = null;
const barra = document.getElementById("barra-progresso");

const hint_dica = document.getElementById("hint-dica");
const hint_pular = document.getElementById("hint-pular");;
const hint_avaliacao = document.getElementById("hint-avaliacao");

const opcoesUsuarioRaw = sessionStorage.getItem("opcoes_usuario");
const opcoesUsuario = opcoesUsuarioRaw? JSON.parse(opcoesUsuarioRaw): null;
const exibir_instrucoes_quiz = opcoesUsuario?.exibir_instrucoes_quiz;

if (tipo_pergunta === "objetiva" || !exibir_instrucoes_quiz) {
  hint_avaliacao.style.marginTop = "0.8rem";
}

// Variáveis relacionadas ao feedback que o usuário envia para a pergunta
const estrelas_avaliacao = document.getElementById("avaliacao");
const estrelas = document.querySelectorAll(".estrela");
const box_comentario = document.getElementById("box-comentario");
const textarea_comentario = document.getElementById("comentario-texto");
let estrelas_iniciais;
let comentario_inicial;

const contador_perguntas_restantes = document.getElementById("perguntas-count");

// Ids de perguntas que são selecionados primeiro
const ids_objetivas_prioridade = {
  'Artes':      [163, 167, 172, 336, 338, 353],
  'Astronomia': [6, 11, 12, 479, 492, 500],
  'Biologia':   [18, 22, 29, 361, 365, 371, 580, 581, 585],
  'Esportes':   [55, 63, 66, 75, 462, 467, 471],
  'Filosofia':  [132, 142, 146, 149, 150, 302, 305],
  'Geografia':  [80, 82, 84, 86, 90, 93, 206, 318],
  'História':   [35, 41, 42, 118, 127, 209, 262],
  'Mídia':      [99, 106, 381, 385, 391, 604],
  'Música':     [222, 226, 229, 231, 238, 424, 439],
  'Química':    [184, 188, 189, 202, 538],
  'Tecnologia': [243, 245, 246, 251, 273, 411, 415],
  'Variedades': [136, 192, 270, 451, 453, 621, 627]
}

const ids_discursivas_prioridade = {
  'Artes': [251, 261, 269, 270, 524, 612],
  'Astronomia': [96, 97, 103, 104, 108, 111, 531, 539],
  'Biologia': [8, 10, 43, 48, 50, 52, 55, 438, 620],
  'Esportes': [11, 12, 14, 79, 80, 82, 83, 513, 523],
  'Filosofia': [227, 237, 246, 408, 410, 554, 557, 558],
  'Geografia': [134, 157, 158, 163, 169, 174],
  'História': [29, 30, 35, 59, 128, 129, 275],
  'Mídia': [184, 209, 451, 635, 637, 641, 642, 650],
  'Música': [313, 317, 327, 479, 500],
  'Química': [291, 301, 303, 308, 577, 582],
  'Tecnologia': [152, 342, 345, 351, 352, 358, 392, 462, 470],
  'Variedades': [24, 25, 27, 67, 107, 120, 221, 376, 392, 658, 659, 662]
}

function alterarPontuacaoUsuario(pontuacao_atual, pontuacao_alvo, callbackAtualizarUI) {
  const intervaloMin = 20; // ms entre frames no máximo, para smooth
  let ultimaExecucao = 0;

  function passo(timestamp) {
    if (!ultimaExecucao) ultimaExecucao = timestamp;
    const delta = timestamp - ultimaExecucao;

    if (delta > intervaloMin) {
      let diferenca = pontuacao_alvo - pontuacao_atual;
      if (diferenca === 0) {
        return;
      }

      // Calcula passo proporcional (4% da distância, no mínimo 1)
      // Usa Math.sign para saber se deve incrementar ou decrementar
      let passo = Math.max(1, Math.floor(Math.abs(diferenca) * 0.04));
      pontuacao_atual += passo * Math.sign(diferenca);

      // Corrige ultrapassagem (ex: passar do alvo)
      if ((diferenca > 0 && pontuacao_atual > pontuacao_alvo) ||
          (diferenca < 0 && pontuacao_atual < pontuacao_alvo)) {
        pontuacao_atual = pontuacao_alvo;
      }

      callbackAtualizarUI(pontuacao_atual);
      ultimaExecucao = timestamp;
    }

    window.requestAnimationFrame(passo);
  }

  window.requestAnimationFrame(passo);
}

function ativarBotoes() {
  btn_enviar.disabled = false;
  btn_pular.disabled = false;
}

function atualizarRankingVisual() {
  // Declara as variáveis que serão úteis (ranking e pontos já estão atualizados aqui após cáculo dos pontos ganhos ou perdidos)
  const info_ranking_atual = obterInfoRankingAtual(tema_atual, MODO_VISITANTE);
  rankings_usuario[tema_atual] = info_ranking_atual.ranking
  const pontuacao = pontuacoes_usuario[tema_atual] || 0;
  let ranking_anterior = "";
  let ranking_proximo;
  let progressoFinal = 100;
  let intervalo;

  function animarBarraAte(valorFinal) {
    return new Promise(resolve => {
      const onEnd = (e) => {
        if (e.propertyName === "width") {
          barra.removeEventListener("transitionend", onEnd);
          resolve();
        }
      };

      barra.addEventListener("transitionend", onEnd);

      requestAnimationFrame(() => {
        barra.style.transition = "width 1.1s linear"
        barra.style.width = valorFinal + "%";
      });
    });
  }

  // POSSÍVEL SIMPLIFICAÇÃO NO TRECHO ABAIXO
  async function animarBarra(tipoAnimacao, progressoFinal) {
    // Animação da barra na subida de ranking
    if (tipoAnimacao === "Subida de ranking") {
      await animarBarraAte(100);
      atualizarTextosRanking();
      barra.style.transition = "width linear 0s";
      barra.style.width = "0%";
      forcarReflow(barra);
    }
    // Animação da barra na descida de ranking
    else if (tipoAnimacao === 'Descida de ranking') {
      await animarBarraAte(0);
      atualizarTextosRanking();
      barra.style.transition = "width linear 0s";
      barra.style.width = "100%";
      forcarReflow(barra);
    }
    else {
      atualizarTextosRanking();
    }

    // Requisita a segunda parte da animação, após alteração do ranking
    await animarBarraAte(progressoFinal);
  }

  function atualizarTextosRanking() {
    document.getElementById("ranking").textContent = info_ranking_atual.ranking;
    document.getElementById("ranking-anterior").textContent = ranking_anterior;
    document.getElementById("ranking-proximo").textContent = ranking_proximo ? ranking_proximo.ranking : "";
  }

  function forcarReflow(elemento) {
    elemento.offsetWidth; // Força o browser a aplicar o estado atual
  }

  // Identifica o ranking anterior alcançado pelo usuário
  for (let i = 0; i < regras_pontuacao.length; i++) {
    if (regras_pontuacao[i].ranking === info_ranking_atual.ranking) {
      // Se não for o primeiro da lista, pega o anterior
      if (i > 0) {
        ranking_anterior = regras_pontuacao[i - 1].ranking;
      }
      break;
    }
  }

  // Identifica o próximo ranking a ser alcançado pelo usuário
  for (let i = 0; i < regras_pontuacao.length; i++) {
    const r = regras_pontuacao[i];
    if (pontuacao >= r.pontos_minimos && pontuacao <= r.pontos_maximos) {
      ranking_proximo = regras_pontuacao[i + 1];
      break;
    }
  }

  // Detecta mudança de ranking
  const mudouRanking = ranking_visual_anterior && ranking_visual_anterior !== info_ranking_atual.ranking;

  // Calcula progresso percentual
  if (ranking_proximo) {
    intervalo = ranking_proximo.pontos_minimos - info_ranking_atual.pontos_minimos;
  }
  else {
    intervalo = info_ranking_atual.pontos_maximos - info_ranking_atual.pontos_minimos;
  }
  progressoFinal = ((pontuacao - info_ranking_atual.pontos_minimos) / intervalo) * 100;
  progressoFinal = Math.min(100, Math.max(0, progressoFinal));

  if (mudouRanking) {
    const distanciaMin = Math.abs(pontuacao - info_ranking_atual.pontos_minimos);
    const distanciaMax = Math.abs(info_ranking_atual.pontos_maximos - pontuacao);
    const subiuRanking = distanciaMin < distanciaMax;
    const desceuRanking = distanciaMax < distanciaMin;
    if (subiuRanking) {
      animarBarra("Subida de ranking", progressoFinal);
    }
    else if (desceuRanking) {
      animarBarra("Descida de ranking", progressoFinal);
    }
  } 
  else {
    animarBarra("Ranking mantido", progressoFinal);
  }
}

function calcularPontuacao(acertou) {
  const dificuldade = pergunta_selecionada.dificuldade;
  if (!acertou) {
    let pontos_ganhos = 0;
    const resposta_usuario = caixa_para_resposta.value.trim()
    // Caso em que a pergunta não vale pontos nem para acertos nem para erros
    if (dificuldade === "Fácil" && regras_usuario.pontos_acerto_facil === 0 || dificuldade === "Médio" && regras_usuario.pontos_acerto_medio === 0) {
      pontos_ganhos = 0
    }
    else {
      if (tipo_pergunta === 'discursiva') {
        if (resposta_usuario === "") { // Caso de resposta vazia
          pontos_ganhos = regras_usuario.pontos_pular_pergunta;
        }
        else {
          pontos_ganhos = regras_usuario.pontos_erro
        }
      }
      else {
        pontos_ganhos = regras_usuario.pontos_erro
      }
      // Trata casos em que a pontuação do usuário ficaria negativa
      if (pontuacoes_usuario[tema_atual] + pontos_ganhos < 0) {
        pontos_ganhos = -pontuacoes_usuario[tema_atual]
      }
    }
    return pontos_ganhos;
  }

  let pontosBase = 0;
  switch (dificuldade) {
    case "Fácil":
      pontosBase = regras_usuario.pontos_acerto_facil;
      break;
    case "Médio":
      pontosBase = regras_usuario.pontos_acerto_medio;
      break;
    case "Difícil":
      pontosBase = regras_usuario.pontos_acerto_dificil;
      break;
    case "Extremo":
      pontosBase = regras_usuario.pontos_acerto_extremo;
      break;
    default:
      console.warn("Dificuldade desconhecida:", dificuldade);
      return 0;
  }
  let pontos_ganhos = pontosBase;

  if (dica_gasta && tipo_pergunta === 'discursiva') {
      const percentualPenalidade = regras_usuario.percentual_penalidade_dica / 100;
      const inteiroPenalidade = Math.round((pontosBase * percentualPenalidade) / 10) * 10;
      pontos_ganhos = pontosBase - inteiroPenalidade;
      
      // Fallback defensivo
      if (pontos_ganhos < 0) {
          console.warn("Penalidade excedeu a pontuação base. Aplicando pontuação base.");
          pontos_ganhos = pontosBase;
      }
  }
  
  // Trata casos em que a pontução do usuário ficaria acima do máximo permitido
  if (ranking_usuario === info_ultimo_ranking.ranking && pontuacoes_usuario[tema_atual] + pontos_ganhos > info_ultimo_ranking.pontos_maximos) {
      pontos_ganhos = info_ultimo_ranking.pontos_maximos - pontuacoes_usuario[tema_atual]
  }
  return pontos_ganhos;
}

function calcularTempoGasto() {
    return Math.floor((Date.now() - inicio_pergunta) / 1000);  // segundos
}

function callbackAtualizarUI (pontuacao) {
  lbl_pontuacao_usuario.textContent = pontuacao
}

function configurarEstrelas() {
  const estrelas = document.querySelectorAll(".estrela");

  estrelas.forEach((estrela, i) => {
    estrela.addEventListener("click", () => {
      const valor = i + 1;
      renderizarEstrelas(valor);
    });
  });
}

function desativarBotoes() {
  btn_enviar.disabled = true;
  btn_pular.disabled = true;
}

async function enviarResposta(pulando = false) {
  hint_dica.style.display = "none";
  hint_pular.style.display = "none";
  hint_avaliacao.style.display = "none";

  if (pulando) caixa_para_resposta.value = "";
  const pontuacao_atual = pontuacoes_usuario[tema_atual];

  function carregarComentarioAnterior() {
    // Estado inicial: desativado
    textarea_comentario.value = "";
    textarea_comentario.disabled = true;

    // Exibe caixa
    box_comentario.style.display = "block";

    // Se não há dado algum, não mostra
    if (!pergunta_selecionada.comentario) {
      comentario_inicial = "";
    }
    // Preenche se houver comentário anterior
    else {
      textarea_comentario.value = pergunta_selecionada.comentario;
      comentario_inicial = pergunta_selecionada.comentario;
    }

    // Ativa edição
    textarea_comentario.disabled = false;
  }

  function mostrarResultadoResposta(correto) {
    resultado.style.display = "block";
    if (tipo_pergunta === 'discursiva') {

      // Mostra as possibilidades de respostas corretas para a pergunta
      const respostas_corretas = pergunta_selecionada.respostas_corretas
      mostrarRespostasAceitas(respostas_corretas);

      // Exibe dica
      mostrarDica()
    }

    // Exibe nota, curiosidade ou explicação
    if (pergunta_selecionada.nota?.trim()) {
      let textoFormatado = pergunta_selecionada.nota;
      document.getElementById("nota-texto").innerHTML = textoFormatado;
      document.getElementById("nota-box").style.display = "block";
    }
    else {
      document.getElementById("nota-box").style.display = "none";
    }
    
    // Exibe a mensagem que indica se a resposta foi correta, errada ou se o usuário pulou
    const resposta_usuario = caixa_para_resposta.value.trim();
    if (tipo_pergunta === 'discursiva' && resposta_usuario.trim() === "") {
      const svgEscolhido = svg1;
      resultado.style.color = "#FFD700"
      resultado.innerHTML = `${svgEscolhido} Não respondida`;
    }
    else if (correto) {
      resultado.style.color = "lime";
      resultado.innerHTML = '✅ Resposta correta!';
    }
    else {
      resultado.style.color = "red";
      resultado.innerHTML = '❌ Resposta incorreta';
    }

    aguardando_proxima = true;
    botoes_enviar_div.style.display = "none";

    // Chama as estrelas de feedback e carrega as anteriores enviadas pelo usuário
    const avaliacao_anterior = pergunta_selecionada.estrelas || 0;
    renderizarEstrelas(avaliacao_anterior);
    estrelas_iniciais = avaliacao_anterior;
    estrelas_avaliacao.style.display = "block";
    
    // Carrega comentário de feedback anterior do usuário caso exista
    carregarComentarioAnterior();

    

    // Exibe os comentários dos outros usuários
    // document.getElementById('comentarios').style.display = 'block';
  }

  function mostrarRespostasAceitas(lista) {
    try {
      const container = document.getElementById("respostas-aceitas-box");
      const lista_respostas_aceitas = document.getElementById("lista-respostas");
      lista_respostas_aceitas.textContent = lista.join(" / ");
      container.style.display = "block";
    }
    catch (err) {
      console.error("Erro ocorrido ao tentar mostrar respostas aceitas:", err)
    }
  }

  async function registrarResposta(resposta_usuario, acertou, usou_dica, pontos_ganhos, tempo_gasto, id_pergunta, versao_pergunta) {
    try {
      const response = await fetch('/registrar_resposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_pergunta: tipo_pergunta,
          resposta_usuario: resposta_usuario,
          acertou: acertou,
          usou_dica: usou_dica,
          pontos_ganhos: pontos_ganhos,
          tempo_gasto: tempo_gasto,
          id_pergunta: id_pergunta,
          versao_pergunta: versao_pergunta,
          tema: tema_atual,
          pontos_usuario: pontuacao_atual,
          dificuldade: pergunta_selecionada.dificuldade
        })
      });

      const data = await response.json();
      if (data.sucesso) {
        // Atualiza a pontuação do usuário para o tema no localStorage
        pontuacoes_usuario[tema_atual] = data.nova_pontuacao;
        alterarPontuacaoUsuario(pontuacao_atual, pontuacoes_usuario[tema_atual], callbackAtualizarUI)
        localStorage.setItem("pontuacoes_usuario", JSON.stringify(pontuacoes_usuario));

        // Atualiza as perguntas restantes do usuário no localStorage
        localStorage.setItem("perguntas_restantes", data.perguntas_restantes)
        contador_perguntas_restantes.textContent = data.perguntas_restantes

        // Atualiza o número de dicas restantes do usuário no localStorage e no contador de dicas
        if (tipo_pergunta === 'discursiva') {
          contador_dicas_restantes.textContent = data.dicas_restantes;
          localStorage.setItem("dicas_restantes", data.dicas_restantes);
        }

        atualizarRankingVisual();
        return true;
      } 
      else {
        console.error('Erro ao registrar resposta:', data.mensagem);
        return false;
      }

    } 
    catch (err) {
      console.error('Erro na comunicação:', err);
      return false;
    }
  }

  function registrarRespostaVisitante(resposta_usuario, acertou, dica_gasta, pontos_ganhos, tempo_gasto) {
    console.log("Dificuldade da pergunta: ", pergunta_selecionada.dificuldade)
    let respondidas = JSON.parse(localStorage.getItem("visitante_respondidas")) || {
    objetiva: [], discursiva: []};

    // --- Lógica de Conversão Google Ads ---
    function analisarMetaConversao() {
      const totalRespondidas = respondidas.objetiva.length + respondidas.discursiva.length; 
      if (totalRespondidas >= 5) {
        gtag('event', 'conversion', {
          'send_to': 'AW-17529321916/JTBvCKKkoeEbELzz0KZB'
        });
      }
    }

    // Registra o envio da resposta no SQL
    fetch("/registrar-resposta-visitante", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tema: tema_atual,
        tipo_pergunta: tipo_pergunta,
        id_pergunta: pergunta_selecionada.id_pergunta,
        resposta_enviada: resposta_usuario,
        acertou: acertou,
        tempo_gasto: tempo_gasto,
        versao_pergunta: pergunta_selecionada.versao_pergunta,
        usou_dica: dica_gasta,
        modo_tela_usuario: detectarModoTela(),
        pontos_ganhos: pontos_ganhos,
        pontos_usuario: pontuacao_atual,
        dificuldade: pergunta_selecionada.dificuldade
      })
      }).catch(() => {});

    // Registra localmente a pergunta respondida pelo usuário para evitar repetição
    if (!respondidas[tipo_pergunta].includes(pergunta_selecionada.id_pergunta)) {
      respondidas[tipo_pergunta].push(pergunta_selecionada.id_pergunta);
      localStorage.setItem("visitante_respondidas", JSON.stringify(respondidas));
    };
    
    // Incrementa perguntas respondidas como visitante para tag de conversão
    analisarMetaConversao();

    // Altera a pontuação do usuário após o envio da resposta
    alterarPontuacaoUsuario(pontuacoes_usuario[tema_atual], pontuacoes_usuario[tema_atual] + pontos_ganhos, callbackAtualizarUI)
    pontuacoes_usuario[tema_atual] = pontuacoes_usuario[tema_atual] + pontos_ganhos;

    // Pontuações de usuário são usadas temporariamente, enquanto a dde visitante é para registro permanente. Para usuários logados, registra-se apenas a de usuaários porque a gravação permanente é feita na base de dados
    localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes_usuario));
    localStorage.setItem("pontuacoes_usuario", JSON.stringify(pontuacoes_usuario));
    atualizarRankingVisual();

    // Atualiza as perguntas restantes do usuário no localStorage
    const perguntas_restantes_anterior = localStorage.getItem("perguntas_restantes_visitante") || 100;
    const novas_perguntas_restantes = perguntas_restantes_anterior - 1;
    localStorage.setItem("perguntas_restantes_visitante", novas_perguntas_restantes)
    contador_perguntas_restantes.textContent = novas_perguntas_restantes

    // Atualiza o número de dicas restantes do usuário no localStorage e no contador de dicas
    if (tipo_pergunta === 'discursiva') {
      let dicas_restantes = localStorage.getItem("dicas_restantes_visitante") || 20

      const dadosRespondidas = JSON.parse(
        localStorage.getItem("visitante_respondidas")
      ) || { objetiva: [], discursiva: [] };
      const totalDiscursivas = dadosRespondidas.discursiva.length;
      if (totalDiscursivas % 10 === 0 && dicas_restantes < 20) {
        dicas_restantes ++;
        contador_dicas_restantes.textContent = dicas_restantes;
      }

      contador_dicas_restantes.textContent = dicas_restantes;
      localStorage.setItem("dicas_restantes_visitante", dicas_restantes);
    }
  }

  resultado.style.display = "block";
  if (!animacao_concluida || btn_enviar.disabled) return;
  resultado.style.color = "#FFD700";
  resultado.innerHTML = 'Enviando resposta...';
  desativarBotoes();
  caixa_para_resposta.disabled = true;

  let resposta_usuario;
  let acertou;
  let prosseguir_com_resultado = true;
  let pontos_ganhos = 0;
  let respostas_corretas;
  let letra_correta;
  const tempo_gasto = calcularTempoGasto();

  if (tipo_pergunta === 'objetiva') {
    const widgetAlternativaSelecionada = document.querySelector('.alternativa-btn.selected');
    resposta_usuario = alternativaSelecionada;
    
    // Marca a alternativa correta pelo data-letter
    if (modo_jogo === 'revisao') {
      letra_correta = pergunta_selecionada.resposta_correta;
      acertou = respostaObjetivaCorreta();
    }
    else {
      const response = await fetchAutenticado(`/pergunta/${pergunta_selecionada.id_pergunta}/${tipo_pergunta}/gabarito`);
      if (response.ok) {
        const info_pergunta = await response.json();
        letra_correta = pergunta_selecionada.resposta_correta = info_pergunta["resposta_correta"];
        acertou = respostaObjetivaCorreta();
      }
      else {
        return;
      }
    }
    
    const correta = document.querySelector(`.alternativa-btn[data-letter="${letra_correta}"]`);
    if (correta) {
        correta.classList.add('correct');
    }

    // Se errou, marca a selecionada como errada
    if (!acertou && widgetAlternativaSelecionada && widgetAlternativaSelecionada !== correta) {
        widgetAlternativaSelecionada.classList.add('wrong');
    }
  }
  else {
    resposta_usuario = caixa_para_resposta.value.trim();
    
    if (modo_jogo === 'revisao') {
      respostas_corretas = pergunta_selecionada.respostas_corretas;
    }
    else {
      const response = await fetchAutenticado(`/pergunta/${pergunta_selecionada.id_pergunta}/${tipo_pergunta}/gabarito`);
      if (response.ok) {
        const info_pergunta = await response.json();
        respostas_corretas = pergunta_selecionada.respostas_corretas = info_pergunta["respostas_corretas"];
      }
      // TALVEZ DEVA-SE TRATAR ERRO AQUI
      else {
        return;
      }
    }
    acertou = respostaDiscursivaCorreta(resposta_usuario, respostas_corretas);
  }

  // Exibe os pontos ganhos ou perdidos
  pontos_ganhos = calcularPontuacao(acertou);
  if (modo_jogo === 'desafio') {
    if (pontos_ganhos > 0) {
      lbl_pontos_ganhos.style.color = 'lime'
      lbl_pontos_ganhos.style.display = 'flex'
      lbl_pontos_ganhos.textContent = `+${pontos_ganhos}`
    }
    else if (pontos_ganhos < 0) {
      lbl_pontos_ganhos.style.color = 'red'
      lbl_pontos_ganhos.style.display = 'flex'
      lbl_pontos_ganhos.textContent = `${pontos_ganhos}`
    }
  }

  // Registra a resposta enviada no SQL
  if (modo_jogo === 'desafio' && !MODO_VISITANTE) {
    const id_pergunta = pergunta_selecionada.id_pergunta;
    const versao_pergunta = pergunta_selecionada.versao_pergunta;
    
    prosseguir_com_resultado = await registrarResposta(
      resposta_usuario,
      acertou,
      dica_gasta,
      pontos_ganhos,
      tempo_gasto,
      id_pergunta,
      versao_pergunta
    );
  }
  
  // Registra o envio da resposta no SQL caso esteja no modo visitante
  if (MODO_VISITANTE && modo_jogo === 'desafio') {
    registrarRespostaVisitante(resposta_usuario, acertou, dica_gasta, pontos_ganhos, tempo_gasto)
  }
  
  // Armazena informações que serão úteis depois na tela de resultado
  if (prosseguir_com_resultado) {
    if (modo_jogo === "desafio") {
      let info_resposta;
      if (tipo_pergunta === 'discursiva') {
        info_resposta = {"enunciado": pergunta_selecionada.enunciado, "respostas_aceitas": respostas_corretas, "resposta_usuario": resposta_usuario, "usou_dica": dica_gasta, "pontos_ganhos": pontos_ganhos, "dificuldade": pergunta_selecionada.dificuldade}
      }
      else {
        info_resposta = {"enunciado": pergunta_selecionada.enunciado, "alternativa_a": pergunta_selecionada.alternativa_a, "alternativa_b": pergunta_selecionada.alternativa_b, "alternativa_c": pergunta_selecionada.alternativa_c, "alternativa_d": pergunta_selecionada.alternativa_d, "resposta_correta": letra_correta, "resposta_usuario": resposta_usuario, "pontos_ganhos": pontos_ganhos, "dificuldade": pergunta_selecionada.dificuldade}
      }
        perguntas_respondidas.push(info_resposta)
    }
    
    // Mostra se acertou a resposta e os botões "próxima" e "finalizar"
    mostrarResultadoResposta(acertou, pontos_ganhos);
    mostrarBotoesAcao();
  } 
  else {
    resultado.style.color = "red";
    resultado.innerHTML = 'Não foi possível se conectar com o servidor';
    ativarBotoes(); // Caso dê erro, ativa botões para o usuário fazer nova tentativa
    caixa_para_resposta.disabled = false;
  }
}

async function finalizarQuiz() {
  await registrarFeedback();
  if (modo_jogo === 'desafio') {
    localStorage.setItem("perguntas_respondidas", JSON.stringify(perguntas_respondidas));
    localStorage.setItem("rankings_usuario", JSON.stringify(rankings_usuario));
    window.location.href = "/resultado";
  }
  else {
    window.location.href = "/pesquisa";
  }
}

function limparIdsPrioritariosInvalidos() {
  // 1. IDs válidos (todas as dificuldades)
  const idsValidos = new Set();

  for (const nivel of ["Fácil", "Médio", "Difícil"]) {
    for (const p of perguntas_por_dificuldade[nivel] || []) {
      idsValidos.add(p.id_pergunta);
    }
  }

  // 2. Escolhe o objeto certo (objetiva / discursiva)
  const objPrioridades =
    tipo_pergunta === "objetiva"
      ? ids_objetivas_prioridade
      : ids_discursivas_prioridade;

  const lista = objPrioridades[tema_atual];

  // 3. Limpa IDs inválidos
  objPrioridades[tema_atual] = lista.filter(id => idsValidos.has(id));

  // 4. Embaralha (Fisher–Yates)
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
}

async function mostrarAlternativas() {
  const container = document.getElementById('alternativas-container');
  if (!container || !pergunta_selecionada) return;

  // assegura que o container está visível e com coluna
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';

  const alternativas = Array.from(container.querySelectorAll('.alternativa-btn'));

  // Inicializa estado: layout presente, mas letra/texto invisíveis
  alternativas.forEach(btn => {
    // garante layout inline (letra + texto lado a lado)
    btn.style.display = 'flex';
    btn.style.justifyContent = 'flex-start';
    btn.style.gap = '8px';
    btn.style.verticalAlign = 'top'

    // Coloca o texto vindo da pergunta no data-text
    const letra = btn.dataset.letter;
    let texto = '';
    if (letra === 'A') texto = pergunta_selecionada.alternativa_a || '';
    else if (letra === 'B') texto = pergunta_selecionada.alternativa_b || '';
    else if (letra === 'C') texto = pergunta_selecionada.alternativa_c || '';
    else if (letra === 'D') texto = pergunta_selecionada.alternativa_d || '';
    btn.dataset.text = texto;

    // Garante elemento full-text dentro do botão
    let fullText = btn.querySelector('.full-text');
    if (!fullText) {
      fullText = document.createElement('span');
      fullText.className = 'full-text';
      btn.appendChild(fullText);
    }

    // estado inicial: vazio e invisível (reserva o espaço do botão)
    fullText.textContent = '';
    fullText.style.opacity = '0';
    fullText.style.transform = 'translateY(6px)'; // começa "ligeiramente abaixo"

    // letra (strong) invisível inicialmente
    const letraEl = btn.querySelector('strong');
    if (letraEl) {
      letraEl.style.opacity = '0';
      letraEl.style.display = 'inline-block';
      letraEl.style.width = '2.2ch';
      letraEl.style.textAlign = 'right';
    }

    // faz o botão ocupar o espaço mas invisível
    btn.style.opacity = '0';
  });

  // pequena pausa entre fim do enunciado e início das alternativas
  await sleep(PAUSA_ANTES_DA_A);

  // anima alternativas uma a uma
  for (let i = 0; i < alternativas.length; i++) {
    const btn = alternativas[i];

    // 1) fade-in do botão (layout aparece)
    btn.style.opacity = '1';

    // 2) mostrar letra (fade)
    const letraEl = btn.querySelector('strong');
    if (letraEl) {
      // pequena pausa para entre a letra da alternativa e o
      await sleep(GAP_ANTES_DA_LETRA);
      letraEl.style.opacity = '1';
    }

    // pausa pequena antes de começar o texto
    await sleep(GAP_LETRA_PARA_TEXTO);

    // 3) animar o texto letra-a-letra
    const fullText = btn.querySelector('.full-text');
    const texto = btn.dataset.text || '';
    // garante transição suave para o transform/opacidade
    fullText.style.opacity = '1';
    fullText.style.transform = 'translateY(0)';

    // escreve letra a letra
    fullText.textContent = '';
    for (let k = 0; k < texto.length; k++) {
      fullText.textContent += texto[k];
      await sleep(VELOCIDADE_LETRA_ALTERNATIVAS); // velocidade da letra
    }

    // pausa antes da próxima alternativa (mais longa para dar ritmo)
    await sleep(GAP_ENTRE_ALTERNATIVAS);
  }

  // animação completa
  animacao_concluida = true;
  inicio_pergunta = Date.now();

  // Seleciona A por padrão apenas se nenhuma estiver selecionada
  const algumaSelecionada = alternativas.some(b => b.classList.contains('selected'));
  if (!algumaSelecionada) {
    const btnA = alternativas.find(b => b.dataset.letter === 'A');
    if (btnA) selecionarAlternativa(btnA);
  }

  // Exibe hint de avaliação e botão enviar após tudo
  hint_avaliacao.style.display = "";
  if (btn_enviar) {
    botoes_enviar_div.style.display = "flex";
    btn_enviar.style.display = "inline-flex";
    btn_enviar.disabled = false;
  }
}

function mostrarBotoesAcao() {
  const btn_finalizar = document.getElementById("btn-finalizar");
  const btn_proxima = document.getElementById("btn-proxima");

  // Mostra a div de botões
  botoes_finalizar_div.style.display = "flex";
  
  let dificuldades_permitidas = null
  // POSSÍVEL ALTERAÇÃO AQUI, SERÁ QUE NÃO DEVE FAZER PARA MODO VISITANTE?
  if (!MODO_VISITANTE) {
    dificuldades_permitidas = obterDificuldadesDisponiveis(tema_atual, MODO_VISITANTE)
  }
  else {
    dificuldades_permitidas = ['Fácil', 'Médio', 'Difícil']
  }
  ha_perguntas_disponiveis = dificuldades_permitidas.some(dif => perguntas_por_dificuldade[dif].length > 0)

  let encerrar_quiz = false
  if (modo_jogo === "desafio") {
    encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE)
    if (parseInt(contador_perguntas_restantes.textContent) <= 0) {
      encerrar_quiz = true
      }
  }
  
  // Mostrar apenas o botão Finalizar
  if (encerrar_quiz || !ha_perguntas_disponiveis) {
    btn_proxima.style.display = "none";
    btn_finalizar.style.display = "inline-block";
    btn_finalizar.style.flex = "unset"; // remove flex igual ao botão enviar
    btn_finalizar.style.width = "100%";
    btn_finalizar.style.margin = "0 auto";

  }
  // Mostrar ambos
  else {
    btn_proxima.style.display = "inline-block";
    btn_finalizar.style.display = "inline-block";
    btn_finalizar.style.flex = "1";
    btn_finalizar.style.width = "unset";
  }

  // Desabilita ambos por precaução
  btn_finalizar.disabled = true;
  btn_proxima.disabled = true;

  // Reativa após 500ms
  setTimeout(() => {
    btn_finalizar.disabled = false;
    btn_proxima.disabled = false;
  }, 500);
}

function mostrarDica() {
  if (pergunta_selecionada.dica?.trim()) {
    document.getElementById("dica-texto").textContent = pergunta_selecionada.dica;
    dica_box.style.display = "block";
    dica_gasta = true;   
  }
  else {
    dica_box.style.display = "none";
  }
}

function mostrarEnunciado(texto, elemento) {
  return new Promise(resolve => {
    elemento.textContent = "";
    let i = 0;

    const intervalo = setInterval(() => {
      // Se ainda há letras para mostrar
      if (i < texto.length) {
        elemento.textContent += texto[i];
        i++;
      }
      // Quando acaba a animação
      else {
        clearInterval(intervalo);
        if (tipo_pergunta === 'discursiva') {
          animacao_concluida = true;
          inicio_pergunta = Date.now();
          botoes_enviar_div.style.display = "flex";

          // Exibe os hint-textos de instruções
          if (MODO_VISITANTE || exibir_instrucoes_quiz) {
            hint_dica.style.display = "";
            hint_pular.style.display = "";
          }
          hint_avaliacao.style.display = "";

          // Mostra e ativa botões
          btn_enviar.style.display = "inline-flex";
          btn_pular.style.display = "inline-flex";
          ativarBotoes();
        }
        else {
          mostrarAlternativas();
        }
        resolve();
      }
    }, VELOCIDADE_LETRA_ENUNCIADO);
  });
}

async function mostrarPergunta() {
  // Remove widgets anteriores
  aguardando_proxima = false;
  document.getElementById("nota-box").style.display = "none";
  resultado.style.display = "none";
  estrelas_avaliacao.style.display = "none";
  document.getElementById("respostas-aceitas-box").style.display = "none";
  box_comentario.style.display = "none";

  // Reseta estrelas
  document.querySelectorAll(".estrela").forEach(e => {
    e.textContent = "☆";
    e.classList.remove("dourada");
  });

  ranking_visual_anterior = obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking; // Útil para identificar mudança de ranking depois quando vai fazer animação na barra de progresso

  animacao_concluida = false;
  botoes_enviar_div.style.display = "none";
  desativarBotoes();
  caixa_para_resposta.disabled = true;

  function escolherProximaDificuldade() {
    const ranking = obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking;
    const disponiveis = obterDificuldadesDisponiveis(tema_atual, MODO_VISITANTE);

    const probsBase = PROBABILIDADES_POR_RANKING[ranking];
    const estoque = {
      "Fácil": perguntas_por_dificuldade["Fácil"]?.length || 0,
      "Médio": perguntas_por_dificuldade["Médio"]?.length || 0,
      "Difícil": perguntas_por_dificuldade["Difícil"]?.length || 0,
      "Extremo": perguntas_por_dificuldade["Extremo"]?.length || 0
    };
    console.log("Estoque: ", estoque)
    
    // Caso esteja no modo revisão ou visitante
    if (modo_jogo === "revisao" || MODO_VISITANTE) {
      return disponiveis.find(d => estoque[d] > 0) ?? null;
    }

    // 🔥 1. FORÇAGEM PELA DIFICULDADE COM MAIOR ESTOQUE
    if (respostasDesdeUltimaForcagem === 5) {
      console.log("Pegando a dificuldade com maior estoque...")
      // Põe as dificuldades em ordem descrescente de estoque
      const ordenadas = [...disponiveis].sort(
        (a, b) => estoque[b] - estoque[a]
      );

      let escolhida = ordenadas[0]; // Pega a que tem o maior estoque

      if ((probsBase[escolhida] ?? 0) <= 0.05 && ordenadas[1]) {
        escolhida = ordenadas[1];
      }

      respostasDesdeUltimaForcagem = 1;
      return resolverFallback(escolhida, estoque, probsBase, disponiveis);
    }

    // 🎯 2. SORTEIO PROBABILÍSTICO NORMAL
    const sorteio = Math.round(Math.random() * 100) / 100; // Número entre 0 e 1 com 2 casas decimais
    let acumulado = 0; // Probabilidade acumulada (ex: 0.2 da fácil + 0.3 da médio = 0.5)

    for (const d of disponiveis) {
      acumulado += probsBase[d] ?? 0;
      if (sorteio <= acumulado) {
        console.log("Dificuldade escolhida: ", d)
        respostasDesdeUltimaForcagem++;
        return resolverFallback(d, estoque, probsBase, disponiveis);
      }
    }

    // 🛟 3. SEGURANÇA ABSOLUTA
    respostasDesdeUltimaForcagem++;
    const fallback = [...disponiveis].sort(
      (a, b) => estoque[b] - estoque[a]
    )[0];

    return fallback ?? null;
  }

  function resolverFallback(escolhida, estoque, probsBase, disponiveis) {
    // Se a escolhida ainda tem estoque
    if (estoque[escolhida] > 0) return escolhida;

    const idx = DIFICULDADES_ORDENADAS.indexOf(escolhida);
    if (idx === -1) {
      console.warn("1.Fallback utilizado na escolha da dificuldade")
      return disponiveis.find(d => estoque[d] > 0) ?? null;
    }

    // 1️⃣ Extremos colapsam para dentro
    if (escolhida === "Fácil") {
      if (estoque["Médio"] > 0 && disponiveis.includes("Médio")) {
        return "Médio"
      }
      else if (estoque["Difícil"] > 0 && disponiveis.includes("Difícil")) {
        return "Difícil"
      }
      console.warn("2.Fallback utilizado na escolha da dificuldade")
      return disponiveis.find(d => estoque[d] > 0) ?? null;
    }

    if (escolhida === "Extremo") {
      if (estoque["Difícil"] > 0 && disponiveis.includes("Difícil")) {
        return "Difícil"
      }
      if (estoque["Médio"] > 0 && disponiveis.includes("Médio")) {
        return "Médio"
      }
      console.warn("3.Fallback utilizado na escolha da dificuldade")
      return disponiveis.find(d => estoque[d] > 0) ?? null;
    }

    // 2️⃣ Casos intermediários: comparar acima vs abaixo
    const abaixo = DIFICULDADES_ORDENADAS[idx - 1];
    const acima  = DIFICULDADES_ORDENADAS[idx + 1];

    const candidatos = [];

    if (abaixo && disponiveis.includes(abaixo) && estoque[abaixo] > 0) {
      candidatos.push(abaixo);
    }
    if (acima && disponiveis.includes(acima) && estoque[acima] > 0) {
      candidatos.push(acima);
    }

    if (candidatos.length === 0) {
      // Último recurso: qualquer disponível com estoque
      return disponiveis.find(d => estoque[d] > 0) ?? null;
    }

    if (candidatos.length === 1) {
      return candidatos[0];
    }

    // 3️⃣ Dois candidatos válidos → critério objetivo
    const [c1, c2] = candidatos;

    if (estoque[c1] !== estoque[c2]) {
      return estoque[c1] > estoque[c2] ? c1 : c2;
    }

    // Estoque igual → usa probabilidade base
    const p1 = probsBase[c1] ?? 0;
    const p2 = probsBase[c2] ?? 0;

    if (Math.abs(p1 - p2) > 0.1) {
      return p1 > p2 ? c1 : c2;
    }

    // Último desempate: puxa levemente para baixo
    return DIFICULDADES_ORDENADAS.indexOf(c1) < DIFICULDADES_ORDENADAS.indexOf(c2) ? c1 : c2;
  }

  function selecionarPergunta(perguntasDisponiveis) {
    if (!perguntasDisponiveis || perguntasDisponiveis.length === 0) {
      return -1;
    }
    
    let idsPrioridadeTema =
      tipo_pergunta === "objetiva"
        ? ids_objetivas_prioridade[tema_atual]
        : ids_discursivas_prioridade[tema_atual];

    // ===============================
    // 1. Seleciona um id dos prioritários
    // ===============================
    for (let i = 0; i < idsPrioridadeTema.length; i++) {
      const idPrioritario = idsPrioridadeTema[i];

      const indicePergunta = perguntasDisponiveis.findIndex(
        p => p.id_pergunta === idPrioritario
      );
      
      // Caso encontre um id de pergunta prioritária na lista de perguntas da dificuldade escolhida
      if (indicePergunta !== -1) {
        idsPrioridadeTema.splice(i, 1);
        pergunta_selecionada = perguntasDisponiveis[indicePergunta];
        return indicePergunta;
      }
    }

    // ===============================
    // 2. Fallback caso não tenha encontrado um id dentre os prioritários
    // ===============================
    const indice = Math.floor(Math.random() * perguntasDisponiveis.length);
    pergunta_selecionada = perguntasDisponiveis[indice];
    return indice;
  }

  // Escolhe uma pergunta
  const dificuldade_selecionada = escolherProximaDificuldade();
  const perguntas_disponiveis = perguntas_por_dificuldade[dificuldade_selecionada];
  const indicePergunta = selecionarPergunta(perguntas_disponiveis);
  console.log(`Pergunta selecionada: (${pergunta_selecionada.id_pergunta}) ${pergunta_selecionada.enunciado}`)

  if (indicePergunta === -1) {
    console.warn("Nenhuma pergunta disponível");
    return;
  }

  // Remove a pergunta do array para não repetir
  perguntas_disponiveis.splice(indicePergunta, 1);
  localStorage.setItem("perguntas", JSON.stringify(perguntas_por_dificuldade));
  
  dica_gasta = false;
  window.avaliacaoAtual = 0;

  // Faz animação do enunciado da pergunta
  const enunciadoElemento = document.getElementById("pergunta-enunciado");
  
  // Mostra o nível da pergunta
  const dificuldade = pergunta_selecionada.dificuldade
  const titulo = document.getElementById("tema-nivel-pergunta");
  titulo.textContent = `${tema_atual} - ${dificuldade}`;

  // Define a cor com base na dificuldade
  titulo.style.color = coresDificuldade[dificuldade.toLowerCase()] ?? "#3b2f2f";

  let ranking_usuario = obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking
  regras_usuario = regras_pontuacao.find(r => r.ranking === ranking_usuario);

  await mostrarEnunciado(pergunta_selecionada.enunciado, enunciadoElemento);
  if (tipo_pergunta.toLowerCase() === 'discursiva') {
    caixa_para_resposta.disabled = false;
    caixa_para_resposta.focus();
    caixa_para_resposta.value = "";
  
    // Decide se deve mostrar o ícone de dica
    let dica_permitida = true
    if (!regras_usuario) {
      console.error("Ranking do usuário não encontrado nas regras de pontuação.");
      return 0;
    }
    if (pergunta_selecionada.dificuldade === 'Fácil' && regras_usuario.pontos_acerto_facil <= 10 || pergunta_selecionada.dificuldade === 'Médio' && regras_usuario.pontos_acerto_medio <= 10 || !pergunta_selecionada.dica) {
      dica_permitida = false
    }

    // Exibe o ícone de dica
    if (dica_permitida) {
      document.getElementById("dica-icon").style.display = "flex";
    } 
    else {
      document.getElementById("dica-icon").style.display = "none";
    }
    
    // No modo revisão não exibe contador de dicas
    if (modo_jogo === 'revisao') {
      contador_dicas_restantes.textContent = ''
    }
    dica_box.style.display = "none"
  } 
}

async function proximaPergunta() {
  await registrarFeedback();

  hint_dica.style.display = "none";
  hint_pular.style.display = "none";
  lbl_pontos_ganhos.style.display = 'none'
  if (ha_perguntas_disponiveis) {
    if (tipo_pergunta === 'objetiva') {
      resetarAlternativas();
    } 
    else {
      dica_box.style.display = "none"
      caixa_para_resposta.value = "";
    }
    document.getElementById('botoes-acao').style.display = "none";
    estrelas_avaliacao.style.display = "none";
    resultado.style.display = "none";
    box_comentario.display = "none";
    document.getElementById("nota-box").style.display = "none";
    mostrarPergunta();
    // document.getElementById('comentarios').style.display = 'none';
    aguardando_proxima = false;
  }
}

async function registrarFeedback() {
  const estrelas_atual = document.querySelectorAll(".estrela.dourada").length;
  const comentario_atual = textarea_comentario?.value?.trim() || "";

  const mudouEstrelas = estrelas_atual !== estrelas_iniciais;
  const mudouComentario = comentario_atual !== comentario_inicial;

  if (!mudouEstrelas && !mudouComentario) {
    return;
  }

  await fetch("/enviar_feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_pergunta: pergunta_selecionada.id_pergunta,
      tipo_pergunta: tipo_pergunta,
      enunciado: pergunta_selecionada.enunciado,
      versao_pergunta: pergunta_selecionada.versao_pergunta,
      estrelas: estrelas_atual,
      comentario: comentario_atual,
      dificuldade: pergunta_selecionada.dificuldade
    })
  });
}

function renderizarEstrelas(valor) {
  estrelas.forEach((estrela, index) => {
    if (index < valor) {
      estrela.textContent = "★";
      estrela.classList.add("dourada");
    } else {
      estrela.textContent = "☆";
      estrela.classList.remove("dourada");
    }
  });
}

function resetarAlternativas() {
  alternativaBtns.forEach(btn => {
    // Remove seleção visual
    btn.classList.remove('selected', 'correct', 'wrong');

    // Oculta o botão visualmente
    btn.style.opacity = '0';
    //btn.style.transform = 'translateY(8px)'; // ou valor que você já usa para animação

    // Limpa o texto da alternativa
    const fullText = btn.querySelector('.full-text');
    if (fullText) {
      fullText.textContent = '';
      fullText.style.opacity = '0';
      //fullText.style.transform = 'translateY(6px)'; // volta para posição inicial de animação
    }

    // Opcional: oculta a letra também, se quiser reiniciar animação
    const letraEl = btn.querySelector('strong, .letter');
    if (letraEl) letraEl.style.opacity = '0';
  });

  // Reseta a variável de alternativa selecionada
  alternativaSelecionada = null;
}

function respostaDiscursivaCorreta(resposta_usuario, respostas_aceitas) {
  const stopwords = new Set(["a", "o", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "por", "pelo", "pela", "com", "para", "um", "uma", "uns", "umas", "ao", "aos", "à", "às", "the"]);

  function aceitaPorDistancia(dist, lenOriginal, textoCorreto) {
    if (lenOriginal <= 3) return false;

    const estrangeiro = temPadraoEstrangeiro(textoCorreto);

    if (estrangeiro) {
      if (lenOriginal <= 6) return dist <= 2;
      if (lenOriginal <= 10) return dist <= 3;
      return dist <= 4;
    } 
    else {
      if (lenOriginal <= 6) return dist <= 1;
      if (lenOriginal <= 10) return dist <= 2;
      return dist <= 3;
    }
  }

  // Remove os espaços do texto (nunca se deve fazer antes de remover as stopwords)
  function colapsarEspacos(texto) {
    return texto.replace(/\s+/g, "")
  }

  // Cria lista com possíveis respostas aceitas (com e sem stopwords)
  function gerarVariantesResposta(respostas) {
    const variantes = [];

    for (const resposta of respostas) {
      if (typeof resposta !== "string") continue;

      const palavras = resposta
        .toLowerCase()
        .trim()
        .split(/\s+/);

      const temStopword = palavras.some(p => stopwords.has(p));

      // Sempre inclui a original
      variantes.push(resposta);

      if (temStopword) {
        const semStopwords = palavras
          .filter(p => !stopwords.has(p))
          .join(" ");

        if (semStopwords && semStopwords !== resposta) {
          variantes.push(semStopwords);
        }
      }
    }

    return variantes;
  }

  // Trata os casos dos dígrafos (ex: x no lugar de ch)
  function normalizarDigrafos(texto) {
    const regras = [
      // Trigramas / padrões fortes
      [/chr/g, "cr"],
      [/sch/g, "x"],
      [/zh/g, "j"],
      [/tz/g, "ts"],
      [/ph/g, "f"],
      [/th/g, "t"],

      // Dígrafos
      [/ch/g, "x"],
      [/sh/g, "x"],
      [/lh/g, "l"],
      [/nh/g, "n"],
      [/qu/g, "k"],
      [/ck/g, "k"],

      // Vogais alemãs
      [/ae/g, "a"],
      [/oe/g, "o"],
      [/ue/g, "u"],

      // Letras mudas / simplificações
      [/h/g, ""],
      [/w/g, "v"],
      [/y/g, "i"],

      // Duplicações
      [/ll/g, "l"],
      [/rr/g, "r"],
      [/ss/g, "s"],
      [/mm/g, "m"],
      [/nn/g, "n"],

      // Trocas fonéticas soltas
      [/c(?=[ei])/g, "s"],
      [/z/g, "s"],
      [/g/g, "j"]
    ];

    let resultado = texto;
    for (const [regex, token] of regras) {
      resultado = resultado.replace(regex, token);
    }
    return resultado;
  }

  // Ignora diferenças de acentuação
  function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Identifica se a palavra tem padrões estrangeiros (alemão, inglês, etc)
  function temPadraoEstrangeiro(texto) {
    return /(sch|ck|tz|ph|th|mm)/.test(texto);
  }

  // Normalização que não distorce tanto a resposta correta
  function normalizarLeve(texto = "", removerStopWords = true) {
    let textoNormalizado = texto
      .toLowerCase() // Deixa as letras minúsculas
      .trim() // Remove espaços no ínicio e no final
      .replace(/[.\-:!;?]/g, "") // Remove caracteres especiais
      .split(/\s+/) // Transforma em array com cada palavra como um item
      .map(removerAcentos) // Remove os acentos

    if (removerStopWords) {
      textoNormalizado = textoNormalizado.filter(p => !stopwords.has(p)) // Remove as stopwords
    }
    textoNormalizado = textoNormalizado.join(""); // Transforma de array em string novamente
    return textoNormalizado
  }

  // Converte subscritos e sobrescritos para dígitos normais e sinais normais
  function normalizarNotacaoQuimica(texto) {
    const mapa = {
      "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
      "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
      "⁺": "+", "₊": "+", "⁻": "-", "₋": "-"
    };
    return texto.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺₊⁻₋]/g, c => mapa[c] || c);
  }

  function normalizarResposta(texto = "", removerStopWords = true) {
    let t = texto.toLowerCase().trim();

    // Normaliza notações químicas
    t = normalizarNotacaoQuimica(t);

    // Remove stopwords e normaliza pontuações e acentos
    t = normalizarLeve(t, removerStopWords);

    // Aplica regras fonéticas gerais
    t = normalizarDigrafos(t);

    // Normaliza nasalizações
    t = normalizarNasalizacao(t);

    // Aplica apenas equivalências finais controladas
    t = normalizarSufixosFinais(t);

    // Remove espaços
    t = colapsarEspacos(t);

    return t;
  }

  function normalizarNasalizacao(texto) {
    return texto
    // Variações comuns de /in/
    .replace(/em$/, "in")
    .replace(/en$/, "in")
    .replace(/im$/, "in");
  }

  function normalizarSufixosFinais(texto) {
    return texto
    .replace(/ur$/, "o")   // fêmur → femo
    .replace(/us$/, "os")  // humerus → humeros
    .replace(/is$/, "es")  // metatarsis → metatarses
    .replace(/um$/, "o");  // datum → dato
  }

  function distanciaDamerauLevenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const custo = a[i - 1] === b[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,        // Remoção de letra
          matrix[i][j - 1] + 1,        // Inserção de letra
          matrix[i - 1][j - 1] + custo // Substituição de letra
        );

        // 🔥 Transposição adjacente (quando troca as posições da letra)
        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          matrix[i][j] = Math.min(
            matrix[i][j],
            matrix[i - 2][j - 2] + 1
          );
        }
      }
    }

    return matrix[a.length][b.length];
  }

  const textoUsuarioLeve = normalizarLeve(resposta_usuario);
  const textoUsuarioPesado = normalizarResposta(resposta_usuario);

  const tot_respostas_aceitas = gerarVariantesResposta(respostas_aceitas);
  return tot_respostas_aceitas.some(resposta => {
    const lenOriginal = resposta.length;

    const textoCorretoLeve = normalizarLeve(resposta, false);
    const textoCorretoPesado = normalizarResposta(resposta, false);

    // 1. Igualdade forte
    if (textoUsuarioPesado === textoCorretoPesado) return true;

    // 2. Comparação leve (prioritária)
    const distLeve = distanciaDamerauLevenshtein(
      textoUsuarioLeve,
      textoCorretoLeve
    );

    /*
    console.log("Texto leve do usuário: ", textoUsuarioLeve);
    console.log("Texto leve da resposta: ", textoCorretoLeve);
    console.log("Distância leve: ", distLeve);
    */
    
    if (aceitaPorDistancia(distLeve, lenOriginal, textoCorretoPesado)) {
      return true;
    }

    // 3. fallback pesado
    const distPesado = distanciaDamerauLevenshtein(
      textoUsuarioPesado,
      textoCorretoPesado
    );

    /*
    console.log("Texto pesado do usuário: ", textoUsuarioPesado);
    console.log("Texto pesado da resposta: ", textoCorretoPesado);
    console.log("Distância pesada: ", distPesado);
    */
   
    return aceitaPorDistancia(distPesado, lenOriginal, textoCorretoPesado);
  });
}

function respostaObjetivaCorreta() {
  if (!alternativaSelecionada) return false;
  if (pergunta_selecionada.resposta_correta) {
    return alternativaSelecionada === pergunta_selecionada.resposta_correta;
  }
}

function selecionarAlternativa(btn) {
  if (aguardando_proxima) return;
  // Visual
  alternativaBtns.forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  // Estado
  alternativaSelecionada = btn.dataset.letter || null;
}

async function usarDica() {
  if (aguardando_proxima || dica_gasta) return;
  if (modo_jogo == 'desafio') {
    let dicas_restantes;
    if (!MODO_VISITANTE) {
      dicas_restantes = parseInt(localStorage.getItem("dicas_restantes") || "0");
      if (dicas_restantes <= 0) {
        return;
      }
      const response = await fetchAutenticado("/usar_dica")
      if (response.ok) {
        dicas_restantes -= 1;
        localStorage.setItem("dicas_restantes", dicas_restantes);
        contador_dicas_restantes.textContent = dicas_restantes;
        mostrarDica();
      }
    }
    else {
      dicas_restantes = parseInt(localStorage.getItem("dicas_restantes_visitante") || "0")
      if (dicas_restantes <= 0) {
        return;
      }
      dicas_restantes -= 1
      localStorage.setItem("dicas_restantes_visitante", dicas_restantes)
      contador_dicas_restantes.textContent = dicas_restantes;
      mostrarDica();
    }
  }
  else {
    mostrarDica();
  }
}

async function definirRankingAnterior() {
  ranking_visual_anterior = await obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Declara as variáveis que serão úteis
  let dicas;
  if (MODO_VISITANTE) {
    dicas = JSON.parse(localStorage.getItem("dicas_restantes_visitante"));
  }
  else {
    dicas = JSON.parse(localStorage.getItem("dicas_restantes"));
  }
  const contador_dicas = contador_dicas_restantes;
  const icone_perguntas_restantes = document.getElementById("perguntas-restantes-icon");
  const dica_icon = document.getElementById("dica-icon");
  const btn_proxima = document.getElementById("btn-proxima");
  const btn_finalizar = document.getElementById("btn-finalizar");

  // Exibe a contagem de dicas restantes
  if (contador_dicas && dicas !== null) {
    contador_dicas.textContent = dicas;
  }

  // Exibe o ícone de perguntas restantes caso esteja no modo desafio
  icone_perguntas_restantes.style.display = "flex"
  if (modo_jogo === 'desafio') {
    const num_perguntas_restantes = contador_perguntas_restantes
    if (!MODO_VISITANTE) {
      num_perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}`
    }
    else {
      num_perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes_visitante")}`
    }
    icone_perguntas_restantes.style.visibility = 'visible';
  }
  else {
      icone_perguntas_restantes.style.visibility = 'hidden';
  }

  // Implementa a função para usar dica
  if (tipo_pergunta === 'discursiva') {
    caixa_para_resposta.style.display = ''
    if (dica_icon) {
      dica_icon.addEventListener("click", () => {
        usarDica()
      })
    }
    if (btn_enviar) {
      botoes_enviar_div.style.marginTop = "1.5rem";
    }
    document.getElementById('botoes-acao').style.marginTop = '1.5rem'
  }

  // Implementa a função de chamar próxima pergunta
  if (btn_proxima) {
    btn_proxima.addEventListener("click", () => {
      proximaPergunta()
    })
  }

  // Implementa a função para finalizar o quiz
  if (btn_finalizar) {
    btn_finalizar.addEventListener("click", () => {
      finalizarQuiz()
    })
  }

  // Implementa a função de enviar resposta
  if (btn_enviar) {
    btn_enviar.addEventListener("click", () => {
      enviarResposta()
    })
  }

  // Implementa a função para pular a resposta (no caso das discursivas)
  if (tipo_pergunta === "discursiva") {
    if (btn_pular) {
      btn_pular.addEventListener("click", () => {
        enviarResposta(true)
      })
    }
  }
  else {
    botoes_enviar_div.style.marginTop = "0.8rem"
  }
  
  // Implementa a função de marcar alternativas
  if (tipo_pergunta === 'objetiva') {
    alternativaBtns.forEach(btn => {
      btn.addEventListener('click', () => selecionarAlternativa(btn));
    });
  }

  // Implementa a função para enviar resposta com enter
  window.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();

      // Verifica se o botão de enviar está visível
      if (btn_enviar && botoes_enviar_div.style.display !== "none") {
        enviarResposta();
      }
      else if (aguardando_proxima) {
        if (btn_proxima.offsetParent === null && !btn_proxima.disabled) {
          finalizarQuiz()
        }
        else if (!btn_proxima.disabled) {
          proximaPergunta()
        }
      }
    }
  });

  // Chama as funções que são necessárias na inicialização
  if (MODO_VISITANTE) {
    callbackAtualizarUI (pontuacoes_usuario[tema_atual])
  }
  else {
    callbackAtualizarUI (pontuacoes_usuario[tema_atual])
  }
  limparIdsPrioritariosInvalidos();
  definirRankingAnterior(); // Útil para quando for animar barra de progresso
  atualizarRankingVisual();
  await mostrarPergunta();
  configurarEstrelas();
});
