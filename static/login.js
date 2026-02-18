import { playSound, playKeySound } from './sound.js'

function gtag_report_conversion() { 
  gtag('event', 'conversion', {
    'send_to': 'AW-17529321916/TyLzCMyw5sobELzz0KZB'
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Adiciona áudio nas caixas de texto
  const caixasTexto = document.querySelectorAll("#email, #senha, #nome-registro, #email-registro, #senha-registro, #confirmar-senha-registro")
  caixasTexto.forEach(caixa => {caixa.addEventListener("keydown", (e) => {playKeySound(e)})});
  
  // Adiciona áudio nos checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      playSound("checkbox")})
  })

  // Trecho abaixo se repete em home.js, talvez vire função do utils.js
  let idVisitante = localStorage.getItem("id_visitante");
  if (!idVisitante) {
    idVisitante = crypto.randomUUID();
    localStorage.setItem("id_visitante", idVisitante);
  }
  fetch("/api/registrar_visitante", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_visitante: idVisitante })
  }).catch(() => console.warn("Falha ao registrar modo visitante"));

  // Implementa a função de click no botão de entrar sem login
  const btnEntrarSemLogin = document.getElementById("entrar-visitante")
  btnEntrarSemLogin.addEventListener("click", () => {
    playSound("click");
    sessionStorage.setItem("modoVisitante", "true");
    sessionStorage.setItem("modoVisitante", "true");
    window.location.href = "/entrar_visitante";
  })

  // Variáveis globais para CAPTCHA
  let captchaToken = null;
  let selecoes = [];
  let carregando_captcha = false;

  // Abas
  const login_tab = document.getElementById('login-tab');
  const register_tab = document.getElementById('register-tab');
  const forgot_tab = document.getElementById('forgot-tab');

  login_tab.addEventListener("click", () => showForm('login'));
  register_tab.addEventListener("click", async() => {
    await fetch("/pagina_destino", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagina_destino: "Login -> Registro" })
    });
    showForm('register');
  });

  // Formulários
  const login_form = document.getElementById('login-form');
  const register_form = document.getElementById('register-form');
  const forgot_form = document.getElementById("forgot-form");

  // Mensagens
  const forgot_message = document.getElementById("forgot-message");
  const lbl_mensagem_login = document.getElementById("login-message");
  const lbl_mensagem_registro = document.getElementById("registro-message");

  // Outras variáveis
  const info_section = document.querySelector('.info-section');
  const btnRegister = register_form?.querySelector('button[type="submit"]');

  // Check para migrar dados
  const container_migrar_dados_visitante = document.getElementById("container-migrar-dados-visitante");
  const check_migrar_dados = document.getElementById("usar-dados-visitante");

  // Check para notificar bônus de energia
  const container_notificacoes_bonus_energia = document.getElementById("container-notificacoes-bonus-energia");
  const check_notificacoes_bonus_energia = document.getElementById("check-notificacoes-bonus-energia");

  // Check para notificar alterações nas pontuações
  const container_notificacoes_alteracoes_pontos = document.getElementById("container-notificacoes-alteracoes-pontos");
  const check_notificacoes_alteracoes_pontos = document.getElementById("check-notificacoes-alteracoes-pontos");


  // Check para notificar atualizações do site
  const container_notificacoes_atualizacoes_site = document.getElementById("container-notificacoes-atualizacoes-site");
  const check_notificacoes_atualizacoes_site = document.getElementById("check-notificacoes-atualizacoes-site");

  const containersChecks = [container_migrar_dados_visitante, container_notificacoes_bonus_energia, container_notificacoes_alteracoes_pontos, container_notificacoes_atualizacoes_site];

  // const checksRegistro = [check_migrar_dados, check_notificacoes_bonus_energia, check_notificacoes_alteracoes_pontos, check_notificacoes_atualizacoes_site];

  const hasVisitorData = localStorage.getItem('visitante_respondidas') || localStorage.getItem('visitante_avaliacoes');

  // CAPTCHA elementos (pode ser undefined se o HTML não tiver)
  const captchaContainer = document.getElementById('captcha-container');
  const captchaInstrucao = document.getElementById('captcha-instrucao');
  const captchaGrid = document.getElementById('captcha-grid');
  const inputCaptchaToken = document.getElementById('captcha-token');
  const inputCaptchaSelecoes = document.getElementById('captcha-selecoes');

  const msg = localStorage.getItem("auth_message");
  if (msg) {
    lbl_mensagem_login.display = '';
    lbl_mensagem_login.style.visibility = 'visible';
    lbl_mensagem_login.style.color = 'red';
    lbl_mensagem_login.textContent = msg;
    localStorage.removeItem("auth_message");
  }

  // Estado inicial
  if (captchaContainer) captchaContainer.hidden = true;  // Garantia extra
  if (btnRegister) btnRegister.disabled = false;         // Botão ativo até usuário clicar (submit controlará)

  // Função para carregar CAPTCHA da API e montar interface
  async function carregarCaptcha() {
    if (carregando_captcha) return;
    carregando_captcha = true;

    // Esvazia mensagens de erro antes de mostrar o CAPTCHA
    if (lbl_mensagem_registro) {
      lbl_mensagem_registro.textContent = '';
      lbl_mensagem_registro.style.visibility = 'hidden'
    }

    try {
      // Se não houver container, nada a fazer
      if (!captchaGrid || !captchaInstrucao) return;

      // Reset seleções e token
      selecoes = [];
      captchaToken = null;
      if (inputCaptchaSelecoes) inputCaptchaSelecoes.value = '';
      if (inputCaptchaToken) inputCaptchaToken.value = '';

      // Limpa grid
      captchaGrid.innerHTML = '';

      // Busca novo CAPTCHA
      const resp = await fetch('/captcha_novo');
      if (!resp.ok) {
        throw new Error(`Erro ao carregar CAPTCHA: ${resp.status}`);
      }
      const data = await resp.json();

      captchaToken = data.token;
      if (inputCaptchaToken) inputCaptchaToken.value = captchaToken;

      // Instrução
      captchaInstrucao.textContent = `Selecione as imagens que contêm "${data.categoria}"`;

      // Monta imagens
      data.imagens.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `captcha img ${index + 1}`;
        img.style.cursor = 'pointer';
        img.style.border = '3px solid transparent';
        img.style.borderRadius = '6px';
        img.style.userSelect = 'none';
        img.width = 100;
        img.height = 100;

        img.addEventListener('click', () => {
          if (selecoes.includes(index)) {
            // Desmarca
            selecoes = selecoes.filter(i => i !== index);
            img.style.borderColor = 'transparent';
          } else {
            // Limita a 3 seleções
            if (selecoes.length >= 3) {
              if (lbl_mensagem_registro) {
                lbl_mensagem_registro.style.visibility = 'visible';
                lbl_mensagem_registro.style.color = 'red';
                lbl_mensagem_registro.textContent = 'Você só pode selecionar 3 imagens';
                setTimeout(() => {
                  if (lbl_mensagem_registro) lbl_mensagem_registro.style.visibility = 'hidden';
                }, 2000);
              }
              return;
            }
            // Marca
            selecoes.push(index);
            img.style.borderColor = '#007bff';
          }

          // Atualiza input hidden para envio (se existir)
          if (inputCaptchaSelecoes) inputCaptchaSelecoes.value = JSON.stringify(selecoes);

          // Atualiza o estado do botão registrar imediatamente
          if (btnRegister) btnRegister.disabled = (selecoes.length !== 3);
        });

        captchaGrid.appendChild(img);
      });
    } catch (error) {
      console.error('Erro ao carregar CAPTCHA:', error);
    } finally {
      carregando_captcha = false;
    }
  }

  // Submissão do formulário de registro
  if (register_form) {
    register_form?.addEventListener('submit', async function (event) {
      playSound("click");
      event.preventDefault();

      const nome = this.nome?.value.trim();
      const email = this.email?.value.trim();
      const senha = this.senha?.value;
      const confirmar_senha = this.confirmar_senha?.value;

      // Validações locais simples
      if (!nome) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'O nome é obrigatório';
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'Informe um e-mail válido';
        return;
      }

      if (senha !== confirmar_senha) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'As senhas não coincidem';
        return;
      }

      if (!senha || senha.length < 6) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'A senha deve ter pelo menos 6 caracteres';
        return;
      }

      // Se o CAPTCHA não está visível, primeiro valida o registro no backend
      if (!captchaContainer || captchaContainer.hidden) {
        try {
          const validaResponse = await fetch('/register_validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
          });

          if (!validaResponse.ok) {
            throw new Error(`Erro na validação: ${validaResponse.status}`);
          }

          const validaData = await validaResponse.json();

          if (!validaData.success) {
            lbl_mensagem_registro.style.visibility = 'visible';
            lbl_mensagem_registro.style.color = 'red';
            lbl_mensagem_registro.textContent = validaData.message || 'Erro na validação';
            return;
          }

          // Se passou na validação, exibe o CAPTCHA
          if (captchaContainer) {
            //container_migrar_dados_visitante.style.display = "none";
            //container_notificacoes_bonus_energia.style.display = "none";
            containersChecks.forEach(c => c.style.display = "none");
            captchaContainer.hidden = false;

            register_form.querySelectorAll('input, label, .form-group').forEach(el => {
              if (!el.closest('#captcha-container')) {
                el.style.display = 'none';
              }
            });

            if (btnRegister) btnRegister.disabled = true;
            await carregarCaptcha();
          }
        } catch (error) {
          lbl_mensagem_registro.style.visibility = 'visible';
          lbl_mensagem_registro.style.color = 'red';
          lbl_mensagem_registro.textContent = 'Erro na comunicação com o servidor';
          console.error('Erro validação registro:', error);
        }

        return; // Espera o usuário completar CAPTCHA e submeter de novo
      }

      // Aqui já está no passo do CAPTCHA
      if (selecoes.length !== 3) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'Selecione exatamente 3 imagens no CAPTCHA';
        return;
      }

      // Envia dados para registrar usuário com CAPTCHA
      try {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = '#d1d1d1ff';
        lbl_mensagem_registro.textContent = 'Fazendo registro...';

        const response = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome, email, senha,
            captcha_token: captchaToken,
            captcha_selecoes: selecoes,
            id_visitante: localStorage.getItem("id_visitante"),
            usar_dados_visitante: check_migrar_dados.checked,
            notificacoes_bonus_energia: check_notificacoes_bonus_energia.checked,
            notificacoes_alteracoes_pontos: check_notificacoes_alteracoes_pontos.checked,
            notificacoes_atualizacoes_site: check_notificacoes_atualizacoes_site.checked
          })
        });

        if (!response.ok) {
          const text = await response.text().catch(() => null);
          throw new Error(`Servidor respondeu com status ${response.status} ${text || ''}`);
        }

        const data = await response.json();

        if (data.success) {
          // Registra meta de conversão de registro no GoogleAds
          if (typeof gtag_report_conversion === 'function') {
              gtag_report_conversion(); 
          }
          
          // Chama novamente a tela de login
          if (btnRegister) btnRegister.disabled = true;
          if (lbl_mensagem_login) {
            lbl_mensagem_login.style.display = '';
            lbl_mensagem_login.style.visibility = 'visible'
            lbl_mensagem_login.style.color = 'green'
            lbl_mensagem_login.textContent = data.message
          }
          this.reset();
          if (captchaContainer) captchaContainer.hidden = true;
          showForm('login', true);
        }
        else {
            // Registra a falha no CAPTCHA
            const resposta_captcha = await fetch('/registrar_falha_captcha', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });

            const info_bloqueio = await resposta_captcha.json();
            // Se já está bloqueado, manda para o login e mostra mensagem
            if (info_bloqueio.tentativas_registro > 0 && info_bloqueio.bloqueado_ate > 0) {
              bloquearRegistro(info_bloqueio)
              return;
            }

            // Caso não esteja bloqueado, apenas recarrega o CAPTCHA
            carregarCaptcha();
          }
        
      }
      catch (error) {
        lbl_mensagem_registro.style.visibility = 'visible';
        lbl_mensagem_registro.style.color = 'red';
        lbl_mensagem_registro.textContent = 'Erro na comunicação com o servidor';
        console.error('register submit error:', error);
      }
    });
  }

  // Submissão do formulário de login
  if (login_form) {
  login_form?.addEventListener("submit", async function (event) {
    playSound("click");
    event.preventDefault();

    const email = document.getElementById("email")?.value;
    const senha = document.getElementById("senha")?.value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => null);
        throw new Error(`Erro no login: ${response.status} ${text || ''}`);
      }

      const data = await response.json();

      if (data.success) {
        // Grava informações no sessionStorage
        sessionStorage.setItem("id_usuario", data.id_usuario);
        sessionStorage.setItem("dicas_restantes", JSON.stringify(data.dicas_restantes || 0));
        sessionStorage.setItem("perguntas_restantes", JSON.stringify(data.perguntas_restantes || 0));
        sessionStorage.setItem("nome_usuario", data.nome_usuario || '');

        if (data.opcoes_usuario) sessionStorage.setItem('opcoes_usuario', JSON.stringify(data.opcoes_usuario));
        sessionStorage.setItem("modal_confirmacao_email_exibido", false);
        sessionStorage.setItem("email_usuario", data.email);
        sessionStorage.setItem("token_sessao", data.token);
        sessionStorage.setItem("modoVisitante", "false");
        window.location.href = "/home";
      } 
      else {
        if (lbl_mensagem_login) {
          lbl_mensagem_login.style.display = '';
          lbl_mensagem_login.style.visibility = 'visible';
          lbl_mensagem_login.style.color = 'red';
          lbl_mensagem_login.textContent = data.message || 'Falha no login';
        }
      }
    }
    catch (error) {
      if (lbl_mensagem_login) {
        lbl_mensagem_login.style.display = '';
        lbl_mensagem_login.style.visibility = 'visible';
        lbl_mensagem_login.style.color = 'red';
        lbl_mensagem_login.textContent = 'Erro na comunicação com o servidor';
      }
      console.error('login submit error:', error);
    }
  });
  }

  // Submissão do formulário "esqueci a senha"
  if (forgot_form) {
    forgot_form?.addEventListener("submit", async function (event) {
      event.preventDefault();
      const email = document.getElementById('forgot-email')?.value?.trim();
      if (!email) {
        if (forgot_message) {
          forgot_message.style.visibility = 'visible';
          forgot_message.style.color = 'red';
          forgot_message.textContent = 'Informe um e-mail válido.';
        }
        return;
      }

      // feedback visual
      if (forgot_message) {
        forgot_message.style.visibility = 'visible';
        forgot_message.style.color = '#333';
        forgot_message.textContent = 'Enviando...';
      }

      try {
        const resp = await fetch('/recuperação-de-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Erro servidor: ${resp.status} ${txt}`);
        }

        const data = await resp.json();
        if (data.success) {
          if (forgot_message) {
            forgot_message.style.color = 'green';
            forgot_message.textContent = data.message || 'E-mail enviado. Verifique sua caixa de entrada.';
          }
          // opcional: limpar campo
          forgot_form.reset();

          // volta para o login após 2s
          setTimeout(() => showForm('login'), 2500);
        } else {
          if (forgot_message) {
            forgot_message.style.color = 'red';
            forgot_message.textContent = 'Não foi possível enviar o e-mail para redefinir senha';
          }
        }
      } catch (err) {
        console.error('Erro forgot_password:', err);
        if (forgot_message) {
          forgot_message.style.color = 'red';
          forgot_message.textContent = 'Erro na comunicação com o servidor.';
        }
      }
    });
  }

  // Função para exibir o formulário correto
  async function showForm(type, registro_realizado=false) {
    // Abas
    login_tab.style.display = (type === "forgot") ? "none" : "inline-block";
    register_tab.style.display = (type === "forgot") ? "none" : "inline-block";
    forgot_tab.style.display = (type === "forgot") ? "inline-block" : "none";

    if (type === 'login') {
      if (forgot_form) forgot_form.style.display = 'none';
      if (forgot_tab) forgot_tab.classList.remove('active');

      login_form.classList.add('active');
      register_form.classList.remove('active');
      login_tab.classList.add('active');
      register_tab.classList.remove('active');
      if (info_section) info_section.style.display = '';
      if (lbl_mensagem_login && !registro_realizado && lbl_mensagem_login.textContent != "Sessão expirada") {
        lbl_mensagem_login.textContent = '';
      }
      if (lbl_mensagem_registro) {
        lbl_mensagem_registro.textContent = '';
        lbl_mensagem_registro.style.visibility = 'hidden';
      }
      btnEntrarSemLogin.style.display = "block"
    }
    else if (type === 'register') {
      try {
        fetch("/acesso/registro", { method: "POST" }).catch(err => console.warn("Não foi possível gravar o acesso à aba de registro", err)); /* Registra acesso na base de dados*/
        let response;
        try {
          response = await fetch("/verificar_bloqueio");
        }
        catch (err) {
          console.error("Não foi possível fazer a verificação de bloqueio", err);
          return;
        };
        if (!response.ok) {
          console.error("Erro HTTP ao verificar bloqueio", response.status)
          return;
        }
        const info_bloqueio = await response.json();
        
        if (info_bloqueio.bloqueado) {
          bloquearRegistro(info_bloqueio);
          return;
        };
        btnEntrarSemLogin.style.display = "none"
      } 
      catch (error) {
        console.error("Erro ao verificar bloqueio", error);
      }

      if (register_form) {

        // Exibe os containers dos checkboxes da aba registro
        hasVisitorData ? container_migrar_dados_visitante.style.display = "none" :  container_migrar_dados_visitante.style.display = "none";
        containersChecks.forEach(c => c.style.display = '');

        register_form.classList.add('active');
        login_form.classList.remove('active');
        register_tab.classList.add('active');
        login_tab.classList.remove('active');

        register_form.querySelectorAll('input, label, .form-group').forEach(el => {
          if (!el.closest('#captcha-container')) {
            el.style.display = '';
            el.disabled = false;
          }
        });

        const captchaContainer = document.getElementById('captcha-container');
        if (captchaContainer) captchaContainer.hidden = true;
        if (info_section) info_section.style.display = 'none';
        if (btnRegister) btnRegister.disabled = false;

        register_form.reset();

        if (lbl_mensagem_registro) {
          lbl_mensagem_registro.textContent = '';
          lbl_mensagem_registro.style.visibility = 'hidden';
        }
      }

      selecoes = [];
      captchaToken = null;
    }
    else if (type === 'forgot') {
      // Esconde login e registro
      if (login_form) login_form.classList.remove('active');
      if (register_form) register_form.classList.remove('active');

      // Esconde abas (nenhuma deve ficar ativa)
      if (login_tab) login_tab.classList.remove('active');
      if (register_tab) register_tab.classList.remove('active');

      if (forgot_tab) forgot_tab.classList.add('active');

      // Esconde info extra
      if (info_section) info_section.style.display = 'none';

      // Esconde botão de entrar sem login
      btnEntrarSemLogin.style.display = "none"

      // Mostra forgot
      if (forgot_form) {
        forgot_form.style.display = 'block';
        forgot_form.reset();
      }

      // Limpa mensagens
      if (lbl_mensagem_login) lbl_mensagem_login.textContent = '';
      if (lbl_mensagem_registro) {
        lbl_mensagem_registro.textContent = '';
        lbl_mensagem_registro.style.visibility = 'hidden';
      }
      if (forgot_message) {
        forgot_message.style.visibility = 'hidden';
        forgot_message.textContent = '';
      }
    }
  }

  function bloquearRegistro(info_bloqueio) {
    const horario_formatado = info_bloqueio.bloqueado_ate_str
    showForm('login');

    // Exibe mensagem de bloqueio
    if (lbl_mensagem_login) {
      lbl_mensagem_login.style.visibility = 'visible';
      lbl_mensagem_login.style.color = 'red';
      lbl_mensagem_login.textContent = `Registro bloqueado por múltiplas tentativas malsucedidas. Aguarde até ${horario_formatado} para nova tentativa.`;
    }

    // Bloqueia as entradas da tela de registro
    if (register_form) {
      register_form.querySelectorAll('input, button').forEach(el => el.disabled = true);
    }
  }

  window.showForm = showForm;
  if (sessionStorage.getItem("ir_para_aba_registro")) {
    showForm('register', false, false);
  }
  else {
    showForm('login');
  }
  sessionStorage.removeItem("ir_para_aba_registro");
});

