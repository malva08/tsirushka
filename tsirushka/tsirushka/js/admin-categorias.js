// /js/admin-categorias.js
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

let editingCategoriaId = null;

async function loadCategorias(){
  const tbody = document.getElementById('categoriasTable');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const data = await apiFetch('/admin/categorias', { auth: true });

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">No hay categorías</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(cat => `
      <tr>
        <td class="fw-semibold">${cat.nombre}</td>
        <td><code class="small">${cat.slug}</code></td>
        <td>${cat.descripcion || '-'}</td>
        <td><span class="badge bg-light text-dark">${cat.cantidadProductos} productos</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-action="edit" data-id="${cat.id}" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" data-action="delete" data-id="${cat.id}" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => editCategoria(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteCategoria(btn.dataset.id));
    });

  } catch (err) {
    console.error('Error cargando categorías:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-5">Error al cargar categorías</td></tr>';
  }
}

async function loadStats(){
  try {
    const stats = await apiFetch('/admin/categorias/stats', { auth: true });
    document.getElementById('statTotal').textContent = stats.total || '0';
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

function setupForm(){
  const form = document.getElementById('formCategoria');
  const modal = new bootstrap.Modal(document.getElementById('modalCategoria'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const categoria = {
      nombre: document.getElementById('catNombre').value.trim(),
      descripcion: document.getElementById('catDescripcion').value.trim() || null
    };

    try {
      if (editingCategoriaId) {
        await apiFetch(`/admin/categorias/${editingCategoriaId}`, {
          method: 'PUT',
          body: categoria,
          auth: true
        });
        showToast('Categoría actualizada correctamente', 'success');
      } else {
        await apiFetch('/admin/categorias', {
          method: 'POST',
          body: categoria,
          auth: true
        });
        showToast('Categoría creada correctamente', 'success');
      }

      modal.hide();
      form.reset();
      editingCategoriaId = null;
      loadCategorias();
      loadStats();

    } catch (err) {
      console.error('Error guardando categoría:', err);
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.querySelector('[data-bs-target="#modalCategoria"]')?.addEventListener('click', () => {
    editingCategoriaId = null;
    form.reset();
    document.getElementById('modalCategoriaTitle').textContent = 'Nueva Categoría';
  });
}

async function editCategoria(id){
  try {
    const cat = await apiFetch(`/admin/categorias/${id}`, { auth: true });
    
    editingCategoriaId = id;
    document.getElementById('modalCategoriaTitle').textContent = 'Editar Categoría';
    document.getElementById('catNombre').value = cat.nombre;
    document.getElementById('catDescripcion').value = cat.descripcion || '';

    const modal = new bootstrap.Modal(document.getElementById('modalCategoria'));
    modal.show();

  } catch (err) {
    console.error('Error cargando categoría:', err);
    showToast('Error al cargar la categoría', 'error');
  }
}

async function deleteCategoria(id){
  try {
    const cat = await apiFetch(`/admin/categorias/${id}`, { auth: true });
    
    document.getElementById('deleteCategoriaName').textContent = cat.nombre;
    
    const modal = new bootstrap.Modal(document.getElementById('modalEliminar'));
    modal.show();

    document.getElementById('confirmDelete').onclick = async () => {
      try {
        await apiFetch(`/admin/categorias/${id}`, { method: 'DELETE', auth: true });
        showToast('Categoría eliminada correctamente', 'success');
        modal.hide();
        loadCategorias();
        loadStats();
      } catch (err) {
        console.error('Error eliminando categoría:', err);
        showToast('Error al eliminar: ' + err.message, 'error');
      }
    };

  } catch (err) {
    console.error('Error:', err);
    showToast('Error al procesar la solicitud', 'error');
  }
}

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

document.addEventListener('DOMContentLoaded', () => {
  const payload = checkAdminAccess();
  if (!payload) return;

  setupSidebar();
  setupForm();
  loadCategorias();
  loadStats();
});