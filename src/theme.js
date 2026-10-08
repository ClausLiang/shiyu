// 在样式和页面内容加载前恢复主题，避免深色模式刷新时先闪出浅色页面。
(() => {
  const THEME_KEY = 'shiyu:theme:v1';
  const root = document.documentElement;
  let storage = null;
  let theme = 'light';
  try {
    storage = window.localStorage;
    if (storage.getItem(THEME_KEY) === 'dark') theme = 'dark';
  } catch { /* 无法读取偏好时使用浅色，仍允许在当前页面切换。 */ }

  function applyTheme(value) {
    theme = value === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#16151d' : '#f7f8fa');
    document.querySelector('#theme-toggle')?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function showMessage(message) {
    const notice = document.querySelector('#theme-message');
    if (notice) { notice.textContent = message; notice.hidden = !message; }
  }

  applyTheme(theme);
  document.addEventListener('click', event => {
    if (!event.target.closest('#theme-toggle')) return;
    applyTheme(theme === 'dark' ? 'light' : 'dark');
    try {
      storage.setItem(THEME_KEY, theme);
      showMessage('');
    } catch {
      showMessage('主题已切换，但偏好暂时无法保存到浏览器，刷新后可能恢复原来的主题。');
    }
  });
  window.addEventListener('storage', event => {
    if (event.storageArea !== storage || (event.key !== THEME_KEY && event.key !== null)) return;
    applyTheme(event.newValue);
    showMessage('');
  });
})();
