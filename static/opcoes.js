import { fetchAutenticado } from "./utils.js";

// ===============================
// Elementos principais
// ===============================
const chkNotifImportantes = document.getElementById('notif-importantes');
const chkNotifAdicionais = document.getElementById('notif-adicionais');
const chkInstrucoes = document.getElementById('mostrar-instrucoes-quiz');

const btnSalvar = document.getElementById('btn-salvar-opcoes');
const btnVoltarMenu = document.getElementById('btn-voltar-menu')
const statusLabel = document.getElementById('opcoes-status');

const inputNovoEmail = document.getElementById('novo-email');
const btnAlterarEmail = document.getElementById('btn-alterar-email');
const email_atual = document.getElementById('email-atual');

btnAlterarEmail.addEventListener('click', async () => {
  const novoEmail = inputNovoEmail.value.trim();

  if (!emailBasicoValido(novoEmail)) {
    mostrarStatus('Informe um e-mail válido', 'erro');
    return;
  }

  mostrarStatus('Alterando e-mail...', 'loading');
  setTelaBloqueada(true);
  btnVoltarMenu.disabled = true;

  try {
    const resp = await fetchAutenticado('/alterar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: novoEmail }
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      throw new Error(data.message || 'Erro');
    }

    email_atual.textContent = inputNovoEmail.value.trim().toLowerCase();
    sessionStorage.setItem('email_usuario', email_atual.textContent);
    inputNovoEmail.value = '';
    mostrarStatus(
      'E-mail alterado. Verifique sua caixa de entrada para confirmar',
      'sucesso'
    );
  }
  catch (e) {
    mostrarStatus(
      e.message || 'Erro ao alterar e-mail',
      'erro'
    );
  }
  finally {
    setTelaBloqueada(false);
    btnVoltarMenu.disabled = false;
  }
});

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
  email_atual.textContent = sessionStorage.getItem("email_usuario");
  const dados = sessionStorage.getItem('opcoes_usuario');

  if (dados) {
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

function emailBasicoValido(email) {
  return email && email.includes('@') && email.includes('.');
}

function mostrarStatus(mensagem, tipo) {
  statusLabel.textContent = mensagem;
  statusLabel.classList.remove('sucesso', 'erro', 'loading');

  if (tipo) {
    statusLabel.classList.add(tipo);
    statusLabel.classList.add("visivel");
  }
}

function setTelaBloqueada(bloquear) {
  document.body.classList.toggle('tela-bloqueada', bloquear);

  btnSalvar.disabled = bloquear;
  btnAlterarEmail.disabled = bloquear;

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