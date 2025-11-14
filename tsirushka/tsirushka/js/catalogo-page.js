// /js/catalogo-page.js
import { apiFetch, getToken } from './api.js';
import { moneyCRC, toggleAuthButtons, toast } from './ui.js';

const CART_KEY = 'tsir.cart';
let page = 0;
let size = 12;
let filtros = {
  q: '',
  categoria: '',
  precioMin: null,
  precioMax: null,
  soloStock: true,
  sortBy: 'nombre-asc'
};

let allProductos = [];
let categorias = [];
let viewMode = 'grid';

// ========== CARGAR CATEGORÍAS ==========

async function cargarCategorias() {
  const container = document.getElementById('categoriasList');
  try {
    const cats = await apiFetch('/catalogo/categorias');
    categorias = cats;

    if (cats.length === 0) {
      container.innerHTML = '<small class="text-muted">Sin categorías</small>';
      return;
    }

    container.innerHTML = `
      <div class="form-check mb-2">
        <input class="form-check-input" type="radio" name="categoria" id="cat-todas" value="" checked>
        <label class="form-check-label" for="cat-todas">
          Todas las categorías
        </label>
      </div>
      ${cats.map(cat => `
        <div class="form-check mb-2">
          <input class="form-check-input" type="radio" name="categoria" id="cat-${cat.id}" value="${cat.id}">
          <label class="form-check-label" for="cat-${cat.id}">
            ${cat.nombre}
          </label>
        </div>
      `).join('')}
    `;

    container.querySelectorAll('input[name="categoria"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        filtros.categoria = e.target.value;
        page = 0;
        cargarProductos();
      });
    });

  } catch (err) {
    console.error('Error cargando categorías:', err);
    container.innerHTML = '<small class="text-danger">Error al cargar</small>';
  }
}

// ========== CARGAR PRODUCTOS ==========

function renderSkeleton() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  
  const skeletonHTML = `
    <div class="col-sm-6 col-md-4 col-xl-3">
      <div class="card h-100">
        <div class="skeleton skel-img"></div>
        <div class="card-body">
          <div class="skeleton skel-text mb-2" style="width:70%"></div>
          <div class="skeleton skel-text mb-2" style="width:40%"></div>
          <div class="skeleton skel-text" style="width:50%; height:34px"></div>
        </div>
      </div>
    </div>
  `;
  
  for (let i = 0; i < 8; i++) {
    grid.insertAdjacentHTML('beforeend', skeletonHTML);
  }
}

async function cargarProductos() {
  renderSkeleton();
  document.getElementById('resultadosCount').textContent = 'Cargando...';

  try {
    const params = new URLSearchParams({
      page: 0,
      size: 1000
    });

    if (filtros.q) params.set('q', filtros.q);

    const data = await apiFetch(`/catalogo/productos?${params}`);
    allProductos = data.items || [];

    let filtered = [...allProductos];

    // Filtro por categoría
    if (filtros.categoria) {
      filtered = filtered.filter(p => p.categoriaId === filtros.categoria);
    }

    // Filtro por precio
    if (filtros.precioMin !== null) {
      filtered = filtered.filter(p => p.precioCentimos >= filtros.precioMin);
    }
    if (filtros.precioMax !== null) {
      filtered = filtered.filter(p => p.precioCentimos <= filtros.precioMax);
    }

    // Filtro por stock
    if (filtros.soloStock) {
      filtered = filtered.filter(p => p.stock > 0);
    }

    // Ordenar
    filtered = ordenarProductos(filtered, filtros.sortBy);

    // Paginar
    const start = page * size;
    const end = start + size;
    const paginados = filtered.slice(start, end);

    renderProductos(paginados);
    renderPaginacion(filtered.length);

    document.getElementById('resultadosCount').textContent = 
      `${filtered.length} ${filtered.length === 1 ? 'producto' : 'productos'} encontrados`;

  } catch (err) {
    console.error('Error cargando productos:', err);
    document.getElementById('grid').innerHTML = 
      '<div class="col-12 text-center text-danger py-5">Error al cargar productos</div>';
    toast('Error al cargar productos', 'error');
  }
}

function ordenarProductos(productos, sortBy) {
  const sorted = [...productos];
  
  switch (sortBy) {
    case 'nombre-asc':
      return sorted.sort((a, b) => a.nombre.localeCompare(b.nombre));
    case 'nombre-desc':
      return sorted.sort((a, b) => b.nombre.localeCompare(a.nombre));
    case 'precio-asc':
      return sorted.sort((a, b) => a.precioCentimos - b.precioCentimos);
    case 'precio-desc':
      return sorted.sort((a, b) => b.precioCentimos - a.precioCentimos);
    case 'nuevo':
      return sorted.reverse();
    default:
      return sorted;
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('grid');
  
  if (productos.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-inbox fs-1 text-muted"></i>
        <p class="text-muted mt-3">No se encontraron productos con los filtros seleccionados</p>
        <button class="btn btn-outline-primary" id="btnLimpiarFiltrosMsg">
          Limpiar filtros
        </button>
      </div>
    `;
    
    // Listener para el botón de limpiar filtros del mensaje
    document.getElementById('btnLimpiarFiltrosMsg')?.addEventListener('click', () => {
      document.getElementById('btnClearFilters').click();
    });
    
    return;
  }

  if (viewMode === 'grid') {
    grid.className = 'row g-3';
    grid.innerHTML = productos.map(p => renderProductoCard(p)).join('');
  } else {
    grid.className = 'row g-2';
    grid.innerHTML = productos.map(p => renderProductoList(p)).join('');
  }

  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const nombre = btn.dataset.name;
      const precio = Number(btn.dataset.price);
      addToCart({ id, nombre, precioCentimos: precio });
    });
  });
}

function renderProductoCard(p) {
  const img = p.imagenUrl || 'https://placehold.co/600x400?text=Tsirushka';
  const price = moneyCRC(p.precioCentimos);
  const stockBadge = p.stock > 0 
    ? `<span class="badge bg-success">En stock</span>`
    : `<span class="badge bg-secondary">Agotado</span>`;

  return `
    <div class="col-sm-6 col-md-4 col-xl-3">
      <div class="card h-100">
        <img src="${img}" class="card-img-top" alt="${p.nombre}" style="height: 200px; object-fit: cover;">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="card-title mb-0 small">${p.nombre}</h5>
            ${stockBadge}
          </div>
          <p class="card-text fw-semibold text-primary mb-3">${price}</p>
          <div class="mt-auto d-grid gap-2">
            <a class="btn btn-outline-primary btn-sm" href="producto.html?id=${p.id}">
              <i class="bi bi-eye"></i> Ver
            </a>
            <button class="btn btn-primary btn-sm" 
                    data-add 
                    data-id="${p.id}" 
                    data-name="${p.nombre.replace(/"/g, '&quot;')}" 
                    data-price="${p.precioCentimos}"
                    ${p.stock <= 0 ? 'disabled' : ''}>
              <i class="bi bi-bag-plus"></i> Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProductoList(p) {
  const img = p.imagenUrl || 'https://placehold.co/600x400?text=Tsirushka';
  const price = moneyCRC(p.precioCentimos);
  const stockBadge = p.stock > 0 
    ? `<span class="badge bg-success">En stock</span>`
    : `<span class="badge bg-secondary">Agotado</span>`;

  return `
    <div class="col-12">
      <div class="card">
        <div class="card-body">
          <div class="row align-items-center g-3">
            <div class="col-md-2">
              <img src="${img}" class="img-fluid rounded" alt="${p.nombre}">
            </div>
            <div class="col-md-5">
              <h5 class="mb-1">${p.nombre}</h5>
              <p class="text-muted small mb-0">${p.descripcion || 'Producto artesanal de cacao'}</p>
            </div>
            <div class="col-md-2 text-center">
              ${stockBadge}
            </div>
            <div class="col-md-2 text-center">
              <p class="fw-semibold text-primary mb-0">${price}</p>
            </div>
            <div class="col-md-1 text-end">
              <div class="btn-group-vertical btn-group-sm">
                <a class="btn btn-outline-primary" href="producto.html?id=${p.id}" title="Ver">
                  <i class="bi bi-eye"></i>
                </a>
                <button class="btn btn-primary" 
                        data-add 
                        data-id="${p.id}" 
                        data-name="${p.nombre.replace(/"/g, '&quot;')}" 
                        data-price="${p.precioCentimos}"
                        ${p.stock <= 0 ? 'disabled' : ''}
                        title="Agregar">
                  <i class="bi bi-bag-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPaginacion(total) {
  const pag = document.getElementById('paginacion');
  const totalPages = Math.ceil(total / size);
  
  if (totalPages <= 1) {
    pag.innerHTML = '';
    return;
  }

  const prevDisabled = page <= 0 ? 'disabled' : '';
  const nextDisabled = page >= totalPages - 1 ? 'disabled' : '';

  pag.innerHTML = `
    <li class="page-item ${prevDisabled}">
      <a class="page-link" href="#" data-page="prev">Anterior</a>
    </li>
    <li class="page-item disabled">
      <span class="page-link">Página ${page + 1} de ${totalPages}</span>
    </li>
    <li class="page-item ${nextDisabled}">
      <a class="page-link" href="#" data-page="next">Siguiente</a>
    </li>
  `;

  pag.querySelectorAll('[data-page]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const action = a.dataset.page;
      if (action === 'prev' && page > 0) {
        page--;
        cargarProductos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'next' && page < totalPages - 1) {
        page++;
        cargarProductos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

// ========== CARRITO ==========

function addToCart({ id, nombre, precioCentimos }) {
  const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  const row = cart.find(x => String(x.id) === String(id));
  if (row) {
    row.cantidad = Math.min(999, (Number(row.cantidad) || 0) + 1);
  } else {
    cart.push({ id, nombre, precioCentimos, cantidad: 1 });
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cart:updated'));
  toast('Producto agregado al carrito', 'success');
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
  toggleAuthButtons(!!getToken());

  cargarCategorias();
  cargarProductos();

  const searchInput = document.getElementById('searchInput');
  const btnSearch = document.getElementById('btnSearch');

  btnSearch.addEventListener('click', () => {
    filtros.q = searchInput.value.trim();
    page = 0;
    cargarProductos();
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSearch.click();
    }
  });

  document.getElementById('precioFilter').addEventListener('change', (e) => {
    const value = e.target.value;
    if (value) {
      const [min, max] = value.split('-').map(v => parseInt(v) * 100);
      filtros.precioMin = min;
      filtros.precioMax = max;
    } else {
      filtros.precioMin = null;
      filtros.precioMax = null;
    }
    page = 0;
    cargarProductos();
  });

  document.getElementById('stockOnly').addEventListener('change', (e) => {
    filtros.soloStock = e.target.checked;
    page = 0;
    cargarProductos();
  });

  document.getElementById('sortBy').addEventListener('change', (e) => {
    filtros.sortBy = e.target.value;
    page = 0;
    cargarProductos();
  });

  document.getElementById('btnClearFilters').addEventListener('click', () => {
    filtros = {
      q: '',
      categoria: '',
      precioMin: null,
      precioMax: null,
      soloStock: true,
      sortBy: 'nombre-asc'
    };
    page = 0;

    searchInput.value = '';
    document.getElementById('precioFilter').value = '';
    document.getElementById('stockOnly').checked = true;
    document.getElementById('sortBy').value = 'nombre-asc';
    
    const todasRadio = document.getElementById('cat-todas');
    if (todasRadio) todasRadio.checked = true;

    cargarProductos();
    toast('Filtros limpiados', 'info');
  });

  document.getElementById('viewGrid')?.addEventListener('click', () => {
    viewMode = 'grid';
    document.getElementById('viewGrid').classList.add('active');
    document.getElementById('viewList').classList.remove('active');
    cargarProductos();
  });

  document.getElementById('viewList')?.addEventListener('click', () => {
    viewMode = 'list';
    document.getElementById('viewList').classList.add('active');
    document.getElementById('viewGrid').classList.remove('active');
    cargarProductos();
  });
});