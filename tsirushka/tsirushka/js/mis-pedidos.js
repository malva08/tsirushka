// /js/mis-pedidos.js
import { apiFetch, getToken } from './api.js';
import { moneyCRC, toast, toggleAuthButtons } from './ui.js';

let allPedidos = [];

async function loadPedidos() {
  const container = document.getElementById('pedidosList');
  
  try {
    const pedidos = await apiFetch('/orders/mis-pedidos', { auth: true });
    allPedidos = pedidos;

    if (!pedidos || pedidos.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-inbox fs-1 text-muted mb-3"></i>
          <p class="text-muted">Aún no has realizado ningún pedido.</p>
          <a href="index.html" class="btn btn-primary">
            <i class="bi bi-bag"></i> Ir al catálogo
          </a>
        </div>
      `;
      return;
    }

    renderPedidos(pedidos, container);
    renderPedidosPorEstado();

  } catch (err) {
    console.error('Error cargando pedidos:', err);
    container.innerHTML = `
      <div class="alert alert-danger">
        Error al cargar tus pedidos. Por favor intenta nuevamente.
      </div>
    `;
  }
}

function renderPedidos(pedidos, container) {
  if (pedidos.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-4">No hay pedidos en esta categoría.</p>';
    return;
  }

  container.innerHTML = pedidos.map(pedido => {
    const fecha = new Date(pedido.createdAt).toLocaleDateString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const estadoInfo = getEstadoInfo(pedido.estado);
    const total = moneyCRC(pedido.totalCentimos);
    const itemsCount = pedido.items.reduce((sum, item) => sum + item.cantidad, 0);

    return `
      <div class="card mb-3">
        <div class="card-body">
          <div class="row align-items-center">
            <div class="col-md-3">
              <h6 class="mb-1">Pedido #${pedido.numeroPedido}</h6>
              <small class="text-muted">${fecha}</small>
            </div>
            <div class="col-md-3">
              <small class="text-muted d-block">Estado</small>
              <span class="badge text-bg-${estadoInfo.color} mt-1">
                <i class="bi ${estadoInfo.icon}"></i> ${estadoInfo.texto}
              </span>
            </div>
            <div class="col-md-2">
              <small class="text-muted d-block">Productos</small>
              <strong>${itemsCount} ${itemsCount === 1 ? 'producto' : 'productos'}</strong>
            </div>
            <div class="col-md-2">
              <small class="text-muted d-block">Total</small>
              <strong class="text-primary">${total}</strong>
            </div>
            <div class="col-md-2 text-end">
              <button class="btn btn-outline-primary btn-sm" onclick="verDetalle('${pedido.id}')">
                <i class="bi bi-eye"></i> Ver detalle
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPedidosPorEstado() {
  const pendientes = allPedidos.filter(p => 
    ['PENDIENTE', 'CONFIRMADO', 'PREPARANDO'].includes(p.estado)
  );
  const enviados = allPedidos.filter(p => p.estado === 'ENVIADO');
  const entregados = allPedidos.filter(p => p.estado === 'ENTREGADO');

  renderPedidos(pendientes, document.getElementById('pedidosPendientes'));
  renderPedidos(enviados, document.getElementById('pedidosEnviados'));
  renderPedidos(entregados, document.getElementById('pedidosEntregados'));
}

async function verDetalle(pedidoId) {
  try {
    const pedido = await apiFetch(`/orders/${pedidoId}`, { auth: true });

    document.getElementById('detNumeroPedido').textContent = pedido.numeroPedido;
    
    const fecha = new Date(pedido.createdAt).toLocaleString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('detFecha').textContent = fecha;

    // Estado
    const estadoInfo = getEstadoInfo(pedido.estado);
    const alertDiv = document.getElementById('detEstadoAlert');
    alertDiv.className = `alert alert-${estadoInfo.color}`;
    
    document.getElementById('detEstadoIcon').className = `bi ${estadoInfo.icon} fs-4 me-3`;
    document.getElementById('detEstadoTitulo').textContent = estadoInfo.texto;
    document.getElementById('detEstadoDesc').textContent = estadoInfo.descripcion;

    // Productos
    const tbodyProductos = document.getElementById('detProductos');
    tbodyProductos.innerHTML = pedido.items.map(item => `
      <tr>
        <td>${item.productoNombre}</td>
        <td class="text-center">${item.cantidad}</td>
        <td class="text-end">${moneyCRC(item.precioUnitarioCentimos)}</td>
        <td class="text-end">${moneyCRC(item.subtotalCentimos)}</td>
      </tr>
    `).join('');

    // Totales
    document.getElementById('detSubtotal').textContent = moneyCRC(pedido.subtotalCentimos);
    document.getElementById('detEnvio').textContent = moneyCRC(pedido.envioCentimos);
    document.getElementById('detTotal').textContent = moneyCRC(pedido.totalCentimos);

    const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
    modal.show();

  } catch (err) {
    console.error('Error cargando detalle:', err);
    toast('Error al cargar el detalle del pedido', 'error');
  }
}

function getEstadoInfo(estado) {
  const estados = {
    'PENDIENTE': {
      texto: 'Pendiente',
      color: 'warning',
      icon: 'bi-hourglass-split',
      descripcion: 'Estamos procesando tu pedido'
    },
    'CONFIRMADO': {
      texto: 'Confirmado',
      color: 'info',
      icon: 'bi-check-circle',
      descripcion: 'Tu pedido ha sido confirmado'
    },
    'PREPARANDO': {
      texto: 'Preparando',
      color: 'primary',
      icon: 'bi-box-seam',
      descripcion: 'Estamos preparando tu pedido'
    },
    'ENVIADO': {
      texto: 'Enviado',
      color: 'primary',
      icon: 'bi-truck',
      descripcion: 'Tu pedido está en camino'
    },
    'ENTREGADO': {
      texto: 'Entregado',
      color: 'success',
      icon: 'bi-check-circle-fill',
      descripcion: '¡Tu pedido ha sido entregado!'
    },
    'CANCELADO': {
      texto: 'Cancelado',
      color: 'danger',
      icon: 'bi-x-circle',
      descripcion: 'Este pedido fue cancelado'
    }
  };

  return estados[estado] || estados['PENDIENTE'];
}

// Exponer función globalmente para onclick
window.verDetalle = verDetalle;

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!getToken()) {
    location.href = 'login.html?redirect=' + encodeURIComponent('mis-pedidos.html');
    return;
  }

  toggleAuthButtons(true);
  await loadPedidos();
});