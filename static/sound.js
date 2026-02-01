export function playSound(sound, id_visitante=null, id_visitante_admin=null) {
  // if (id_visitante !== id_visitante_admin) return;
  if (!sound) return;

  sound.currentTime = 0; // Permite spam sem travar
  sound.play().catch(() => {console.log("Erro ao reproduzir som")}); // Ignora bloqueio do navegador
}

export function playKeySound(keySound, lastKeySoundTime, KEY_SOUND_INTERVAL) {
  const now = Date.now();

  if (!keySound) return;
  if (now - lastKeySoundTime < KEY_SOUND_INTERVAL) return;

  lastKeySoundTime = now;
  keySound.currentTime = 0;
  keySound.play().catch(() => {});
  return lastKeySoundTime
}