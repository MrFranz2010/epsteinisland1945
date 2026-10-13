export function setupFullscreen(gameShell) {
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fullscreenText = document.getElementById('fullscreenText');

  function expanded() {
    return gameShell.classList.contains('pseudo-fullscreen');
  }

  function updateButton() {
    const active = document.fullscreenElement === gameShell || expanded();
    fullscreenText.textContent = active ? 'Esci da schermo intero' : 'Schermo intero';
    fullscreenBtn.setAttribute('aria-pressed', String(active));
  }

  function expand(active) {
    gameShell.classList.toggle('pseudo-fullscreen', active);
    document.body.classList.toggle('pseudo-fullscreen-active', active);
    updateButton();
  }

  async function toggleFullscreen() {
    if (expanded()) {
      expand(false);
      return;
    }
    if (document.fullscreenElement === gameShell) {
      try {
        await document.exitFullscreen();
        updateButton();
      } catch {
        updateButton();
      }
      return;
    }
    try {
      if (!gameShell.requestFullscreen) {
        expand(true);
        return;
      }
      await gameShell.requestFullscreen();
      updateButton();
    } catch {
      expand(true);
    }
  }

  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateButton);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === 'Escape' && expanded()) {
      expand(false);
      fullscreenBtn.focus();
    }
  });
}
