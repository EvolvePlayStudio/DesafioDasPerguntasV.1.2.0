import { temas_disponiveis, simbolosTemas } from "./utils.js";

const ORDEM_RANKINGS = ["Iniciante", "Aprendiz", "Estudante", "Sábio", "Lenda"];

const LIMITE_PERGUNTAS_MISSOES_RANKING = 25;

// Determina os pontos mínimos e máximos nos rankings para pegar missão de atingir próximo ranking
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
  if (typeof minimoNoRanking === "number" && tema.pontos > maximoNoRanking) {
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
    descricao: `Atinja o ranking ${item.proximoRanking} em ${simbolosTemas[item.tema] || ""}${item.tema} em ${LIMITE_PERGUNTAS_MISSOES_RANKING} perguntas`,
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
    .filter(item => item.estoqueTotal >= LIMITE_PERGUNTAS_MISSOES_RANKING);

  const geradoresGlobais = [
    () => criarMissoesGlobais()
  ];

  const geradoresTematicos = [
    () => criarMissaoAtingirRanking(temasComEstoque, 2)
  ];

  return {
    globais: coletarMissoesAteLimite(geradoresGlobais, 2),
    tematicas: coletarMissoesAteLimite(geradoresTematicos, 2)
  };
}