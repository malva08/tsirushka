// /js/admin-clientes.js
import { apiFetch, getToken, clearToken } from './api.js';

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
let editingClienteId = null;

// Cargar clientes
async function loadClientes(){
  const tbody = document.getElementById('clientesTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      size: currentSize,
      ...(currentFilters.q && { q: currentFilters.q }),
      ...(currentFilters.estado && { estado: currentFilters.estado })
    });

    const data = await apiFetch(`/admin/clientes?${params}`, { auth: true });

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">No se encontraron clientes</td></tr>';
      document.getElementById('paginacion').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.items.map(cliente => {
      const estadoBadge = cliente.estado === 'ACTIVO'
        ? '<span class="badge text-bg-success">Activo</span>'
        : '<span class="badge text-bg-danger">Bloqueado</span>';

      const verificadoBadge = cliente.emailVerificado
        ? '<i class="bi bi-patch-check-fill text-success" title="Email verificado"></i>'
        : '<i class="bi bi-patch-check text-muted" title="Email no verificado"></i>';

      const toggleBtn = cliente.estado === 'ACTIVO'
        ? `<button class="btn btn-outline-warning btn-sm" data-action="bloquear" data-id="${cliente.id}" title="Bloquear">
             <i class="bi bi-lock"></i>
           </button>`
        : `<button class="btn btn-outline-success btn-sm" data-action="desbloquear" data-id="${cliente.id}" title="Desbloquear">
             <i class="bi bi-unlock"></i>
           </button>`;

      return `
        <tr>
          <td>
            <div class="fw-semibold">${cliente.nombreCompleto}</div>
            <small class="text-muted">ID: ${cliente.id.substring(0, 8)}...</small>
          </td>
          <td>
            ${cliente.email} ${verificadoBadge}
          </td>
          <td>${cliente.telefono || '-'}</td>
          <td>
            <button class="btn btn-sm btn-outline-secondary" data-action="pedidos" data-id="${cliente.id}">
              <i class="bi bi-bag"></i> ${cliente.cantidadPedidos}
            </button>
          </td>
          <td>${estadoBadge}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary" data-action="edit" data-id="${cliente.id}" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              ${toggleBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Delegación de eventos
    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => editCliente(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-action="bloquear"]').forEach(btn => {
      btn.addEventListener('click', () => toggleEstado(btn.dataset.id, 'bloquear'));
    });
    tbody.querySelectorAll('[data-action="desbloquear"]').forEach(btn => {
      btn.addEventListener('click', () => toggleEstado(btn.dataset.id, 'desbloquear'));
    });
    tbody.querySelectorAll('[data-action="pedidos"]').forEach(btn => {
      btn.addEventListener('click', () => verPedidos(btn.dataset.id));
    });

    renderPagination(data.total, data.size);

  } catch (err) {
    console.error('Error cargando clientes:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">Error al cargar clientes</td></tr>';
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
        loadClientes();
      } else if (action === 'next' && currentPage < totalPages - 1) {
        currentPage++;
        loadClientes();
      }
    });
  });
}

// Cargar estadísticas
async function loadStats(){
  try {
    const stats = await apiFetch('/admin/clientes/stats', { auth: true });
    document.getElementById('statTotal').textContent = stats.total || '0';
    document.getElementById('statActivos').textContent = stats.activos || '0';
    document.getElementById('statBloqueados').textContent = stats.bloqueados || '0';
    document.getElementById('statVerificados').textContent = stats.verificados || '0';
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// Formulario de edición
function setupForm(){
  const form = document.getElementById('formCliente');
  const modal = new bootstrap.Modal(document.getElementById('modalCliente'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cliente = {
      nombreCompleto: document.getElementById('clienteNombre').value.trim(),
      telefono: document.getElementById('clienteTelefono').value.trim() || null
    };

    try {
      await apiFetch(`/admin/clientes/${editingClienteId}`, {
        method: 'PUT',
        body: cliente,
        auth: true
      });

      showToast('Cliente actualizado correctamente', 'success');
      modal.hide();
      form.reset();
      editingClienteId = null;
      loadClientes();

    } catch (err) {
      console.error('Error actualizando cliente:', err);
      showToast('Error: ' + err.message, 'error');
    }
  });
}

// Editar cliente
async function editCliente(id){
  try {
    const cliente = await apiFetch(`/admin/clientes/${id}`, { auth: true });
    
    editingClienteId = id;
    document.getElementById('clienteNombre').value = cliente.nombreCompleto;
    document.getElementById('clienteTelefono').value = cliente.telefono || '';
    document.getElementById('clienteEmail').value = cliente.email;

    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    modal.show();

  } catch (err) {
    console.error('Error cargando cliente:', err);
    showToast('Error al cargar el cliente', 'error');
  }
}

// Bloquear/Desbloquear
async function toggleEstado(id, accion) {
  const textoAccion = accion === 'bloquear' ? 'bloquear' : 'desbloquear';
  
  if (!confirm(`¿Estás seguro de que deseas ${textoAccion} este cliente?`)) {
    return;
  }

  try {
    await apiFetch(`/admin/clientes/${id}/${accion}`, { 
      method: 'PATCH', 
      auth: true 
    });
    
    showToast(`Cliente ${accion === 'bloquear' ? 'bloqueado' : 'desbloqueado'} correctamente`, 'success');
    loadClientes();
    loadStats();
  } catch (err) {
    console.error(`Error al ${textoAccion} cliente:`, err);
    showToast(`Error al ${textoAccion} el cliente: ` + err.message, 'error');
  }
}

// Ver pedidos del cliente
async function verPedidos(id){
  try {
    const cliente = await apiFetch(`/admin/clientes/${id}`, { auth: true });
    const pedidos = await apiFetch(`/admin/clientes/${id}/pedidos`, { auth: true });

    const modal = new bootstrap.Modal(document.getElementById('modalPedidos'));
    const content = document.getElementById('pedidosContent');

    if (!pedidos.items || pedidos.items.length === 0) {
      content.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="bi bi-bag-x fs-1 mb-3"></i>
          <p>Este cliente aún no ha realizado pedidos.</p>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${pedidos.items.map(p => `
                <tr>
                  <td>${p.numero}</td>
                  <td>${new Date(p.fecha).toLocaleDateString()}</td>
                  <td>₡${(p.total / 100).toLocaleString()}</td>
                  <td><span class="badge text-bg-info">${p.estado}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    modal.show();

  } catch (err) {
    console.error('Error cargando pedidos:', err);
    showToast('Error al cargar los pedidos', 'error');
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
    loadClientes();
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
  setupForm();
  setupFilters();
  loadClientes();
  loadStats();
});