document.getElementById("btn-buscar").addEventListener("click", () => {
    const tema = document.getElementById("tema").value;
    const palavra = document.getElementById("keyword").value.trim();

    buscarPerguntas(tema, palavra);
});

async function buscarPerguntas(tema, palavra) {
    console.log("Botão pressionado")
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
            body: JSON.stringify({ tema: tema, palavra: palavra })
        });

        const dados = await response.json();

        tabela.innerHTML = ""; // limpa antes de preencher

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
            let respostaFormatada = item.resposta;

            // Se for discursiva, a resposta vem como array → transformamos em texto
            if (item.tipo === "Discursiva") {
                if (Array.isArray(respostaFormatada)) {
                    respostaFormatada = respostaFormatada.join(", ");
                }
            }

            const linha = `
                <tr>
                    <td>${item.id_pergunta}</td>
                    <td>${item.tipo}</td>
                    <td>${item.subtemas}</td>
                    <td>${item.enunciado}</td>
                    <td>${respostaFormatada}</td>
                    <td>${item.dificuldade}</td>
                </tr>
            `;

            tabela.insertAdjacentHTML("beforeend", linha);
        });

    } catch (err) {
        console.error("Erro na pesquisa:", err);
        tabela.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; font-weight:bold; color:red;">
                    Erro ao buscar perguntas.
                </td>
            </tr>
        `;
    }
}

// Botão Voltar
document.getElementById("btn-voltar").addEventListener("click", () => {
    window.location.href = "/home";
});