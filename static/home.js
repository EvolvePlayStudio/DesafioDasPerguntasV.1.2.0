import { obterPerguntasDisponiveis } from "./utils.js";

function iniciarQuiz(event) {
  // Atualiza o tema atual no localStorage
  const tema_atual = decodeURIComponent(event.currentTarget.dataset.tema);
  localStorage.setItem("tema_atual", tema_atual)

  // Atualiza o modo de jogo no localStorage (desafio ou revisao)
  const modo_jogo = document.querySelector('input[name="modo"]:checked').value;
  localStorage.setItem("modo_jogo", modo_jogo)

  // Carrega as perguntas para o quiz
  if (!tema_atual || !modo_jogo) {
    console.error("Tema ou modo de jogo não definidos na URL.");
    return;
  }
  fetch(`/api/perguntas?tema=${tema_atual}&modo=${modo_jogo}`)
    .then(response => response.json())
    .then(data => {
      // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
      localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
      localStorage.setItem("perguntas", JSON.stringify(data["perguntas"]));

      // Chama a tela de quiz ou emite um alert caso não haja perguntas disponíveis
      const perguntas_filtradas = obterPerguntasDisponiveis(data["perguntas"])
      const ha_perguntas_disponiveis = Object.values(perguntas_filtradas).some(arr => Array.isArray(arr) && arr.length > 0)
      if (ha_perguntas_disponiveis) {
        window.location.href = `/quiz?tema=${tema_atual}&modo=${modo_jogo}`;
      }
      else {
        alert(`Você não possui perguntas disponíveis para o modo ${modo_jogo} no momento`)
      }
    })
  .catch(error => {
      console.error("Erro ao carregar perguntas:", error);
      return
    });
}

document.querySelectorAll(".tema-card").forEach(card => {
  card.addEventListener("click", iniciarQuiz);
});
