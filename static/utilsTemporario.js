const controleLogs = {};
const idVisitante = localStorage.getItem('id_visitante');// Será removido depois que a função de registra logs funcionar no utils
const idUsuario = localStorage.getItem('id_usuario')// Será removido depois que a função de registra logs funcionar no utils
export const maxPontuacaoTema = 5000;
export const maxPontuacaoTotal = 60000;
export const CATALOGO_CONQUISTAS= [
  // 1. Volume Geral
  { id: "respondidas_bronze", tier: "bronze", titulo: "Primeiros Passos", descricao: "Responda 10 perguntas.", meta: 10 },
  { id: "respondidas_prata", tier: "prata", titulo: "Ritmo Constante", descricao: "Responda 400 perguntas.", meta: 400 },
  { id: "respondidas_ouro", tier: "ouro", titulo: "Veterano do Quiz", descricao: "Responda 1.200 perguntas.", meta: 1200 },

  // 2. Ranking
  { id: "ranking_bronze", tier: "bronze", titulo: "Caminho do Estudante", descricao: "Alcance o ranking Estudante em 1 tema ou Aprendiz em 6.", meta: 6 },
  { id: "ranking_prata", tier: "prata", titulo: "Caminho do Sábio", descricao: "Alcance o ranking Sábio em 1 tema ou Estudante em 6.", meta: 6 },
  { id: "ranking_ouro", tier: "ouro", titulo: "Lenda Viva", descricao: "Alcance o ranking Lenda em 1 tema ou Sábio em 6.", meta: 6 },

  // 3. Pontos — Ciências da Natureza (Astronomia, Biologia, Física, Química)
  { id: "natureza_bronze", tier: "bronze", titulo: "Curioso da Natureza", descricao: "Atinja 4.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 4000 },
  { id: "natureza_prata", tier: "prata", titulo: "Explorador da Natureza", descricao: "Atinja 8.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 8000 },
  { id: "natureza_ouro", tier: "ouro", titulo: "Mestre da Natureza", descricao: "Atinja 12.000 pontos somados em Astronomia, Biologia, Física e Química.", meta: 12000 },

  // 4. Pontos — Ciências Humanas (História, Geografia, Filosofia)
  { id: "humanas_bronze", tier: "bronze", titulo: "Aprendiz de Humanas", descricao: "Atinja 3.000 pontos somados em História, Geografia e Filosofia.", meta: 3000 },
  { id: "humanas_prata", tier: "prata", titulo: "Explorador de Humanas", descricao: "Atinja 6.000 pontos somados em História, Geografia e Filosofia.", meta: 6000 },
  { id: "humanas_ouro", tier: "ouro", titulo: "Mestre em Humanas", descricao: "Atinja 9.000 pontos somados em História, Geografia e Filosofia.", meta: 9000 },

  // 5. Pontos — Artes e Cultura (Artes, Música, Mídia)
  { id: "cultura_bronze", tier: "bronze", titulo: "Primeira Cena", descricao: "Atinja 3.000 pontos somados em Artes, Mídia e Música.", meta: 3000 },
  { id: "cultura_prata", tier: "prata", titulo: "Cultura e Expressão", descricao: "Atinja 6.000 pontos somados em Artes, Mídia e Música.", meta: 6000 },
  { id: "cultura_ouro", tier: "ouro", titulo: "Mestre das Artes", descricao: "Atinja 9.000 pontos somados em Artes, Mídia e Música.", meta: 9000 },

  // 6. Pontos — Esportes e Variedades (Esportes, Variedades)
  { id: "variedades_bronze", tier: "bronze", titulo: "Jogo e Cotidiano", descricao: "Atinja 2.000 pontos somados em Esportes e Variedades.", meta: 2000 },
  { id: "variedades_prata", tier: "prata", titulo: "Versátil em Ação", descricao: "Atinja 4.000 pontos somados em Esportes e Variedades.", meta: 4000 },
  { id: "variedades_ouro", tier: "ouro", titulo: "Mestre do Repertório", descricao: "Atinja 6.000 pontos somados em Esportes e Variedades.", meta: 6000 },

  // 7. Acertos em Nível Específico
  { id: "superando_medio", tier: "bronze", titulo: "Superando o Médio", descricao: "Acerte 30 perguntas de nível Médio em qualquer tema.", meta: 30 },
  { id: "superando_dificil", tier: "prata", titulo: "Superando o Difícil", descricao: "Acerte 30 perguntas de nível Difícil em qualquer tema.", meta: 30 },
  { id: "superando_extremo", tier: "ouro", titulo: "Superando o Extremo", descricao: "Acerte 30 perguntas de nível Extremo em qualquer tema.", meta: 30 },

  // 8. Avaliações com Estrelas
  { id: "avaliador_bronze", tier: "bronze", titulo: "Avaliador", descricao: "Avalie 10 perguntas com estrelas.", meta: 10 },
  { id: "avaliador_prata", tier: "prata", titulo: "Crítico Frequente", descricao: "Avalie 100 perguntas com estrelas.", meta: 100 },
  { id: "avaliador_ouro", tier: "ouro", titulo: "Referência da Comunidade", descricao: "Avalie 300 perguntas com estrelas.", meta: 300 },

  // 9. Progresso Total
  { id: "progresso_bronze", tier: "bronze", titulo: "Impulso Inicial", descricao: "Alcance 10% de progresso total (6.000 pts).", meta: 10 },
  { id: "progresso_prata", tier: "prata", titulo: "Base Sólida", descricao: "Alcance 30% de progresso total (18.000 pts).", meta: 30 },
  { id: "progresso_ouro", tier: "ouro", titulo: "Domínio Avançado", descricao: "Alcance 60% de progresso total (36.000 pts).", meta: 60 }
];
export const MEDALHAS_TIER = {bronze: "🥉", prata: "🥈", ouro: "🥇"};
export const PISO_RANKING = {"Aprendiz": 1000, "Estudante": 2000, "Sábio": 3000, "Lenda": 4000};
export function registrarLog(textoLog) {
    const agora = Date.now();
    const ultimoEnvio = controleLogs[textoLog] || 0;

    if (agora - ultimoEnvio < 20000) return;  // Ignora duplo envio em janelas de 20 segundos
    controleLogs[textoLog] = agora;

    fetch('/api/registrar-acesso', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pagina: textoLog,
        id_visitante: idVisitante,
        id_usuario: idUsuario
      })
    }).catch(error => console.error("Erro ao registrar acesso:", error));
};
