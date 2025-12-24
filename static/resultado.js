// Exemplo de como popular via JS (dados podem vir de localStorage ou da rota Flask)
const perguntas_respondidas = JSON.parse(localStorage.getItem("perguntas_respondidas"))
const tema_atual = localStorage.getItem("tema_atual");
const tipo_pergunta = localStorage.getItem("tipo_pergunta").toLowerCase();
const pontuacoes_usuario = JSON.parse(localStorage.getItem("pontuacoes_usuario"));
const rankings_usuario = JSON.parse(localStorage.getItem("rankings_usuario"));
const pontuacao_anterior = localStorage.getItem("pontuacao_anterior");
const nova_pontuacao = pontuacoes_usuario[tema_atual];
const valor_saldo = Number(nova_pontuacao) - Number(pontuacao_anterior);
let str_saldo;
let cor_saldo;
let peso_fonte_saldo;
if (valor_saldo > 0) {
    cor_saldo = 'lime';
    str_saldo = `+${valor_saldo}`;
    peso_fonte_saldo = 'bold';
}
else if (valor_saldo < 0) {
    cor_saldo = 'red';
    str_saldo = valor_saldo;
    peso_fonte_saldo = 'bold';
}
else {
    cor_saldo = 'black';
    str_saldo = valor_saldo;
    peso_fonte_saldo = 'normal';
}

const resultado = {
    tema: `${tema_atual} (${tipo_pergunta})`,
    pontuacaoAnterior: pontuacao_anterior,
    pontuacaoFinal: nova_pontuacao,
    saldo: str_saldo,
    ranking_atual: rankings_usuario[tema_atual],
    perguntas_respondidas: perguntas_respondidas
};

document.getElementById("tema-perguntas").textContent = resultado.tema;
document.getElementById("pontuacao-anterior").textContent = resultado.pontuacaoAnterior;
document.getElementById("pontuacao-final").textContent = resultado.pontuacaoFinal;
label_saldo = document.getElementById("pontuacao-saldo")
label_saldo.textContent = resultado.saldo;
label_saldo.style.color = cor_saldo;
label_saldo.style.fontWeight = peso_fonte_saldo;
document.getElementById("ranking-atual").textContent = resultado.ranking_atual;

const lista = document.getElementById("lista-perguntas");
resultado.perguntas_respondidas.forEach((p, i) => {
    const div = document.createElement("div");
    div.classList.add("pergunta");
    let correta;
    let str_pontos_ganhos;
    if (Number(p.pontos_ganhos) > 0) {
    str_pontos_ganhos = `+${p.pontos_ganhos}`;
    correta = true;
    }
    else {
    str_pontos_ganhos = p.pontos_ganhos;
    correta = false;
    }

    const cor_pontuacao = correta? 'lime': 'red'
    let cor_dificuldade;
    switch (p.dificuldade.toLowerCase()) {
    case "fácil":
        cor_dificuldade = 'green';
        break;
    case "médio":
        cor_dificuldade = 'gold';
        break;
    case "difícil":
        cor_dificuldade = 'red';
        break;
    default:
        cor_dificuldade = 'black'
    }

    if (tipo_pergunta === 'discursiva') {
      const texto_usou_dica = p.usou_dica? 'Sim': 'Não';
      div.innerHTML = `
      <p><strong>Dificuldade:</strong> <span style="color: ${cor_dificuldade}">${p.dificuldade}</span></p>
      <p style="font-family: 'Noto Serif', 'Roboto', serif, sans-serif; font-weight: bold;"><strong>${i+1}-</strong> ${p.enunciado}</p>
      <p><strong>Sua resposta:</strong> <span style="color:${cor_pontuacao}">${p.resposta_usuario}</span></p>
      <p><strong>Respostas aceitas:</strong> ${p.respostas_aceitas.join(" / ")}</p>
      <p><strong>Usou dica:</strong> ${texto_usou_dica} </p>
      <p><strong>Pontos ganhos:</strong> <span style=color:${cor_pontuacao}>${str_pontos_ganhos}</span></p>
      `;
    }
    else {
        cor_alternativa_a = cor_alternativa_b = cor_alternativa_c = cor_alternativa_d = 'black';
        if (p.resposta_correta === 'A') {
            cor_alternativa_a = 'lime'
        }
        else if (p.resposta_correta === 'B') {
            cor_alternativa_b = 'lime'
        }
        else if (p.resposta_correta === 'C') {
            cor_alternativa_c = 'lime'
        }
        else if (p.resposta_correta === 'D') {
            cor_alternativa_d = 'lime'
        }
        if (p.resposta_correta !== p.resposta_usuario) {
            if (p.resposta_usuario === 'A') {
                cor_alternativa_a = 'red'
            }
            else if (p.resposta_usuario === 'B') {
                cor_alternativa_b = 'red'
            }
            else if (p.resposta_usuario === 'C') {
                cor_alternativa_c= 'red'
            }
            else if (p.resposta_usuario === 'D') {
                cor_alternativa_d = 'red'
            }
        }

        div.innerHTML = `
        <p><strong>Dificuldade:</strong> <span style="color: ${cor_dificuldade}">${p.dificuldade}</span></p>
        <p style="font-family: 'Noto Serif', 'Roboto', serif, sans-serif; font-weight: bold;"><strong>${i+1}-</strong> ${p.enunciado}</p>
        <p style="font-weight: bold; color: ${cor_alternativa_a};"><strong>A)</strong> ${p.alternativa_a}</p>
        <p style="font-weight: bold; color: ${cor_alternativa_b};"><strong>B)</strong> ${p.alternativa_b}</p>
        <p style="font-weight: bold; color: ${cor_alternativa_c};"><strong>C)</strong> ${p.alternativa_c}</p>
        <p style="font-weight: bold; color: ${cor_alternativa_d};"><strong>D)</strong> ${p.alternativa_d}</p>
        <p><strong>Pontos ganhos:</strong> <span style="color:${cor_pontuacao}">${str_pontos_ganhos}</span></p>
        `
    }
    lista.appendChild(div);
});