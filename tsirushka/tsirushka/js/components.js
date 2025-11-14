// /js/components.js
async function loadComponent(el, name) {
  const url = `./components/${name}.html`;
  const html = await fetch(url, { cache: 'no-cache' }).then(r => r.text());
  el.innerHTML = html;

  // Inicializadores por componente
  if (name === 'navbar') {
    // Import dinámico del módulo de navbar
    const mod = await import('./navbar.js');
    if (typeof mod.setupNavbar === 'function') await mod.setupNavbar();
  }
}

async function boot() {
  const nodes = document.querySelectorAll('[data-component]');
  for (const el of nodes) {
    const name = el.getAttribute('data-component');
    try {
      await loadComponent(el, name);
    } catch (err) {
      console.error(`Error cargando componente ${name}:`, err);
      el.innerHTML = `<div class="text-danger">No se pudo cargar ${name}.</div>`;
    }
  }
}
document.addEventListener('DOMContentLoaded', boot);
