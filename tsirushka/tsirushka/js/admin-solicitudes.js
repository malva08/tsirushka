// /js/admin-solicitudes.js
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
let currentSolicitudId = null;

// Cargar solicitudes
async function loadSolicitudes(){
  const tbody = document.getElementById('solicitudesTable');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      size: currentSize,
      ...(currentFilters.q && { q: currentFilters.q }),
      ...(currentFilters.estado && { estado: currentFilters.estado })
    });

    const data = await apiFetch(`/admin/solicitudes?${params}`, { auth: true });

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">No se encontraron solicitudes</td></tr>';
      document.getElementById('paginacion').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.items.map(solicitud => {
      const fecha = new Date(solicitud.createdAt).toLocaleString('es-CR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let estadoBadge = '';
      if (solicitud.estado === 'PENDIENTE') {
        estadoBadge = '<span class="badge text-bg-warning">Pendiente</span>';
      } else if (solicitud.estado === 'LEIDA') {
        estadoBadge = '<span class="badge text-bg-info">Leída</span>';
      } else if (solicitud.estado === 'RESUELTA') {
        estadoBadge = '<span class="badge text-bg-success">Resuelta</span>';
      }

      return `
        <tr>
          <td>
            <small class="text-muted">${fecha}</small>
          </td>
          <td>
            <div class="fw-semibold">${solicitud.solicitanteNombre}</div>
            <small class="text-muted">${solicitud.solicitanteEmail}</small>
          </td>
          <td>
            <div class="text-truncate" style="max-width: 300px;" title="${solicitud.asunto}">
              ${solicitud.asunto}
            </div>
          </td>
          <td>${estadoBadge}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary" data-action="view" data-id="${solicitud.id}" title="Ver detalle">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-danger" data-action="delete" data-id="${solicitud.id}" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Delegación de eventos
    tbody.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => verDetalle(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteSolicitud(btn.dataset.id));
    });

    renderPagination(data.total, data.size);

  } catch (err) {
    console.error('Error cargando solicitudes:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-5">Error al cargar solicitudes</td></tr>';
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
        loadSolicitudes();
      } else if (action === 'next' && currentPage < totalPages - 1) {
        currentPage++;
        loadSolicitudes();
      }
    });
  });
}

// Cargar estadísticas
async function loadStats(){
  try {
    const stats = await apiFetch('/admin/solicitudes/stats', { auth: true });
    document.getElementById('statTotal').textContent = stats.total || '0';
    document.getElementById('statPendientes').textContent = stats.pendientes || '0';
    document.getElementById('statLeidas').textContent = stats.leidas || '0';
    document.getElementById('statResueltas').textContent = stats.resueltas || '0';
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// Ver detalle
async function verDetalle(id){
  try {
    const solicitud = await apiFetch(`/admin/solicitudes/${id}`, { auth: true });
    
    currentSolicitudId = id;

    document.getElementById('detNombre').textContent = solicitud.solicitanteNombre;
    document.getElementById('detEmail').textContent = solicitud.solicitanteEmail;
    document.getElementById('detTelefono').textContent = solicitud.solicitanteTelefono || 'No proporcionado';
    document.getElementById('detAsunto').textContent = solicitud.asunto;
    document.getElementById('detMensaje').textContent = solicitud.mensaje || 'Sin mensaje';
    document.getElementById('detNotas').value = solicitud.notasInternas || '';
    
    const fecha = new Date(solicitud.createdAt).toLocaleString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('detFecha').textContent = fecha;

    let estadoBadge = '';
    if (solicitud.estado === 'PENDIENTE') {
      estadoBadge = '<span class="badge text-bg-warning">Pendiente</span>';
    } else if (solicitud.estado === 'LEIDA') {
      estadoBadge = '<span class="badge text-bg-info">Leída</span>';
    } else if (solicitud.estado === 'RESUELTA') {
      estadoBadge = '<span class="badge text-bg-success">Resuelta</span>';
    }
    document.getElementById('detEstado').innerHTML = estadoBadge;

    // Adjunto
    const adjuntoContainer = document.getElementById('detAdjuntoContainer');
    if (solicitud.adjuntoUrl) {
      document.getElementById('detAdjunto').href = solicitud.adjuntoUrl;
      adjuntoContainer.style.display = '';
    } else {
      adjuntoContainer.style.display = 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
    modal.show();

  } catch (err) {
    console.error('Error cargando detalle:', err);
    showToast('Error al cargar la solicitud', 'error');
  }
}

// Setup modal de detalle
function setupModalDetalle(){
  document.getElementById('btnGuardarNotas')?.addEventListener('click', async () => {
    if (!currentSolicitudId) return;

    const notas = document.getElementById('detNotas').value.trim();

    try {
      await apiFetch(`/admin/solicitudes/${currentSolicitudId}/notas`, {
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

  document.getElementById('btnMarcarPendiente')?.addEventListener('click', () => {
    cambiarEstado('marcar-pendiente');
  });

  document.getElementById('btnMarcarLeida')?.addEventListener('click', () => {
    cambiarEstado('marcar-leida');
  });

  document.getElementById('btnMarcarResuelta')?.addEventListener('click', () => {
    cambiarEstado('marcar-resuelta');
  });
}

// Cambiar estado
async function cambiarEstado(accion){
  if (!currentSolicitudId) return;

  try {
    await apiFetch(`/admin/solicitudes/${currentSolicitudId}/${accion}`, {
      method: 'PATCH',
      auth: true
    });

    showToast('Estado actualizado correctamente', 'success');
    
    // Cerrar modal y recargar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalDetalle'));
    modal.hide();
    
    loadSolicitudes();
    loadStats();

  } catch (err) {
    console.error('Error cambiando estado:', err);
    showToast('Error al cambiar el estado', 'error');
  }
}

// Eliminar solicitud
async function deleteSolicitud(id){
  try {
    const solicitud = await apiFetch(`/admin/solicitudes/${id}`, { auth: true });
    
    document.getElementById('deleteSolicitudAsunto').textContent = solicitud.asunto;
    
    const modal = new bootstrap.Modal(document.getElementById('modalEliminar'));
    modal.show();

    document.getElementById('confirmDelete').onclick = async () => {
      try {
        await apiFetch(`/admin/solicitudes/${id}`, { method: 'DELETE', auth: true });
        showToast('Solicitud eliminada correctamente', 'success');
        modal.hide();
        loadSolicitudes();
        loadStats();
      } catch (err) {
        console.error('Error eliminando solicitud:', err);
        showToast('Error al eliminar: ' + err.message, 'error');
      }
    };

  } catch (err) {
    console.error('Error:', err);
    showToast('Error al procesar la solicitud', 'error');
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
    loadSolicitudes();
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
  loadSolicitudes();
  loadStats();
});