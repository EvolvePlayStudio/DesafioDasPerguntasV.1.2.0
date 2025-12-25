import { deveEncerrarQuiz, obterDificuldadesDisponiveis, obterInfoRankingAtual, fetchAutenticado } from "./utils.js"

let perguntas_por_dificuldade = JSON.parse(localStorage.getItem("perguntas"));
let perguntas_respondidas = [];
let aguardando_proxima = false // Variável que indica quando se está aguardando próxima pergunta
let dica_gasta = false
let inicio_pergunta = null  // horário inicial da pergunta
let pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario"))
let animacao_concluida = false
let pergunta_selecionada = null
let dificuldades_permitidas = ['Fácil']
let ha_perguntas_disponiveis = false
let regras_pontuacao = null
let info_ultimo_ranking = null
if (sessionStorage["modoVisitante"] === "false") {
  regras_pontuacao = JSON.parse(localStorage.getItem("regras_pontuacao"))
  info_ultimo_ranking = regras_pontuacao[regras_pontuacao.length - 1]
}
let regras_usuario = null
let ranking_usuario = null
const rankings_usuario = JSON.parse(localStorage.getItem("rankings_usuario"))
const tema_atual = decodeURIComponent(localStorage.getItem("tema_atual"))
localStorage.setItem("pontuacao_anterior", pontuacoes_usuario[tema_atual])
console.log("Pontuações do usuário: ", pontuacoes_usuario)
const modo_jogo = localStorage.getItem("modo_jogo").toLocaleLowerCase()
const tipo_pergunta = localStorage.getItem("tipo_pergunta").toLocaleLowerCase()
const lbl_pontuacao_usuario = document.getElementById('pontuacao')
const lbl_pontos_ganhos = document.getElementById('incremento-pontuacao')
const btn_enviar = document.getElementById("btn-enviar")
const btn_pular = document.getElementById("btn-pular")
const botoes_finalizar_div = document.getElementById("botoes-acao");
const botoes_enviar_div = document.getElementById("botoes-envio");
const alternativasContainer = document.getElementById("alternativas-container")
const alternativaBtns = Array.from(alternativasContainer.querySelectorAll(".alternativa-btn"))
const resultado = document.getElementById('resultado')
const caixa_para_resposta = document.getElementById('resposta-input')
const dica_box = document.getElementById("dica-box")
let alternativaSelecionada = null; // guarda a letra clicada (A, B, C, D)
let respostasDesdeUltimaForcagem = 0; // para pegar a pergunta do nível que tem mais a cada x respondidas
const PROBABILIDADES_POR_RANKING = {
  Iniciante: {Fácil: 0.65, Médio: 0.35, Difícil: 0.00},
  Aprendiz: {Fácil: 0.45, Médio: 0.40, Difícil: 0.15},
  Estudante: {Fácil: 0.25, Médio: 0.50, Difícil: 0.25},
  Sábio: {Fácil: 0.10, Médio: 0.55, Difícil: 0.35},
  Lenda: {Fácil: 0.02, Médio: 0.48, Difícil: 0.50}
}
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
const PAUSA_ANTES_DA_A        = 500;
const GAP_ANTES_DA_LETRA      = 120;
const GAP_LETRA_PARA_TEXTO    = 180;
const GAP_ENTRE_ALTERNATIVAS  = 380;
const VELOCIDADE_LETRA        = 25;

try {
  // alert(`Perguntas médias: ${perguntas_por_dificuldade["Médio"].length?? 0}`)
}
catch {
  // alert(`Perguntas por dificuldade: ${perguntas_por_dificuldade}`)
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

function atualizarRankingVisual() {
  if (sessionStorage["modoVisitante"] === "true") {
    document.getElementById("ranking").textContent = "Estudante";
    document.getElementById("ranking-anterior").textContent = "Aprendiz";
    document.getElementById("ranking-proximo").textContent = "Sábio";
    document.getElementById("barra-progresso").style.width = 50 + "%";
    return
  }

  // Declara as variáveis que serão úteis
  const info_ranking_atual = obterInfoRankingAtual();
  rankings_usuario[tema_atual] = info_ranking_atual.ranking
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
  let intervalo;
  if (ranking_proximo) {
    intervalo = ranking_proximo.pontos_minimos - info_ranking_atual.pontos_minimos;
  }
  else {
    intervalo = info_ranking_atual.pontos_maximos - info_ranking_atual.pontos_minimos;
  }
  progresso = ((pontuacao - info_ranking_atual.pontos_minimos) / intervalo) * 100;
  progresso = Math.min(100, Math.max(0, progresso));

  // Atualiza a interface
  document.getElementById("ranking").textContent = info_ranking_atual.ranking;
  document.getElementById("ranking-anterior").textContent = ranking_anterior;
  document.getElementById("ranking-proximo").textContent = ranking_proximo ? ranking_proximo.ranking : "";
  document.getElementById("barra-progresso").style.width = progresso + "%";
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
      // Caso o usuário tenha enviado uma resposta vazia numa pergunta discursiva
      if (resposta_usuario === "" && tipo_pergunta === 'discursiva') {
        pontos_ganhos = regras_usuario.pontos_pular_pergunta;
      } 
      else {
        pontos_ganhos = regras_usuario.pontos_erro;
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
      default:
          console.warn("Dificuldade desconhecida:", dificuldade);
          return 0;
  }

  let pontos_ganhos = pontosBase;

  if (dica_gasta && tipo_pergunta === 'discursiva') {
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
      const id_pergunta = pergunta_selecionada.id_pergunta;
      const versao_pergunta = pergunta_selecionada.versao_pergunta;

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
          estrelas: valor,
          versao_pergunta: versao_pergunta,
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

async function enviarResposta(pulando = false) {
  if (pulando) {
    caixa_para_resposta.value = "";
  }
  // Desativa caixa de texto da resposta
  caixa_para_resposta.disabled = true;

  function armazenarDicaENota(nota) {
    
    let perguntas = JSON.parse(localStorage.getItem("perguntas")) || [];

    // Procura a pergunta pelo id
    let pergunta = null;
    try {
      pergunta = perguntas[pergunta_selecionada.dificuldade].find(p => p.id_pergunta === pergunta_selecionada.id_pergunta);
    }
    finally{
      if (!pergunta) {
        resultado.style.color = "red"
        resultado.textContent = 'Não foi possível fazer o envio da resposta'
        return
      }
      
      // Atualiza nota e resposta correta da pergunta
      if (pergunta) {
        pergunta.nota = pergunta_selecionada.nota = nota;
        if (tipo_pergunta === 'objetiva') {
          pergunta.resposta_correta = pergunta_selecionada.resposta_correta;
        }
        else {
          pergunta.respostas_corretas = pergunta_selecionada.respostas_corretas
        }
      }

      // Salva de volta
      localStorage.setItem("perguntas", JSON.stringify(perguntas));
    }
  }

  function mostrarResultadoResposta(correto, pontos_ganhos) {
    // ATENÇÃO: TALVEZ SÓ SEJA NECESSÁRIO OS PONTOS_GANHOS AQUI E NÃO A BOOLEANA CORRETO
    resultado.style.display = "block";
    if (tipo_pergunta === 'discursiva') {

      // mostra as possibilidades de respostas corretas para a pergunta
      const respostas_corretas = pergunta_selecionada.respostas_corretas
      mostrarRespostasAceitas(respostas_corretas);

      // Exibe dica
      mostrarDica()
    }

    // Exibe nota, curiosidade ou explicação
    if (pergunta_selecionada.nota?.trim()) {
      let textoFormatado = pergunta_selecionada.nota.replace(/^(Nota:|Explicação:|Curiosidade:)/i, '<strong>$1</strong>');
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

  // Chama as estrelas de feedback e carrega as anteriores enviadas pelo usuário caso esteja no modo Revisão
  if (sessionStorage.getItem("modoVisitante") === "false") {
    if (modo_jogo === "revisao") {
      const avaliacao_anterior = pergunta_selecionada.estrelas || 0;
      renderizarEstrelas(avaliacao_anterior);
    }
    document.getElementById("avaliacao").style.display = "block";
  }

  // Exibe os comentários dos outros usuários
  document.getElementById('comentarios').style.display = 'block';

  // Exibe os pontos ganhos ou perdidos
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

  resultado.style.display = "block";
  if (!animacao_concluida || btn_enviar.disabled) return;
  resultado.style.color = "#FFD700";
  resultado.innerHTML = 'Enviando resposta...';
  btn_enviar.disabled = true;

  let resposta_usuario;
  let acertou;
  let prosseguir_com_resultado = true;
  let pontos_ganhos = 0;
  let respostas_corretas;
  let letra_correta;

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
        armazenarDicaENota(info_pergunta["nota"]);
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
  // Caso das perguntas discursivas
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
        armazenarDicaENota(info_pergunta["nota"]);
      }
      else {
        return;
      }
    }
    acertou = respostaDiscursivaCorreta(resposta_usuario, respostas_corretas);
  }

  if (modo_jogo === 'desafio') {
    
    pontos_ganhos = calcularPontuacao(acertou);
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
    );
    // Armazena informações que serão úteis depois na tela de resultado
    if (prosseguir_com_resultado) {
      let info_resposta;
      if (tipo_pergunta === 'discursiva') {
        info_resposta = {"enunciado": pergunta_selecionada.enunciado, "respostas_aceitas": respostas_corretas, "resposta_usuario": resposta_usuario, "usou_dica": dica_gasta, "pontos_ganhos": pontos_ganhos, "dificuldade": pergunta_selecionada.dificuldade}
      }
      else {
        info_resposta = {"enunciado": pergunta_selecionada.enunciado, "alternativa_a": pergunta_selecionada.alternativa_a, "alternativa_b": pergunta_selecionada.alternativa_b, "alternativa_c": pergunta_selecionada.alternativa_c, "alternativa_d": pergunta_selecionada.alternativa_d, "resposta_correta": letra_correta, "resposta_usuario": resposta_usuario, "pontos_ganhos": pontos_ganhos, "dificuldade": pergunta_selecionada.dificuldade}
      }
      perguntas_respondidas.push(info_resposta)
    }
  }

  if (prosseguir_com_resultado) {
    mostrarResultadoResposta(acertou, pontos_ganhos);
    mostrarBotoesAcao();
  } 
  else {
    resultado.style.color = "red";
    resultado.innerHTML = 'Não foi possível se conectar com o servidor';
    btn_enviar.disabled = false;
  }
}

function esconderRespostasAceitas() {
  document.getElementById("respostas-aceitas-box").style.display = "none";
}

function finalizarQuiz() {
  if (sessionStorage["modoVisitante"] === "true") {
    window.location.href = "/home";
  }
  else if (modo_jogo === 'desafio') {
    localStorage.setItem("perguntas_respondidas", JSON.stringify(perguntas_respondidas));
    localStorage.setItem("rankings_usuario", JSON.stringify(rankings_usuario));
    window.location.href = "/resultado";
  }
  else {
    window.location.href = "/pesquisa";
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
      await sleep(VELOCIDADE_LETRA); // velocidade da letra
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
  
  // Exibe o botão enviar após tudo    
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
  
  dificuldades_permitidas = obterDificuldadesDisponiveis()
  ha_perguntas_disponiveis = dificuldades_permitidas.some(dif => perguntas_por_dificuldade[dif].length > 0)
  const encerrar_quiz = deveEncerrarQuiz(perguntas_por_dificuldade)

  // Mostrar apenas o botão Finalizar
  if (encerrar_quiz || !ha_perguntas_disponiveis || localStorage.getItem("perguntas_restantes") <= 0) {
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

function mostrarEnunciado(texto, elemento, callback) {
  elemento.textContent = "";
  let i = 0;
  const intervalo = setInterval(() => {
    if (i < texto.length) {
      elemento.textContent += texto[i];
      i++;
    } 
    else {
      clearInterval(intervalo);
      if (tipo_pergunta === 'discursiva') {
        animacao_concluida = true
        inicio_pergunta = Date.now()
        caixa_para_resposta.focus()
        botoes_enviar_div.style.display = "flex";
        btn_enviar.style.display = "inline-flex";
        btn_pular.style.display = "inline-flex"
        btn_enviar.disabled = false;
        if (callback) callback();
      } else {
        mostrarAlternativas()
      }
    }
  }, VELOCIDADE_LETRA); // velocidade da animação
}

function mostrarPergunta() {
  animacao_concluida = false;
  botoes_enviar_div.style.display = "none";
  btn_enviar.disabled = true;

  function escolherProximaDificuldade() {
    const ranking = obterInfoRankingAtual().ranking;
    const disponiveis = obterDificuldadesDisponiveis();
    const probsBase = PROBABILIDADES_POR_RANKING[ranking];

    const estoque = {
      "Fácil": perguntas_por_dificuldade["Fácil"]?.length || 0,
      "Médio": perguntas_por_dificuldade["Médio"]?.length || 0,
      "Difícil": perguntas_por_dificuldade["Difícil"]?.length || 0,
    };

    console.log("Estoque: ", estoque)

    // 🔥 1. FORÇAGEM POR ESTOQUE
    if (respostasDesdeUltimaForcagem === 5) {
      console.log("Pegando a dificuldade com maior estoque...")
      // Põe as dificuldades em ordem descrescente de estoque
      const ordenadas = [...disponiveis].sort(
        (a, b) => estoque[b] - estoque[a]
      );

      let escolhida = ordenadas[0]; // Pega a que tem o maior estoque

      if ((probsBase[escolhida] ?? 0) <= 0.10 && ordenadas[1]) {
        console.log("Pegarei a segunda com maior estoque")
        escolhida = ordenadas[1];
      }

      respostasDesdeUltimaForcagem = 1;
      return resolverFallback(escolhida, estoque, probsBase, disponiveis);
    }

    // 🎯 2. SORTEIO PROBABILÍSTICO NORMAL
    const sorteio = Math.random(); // Número de 0 e 1
    console.log("Sorteio foi: ", sorteio)
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
    if (estoque[escolhida] > 0) return escolhida;

    // ❌ Difícil ou Fácil sem estoque → tenta Médio
    if ((escolhida === "Difícil" || escolhida === "Fácil") && estoque["Médio"] > 0) {
      console.log("O substituto correto para este caso é o nível médio")
      return "Médio";
    }

    // ❌ Médio sem estoque
    if (escolhida === "Médio") {
      const pDif = probsBase["Difícil"] ?? 0;
      const pFac = probsBase["Fácil"] ?? 0;

      // Caso em que a diferença entre as probabilidades de pegar uma fácil ou difícil seja maior do que 10%
      if (Math.abs(pDif - pFac) > 0.1) { 
        console.log("Retornarei a dificuldade com maior probabilidade")
        const preferida = pDif > pFac ? "Difícil" : "Fácil";
        if (estoque[preferida] > 0) return preferida;  // Retorna a que tem maior probabiliddade
      }
      // Probabilidades próximas → usa estoque
      else {
        console.log("2. Retornarei a dificuldade com maior estoque")
        return estoque["Difícil"] >= estoque["Fácil"] ? "Difícil" : "Fácil";
      }
    }

    // Último recurso
    console.log("Último recurso do fallback")
    return disponiveis.find(d => estoque[d] > 0) ?? null;
  }
  const dificuldade_selecionada = escolherProximaDificuldade();

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
  mostrarEnunciado(pergunta_selecionada.enunciado, enunciadoElemento);

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

  ranking_usuario = obterInfoRankingAtual().ranking
  if (sessionStorage["modoVisitante"] === "false") {
    regras_usuario = regras_pontuacao.find(r => r.ranking === ranking_usuario); // Estas regras do usuário, assim como o ranking_usuario são utilizadas na parte de calcular pontos também, portanto cuidado ao apagar aqui
  }

  if (tipo_pergunta.toLowerCase() === 'discursiva') {
    // Ativa e esvazia a caixa de texto 
    caixa_para_resposta.disabled = false;
    caixa_para_resposta.value = "";
  
    if (!regras_usuario) {
          console.error("Ranking do usuário não encontrado nas regras de pontuação.");
          return 0;
    }

    // Decide se deve mostrar o ícone de dica
    let dica_permitida = true
    if (sessionStorage["modoVisitante"] === "false") { // Modo com conta
      if (pergunta_selecionada.dificuldade === 'Fácil' && regras_usuario.pontos_acerto_facil <= 10 || pergunta_selecionada.dificuldade === 'Médio' && regras_usuario.pontos_acerto_medio <= 10 || !pergunta_selecionada.dica) {
        dica_permitida = false
      }
    }
    else { // Modo visitante
      if (!pergunta_selecionada.dica) {
        dica_permitida = false
      }
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
      document.getElementById("contador-dicas").textContent = ''
    }
    dica_box.style.display = "none"
  } 

  resultado.style.display = "none";
  document.getElementById("avaliacao").style.display = "none";
  document.getElementById("nota-box").style.display = "none";
  aguardando_proxima = false;

  // Resetar estrelas
  document.querySelectorAll(".estrela").forEach(e => {
  e.textContent = "☆";
  e.classList.remove("dourada");

  esconderRespostasAceitas()
  });
}

function mostrarRespostasAceitas(lista) {
  try {
    const container = document.getElementById("respostas-aceitas-box");
    const lista_respostas_aceitas = document.getElementById("lista-respostas");
    lista_respostas_aceitas.textContent = lista.join(" / ");
    container.style.display = "block";
  }
  catch (err) {
    console.log("Erro ocorrido ao tentar mostrar respostas aceitas:")
    console.log(err)
  }
}

function proximaPergunta() {
  lbl_pontos_ganhos.style.display = 'none'
  if (ha_perguntas_disponiveis) {
    if (tipo_pergunta === 'objetiva') {
      resetarAlternativas();
    } 
    else {
      dica_box.style.display = "none"
      caixa_para_resposta.value = "";
    }
    mostrarPergunta();
    document.getElementById('botoes-acao').style.display = "none";
    document.getElementById("avaliacao").style.display = "none";
    resultado.style.display = "none";
    document.getElementById("nota-box").style.display = "none";
    document.getElementById('comentarios').style.display = 'none';
    //document.getElementById("btn-enviar").style.display= "inline-block";
    aguardando_proxima = false;
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

  } 
  catch (err) {
    console.error('Erro na comunicação:', err);
    return false;
  }
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
  const stopwords = ["a", "o", "os", "as", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "por", "com", "para", "um", "uma", "uns", "umas", "ao", "aos", "à", "às"];

  function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

  function limparTexto(texto) {
    return normalizarNotacaoQuimica(texto)
      .trim()
      .toLowerCase()
      .replace(/[.\-:!;?]/g, " ")
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
    if (len <= 9) return dist === 1;
    return dist <= 2;
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
    let dicas_restantes = parseInt(localStorage.getItem("dicas_restantes") || "0");
    if (dicas_restantes <= 0) {
      return;
    }
    const response = await fetchAutenticado("/usar_dica")
    if (response.ok) {
      dicas_restantes -= 1;
      localStorage.setItem("dicas_restantes", dicas_restantes);
      document.getElementById("contador-dicas").textContent = dicas_restantes;
      mostrarDica();
    }
  }
  else {
    mostrarDica();
  }
}

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
  callbackAtualizarUI (pontuacoes_usuario[tema_atual])
  atualizarRankingVisual();
  mostrarPergunta();
  configurarEstrelas();
});
