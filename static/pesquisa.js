import { fetchAutenticado, exibirMensagem } from "./utils.js";

let tema_atual;
let tipo_pergunta;
let contador_perguntas = 0;
let favoritos_selecionados = new Set();
const tabela_body = document.querySelector("#tabela-perguntas tbody");
const ordem_dificuldades = ["Fácil", "Médio", "Difícil"];
const contadorEl = document.getElementById("contador");
const btn_marcar_todas = document.getElementById("marcar-todas");
const mensagem = document.getElementById("mensagem")

// Implementa a função para retornar para a home
document.getElementById("btn-voltar").addEventListener("click", () => {
  window.location.href = '/home';
})

// Implementa a função para salvar as perguntas nos favoritos
document.getElementById("btn-salvar-favoritos").addEventListener("click", () => {
  salvarFavoritos();
})

// Implementa a função para selecionar ou desselecionar
btn_marcar_todas.addEventListener("click", () => {
  const linhas = tabela_body.querySelectorAll("tr");
  
  if (btn_marcar_todas.textContent === 'Marcar Todas') {
    linhas.forEach(linha => {
      const checkbox = linha.querySelector("input[type='checkbox']");
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true
      }
    })
    contadorEl.textContent = contador_perguntas = linhas.length;
    btn_marcar_todas.textContent = 'Desmarcar Todas';
  }
  else {
    linhas.forEach(linha => {
      const checkbox = linha.querySelector("input[type='checkbox']");
      if (checkbox && checkbox.checked) {
        checkbox.checked = false
      }
    })
    contadorEl.textContent = contador_perguntas = 0;
    btn_marcar_todas.textContent = 'Marcar Todas';
  }
});

// Implementa a função para aplicar filtro nas perguntas
document.getElementById("aplicar-filtro").addEventListener("click", () => {
  aplicarFiltro();
});

function aplicarFiltro() {
  const perguntasPorDificuldade = JSON.parse(localStorage.getItem("perguntas_para_revisar")) || {
    "Fácil": [],
    "Médio": [],
    "Difícil": []
  };
  btn_marcar_todas.textContent = 'Marcar Todas';
  contadorEl.textContent = contador_perguntas = 0;

  // 1. Dificuldades selecionadas
  const dificuldadesSelecionadas = Array.from(document.querySelectorAll(".filtro-centro input[type='checkbox']:checked"))
    .map(cb => cb.value);

  // 2. Subtemas selecionados
  const subtemasSelecionados = Array.from(document.querySelectorAll(".subtema-btn.selected"))
    .map(btn => btn.textContent);

  tabela_body.innerHTML = ""; // limpa antes de renderizar de novo

  ordem_dificuldades.forEach(dificuldade => {
    if (!dificuldadesSelecionadas.includes(dificuldade)) return; // só mantém dificuldades ativas

    (perguntasPorDificuldade[dificuldade] || []).forEach(p => {
      // Verifica se tem ao menos 1 subtema em comum
      const temSubtemaValido = 
        subtemasSelecionados.length === 0 || // Se não tiver filtro de subtema, mostra tudo
        (p.subtemas && p.subtemas.some(st => subtemasSelecionados.includes(st)));

      if (!temSubtemaValido) return;

      const tr = document.createElement("tr");

      // ID
      const tdId = document.createElement("td");
      tr.dataset.id = p.id_pergunta;
      tdId.textContent = p.id_pergunta;
      tr.appendChild(tdId);

      // Subtemas
      const tdSubtemas = document.createElement("td");
      tdSubtemas.textContent = p.subtemas ? p.subtemas.join(" / ") : "";
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
      checkbox.classList.add("checkbox-selecionar");
      checkbox.dataset.id = p.id_pergunta;
      identificarMudancaCheck(checkbox);
      tdSelecionar.appendChild(checkbox);
      tr.appendChild(tdSelecionar);

      // Favoritar
      const tdFavoritar = document.createElement("td");
      const star = document.createElement("span");
      star.textContent = "☆";
      star.classList.add('estrela');
      star.dataset.id = p.id_pergunta;
      star.dataset.tipoPergunta = tipo_pergunta;
      star.addEventListener("click", async (e) => {
        toggleFavorito(star, Number(p.id_pergunta));
      });
      tdFavoritar.appendChild(star);
      tr.appendChild(tdFavoritar);
      tabela_body.appendChild(tr);
      });
  });
}

// Implementa a função para iniciar uma revisão
document.getElementById("btn-revisar").addEventListener("click", () => {
  const linhas = tabela_body.querySelectorAll("tr");
  const perguntas_totais = JSON.parse(localStorage.getItem("perguntas_para_revisar"));
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
document.getElementById("tema").addEventListener("change", () => {
    atualizarTabela();
});

// Atualiza quando o tipo de pergunta muda
document.getElementById("tipo-pergunta").addEventListener("change", () => {
    atualizarTabela();
});

async function atualizarTabela() {
  function renderizarTabela() {
    const perguntasPorDificuldade = JSON.parse(localStorage.getItem("perguntas_para_revisar")) || {
        "Fácil": [],
        "Médio": [],
        "Difícil": []
    };

    tabela_body.innerHTML = ""; // Limpa antes de renderizar
    const todosSubtemas = new Set();

    // Percorre todas as dificuldades
    ordem_dificuldades.forEach(dificuldade => {(perguntasPorDificuldade[dificuldade] || []).forEach(p => {
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
      else {tdSubtemas.textContent = ""};
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
      checkbox.classList.add("checkbox-selecionar");
      checkbox.dataset.id = p.id_pergunta;
      identificarMudancaCheck(checkbox);
      tdSelecionar.appendChild(checkbox);
      tr.appendChild(tdSelecionar);

      // Favoritar
      const tdFavoritar = document.createElement("td");
      const star = document.createElement("span");
      star.textContent = "☆";
      star.classList.add('estrela');
      star.dataset.id = p.id_pergunta;
      star.dataset.tipoPergunta = tipo_pergunta;
      star.addEventListener("click", async (e) => {
        toggleFavorito(star, Number(p.id_pergunta));
      });
      tdFavoritar.appendChild(star);
      tr.appendChild(tdFavoritar);
      tabela_body.appendChild(tr);
      });
    });
    atualizarBotoesSubtemas([...todosSubtemas].sort((a,b) => a.localeCompare(b,'pt',{ sensitivy:'base'})));
    carregarFavoritos();
  }
  tema_atual = document.getElementById("tema").value;
  tipo_pergunta = document.getElementById("tipo-pergunta").value;
  if (!tema_atual || !tipo_pergunta) return;

  document.getElementById("contador").textContent = contador_perguntas = 0;
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

function toggleFavorito(estrelaEl, id_pergunta)  {
  // Estado atual e novo estado da estrela
  const atualmente = estrelaEl.classList.contains("favorito")
  const novo_estado = !atualmente;

  // Atualiza a estrela visualmente
  estrelaEl.classList.toggle("favorito", novo_estado);
  estrelaEl.textContent = novo_estado? "★": "☆";

  // Atualiza lista temporária
  if (novo_estado) {
    favoritos_selecionados.add(id_pergunta);
  }
  else {
    favoritos_selecionados.delete(id_pergunta);
  }
}

async function carregarFavoritos() {
  try {
    const response = await fetch(`/api/carregar-favoritos?tema-atual=${tema_atual}&tipo-pergunta=${tipo_pergunta}`);
    const result = await response.json();
    contadorEl.textContent = contador_perguntas = 0;
    favoritos_selecionados.clear()
    result["favoritos"].forEach(idp => {
      favoritos_selecionados.add(idp)
      const estrela = document.querySelector(`.estrela[data-id='${idp}']`);
      if (estrela) {
        estrela.classList.add("favorito")
        estrela.textContent = "★"
        const checkbox = document.querySelector(`input[type='checkbox'][data-id='${idp}']`)
        checkbox.checked = true
        contador_perguntas ++;
      }
    contadorEl.textContent = contador_perguntas

    if (favoritos_selecionados.size === tabela_body.rows.length) {
      btn_marcar_todas.textContent = 'Desmarcar Todas';
    }
    });
  }
  catch (err) {
    console.log("Erro ao carregar favoritos: ", err)
  }
}


async function salvarFavoritos() {
  exibirMensagem(mensagem, "Salvando favoritos...", '#d1d1d1ff')
  // IDs visíveis na tabela no momento
  const idsVisiveis = Array.from(document.querySelectorAll("#tabela-perguntas tbody tr"))
    .map(tr => Number(tr.dataset.id));

  // favoritos_selecionados é um Set com os IDs atualmente estrelados (UI)
  const adicionar = idsVisiveis.filter(id => favoritos_selecionados.has(id));
  const remover   = idsVisiveis.filter(id => !favoritos_selecionados.has(id));

  try {
    const response = await fetchAutenticado("/api/favoritos", {
      method: "POST",
      body: { tema_atual, tipo_pergunta, adicionar, remover }
    });
    const result = await response.json()
    if (result.success) {
      console.log(result)
      exibirMensagem(mensagem, "Favoritos salvos com sucesso", 'lime', true, true)
    }
    else {
      exibirMensagem(mensagem, "Erro! não foi possível salvar os favoritos", 'red', true, true)}
  }
  catch (err) {
    exibirMensagem(mensagem, "Erro! não foi possível salvar os favoritos", 'red', true, true);
    console.error("Erro ao salvar favoritos", err);
  }
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
    })
    container.appendChild(btn)
  })
  
}

function identificarMudancaCheck (checkbox) {
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      contador_perguntas++;
      if (contador_perguntas === tabela_body.rows.length) {
        btn_marcar_todas.textContent = 'Desmarcar Todas'
      }
    }
    else {
      contador_perguntas--;
      btn_marcar_todas.textContent = 'Marcar Todas'
    }
    contadorEl.textContent = contador_perguntas;
  })
}

atualizarTabela();
