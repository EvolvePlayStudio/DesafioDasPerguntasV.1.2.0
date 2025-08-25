import { fetchAutenticado } from "./utils.js";


let tema_atual;
let tipo_pergunta;
const tabela_body = document.querySelector("#tabela-perguntas tbody");

// Implementa a função para retornar para a home
document.getElementById("btn-voltar").addEventListener("click", () => {
  window.location.href = '/home';
})

// Implementa a função para iniciar uma revisão
document.getElementById("btn-revisar").addEventListener("click", () => {
  const linhas = tabela_body.querySelectorAll("tr");
  const perguntas_totais = JSON.parse(localStorage.getItem("perguntas_para_revisar"));
  console.log("Perguntas locais: ", perguntas_totais)
  const perguntas_filtradas = {Fácil: [], Médio: [], Difícil: []}
  tema_atual = document.getElementById("tema").value;
  tipo_pergunta = document.getElementById("tipo-pergunta").value;

  linhas.forEach(linha => {
    const checkbox = linha.querySelector("input[type='checkbox']");
    if (checkbox && checkbox.checked) {
      const id_pergunta_tabela = linha.getAttribute("data-id");
      const dificuldade_pergunta = linha.getAttribute("data-dificuldade");
      const pergunta = perguntas_totais[dificuldade_pergunta].find(p => p.id_pergunta == id_pergunta_tabela);
      if (pergunta) {
        perguntas_filtradas[dificuldade_pergunta].push(pergunta);
      }
    }
  })

  if (perguntas_filtradas["Fácil"].length > 0 || perguntas_filtradas["Médio"].length > 0 || perguntas_filtradas["Difícil"].length > 0) {
    localStorage.setItem("perguntas", JSON.stringify(perguntas_filtradas));
    localStorage.setItem("modo_jogo", "revisao")
    localStorage.setItem("tipo_pergunta", tipo_pergunta)
    localStorage.setItem("tema_atual", tema_atual)
    window.location.href = `/quiz?tema=${tema_atual}&modo=revisao&tipo-de-pergunta=${tipo_pergunta}`;
  }
  else {
    console.log("Nenhuma pergunta selecionada")
  }
})

// Atualiza quando o tema muda
document.getElementById("tema").addEventListener("change", (event) => {
    atualizarTabela();
});

// Atualiza quando o tipo de pergunta muda
document.getElementById("tipo-pergunta").addEventListener("change", (event) => {
    atualizarTabela();
});

async function atualizarTabela() {
    tema_atual = document.getElementById("tema").value;
    tipo_pergunta = document.getElementById("tipo-pergunta").value;
    if (!tema_atual || !tipo_pergunta) return;

    // Buscar na API Flask
    try {
      const response = await fetchAutenticado(`/api/perguntas?tema=${tema_atual}&modo=revisao&tipo-de-pergunta=${tipo_pergunta}`)
      if (response.ok) {
        const data = await response.json();

        // Atualiza as pontuações do usuário no tema e as perguntas no localStorage
        localStorage.setItem("pontuacoes_usuario", JSON.stringify(data["pontuacoes_usuario"]));
        localStorage.setItem("perguntas_para_revisar", JSON.stringify(data["perguntas"]));

        renderizarTabela();
      }
    }
    catch (error) {
      console.error("Erro ao carregar perguntas", error)
    }
}

function renderizarTabela() {
    const perguntasPorDificuldade = JSON.parse(localStorage.getItem("perguntas_para_revisar")) || {
        "Fácil": [],
        "Médio": [],
        "Difícil": []
    };

    tabela_body.innerHTML = ""; // limpa antes de renderizar
    const todosSubtemas = new Set();

    // Percorre todas as dificuldades
    Object.keys(perguntasPorDificuldade).forEach(dificuldade => {
        perguntasPorDificuldade[dificuldade].forEach(p => {
            const tr = document.createElement("tr");

            // ID
            const tdId = document.createElement("td");
            tr.dataset.id = p.id_pergunta;
            tdId.textContent = p.id_pergunta;
            tr.appendChild(tdId);

            // Subtemas
            const tdSubtemas = document.createElement("td");
            if (p.subtemas && p.subtemas.length > 0) {
              tdSubtemas.textContent = p.subtemas ? p.subtemas.join(" / ") : "";
              p.subtemas.forEach(st => todosSubtemas.add(st));
            }
            else {
              tdSubtemas.textContent = "";
            }
            tr.appendChild(tdSubtemas);

            // Enunciado
            const tdEnunciado = document.createElement("td");
            tdEnunciado.textContent = p.enunciado;
            tr.appendChild(tdEnunciado);

            // Dificuldade
            const tdDificuldade = document.createElement("td");
            tr.dataset.dificuldade = p.dificuldade
            tdDificuldade.textContent = p.dificuldade;
            tr.appendChild(tdDificuldade);

            // Selecionar
            const tdSelecionar = document.createElement("td");
            tdSelecionar.classList.add("checkbox-center");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.id = p.id_pergunta;
            tdSelecionar.appendChild(checkbox);
            tr.appendChild(tdSelecionar);

            tabela_body.appendChild(tr);
        });
    });
    atualizarBotoesSubtemas([...todosSubtemas].sort());
}

function atualizarBotoesSubtemas(subtemas) {
  const container = document.getElementById("container-subtemas");
  container.innerHTML = ""; // Limpa botões de subtemas antigos
  subtemas.forEach(st => {
    const btn = document.createElement("button");
    btn.classList.add("subtema-btn", "selected")
    btn.textContent = st;
    btn.addEventListener("click", () => {
      btn.classList.toggle("selected")

      let subtemas_selecionados = Array.from(document.querySelectorAll(".subtema-btn.selected")).map(btn => btn.textContent);
      console.log("Subtemas selecionados: ", subtemas_selecionados)
    })
    container.appendChild(btn)
  })
  
}

atualizarTabela();
