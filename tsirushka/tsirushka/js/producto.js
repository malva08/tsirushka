import { apiFetch, getToken } from './api.js';
import { moneyCRC, getQueryParam, toggleAuthButtons, toast } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  toggleAuthButtons(!!getToken());
  const cont = document.getElementById('detalle');
  const id = getQueryParam('id');
  if (!id){ cont.innerHTML = '<div class="text-danger">Falta ID.</div>'; return; }

  try {
    const p = await apiFetch(`/catalogo/productos/${id}`);
    const imgs = p.imagenes?.length ? p.imagenes : [{url:'https://placehold.co/800x500?text=Tsirushka', textoAlt:p.nombre, posicion:1}];
    const galeria = imgs.map(im => `<img src="${im.url}" class="img-fluid rounded mb-3" alt="${im.textoAlt||p.nombre}">`).join('');

    cont.innerHTML = `
      <div class="col-md-6">${galeria}</div>
      <div class="col-md-6">
        <nav class="mb-2"><a href="index.html" class="link-underline link-underline-opacity-0">&larr; Volver</a></nav>
        <h1 class="h3">${p.nombre}</h1>
        <p class="text-muted">${p.descripcion ?? ''}</p>
        <p class="fs-3 fw-bold text-primary">${moneyCRC(p.precioCentimos)}</p>
        <p><span class="badge ${p.stock>0?'bg-success':'bg-secondary'}">${p.stock>0? 'En stock':'Sin stock'}</span></p>
        <div class="d-grid gap-2">
          <button id="btnAdd" class="btn btn-primary" ${p.stock>0?'':'disabled'}>
            <i class="bi bi-bag-plus"></i> Agregar al carrito
          </button>
        </div>
      </div>
    `;

    document.getElementById('btnAdd')?.addEventListener('click', () => {
      const key = 'tsir.cart';
      const cart = JSON.parse(localStorage.getItem(key) || '[]');
      const exists = cart.find(x => x.id === p.id);
      if (exists) { exists.cantidad += 1; } else { cart.push({id:p.id, nombre:p.nombre, precioCentimos:p.precioCentimos, cantidad:1}); }
      localStorage.setItem(key, JSON.stringify(cart));
      window.dispatchEvent(new Event('cart:updated'));
      toast('Producto agregado al carrito', 'success');
    });

  } catch (err) {
    cont.innerHTML = `<div class="text-danger">Error: ${err.message}</div>`;
    toast('No pudimos cargar el producto', 'error');
  }
});
