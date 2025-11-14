// /js/head-loader.js
(function () {
  // 1) Título de la página
  const pageAttr = document.documentElement.getAttribute('data-page-title');
  if (pageAttr && (!document.title || document.title === 'Document')) {
    document.title = `${pageAttr} | Tsirushka`;
  }

  // 2) Carga e inyecta head común (evitando duplicados)
  fetch('./components/head.html', { cache: 'no-cache' })
    .then(r => r.text())
    .then(html => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;

      const exists = (el) => {
        const tag = el.tagName;
        const keyAttr = tag === 'LINK' ? 'href' : (tag === 'SCRIPT' ? 'src' : null);
        if (!keyAttr) return false;
        const key = el.getAttribute(keyAttr);
        return !!Array.from(document.head.children).find(n => n.tagName === tag && n.getAttribute(keyAttr) === key);
      };

      tmp.querySelectorAll('link, script, style, meta').forEach(el => {
        if (!exists(el)) document.head.appendChild(el.cloneNode(true));
      });
    })
    .catch(e => console.error('head-loader:', e));
})();
