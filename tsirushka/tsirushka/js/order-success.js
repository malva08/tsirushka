// /js/order-success.js
import { apiFetch, getToken } from './api.js';
import { moneyCRC, getQueryParam } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const id = getQueryParam('orderId');
  const metodo = (getQueryParam('metodo') || '').toUpperCase();
  const sinpe = getQueryParam('sinpe') || '';
  const ref = getQueryParam('ref') || '';
  const box = document.getElementById('orderBox');
  
  if (!id) { 
    box.innerHTML = '<div class="text-danger">Falta orderId en la URL.</div>'; 
    return; 
  }

  // Verificar autenticación
  if (!getToken()) {
    box.innerHTML = '<div class="alert alert-warning">Sesión expirada. <a href="login.html">Iniciar sesión</a></div>';
    return;
  }

  try {
    const token = getToken();
    
    const o = await apiFetch(`/orders/${id}`, { auth: true });
    
    let extra = '';
    if (metodo === 'SINPE'){
      extra = `
        <hr>
        <h3 class="h6 mb-3"><i class="bi bi-phone"></i> Instrucciones SINPE Móvil</h3>
        <div class="alert alert-info">
          <ol class="mb-2">
            <li>Enviá el monto total de <strong>${moneyCRC(o.totalCentimos)}</strong> a <strong>${sinpe || '+506 8630-4400'}</strong></li>
            <li>Usá como referencia: <strong>${o.numeroPedido}</strong></li>
            ${ref ? `<li>Tu referencia ingresada: <strong>${ref}</strong></li>` : ''}
          </ol>
          <small class="text-muted">
            <i class="bi bi-info-circle"></i> 
            Apenas confirmemos tu pago, procesaremos tu pedido. Te contactaremos al email registrado.
          </small>
        </div>`;
    } else if (metodo === 'TARJETA'){
      extra = `
        <hr>
        <h3 class="h6 mb-3"><i class="bi bi-credit-card"></i> Pago con tarjeta (manual)</h3>
        <div class="alert alert-warning">
          <p class="mb-2">
            <i class="bi bi-exclamation-triangle"></i> 
            Nuestro equipo validará los datos de referencia y te contactará para confirmar el cobro.
          </p>
          <small class="text-muted">Estado actual: pendiente de verificación.</small>
        </div>`;
    }

    box.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <div class="text-muted small">Número de pedido</div>
          <div class="fs-5 fw-semibold">${o.numeroPedido}</div>
        </div>
        <div class="col-md-6 text-md-end">
          <div class="text-muted small">Total</div>
          <div class="fs-5 fw-semibold text-primary">${moneyCRC(o.totalCentimos)}</div>
        </div>
        <div class="col-12">
          <div class="d-flex align-items-center gap-2">
            <span class="text-muted">Estado:</span>
            <span class="badge text-bg-warning">${o.estado}</span>
          </div>
        </div>
        <div class="col-12">
          <div class="text-muted small mb-2">Productos (${o.items.length})</div>
          <div class="list-group list-group-flush">
            ${o.items.map(item => `
              <div class="list-group-item px-0">
                <div class="d-flex justify-content-between">
                  <span>${item.productoNombre} × ${item.cantidad}</span>
                  <span class="text-muted">${moneyCRC(item.subtotalCentimos)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="col-12">
          ${extra}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error cargando pedido:', err);
    box.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 
        No pudimos cargar el pedido: ${err.message}
        <div class="mt-2">
          <a href="mis-pedidos.html" class="btn btn-sm btn-outline-primary">Ver mis pedidos</a>
        </div>
      </div>
    `;
  }
});