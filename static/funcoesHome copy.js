import { temas_disponiveis, simbolosTemas } from "./utils.js";

// FUNÇÕES E VARIÁVEIS USADAS EM VÁRIAS MISSÕES
const NIVEIS_PERMITIDOS_POR_RANKING = {
  Iniciante: ["Fácil", "Médio"],
  Aprendiz: ["Fácil", "Médio", "Difícil"],
  Estudante: ["Médio", "Difícil"],
  Sábio: ["Difícil"], // Pode permitir Extremo no futuro para quem tem mais do que 4500 pontos
  Lenda: ["Difícil", "Extremo"]
};

function sortearPorcentagemAcerto(nivelPergunta, min = 40, max = 80, passo = 10) {
  const minEfetivo = nivelPergunta === "Fácil" ? 70 : min; // Evita porcentagens abaixo de 70% para o Fácil, que deixaria a missão trivial
  const maxEfetivo = nivelPergunta === "Extremo" ? 50 : max;
  const multiplos = [];
  const inicio = Math.ceil(minEfetivo / passo) * passo;

  for (let valor = inicio; valor <= maxEfetivo; valor += passo) multiplos.push(valor);
  if (multiplos.length === 0) return minEfetivo;

  const indice = Math.floor(Math.random() * multiplos.length);
  return multiplos[indice];
}

function classificarDificuldadeMissaoPorcentagem(nivelPergunta, porcentagem) {
  // Serve tanto para definir a dificuldade da missão global quanto para a temática
  switch (nivelPergunta) {
    case "Fácil":
      return "Fácil"; // 70% e 80% nas fáceis classifica como nível fácil

    case "Médio":
      return porcentagem <= 60 ? "Fácil" : "Médio"; // 70% e 80% das médias classifica como nível médio

    case "Difícil":
      return porcentagem <= 50 ? "Médio" : "Difícil"; // 60%, 70% e 80% das difíceis classifica como nível difícil

    case "Extremo":
      return "Difícil";

    default:
      return "Médio";
  }
}

// FUNÇÕES E VARIÁVEIS USADAS NAS MISSÕES GLOBAIS DE ATINGIR PORCENTUAL TOTAL DE ACERTOS
const PONTUACAO_MAXIMA_GLOBAL_MISSAO = 60000;
const LIMITE_PERGUNTAS_MISSAO_PROGRESSO = 30;
const ESTOQUE_MINIMO_GLOBAL_PROGRESSO = 25;

function sortearIncrementoProgresso(min = 1, max = 4) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sortearLimitePerguntasProgresso(min = 20, max = 30, passo = 5) {
  const opcoes = [];
  for (let v = min; v <= max; v += passo) {
    opcoes.push(v);
  }
  if (opcoes.length === 0) return LIMITE_PERGUNTAS_MISSAO_PROGRESSO;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

function classificarDificuldadeMissaoProgresso(deltaPct, pontosTotais) { // Falta analisar aqui
  if (deltaPct >= 3) {
    return pontosTotais > 10000 ? "Difícil" : "Médio";
  }

  if (deltaPct < 2) {
    if (pontosTotais < 5000) return "Fácil";
    if (pontosTotais > 40000) return "Difícil";
    return "Médio";
  }

  // Faixa intermediária (2% a < 3%)
  if (pontosTotais > 40000) return "Difícil";
  if (pontosTotais < 5000) return "Fácil";
  return "Médio";
}

function criarMissaoGlobalProgresso(estoques, pontuacoesUsuario, pontuacaoMaximaGlobal = PONTUACAO_MAXIMA_GLOBAL_MISSAO) {
  if (!estoques || typeof estoques !== "object" || !pontuacoesUsuario) {
    return [];
  }

  const estoqueGlobalTotal = temas_disponiveis.reduce((acc, tema) => {
    const e = estoques[tema] || {};
    return (
      acc +
      (Number(e["Fácil"]) || 0) +
      (Number(e["Médio"]) || 0) +
      (Number(e["Difícil"]) || 0) +
      (Number(e["Extremo"]) || 0)
    );
  }, 0);

  if (estoqueGlobalTotal < ESTOQUE_MINIMO_GLOBAL_PROGRESSO) {
    return [];
  }

  const pontosTotais = temas_disponiveis.reduce(
    (acc, tema) => acc + (Number(pontuacoesUsuario[tema]) || 0),
    0
  );

  const progressoAtualExato = Math.min(
    100,
    Math.max(0, (pontosTotais / pontuacaoMaximaGlobal) * 100)
  );

  // Evita gerar missão de progresso se já estiver em 100%
  if (progressoAtualExato >= 100) {
    return [];
  }

  const incrementoSorteado = sortearIncrementoProgresso(1, 4);
  let metaPorcentagem = Math.round(progressoAtualExato + incrementoSorteado);

  // Garante ganho de pelo menos 1 ponto percentual inteiro em relação ao progresso atual
  if (metaPorcentagem - progressoAtualExato < 1) {
    metaPorcentagem = Math.ceil(progressoAtualExato + 1);
  }

  metaPorcentagem = Math.min(100, metaPorcentagem);
  if (metaPorcentagem <= Math.round(progressoAtualExato)) {
    return [];
  }

  const deltaPctReal = metaPorcentagem - progressoAtualExato;
  const limitePerguntas = sortearLimitePerguntasProgresso(20, 30, 5);
  const dificuldade = classificarDificuldadeMissaoProgresso(deltaPctReal, pontosTotais);

  return [
    {
      id: `g_progresso_${metaPorcentagem}_max_${limitePerguntas}`,
      descricao: `Obtenha ${metaPorcentagem}% de progresso total respondendo no máximo ${limitePerguntas} perguntas`,
      dificuldade
    }
  ];
}

// VARIÁVEIS E FUNÇÕES DAS MISSÕES GLOBAIS DE ACERTAR PORCENTAGEM EM NÍVEL ESPECÍFICO
const QUANTIDADE_PERGUNTAS_MISSAO_GLOBAL_NIVEL = 10;
const ESTOQUE_MINIMO_GLOBAL_NIVEL = 15;

function extrairRankingDeInfo(infoRanking) {
  if (!infoRanking) return null;
  if (typeof infoRanking === "string") return infoRanking;
  return (
    infoRanking.ranking ??
    infoRanking.nivel ??
    infoRanking.faixa ??
    infoRanking.titulo ??
    infoRanking.nome ??
    null
  );
}

function obterRankingDoTema(pontos) {
  const info = obterProgressoRankingPorPontos(pontos);
  return normalizarRanking(extrairRankingDeInfo(info)) || "Iniciante";
}

function nivelPermitidoNoRanking(ranking, nivel) {
  const permitidos = NIVEIS_PERMITIDOS_POR_RANKING[ranking];
  return Array.isArray(permitidos) && permitidos.includes(nivel);
}

function escolherNivelMissaoGlobalPorcentagemAcertos(estoques, pontuacoesUsuario) {
  if (!estoques || typeof estoques !== "object") {
    return null;
  }

  const detalhesTemas = temas_disponiveis.map(tema => {
    const pontos = Number(pontuacoesUsuario?.[tema]) || 0;
    const ranking = obterRankingDoTema(pontos);
    const estoqueNivel = estoques?.[tema] || {};
    return { tema, ranking, estoqueNivel };
  });

  const elegiveis = [];

  for (const nivel of ["Fácil", "Médio", "Difícil", "Extremo"]) {
    const temasElegiveis = detalhesTemas.filter(t => nivelPermitidoNoRanking(t.ranking, nivel));
    const estoqueDisponivel = temasElegiveis.reduce(
      (acc, item) => acc + (Number(item.estoqueNivel?.[nivel]) || 0),
      0
    );

    if (temasElegiveis.length >= 2 && estoqueDisponivel >= ESTOQUE_MINIMO_GLOBAL_NIVEL) {
      elegiveis.push({ nivel, estoqueDisponivel });
    }
  }

  if (elegiveis.length === 0) {
    return null;
  }

  // Pega os 2 níveis com maior estoque somado e sorteia 1 entre eles
  const top2Estoques = [...elegiveis]
    .sort((a, b) => b.estoqueDisponivel - a.estoqueDisponivel)
    .slice(0, 2);

  console.log("Os 2 níveis com maior estoque são:", top2Estoques);

  return top2Estoques[Math.floor(Math.random() * top2Estoques.length)];
}

function criarMissaoGlobalAcertarNivel(estoques, pontuacoesUsuario) {
  const escolhido = escolherNivelMissaoGlobalPorcentagemAcertos(estoques, pontuacoesUsuario);

  if (!escolhido) {
    return [];
  }

  const porcentagem = sortearPorcentagemAcerto(escolhido.nivel, 40, 70, 10);
  const acertos = Math.round((porcentagem / 100) * QUANTIDADE_PERGUNTAS_MISSAO_GLOBAL_NIVEL);
  const dificuldade = classificarDificuldadeMissaoPorcentagem(escolhido.nivel, porcentagem);

  return [
    {
      id: `g_pct_nivel_${escolhido.nivel.toLowerCase()}`,
      descricao: `Acerte ${acertos}/${QUANTIDADE_PERGUNTAS_MISSAO_GLOBAL_NIVEL} perguntas de nível ${escolhido.nivel} em qualquer tema`,
      dificuldade
    }
  ];
}

// VARIÁVEIS E FUNÇÕES DAS MISSÕES TEMÁTICAS DE ACERTAR PORCENTAGEM EM NÍVEL ESPECÍFICO
const LIMITE_PERGUNTAS_MISSAO_RANKING = 25;
const QUANTIDADE_PERGUNTAS_MISSAO_NIVEL = 10;

function escolherNivelComMaiorEstoque(estoquesTema, ranking) {
  const permitidos = NIVEIS_PERMITIDOS_POR_RANKING[ranking] || [];
  if (permitidos.length === 0 || !estoquesTema) return null;

  let melhorNivel = null;
  let maiorEstoque = 0;

  for (const nivel of permitidos) {
    const qtd = Number(estoquesTema[nivel]) || 0;
    if (qtd >= QUANTIDADE_PERGUNTAS_MISSAO_NIVEL + 2 && qtd > maiorEstoque) {
      maiorEstoque = qtd;
      melhorNivel = nivel;
    }
  }

  return melhorNivel ? { nivel: melhorNivel, estoqueNivel: maiorEstoque } : null;
}

function criarMissaoTematicaAcertarPorcentagemNivel(temasElegiveis, estoques, quantidade = 2) {
  if (!Array.isArray(temasElegiveis) || temasElegiveis.length === 0 || !estoques) {
    return [];
  }

  const candidatos = temasElegiveis
    .map(item => {
      const escolhaNivel = escolherNivelComMaiorEstoque(estoques[item.tema], item.ranking);
      if (!escolhaNivel) return null;

      const porcentagem = sortearPorcentagemAcerto(escolhaNivel.nivel, 40, 70, 10);
      const dificuldade = classificarDificuldadeMissaoPorcentagem(escolhaNivel.nivel, porcentagem);

      return {
        ...item,
        nivelPergunta: escolhaNivel.nivel,
        estoqueNivel: escolhaNivel.estoqueNivel,
        porcentagem,
        dificuldade
      };
    })
    .filter(Boolean);

  if (candidatos.length === 0) {
    return [];
  }

  // Prioriza temas com maior estoque no nível escolhido e sorteia entre os top 4
  const top4 = [...candidatos]
    .sort((a, b) => b.estoqueNivel - a.estoqueNivel)
    .slice(0, 4);

  const escolhidos = [...top4]
    .sort(() => Math.random() - 0.5)
    .slice(0, quantidade);

  return escolhidos.map((item, idx) => {
    const acertosNecessarios = Math.round(
      (item.porcentagem / 100) * QUANTIDADE_PERGUNTAS_MISSAO_NIVEL
    );
    const iconeTema = simbolosTemas?.[item.tema] ? `${simbolosTemas[item.tema]} ` : "";

    return {
      id: `t_pct_nivel_${item.tema}_${idx + 1}`,
      descricao: `Acerte ${acertosNecessarios}/${QUANTIDADE_PERGUNTAS_MISSAO_NIVEL} perguntas de nível ${item.nivelPergunta} em ${iconeTema}${item.tema}`,
      dificuldade: item.dificuldade
    };
  });
}

// VARIÁVEIS E FUNÇÕES DAS MISSÕES TEMÁTICAS DE ATINGIR PRÓXIMO RANKING
const PONTOS_MINIMOS_NO_RANKING = {
  Iniciante: 0,
  Aprendiz: 1300,
  Estudante: 2450,
  Sábio: 3600
};
const PONTOS_MAXIMOS_NO_RANKING = {
  Iniciante: 750,
  Aprendiz: 1750,
  Estudante: 2800,
  Sábio: 3800
};
const ORDEM_RANKINGS = ["Iniciante", "Aprendiz", "Estudante", "Sábio", "Lenda"];

function normalizarRanking(ranking) {
  if (!ranking || typeof ranking !== "string") return null;
  const limpo = ranking.trim().toLowerCase();
  return ORDEM_RANKINGS.find(r => r.toLowerCase() === limpo) ?? null;
}

function obterProximoRanking(rankingAtual) {
  const idx = ORDEM_RANKINGS.indexOf(rankingAtual);
  if (idx === -1 || idx >= ORDEM_RANKINGS.length - 1) {
    return null; // Já está no ranking máximo ou ranking não mapeado
  }
  return ORDEM_RANKINGS[idx + 1];
}

function avaliarElegibilidadeRanking(tema) {
  const proximoRanking = obterProximoRanking(tema.ranking);
  if (!proximoRanking) {
    return { elegivel: false, motivo: "sem_proximo_ranking_ou_ranking_invalido" };
  }

  const minimoNoRanking = PONTOS_MINIMOS_NO_RANKING[tema.ranking];
  if (typeof minimoNoRanking === "number" && tema.pontos < minimoNoRanking) {
    return { elegivel: false, motivo: `pontos_abaixo_do_minimo_${minimoNoRanking}` };
  }

  const maximoNoRanking = PONTOS_MAXIMOS_NO_RANKING[tema.ranking];
  if (typeof maximoNoRanking === "number" && tema.pontos > maximoNoRanking) {
    return { elegivel: false, motivo: `pontos_acima_do_maximo_${maximoNoRanking}` };
  }

  return { elegivel: true, proximoRanking };
}

function classificarDificuldadeMissaoRanking(item) {
  const pontos = Number(item?.pontos) || 0;

  switch (item?.ranking) {
    case "Iniciante":
      return pontos <= 300 ? "Médio" : "Fácil";
    case "Aprendiz":
      return pontos <= 1500 ? "Médio" : "Fácil";
    case "Estudante":
      return pontos <= 2600 ? "Difícil" : "Médio";
    case "Sábio":
      return "Difícil";
    default:
      return "Médio";
  }
}

function criarMissaoAtingirRanking(temasElegiveis, quantidade = 2) {
  if (!Array.isArray(temasElegiveis) || temasElegiveis.length === 0) {
    return [];
  }

  const avaliacoes = temasElegiveis.map(tema => {
    const aval = avaliarElegibilidadeRanking(tema);
    return {
      ...tema,
      proximoRanking: aval.proximoRanking ?? null,
      elegivel: aval.elegivel,
      motivo: aval.motivo ?? "ok"
    };
  });

  const candidatos = avaliacoes.filter(a => a.elegivel);

  console.log("Avaliação candidatos próximo ranking:", avaliacoes);
  console.log("Candidatos aprovados:", candidatos);

  if (candidatos.length === 0) {
    return [];
  }

  // Prioriza temas com maior estoque e sorteia entre os top 4
  const top4 = [...candidatos]
    .sort((a, b) => b.estoqueTotal - a.estoqueTotal)
    .slice(0, 4);

  const escolhidos = [...top4]
    .sort(() => Math.random() - 0.5)
    .slice(0, quantidade);

  return escolhidos.map((item, idx) => ({
    id: `t_ranking_${item.tema}_${idx + 1}`,
    descricao: `Atinja o ranking ${item.proximoRanking} em ${simbolosTemas[item.tema] || ""}${item.tema} em ${LIMITE_PERGUNTAS_MISSAO_RANKING} perguntas`,
    dificuldade: classificarDificuldadeMissaoRanking(item)
  }));
}

function coletarMissoesAteLimite(geradores, limite = 2) {
  const fila = [...geradores].sort(() => Math.random() - 0.5);
  const selecionadas = [];

  for (const gerar of fila) {
    if (selecionadas.length >= limite) break;
    const novas = gerar() || [];
    for (const missao of novas) {
      if (selecionadas.length >= limite) break;
      selecionadas.push(missao);
    }
  }

  return selecionadas;
}

function criarMissoesGlobais() {
  return [
    { id: "g1", descricao: "Alcançar 25% de progresso total respondendo no máximo 30 perguntas" },
    { id: "g2", descricao: "Responder 30 perguntas difíceis em qualquer tema, obtendo 40% de acertos" }
  ];
}

export function obterProgressoRankingPorPontos(pontos) {
  const regras = JSON.parse(localStorage.getItem("regras_pontuacao")) || [];
  const pontuacaoAtual = Number(pontos) || 0;

  if (regras.length === 0) {
    return {
      ranking: "Iniciante",
      pontos: pontuacaoAtual,
      proximoRanking: null,
      faltaPontos: null
    };
  }

  for (let i = 0; i < regras.length; i++) {
    const r = regras[i];
    if (pontuacaoAtual >= r.pontos_minimos && pontuacaoAtual <= r.pontos_maximos) {
      const proximo = regras[i + 1] || null;
      const metaProximo = proximo ? proximo.pontos_minimos : null;
      const faltaPontos = metaProximo !== null ? Math.max(0, metaProximo - pontuacaoAtual) : null;

      return {
        ranking: r.ranking,
        pontos: pontuacaoAtual,
        proximoRanking: proximo ? proximo.ranking : null,
        faltaPontos
      };
    }
  }

  const ultima = regras[regras.length - 1];
  return {
    ranking: ultima.ranking,
    pontos: pontuacaoAtual,
    proximoRanking: null,
    faltaPontos: null
  };
}

export function criarMissoes(estoques, pontuacoesUsuario) {
  const temasComEstoque = temas_disponiveis
    .map(tema => {
      const e = estoques[tema] || {};
      const estoqueTotal =
        (Number(e['Fácil']) || 0) +
        (Number(e['Médio']) || 0) +
        (Number(e['Difícil']) || 0) +
        (Number(e['Extremo']) || 0);

      const pontos = Number(pontuacoesUsuario[tema]) || 0;
      const infoRanking = obterProgressoRankingPorPontos(pontos);
      const rankingBruto = extrairRankingDeInfo(infoRanking);

      return {
        tema,
        estoqueTotal,
        pontos,
        ranking: normalizarRanking(rankingBruto)
      };
    })
    .filter(item => item.estoqueTotal >= LIMITE_PERGUNTAS_MISSAO_RANKING);

  const geradoresGlobais = [
    () => criarMissaoGlobalProgresso(estoques, pontuacoesUsuario),
    () => criarMissaoGlobalAcertarNivel(estoques, pontuacoesUsuario)
  ];

  const geradoresTematicos = [
    () => criarMissaoTematicaAcertarPorcentagemNivel(temasComEstoque, estoques, 2),
    () => criarMissaoAtingirRanking(temasComEstoque, 2)
  ];
  

  return {
    globais: coletarMissoesAteLimite(geradoresGlobais, 2),
    tematicas: coletarMissoesAteLimite(geradoresTematicos, 2)
  };
}