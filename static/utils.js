

export function obterInfoRankingAtual() {
  const pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario")) || {}
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

export function obterDificuldadesDisponiveis() {
  // Obtém a informação de ranking atual do usuário
  const info_ranking_atual = obterInfoRankingAtual();

  // Define as dificuldades de perguntas disponíveis de acordo com o ranking atual
  const dificuldades_disponiveis = ['Fácil'];
  if (info_ranking_atual.pode_receber_medio) {
    dificuldades_disponiveis.push('Médio');
  }
  if (info_ranking_atual.pode_receber_dificil) {
    dificuldades_disponiveis.push('Difícil');
  }
  return dificuldades_disponiveis
}
