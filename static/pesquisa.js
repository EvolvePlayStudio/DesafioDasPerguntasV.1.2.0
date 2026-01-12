import { fetchAutenticado, exibirMensagem } from "./utils.js";

let tema_anterior = null;
let tema_atual;
let tipo_pergunta;
let contador_perguntas = 0;
let favoritos_selecionados = new Set();
const tabela = document.querySelector("#tabela-perguntas tbody");
const ordem_dificuldades = ["Fácil", "Médio", "Difícil"];
const contadorEl = document.getElementById("contador");
const btn_voltar = document.getElementById("btn-voltar");
const btn_marcar_todas = document.getElementById("marcar-todas");
const btn_pesquisar = document.getElementById("btn-pesquisar");
const btn_salvar_favoritos = document.getElementById("btn-salvar-favoritos");
const btn_revisar = document.getElementById("btn-revisar");
const mensagem = document.getElementById("mensagem");
const MODO_VISITANTE = localStorage.getItem("modoVisitante") === "true";

btn_marcar_todas.disabled = true;

// Implementa a função para retornar para a home
btn_voltar.addEventListener("click", () => {
  window.location.href = '/home';
})

// Implementa a função para selecionar ou desselecionar todas as perguntas
btn_marcar_todas.addEventListener("click", () => {
  const linhas = tabela.querySelectorAll("tr");
  
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

// Implementa a função para pesquisar as perguntas
btn_pesquisar.addEventListener("click", () => {
  pesquisar();
});

// Implementa a função para salvar as perguntas nos favoritos
btn_salvar_favoritos.addEventListener("click", () => {
  if (!MODO_VISITANTE) {
    salvarFavoritos();
  }
})

// Implementa a função para iniciar uma revisão
btn_revisar.addEventListener("click", () => {
  const linhas = tabela.querySelectorAll("tr");
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

function atualizarBotoesSubtemas(subtemas, subtemasSelecionados = new Set()) {
  const container = document.getElementById("container-subtemas");
  container.innerHTML = "";

  subtemas.forEach(st => {
    const btn = document.createElement("button");
    btn.classList.add("subtema-btn");
    btn.textContent = st;

    if (
      subtemasSelecionados.size === 0 ||
      subtemasSelecionados.has(st)
    ) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => {
      btn.classList.toggle("selected");
    });

    container.appendChild(btn);
  });
}

function obterSubtemasSelecionados() {
  return new Set(
    Array.from(document.querySelectorAll(".subtema-btn.selected"))
      .map(btn => btn.textContent)
  );
}

function filtrarPerguntasVisitante(perguntasPorDificuldade) {
  const tipo_pergunta_form = tipo_pergunta.toLowerCase()
  const respondidas = JSON.parse(
    localStorage.getItem("visitante_respondidas")
  )?.[tipo_pergunta_form] || [];

  const respondidasSet = new Set(respondidas);

  const filtradas = {};

  Object.keys(perguntasPorDificuldade).forEach(dificuldade => {
    filtradas[dificuldade] = (perguntasPorDificuldade[dificuldade] || [])
      .filter(p => respondidasSet.has(p.id_pergunta));
  });

  return filtradas;
}

async function pesquisar() {
  btn_marcar_todas.disabled = true;

  function renderizarPerguntas(perguntasPorDificuldade) {
    let totalRenderizadas = 0;
    tabela.innerHTML = "";

    const dificuldadesSelecionadas = Array.from(
      document.querySelectorAll(".filtro-centro input[type='checkbox']:checked")
    ).map(cb => cb.value);

    const subtemasSelecionados = Array.from(
      document.querySelectorAll(".subtema-btn.selected")
    ).map(btn => btn.textContent);

    ordem_dificuldades.forEach(dificuldade => {
      if (!dificuldadesSelecionadas.includes(dificuldade)) return;

      (perguntasPorDificuldade[dificuldade] || []).forEach(p => {

        const temSubtemaValido =
          subtemasSelecionados.length === 0 ||
          (p.subtemas && p.subtemas.some(st => subtemasSelecionados.includes(st)));

        if (!temSubtemaValido) return;

        const tr = document.createElement("tr");
        tr.dataset.id = p.id_pergunta;
        tr.dataset.dificuldade = p.dificuldade;

        tr.innerHTML = `
          <td>${p.id_pergunta}</td>
          <td>${tema_atual}</td>
          <td>${(p.subtemas || []).join(" / ")}</td>
          <td>${p.enunciado}</td>
          <td>${p.dificuldade}</td>
          <td class="checkbox-center">
            <input type="checkbox" class="checkbox-selecionar" data-id="${p.id_pergunta}" disabled>
          </td>
          <td>
            <span class="estrela" data-id="${p.id_pergunta}" data-tipo-pergunta="${tipo_pergunta}">☆</span>
          </td>
        `;

        identificarMudancaCheck(tr.querySelector("input"));
        tr.querySelector(".estrela").addEventListener("click", () =>
          toggleFavorito(tr.querySelector(".estrela"), p.id_pergunta)
        );

        tabela.appendChild(tr);
        totalRenderizadas++;
      });
    });

    if (totalRenderizadas === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; font-weight:bold;">
            Nenhuma pergunta encontrada
          </td>
        </tr>
      `;
    }
  }

  tema_atual = document.getElementById("tema").value;
  tipo_pergunta = document.getElementById("tipo-pergunta").value;

  let subtemasSelecionadosAntes = new Set();
  if (tema_atual === tema_anterior) {
    subtemasSelecionadosAntes = obterSubtemasSelecionados();
  }
  tema_anterior = tema_atual

  if (!tema_atual || !tipo_pergunta) {
    exibirMensagem(mensagem, "Selecione o tema e o tipo de pergunta.", "orange", true, true);
    return;
  }

  // Estado visual inicial
  tabela.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; font-weight:bold;">
        Buscando...
      </td>
    </tr>
  `;

  contadorEl.textContent = contador_perguntas = 0;
  btn_marcar_todas.textContent = "Marcar Todas";
  favoritos_selecionados.clear();

  // Busca as perguntas
  try {
    const response = await fetchAutenticado(
      `/api/perguntas?tema=${tema_atual}&modo=revisao&tipo-de-pergunta=${tipo_pergunta}`
    );

    if (!response.ok) throw new Error("Erro na busca");

    const data = await response.json();

    let perguntasPorDificuldade = null;
    if (MODO_VISITANTE) {

      if (!localStorage.getItem("pontuacoes_visitante")) {
        const pontuacoes = {};

        const temas = [
          "Artes", "Astronomia", "Biologia", "Esportes", "Filosofia",
          "Geografia", "História", "Mídia", "Música",
          "Química", "Tecnologia", "Variedades"
        ];

        temas.forEach(tema => {
          pontuacoes[tema] = 2500;
        });
      localStorage.setItem("pontuacoes_visitante", JSON.stringify(pontuacoes));
      }
      perguntasPorDificuldade = filtrarPerguntasVisitante(data.perguntas)
    }
    else { // Usuário logado
      localStorage.setItem("pontuacoes_usuario", JSON.stringify(data.pontuacoes_usuario));
      perguntasPorDificuldade = data.perguntas;
    }
    localStorage.setItem("perguntas_para_revisar", JSON.stringify(perguntasPorDificuldade));

    const subtemasDisponiveis = new Set();

    // Descobre subtemas disponíveis
    ordem_dificuldades.forEach(dif => {
      (perguntasPorDificuldade[dif] || []).forEach(p => {
        (p.subtemas || []).forEach(st => subtemasDisponiveis.add(st));
      });
    });

    if (subtemasDisponiveis.size === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; font-weight:bold;">
            Nenhuma pergunta encontrada
          </td>
        </tr>
      `;
      return;
    }
    
    atualizarBotoesSubtemas(
      [...subtemasDisponiveis].sort((a, b) =>
        a.localeCompare(b, "pt", { sensitivity: "base" })
      ),
      subtemasSelecionadosAntes
    );

    // Renderiza tabela respeitando filtros
    renderizarPerguntas(perguntasPorDificuldade);

    // Carrega favoritos e já deixa marcadas para revisão as perguntsa
    if (!MODO_VISITANTE) {
      carregarFavoritos();
    }

    // Reativa as checks para marcar perguntas e o botão "Marcar todas" 
    document.querySelectorAll(".checkbox-selecionar")
    .forEach(cb => cb.disabled = false);
    btn_marcar_todas.disabled = false;
  }
  catch (err) {
    console.error(err);
    tabela.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; font-weight:bold; color:red;">
          Erro ao buscar perguntas
        </td>
      </tr>
    `;
  }
}

function toggleFavorito(estrelaEl, id_pergunta)  {

  if (MODO_VISITANTE) {
    exibirMensagem(
      mensagem,
      "É necessário criar uma conta para poder salvar perguntas nos favoritos",
      "orange",
      true,
      true
    );
    return;
  }

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
  btn_marcar_todas.textContent = 'Marcar Todas';
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
        checkbox.checked = true;
        contador_perguntas ++;
      }
    contadorEl.textContent = contador_perguntas;
    
    if (favoritos_selecionados.size === tabela.rows.length) {
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

function identificarMudancaCheck (checkbox) {
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      contador_perguntas++;
      if (contador_perguntas === tabela.rows.length) {
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
