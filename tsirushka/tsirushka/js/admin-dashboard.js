// /js/admin-dashboard.js
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
}

// ========== ESTADÍSTICAS ==========
async function loadStats() {
  try {
    // Productos activos
    const productos = await apiFetch("/admin/productos?page=0&size=1", {
      auth: true,
    });
    const productosEl = document.getElementById("statProductos");
    if (productosEl) productosEl.textContent = productos.total || "0";

    const bajoStock = await apiFetch("/admin/productos?lowStock=true&size=1", {
      auth: true,
    });
    const bajoStockEl = document.getElementById("statBajoStock");
    if (bajoStockEl) bajoStockEl.textContent = bajoStock.total || "0";

    // Pedidos totales
    try {
      const pedidosStats = await apiFetch("/admin/pedidos/stats", {
        auth: true,
      });
      const pedidosEl = document.getElementById("statPedidos");
      if (pedidosEl) pedidosEl.textContent = pedidosStats.total || "0";

      // Ventas totales
      const ventasEl = document.getElementById("statVentas");
      if (ventasEl)
        ventasEl.textContent = moneyCRC(
          pedidosStats.ventasTotalesCentimos || 0
        );
    } catch (err) {
      console.log("Estadísticas de pedidos no disponibles aún");
      const pedidosEl = document.getElementById("statPedidos");
      const ventasEl = document.getElementById("statVentas");
      if (pedidosEl) pedidosEl.textContent = "0";
      if (ventasEl) ventasEl.textContent = moneyCRC(0);
    }
  } catch (err) {
    console.error("Error cargando estadísticas:", err);
  }
}
// ========== PEDIDOS RECIENTES ==========
async function loadRecentOrders() {
  const tbody = document.getElementById("recentOrders");
  try {
    const data = await apiFetch("/admin/pedidos?page=0&size=5", { auth: true });

    if (!data.items || data.items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">No hay pedidos recientes</td></tr>';
      return;
    }

    tbody.innerHTML = data.items
      .map((order) => {
        const statusColors = {
          PENDIENTE: "warning",
          CONFIRMADO: "info",
          PREPARANDO: "primary",
          ENVIADO: "secondary",
          ENTREGADO: "success",
          CANCELADO: "danger",
        };
        const statusColor = statusColors[order.estado] || "secondary";

        const fecha = new Date(order.createdAt).toLocaleDateString("es-CR", {
          day: "2-digit",
          month: "short",
        });

        return `
        <tr>
          <td><span class="font-monospace small">${
            order.numeroPedido
          }</span></td>
          <td>${order.clienteNombre || "N/A"}</td>
          <td><small class="text-muted">${fecha}</small></td>
          <td class="fw-semibold">${moneyCRC(order.totalCentimos)}</td>
          <td><span class="badge text-bg-${statusColor}">${
          order.estado
        }</span></td>
          <td>
            <a href="admin-pedidos.html" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-eye"></i>
            </a>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Error cargando pedidos:", err);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted py-4">No hay pedidos disponibles</td></tr>';
  }
}

// ========== PRODUCTOS BAJO STOCK ==========
async function loadLowStockProducts() {
  const container = document.getElementById("lowStockProducts");
  try {
    // ✅ Usar el endpoint existente con lowStock=true
    const data = await apiFetch("/admin/productos?lowStock=true&size=5", {
      auth: true,
    });

    if (!data.items || data.items.length === 0) {
      container.innerHTML =
        '<div class="text-center text-muted py-3 small">✓ Todos los productos tienen stock adecuado</div>';
      return;
    }

    container.innerHTML = data.items
      .map(
        (prod) => `
      <div class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          <div class="fw-semibold small">${prod.nombre}</div>
          <small class="text-danger">Stock: ${prod.stock} unidades</small>
        </div>
        <span class="badge bg-warning text-dark">
          <i class="bi bi-exclamation-triangle"></i>
        </span>
      </div>
    `
      )
      .join("");
  } catch (err) {
    console.error("Error cargando productos bajo stock:", err);
    container.innerHTML =
      '<div class="text-center text-muted py-3 small">No disponible</div>';
  }
}


function formatTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return past.toLocaleDateString();
}

// ========== GRÁFICO ==========
function createSalesChart() {
  const ctx = document.getElementById("salesChart");
  if (!ctx) return;

  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const currentMonth = new Date().getMonth();
  const last6Months = months.slice(
    Math.max(0, currentMonth - 5),
    currentMonth + 1
  );

  new Chart(ctx, {
    type: "line",
    data: {
      labels: last6Months,
      datasets: [
        {
          label: "Ventas (₡)",
          data: [850000, 920000, 1100000, 980000, 1250000, 1350000],
          borderColor: "#6b3e2e",
          backgroundColor: "rgba(107, 62, 46, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₡" + value / 1000 + "k";
            },
          },
        },
      },
    },
  });
}

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", async () => {
  const payload = checkAdminAccess();
  if (!payload) return;

  document.getElementById("adminUserName").textContent =
    payload.sub?.split("@")[0] || "Admin";
  document.getElementById("adminUserEmail").textContent = payload.sub || "";

  setupSidebar();

  document.getElementById("adminLogout")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("¿Cerrar sesión?")) {
      clearToken();
      location.href = "login.html";
    }
  });

  await Promise.all([
    loadStats(),
    loadRecentOrders(),
    loadLowStockProducts(),
  ]);

  createSalesChart();
});
