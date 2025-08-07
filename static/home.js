function iniciarQuiz(event) {
  const temaPerguntas = encodeURIComponent(event.currentTarget.dataset.tema);
  const modoSelecionado = document.querySelector('input[name="modo"]:checked').value;

  window.location.href = `/quiz?tema=${temaPerguntas}&modo=${modoSelecionado}`;
}

document.querySelectorAll(".tema-card").forEach(card => {
  card.addEventListener("click", iniciarQuiz);
});