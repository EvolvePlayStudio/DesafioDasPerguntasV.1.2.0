import { playSound, playKeySound } from "./sound.js";
import { atualizarAnuncios, registrarInteracaoAnuncio } from "./utils.js";

const cacheAnuncios = sessionStorage.getItem('anuncios') || '{}';
const dadosAnuncios = JSON.parse(cacheAnuncios);
const containerEsq = null;
const labelAnuncioEsq = null;
const containerDir = document.getElementById('banner-lateral-direita');
const labelAnuncioDir = document.getElementById('label-anuncio-direita');
const MODO_VISITANTE = sessionStorage.getItem("modoVisitante") === "true";
let historicoExibicao = {};

const banner_anuncio_direita = document.getElementById("banner-lateral-direita");
banner_anuncio_direita.addEventListener('click', function() {
    registrarInteracaoAnuncio(this.querySelector('a'), "Clique", 'Resultado');
});

historicoExibicao = atualizarAnuncios(containerEsq, containerDir, labelAnuncioEsq, labelAnuncioDir, 'Resultado', dadosAnuncios, 'Resultado', historicoExibicao);
    
setInterval(() => {
    historicoExibicao = atualizarAnuncios(containerEsq, containerDir, labelAnuncioEsq, labelAnuncioDir, 'Resultado', dadosAnuncios, 'Resultado', historicoExibicao
    );
}, 12000);

const perguntas_respondidas = JSON.parse(sessionStorage.getItem("perguntas_respondidas"));
const tema_atual = sessionStorage.getItem("tema_atual");
const tipo_pergunta = sessionStorage.getItem("tipo_pergunta").toLowerCase();
const pontuacoes_jogador = MODO_VISITANTE ? JSON.parse(localStorage.getItem("pontuacoes_visitante")) : JSON.parse(sessionStorage.getItem("pontuacoes_usuario"));
const rankings_jogador = JSON.parse(sessionStorage.getItem("rankings_jogador"));
const pontuacao_anterior = sessionStorage.getItem("pontuacao_anterior");
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
modal, caixaTextoFeedback

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

document.getElementById("tema-perguntas").textContent = resultado.tema;
document.getElementById("pontuacao-anterior").textContent = resultado.pontuacaoAnterior;
document.getElementById("pontuacao-final").textContent = resultado.pontuacaoFinal;
const label_saldo = document.getElementById("pontuacao-saldo")
label_saldo.textContent = resultado.saldo;
label_saldo.style.color = cor_saldo;
label_saldo.style.fontWeight = peso_fonte_saldo;
document.getElementById("ranking-atual").textContent = resultado.ranking_atual;

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

    const cor_pontuacao = correta? 'lime': 'red'
    let cor_dificuldade;
    switch (p.dificuldade.toLowerCase()) {
    case "fácil":
        cor_dificuldade = 'green';
        break;
    case "médio":
        cor_dificuldade = 'gold';
        break;
    case "difícil":
        cor_dificuldade = 'red';
        break;
    case "extremo":
        cor_dificuldade = '#3e16d1';
        break;
    default:
        cor_dificuldade = 'black'
    }

    if (tipo_pergunta === 'discursiva') {
      const texto_usou_dica = p.usou_dica? 'Sim': 'Não';
      div.innerHTML = `
      <p><strong>Dificuldade:</strong> <span style="color: ${cor_dificuldade}">${p.dificuldade}</span></p>
      <p style="font-family: 'Noto Serif', 'Roboto', serif, sans-serif; font-weight: bold;"><strong>${i+1}-</strong> ${p.enunciado}</p>
      <p><strong>Sua resposta:</strong> <span style="color:${cor_pontuacao}">${p.resposta_usuario}</span></p>
      <p><strong>Respostas aceitas:</strong> ${p.respostas_aceitas.join(" / ")}</p>
      <p><strong>Usou dica:</strong> ${texto_usou_dica} </p>
      <p><strong>Pontos ganhos:</strong> <span style=color:${cor_pontuacao}>${str_pontos_ganhos}</span></p>
      `;
    }
    else {
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
    }
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
        tema: document.getElementById("tema-perguntas").textContent,
        tipo_pergunta: tipo_pergunta,
        pontuacao_saldo: valor_saldo,
        comentario: comentario,
        feedback_id: feedbackIdAtual
    };

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
