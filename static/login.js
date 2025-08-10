document.addEventListener('DOMContentLoaded', function () {
  // Limpa o armazenament local para evitar dados de sessões anteriores
  localStorage.clear()
  const login_tab = document.getElementById('login-tab');
  const register_tab = document.getElementById('register-tab');
  const login_form = document.getElementById('login-form');
  const register_form = document.getElementById('register-form');
  const lbl_mensagem_login = document.getElementById("login-message");
  const lbl_mensagem_registro = document.getElementById("registro-message");

  function showForm(type) {
    if (type === 'login') {
      login_form.classList.add('active');
      register_form.classList.remove('active');
      login_tab.classList.add('active');
      register_tab.classList.remove('active');
    } else if (type === 'register') {
      register_form.classList.add('active');
      login_form.classList.remove('active');
      register_tab.classList.add('active');
      login_tab.classList.remove('active');
    }
  }

  showForm('login');
  window.showForm = showForm;

 
  register_form.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const nome = this.nome?.value.trim();
    const email = this.email?.value.trim();
    const senha = this.senha?.value;
    const confirmar_senha = this.confirmar_senha?.value;
    // A parte abaixo será removida quando o app estiver em produção
    const invite_token = this.invite_token?.value

    if (senha !== confirmar_senha) {
      lbl_mensagem_registro.style.visibility = 'visible'
      lbl_mensagem_registro.style.color = 'red'
      lbl_mensagem_registro.textContent = 'As senhas não coincidem'
      return;
    }
    if (senha.length < 6) {
      lbl_mensagem_registro.style.visibility = 'visible'
      lbl_mensagem_registro.style.color = 'red'
      lbl_mensagem_registro.textContent = 'A senha deve ter pelo menos 6 caracteres'
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, invite_token })
      });

      const data = await response.json();

      if (data.success) {
        lbl_mensagem_registro.style.color = 'green'
        lbl_mensagem_registro.style.visibility = 'visible'
        lbl_mensagem_registro.textContent = 'Registro realizado! Verifique seu e-mail para confirmar'
        this.reset();
      } 
      else {
        lbl_mensagem_registro.style.color = 'red'
        lbl_mensagem_registro.style.visibility = 'visible'
        lbl_mensagem_registro.textContent = data.message
      }
    }
    catch (error) {
      lbl_mensagem_registro.style.color = 'red'
      lbl_mensagem_registro.style.visibility = 'visible'
      lbl_mensagem_registro.textContent = 'Erro na comunicação com o servidor'
      console.error(error);
    }
  });

  login_form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();
    localStorage.setItem("regras_pontuacao", JSON.stringify(data.regras_pontuacao));
    localStorage.setItem("dicas_restantes", JSON.stringify(data.dicas_restantes));
    localStorage.setItem("perguntas_restantes", JSON.stringify(data.perguntas_restantes));
    localStorage.setItem("plano", data.plano);
    localStorage.setItem("regras_plano", JSON.stringify(data.regras_plano));
    localStorage.setItem("nome_usuario", data.nome_usuario);

    if (data.success) {
      window.location.href = "/home";
    } 
    else {
      lbl_mensagem_login.style.visibility = 'visible'
      lbl_mensagem_login.style.color = 'red'
      lbl_mensagem_login.textContent = data.message
    }
  });
});
