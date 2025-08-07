let perguntasPorDificuldade = {
  "Fácil": [],
  "Médio": [],
  "Difícil": []
};
let aguardandoProxima = false;
let dicaGasta = false;
let inicioPergunta = null;  // horário inicial da pergunta
let params = new URLSearchParams(window.location.search);
let temaAtual = params.get("tema");
let modoJogo = params.get("modo");
let pontuacoesUsuario = null;
let animacaoConcluida = false;
let perguntaSelecionada = null
let dificuldadesPermitidas = ['Fácil']
let regrasPontuacao = JSON.parse(localStorage.getItem("regras_pontuacao"))
let infoUltimoRanking = regrasPontuacao[regrasPontuacao.length - 1]
let regrasUsuario = null
let rankingUsuario = null

function atualizarRankingVisual() {
  const infoRankingAtual = obterInfoRankingAtual()
  const pontuacao = pontuacoesUsuario[temaAtual] || 0;

  // Identifica o ranking anterior alcançado pelo usuário
  let rankingAnterior = "";
  for (let i = 0; i < regrasPontuacao.length; i++) {
    if (regrasPontuacao[i].ranking === infoRankingAtual.ranking) {
      // Se não for o primeiro da lista, pega o anterior
      if (i > 0) {
        rankingAnterior = regrasPontuacao[i - 1].ranking;
      }
      break;
    }
  }

  // Identifica o próximo ranking a ser alcançado pelo usuário
  let rankingProximo = null;
  for (let i = 0; i < regrasPontuacao.length; i++) {
    const r = regrasPontuacao[i];
    if (pontuacao >= r.pontos_minimos && pontuacao <= r.pontos_maximos) {
      rankingProximo = regrasPontuacao[i + 1];
      break;
    }
  }

  // Calcula progresso percentual
  let progresso = 100;
  if (rankingProximo) {
    const intervalo = rankingProximo.pontos_minimos - infoRankingAtual.pontos_minimos;
    progresso = ((pontuacao - infoRankingAtual.pontos_minimos) / intervalo) * 100;
    progresso = Math.min(100, Math.max(0, progresso));
  }

  // Atualiza a interface
  document.getElementById("ranking").textContent = infoRankingAtual.ranking;
  document.getElementById("pontuacao").textContent = pontuacao;
  document.getElementById("ranking-anterior").textContent = rankingAnterior;
  document.getElementById("ranking-proximo").textContent = rankingProximo ? rankingProximo.ranking : "";
  document.getElementById("barra-progresso").style.width = progresso + "%";
}

function obterInfoRankingAtual() {
  const pontuacao = pontuacoesUsuario[temaAtual] || 0;
  const regras = JSON.parse(localStorage.getItem("regras_pontuacao")) || [];

  const infoRankingAtual = regras.find(regra => 
    pontuacao >= regra.pontos_minimos && pontuacao <= regra.pontos_maximos
  );

  return infoRankingAtual || (regras.length > 0 ? regras[0] : null);
}

function calcularTempoGasto() {
    return Math.floor((Date.now() - inicioPergunta) / 1000);  // segundos
}

function carregarPerguntas() {
  if (!temaAtual || !modoJogo) {
    console.error("Tema ou modo de jogo não definidos na URL.");
    return;
  }
  fetch(`/api/perguntas?tema=${temaAtual}&modo=${modoJogo}`)
    .then(response => response.json())
    .then(data => {
      perguntasPorDificuldade = data["perguntas"];
      pontuacoesUsuario = data["pontuacoes_usuario"];
      atualizarRankingVisual();
      mostrarPergunta();
      configurarEstrelas();
    })
  .catch(error => {
      console.error("Erro ao carregar perguntas:", error);
    });
}

function animarTexto(texto, elemento, callback) {
  elemento.textContent = "";
  let i = 0;
  const intervalo = setInterval(() => {
    if (i < texto.length) {
      elemento.textContent += texto[i];
      i++;
    } else {
      clearInterval(intervalo);
      animacaoConcluida = true
      inicioPergunta = Date.now()
      if (callback) callback();
    }
  }, 25); // velocidade da animação
}

function obterDificuldadesDesbloqueadas() {
  const infoRankingAtual = obterInfoRankingAtual();
  dificuldadesPermitidas = ['Fácil'];

  if (infoRankingAtual.pode_receber_medio) {
    dificuldadesPermitidas.push('Médio');
  }
  if (infoRankingAtual.pode_receber_dificil) {
    dificuldadesPermitidas.push('Difícil');
  }

  return dificuldadesPermitidas;
}

function mostrarPergunta() {
  animacaoConcluida = false;
  const dificuldadesDisponiveis = pegarDificuldadesDisponiveis()
  
  // Seleciona dificuldade aleatória apenas entre as que ainda têm perguntas
  const dificuldadeSelecionada = choice(dificuldadesDisponiveis);
  const perguntasDisponiveis = perguntasPorDificuldade[dificuldadeSelecionada];

  // Define a pergunta
  const indicePergunta = Math.floor(Math.random() * perguntasDisponiveis.length);
  perguntaSelecionada = perguntasDisponiveis[indicePergunta];

  // Remove a pergunta do array para não repetir
  perguntasDisponiveis.splice(indicePergunta, 1);

  dicaGasta = false;
  window.avaliacaoAtual = 0;

  const enunciadoElemento = document.getElementById("pergunta-enunciado");
  animarTexto(perguntaSelecionada.enunciado, enunciadoElemento);

  // Mostra o nível da pergunta
  const dificuldade = perguntaSelecionada.dificuldade
  const titulo = document.getElementById("tema-nivel-pergunta");
  titulo.textContent = `${temaAtual} - ${dificuldade}`;
  // Define a cor com base na dificuldade
  switch (dificuldade.toLowerCase()) {
    case "fácil":
      titulo.style.color = "green";
      break;
    case "médio":
      titulo.style.color = "gold";
      break;
    case "difícil":
      titulo.style.color = "red";
      break;
    default:
      titulo.style.color = "black";
  }

  // Ativa e esvazia a caixa de texto 
  document.getElementById("resposta-input").disabled = false;
  document.getElementById("resposta-input").value = "";

  // Decide se deve mostrar o ícone de dica
  rankingUsuario = obterInfoRankingAtual().ranking
  regrasUsuario = regrasPontuacao.find(r => r.ranking === rankingUsuario); // Estas regras do usuário, assim como o rankingUsuario são utilizadas na parte de calcular pontos também, portanto deve-se ter cuidado caso se deva apagar daqui
    if (!regrasUsuario) {
        console.error("Ranking do usuário não encontrado nas regras de pontuação.");
        return 0;
    }
  dicaPermitida = true
  if (perguntaSelecionada.dificuldade === 'Fácil' && regrasUsuario.pontos_acerto_facil <= 10 || perguntaSelecionada.dificuldade === 'Médio' && regrasUsuario.pontos_acerto_medio <= 10 || !perguntaSelecionada.dica) {
    dicaPermitida = false
  }
  if (dicaPermitida) {
  document.getElementById("dica-icon").style.display = "flex";
    } 
  else {
  document.getElementById("dica-icon").style.display = "none";
    }
  
  document.getElementById("resposta-input").value = "";
  document.getElementById("resultado").style.display = "none";
  document.getElementById("avaliacao").style.display = "none";
  document.getElementById("dica-box").style.display = "none";
  document.getElementById("nota-box").style.display = "none";
  document.getElementById('enviar-btn').disabled = false;
  aguardandoProxima = false;

  // Resetar estrelas
  document.querySelectorAll(".estrela").forEach(e => {
  e.textContent = "☆";
  e.classList.remove("dourada");

  esconderRespostasAceitas()
  });
}

function calcularPontuacao(dificuldade, acertou) {
    if (!acertou) {
      let pontosGanhos = 0;
      const respostaUsuario = document.getElementById("resposta-input").value.trim()
      if (respostaUsuario === "") {
        pontosGanhos = regrasUsuario.pontos_pular_pergunta; // Penalidade menor por não responder
      } else {
        pontosGanhos = regrasUsuario.pontos_erro; // Erro com tentativa
      }
      
      pontuacoesUsuario[temaAtual] = Math.max(0, (pontuacoesUsuario[temaAtual] || 0) + pontosGanhos);
      return pontosGanhos;
    }

    let pontosBase = 0;
    switch (dificuldade) {
        case "Fácil":
            pontosBase = regrasUsuario.pontos_acerto_facil;
            break;
        case "Médio":
            pontosBase = regrasUsuario.pontos_acerto_medio;
            break;
        case "Difícil":
            pontosBase = regrasUsuario.pontos_acerto_dificil;
            break;
        default:
            console.warn("Dificuldade desconhecida:", dificuldade);
            return 0;
    }

    let pontosGanhos = pontosBase;

    if (dicaGasta) {
        const percentualPenalidade = regrasUsuario.percentual_penalidade_dica / 100;
        const inteiroPenalidade = Math.round((pontosBase * percentualPenalidade) / 10) * 10;
        console.log("Pontos base: ", pontosBase)
        console.log("Penalidade aplicada: ", inteiroPenalidade)
        pontosGanhos = pontosBase - inteiroPenalidade;
        
        // fallback defensivo
        if (pontosGanhos < 0) {
            console.warn("Penalidade excedeu a pontuação base. Aplicando pontuação base.");
            pontosGanhos = pontosBase;
        }
    }
    
    // Analisa quantos pontos o usuário ainda pode ganhar caso esteja no último ranking já
    if (rankingUsuario === infoUltimoRanking.ranking && pontuacoesUsuario[temaAtual] + pontosGanhos > infoUltimoRanking.pontos_maximos) {
       pontosGanhos = infoUltimoRanking.pontos_maximos - pontuacoesUsuario[temaAtual]
    }
    pontuacoesUsuario[temaAtual] = pontuacoesUsuario[temaAtual] + pontosGanhos;
    return pontosGanhos;
}

function obterDicaAtual() {
  return perguntaSelecionada?.dica || "";
}

function obterNotaAtual() {
  return perguntaSelecionada?.nota || "";
}

function mostrarResultadoResposta(correto) {
  const resultado = document.getElementById("resultado");
  const respostasCorretas = perguntaSelecionada.respostas_corretas
  resultado.style.display = "block";

  // Desativa caixa de texto da resposta e mostra as possibilidades de respostas corretas para a pergunta
  document.getElementById("resposta-input").disabled = true;
  mostrarRespostasAceitas(respostasCorretas);
  
  // Exibe dica
  if (perguntaSelecionada.dica && perguntaSelecionada.dica.trim() !== "") {
    document.getElementById("dica-texto").textContent = obterDicaAtual();
    document.getElementById("dica-box").style.display = "block";
  } else {
    document.getElementById("dica-box").style.display = "none";
  }

   // Exibe nota, curiosidade ou explicação
   if (perguntaSelecionada.nota && perguntaSelecionada.nota.trim() !== "") {
    let textoFormatado = perguntaSelecionada.nota.replace(/^(Nota|Explicação|Curiosidade)/i, '<strong>$1</strong>');
    document.getElementById("nota-texto").innerHTML = textoFormatado;
    document.getElementById("nota-box").style.display = "block";
   } else {
    document.getElementById("nota-box").style.display = "none";
   }

  if (correto) {
    resultado.innerHTML = '✅ <strong>Resposta correta!</strong>';
    resultado.style.color = "green";
  } else {
    resultado.innerHTML = '❌ <strong>Resposta incorreta</strong>';
    resultado.style.color = "red";
  }

  aguardandoProxima = true;
  document.getElementById("enviar-btn").style.display = "none";

  // Chama as estrelas de feedback e carrega as anteriores enviadas pelo usuário caso esteja no modo Revisão
  if (modoJogo === "revisao") {
    const avaliacaoAnterior = perguntaSelecionada.estrelas || 0;
    renderizarEstrelas(avaliacaoAnterior);
  }
  document.getElementById("avaliacao").style.display = "block";

  // Exibe os comentários dos outros usuários
  document.getElementById('comentarios').style.display = 'block';
}

function respostaEstaCorreta(respostaUsuario, respostasAceitas) {
  const stopwords = ["a", "o", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "por", "com", "para", "um", "uma", "uns", "umas", "ao", "aos", "à", "às"];

  function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function limparTexto(texto) {
    return texto
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(removerAcentos)
      .filter(palavra => !stopwords.includes(palavra))
      .join(" ");
  }

  function distanciaLevenshtein(a, b) {
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const custo = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + custo
        );
      }
    }
    return matrix[a.length][b.length];
  }

  const textoUsuario = limparTexto(respostaUsuario);

  return respostasAceitas.some(resposta => {
    const textoCorreto = limparTexto(resposta);

    if (textoUsuario === textoCorreto) return true;

    const len = textoCorreto.length;
    const dist = distanciaLevenshtein(textoUsuario, textoCorreto);

    if (len <= 3) return false;
    if (len <= 10) return dist === 1;
    return dist <= 2;
  });
}

function registrarResposta(respostaUsuario, acertou, usouDica, pontosGanhos, tempoGasto, idPergunta, versaoPergunta) {
    fetch('/registrar_resposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tipo_pergunta: 'Discursiva',
            resposta_usuario: respostaUsuario,
            acertou: acertou,
            usou_dica: usouDica,
            pontos_ganhos: pontosGanhos,
            tempo_gasto: tempoGasto,
            id_pergunta: idPergunta,
            versao_pergunta: versaoPergunta,
            tema: temaAtual
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.sucesso) {
            atualizarRankingVisual(data.nova_pontuacao, pontosGanhos);
        } else {
            console.error('Erro ao registrar resposta:', data.mensagem);
        }
    })
    .catch(err => console.error('Erro na comunicação:', err));
}

function mostrarRespostasAceitas(lista) {
  const container = document.getElementById("respostas-aceitas");
  const span = document.getElementById("lista-respostas");
  span.textContent = lista.join(", ");
  container.style.display = "block";
}

function esconderRespostasAceitas() {
  document.getElementById("respostas-aceitas").style.display = "none";
}

function renderizarEstrelas(valor) {
  const estrelas = document.querySelectorAll(".estrela");
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

function configurarEstrelas() {
  const estrelas = document.querySelectorAll(".estrela");

  estrelas.forEach((estrela, i) => {
    estrela.addEventListener("click", () => {
      const valor = i + 1;
      const idPergunta = perguntaSelecionada.id_pergunta;
      const tipoPergunta = "Discursiva";
      versaoPergunta = perguntaSelecionada.versao_pergunta;

      // Esta variável serve para economizar memória caso o usuário clique duas vezes na mesma estrela
      let avaliacaoAnterior = window.avaliacoes?.[idPergunta] || 0;
      if (valor === avaliacaoAnterior) return;

      renderizarEstrelas(valor); // reutilização

      window.avaliacoes = window.avaliacoes || {};
      window.avaliacoes[idPergunta] = valor;

      fetch("/enviar_feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_pergunta: idPergunta,
          tipo_pergunta: tipoPergunta,
          email_usuario: emailUsuario,
          estrelas: valor,
          versao_pergunta: versaoPergunta,
          id_usuario: idUsuario
        })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.sucesso) {
          console.error("Erro ao registrar feedback:", data.erro);
        }
      })
      .catch(err => console.error("Erro na requisição:", err));
    });
  });
}

function mostrarBotoesAcao() {
  const botoesDiv = document.getElementById("botoes-acao");
  const btnFinalizar = document.getElementById("btnFinalizar");
  const btnProxima = document.getElementById("btnProxima");

  // Mostra a div de botões
  botoesDiv.style.display = "flex";
  
  const dificuldadesDisponiveis = pegarDificuldadesDisponiveis()
  if (dificuldadesDisponiveis.length === 0) {
    // Mostrar apenas o botão Finalizar
    btnProxima.style.display = "none";
    btnFinalizar.style.display = "inline-block";
    btnFinalizar.style.flex = "unset"; // remove flex igual ao botão enviar
    btnFinalizar.style.width = "100%";
    btnFinalizar.style.margin = "0 auto";

  } else {
    // Mostrar ambos
    btnProxima.style.display = "inline-block";
    btnFinalizar.style.display = "inline-block";
    btnFinalizar.style.flex = "1";
    btnFinalizar.style.width = "unset";
  }

  // Desabilita ambos por precaução
  btnFinalizar.disabled = true;
  btnProxima.disabled = true;

  // Reativa após 500ms
  setTimeout(() => {
    btnFinalizar.disabled = false;
    btnProxima.disabled = false;
  }, 500);
}

function pegarDificuldadesDisponiveis() {
  const dificuldadesPermitidas = obterDificuldadesDesbloqueadas();
  const dificuldadesDisponiveis = dificuldadesPermitidas.filter(dif => {
    return perguntasPorDificuldade[dif] && perguntasPorDificuldade[dif].length > 0;
  });
  return dificuldadesDisponiveis
}

function proximaPergunta() {
  if (haPerguntasDisponiveis()) {
    mostrarPergunta();
    document.getElementById('botoes-acao').style.display = "none";
    document.getElementById("avaliacao").style.display = "none";
    document.getElementById("resultado").style.display = "none";
    document.getElementById("dica-box").style.display = "none";
    document.getElementById("nota-box").style.display = "none";
    document.getElementById("resposta-input").value = "";
    document.getElementById('comentarios').style.display = 'none';
    document.getElementById("enviar-btn").style.display= "inline-block";
    aguardandoProxima = false;
  }
}

function usarDica() {
  if (aguardandoProxima || dicaGasta) return;
  
  let dicasRestantes = parseInt(localStorage.getItem("dicas_restantes") || "0");
  if (dicasRestantes <= 0) {
    alert("Você não possui mais dicas.");
    return;
  }

  fetch("/usar_dica", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      dicasRestantes -= 1;
      localStorage.setItem("dicas_restantes", dicasRestantes);
      document.getElementById("contador-dicas").textContent = dicasRestantes;

      document.getElementById("dica-texto").textContent = obterDicaAtual();
      document.getElementById("dica-box").style.display = "block";
      dicaGasta = true;
    } else {
      alert(data.message || "Erro ao usar a dica.");
    }
  })
  .catch(error => {
    console.error("Erro ao requisitar o backend:", error);
  });
}

function haPerguntasDisponiveis() {
  return dificuldadesPermitidas.some(dif => perguntasPorDificuldade[dif].length > 0);
}

function choice(array) {
  const indice = Math.floor(Math.random() * array.length);
  return array[indice];
}

function finalizarQuiz() {
window.location.href = "/home";
}

function enviarResposta() {
if (!animacaoConcluida) return;

  // Analisa se a resposta enviada está correta
  const respostaUsuario = document.getElementById("resposta-input").value.trim();
  const respostasCorretas = perguntaSelecionada.respostas_corretas;
  const acertou = respostaEstaCorreta(respostaUsuario, respostasCorretas);
  
  // ATENÇÃO: AQUI DEVERÁ CHAMAR O registrarRespostaObjetiva SE FOR O CASO NO FUTURO
  if (modoJogo == 'desafio') {
  const dificuldade = perguntaSelecionada.dificuldade
  const pontosGanhos = calcularPontuacao(dificuldade, acertou);
  const idPergunta = perguntaSelecionada.id_pergunta;
  const versaoPergunta = perguntaSelecionada.versao_pergunta;
  const tempoGasto = calcularTempoGasto();
  console.log("Tempo gasto: ", tempoGasto)
  registrarResposta(
    respostaUsuario,
    acertou,
    dicaGasta,
    pontosGanhos,
    tempoGasto,
    idPergunta,
    versaoPergunta
  )};

  mostrarResultadoResposta(acertou);
  mostrarBotoesAcao()
}

document.getElementById('resposta-input').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();

    const botao = document.getElementById('botao-enviar');

    if (botao && botao.offsetParent !== null) {
      // offsetParent !== null garante que está visível (não display: none)
      enviarResposta();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const dicas = JSON.parse(localStorage.getItem("dicas_restantes"));
  const contadorDicas = document.getElementById("contador-dicas");
  if (contadorDicas && dicas !== null) {
    contadorDicas.textContent = dicas;
  }
});

// Carrega as perguntas para o quiz
carregarPerguntas();
