import { playSound, playKeySound } from "./sound.js";
import { coresDificuldade, registrarInteracaoAnuncio, simbolosRankings, simbolosTemas} from "./utils.js";

const CHAVE_HISTORICO_INTERSTITIAL_AD = 'interstitial_historico_V2'


async function carregarInterstitialDinamico() {
  console.log(`Histórico: ${localStorage.getItem(CHAVE_HISTORICO_INTERSTITIAL_AD)}`)
  try {
    // 1. Faz a requisição filtrando pelo tema do interstitial
    const response = await fetch('/api/obter_anuncios?tema=Interstitial Ad');
    const dados = await response.json();

    // Junta todos os anúncios em uma única lista
    let todosAnuncios = [];
    for (let provedor in dados) {
      todosAnuncios = todosAnuncios.concat(dados[provedor]);
    }

    if (todosAnuncios.length === 0) return;

    // 2. Recupera o histórico de exibições do localStorage
    let historicoExibicoes = JSON.parse(localStorage.getItem(CHAVE_HISTORICO_INTERSTITIAL_AD) || '{}');

    // 3. Adiciona o "anúncio virtual de descanso"
    const idDescanso = 'descanso_ciclo_virtual';
    const anuncioDescanso = {
      id: idDescanso,
      prioridade: -999,
      tema: 'Interstitial Ad',
      eDescanso: true
    };

    let listaCompleta = [...todosAnuncios, anuncioDescanso];

    // VERIFICAÇÃO INFALÍVEL DE CICLO COMPLETO:
    // Se o número de chaves no histórico for igual ou maior que o total de itens possíveis, zera o ciclo!
    const totalItensPossiveis = listaCompleta.length;
    const totalItensExibidos = Object.keys(historicoExibicoes).length;

    if (totalItensExibidos >= totalItensPossiveis) {
      localStorage.removeItem(CHAVE_HISTORICO_INTERSTITIAL_AD);
      historicoExibicoes = {}; // Zera o objeto na memória também para esta execução
    }

    // 4. Filtra apenas os anúncios que AINDA NÃO foram exibidos no ciclo atual
    let anunciosNaoExibidos = listaCompleta.filter(anuncio => {
      const vezes = historicoExibicoes[anuncio.id] || 0;
      return vezes === 0;
    });

    // 5. Ordena os não exibidos estritamente por prioridade decrescente
    anunciosNaoExibidos.sort((a, b) => {
      const prioA = Number(a.prioridade || 0);
      const prioB = Number(b.prioridade || 0);
      if (prioB !== prioA) return prioB - prioA;
      return 0.5 - Math.random();
    });

    // Pega o primeiro da lista ordenada
    const selecionado = anunciosNaoExibidos[0];

    // 6. Atualiza o histórico no localStorage marcando este item como exibido
    historicoExibicoes[selecionado.id] = 1;
    localStorage.setItem(CHAVE_HISTORICO_INTERSTITIAL_AD, JSON.stringify(historicoExibicoes));

    // 7. SE FOR O ITEM DE DESCANSO, APENAS ENCERRA SEM EXIBIR NADA
    if (selecionado.eDescanso) return;

    // Caso contrário, configura e exibe o modal do anúncio normalmente...
    const modal = document.getElementById('modal-interstitial');
    const linkElement = modal.querySelector('.interstitial-body');
    const imgElement = modal.querySelector('.interstitial-img');
    const imgLogo = modal.querySelector('.interstitial-logo-overlay');

    linkElement.href = selecionado.link;
    imgElement.src = selecionado.imagem;
    imgElement.alt = selecionado.nome;

    linkElement.setAttribute('data-id-anuncio', selecionado.id);
    linkElement.setAttribute('data-provedor-anuncio', selecionado.provedor);
    linkElement.setAttribute('data-tipo-midia-anuncio', selecionado.tipo_midia);

    if (selecionado.provedor === 'Amazon') {
      imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoAmazon";
      imgLogo.style.display = 'block';
    }
    else if (selecionado.provedor === 'Mercado Livre'){
      imgLogo.src = "https://res.cloudinary.com/j70fhijc/image/upload/f_auto,q_auto/logotipoMercadoLivre03";
      imgLogo.style.display = 'block';
    }
    else {
      imgLogo.src = "";
      imgLogo.style.display = 'none';
    }

    imgLogo.onerror = function() {this.style.display = 'none'};

    modal.style.display = 'flex';

    if (typeof registrarInteracaoAnuncio === 'function') {
      registrarInteracaoAnuncio(linkElement, 'Impressão', selecionado.tema);
    }

    if (linkElement._clickhandler) {
      linkElement.removeEventListener('click', linkElement._clickhandler);
    }
    linkElement._clickhandler = function() {
      registrarInteracaoAnuncio(linkElement, 'Clique', selecionado.tema);
    };
    linkElement.addEventListener('click', linkElement._clickhandler);
    linkElement.addEventListener('auxclick', function(e) {
      if (e.button === 1) linkElement._clickhandler();
    });

  } catch (error) {
    console.error("Erro ao carregar o anúncio interstitial:", error);
  }
}

// Executa a função quando a página carregar (ou conforme sua regra de exibição)
document.addEventListener('DOMContentLoaded', () => {
  carregarInterstitialDinamico();
});

// Anúncios de BANNERS (não utilizados no momento)
const tema_atual = localStorage.getItem("tema_atual");
/*
const cacheAnuncios = localStorage.getItem('anuncios') || '{}';
const dadosAnuncios = JSON.parse(cacheAnuncios);
const containerEsq = document.getElementById('banner-lateral-esquerda');
const containerDir = document.getElementById('banner-lateral-direita');
const logotipoAnuncioEsq = document.getElementById('logotipo-anuncio-esq')
const logotipoAnuncioDir = document.getElementById('logotipo-anuncio-dir');
const bannerAnuncioEsq = document.getElementById('banner-lateral-esquerda')
const bannerAnuncioDir = document.getElementById('banner-lateral-direita');
[bannerAnuncioEsq, bannerAnuncioDir].forEach(b => {
  b.addEventListener('click', function() {
    registrarInteracaoAnuncio(this.querySelector('a'), "Clique", 'Resultado'); // Depois ver se é Resultado que deve passar sempre aqui
  });
});*/
/*
let historicoExibicao = {};
historicoExibicao = atualizarAnuncios(containerEsq, containerDir, logotipoAnuncioEsq, logotipoAnuncioDir, tema_atual, dadosAnuncios, historicoExibicao);
   
setInterval(() => {
    historicoExibicao = atualizarAnuncios(containerEsq, containerDir, logotipoAnuncioEsq, logotipoAnuncioDir, tema_atual, dadosAnuncios, historicoExibicao
    );
}, 14000);*/

// Outras variáveis
const MODO_VISITANTE = localStorage.getItem('modoVisitante') === "true";
const perguntas_respondidas = JSON.parse(localStorage.getItem("perguntas_respondidas"));
const pontuacoes_jogador = MODO_VISITANTE ? JSON.parse(localStorage.getItem("pontuacoes_visitante")) : JSON.parse(localStorage.getItem("pontuacoes_usuario"));
const rankings_jogador = JSON.parse(localStorage.getItem("rankings_jogador"));
const pontuacao_anterior = localStorage.getItem("pontuacao_anterior");
const nova_pontuacao = pontuacoes_jogador[tema_atual];
const valor_saldo = Number(nova_pontuacao) - Number(pontuacao_anterior);
let str_saldo;
let cor_saldo;
let peso_fonte_saldo;

// Variáveis para envio de feedback
const FEEDBACK_DRAFT_KEY = "feedback_comentario_rascunho";
sessionStorage.removeItem(FEEDBACK_DRAFT_KEY); // remove rascunho de feedback anterior
const caixaTextoFeedback = document.getElementById("caixa-texto-feedback");
const btnFeedback = document.getElementById("btn-feedback");
const modal = document.getElementById("modal-feedback");
const btnCancelar = document.getElementById("cancelar-feedback");
const btnEnviar = document.getElementById("enviar-feedback");
const btnProsseguir = document.getElementById('btn-prosseguir');
const msgBox = document.getElementById("feedback-mensagem");
const actionsForm = document.getElementById("feedback-actions-form");
const actionsVoltar = document.getElementById("feedback-actions-pos-envio");
const btnVoltar = document.getElementById("voltar-feedback");
let feedbackIdAtual = null;
let feedbackEmEnvio = false;

if (valor_saldo > 0) {
    cor_saldo = 'lime';
    str_saldo = `+${valor_saldo}`;
    peso_fonte_saldo = 'bold';
}
else if (valor_saldo < 0) {
    cor_saldo = 'red';
    str_saldo = valor_saldo;
    peso_fonte_saldo = 'bold';
}
else {
    cor_saldo = 'black';
    str_saldo = valor_saldo;
    peso_fonte_saldo = 'normal';
}

const resultado = {
    tema: `${tema_atual}`,
    pontuacaoAnterior: pontuacao_anterior,
    pontuacaoFinal: nova_pontuacao,
    saldo: str_saldo,
    ranking_atual: rankings_jogador[tema_atual],
    perguntas_respondidas: perguntas_respondidas
};

const emojiTema = simbolosTemas[resultado.tema];
document.getElementById("tema-perguntas").textContent = `${emojiTema} ${resultado.tema}`;
document.getElementById("pontuacao-anterior").textContent = resultado.pontuacaoAnterior;
document.getElementById("pontuacao-final").textContent = resultado.pontuacaoFinal;
const label_saldo = document.getElementById("pontuacao-saldo")
label_saldo.textContent = resultado.saldo;
label_saldo.style.color = cor_saldo;
label_saldo.style.fontWeight = peso_fonte_saldo;
const emojiRanking = simbolosRankings[resultado.ranking_atual] ?? "";
document.getElementById("ranking-atual").textContent = `${emojiRanking} ${resultado.ranking_atual}`;

const lista = document.getElementById("lista-perguntas");
resultado.perguntas_respondidas.forEach((p, i) => {
    const div = document.createElement("div");
    div.classList.add("pergunta");
    let correta;
    let str_pontos_ganhos;
    if (Number(p.pontos_ganhos) > 0) {
        str_pontos_ganhos = `+${p.pontos_ganhos}`;
        correta = true;
    }
    else {
        str_pontos_ganhos = p.pontos_ganhos;
        correta = false;
    }

    const cor_pontuacao = correta? 'lime': 'red'; // O ideal é que estas cores fossem variáveis globais
    const cor_dificuldade = coresDificuldade[p.dificuldade.toLowerCase()];
    let cor_alternativa_a = 'black';
    let cor_alternativa_b = 'black';
    let cor_alternativa_c = 'black';
    let cor_alternativa_d = 'black';
    if (p.resposta_correta === 'A') {
        cor_alternativa_a = 'lime'
    }
    else if (p.resposta_correta === 'B') {
        cor_alternativa_b = 'lime'
    }
    else if (p.resposta_correta === 'C') {
        cor_alternativa_c = 'lime'
    }
    else if (p.resposta_correta === 'D') {
        cor_alternativa_d = 'lime'
    }
    if (p.resposta_correta !== p.resposta_usuario) {
        if (p.resposta_usuario === 'A') {
            cor_alternativa_a = 'red'
        }
        else if (p.resposta_usuario === 'B') {
            cor_alternativa_b = 'red'
        }
        else if (p.resposta_usuario === 'C') {
            cor_alternativa_c= 'red'
        }
        else if (p.resposta_usuario === 'D') {
            cor_alternativa_d = 'red'
        }
    }

    div.innerHTML = `
    <p><strong>Dificuldade:</strong> <span style="color: ${cor_dificuldade}">${p.dificuldade}</span></p>
    <p style="font-family: 'Noto Serif', 'Roboto', serif, sans-serif; font-weight: bold;"><strong>${i+1}-</strong> ${p.enunciado}</p>
    <p style="font-weight: bold; color: ${cor_alternativa_a};"><strong>A)</strong> ${p.alternativa_a}</p>
    <p style="font-weight: bold; color: ${cor_alternativa_b};"><strong>B)</strong> ${p.alternativa_b}</p>
    <p style="font-weight: bold; color: ${cor_alternativa_c};"><strong>C)</strong> ${p.alternativa_c}</p>
    <p style="font-weight: bold; color: ${cor_alternativa_d};"><strong>D)</strong> ${p.alternativa_d}</p>
    <p><strong>Pontos ganhos:</strong> <span style="color:${cor_pontuacao}">${str_pontos_ganhos}</span></p>
    `
    lista.appendChild(div);
});

function exibirMensagem(label, texto, cor) {
  label.style.display = '';
  label.style.color = cor;
  label.textContent = texto;
  label.style.opacity = 1;
  setTimeout(() => {
    msgBox.classList.add("hidden");
  }, 10000)
}

function fecharModalFeedback() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    sessionStorage.setItem(FEEDBACK_DRAFT_KEY, caixaTextoFeedback.value);
}

function feedbackErro() {
  exibirMensagem(msgBox, "Erro no envio do feedback.")
  msgBox.className = "feedback-mensagem erro";
  msgBox.classList.remove("hidden");
}

function feedbackSucesso(idFeedback) {
  feedbackIdAtual = idFeedback;
  caixaTextoFeedback.disabled = true;

  msgBox.textContent = "Feedback enviado com sucesso.";
  msgBox.className = "feedback-mensagem sucesso";
  msgBox.classList.remove("hidden");

  actionsForm.classList.add("hidden");
  actionsVoltar.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  // Adiciona som de tecla digitada na caixa de texto
  if (caixaTextoFeedback) {
    caixaTextoFeedback.addEventListener("keydown", (e) => {playKeySound(e)});
  }

  // Função para prosseguir para a tela hom
  btnProsseguir.addEventListener("click", () => {
    playSound("click");
    window.location.href = 'home';
  });

  // Função para envio do feedback
  btnEnviar.addEventListener("click", async () => {
    if (feedbackEmEnvio) return;

    const comentario = caixaTextoFeedback.value.trim();
    if (!comentario) return;
    playSound("click");

    msgBox.textContent = "Enviando feedback...";
    msgBox.className = "feedback-mensagem enviando";

    feedbackEmEnvio = true;
    btnEnviar.disabled = true;

    const payload = {
        id_visitante: localStorage.getItem("id_visitante"),
        tema: tema_atual,
        pontuacao_saldo: valor_saldo,
        comentario: comentario,
        feedback_id: feedbackIdAtual
    };
    console.log('tema: ', document.getElementById("tema-perguntas").textContent)

    try {
        const response = await fetch("/api/feedbacks/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
        feedbackErro();
        throw new Error(data.detalhe || "Erro ao enviar feedback");
        }

        feedbackSucesso(data.id_feedback);

    }
    catch (err) {
        console.error(err);
        feedbackErro();
    }
    finally {
        // Só libera se for permitido editar novamente
        feedbackEmEnvio = false;
        btnEnviar.disabled = false;
    }
  });

  // Função para editar o feedback
  document.getElementById("editar-feedback").addEventListener("click", () => {
    playSound("click");
    caixaTextoFeedback.disabled = false;
    actionsVoltar.classList.add("hidden");
    actionsForm.classList.remove("hidden");
    msgBox.classList.add("hidden");
  });

  // Abrir modal
  btnFeedback.addEventListener("click", () => {
    playSound("click");
    const draft = sessionStorage.getItem(FEEDBACK_DRAFT_KEY);
    if (draft && feedbackIdAtual === null) caixaTextoFeedback.value = draft;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  });

  // Fechar pelo botão cancelar
  btnCancelar.addEventListener("click", () => {
    playSound("click");
    fecharModalFeedback()
  });

  // Fechar clicando fora do conteúdo
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      fecharModalFeedback()
    }
  });

  // Fechar pelo botão voltar
  btnVoltar.addEventListener("click", () => {
    playSound("click");
    fecharModalFeedback()
  })
});
