import { fetchAutenticado } from "./utils.js";

console.log("Opções do usuário:", sessionStorage.getItem("opcoes_usuario"))

// ===============================
// Elementos principais
// ===============================
const chkNotifImportantes = document.getElementById('notif-importantes');
const chkNotifAdicionais = document.getElementById('notif-adicionais');
const chkInstrucoes = document.getElementById('mostrar-instrucoes-quiz');

const btnSalvar = document.getElementById('btn-salvar-opcoes');
const btnVoltarMenu = document.getElementById('btn-voltar-menu')
const statusLabel = document.getElementById('opcoes-status');

btnVoltarMenu.addEventListener("click", () => {
  window.location.href = '/home';
});

// Checkboxes de temas (quando existirem no HTML)
const temasCheckboxes = document.querySelectorAll('input[name="temas-interesse"]');

// ===============================
// Estado inicial (snapshot)
// ===============================
let estadoInicial = null;

// ===============================
// Funções utilitárias
// ===============================
function obterEstadoAtual() {
  return {
    exibir_instrucoes_quiz: chkInstrucoes.checked,
    notificacoes_importantes: chkNotifImportantes.checked,
    notificacoes_adicionais: chkNotifAdicionais.checked,
    temas_interesse: Array.from(temasCheckboxes)
      .filter(chk => chk.checked)
      .map(chk => chk.value)
      .sort()
  };
}

function houveAlteracao() {
  const atual = obterEstadoAtual();
  return JSON.stringify(atual) !== JSON.stringify(estadoInicial);
}

function atualizarBotaoSalvar() {
  btnSalvar.style.display = houveAlteracao() ? 'block' : 'none';
  statusLabel.textContent = '';
  statusLabel.classList.remove('sucesso', 'erro');
}

// ===============================
// Regras de dependência
// ===============================
function atualizarEstadoNotificacoes() {
  if (!chkNotifImportantes.checked) {
    chkNotifAdicionais.checked = false;
    chkNotifAdicionais.disabled = true;
  } else {
    chkNotifAdicionais.disabled = false;
  }
}

// ===============================
// Carregar estado inicial
// ===============================
function carregarEstadoInicial() {
  const dados = sessionStorage.getItem('opcoes_usuario');
  console.log("Dados são: ", dados)

  if (dados) {
    console.log("Entrei aqui")
    const opcoes = JSON.parse(dados);

    chkInstrucoes.checked = opcoes.exibir_instrucoes_quiz;
    chkNotifImportantes.checked = opcoes.notificacoes_importantes;
    chkNotifAdicionais.checked = opcoes.notificacoes_adicionais;
    
    temasCheckboxes.forEach(chk => {
      chk.checked = opcoes.temas_interesse.includes(chk.value);
    });

    atualizarEstadoNotificacoes();

    estadoInicial = obterEstadoAtual();
    atualizarBotaoSalvar();
    setTelaBloqueada(false);
  }
}

function mostrarStatus(mensagem, tipo) {
  statusLabel.textContent = mensagem;
  statusLabel.classList.remove('sucesso', 'erro', 'loading');

  if (tipo) {
    statusLabel.classList.add(tipo);
  }
}

function setTelaBloqueada(bloquear) {
  document.body.classList.toggle('tela-bloqueada', bloquear);

  btnSalvar.disabled = bloquear;

  chkNotifImportantes.disabled = bloquear;
  chkNotifAdicionais.disabled = bloquear;
  chkInstrucoes.disabled = bloquear;

  temasCheckboxes.forEach(chk => {
    chk.disabled = bloquear;
  });
}

// ===============================
// Eventos
// ===============================
chkNotifImportantes.addEventListener('change', () => {
  atualizarEstadoNotificacoes();
  atualizarBotaoSalvar();
});

[
  chkNotifAdicionais,
  chkInstrucoes,
  ...temasCheckboxes
].forEach(el => {
  el.addEventListener('change', atualizarBotaoSalvar);
});

// ===============================
// Salvar opções
// ===============================
btnSalvar.addEventListener('click', async () => {
  const payload = obterEstadoAtual();

  mostrarStatus('Salvando alterações...', 'loading');
  setTelaBloqueada(true);

  try {
    const resp = await fetchAutenticado('/api/salvar-opcoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });

    if (!resp.ok) throw new Error();

    estadoInicial = payload;
    sessionStorage.setItem('opcoes_usuario', JSON.stringify(payload));

    atualizarBotaoSalvar();
    mostrarStatus('Opções salvas com sucesso', 'sucesso');

  } catch (e) {
    mostrarStatus('Erro ao salvar opções', 'erro');
  } finally {
    setTelaBloqueada(false);
  }
});

// ===============================
// Inicialização
// ===============================
carregarEstadoInicial();