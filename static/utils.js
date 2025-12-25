export function deveEncerrarQuiz(perguntas_por_dificuldade) {
  const ranking = obterInfoRankingAtual().ranking;

  const qtdFacil = perguntas_por_dificuldade["Fácil"]?.length ?? 0;
  const qtdMedio = perguntas_por_dificuldade["Médio"]?.length ?? 0;
  const qtdDificil = perguntas_por_dificuldade["Difícil"]?.length ?? 0;

  // 🧠 SÁBIO ou LENDA
  // Encerra se NÃO houver nenhuma média nem difícil
  if (ranking === "Sábio" || ranking === "Lenda") {
    if (qtdMedio === 0 && qtdDificil === 0) {
      return true;
    }
  }

  // 🧑‍🎓 APRENDIZ
  // Encerra se SÓ houver difíceis
  if (ranking === "Aprendiz") {
    if (qtdFacil === 0 && qtdMedio === 0) {
      return true;
    }
  }

  return false;
}

export async function fetchAutenticado(url, options= {}) {
  const token = sessionStorage.getItem("token_sessao")
  const config = {
    method: options.method || "GET",
    headers: {"Authorization": `Bearer ${token}`,
    ...(options.body? {"Content-Type": "application/json"}: {})
  },
  ...(options.body? {body:JSON.stringify(options.body)}: {})
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    localStorage.setItem("auth_message", "Sessão expirada");
    window.location.href = "/login";
  }

  return response;
}

export function obterInfoRankingAtual(tema=null) {
  const pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario")) || {}
  const tema_atual = tema || localStorage.getItem("tema_atual");
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
  const dificuldades_disponiveis = ['Fácil'];
  if (sessionStorage["modoVisitante"] === "false") {
    // Obtém a informação de ranking atual do usuário
    const info_ranking_atual = obterInfoRankingAtual();

    // Define as dificuldades de perguntas disponíveis de acordo com o ranking atual
    if (info_ranking_atual.pode_receber_medio) {
      dificuldades_disponiveis.push('Médio');
    }
    if (info_ranking_atual.pode_receber_dificil) {
      dificuldades_disponiveis.push('Difícil');
    }
  }
  else {
    dificuldades_disponiveis.push('Médio');
    dificuldades_disponiveis.push('Difícil');
  }
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
