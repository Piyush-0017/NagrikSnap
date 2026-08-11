// NagrikSnap Dark / Light mode
(function () {
  const KEY = 'nagriksnap_theme';
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body && document.body.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
      btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }
  }
  function current() {
    return localStorage.getItem(KEY) || 'light';
  }
  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }
  function ensureBtn() {
    if (document.getElementById('themeToggle')) return;
    const b = document.createElement('button');
    b.id = 'themeToggle';
    b.type = 'button';
    b.className = 'theme-toggle-btn';
    b.addEventListener('click', toggle);
    // prefer navbar
    const nav = document.querySelector('.nav-links') || document.querySelector('.navbar');
    if (nav) nav.appendChild(b);
    else document.body.appendChild(b);
    apply(current());
  }
  // apply early to reduce flash
  apply(current());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBtn);
  } else ensureBtn();
  window.NagrikTheme = { apply, toggle, current };
})();
