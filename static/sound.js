let sounds = {};
const keySoundState = {last: 0, interval: 35};

const html = `
  <audio id="checkbox-marked-sound" src="/static/sounds/checkbox.wav" preload="auto"></audio>
  <audio id="button-click-sound" src="/static/sounds/button_click.wav" preload="auto"></audio>
  <audio id="error-sound" src="/static/sounds/error.wav" preload="auto"></audio>
  <audio id="correct-sound" src="/static/sounds/correct.wav" preload="auto"></audio>
  <audio id="key-sound" src="/static/sounds/key.wav" preload="auto"></audio>
`;

document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("beforeend", html);

  sounds = {
    checkbox: document.getElementById("checkbox-marked-sound"),
    click: document.getElementById("button-click-sound"),
    error: document.getElementById("error-sound"),
    correct: document.getElementById("correct-sound"),
    key: document.getElementById("key-sound"),
  };
});

export function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;

  sound.currentTime = 0;
  sound.play().catch(() => {console.log("Erro ao reproduzir som")});
}

export function playKeySound(e) {
  if (!e.key) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (!sounds.key) return;

  const now = Date.now();
  if (now - keySoundState.last < keySoundState.interval) return;

  keySoundState.last = now;
  sounds.key.currentTime = 0;
  sounds.key.play().catch(() => {});
}
