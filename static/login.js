document.addEventListener('DOMContentLoaded', function () {
  // Limpa o armazenamento local para evitar dados de sessões anteriores
  localStorage.clear();

  // Variáveis globais para CAPTCHA
  let captchaToken = null;
  let selecoes = [];
  let carregando_captcha = false;

  // Abas
  const login_tab = document.getElementById('login-tab');
  const register_tab = document.getElementById('register-tab');
  const forgot_tab = document.getElementById('forgot-tab');

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
  
  // CAPTCHA elementos (pode ser undefined se o HTML não tiver)
  const captchaContainer = document.getElementById('captcha-container');
  const captchaInstrucao = document.getElementById('captcha-instrucao');
  const captchaGrid = document.getElementById('captcha-grid');
  const inputCaptchaToken = document.getElementById('captcha-token');
  const inputCaptchaSelecoes = document.getElementById('captcha-selecoes');

  // Estado inicial
  if (captchaContainer) captchaContainer.hidden = true;  // garantia extra
  if (btnRegister) btnRegister.disabled = false;         // botão ativo até usuário clicar (submit controlará)

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
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, senha,
          captcha_token: captchaToken,
          captcha_selecoes: selecoes
        })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => null);
        throw new Error(`Servidor respondeu com status ${response.status} ${text || ''}`);
      }

      const data = await response.json();

      if (data.success) {
        if (btnRegister) btnRegister.disabled = true;
        if (lbl_mensagem_login) {
          lbl_mensagem_login.style.visibility = 'visible'
          lbl_mensagem_login.style.color = 'green'
          lbl_mensagem_login.textContent = data.message
        }
        this.reset();
        if (captchaContainer) captchaContainer.hidden = true;
        showForm('login', registro_realizado=true);
      } else {
          // Registra a falha no CAPTCHA
          const resposta_captcha = await fetch('/registrar_falha_captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          const info_bloqueio = await resposta_captcha.json();
          console.log("Informações de bloqueio: ", info_bloqueio)
          // Se já está bloqueado, manda para o login e mostra mensagem
          if (info_bloqueio.tentativas_registro > 0 && info_bloqueio.bloqueado_ate > 0) {
            bloquearRegistro(info_bloqueio)
            return;
          }

          // Caso não esteja bloqueado, apenas recarrega o CAPTCHA
          carregarCaptcha();
        }
      
    } catch (error) {
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
        // grava localStorage só se login OK
        localStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao || []));
        localStorage.setItem("dicas_restantes", JSON.stringify(data.dicas_restantes || 0));
        localStorage.setItem("perguntas_restantes", JSON.stringify(data.perguntas_restantes || 0));
        localStorage.setItem("nome_usuario", data.nome_usuario || '');

        window.location.href = "/home";
      } else {
        if (lbl_mensagem_login) {
          lbl_mensagem_login.style.visibility = 'visible';
          lbl_mensagem_login.style.color = 'red';
          lbl_mensagem_login.textContent = data.message || 'Falha no login';
        }
      }
    } catch (error) {
      if (lbl_mensagem_login) {
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
            forgot_message.textContent = 'Não foi possível enviar o e-mail para redefinir senha.';
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
      if (lbl_mensagem_login && !registro_realizado) {
        lbl_mensagem_login.textContent = '';
      }
      if (lbl_mensagem_registro) {
        lbl_mensagem_registro.textContent = '';
        lbl_mensagem_registro.style.visibility = 'hidden';
      }
    } else if (type === 'register') {
      try {
        const response = await fetch("/verificar_bloqueio", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const info_bloqueio = await response.json();

        if ((info_bloqueio.tentativas_registro > 0 && info_bloqueio.bloqueado_ate > 0)) {
          bloquearRegistro(info_bloqueio)
          return;
        }
      } catch (error) {
        console.error("Erro ao verificar bloqueio", error);
      }

      if (register_form) {
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
  showForm('login');
});




 
