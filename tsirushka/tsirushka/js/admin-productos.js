// /js/admin-productos.js
import { apiFetch, getToken, clearToken } from "./api.js";
import { moneyCRC } from "./ui.js";

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hasAdminRole(payload) {
  const roles = (payload?.roles || "")
    .split(",")
    .map((r) => r.trim().toUpperCase());
  return roles.includes("ADMIN") || roles.includes("ROLE_ADMIN");
}

function checkAdminAccess() {
  const token = getToken();
  if (!token) {
    location.href =
      "login.html?redirect=" + encodeURIComponent(location.pathname);
    return false;
  }
  const payload = parseJwt(token);
  if (!hasAdminRole(payload)) {
    alert("Acceso denegado. Se requieren permisos de administrador.");
    location.href = "index.html";
    return false;
  }
  return payload;
}

// Sidebar toggle
function setupSidebar() {
  const sidebar = document.getElementById("adminSidebar");
  const toggleBtn = document.getElementById("sidebarToggleBtn");
  const closeBtn = document.getElementById("sidebarToggle");

  toggleBtn?.addEventListener("click", () => sidebar.classList.add("show"));
  closeBtn?.addEventListener("click", () => sidebar.classList.remove("show"));

  document.addEventListener("click", (e) => {
    if (
      window.innerWidth < 992 &&
      sidebar.classList.contains("show") &&
      !sidebar.contains(e.target) &&
      e.target !== toggleBtn
    ) {
      sidebar.classList.remove("show");
    }
  });

  document.getElementById("adminLogout")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("¿Cerrar sesión?")) {
      clearToken();
      location.href = "login.html";
    }
  });
}

// Variables globales
let currentPage = 0;
let currentSize = 10;
let currentFilters = { q: "", categoria: "", estado: "" };
let editingProductId = null;
let categorias = []; 

async function loadCategorias() {
  try {
    categorias = await apiFetch("/admin/productos/categorias", { auth: true });

    // Poblar el select del modal de producto
    const selectProducto = document.getElementById("prodCategoria");
    if (selectProducto) {
      selectProducto.innerHTML =
        '<option value="">Seleccionar...</option>' +
        categorias
          .map((cat) => `<option value="${cat.id}">${cat.nombre}</option>`)
          .join("");
    }

    // Poblar el select de filtros
    const selectFiltro = document.getElementById("filterCategoria");
    if (selectFiltro) {
      selectFiltro.innerHTML =
        '<option value="">Todas</option>' +
        categorias
          .map((cat) => `<option value="${cat.id}">${cat.nombre}</option>`)
          .join("");
    }
  } catch (err) {
    console.error("Error cargando categorías:", err);
    showToast("No se pudieron cargar las categorías", "warn");
  }
}

async function toggleEstado(id, accion) {
  const textoAccion = accion === "activar" ? "activar" : "inactivar";

  if (!confirm(`¿Estás seguro de que deseas ${textoAccion} este producto?`)) {
    return;
  }

  try {
    await apiFetch(`/admin/productos/${id}/${accion}`, {
      method: "PATCH",
      auth: true,
    });

    showToast(
      `Producto ${
        accion === "activar" ? "activado" : "inactivado"
      } correctamente`,
      "success"
    );
    loadProductos();
  } catch (err) {
    console.error(`Error al ${textoAccion} producto:`, err);
    showToast(`Error al ${textoAccion} el producto: ` + err.message, "error");
  }
}

// Cargar productos
async function loadProductos() {
  const tbody = document.getElementById("productosTable");
  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      size: currentSize,
      ...(currentFilters.q && { q: currentFilters.q }),
      ...(currentFilters.categoria && { categoria: currentFilters.categoria }),
    });

    const data = await apiFetch(`/admin/productos?${params}`, { auth: true });

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted py-5">No se encontraron productos</td></tr>';
      document.getElementById("paginacion").innerHTML = "";
      return;
    }

    let items = data.items;
    if (currentFilters.estado) {
      items = items.filter((p) => {
        if (currentFilters.estado === "activo") return p.activo;
        if (currentFilters.estado === "inactivo") return !p.activo;
        if (currentFilters.estado === "bajo-stock")
          return p.stock < (p.stockMinimo || 5);
        return true;
      });
    }

    tbody.innerHTML = items
      .map((producto) => {
        const img =
          producto.imagenUrl || "https://placehold.co/100x100?text=Producto";
        const price = moneyCRC(producto.precioCentimos);
        const categoriaNombre = producto.categoria?.nombre || "Sin categoría";

        let stockBadge = "";
        if (producto.stock === 0) {
          stockBadge = '<span class="badge badge-stock-out">Sin stock</span>';
        } else if (producto.stock < (producto.stockMinimo || 5)) {
          stockBadge = '<span class="badge badge-stock-low">Bajo</span>';
        } else {
          stockBadge = '<span class="badge badge-stock-ok">OK</span>';
        }

        const activoBadge = producto.activo
          ? '<span class="badge text-bg-success">Activo</span>'
          : '<span class="badge text-bg-secondary">Inactivo</span>';

        const toggleBtn = producto.activo
          ? `<button class="btn btn-outline-warning" data-action="inactivar" data-id="${producto.id}" title="Inactivar">
         <i class="bi bi-eye-slash"></i>
       </button>`
          : `<button class="btn btn-outline-success" data-action="activar" data-id="${producto.id}" title="Activar">
         <i class="bi bi-eye"></i>
       </button>`;

        return `
    <tr data-id="${producto.id}">
      <td><img src="${img}" alt="${
          producto.nombre
        }" class="rounded" style="width:60px;height:60px;object-fit:cover;"></td>
      <td>
        <div class="fw-semibold">${producto.nombre}</div>
        <small class="text-muted">${producto.sku || "Sin SKU"}</small>
      </td>
      <td><span class="badge bg-light text-dark">${categoriaNombre}</span></td>
      <td class="fw-semibold text-primary">${price}</td>
      <td>
        <div>${producto.stock} uds.</div>
        ${stockBadge}
      </td>
      <td>${activoBadge}</td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary" data-action="edit" data-id="${
            producto.id
          }" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          ${toggleBtn}
          <button class="btn btn-outline-danger" data-action="delete" data-id="${
            producto.id
          }" title="Eliminar permanentemente">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
      })
      .join("");

    // Delegación de eventos para botones
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => editProducto(btn.dataset.id));
    });

    tbody.querySelectorAll('[data-action="activar"]').forEach((btn) => {
      btn.addEventListener("click", () =>
        toggleEstado(btn.dataset.id, "activar")
      );
    });
    tbody.querySelectorAll('[data-action="inactivar"]').forEach((btn) => {
      btn.addEventListener("click", () =>
        toggleEstado(btn.dataset.id, "inactivar")
      );
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", () => deleteProducto(btn.dataset.id));
    });

    // Paginación
    renderPagination(data.total, data.size);
  } catch (err) {
    console.error("Error cargando productos:", err);
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-danger py-5">Error al cargar productos</td></tr>';
  }
}

function renderPagination(total, size) {
  const pag = document.getElementById("paginacion");
  const totalPages = Math.ceil(total / size);

  if (totalPages <= 1) {
    pag.innerHTML = "";
    return;
  }

  const prevDisabled = currentPage <= 0 ? "disabled" : "";
  const nextDisabled = currentPage >= totalPages - 1 ? "disabled" : "";

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

  pag.querySelectorAll("[data-page]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const action = a.dataset.page;
      if (action === "prev" && currentPage > 0) {
        currentPage--;
        loadProductos();
      } else if (action === "next" && currentPage < totalPages - 1) {
        currentPage++;
        loadProductos();
      }
    });
  });
}

// Formulario de producto
function setupProductForm() {
  const form = document.getElementById("formProducto");
  const modal = new bootstrap.Modal(document.getElementById("modalProducto"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const categoriaId = document.getElementById("prodCategoria").value;

    const producto = {
      nombre: document.getElementById("prodNombre").value.trim(),
      categoriaId: categoriaId || null,
      precioCentimos:
        parseInt(document.getElementById("prodPrecio").value) * 100,
      stock: parseInt(document.getElementById("prodStock").value),
      stockMinimo: parseInt(document.getElementById("prodStockMin").value) || 5,
      descripcion:
        document.getElementById("prodDescripcion").value.trim() || null,
      imagenUrl: document.getElementById("prodImagen").value.trim() || null,
      activo: document.getElementById("prodActivo").checked,
    };

    try {
      if (editingProductId) {
        // Actualizar
        await apiFetch(`/admin/productos/${editingProductId}`, {
          method: "PUT",
          body: producto,
          auth: true,
        });
        showToast("Producto actualizado correctamente", "success");
      } else {
        // Crear
        await apiFetch("/admin/productos", {
          method: "POST",
          body: producto,
          auth: true,
        });
        showToast("Producto creado correctamente", "success");
      }

      modal.hide();
      form.reset();
      editingProductId = null;
      loadProductos();
    } catch (err) {
      console.error("Error guardando producto:", err);
      showToast("Error al guardar el producto: " + err.message, "error");
    }
  });

  // Abrir modal para nuevo producto
  document
    .querySelector('[data-bs-target="#modalProducto"]')
    ?.addEventListener("click", () => {
      editingProductId = null;
      form.reset();
      document.getElementById("modalProductoTitle").textContent =
        "Nuevo Producto";
      document.getElementById("prodActivo").checked = true;
    });
}

// Editar producto
async function editProducto(id) {
  try {
    const producto = await apiFetch(`/admin/productos/${id}`, { auth: true });

    editingProductId = id;
    document.getElementById("modalProductoTitle").textContent =
      "Editar Producto";

    document.getElementById("prodNombre").value = producto.nombre;
    document.getElementById("prodCategoria").value =
      producto.categoria?.id || "";
    document.getElementById("prodPrecio").value = producto.precioCentimos / 100;
    document.getElementById("prodStock").value = producto.stock;
    document.getElementById("prodStockMin").value = producto.stockMinimo || 5;
    document.getElementById("prodDescripcion").value =
      producto.descripcion || "";
    document.getElementById("prodImagen").value =
      producto.imagenes?.[0]?.url || "";
    document.getElementById("prodActivo").checked = producto.activo;

    const modal = new bootstrap.Modal(document.getElementById("modalProducto"));
    modal.show();
  } catch (err) {
    console.error("Error cargando producto:", err);
    showToast("Error al cargar el producto", "error");
  }
}
// Actualizar la función deleteProducto
async function deleteProducto(id) {
  try {
    const producto = await apiFetch(`/admin/productos/${id}`, { auth: true });

    document.getElementById("deleteProductName").textContent = producto.nombre;

    const modal = new bootstrap.Modal(document.getElementById("modalEliminar"));
    modal.show();

    document.getElementById("confirmDelete").onclick = async () => {
      try {
        await apiFetch(`/admin/productos/${id}`, {
          method: "DELETE",
          auth: true,
        });
        showToast("Producto eliminado permanentemente", "success");
        modal.hide();
        loadProductos();
      } catch (err) {
        console.error("Error eliminando producto:", err);
        showToast("Error al eliminar: " + err.message, "error");
      }
    };
  } catch (err) {
    console.error("Error:", err);
    showToast("Error al procesar la solicitud", "error");
  }
}

// Toast notifications
function showToast(message, type = "info") {
  const colors = {
    info: "primary",
    success: "success",
    error: "danger",
    warn: "warning",
  };
  const color = colors[type] || "primary";

  let holder = document.getElementById("toast-holder");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "toast-holder";
    holder.className = "toast-container position-fixed top-0 end-0 p-3";
    document.body.appendChild(holder);
  }

  const el = document.createElement("div");
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
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

// Filtros
function setupFilters() {
  const form = document.getElementById("formFiltros");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    currentFilters.q = document.getElementById("searchQuery").value.trim();
    currentFilters.categoria = document.getElementById("filterCategoria").value;
    currentFilters.estado = document.getElementById("filterEstado").value;
    currentPage = 0;
    loadProductos();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const payload = checkAdminAccess();
  if (!payload) return;

  setupSidebar();
  setupProductForm();
  setupFilters();

  await loadCategorias();

  loadProductos();
});
