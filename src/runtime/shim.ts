/**
 * Injected first into every preview document. Forwards console output, uncaught errors and
 * unhandled rejections to the parent Studio window, and runs an optional smoke test.
 */
export const PREVIEW_SHIM = `(function () {
  var send = function (level, parts) {
    try {
      var text = parts.map(function (p) {
        if (p instanceof Error) return p.name + ': ' + p.message;
        if (typeof p === 'object') { try { return JSON.stringify(p); } catch (e) { return String(p); } }
        return String(p);
      }).join(' ');
      parent.postMessage({ __studio: true, level: level, text: text.slice(0, 500) }, '*');
    } catch (e) {}
  };
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      send(level, args);
      return orig.apply(console, args);
    };
  });
  window.addEventListener('error', function (e) {
    var err = e.error;
    send('error', [err && err.name ? err.name + ': ' + err.message : String(e.message)]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    send('error', ['Unhandled promise rejection: ' + (r && r.message ? r.message : String(r))]);
  });
  window.addEventListener('load', function () { send('ready', []); });
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.__studioSmoke) return;
    var fire = function (type, key, code) {
      var ev = new KeyboardEvent(type, { key: key, code: code, bubbles: true, cancelable: true });
      (document.activeElement || document.body).dispatchEvent(ev);
    };
    var keys = [['Enter', 'Enter'], [' ', 'Space'], ['ArrowRight', 'ArrowRight'], ['ArrowUp', 'ArrowUp'], ['ArrowLeft', 'ArrowLeft']];
    var i = 0;
    var next = function () {
      if (i >= keys.length) {
        var btn = document.querySelector('button');
        if (btn) btn.click();
        send('smoke', ['done']);
        return;
      }
      fire('keydown', keys[i][0], keys[i][1]);
      fire('keyup', keys[i][0], keys[i][1]);
      i++;
      setTimeout(next, 80);
    };
    next();
  });
})();`;
