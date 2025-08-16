import { obterPerguntasDisponiveis } from "./utils.js";

let modo_jogo = null;
let tipo_pergunta = null;

function iniciarQuiz(event) {
  // Atualiza o tema atual no localStorage
  const tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  localStorage.setItem("tema_atual", tema_atual)

  // Atualiza o modo de jogo no localStorage (desafio ou revisao)
  modo_jogo = document.querySelector('input[name="modo"]:checked').value;
  localStorage.setItem("modo_jogo", modo_jogo)

  // Atualiza o tipo de pergunta no localStorage (objetiva ou discursiva)
  tipo_pergunta = document.querySelector('input[name="tipo-de-pergunta"]:checked').value;
  localStorage.setItem("tipo_pergunta", tipo_pergunta)

  if (!tema_atual || !modo_jogo || !tipo_pergunta) {
    console.error("Tema, modo de jogo ou tipo de pergunta não definidos na URL.");
    return;
  }

  if (modo_jogo.toLowerCase() === 'desafio' && localStorage.getItem("perguntas_restantes") <= 0) {
    alert('Você precisa aguardar para obter mais perguntas no modo desafio')
    return;
  }

  // Carrega as perguntas para o quiz
  fetch(`/api/perguntas?tema=${tema_atual}&modo=${modo_jogo}&tipo-de-pergunta=${tipo_pergunta}`)
    .then(response => response.json())
    .then(data => {
      // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
      localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
      localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

      // Chama a tela de quiz ou emite um alert caso não haja perguntas disponíveis
      const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
      const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)
      if (ha_perguntas_disponiveis) {
        window.location.href = `/quiz?tema=${tema_atual}&modo=${modo_jogo}&tipo-de-pergunta=${tipo_pergunta}`;
      }
      else {
        alert(`Você não possui perguntas ${tipo_pergunta}s disponíveis para o modo ${modo_jogo} no momento`)
      }
    })
  .catch(error => {
      console.error("Erro ao carregar perguntas:", error);
      return
    });
}

function carregarPreferenciasQuiz() {
  // Pega valores salvos
  modo_jogo = localStorage.getItem("modo_jogo");
  tipo_pergunta = localStorage.getItem("tipo_pergunta");

  // Se não existirem, define valores padrão
  if (!modo_jogo) {
    modo_jogo = "desafio";
    localStorage.setItem("modo_jogo", modo_jogo);
  }
  if (!tipo_pergunta) {
    tipo_pergunta = "objetiva";
    localStorage.setItem("tipo_pergunta", tipo_pergunta);
  }

  // Marca os inputs na tela com os valores recuperados
  const modoRadio = document.querySelector(`input[name="modo"][value="${modo_jogo}"]`);
  if (modoRadio) modoRadio.checked = true;

  const tipoRadio = document.querySelector(`input[name="tipo-de-pergunta"][value="${tipo_pergunta}"]`);
  if (tipoRadio) tipoRadio.checked = true;
}

document.addEventListener("DOMContentLoaded", () => {
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
  
  // Identifica os limites para dicas e perguntas
  const tot_regras_plano = JSON.parse(localStorage.getItem("regras_plano"))
  const plano_usuario = localStorage.getItem("plano")

  let max_dicas = 0
  let max_perguntas = 0

  for (const index_regras in tot_regras_plano) {
    const regras = tot_regras_plano[index_regras]
    if (regras["plano"] === plano_usuario) {
      max_perguntas = regras["limite_maximo_perguntas"]
      max_dicas = regras["limite_maximo_dicas"]
      break
    }
  }
  
  // Define as perguntas e dicas disponíveis e máximas para o usuário
  perguntas_restantes.textContent = `${localStorage.getItem("perguntas_restantes")}/${max_perguntas}`
  dicas_restantes.textContent = `${localStorage.getItem("dicas_restantes")}/${max_dicas}`

  // Carrega as preferências de modo de jogo e tipo de pergunta
  carregarPreferenciasQuiz();
})
