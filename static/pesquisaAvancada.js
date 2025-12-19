const palavrasChave = [];

document.getElementById("btn-adicionar").addEventListener("click", () => {
  const input = document.getElementById("keyword-input");
  const valor = input.value.trim().toLowerCase();

  if (!valor || palavrasChave.includes(valor)) return;

  palavrasChave.push(valor);
  input.value = "";
  renderizarTags();
});

document.getElementById("btn-pesquisar").addEventListener("click", () => {
  const tema = document.getElementById("tema").value;

  if (palavrasChave.length === 0) {
    alert("Adicione ao menos uma palavra-chave.");
    return;
  }

  buscarPerguntas(tema, palavrasChave);
});

document.getElementById("btn-limpar").addEventListener("click", () => {
  palavrasChave.length = 0;
  renderizarTags();
});

document.getElementById("btn-voltar").addEventListener("click", () => {
    window.location.href = "/home";
});

function renderizarTags() {
  const container = document.getElementById("tags-container");
  container.innerHTML = "";

  palavrasChave.forEach((palavra, index) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `
      ${palavra}
      <button data-index="${index}">✕</button>
    `;
    container.appendChild(tag);
  });

  // Remover TAG individual
  container.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      palavrasChave.splice(btn.dataset.index, 1);
      renderizarTags();
    });
  });
}

async function buscarPerguntas(tema, palavras) {
  const tabela = document.querySelector("#tabela-perguntas tbody");
  tabela.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; font-weight:bold;">
        Buscando...
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/pesquisar_perguntas", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        tema: tema,
        palavras: palavras
      })
    });

    const dados = await response.json();
    tabela.innerHTML = "";

    if (dados.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; font-weight:bold;">
            Nenhuma pergunta encontrada.
          </td>
        </tr>
      `;
      return;
    }

    dados.forEach(item => {
      let resposta = item.resposta;
      if (item.tipo === "Discursiva" && Array.isArray(resposta)) {
        resposta = resposta.join(", ");
      }

      tabela.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${item.id_pergunta}</td>
          <td>${item.tipo}</td>
          <td>${item.subtemas}</td>
          <td>${item.enunciado}</td>
          <td>${resposta}</td>
          <td>${item.dificuldade}</td>
        </tr>
      `);
    });

  } catch (err) {
    console.error(err);
    tabela.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; font-weight:bold; color:red;">
          Erro ao buscar perguntas.
        </td>
      </tr>
    `;
  }
}

