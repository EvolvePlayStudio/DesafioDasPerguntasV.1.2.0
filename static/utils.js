export const temas_disponiveis = ["Artes", "Astronomia", "Biologia", "Esportes", "Filosofia", "Geografia", "História", "Mídia", "Música", "Química", "Tecnologia", "Variedades"];

export function detectarModoTela() {
  // Identifica se o usuário us modo site para computador
  const largura = window.innerWidth;
  const touch = navigator.maxTouchPoints > 0;

  if (touch && largura >= 980) return "mobile_desktop_mode";
  if (touch && largura < 980) return "mobile_normal";
  if (!touch) return "desktop";
}

export function deveEncerrarQuiz(perguntas_por_dificuldade, MODO_VISITANTE_ANTIGO=null) {
  // ATENÇÃO, APAGAR PARÂMETRO ACIMA QUE NÃO É UTILIZADO DEPOIS QUE REMOVER DE TODAS AS FUNÇÕES EM QUIZ.JS E HOME.JS
  const tema = localStorage.getItem("tema_atual");
  const MODO_VISITANTE = localStorage.getItem("modoVisitante");
  const ranking = obterInfoRankingAtual(tema, MODO_VISITANTE).ranking;

  const qtdFacil = perguntas_por_dificuldade["Fácil"]?.length ?? 0;
  const qtdMedio = perguntas_por_dificuldade["Médio"]?.length ?? 0;
  const qtdDificil = perguntas_por_dificuldade["Difícil"]?.length ?? 0;
  const qtdExtremo = perguntas_por_dificuldade["Extremo"]?.length ?? 0;

  const apenasFaceis = qtdMedio === 0 && qtdDificil === 0 && qtdExtremo === 0;
  const apenasMedias = qtdFacil === 0 && qtdDificil === 0 && qtdExtremo === 0;
  const apenasDificeis = qtdFacil === 0 && qtdMedio === 0 && qtdExtremo === 0;
  const apenasExtremas = qtdFacil === 0 && qtdMedio === 0 && qtdDificil === 0;
  const apenasDificeisOuExtremas = qtdFacil === 0 && qtdMedio === 0;
  const apenas_1_nivel = apenasFaceis || apenasMedias || apenasDificeis || apenasExtremas;

  if (!MODO_VISITANTE) {
    // Não permite prosseguir se houver apenas 1 nível de dificuldade
    if (apenas_1_nivel) {
      return true;
    }
    
    // 🧑‍🎓 APRENDIZ: encerra se SÓ houverem difíceis e extremas
    if (ranking === "Aprendiz" && apenasDificeisOuExtremas) return true;

    // 🧠 SÁBIO: encerra se Só houverem fáceis e extremas
    if (ranking === "Sábio" && qtdMedio === 0 && qtdDificil === 0) return true;

    // 🔥 Lenda: encerra se NÃO houverem difíceis ou extremas
    if (ranking === "Lenda" && qtdDificil === 0 && qtdExtremo === 0) return true;
  }
  else if (ranking === "Iniciante" && apenasDificeisOuExtremas) return true;
  
  return false;
}

export async function fetchAutenticado(url, options = {}) {
  const token = sessionStorage.getItem("token_sessao");

  const config = {
    method: options.method || "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  const response = await fetch(url, config);

  // 🔐 Sessão expirada
  if (response.status === 401) {
    localStorage.setItem(
      "auth_message",
      "Sessão expirada"
    );
    window.location.href = "/login";
    return;
  }

  // 🚧 Site em manutenção
  if (response.status === 503) {
    localStorage.setItem(
      "auth_message",
      "Site em manutenção"
    );
    window.location.href = "/login";
    return;
  }

  // ❗ Erro interno → deixa o chamador decidir
  return response;
}

// ATENÇÃO: PARAMÊTRO NÃO UTILIZADO AQUI
export function obterInfoRankingAtual(tema=null, MODO_VISITANTE=null) {
  const pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario")) || {};
  const tema_atual = localStorage.getItem("tema_atual");
  const pontuacao_no_tema = pontuacoes_usuario[tema_atual] || 0;
  const regras_pontuacao = JSON.parse(localStorage.getItem("regras_pontuacao")) || [];

  const info_ranking_atual = regras_pontuacao.find(regra =>
    pontuacao_no_tema >= regra.pontos_minimos && pontuacao_no_tema <= regra.pontos_maximos
  );

  return info_ranking_atual || (regras_pontuacao.length > 0 ? regras_pontuacao[0] : null);
}

export function obterPerguntasDisponiveis(perguntas_por_dificuldade) {
  // Analisa as dificuldades disponíveis de acordo com o ranking atual do usuário
  const dificuldades_disponiveis = obterDificuldadesDisponiveis()
  
  // Identifica as perguntas disponíveis para o usuário de acordo com as dificuldades disponíveis
  const perguntas_filtradas = {}
  dificuldades_disponiveis.forEach(dif => {
    if (Array.isArray(perguntas_por_dificuldade[dif]) &&
    perguntas_por_dificuldade[dif].length > 0) {
    perguntas_filtradas[dif] = perguntas_por_dificuldade[dif];
    }
  });
  return perguntas_filtradas
}

export function obterDificuldadesDisponiveis(tema=null, MODO_VISITANTE=null) {
  // Obtém a informação de ranking atual do usuário
  const info_ranking_atual = obterInfoRankingAtual();

  // Define as dificuldades de perguntas disponíveis de acordo com o ranking atual
  const dificuldades_disponiveis = ['Fácil'];
  if (info_ranking_atual.pode_receber_medio) dificuldades_disponiveis.push('Médio');
  if (info_ranking_atual.pode_receber_dificil) dificuldades_disponiveis.push('Difícil');
  if (info_ranking_atual.pode_receber_extremo) dificuldades_disponiveis.push('Extremo');

  return dificuldades_disponiveis
}

export function exibirMensagem(label, texto, cor, temporaria=true, remover_display=false) {
  label.style.display = ''
  label.style.color = cor;
  label.textContent = texto;
  label.style.opacity = 1
  if (temporaria) {
    setTimeout(() => {
        label.style.opacity = 0
        if (remover_display) {
          label.style.display = 'none'
        }
      }, 10000)
  }
}
