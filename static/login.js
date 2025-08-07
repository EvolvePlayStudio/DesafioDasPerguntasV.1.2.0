document.addEventListener('DOMContentLoaded', function () {
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  function showForm(type) {
    if (type === 'login') {
      loginForm.classList.add('active');
      registerForm.classList.remove('active');
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
    } else if (type === 'register') {
      registerForm.classList.add('active');
      loginForm.classList.remove('active');
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
    }
  }

  showForm('login');
  window.showForm = showForm;

  registerForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const nome = this.nome?.value.trim();
    const email = this.email?.value.trim();
    const senha = this.senha?.value;
    const confirmarSenha = this.confirmar_senha?.value;
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
    if (senha !== confirmarSenha) {
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

  loginForm.addEventListener("submit", async function (event) {
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
