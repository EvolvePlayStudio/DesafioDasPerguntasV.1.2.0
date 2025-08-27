import { obterPerguntasDisponiveis, fetchAutenticado, exibirMensagem } from "./utils.js";

let tipo_pergunta = null;
const mensagem = document.getElementById("mensagem");

async function iniciarQuiz(event) {
  // Atualiza o tema atual e modo de jogo no localStorage
  const tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  localStorage.setItem("tema_atual", tema_atual)
  localStorage.setItem("modo_jogo", 'desafio')

  // Atualiza o tipo de pergunta no localStorage (objetiva ou discursiva)
  tipo_pergunta = document.querySelector('input[name="tipo-de-pergunta"]:checked').value;
  localStorage.setItem("tipo_pergunta", tipo_pergunta)

  if (!tema_atual || !tipo_pergunta) {
    console.error("Tema ou tipo de pergunta não definidos na URL.");
    return;
  }

  if (localStorage.getItem("perguntas_restantes") <= 0) {
    exibirMensagem(mensagem, 'Você precisa aguardar para obter mais perguntas no modo desafio', 'red')
    return;
  }
  
  exibirMensagem(mensagem, "Preparando quiz...", '#d1d1d1ff', false)

  // Carrega as perguntas para o quiz
  try {
    const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`)
    if (response.ok) {
      const data = await response.json();

      // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
      localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
      localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));
    
      // Chama a tela de quiz ou exibe mensagem caso não haja perguntas disponíveis
      const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
      const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)
      if (ha_perguntas_disponiveis) {
        mensagem.style.opacity = 0
        window.location.href = `/quiz?tema=${tema_atual}&modo=desafio&tipo-de-pergunta=${tipo_pergunta}`;
      }
      else {
        exibirMensagem(mensagem, `Você não possui novas perguntas ${tipo_pergunta}s disponíveis neste tema no momento`, 'red')
      }
    }
  }
  catch (error) {
    console.error("Erro ao carregar perguntas", error)
  }
}

function carregarPreferenciasQuiz() {
  // Pega valores salvos
  tipo_pergunta = localStorage.getItem("tipo_pergunta");

  // Se não existirem, define valores padrão
  if (!tipo_pergunta) {
    tipo_pergunta = "objetiva";
    localStorage.setItem("tipo_pergunta", tipo_pergunta);
  }

  // Marca os inputs na tela com os valores recuperados
  const tipoRadio = document.querySelector(`input[name="tipo-de-pergunta"][value="${tipo_pergunta}"]`);
  if (tipoRadio) tipoRadio.checked = true;
}
/*
function exibirMensagem(texto, cor, temporaria=true) {
  mensagem.style.color = cor;
  mensagem.textContent = texto;
  mensagem.style.opacity = 1
  if (temporaria) {
    setTimeout(() => {
        mensagem.style.opacity = 0
      }, 10000)
  }
}*/

document.addEventListener("DOMContentLoaded", () => {
  // Implementa a função de clique no botão de doações
  document.getElementById("btn-doacoes").addEventListener("click", async () => {
    const response = await fetchAutenticado("/doações");
    if (response.ok) {
      window.location.href = "/doações";
    }
    });

  // Implementa a função de clique no botão de pesquisa
    document.getElementById("btn-pesquisa").addEventListener("click", async () => {
    const response = await fetchAutenticado("/pesquisa");
    if (response.ok) {
      window.location.href = "/pesquisa";
    }
    });

  // Implementa a função de ir para a página home
  document.getElementById("link-home").addEventListener("click", async (e) => {
    e.preventDefault();
    window.location.href = "/home";
  });

  // Implementa a função de clique nos temas
  document.querySelectorAll(".tema-card").forEach(card => {
  card.addEventListener("click", iniciarQuiz);
  });

  // Define as variáveis do cabeçalho
  const nome_usuario = document.getElementById("user-name")
  const perguntas_restantes = document.getElementById("perguntas-count")
  const dicas_restantes = document.getElementById("dicas-count")

  // Define o nome do usuário
  nome_usuario.textContent = localStorage.getItem("nome_usuario")
  
  // Define as perguntas e dicas disponíveis e máximas para o usuário
  perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}/100`
  dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes")}/20`

  // Carrega as preferências de modo de jogo e tipo de pergunta
  carregarPreferenciasQuiz();
})
