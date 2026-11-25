import { temas_disponiveis, simbolosTemas } from "./utils.js";

// CHAVE TEMPORÁRIA DE CONTROLE ("curta" | "longa") ENQUANTO A REGRA DE ENERGIA NÃO É LIGADA
const MODO_ENERGIA_MISSOES = "curta";

const CONFIG_DURACAO_MISSOES = {
  curta: {
    progressoIncrementoMin: 1,
    progressoIncrementoMax: 2,
    globalNivelQuantidade: 10,
    tematicaNivelQuantidade: 10
  },
  longa: {
    progressoIncrementoMin: 2,
    progressoIncrementoMax: 4,
    globalNivelQuantidade: 15,
    tematicaNivelQuantidade: 12
  }
};

function obterConfigDuracao() {
  return CONFIG_DURACAO_MISSOES[MODO_ENERGIA_MISSOES] || CONFIG_DURACAO_MISSOES.curta;
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

// FUNÇÕES E VARIÁVEIS USADAS EM VÁRIAS MISSÕES
const NIVEIS_PERMITIDOS_POR_RANKING = {
  Iniciante: ["Fácil", "Médio"],
  Aprendiz: ["Fácil", "Médio", "Difícil"],
  Estudante: ["Médio", "Difícil"],
  Sábio: ["Difícil"], // Pode permitir Extremo no futuro para quem tem mais do que 4500 pontos
  Lenda: ["Difícil", "Extremo"]
};

function formatarListaTemas(listaTemas) {
  const formatados = listaTemas.map(tema => `${simbolosTemas?.[tema] || ""}${tema}`);
  if (formatados.length <= 1) return formatados[0] || "";
  if (formatados.length === 2) return `${formatados[0]} ou ${formatados[1]}`;
  return `${formatados.slice(0, -1).join(", ")} ou ${formatados[formatados.length - 1]}`;
}

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
  switch (nivelPergunta) {
    case "Fácil":
      return "Fácil";

    case "Médio":
      return porcentagem <= 60 ? "Fácil" : "Médio";

    case "Difícil":
      return porcentagem <= 50 ? "Médio" : "Difícil";

    case "Extremo":
      return "Difícil";

    default:
      return "Médio";
  }
}

// 1. MISSÃO GLOBAL: ATINGIR PORCENTAGEM DE PROGRESSO TOTAL
const PONTUACAO_MAXIMA_GLOBAL_MISSAO = 60000;
const ESTOQUE_MINIMO_GLOBAL_PROGRESSO = 35;

function sortearIncrementoProgresso(min = 1, max = 5) {
  const minVal = Math.max(1, Number(min) || 1);
  const maxVal = Math.max(minVal, Number(max) || minVal);
  const passo = Number.isInteger(minVal) && Number.isInteger(maxVal) ? 1 : 0.5;

  const opcoes = [];
  for (let v = minVal; v <= maxVal + 1e-9; v += passo) {
    opcoes.push(Number(v.toFixed(1)));
  }

  if (opcoes.length === 0) return minVal;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

function calcularIncrementoMaximoProgresso(pontosTotais, estoqueGlobalTotal) {
  let maxPermitido = 5;

  // Em modo "curta", só permite até 5% se houver estoque folgado; caso contrário, limita a 3%
  if (MODO_ENERGIA_MISSOES === "curta" && estoqueGlobalTotal < 80) {
    maxPermitido = Math.min(maxPermitido, 3);
  }

  // Reduz o teto conforme o usuário já acumula mais pontos totais
  if (pontosTotais >= 35000) {
    maxPermitido = Math.min(maxPermitido, 2.5);
  } else if (pontosTotais >= 10000) {
    maxPermitido = Math.min(maxPermitido, 3.5);
  }

  return Math.max(1, maxPermitido);
}

function classificarDificuldadeMissaoProgresso(deltaPct, pontosTotais) {
  if (deltaPct >= 4) {
    return "Difícil";
  }

  if (deltaPct >= 3) {
    return pontosTotais > 5000 ? "Difícil" : "Médio";
  }

  if (deltaPct >= 2 && deltaPct < 3) {
    if (pontosTotais > 15000) return "Difícil";
    if (pontosTotais >= 5000 && pontosTotais <= 15000) return "Médio";
    return "Fácil";
  }

  if (deltaPct < 2) {
    if (pontosTotais < 10000) return "Fácil";
    if (pontosTotais > 30000) return "Difícil";
    return "Médio";
  }

  return "Médio";
}

function criarMissaoGlobalProgresso(estoques, pontuacoesUsuario, pontuacaoMaximaGlobal = PONTUACAO_MAXIMA_GLOBAL_MISSAO) {
  if (!estoques || typeof estoques !== "object" || !pontuacoesUsuario) {
    return [];
  }

  const cfg = obterConfigDuracao();

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

  if (estoqueGlobalTotal < ESTOQUE_MINIMO_GLOBAL_PROGRESSO) return [];

  const pontosTotais = temas_disponiveis.reduce(
    (acc, tema) => acc + (Number(pontuacoesUsuario[tema]) || 0),
    0
  );

  const progressoAtualExato = Math.min(
    100,
    Math.max(0, (pontosTotais / pontuacaoMaximaGlobal) * 100)
  );

  if (progressoAtualExato >= 100) {
    return [];
  }

  const maxPorFaixa = calcularIncrementoMaximoProgresso(pontosTotais, estoqueGlobalTotal);
  const maxEfetivo = Math.min(cfg.progressoIncrementoMax, maxPorFaixa);
  const minEfetivo = Math.min(cfg.progressoIncrementoMin, maxEfetivo);

  const incrementoSorteado = sortearIncrementoProgresso(minEfetivo, maxEfetivo);
  let metaPorcentagem = Math.round(progressoAtualExato + incrementoSorteado);

  // Garante pelo menos +1 ponto percentual inteiro em relação ao progresso atual
  if (metaPorcentagem - progressoAtualExato < 1) {
    metaPorcentagem = Math.ceil(progressoAtualExato + 1);
  }

  metaPorcentagem = Math.min(100, metaPorcentagem);
  if (metaPorcentagem <= Math.round(progressoAtualExato)) {
    return [];
  }

  const deltaPctReal = metaPorcentagem - progressoAtualExato;
  const dificuldade = classificarDificuldadeMissaoProgresso(deltaPctReal, pontosTotais);
  const pontosMeta = Math.round((metaPorcentagem / 100) * pontuacaoMaximaGlobal);
  return [
    {
      id: `g_progresso_${metaPorcentagem}`,
      descricao: `Atinja ${metaPorcentagem}% de progresso total (${pontosMeta.toLocaleString("pt-BR")} pts)`,
      dificuldade,
      temas: []
    }
  ];
}

// 2. MISSÃO GLOBAL: ACERTAR FRAÇÃO EM NÍVEL ESPECÍFICO
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

function escolherNivelMissaoGlobalPorcentagemAcertos(estoques, pontuacoesUsuario, estoqueMinimo) {
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

    if (temasElegiveis.length >= 2 && estoqueDisponivel >= estoqueMinimo) {
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

  // console.log("Os 2 níveis com maior estoque são:", top2Estoques);

  return top2Estoques[Math.floor(Math.random() * top2Estoques.length)];
}

function criarMissaoGlobalAcertarNivel(estoques, pontuacoesUsuario) {
  const cfg = obterConfigDuracao();
  const qtdPerguntas = cfg.globalNivelQuantidade;
  const estoqueMinimo = Math.max(ESTOQUE_MINIMO_GLOBAL_NIVEL, qtdPerguntas + 2);

  const escolhido = escolherNivelMissaoGlobalPorcentagemAcertos(
    estoques,
    pontuacoesUsuario,
    estoqueMinimo
  );

  if (!escolhido) {
    return [];
  }

  const porcentagem = sortearPorcentagemAcerto(escolhido.nivel, 40, 80, 10);
  const acertos = Math.max(1, Math.round((porcentagem / 100) * qtdPerguntas));
  const dificuldade = classificarDificuldadeMissaoPorcentagem(escolhido.nivel, porcentagem);

  return [
    {
      id: `g_pct_nivel_${MODO_ENERGIA_MISSOES}_${escolhido.nivel.toLowerCase()}`,
      descricao: `Acerte ${acertos}/${qtdPerguntas} perguntas de nível ${escolhido.nivel} em qualquer tema`,
      dificuldade,
      temas: []
    }
  ];
}

// MONTAGEM DE OPÇÕES TEMÁTICAS CANDIDATAS (1 TEMA OU AGRUPADO DE 2 TEMAS)
function montarOpcoesTematicasCandidatas(candidatos, criarMissaoDeGrupo) {
  const ordenados = [...candidatos].sort((a, b) => b.estoqueRef - a.estoqueRef);
  const opcoes = [];
  const assinaturasUsadas = new Set();

  const adicionarOpcao = (grupo) => {
    if (!Array.isArray(grupo) || grupo.length === 0) return;
    const chave = grupo.map(item => item.tema).sort().join("|");
    if (assinaturasUsadas.has(chave)) return;
    assinaturasUsadas.add(chave);
    opcoes.push(criarMissaoDeGrupo(grupo, opcoes.length));
  };

  if (ordenados.length >= 3) {
    // Prioriza 1 tema de maior estoque e 1 opção agrupando 2º e 3º (ou alterna a ordem)
    if (Math.random() < 0.5) {
      adicionarOpcao([ordenados[0]]);
      adicionarOpcao([ordenados[1], ordenados[2]]);
    } else {
      adicionarOpcao([ordenados[1], ordenados[2]]);
      adicionarOpcao([ordenados[0]]);
    }
  } else if (ordenados.length === 2) {
      adicionarOpcao([ordenados[0]]);
      adicionarOpcao([ordenados[1]]);
  } else if (ordenados.length === 1) {
    adicionarOpcao([ordenados[0]]);
  }

  // Adiciona candidatos restantes como opções extras para fallback sem reexecutar lógica
  for (const item of ordenados) {
    adicionarOpcao([item]);
  }

  return opcoes;
}

// 3. MISSÃO TEMÁTICA: ACERTAR FRAÇÃO EM NÍVEL ESPECÍFICO
const QUANTIDADE_PERGUNTAS_MISSAO_NIVEL = 10;

function escolherNivelComMaiorEstoque(estoquesTema, ranking, minimoEstoque) {
  const permitidos = NIVEIS_PERMITIDOS_POR_RANKING[ranking] || [];
  if (permitidos.length === 0 || !estoquesTema) return null;

  let melhorNivel = null;
  let maiorEstoque = 0;

  for (const nivel of permitidos) {
    const qtd = Number(estoquesTema[nivel]) || 0;
    if (qtd >= minimoEstoque && qtd > maiorEstoque) {
      maiorEstoque = qtd;
      melhorNivel = nivel;
    }
  }

  return melhorNivel ? { nivel: melhorNivel, estoqueNivel: maiorEstoque } : null;
}

function criarMissaoTematicaAcertarPorcentagemNivel(temasElegiveis, estoques) {
  if (!Array.isArray(temasElegiveis) || temasElegiveis.length === 0 || !estoques) {
    return [];
  }

  const cfg = obterConfigDuracao();
  const qtdPerguntas = cfg.tematicaNivelQuantidade;
  const minimoEstoque = qtdPerguntas + 2;

  const candidatos = temasElegiveis
    .map(item => {
      const escolhaNivel = escolherNivelComMaiorEstoque(
        estoques[item.tema],
        item.ranking,
        minimoEstoque
      );
      if (!escolhaNivel) return null;

      return {
        ...item,
        nivelPergunta: escolhaNivel.nivel,
        estoqueNivel: escolhaNivel.estoqueNivel,
        estoqueRef: escolhaNivel.estoqueNivel
      };
    })
    .filter(Boolean);

  if (candidatos.length === 0) {
    return [];
  }

  return montarOpcoesTematicasCandidatas(candidatos, (grupo, idx) => {
    const base = [...grupo].sort((a, b) => b.estoqueNivel - a.estoqueNivel)[0];
    const porcentagem = sortearPorcentagemAcerto(base.nivelPergunta, 40, 80, 10);
    const acertosNecessarios = Math.max(1, Math.round((porcentagem / 100) * qtdPerguntas));
    const dificuldade = classificarDificuldadeMissaoPorcentagem(base.nivelPergunta, porcentagem);
    const nomesTemas = formatarListaTemas(grupo.map(g => g.tema));

    return {
      id: `t_pct_nivel_${MODO_ENERGIA_MISSOES}_${grupo.map(g => g.tema).join("_")}_${idx + 1}`,
      descricao: `Acerte ${acertosNecessarios}/${qtdPerguntas} perguntas de nível ${base.nivelPergunta} em ${nomesTemas}`,
      dificuldade,
      temas: grupo.map(g => g.tema)
    };
  });
}

// 4. MISSÃO TEMÁTICA: ATINGIR PRÓXIMO RANKING
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
    return null;
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

function criarMissaoAtingirRanking(temasElegiveis, estoques) {
  if (!Array.isArray(temasElegiveis) || temasElegiveis.length === 0) {
    return [];
  }

  const avaliacoes = temasElegiveis.map(tema => {
    const aval = avaliarElegibilidadeRanking(tema);
    return {
      ...tema,
      proximoRanking: aval.proximoRanking ?? null,
      elegivel: aval.elegivel,
      motivo: aval.motivo ?? "ok",
      estoqueRef: tema.estoqueTotal
    };
  });

  const candidatos = avaliacoes.filter(a => a.elegivel);

  // console.log("Avaliação candidatos próximo ranking:", avaliacoes);
  // console.log("Candidatos aprovados:", candidatos);

  if (candidatos.length === 0) {
    return [];
  }

  return montarOpcoesTematicasCandidatas(candidatos, (grupo, idx) => {
    const base = [...grupo].sort((a, b) => b.estoqueTotal - a.estoqueTotal)[0];
    const nomesTemas = formatarListaTemas(grupo.map(g => g.tema));

    return {
      id: `t_ranking_${MODO_ENERGIA_MISSOES}_${grupo.map(g => g.tema).join("_")}_${idx + 1}`,
      descricao: `Atinja o ranking ${base.proximoRanking} em ${nomesTemas}`,
      dificuldade: classificarDificuldadeMissaoRanking(base),
      temas: grupo.map(g => g.tema)
    };
  });
}

// SELEÇÃO EM ETAPAS SOBRE CANDIDATOS JÁ COLETADOS (SEM REEXECUTAR GERADORES)
// Prioridade: (1) 1 de cada tipo sem repetir tema -> (2) repete tipo sem repetir tema -> (3) repete tema
function selecionarMissoesSemReexecutar(listasPorGerador, limite = 2, exigirTemasUnicos = false) {
  const filasEmbaralhadas = [...listasPorGerador]
    .sort(() => Math.random() - 0.5)
    .map(lista => (Array.isArray(lista) ? [...lista] : []));

  const selecionadas = [];
  const temasSelecionados = new Set();

  const temConflitoDeTema = (missao, ignorarConflito) => {
    if (!exigirTemasUnicos || ignorarConflito) return false;
    const temas = missao?.temas || [];
    return temas.some(t => temasSelecionados.has(t));
  };

  const registrarMissao = (missao) => {
    if (selecionadas.length >= limite || selecionadas.includes(missao)) return false;
    selecionadas.push(missao);
    for (const t of (missao?.temas || [])) {
      temasSelecionados.add(t);
    }
    return true;
  };

  // Etapa 1: 1 missão de cada tipo (sem repetir tema)
  for (const lista of filasEmbaralhadas) {
    if (selecionadas.length >= limite) break;
    const candidata = lista.find(m => !selecionadas.includes(m) && !temConflitoDeTema(m, false));
    if (candidata) registrarMissao(candidata);
  }

  // Etapa 2: repete tipo de missão, mas mantém a regra de NÃO repetir tema
  if (selecionadas.length < limite) {
    for (const lista of filasEmbaralhadas) {
      for (const missao of lista) {
        if (selecionadas.length >= limite) break;
        if (!temConflitoDeTema(missao, false)) {
          registrarMissao(missao);
        }
      }
      if (selecionadas.length >= limite) break;
    }
  }

  // Etapa 3: último recurso — permite repetir tema caso falte opção nova sem conflito
  if (selecionadas.length < limite) {
    for (const lista of filasEmbaralhadas) {
      for (const missao of lista) {
        if (selecionadas.length >= limite) break;
        registrarMissao(missao);
      }
      if (selecionadas.length >= limite) break;
    }
  }

  return selecionadas;
}

export function criarMissoes(estoques, pontuacoesUsuario) {
  const temasComEstoque = temas_disponiveis
    .map(tema => {
      const e = estoques[tema] || {};
      const estoqueTotal =
        (Number(e["Fácil"]) || 0) +
        (Number(e["Médio"]) || 0) +
        (Number(e["Difícil"]) || 0) +
        (Number(e["Extremo"]) || 0);

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
    .filter(item => item.estoqueTotal >= QUANTIDADE_PERGUNTAS_MISSAO_NIVEL);

  // Coleta 1 vez cada tipo de missão global
  const listasGlobais = [
    criarMissaoGlobalProgresso(estoques, pontuacoesUsuario),
    criarMissaoGlobalAcertarNivel(estoques, pontuacoesUsuario)
  ];

  // Coleta 1 vez cada tipo de missão temática (já com opções únicas e agrupadas)
  const listasTematicas = [
    criarMissaoTematicaAcertarPorcentagemNivel(temasComEstoque, estoques),
    criarMissaoAtingirRanking(temasComEstoque, estoques)
  ];

  return {
    globais: selecionarMissoesSemReexecutar(listasGlobais, 2, false),
    tematicas: selecionarMissoesSemReexecutar(listasTematicas, 2, true)
  };
}

export async function registrarMissoesDisponiveis(missoesGeradas, opcoes = {}) {
  const {
    expirarAnteriores = true,
    duracaoJanelaHoras = 72
  } = opcoes || {};

  const itens = [
    ...(missoesGeradas?.globais || []).map(m => ({ ...m, categoria: "Global" })),
    ...(missoesGeradas?.tematicas || []).map(m => ({ ...m, categoria: "Temática" }))
  ];

  if (itens.length === 0) {
    return { ok: true, registradas: 0 };
  }

  const payload = {
    expirar_anteriores: expirarAnteriores,
    duracao_janela_horas: duracaoJanelaHoras,
    missoes: itens.map(m => ({
      codigo_missao: m.id, // ex.: "g_progresso_34" (não é o id SERIAL do banco)
      categoria: m.categoria, // "Global" ou "Temática"
      descricao: m.descricao,
      dificuldade: m.dificuldade,
      temas: m.temas || []
    }))
  };

  const resposta = await fetch("/api/missoes/registrar-disponiveis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao registrar missões disponíveis: ${resposta.status}`);
  }

  return resposta.json();
}
