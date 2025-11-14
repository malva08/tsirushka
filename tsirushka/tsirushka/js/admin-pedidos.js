// /js/admin-pedidos.js
import { apiFetch, getToken, clearToken } from './api.js';
import { moneyCRC } from './ui.js';

function parseJwt(token){
  try{
    const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const json = decodeURIComponent(atob(base64).split('').map(c=>'%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  }catch{ return null; }
}

function hasAdminRole(payload){
  const roles = (payload?.roles || '').split(',').map(r=>r.trim().toUpperCase());
  return roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
}

function checkAdminAccess(){
  const token = getToken();
  if (!token) {
    location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname);
    return false;
  }
  const payload = parseJwt(token);
  if (!hasAdminRole(payload)) {
    alert('Acceso denegado. Se requieren permisos de administrador.');
    location.href = 'index.html';
    return false;
  }
  return payload;
}

function setupSidebar(){
  const sidebar = document.getElementById('adminSidebar');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarToggle');

  toggleBtn?.addEventListener('click', () => sidebar.classList.add('show'));
  closeBtn?.addEventListener('click', () => sidebar.classList.remove('show'));

  document.addEventListener('click', (e) => {
    if (window.innerWidth < 992 && 
        sidebar.classList.contains('show') && 
        !sidebar.contains(e.target) && 
        e.target !== toggleBtn) {
      sidebar.classList.remove('show');
    }
  });

  document.getElementById('adminLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('¿Cerrar sesión?')) {
      clearToken();
      location.href = 'login.html';
    }
  });
}

// Variables globales
let currentPage = 0;
let currentSize = 10;
let currentFilters = { q: '', estado: '' };
let currentPedidoId = null;

// Cargar pedidos
async function loadPedidos(){
  const tbody = document.getElementById('pedidosTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      size: currentSize,
      ...(currentFilters.q && { q: currentFilters.q }),
      ...(currentFilters.estado && { estado: currentFilters.estado })
    });

    const data = await apiFetch(`/admin/pedidos?${params}`, { auth: true });

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">No se encontraron pedidos</td></tr>';
      document.getElementById('paginacion').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.items.map(pedido => {
      const fecha = new Date(pedido.createdAt).toLocaleString('es-CR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const total = moneyCRC(pedido.totalCentimos);

      let estadoBadge = '';
      const estadoMap = {
        'PENDIENTE': 'warning',
        'CONFIRMADO': 'info',
        'PREPARANDO': 'primary',
        'ENVIADO': 'primary',
        'ENTREGADO': 'success',
        'CANCELADO': 'danger'
      };
      const color = estadoMap[pedido.estado] || 'secondary';
      estadoBadge = `<span class="badge text-bg-${color}">${pedido.estado}</span>`;

      return `
        <tr>
          <td>
            <strong>#${pedido.numeroPedido}</strong>
          </td>
          <td>
            <small class="text-muted">${fecha}</small>
          </td>
          <td>
            <div class="fw-semibold">${pedido.clienteNombre}</div>
            <small class="text-muted">${pedido.clienteEmail}</small>
          </td>
          <td class="fw-semibold text-primary">${total}</td>
          <td>${estadoBadge}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary" data-action="view" data-id="${pedido.id}" title="Ver detalle">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => verDetalle(btn.dataset.id));
    });

    renderPagination(data.total, data.size);

  } catch (err) {
    console.error('Error cargando pedidos:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">Error al cargar pedidos</td></tr>';
  }
}

function renderPagination(total, size){
  const pag = document.getElementById('paginacion');
  const totalPages = Math.ceil(total / size);
  
  if (totalPages <= 1) {
    pag.innerHTML = '';
    return;
  }

  const prevDisabled = currentPage <= 0 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages - 1 ? 'disabled' : '';

  pag.innerHTML = `
    <li class="page-item ${prevDisabled}">
      <a class="page-link" href="#" data-page="prev">Anterior</a>
    </li>
    <li class="page-item disabled">
      <span class="page-link">Página ${currentPage + 1} de ${totalPages}</span>
    </li>
    <li class="page-item ${nextDisabled}">
      <a class="page-link" href="#" data-page="next">Siguiente</a>
    </li>
  `;

  pag.querySelectorAll('[data-page]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const action = a.dataset.page;
      if (action === 'prev' && currentPage > 0) {
        currentPage--;
        loadPedidos();
      } else if (action === 'next' && currentPage < totalPages - 1) {
        currentPage++;
        loadPedidos();
      }
    });
  });
}

// Cargar estadísticas
async function loadStats(){
  try {
    const stats = await apiFetch('/admin/pedidos/stats', { auth: true });
    document.getElementById('statTotal').textContent = stats.total || '0';
    document.getElementById('statPendientes').textContent = stats.pendientes || '0';
    
    const enProceso = (stats.confirmados || 0) + (stats.preparando || 0) + (stats.enviados || 0);
    document.getElementById('statProceso').textContent = enProceso;
    
    document.getElementById('statVentas').textContent = moneyCRC(stats.ventasTotalesCentimos || 0);
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// Ver detalle del pedido
async function verDetalle(id){
  try {
    const pedido = await apiFetch(`/admin/pedidos/${id}`, { auth: true });
    
    currentPedidoId = id;

    document.getElementById('detNumeroPedido').textContent = pedido.numeroPedido;
    
    const fecha = new Date(pedido.createdAt).toLocaleString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('detFecha').textContent = fecha;

    // Cliente
    document.getElementById('detClienteNombre').textContent = pedido.clienteNombre;
    document.getElementById('detClienteEmail').textContent = pedido.clienteEmail;
    document.getElementById('detClienteTelefono').textContent = pedido.clienteTelefono || 'No proporcionado';

    // Entrega
    document.getElementById('detModoEntrega').textContent = pedido.modoEntrega;
    const dirContainer = document.getElementById('detDireccionContainer');
    if (pedido.modoEntrega === 'ENVIO' && pedido.direccion) {
      document.getElementById('detProvincia').textContent = pedido.direccion.provincia || '-';
      document.getElementById('detCanton').textContent = pedido.direccion.canton || '-';
      document.getElementById('detDistrito').textContent = pedido.direccion.distrito || '-';
      document.getElementById('detDireccion').textContent = pedido.direccion.direccionExacta || '-';
      dirContainer.style.display = '';
    } else {
      dirContainer.style.display = 'none';
    }

    // Pago
    document.getElementById('detMetodoPago').textContent = pedido.pago.metodo;
    document.getElementById('detPagoReferencia').textContent = pedido.pago.referencia || 'N/A';

    // Estado
    const estadoMap = {
      'PENDIENTE': 'warning',
      'CONFIRMADO': 'info',
      'PREPARANDO': 'primary',
      'ENVIADO': 'primary',
      'ENTREGADO': 'success',
      'CANCELADO': 'danger'
    };
    const color = estadoMap[pedido.estado] || 'secondary';
    document.getElementById('detEstado').innerHTML = `<span class="badge text-bg-${color} fs-6">${pedido.estado}</span>`;

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

    document.getElementById('detSubtotal').textContent = moneyCRC(pedido.subtotalCentimos);
    document.getElementById('detEnvio').textContent = moneyCRC(pedido.envioCentimos);
    document.getElementById('detTotal').textContent = moneyCRC(pedido.totalCentimos);

    // Notas
    document.getElementById('detNotas').value = pedido.notasInternas || '';

    const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
    modal.show();

  } catch (err) {
    console.error('Error cargando detalle:', err);
    showToast('Error al cargar el pedido', 'error');
  }
}

// Setup modal de detalle
function setupModalDetalle(){
  document.getElementById('btnGuardarNotas')?.addEventListener('click', async () => {
    if (!currentPedidoId) return;

    const notas = document.getElementById('detNotas').value.trim();

    try {
      await apiFetch(`/admin/pedidos/${currentPedidoId}/notas`, {
        method: 'PATCH',
        body: { notasInternas: notas },
        auth: true
      });

      showToast('Notas guardadas correctamente', 'success');
    } catch (err) {
      console.error('Error guardando notas:', err);
      showToast('Error al guardar las notas', 'error');
    }
  });

  // Botones de cambio de estado
  document.getElementById('btnConfirmar')?.addEventListener('click', () => cambiarEstado('confirmar'));
  document.getElementById('btnPreparar')?.addEventListener('click', () => cambiarEstado('preparar'));
  document.getElementById('btnEnviar')?.addEventListener('click', () => cambiarEstado('enviar'));
  document.getElementById('btnEntregar')?.addEventListener('click', () => cambiarEstado('entregar'));
  document.getElementById('btnCancelar')?.addEventListener('click', () => {
    if (confirm('¿Estás seguro de cancelar este pedido?')) {
      cambiarEstado('cancelar');
    }
  });
}

// Cambiar estado del pedido
async function cambiarEstado(accion){
  if (!currentPedidoId) return;

  try {
    await apiFetch(`/admin/pedidos/${currentPedidoId}/${accion}`, {
      method: 'PATCH',
      auth: true
    });

    showToast('Estado actualizado correctamente', 'success');
    
    // Recargar detalle y lista
    await verDetalle(currentPedidoId);
    loadPedidos();
    loadStats();

  } catch (err) {
    console.error('Error cambiando estado:', err);
    showToast('Error al cambiar el estado', 'error');
  }
}

// Filtros
function setupFilters(){
  const form = document.getElementById('formFiltros');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    currentFilters.q = document.getElementById('searchQuery').value.trim();
    currentFilters.estado = document.getElementById('filterEstado').value;
    currentPage = 0;
    loadPedidos();
  });
}

// Toast
function showToast(message, type = 'info'){
  const colors = { info: 'primary', success: 'success', error: 'danger', warn: 'warning' };
  const color = colors[type] || 'primary';

  let holder = document.getElementById('toast-holder');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'toast-holder';
    holder.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(holder);
  }

  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${color} border-0`;
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  holder.appendChild(el);

  const toast = new bootstrap.Toast(el, { delay: 3000 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  const payload = checkAdminAccess();
  if (!payload) return;

  setupSidebar();
  setupModalDetalle();
  setupFilters();
  loadPedidos();
  loadStats();
});