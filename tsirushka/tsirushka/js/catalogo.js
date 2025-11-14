import { apiFetch, getToken } from './api.js';
import { moneyCRC, toggleAuthButtons, toast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  toggleAuthButtons(!!getToken());

  const form = document.getElementById('formBuscador');
  const grid = document.getElementById('grid');
  const pag = document.getElementById('paginacion');
  const skelTpl = document.getElementById('skel');

  const CART_KEY = 'tsir.cart';
  let page = 0, size = 12, q = '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    q = document.getElementById('q').value.trim();
    page = 0;
    cargar();
  });

  function renderSkeleton(){
    grid.innerHTML = '';
    for(let i=0;i<8;i++){
      grid.appendChild(skelTpl.content.cloneNode(true));
    }
  }

  function addToCart({id, nombre, precioCentimos}){
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const row = cart.find(x => String(x.id) === String(id));
    if (row) row.cantidad = Math.min(999, (Number(row.cantidad)||0) + 1);
    else cart.push({ id, nombre, precioCentimos, cantidad: 1 });
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event('cart:updated'));
    toast('Producto agregado al carrito', 'success');
  }

  // Delegación de eventos para botones "Agregar"
  grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-add]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const nombre = btn.getAttribute('data-name');
    const precioCentimos = Number(btn.getAttribute('data-price') || 0);
    addToCart({ id, nombre, precioCentimos });
  });

  async function cargar() {
    renderSkeleton();
    try {
      const data = await apiFetch(`/catalogo/productos?page=${page}&size=${size}&q=${encodeURIComponent(q)}`);
      grid.innerHTML = '';

      if (data.items.length === 0) {
        grid.innerHTML = `<div class="text-muted text-center py-5">Sin resultados.</div>`;
        pag.innerHTML = '';
        return;
      }

      for (const p of data.items) {
        const img = p.imagenUrl || 'https://placehold.co/600x400?text=Tsirushka';
        const price = moneyCRC(p.precioCentimos);
        grid.insertAdjacentHTML('beforeend', `
          <div class="col-sm-6 col-md-4 col-lg-3">
            <div class="card h-100">
              <img src="${img}" class="card-img-top" alt="${p.nombre}">
              <div class="card-body d-flex flex-column">
                <h5 class="card-title mb-1">${p.nombre}</h5>
                <p class="card-text fw-semibold mb-3 text-primary">${price}</p>
                <div class="mt-auto d-grid gap-2">
                  <a class="btn btn-outline-primary" href="producto.html?id=${p.id}">
                    <i class="bi bi-eye"></i> Ver
                  </a>
                  <button class="btn btn-primary"
                          data-add
                          data-id="${p.id}"
                          data-name="${p.nombre.replace(/"/g,'&quot;')}"
                          data-price="${p.precioCentimos}">
                    <i class="bi bi-bag-plus"></i> Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        `);
      }

      // paginación
      const totalPages = Math.ceil(data.total / data.size);
      pag.innerHTML = '';
      const prevDisabled = page <= 0 ? 'disabled' : '';
      const nextDisabled = page >= totalPages-1 ? 'disabled' : '';
      pag.insertAdjacentHTML('beforeend', `
        <li class="page-item ${prevDisabled}"><a class="page-link" href="#" data-nav="prev">«</a></li>
        <li class="page-item disabled"><span class="page-link">${page+1}/${Math.max(totalPages,1)}</span></li>
        <li class="page-item ${nextDisabled}"><a class="page-link" href="#" data-nav="next">»</a></li>
      `);
      pag.querySelectorAll('a[data-nav]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          const kind = a.dataset.nav;
          if (kind==='prev' && page>0){ page--; cargar(); }
          if (kind==='next' && page<totalPages-1){ page++; cargar(); }
        });
      });

    } catch (err) {
      grid.innerHTML = `<div class="text-danger text-center py-5">Error: ${err.message}</div>`;
      pag.innerHTML = '';
      toast('No pudimos cargar el catálogo', 'error');
    }
  }

  cargar();
});
