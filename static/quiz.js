import { obterDificuldadesDisponiveis, obterInfoRankingAtual } from "./utils.js"

let perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"))
let aguardando_proxima = false // Variável que evita uso de dica após já ter respondido a pergunta
let dica_gasta = false
let inicio_pergunta = null  // horário inicial da pergunta
let tema_atual = decodeURIComponent(localStorage.getItem("tema_atual"))
let modo_jogo = localStorage.getItem("modo_jogo")
let pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario")) // DEVERÁ SER REMOVIDA EM BREVE
let animacao_concluida = false
let pergunta_selecionada = null
let dificuldades_permitidas = ['Fácil']
let ha_perguntas_disponiveis = false
let regras_pontuacao = JSON.parse(localStorage.getItem("regras_pontuacao"))
let info_ultimo_ranking = regras_pontuacao[regras_pontuacao.length - 1]
let regras_usuario = null
let ranking_usuario = null
const lbl_pontuacao_usuario = document.getElementById('pontuacao')
const lbl_pontos_ganhos = document.getElementById('incremento-pontuacao')
const btn_enviar = document.getElementById("btn-enviar")
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

function atualizarRankingVisual() {
  // Declara as variáveis que serão úteis
  const info_ranking_atual = obterInfoRankingAtual();
  const pontuacao = pontuacoes_usuario[tema_atual] || 0;
  let ranking_anterior = "";
  let ranking_proximo = null;
  let progresso = 100;

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

  // Calcula progresso percentual
  if (ranking_proximo) {
    const intervalo = ranking_proximo.pontos_minimos - info_ranking_atual.pontos_minimos;
    progresso = ((pontuacao - info_ranking_atual.pontos_minimos) / intervalo) * 100;
    progresso = Math.min(100, Math.max(0, progresso));
  }

  // Atualiza a interface
  document.getElementById("ranking").textContent = info_ranking_atual.ranking;
  document.getElementById("ranking-anterior").textContent = ranking_anterior;
  document.getElementById("ranking-proximo").textContent = ranking_proximo ? ranking_proximo.ranking : "";
  document.getElementById("barra-progresso").style.width = progresso + "%";
}

function mostrarPergunta() {
  animacao_concluida = false;
  
  // Seleciona uma dificuldade aleatória dentre as disponíveis para o ranking do usuário atual
  function selecionarDificuldadeComPerguntas() {
    const dificuldades_disponiveis = obterDificuldadesDisponiveis()
    const dificuldades_embaralhadas = [...dificuldades_disponiveis]
      .sort(() => Math.random() - 0.5);  // Embaralha as dificuldades

    for (const dificuldade of dificuldades_embaralhadas) {
      const perguntas = perguntas_por_dificuldade[dificuldade];
      if (perguntas && perguntas.length > 0) {
        return dificuldade;  // Encontrou uma com perguntas restantes
      }
    }

    return null;  // Nenhuma dificuldade com perguntas restantes
  }
  const dificuldade_selecionada = selecionarDificuldadeComPerguntas();

  // Pega uma pergunta aleatória da dificuldade selecionada
  const perguntas_disponiveis = perguntas_por_dificuldade[dificuldade_selecionada];
  const indicePergunta = Math.floor(Math.random() * perguntas_disponiveis.length);
  pergunta_selecionada = perguntas_disponiveis[indicePergunta];
  console.log(`Pergunta selecionada: (${pergunta_selecionada.id_pergunta}) ${pergunta_selecionada.enunciado}`)

  // Remove a pergunta do array para não repetir
  perguntas_disponiveis.splice(indicePergunta, 1);
  
  dica_gasta = false;
  window.avaliacaoAtual = 0;

  // Faz animação do enunciado da pergunta
  const enunciadoElemento = document.getElementById("pergunta-enunciado");
  animarTexto(pergunta_selecionada.enunciado, enunciadoElemento);

  // Mostra o nível da pergunta
  const dificuldade = pergunta_selecionada.dificuldade
  const titulo = document.getElementById("tema-nivel-pergunta");
  titulo.textContent = `${tema_atual} - ${dificuldade}`;

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
  ranking_usuario = obterInfoRankingAtual().ranking
  regras_usuario = regras_pontuacao.find(r => r.ranking === ranking_usuario); // Estas regras do usuário, assim como o ranking_usuario são utilizadas na parte de calcular pontos também, portanto cuidado ao apagar aqui
  if (!regras_usuario) {
        console.error("Ranking do usuário não encontrado nas regras de pontuação.");
        return 0;
  }
  let dica_permitida = true
  if (pergunta_selecionada.dificuldade === 'Fácil' && regras_usuario.pontos_acerto_facil <= 10 || pergunta_selecionada.dificuldade === 'Médio' && regras_usuario.pontos_acerto_medio <= 10 || !pergunta_selecionada.dica) {
    dica_permitida = false
  }
  if (dica_permitida) {
  document.getElementById("dica-icon").style.display = "flex";
    } 
  else {
  document.getElementById("dica-icon").style.display = "none";
    }
  
  // No modo revisão não exibe contador de dicas
  if (modo_jogo === 'revisao') {
    document.getElementById("contador-dicas").textContent = ''
  }
  
  document.getElementById("resposta-input").value = "";
  document.getElementById("resultado").style.display = "none";
  document.getElementById("avaliacao").style.display = "none";
  document.getElementById("dica-box").style.display = "none";
  document.getElementById("nota-box").style.display = "none";
  document.getElementById('btn-enviar').disabled = false;
  aguardando_proxima = false;

  // Resetar estrelas
  document.querySelectorAll(".estrela").forEach(e => {
  e.textContent = "☆";
  e.classList.remove("dourada");

  esconderRespostasAceitas()
  });
}

function calcularPontuacao(dificuldade, acertou) {
  if (!acertou) {
    let pontos_ganhos = 0;
    const resposta_usuario = document.getElementById("resposta-input").value.trim()
    if (resposta_usuario === "") {
      pontos_ganhos = regras_usuario.pontos_pular_pergunta; // Penalidade menor por não responder
    } else {
      pontos_ganhos = regras_usuario.pontos_erro; // Erro com tentativa
    }
    // Trata casos em que a pontuação do usuário ficaria negativa
    if (pontuacoes_usuario[tema_atual] + pontos_ganhos < 0) {
      pontos_ganhos = -pontuacoes_usuario[tema_atual]
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
      default:
          console.warn("Dificuldade desconhecida:", dificuldade);
          return 0;
  }

  let pontos_ganhos = pontosBase;

  if (dica_gasta) {
      const percentualPenalidade = regras_usuario.percentual_penalidade_dica / 100;
      const inteiroPenalidade = Math.round((pontosBase * percentualPenalidade) / 10) * 10;
      pontos_ganhos = pontosBase - inteiroPenalidade;
      
      // fallback defensivo
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

function mostrarResultadoResposta(correto, pontos_ganhos) {
  // ATENÇÃO: TALVEZ SÓ SEJA NECESSÁRIO OS PONTOS_GANHOS AQUI E NÃO A BOOLEANA CORRETO
  const resultado = document.getElementById("resultado");
  const respostas_corretas = pergunta_selecionada.respostas_corretas
  resultado.style.display = "block";

  // Desativa caixa de texto da resposta e mostra as possibilidades de respostas corretas para a pergunta
  document.getElementById("resposta-input").disabled = true;
  mostrarRespostasAceitas(respostas_corretas);
  
  // Exibe dica
  if (pergunta_selecionada.dica && pergunta_selecionada.dica.trim() !== "") {
    mostrarDica()
  } else {
    document.getElementById("dica-box").style.display = "none";
  }

   // Exibe nota, curiosidade ou explicação
   if (pergunta_selecionada.nota && pergunta_selecionada.nota.trim() !== "") {
    let textoFormatado = pergunta_selecionada.nota.replace(/^(Nota|Explicação|Curiosidade)/i, '<strong>$1</strong>');
    document.getElementById("nota-texto").innerHTML = textoFormatado;
    document.getElementById("nota-box").style.display = "block";
   } else {
    document.getElementById("nota-box").style.display = "none";
   }

  // Exibe a mensagem que indica se a resposta foi correta, errada ou se o usuário pulou
  const resposta_usuario = document.getElementById("resposta-input").value.trim();
  if (!resposta_usuario || resposta_usuario.trim() === "") {
    const svgEscolhido = svg1;
    resultado.innerHTML = `${svgEscolhido} <strong style="color: #FFD700; margin-left:6px;">Não respondida</strong>`;
  } else if (correto) {
      resultado.innerHTML = '✅ <strong>Resposta correta!</strong>';
      resultado.style.color = "green";
  } else {
      resultado.innerHTML = '❌ <strong>Resposta incorreta</strong>';
      resultado.style.color = "red";
  }

  aguardando_proxima = true;
  document.getElementById("btn-enviar").style.display = "none";

  // Chama as estrelas de feedback e carrega as anteriores enviadas pelo usuário caso esteja no modo Revisão
  if (modo_jogo === "revisao") {
    const avaliacao_anterior = pergunta_selecionada.estrelas || 0;
    renderizarEstrelas(avaliacao_anterior);
  }
  document.getElementById("avaliacao").style.display = "block";

  // Exibe os comentários dos outros usuários
  document.getElementById('comentarios').style.display = 'block';

  // Exibe os pontos ganhos ou perdidos
  if (pontos_ganhos > 0) {
    lbl_pontos_ganhos.style.color = 'green'
    //lbl_pontos_ganhos.style.opacity = 1
    lbl_pontos_ganhos.style.display = 'flex'
    lbl_pontos_ganhos.textContent = `+${pontos_ganhos}`
  }
  else if (pontos_ganhos < 0) {
    lbl_pontos_ganhos.style.color = 'red'
    //lbl_pontos_ganhos.style.opacity = 1
    lbl_pontos_ganhos.style.display = 'flex'
    lbl_pontos_ganhos.textContent = `${pontos_ganhos}`
  }
  
}

function respostaEstaCorreta(resposta_usuario, respostas_aceitas) {
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

  const textoUsuario = limparTexto(resposta_usuario);

  return respostas_aceitas.some(resposta => {
    const textoCorreto = limparTexto(resposta);

    if (textoUsuario === textoCorreto) return true;

    const len = textoCorreto.length;
    const dist = distanciaLevenshtein(textoUsuario, textoCorreto);

    if (len <= 3) return false;
    if (len <= 10) return dist === 1;
    return dist <= 2;
  });
}

async function registrarResposta(resposta_usuario, acertou, usou_dica, pontos_ganhos, tempo_gasto, id_pergunta, versao_pergunta) {
  try {
    const response = await fetch('/registrar_resposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_pergunta: 'Discursiva',
        resposta_usuario: resposta_usuario,
        acertou: acertou,
        usou_dica: usou_dica,
        pontos_ganhos: pontos_ganhos,
        tempo_gasto: tempo_gasto,
        id_pergunta: id_pergunta,
        versao_pergunta: versao_pergunta,
        tema: tema_atual
      })
    });

    const data = await response.json();

    if (data.sucesso) {
      // Atualiza a pontuação do usuário para o tema no localStorage
      const pontuacao_atual = pontuacoes_usuario[tema_atual]
      pontuacoes_usuario[tema_atual] = data.nova_pontuacao;
      alterarPontuacaoUsuario(pontuacao_atual, pontuacoes_usuario[tema_atual], callbackAtualizarUI)
      localStorage.setItem("pontuacoes_usuario", JSON.stringify(pontuacoes_usuario));

      // Atualiza as perguntas restantes do usuário no localStorage
      localStorage.setItem("perguntas_restantes", data.perguntas_restantes)
      document.getElementById("perguntas-count").textContent = data.perguntas_restantes

      atualizarRankingVisual();
      return true;
    } else {
      console.error('Erro ao registrar resposta:', data.mensagem);
      return false;
    }

  } catch (err) {
    console.error('Erro na comunicação:', err);
    return false;
  }
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

function callbackAtualizarUI (pontuacao) {
  lbl_pontuacao_usuario.textContent = pontuacao
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
      const id_pergunta = pergunta_selecionada.id_pergunta;
      const tipo_pergunta = "Discursiva";
      versao_pergunta = pergunta_selecionada.versao_pergunta;

      // Esta variável serve para economizar memória caso o usuário clique duas vezes na mesma estrela
      let avaliacao_anterior = window.avaliacoes?.[id_pergunta] || 0;
      if (valor === avaliacao_anterior) return;

      renderizarEstrelas(valor); // reutilização

      window.avaliacoes = window.avaliacoes || {};
      window.avaliacoes[id_pergunta] = valor;

      fetch("/enviar_feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_pergunta: id_pergunta,
          tipo_pergunta: tipo_pergunta,
          email_usuario: email_usuario,
          estrelas: valor,
          versao_pergunta: versao_pergunta,
          id_usuario: id_usuario
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

async function enviarResposta() {
  if (!animacao_concluida || btn_enviar.disabled) return;
  btn_enviar.disabled = true

  // Analisa se a resposta enviada está correta
  const resposta_usuario = document.getElementById("resposta-input").value.trim();
  const respostas_corretas = pergunta_selecionada.respostas_corretas;
  const acertou = respostaEstaCorreta(resposta_usuario, respostas_corretas);
  let prosseguir_com_resultado = true
  
  // ATENÇÃO: AQUI DEVERÁ CHAMAR O registrarRespostaObjetiva SE FOR O CASO NO FUTURO
  let pontos_ganhos = 0
  if (modo_jogo == 'desafio') {
    const dificuldade = pergunta_selecionada.dificuldade
    pontos_ganhos = calcularPontuacao(dificuldade, acertou);
    const id_pergunta = pergunta_selecionada.id_pergunta;
    const versao_pergunta = pergunta_selecionada.versao_pergunta;
    const tempo_gasto = calcularTempoGasto();
    prosseguir_com_resultado = await registrarResposta(
      resposta_usuario,
      acertou,
      dica_gasta,
      pontos_ganhos,
      tempo_gasto,
      id_pergunta,
      versao_pergunta
  )};

  if (prosseguir_com_resultado) {
    mostrarResultadoResposta(acertou, pontos_ganhos);
    mostrarBotoesAcao()
  }
  else  {
    alert("Não foi possível se conectar com o servidor. Por favor, verifique sua conexão e tente novamente.")
    btn_enviar.disabled = false
  }
}

function mostrarBotoesAcao() {
  const botoes_div = document.getElementById("botoes-acao");
  const btn_finalizar = document.getElementById("btn-finalizar");
  const btn_proxima = document.getElementById("btn-proxima");

  // Mostra a div de botões
  botoes_div.style.display = "flex";
  
  dificuldades_permitidas = obterDificuldadesDisponiveis()
  ha_perguntas_disponiveis = dificuldades_permitidas.some(dif => perguntas_por_dificuldade[dif].length > 0)
  if (!ha_perguntas_disponiveis || localStorage.getItem("perguntas_restantes") <= 0) {
    // Mostrar apenas o botão Finalizar
    btn_proxima.style.display = "none";
    btn_finalizar.style.display = "inline-block";
    btn_finalizar.style.flex = "unset"; // remove flex igual ao botão enviar
    btn_finalizar.style.width = "100%";
    btn_finalizar.style.margin = "0 auto";

  } else {
    // Mostrar ambos
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

function proximaPergunta() {
  lbl_pontos_ganhos.style.display = 'none'
  if (ha_perguntas_disponiveis) {
    mostrarPergunta();
    document.getElementById('botoes-acao').style.display = "none";
    document.getElementById("avaliacao").style.display = "none";
    document.getElementById("resultado").style.display = "none";
    document.getElementById("dica-box").style.display = "none";
    document.getElementById("nota-box").style.display = "none";
    document.getElementById("resposta-input").value = "";
    document.getElementById('comentarios').style.display = 'none';
    document.getElementById("btn-enviar").style.display= "inline-block";
    aguardando_proxima = false;
  }
}

function usarDica() {
  if (aguardando_proxima || dica_gasta) return;
  if (modo_jogo == 'desafio') {
    let dicas_restantes = parseInt(localStorage.getItem("dicas_restantes") || "0");
    if (dicas_restantes <= 0) {
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
        dicas_restantes -= 1;
        localStorage.setItem("dicas_restantes", dicas_restantes);
        document.getElementById("contador-dicas").textContent = dicas_restantes;
        mostrarDica();
      } else {
        alert(data.message || "Erro ao usar a dica.");
      }
    })
    .catch(error => {
      console.error("Erro ao requisitar o backend:", error);
    });
  }
  else {
    mostrarDica();
  }
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
      animacao_concluida = true
      inicio_pergunta = Date.now()
      document.getElementById('resposta-input').focus()
      if (callback) callback();
    }
  }, 25); // velocidade da animação
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

function mostrarDica() {
  document.getElementById("dica-texto").textContent = pergunta_selecionada?.dica || "";
  document.getElementById("dica-box").style.display = "block";
  dica_gasta = true;
}

function finalizarQuiz() {
window.location.href = "/home";
}

function calcularTempoGasto() {
    return Math.floor((Date.now() - inicio_pergunta) / 1000);  // segundos
}

document.getElementById('resposta-input').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();

    const botao = document.getElementById('btn-enviar');

    if (botao && botao.offsetParent !== null) {
      // offsetParent !== null garante que está visível (não display: none)
      enviarResposta();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Declara as variáveis que serão úteis
  const dicas = JSON.parse(localStorage.getItem("dicas_restantes"));
  const contador_dicas = document.getElementById("contador-dicas");
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
    const num_perguntas_restantes = document.getElementById("perguntas-count")
    num_perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}`
    icone_perguntas_restantes.style.visibility = 'visible';
  }
  else {
      icone_perguntas_restantes.style.visibility = 'hidden';
  }

  // Implementa a função para usar dica
  if (dica_icon) {
    dica_icon.addEventListener("click", () => {
      usarDica()
    })
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

  // Chama as funções que são necessárias na inicialização
  callbackAtualizarUI (pontuacoes_usuario[tema_atual])
  atualizarRankingVisual();
  mostrarPergunta();
  configurarEstrelas();
});
