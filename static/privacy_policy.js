document.addEventListener('DOMContentLoaded', () => {
  // preencher data automaticamente (servidor pode sobrescrever se quiser)
  const d = new Date();
  document.getElementById('policy-date').textContent = d.toISOString().slice(0,10);

  // Aceitar: salva um flag no localStorage para não mostrar banner ou modal (se houver)
  document.getElementById('btn-accept').addEventListener('click', () => {
    localStorage.setItem('privacy_accepted_v1', '1');
    const btn = document.getElementById('btn-accept');
    btn.textContent = 'Aceito ✓';
    btn.disabled = true;
  });

  // Baixar a política como arquivo de texto (simples). Se quiser PDF, gere no backend.
  document.getElementById('btn-download').addEventListener('click', () => {
    const html = document.querySelector('.card').innerText;
    const blob = new Blob([html], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'politica_privacidade.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});