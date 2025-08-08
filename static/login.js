document.addEventListener('DOMContentLoaded', function () {
  // Limpa o armazenament local para evitar dados de sessões anteriores
  localStorage.clear()
  const login_tab = document.getElementById('login-tab');
  const register_tab = document.getElementById('register-tab');
  const login_form = document.getElementById('login-form');
  const register_form = document.getElementById('register-form');

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

    if (!nome) {
      alert('Por favor, preencha o nome de usuário.');
      return;
    }
    if (!email) {
      alert('Por favor, preencha o email.');
      return;
    }
    if (senha !== confirmar_senha) {
      alert('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
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
        alert('Registro realizado! Verifique seu e-mail para confirmá-lo.');
        showForm('login');
        this.reset();
      } else {
        alert('Erro no registro: ' + data.message);
      }
    } catch (error) {
      alert('Erro na comunicação com o servidor.');
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

    const result = await response.json();
    localStorage.setItem("regras_pontuacao", JSON.stringify(result.regras_pontuacao));
    localStorage.setItem("dicas_restantes", JSON.stringify(result.dicas_restantes));
    localStorage.setItem("perguntas_restantes", JSON.stringify(result.perguntas_restantes));

    if (result.success) {
      window.location.href = "/home";
    } else {
      alert(result.message);
    }
  });
});
