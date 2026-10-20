(() => {
  const storageKey = 'epstein-theme';
  const themeColors = { light: '#f1ebdf', dark: '#15120e' };
  const icons = {
    dark: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>',
  };
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let button;

  function readSaved() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
    if (!button) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    const label = next === 'dark' ? 'Passa al tema scuro' : 'Passa al tema chiaro';
    button.innerHTML = icons[next];
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  apply(readSaved() || (media.matches ? 'dark' : 'light'));
  media.addEventListener('change', (event) => {
    if (!readSaved()) apply(event.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const actions = document.createElement('div');
    actions.className = 'header-actions';
    actions.append(...[...header.children].slice(1));
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.addEventListener('click', () => {
      const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, theme); } catch {}
      apply(theme);
    });
    actions.append(button);
    header.append(actions);
    apply(root.dataset.theme);
  });
})();
