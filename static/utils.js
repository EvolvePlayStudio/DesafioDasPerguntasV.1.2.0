export const pontuacaoTemaPadraoVisitantes = 1800;
export const dificuldadesOrdenadas = ['Fácil', 'Médio', 'Difícil', 'Extremo'];
export const temas_disponiveis = ["Artes", "Astronomia", "Biologia", "Esportes", "Filosofia", "Física", "Geografia", "História", "Mídia", "Música", "Química", "Variedades"];
export const idsReservados = [4, 6];
export const idVisitanteAdmin = '605720b7-c72f-4b18-9b73-c3615bfce897'

let idUsuario;
let idVisitante;
let MODO_VISITANTE;

function atualizarVariaveis() {
  idUsuario = sessionStorage.getItem("id_usuario");
  idVisitante = localStorage.getItem("id_visitante");
  MODO_VISITANTE = sessionStorage.getItem("modoVisitante") === "true";
}

export function atualizarAnuncios(containerEsq, containerDir, labelAnuncioEsq, labelAnuncioDir, tema_atual, dadosAnuncios, telaAtual, historicoExibicao={}) {
  atualizarVariaveis();
  
  const aplicarAnuncio = (container, produto) => {
      if (!container || !produto) return;
      container.style.visibility = 'visible';
      container.style.pointerEvents = 'auto';
      const link = container.querySelector('a');
      link.href = produto.link;
      link.setAttribute('data-id-anuncio', produto.id);
      link.setAttribute('data-provedor-anuncio', produto.provedor);
      link.setAttribute('data-tipo-midia-anuncio', produto.tipo_midia);
      container.querySelector('img').src = produto.imagem;
      container.querySelector('p').textContent = produto.descricao || produto.nome;
  
      if (historicoExibicao[produto.id] === 1) {
        registrarInteracaoAnuncio(link, "Impressão", tema_atual);
      }      
  };
    
  const gerarLabel = (provedor) => {
    const provedorForm = provedor ? provedor.toLowerCase().trim() : provedor;
    if (provedorForm === 'amazon') return 'Amazon';
    if (provedorForm === 'mercado livre') return 'Mercado Livre';
    return "Ofertas de produtos";
  };
  
  try {
    if (labelAnuncioEsq) labelAnuncioEsq.textContent = '';
    if (labelAnuncioDir) labelAnuncioDir.textContent = '';
    
    if (!dadosAnuncios[tema_atual]) {
      if (containerEsq) {
        containerEsq.style.visibility = 'hidden';
        containerEsq.style.pointerEvents = 'none';
      }
      if (containerDir) {
        containerDir.style.visibility = 'hidden';
        containerDir.style.pointerEvents = 'none';
      }
      return historicoExibicao;
    }

    const dadosTema = dadosAnuncios[tema_atual];
    const isUserAdmin = MODO_VISITANTE ? false : idsReservados.includes(parseInt(idUsuario));

    const prepararListaPriorizada = (listaRaw) => {
      if (!listaRaw) return [];
        return listaRaw
        .filter(a => {
            if (isUserAdmin) return true;
            if (MODO_VISITANTE) return a.disponivel_visitantes === true;
            return a.disponivel_usuarios === true;
        })
        .map(a => {
            if (!historicoExibicao[a.id]) historicoExibicao[a.id] = 0;
            
            let prioridade = 1000 - (historicoExibicao[a.id] * 10);
            
            // Bônus de Admin para anúncios em teste (ambos false)
            const isAnuncioTeste = !a.disponivel_visitantes && !a.disponivel_usuarios;
            if (isUserAdmin && isAnuncioTeste && historicoExibicao[a.id] === 0) {
                prioridade += 5000;
            }

            const ruidoRandomico = Math.random() * 5; 
            return { ...a, _score: prioridade + ruidoRandomico };
        })
        .sort((a, b) => b._score - a._score);
    };

    let listaAmazon = prepararListaPriorizada(dadosTema['Amazon']);
    let listaML = prepararListaPriorizada(dadosTema['Mercado Livre']);
    
    let produtoEsq, produtoDir;
    if (telaAtual === 'Quiz') {
      // Esconde banners se não há anúncios para exibir
      if (listaAmazon.length === 0 && listaML.length === 0) {
        [containerEsq, containerDir].forEach(c => { if(c) c.style.visibility = 'hidden'; c.style.pointerEvents = 'none'});
        return;
      }

      // Se tiver anúncios da Amazon e Mercado Livre
      if (listaAmazon.length > 0 && listaML.length > 0) {
        produtoEsq = listaAmazon[0];
        produtoDir = listaML[0];
      }
      // Se tiver só anúncios da Amazon
      else if (listaAmazon.length > 0) {
        produtoEsq = listaAmazon[0];
        produtoDir = (listaAmazon.length > 1) ? listaAmazon[1] : listaAmazon[0];
      }
      // Se tiver só anúncios do Mercado Livre
      else if (listaML.length > 0) {
        produtoEsq = listaML[0];
        produtoDir = (listaML.length > 1) ? listaML[1] : listaML[0];
      }
      // Renderiza os anúncios e registra impressão ocorrida na base de dados
      if (produtoEsq) {
        labelAnuncioEsq.textContent = gerarLabel(produtoEsq.provedor);
        historicoExibicao[produtoEsq.id]++;
        aplicarAnuncio(containerEsq, produtoEsq);
      }
      if (produtoDir && produtoDir.id !== produtoEsq.id) {
        labelAnuncioDir.textContent = gerarLabel(produtoDir.provedor);
        historicoExibicao[produtoDir.id]++;
        aplicarAnuncio(containerDir, produtoDir);
      }
    }
    else { // lógica da tela de Resultado

      let listaUnificada =[...listaAmazon, ...listaML].sort((a, b) => b._score - a._score);
      if (listaUnificada.length === 0) {
        if (containerDir) {
          containerDir.style.visibility = 'hidden';
          containerDir.style.pointerEvents = 'none';
        }
        return;
      }

      produtoDir = listaUnificada[0];
      if (labelAnuncioDir) {
        labelAnuncioDir.textContent = gerarLabel(produtoDir.provedor);
      }
      historicoExibicao[produtoDir.id]++;
      aplicarAnuncio(containerDir, produtoDir);
    }
  }
  catch (error) {
    console.error("Erro na rotação inteligente de anúncios: ", error);
  }
  return historicoExibicao;
}

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
  const MODO_TESTE = sessionStorage.getItem('modo_teste') === 'true';
  if (MODO_TESTE) return false;
  const tema = sessionStorage.getItem("tema_atual");
  const MODO_VISITANTE = sessionStorage.getItem("modoVisitante") === 'true';
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
    localStorage.setItem("auth_message", "Sessão expirada");
    window.location.href = "/login";
    return;
  }

  // 🚧 Site em manutenção
  if (response.status === 503) {
    localStorage.setItem("auth_message", "Site em manutenção");
    window.location.href = "/login";
    return;
  }

  // ❗ Erro interno → deixa o chamador decidir
  return response;
}

// ATENÇÃO: PARAMÊTRO NÃO UTILIZADO AQUI
export function obterInfoRankingAtual(tema=null, MODO_VISITANTE_ANTIGO=null) {
  // Obtém informação de ranking de acordo com pontuação no tema indicado
  const MODO_VISITANTE = sessionStorage.getItem("modoVisitante") === "true";
  const pontuacoes_jogador = MODO_VISITANTE ? JSON.parse(localStorage.getItem("pontuacoes_visitante")) : JSON.parse(sessionStorage.getItem("pontuacoes_usuario"));
  if (!tema) { tema = sessionStorage.getItem("tema_atual")};
  
  const pontuacao_no_tema = pontuacoes_jogador[tema] || 0;
  const regras_pontuacao = JSON.parse(sessionStorage.getItem("regras_pontuacao")) || [];

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

export async function registrarInteracaoAnuncio(linkElement, tipoInteracao, temaAtual) {
  // Se for admin em modo visitante, não registra nada
  if (MODO_VISITANTE && idVisitante === idVisitanteAdmin) return;

  const idAnuncioSorteado = linkElement.getAttribute('data-id-anuncio');
  const provedorAnuncioSorteado = linkElement.getAttribute('data-provedor-anuncio');
  const tipoMidiaAnuncioSorteado = linkElement.getAttribute('data-tipo-midia-anuncio');

  const dados = {
    modo_visitante: MODO_VISITANTE,
    id_anuncio: idAnuncioSorteado,
    id_usuario: idUsuario,
    id_visitante: idVisitante,
    tema_quiz: temaAtual,
    provedor: provedorAnuncioSorteado,
    tipo_midia: tipoMidiaAnuncioSorteado,
    tipo_interacao: tipoInteracao // 'clique' ou 'impressao'
  };

  // Envia para o Flask sem travar a navegação
  fetch('/registrar_interacao_anuncio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
  }).catch(err => console.error('Erro ao registrar clique em anúncio:', err));
}

export function sincronizarPontuacoesVisitante(PONTUACAO_INICIAL) {
  let pontuacoes = {};

  try {
    pontuacoes = JSON.parse(localStorage.getItem("pontuacoes_visitante")) || {};
  }
  catch {
    pontuacoes = {};
  }

  const pontuacoesAtualizadas = {};

  // Adiciona temas válidos (mantendo pontuação existente)
  temas_disponiveis.forEach(tema => {
    pontuacoesAtualizadas[tema] =
      typeof pontuacoes[tema] === "number" ? pontuacoes[tema] : PONTUACAO_INICIAL;
  });

  // Sobrescreve removendo temas antigos automaticamente
  localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoesAtualizadas));
}
