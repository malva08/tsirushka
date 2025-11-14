import { moneyCRC, toast } from './ui.js';
import { getToken } from './api.js';

const KEY = 'tsir.cart';

function readCart(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function writeCart(cart){ localStorage.setItem(KEY, JSON.stringify(cart)); window.dispatchEvent(new Event('cart:updated')); }
function lineSubtotal(it){ return (Number(it.precioCentimos)||0) * (Number(it.cantidad)||0); }

function render(){
  const tbody = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');

  const cart = readCart();
  if (!cart.length){
    tbody.innerHTML = `<tr><td colspan="5" class="py-5 text-center text-muted">Tu carrito está vacío.</td></tr>`;
    subtotalEl.textContent = moneyCRC(0);
    totalEl.textContent = moneyCRC(0);
    return;
  }
  tbody.innerHTML = '';
  let subtotal = 0;

  for (const it of cart){
    const sub = lineSubtotal(it); subtotal += sub;
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-id="${it.id}">
        <td>
          <div class="fw-semibold">${it.nombre}</div>
        </td>
        <td class="text-end">${moneyCRC(it.precioCentimos)}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm" role="group" aria-label="Cantidad">
            <button class="btn btn-outline-secondary" data-act="dec">–</button>
            <input class="form-control form-control-sm text-center" style="width:64px; display:inline-block" data-act="qty" value="${it.cantidad}" inputmode="numeric">
            <button class="btn btn-outline-secondary" data-act="inc">+</button>
          </div>
        </td>
        <td class="text-end fw-semibold">${moneyCRC(sub)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-act="del"><i class="bi bi-x-lg"></i></button>
        </td>
      </tr>
    `);
  }

  subtotalEl.textContent = moneyCRC(subtotal);
  totalEl.textContent = moneyCRC(subtotal);
  // listeners por fila
  tbody.querySelectorAll('tr').forEach(tr => {
    const id = tr.getAttribute('data-id');
    tr.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const cart2 = readCart();
      const row = cart2.find(x => String(x.id) === String(id));
      if (!row) return;

      if (act === 'inc') { row.cantidad = Math.min(999, (Number(row.cantidad)||0) + 1); }
      if (act === 'dec') { row.cantidad = Math.max(1, (Number(row.cantidad)||0) - 1); }
      if (act === 'del') {
        const idx = cart2.findIndex(x => String(x.id)===String(id));
        if (idx >= 0) cart2.splice(idx, 1);
        writeCart(cart2);
        render();
        toast('Producto eliminado', 'success');
        return;
      }
      writeCart(cart2);
      render();
    });

    tr.querySelector('[data-act="qty"]').addEventListener('change', (e) => {
      const val = Math.max(1, Math.min(999, parseInt(e.target.value || '1', 10)));
      const cart2 = readCart();
      const row = cart2.find(x => String(x.id) === String(id));
      if (row){ row.cantidad = val; writeCart(cart2); render(); }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  render();

  document.getElementById('btnClear')?.addEventListener('click', () => {
    const cart = readCart();
    if (!cart.length) return;
    if (confirm('¿Vaciar carrito?')) {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new Event('cart:updated'));
      render();
    }
  });

  document.getElementById('btnCheckout')?.addEventListener('click', () => {
    const cart = readCart();
    if (!cart.length){ toast('Tu carrito está vacío', 'warn'); return; }

    const token = getToken();
    if (!token){
      toast('Ingresá para continuar al checkout', 'warn');
      const redirect = encodeURIComponent('checkout.html');
      location.href = `login.html?redirect=${redirect}`;
      return;
    }
    location.href = 'checkout.html';
  });

  window.addEventListener('storage', (e) => { if (e.key === KEY) render(); });
  window.addEventListener('cart:updated', render);
});
