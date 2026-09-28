const palavrasChave = [];
const temasSelecionados = [];

// Usando delegação de eventos no elemento pai dos botões
const containerTemas = document.getElementById("temas-container");

if (containerTemas) {
  containerTemas.addEventListener("click", (event) => {
    // Verifica se o clique foi em um botão com a classe 'btn-tema'
    const btn = event.target.closest(".btn-tema");
    if (!btn) return;

    const tema = btn.dataset.tema;
    btn.classList.toggle("active");

    if (temasSelecionados.includes(tema)) {
      const index = temasSelecionados.indexOf(tema);
      temasSelecionados.splice(index, 1);
    } else {
      temasSelecionados.push(tema);
    }
  });
}

document.getElementById("btn-adicionar").addEventListener("click", () => {
  const input = document.getElementById("keyword-input");
  const valor = input.value.trim().toLowerCase();

  if (!valor || palavrasChave.includes(valor)) return;

  palavrasChave.push(valor);
  input.value = "";
  renderizarTags();
});

document.getElementById("btn-pesquisar").addEventListener("click", () => {
  if (palavrasChave.length === 0) {
    alert("Adicione ao menos uma palavra-chave.");
    return;
  }

  buscarPerguntas(temasSelecionados, palavrasChave);
});

document.getElementById("btn-limpar").addEventListener("click", () => {
  palavrasChave.length = 0;
  temasSelecionados.length = 0;
  
  document.querySelectorAll(".btn-tema").forEach(btn => btn.classList.remove("active"));
  
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

  container.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      palavrasChave.splice(btn.dataset.index, 1);
      renderizarTags();
    });
  });
}

async function buscarPerguntas(temas, palavras) {
  const tabela = document.querySelector("#tabela-perguntas tbody");
  tabela.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; font-weight:bold;">
        Buscando...
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/pesquisar_perguntas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temas: temas,
        palavras: palavras
      })
    });

    const dados = await response.json();
    tabela.innerHTML = "";

    if (dados.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; font-weight:bold;">
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
          <td>${item.tema}</td>
          <td>${item.enunciado}</td>
          <td>${resposta}</td>
          <td>${item.dificuldade}</td>
          <td>${item.status}</td>
        </tr>
      `);
    });

  } catch (err) {
    console.error(err);
    tabela.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; font-weight:bold; color:red;">
          Erro ao buscar perguntas.
        </td>
      </tr>
    `;
  }
}

tag