import { dificuldadesOrdenadas, detectarModoTela, deveEncerrarQuiz, idVisitanteAdmin,  idsReservados, obterDificuldadesDisponiveis, obterInfoRankingAtual, fetchAutenticado, registrarInteracaoAnuncio, simbolosRankings } from "./utils.js"
import { playSound, playKeySound } from "./sound.js"

// Envia erros para a base de dados caso ocorram
const id_visitante = localStorage.getItem("id_visitante");
const idUsuario = Number(getWithMigration("id_usuario"));
window.onerror = function (message) {
  if (id_visitante !== idVisitanteAdmin && !idsReservados.includes(idUsuario)) {
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

// Variáveis do localStorage e sessionStorage
const MODO_VISITANTE = getWithMigration("modoVisitante") === "true";
let storagePontuacao;
let STORAGE_KEY;
if (MODO_VISITANTE === true) {
  STORAGE_KEY = "pontuacoes_visitante";
  storagePontuacao = localStorage;
}
else {
  STORAGE_KEY = "pontuacoes_usuario";
  storagePontuacao = sessionStorage;
}
const tema_atual = getWithMigration("tema_atual");
const pontuacoes_jogador = JSON.parse(storagePontuacao.getItem(STORAGE_KEY) ?? "{}");
if (typeof pontuacoes_jogador[tema_atual] !== "number") { 
  pontuacoes_jogador[tema_atual] = 0;
  storagePontuacao.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes_jogador))
};
sessionStorage.setItem("pontuacao_anterior", pontuacoes_jogador[tema_atual]);
const perguntas_por_dificuldade = JSON.parse(getWithMigration("perguntas") ?? "null");
const regras_pontuacao = JSON.parse(getWithMigration("regras_pontuacao") ?? "[]");
const rankings_jogador = JSON.parse(getWithMigration("rankings_jogador") ?? "{}");
const modo_jogo = (getWithMigration("modo_jogo") ?? "").toLocaleLowerCase();

// Elementos do HTML
const lblRankingAnterior = document.getElementById("ranking-anterior");
const lblProximoRanking = document.getElementById("proximo-ranking")
const alternativasContainer = document.getElementById("alternativas-container");
const resultado = document.getElementById('resultado');
const caixa_para_resposta = document.getElementById('resposta-input');
const barra = document.getElementById("barra-progresso");
const hint_avaliacao = document.getElementById("hint-avaliacao");
const respostasAceitas = document.getElementById("respostas-aceitas-box");
const estrelas_avaliacao = document.getElementById("avaliacao");
const estrelas = document.querySelectorAll(".estrela");
const box_comentario = document.getElementById("box-comentario");
const textarea_comentario = document.getElementById("comentario-texto");
const contador_perguntas_restantes = document.getElementById("perguntas-count");
const icone_perguntas_restantes = document.getElementById("perguntas-restantes-icon");
const botaoLikeNota = document.getElementById("avaliacao-positiva");
const botaoDislikeNota = document.getElementById("avaliacao-negativa");

// Outras variáveis
let animacao_concluida = false;
let haPerguntasDisponiveis = false;
let aguardando_proxima = false; // quando estiver aguardando a próximo pergunta
let perguntas_respondidas = [];
let inicio_pergunta;  // horário inicial da pergunta
let pergunta_selecionada;
let regras_jogador; // Nome de variável alterado
let ranking_jogador; // Nome de variável alterado
let ranking_visual_anterior;
let estrelas_iniciais;
let comentario_inicial;
let aprovacao_nota_inicial = null;
let alternativaSelecionada; // guarda a letra selecionada (A, B, C, D)
let respostasDesdeUltimaForcagem = 0; // para pegar a pergunta do nível que tem mais a cada 
// x respondidas
let info_ultimo_ranking = regras_pontuacao.at(-1) ?? null;
const letrasAlternativas = ['A', 'B', 'C', 'D'];
let autoChute = false;

// Botões
const btn_enviar = document.getElementById("btn-enviar");
const btn_pular = document.getElementById("btn-pular");
const btn_proxima = document.getElementById("btn-proxima");
const btn_finalizar = document.getElementById("btn-finalizar");
const botoes_enviar_div = document.getElementById("botoes-envio");
const botoes_finalizar_div = document.getElementById("botoes-acao");
const alternativaBtns = Array.from(alternativasContainer.querySelectorAll(".alternativa-btn"));

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

// Círculo amarelo com interrogação preta para símbolo de pergunta pulada
const svg1 = `<svg class="icon-pular" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="vertical-align: middle;">
  <g transform="translate(0,-1)">
    <circle cx="12" cy="12" r="11" fill="#FFD700"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-weight="700" fill="#111">?</text>
  </g>
</svg>`;
// Tempos para as alternativas
const sleep = ms => new Promise(res => setTimeout(res, ms));
const PAUSA_ANTES_DA_A              = 500;
const GAP_ENTRE_ALTERNATIVAS        = 380;
const VELOCIDADE_LETRA_ENUNCIADO    = 21;
const VELOCIDADE_LETRA_ALTERNATIVAS = 16; // quanto menor, mais rápido

// Ids de perguntas que são selecionados primeiro
let idsPrioritarios = JSON.parse(sessionStorage.getItem('ids_prioritarios') ?? "[]").map(Number);

// Seleciona os botões
botaoLikeNota.addEventListener("click", () => {
  const jaAtivo = botaoLikeNota.classList.contains("ativo");
  botaoLikeNota.classList.toggle("ativo", !jaAtivo);
  botaoDislikeNota.classList.remove("ativo");
});

botaoDislikeNota.addEventListener("click", () => {
  const jaAtivo = botaoDislikeNota.classList.contains("ativo");
  botaoDislikeNota.classList.toggle("ativo", !jaAtivo);
  botaoLikeNota.classList.remove("ativo");
});

function getWithMigration(key) {
  // Pega dado do sessionStorage, se não encontrar pega do localStorage
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;

  const localValue = localStorage.getItem(key);
  if (localValue !== null) {
    sessionStorage.setItem(key, localValue);
    return localValue;
  }
  return null;
}

function alterarPontuacaoUsuario(pontuacao_atual, pontuacao_alvo) {
  const incrementoTotal = pontuacao_alvo - pontuacao_atual;
  const intervaloMin = 20;
  let ultimaExecucao = 0;

  // Zera o incremento para não renderizar o da pergunta anterior
  document.querySelectorAll('[data-ui="pontuacao"]').forEach(el => {
    el.setAttribute("data-inc", '');
  });

  function passo(timestamp) {
    if (!aguardando_proxima) { // interrompe o fluxo caso o usuário chame a próxima pergunta antes de a animação terminar
      pontuacao_atual = pontuacao_alvo;
      document.querySelectorAll('[data-ui="pontuacao"]').forEach(el => {
        el.classList.remove("show-inc");
        el.classList.add("hide-inc");
        el.textContent = pontuacao_alvo
      });
      return;
    }// AQUI É QUE ESTÁ O ERRO, NÃO DEIXA NA PONTUAÇÃO ALVO MESMO COM ISTO QUE COLOQUEI

    if (!ultimaExecucao) ultimaExecucao = timestamp;
    const delta = timestamp - ultimaExecucao;
    
    if (delta > intervaloMin) {
      let diferenca = pontuacao_alvo - pontuacao_atual;
      if (diferenca === 0) return;

      let passoValor = Math.max(1, Math.floor(Math.abs(diferenca) * 0.04));
      pontuacao_atual += passoValor * Math.sign(diferenca);

      if (
        (incrementoTotal > 0 && pontuacao_atual > pontuacao_alvo) ||
        (incrementoTotal < 0 && pontuacao_atual < pontuacao_alvo)
      ) {
        pontuacao_atual = pontuacao_alvo;
      }

      renderizarPontuacaoAtual(pontuacao_atual, incrementoTotal);
      ultimaExecucao = timestamp;
    }

    window.requestAnimationFrame(passo);
  }

  window.requestAnimationFrame(passo);
}
 
function renderizarPontuacaoAtual(pontuacaoAtual, incremento=0) {
  document.querySelectorAll('[data-ui="pontuacao"]').forEach(el => {
    el.textContent = pontuacaoAtual;
    
    if (incremento !== 0) {
      el.setAttribute("data-inc", incremento > 0 ? `+${incremento}` : `${incremento}`);
      el.setAttribute("data-inc-type", incremento > 0 ? "pos" : "neg");
      el.classList.remove("hide-inc");
      el.classList.add("show-inc");
    };
  });
}

function ativarBotoes() {
  btn_enviar.disabled = false;
  btn_pular.disabled = false;
}

function atualizarRankingVisual() {
  // Declara as variáveis que serão úteis (ranking e pontos já estão atualizados aqui após cáculo dos pontos ganhos ou perdidos)
  const info_ranking_atual = obterInfoRankingAtual(tema_atual, MODO_VISITANTE);
  rankings_jogador[tema_atual] = info_ranking_atual.ranking;

  const pontuacao = pontuacoes_jogador[tema_atual] || 0;
  let ranking_anterior;
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
    // Animação da barra ao mante o ranking
    else {
      atualizarTextosRanking();
    }

    // Requisita a segunda parte da animação, após alteração do ranking
    await animarBarraAte(progressoFinal);
  }
  function atualizarTextosRanking() {
    // Carrega emoji e texto do ranking atual
    renderizarRanking(info_ranking_atual.ranking)
    // Carrega os emojis dos rankings anterior e próximo
    const emojiRankingAnterior = ranking_anterior ? simbolosRankings[ranking_anterior.ranking] : "";
    const emojiProximoRanking = ranking_proximo ? simbolosRankings[ranking_proximo.ranking] : "";
    // Modifica o texto de rankings anterior e próximo
    lblRankingAnterior.textContent = ranking_anterior ? `${emojiRankingAnterior} ${ranking_anterior.ranking}` : "";
    lblProximoRanking.textContent = ranking_proximo ? `${emojiProximoRanking} ${ranking_proximo.ranking}` : "";
  }
  function forcarReflow(elemento) {
    elemento.offsetWidth; // Força o browser a aplicar o estado atual
  }
  function renderizarRanking(textoRankingAtual) {
    const emojiRankingAtual = simbolosRankings[textoRankingAtual] ?? "";
    document.querySelectorAll('[data-ui="ranking"]').forEach(el => {
      el.textContent = `${emojiRankingAtual} ${textoRankingAtual}`
    });
  }

  // Identifica o ranking anterior alcançado pelo usuário
  for (let i = 0; i < regras_pontuacao.length; i++) {
    if (regras_pontuacao[i].ranking === info_ranking_atual.ranking) {
      // Se não for o primeiro da lista, pega o anterior
      if (i > 0) {
        ranking_anterior = regras_pontuacao[i - 1];
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
    if (dificuldade === "Fácil" && regras_jogador.pontos_acerto_facil === 0 || dificuldade === "Médio" && regras_jogador.pontos_acerto_medio === 0) {
      pontos_ganhos = 0
    }
    else {
      pontos_ganhos = regras_jogador.pontos_erro ?? -100;
      // Trata casos em que a pontuação do usuário ficaria negativa
      if (pontuacoes_jogador[tema_atual] + pontos_ganhos < 0) {
        pontos_ganhos = -pontuacoes_jogador[tema_atual]
      }
    }
    return pontos_ganhos;
  }

  let pontosBase = 0;
  switch (dificuldade) {
    case "Fácil":
      pontosBase = regras_jogador.pontos_acerto_facil;
      break;
    case "Médio":
      pontosBase = regras_jogador.pontos_acerto_medio;
      break;
    case "Difícil":
      pontosBase = regras_jogador.pontos_acerto_dificil;
      break;
    case "Extremo":
      pontosBase = regras_jogador.pontos_acerto_extremo;
      console.log("POntos base no extremo: ", regras_jogador.pontos_acerto_extremo)
      break;
    default:
      console.warn("Dificuldade desconhecida:", dificuldade);
      return 0;
  }
  let pontos_ganhos = pontosBase;
  
  // Trata casos em que a pontuação do usuário ficaria acima do máximo permitido
  if (ranking_jogador === info_ultimo_ranking.ranking && pontuacoes_jogador[tema_atual] + pontos_ganhos > info_ultimo_ranking.pontos_maximos) {
      pontos_ganhos = info_ultimo_ranking.pontos_maximos - pontuacoes_jogador[tema_atual]
  }
  return pontos_ganhos;
}

function calcularTempoGasto() {
    return Math.floor((Date.now() - inicio_pergunta) / 1000);  // segundos
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
  hint_avaliacao.style.display = "none";

  if (pulando) caixa_para_resposta.value = "";
  const pontuacao_atual = pontuacoes_jogador[tema_atual];

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
    if (correto) {
      resultado.style.color = "lime";
      resultado.innerHTML = '✅ Resposta correta!';
    }
    else {
      resultado.style.color = "red";
      resultado.innerHTML = '❌ Resposta incorreta';
    }

    aguardando_proxima = true;
    botoes_enviar_div.style.display = "none";

    // Carrega a aprovaçãod e nota anterior enviada pelo usuário
    aprovacao_nota_inicial = pergunta_selecionada.aprovacao_nota;
    botaoLikeNota.classList.remove("ativo");
    botaoDislikeNota.classList.remove("ativo");
    if (aprovacao_nota_inicial === true) {
      botaoLikeNota.classList.add("ativo");
    }
    else if (aprovacao_nota_inicial === false) {
      botaoDislikeNota.classList.add("ativo");
    }

    // Chama as estrelas de feedback e carrega as anteriores enviadas pelo usuário
    const avaliacao_anterior = pergunta_selecionada.estrelas || 0;
    renderizarEstrelas(avaliacao_anterior);
    estrelas_iniciais = avaliacao_anterior;
    estrelas_avaliacao.style.display = "flex";
    
    // Carrega comentário de feedback anterior do usuário caso exista
    carregarComentarioAnterior();

    // Exibe os comentários dos outros usuários
    // document.getElementById('comentarios').style.display = 'block';
  }

  function mostrarBotoesAcao() {
    botoes_finalizar_div.style.display = "flex";

    // POSSÍVEL ALTERAÇÃO AQUI, SERÁ QUE NÃO DEVE USAR A FUNÇÃO PARA MODO VISITANTE TAMBÉM?
    const difPermitidas = (MODO_VISITANTE) ? dificuldadesOrdenadas : obterDificuldadesDisponiveis();
    haPerguntasDisponiveis = difPermitidas.some(dif => perguntas_por_dificuldade[dif].length > 0)

    let encerrar_quiz = false
    if (modo_jogo === "desafio") {
      encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE)
      if (parseInt(contador_perguntas_restantes.textContent) <= 0) {encerrar_quiz = true};
    }
    
    // Mostrar apenas o botão Finalizar
    if (encerrar_quiz || !haPerguntasDisponiveis) {
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

  function mostrarRespostasAceitas(lista) {
    try {
      const container = respostasAceitas;
      const lista_respostas_aceitas = document.getElementById("lista-respostas");
      lista_respostas_aceitas.textContent = lista.join(" / ");
      container.style.display = "block";
    }
    catch (err) {
      console.error("Erro ocorrido ao tentar mostrar respostas aceitas:", err)
    }
  }

  async function registrarResposta(resposta_usuario, acertou, pontos_ganhos, tempo_gasto, id_pergunta, versao_pergunta) {
    try {
      const response = await fetch('/registrar_resposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resposta_usuario: resposta_usuario,
          acertou: acertou,
          pontos_ganhos: pontos_ganhos,
          tempo_gasto: tempo_gasto,
          id_pergunta: id_pergunta,
          versao_pergunta: versao_pergunta,
          tema: tema_atual,
          pontos_usuario: pontuacao_atual,
          dificuldade: pergunta_selecionada.dificuldade,
          auto_chute: autoChute
        })
      });

      const data = await response.json();
      if (data.sucesso) {
        // Atualiza a pontuação do usuário para o tema no sessionStorage
        pontuacoes_jogador[tema_atual] = data.nova_pontuacao;
        sessionStorage.setItem("pontuacoes_usuario", JSON.stringify(pontuacoes_jogador));
        alterarPontuacaoUsuario(pontuacao_atual, pontuacoes_jogador[tema_atual]);

        // Atualiza as perguntas restantes do usuário no sessionStorage
        sessionStorage.setItem("perguntas_restantes", data.perguntas_restantes);
        contador_perguntas_restantes.textContent = data.perguntas_restantes;

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

  function registrarRespostaVisitante(resposta_usuario, acertou, pontos_ganhos, tempo_gasto) {
    let respondidas = JSON.parse(localStorage.getItem("visitante_respondidas") ?? "[]");

    // --- Lógica de Conversão Google Ads ---
    function analisarMetaConversao() {
      // if (id_visitante === idVisitanteAdmin) return;
      try {
        const totalRespondidas = respondidas.length;
        if (totalRespondidas >= 5) {
          gtag('event', 'conversion', {
            'send_to': 'AW-17529321916/JTBvCKKkoeEbELzz0KZB'
          });
        };
        if (totalRespondidas >= 15) {
          gtag('event', 'conversion', {
            'send_to': 'AW-17529321916/Ydq3CL_hhfcbELzz0KZB'
          });
        };
      }
      catch (error) {
        console.error("não foi possível fazer registro de conversão de perguntas respondidas", error)
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
        id_pergunta: pergunta_selecionada.id_pergunta,
        resposta_enviada: resposta_usuario,
        acertou: acertou,
        tempo_gasto: tempo_gasto,
        versao_pergunta: pergunta_selecionada.versao_pergunta,
        modo_tela_usuario: detectarModoTela(),
        pontos_ganhos: pontos_ganhos,
        pontos_usuario: pontuacao_atual,
        dificuldade: pergunta_selecionada.dificuldade,
        auto_chute: autoChute
      })
      }).catch(() => {
        console.warn("Falha ao registrar resposta de visitante")
      });

    // Registra localmente a pergunta respondida pelo usuário para evitar repetição
    if (!respondidas.includes(pergunta_selecionada.id_pergunta)) {
      respondidas.push(pergunta_selecionada.id_pergunta);
      localStorage.setItem("visitante_respondidas", JSON.stringify(respondidas));
    };
    
    // Incrementa perguntas respondidas como visitante para tag de conversão
    analisarMetaConversao();

    // Altera a pontuação do usuário após o envio da resposta
    alterarPontuacaoUsuario(pontuacoes_jogador[tema_atual], pontuacoes_jogador[tema_atual] + pontos_ganhos)
    pontuacoes_jogador[tema_atual] = pontuacoes_jogador[tema_atual] + pontos_ganhos;

    // Pontuações de usuário são usadas temporariamente (na prática é de visitante apesar do nome), enquanto a de visitante é para registro permanente
    // sessionStorage.setItem("pontuacoes_usuario", JSON.stringify(pontuacoes_usuario));
    localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes_jogador));
    atualizarRankingVisual();

    // Atualiza as perguntas restantes do usuário no localStorage
    const perguntas_restantes_anterior = Number(localStorage.getItem("perguntas_restantes_visitante") ?? 100);
    const novas_perguntas_restantes = perguntas_restantes_anterior - 1;
    localStorage.setItem("perguntas_restantes_visitante", novas_perguntas_restantes);
    contador_perguntas_restantes.textContent = novas_perguntas_restantes;
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
    
  let btnAlternativaSelecionada;
  // Se o usuário optrou por chutar, escolhe uma aleatoriamente
  if (!alternativaSelecionada) {
    alternativaSelecionada = letrasAlternativas[Math.floor(Math.random() * 4)];
    btnAlternativaSelecionada = document.querySelector(
      `.alternativa-btn[data-letter="${alternativaSelecionada}"]`
    );
    autoChute = true;
    selecionarAlternativa(btnAlternativaSelecionada);
  }
  else {
    autoChute = false;
    btnAlternativaSelecionada = document.querySelector('.alternativa-btn.selected');
  }
  resposta_usuario = alternativaSelecionada;
  
  // Marca a alternativa correta pelo data-letter
  if (modo_jogo === 'revisao') {
    letra_correta = pergunta_selecionada.resposta_correta;
    acertou = respostaObjetivaCorreta();
  }
  else {
    const response = await fetchAutenticado(`/pergunta/${pergunta_selecionada.id_pergunta}/gabarito`);
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
  if (!acertou && btnAlternativaSelecionada && btnAlternativaSelecionada !== correta) {
    btnAlternativaSelecionada.classList.add('wrong');
  }

  // Calcula pontos ganhos toca áudio de acerto ou erro
  pontos_ganhos = calcularPontuacao(acertou);
  if (acertou) playSound("correct")
  else if (pontos_ganhos === regras_jogador.pontos_erro) playSound("error");

  // Registra a resposta enviada no SQL
  if (modo_jogo === 'desafio' && !MODO_VISITANTE) {
    const id_pergunta = pergunta_selecionada.id_pergunta;
    const versao_pergunta = pergunta_selecionada.versao_pergunta;
    
    prosseguir_com_resultado = await registrarResposta(
      resposta_usuario,
      acertou,
      pontos_ganhos,
      tempo_gasto,
      id_pergunta,
      versao_pergunta
    );
  }
  
  // Registra o envio da resposta no SQL caso esteja no modo visitante
  if (MODO_VISITANTE && modo_jogo === 'desafio') {
    registrarRespostaVisitante(resposta_usuario, acertou, pontos_ganhos, tempo_gasto)
  }
  
  // Armazena informações que serão úteis depois na tela de resultado
  if (prosseguir_com_resultado) {
    if (modo_jogo === "desafio") {
      const info_resposta = {"enunciado": pergunta_selecionada.enunciado, "alternativa_a": pergunta_selecionada.alternativa_a, "alternativa_b": pergunta_selecionada.alternativa_b, "alternativa_c": pergunta_selecionada.alternativa_c, "alternativa_d": pergunta_selecionada.alternativa_d, "resposta_correta": letra_correta, "resposta_usuario": resposta_usuario, "pontos_ganhos": pontos_ganhos, "dificuldade": pergunta_selecionada.dificuldade}
      perguntas_respondidas.push(info_resposta)
    }
    
    // Mostra se acertou a resposta e os botões "próxima" e "finalizar"
    mostrarResultadoResposta(acertou);
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
  // await registrarFeedback();
  registrarFeedback()
  if (modo_jogo === 'desafio') {
    sessionStorage.setItem("perguntas_respondidas", JSON.stringify(perguntas_respondidas))
    sessionStorage.setItem("rankings_jogador", JSON.stringify(rankings_jogador ?? {}))
    window.location.href = "/resultado";
  }
  else {
    window.location.href = "/pesquisa";
  }
}

// Remove dos ids prioritários perguntas que não estão na lista de perguntas
function limparIdsPrioritariosInvalidos() {
  // 1. IDs válidos (todas as dificuldades)
  const idsValidos = new Set();

  for (const nivel of dificuldadesOrdenadas) {
    for (const p of perguntas_por_dificuldade[nivel] || []) {
      idsValidos.add(p.id_pergunta);
    };
  };
  
  // 3. Limpa IDs inválidos
  idsPrioritarios = idsPrioritarios.filter(id => idsValidos.has(id));

  // 4. Embaralha (Fisher–Yates)
  for (let i = idsPrioritarios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idsPrioritarios[i], idsPrioritarios[j]] = [idsPrioritarios[j], idsPrioritarios[i]];
  };
}

async function mostrarAlternativas() {
  //const container = document.getElementById('alternativas-container');
  if (!alternativasContainer || !pergunta_selecionada) return;

  // Assegura que o container está visível e com coluna
  alternativasContainer.style.display = 'grid';
  const alternativas = Array.from(alternativasContainer.querySelectorAll('.alternativa-btn'));

  // 1) Prepara estado inicial
  alternativas.forEach(btn => {
    const letra = btn.dataset.letter;
    let texto = '';

    if (letra === 'A') texto = pergunta_selecionada.alternativa_a;
    else if (letra === 'B') texto = pergunta_selecionada.alternativa_b;
    else if (letra === 'C') texto = pergunta_selecionada.alternativa_c;
    else if (letra === 'D') texto = pergunta_selecionada.alternativa_d;

    btn.dataset.texto = texto || '';

    // Cria full-text se não existir
    let fullText = btn.querySelector('.full-text');
    if (!fullText) {
      fullText = document.createElement('span');
      fullText.className = 'full-text';
      btn.appendChild(fullText);
    }

    fullText.innerHTML = `
      <span class="prefixo">${letra}) </span><span class="texto"></span>
    `;

    btn.style.opacity = '0';
    btn.style.transform = 'translateY(6px)';
  });

  await sleep(PAUSA_ANTES_DA_A);

  // 2) Anima alternativas
  for (const btn of alternativas) {
    btn.style.opacity = '1';
    btn.style.transform = 'translateY(0)';

    const textoSpan = btn.querySelector('.texto');
    const texto = btn.dataset.texto;

    textoSpan.textContent = '';

    for (let i = 0; i < texto.length; i++) {
      textoSpan.textContent += texto[i];
      await sleep(VELOCIDADE_LETRA_ALTERNATIVAS);
    }

    await sleep(GAP_ENTRE_ALTERNATIVAS);
  }

  // 3) Finalização
  animacao_concluida = true;
  inicio_pergunta = Date.now();

  hint_avaliacao.style.display = "";
  botoes_enviar_div.style.display = "flex";
  btn_enviar.style.display = "inline-flex";
  btn_enviar.disabled = false;
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
        mostrarAlternativas();
        resolve();
      }
    }, VELOCIDADE_LETRA_ENUNCIADO);
  });
}

async function mostrarPergunta(chamarAtualizarAnuncios=false) {
  // Remove widgets anteriores
  aguardando_proxima = false;
  document.getElementById("nota-box").style.display = "none";
  resultado.style.display = "none";
  estrelas_avaliacao.style.display = "none";
  respostasAceitas.style.display = "none";
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
      if (idsReservados.includes(idUsuario)) {
        console.log("Pegando a dificuldade com maior estoque...")
      }
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

    const idx = dificuldadesOrdenadas.indexOf(escolhida);
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
    const abaixo = dificuldadesOrdenadas[idx - 1];
    const acima  = dificuldadesOrdenadas[idx + 1];

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
    return dificuldadesOrdenadas.indexOf(c1) < dificuldadesOrdenadas.indexOf(c2) ? c1 : c2;
  }

  function selecionarPergunta(perguntasDisponiveis) {
    if (!perguntasDisponiveis || perguntasDisponiveis.length === 0) {
      return -1;
    }

    // ===============================
    // 1. Seleciona um id dos prioritários
    // ===============================
    for (let i = 0; i < idsPrioritarios.length; i++) {
      const idPrioritario = idsPrioritarios[i];

      const indicePergunta = perguntasDisponiveis.findIndex(
        p => p.id_pergunta === idPrioritario
      );
      
      // Caso encontre um id de pergunta prioritária na lista de perguntas da dificuldade escolhida
      if (indicePergunta !== -1) {
        idsPrioritarios.splice(i, 1);
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
  sessionStorage.setItem("perguntas", JSON.stringify(perguntas_por_dificuldade));
  
  window.avaliacaoAtual = 0;

  // Faz animação do enunciado da pergunta
  const enunciadoElemento = document.getElementById("pergunta-enunciado");
  
  // Mostra o nível da pergunta
  const dificuldade = pergunta_selecionada.dificuldade
  const titulo = document.getElementById("tema-nivel-pergunta");
  titulo.textContent = `${tema_atual} - ${dificuldade}`;

  // Define a cor com base na dificuldade
  titulo.style.color = coresDificuldade[dificuldade.toLowerCase()] ?? "#3b2f2f";

  let ranking_jogador = obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking
  regras_jogador = regras_pontuacao.find(r => r.ranking === ranking_jogador);

  await mostrarEnunciado(pergunta_selecionada.enunciado, enunciadoElemento);
}

async function proximaPergunta() {
  registrarFeedback();

  function resetarAlternativas() {
    alternativaBtns.forEach(btn => {
      // Remove estados visuais
      btn.classList.remove('selected', 'correct', 'wrong');

      // Garante que o botão exista visualmente
      btn.style.opacity = '0';

      const fullText = btn.querySelector('.full-text');
      if (fullText) {fullText.textContent = ''};
    });

    alternativaSelecionada = null;
  }

  // Esconde incremento de pontos ao chamar nova pergunta
  document.querySelectorAll('[data-ui="pontuacao"]').forEach(el => {
    el.classList.remove("show_inc");
    el.classList.add("hide-inc");
  })

  btn_enviar.textContent = 'Chutar';
  btn_enviar.classList.add("chutar");
  autoChute = false;

  if (haPerguntasDisponiveis) {
    resetarAlternativas();
    document.getElementById('botoes-acao').style.display = "none";
    estrelas_avaliacao.style.display = "none";
    resultado.style.display = "none";
    box_comentario.style.display = "none";
    document.getElementById("nota-box").style.display = "none";
    mostrarPergunta();
    // document.getElementById('comentarios').style.display = 'none';
    aguardando_proxima = false;
  }
}

async function registrarFeedback() {
  function obterAprovacaoNotaAtual() {
    if (botaoLikeNota.classList.contains("ativo")) return true;
    if (botaoDislikeNota.classList.contains("ativo")) return false;
    return null;
  }

  const estrelas_atual = document.querySelectorAll(".estrela.dourada").length;
  const comentario_atual = textarea_comentario?.value?.trim() || "";
  const aprovacao_nota_atual = obterAprovacaoNotaAtual();

  const mudouEstrelas = estrelas_atual !== estrelas_iniciais;
  const mudouComentario = comentario_atual !== comentario_inicial;
  const mudouAprovacaoNota = aprovacao_nota_atual !== aprovacao_nota_inicial;

  if (!mudouEstrelas && !mudouComentario && !mudouAprovacaoNota) {
    return;
  }

  try {
    await fetch("/enviar_feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        atualizar_feedback_nota: mudouAprovacaoNota,
        atualizar_feedback_estrelas: mudouEstrelas || mudouComentario,
        id_pergunta: pergunta_selecionada.id_pergunta,
        tema: tema_atual,
        enunciado: pergunta_selecionada.enunciado,
        versao_pergunta: pergunta_selecionada.versao_pergunta,
        aprovacao_nota: aprovacao_nota_atual,
        estrelas: estrelas_atual,
        comentario: comentario_atual,
        dificuldade: pergunta_selecionada.dificuldade
      })
    });
  }
  catch (e) {
    console.warn("Falha ao enviar feedback");
  }
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

function respostaObjetivaCorreta() {
  if (!alternativaSelecionada) return false;
  return alternativaSelecionada === pergunta_selecionada.resposta_correta;
}

function selecionarAlternativa(btn) {
  if (!btn || aguardando_proxima || btn_enviar.disabled) return;
  if (!autoChute) {
    btn_enviar.textContent = 'Enviar';
    btn_enviar.classList.remove("chutar");
  };

  // Visual
  alternativaBtns.forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  // Estado
  alternativaSelecionada = btn.dataset.letter || null;
}

async function definirRankingAnterior() {
  ranking_visual_anterior = await obterInfoRankingAtual(tema_atual, MODO_VISITANTE).ranking;
}

document.addEventListener("DOMContentLoaded", async () => {

  // Seleciona todos os links de anúncio
  const banners = document.querySelectorAll('.ad-sidebar');
  banners.forEach(banner => {
    banner.addEventListener('click', function() {
      registrarInteracaoAnuncio(this.querySelector('a'), "Clique", tema_atual)
    });
  });

  // Adiciona som de tecla digitada nas caixas de texto
  if (caixa_para_resposta) {
    caixa_para_resposta.addEventListener("keydown", (e) => {playKeySound(e)});
  }
  if (box_comentario) {
    box_comentario.addEventListener("keydown", (e) => {playKeySound(e)});
  }

  if (modo_jogo === 'desafio') {
    const num_perguntas_restantes = contador_perguntas_restantes
    if (!MODO_VISITANTE) {
      num_perguntas_restantes.textContent = `${getWithMigration("perguntas_restantes")}`
    }
    else {
      num_perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes_visitante")}`
    }
    icone_perguntas_restantes.style.visibility = 'visible';
  }
  else {
      icone_perguntas_restantes.style.visibility = 'hidden';
  }

  btn_enviar.classList.add("chutar");
  btn_enviar.textContent = 'Chutar';
  // Implementa a função de marcar alternativas
  alternativaBtns.forEach(btn => {
    btn.addEventListener('click', () => selecionarAlternativa(btn));
  });

  // Implementa a função de chamar próxima pergunta
  if (btn_proxima) {
    btn_proxima.addEventListener("click", () => {
      playSound("click");
      proximaPergunta();
    })
  }

  // Implementa a função para finalizar o quiz
  if (btn_finalizar) {
    btn_finalizar.addEventListener("click", () => {
      playSound("click");
      finalizarQuiz();
    })
  }

  // Implementa a função de enviar resposta
  if (btn_enviar) {
    btn_enviar.addEventListener("click", () => {
      if (modo_jogo === 'desafio') {playSound("click")};
      enviarResposta();
    })
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
  renderizarPontuacaoAtual(pontuacoes_jogador[tema_atual]);
  limparIdsPrioritariosInvalidos();
  definirRankingAnterior(); // útil para quando for animar barra de progresso
  atualizarRankingVisual();
  await mostrarPergunta(true);
  configurarEstrelas();
})
