/**
 * Boot diagnostics: catch errors before/during React mount and show them in #boot-error.
 * main.tsx calls __iviewMarkMounted() when the app mounts successfully to remove the splash.
 */
(function () {
  var errors = [];

  function showError(msg) {
    errors.push(msg);
    var pre = document.getElementById('boot-error-pre');
    var panel = document.getElementById('boot-error');
    if (pre) pre.textContent = errors.join('\n\n');
    if (panel) panel.style.display = 'block';
  }

  function hideSplash() {
    var splash = document.getElementById('splash');
    if (splash) splash.remove();
  }

  window.onerror = function (msg, url, line, col, err) {
    var s = msg;
    if (err && err.stack) s += '\n' + err.stack;
    else if (url) s += '\n  at ' + url + (line != null ? ':' + line : '');
    showError(s);
    return false;
  };

  window.onunhandledrejection = function (e) {
    var msg = (e && e.reason && (e.reason.message || String(e.reason))) || 'Unhandled promise rejection';
    if (e.reason && e.reason.stack) msg += '\n' + e.reason.stack;
    showError(msg);
  };

  window.__iviewMarkMounted = function () {
    hideSplash();
  };

  var reloadBtn = document.getElementById('boot-reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', function () {
      location.reload();
    });
  }

  // Timeout: if app hasn't mounted in 10s, show generic error
  setTimeout(function () {
    var splash = document.getElementById('splash');
    if (!splash || !splash.parentNode) return;
    var panel = document.getElementById('boot-error');
    if (panel && panel.style.display === 'block') return;
    showError('App failed to load after 10 seconds. Check the browser console for details.');
  }, 10000);
})();
