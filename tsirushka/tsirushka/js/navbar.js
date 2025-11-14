// /js/navbar.js
import { getToken, clearToken } from "./api.js";
import { toggleAuthButtons } from "./ui.js";

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
function currentFile() {
  return (location.pathname.split("/").pop() || "index.html").toLowerCase();
}

function cartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem("tsir.cart") || "[]");
    return cart.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);
  } catch {
    return 0;
  }
}

export async function setupNavbar() {
  const token = getToken();
  const payload = token ? parseJwt(token) : null;

  toggleAuthButtons(!!token);

  const nav = document.getElementById("navLinks");
  if (nav) {
    // Menú público mejorado
    nav.innerHTML = `
      <li class="nav-item"><a class="nav-link" href="index.html">
        <i class="bi bi-house-door"></i> Inicio
      </a></li>
      <li class="nav-item"><a class="nav-link" href="catalogo.html">
        <i class="bi bi-box2-heart"></i> Productos
      </a></li>
      <li class="nav-item"><a class="nav-link" href="servicios.html">
        <i class="bi bi-star"></i> Servicios
      </a></li>
      <li class="nav-item d-none d-lg-block"><a class="nav-link" href="contacto.html">
        <i class="bi bi-chat-dots"></i> Contacto
      </a></li>
      <li class="nav-item"><a class="nav-link" href="cart.html">
        <i class="bi bi-cart3"></i> Carrito 
        <span id="cartCount" class="badge text-bg-primary align-text-top">0</span>
      </a></li>
    `;

    if (token) {
      nav.insertAdjacentHTML(
        "beforeend",
        `
        <li class="nav-item"><a class="nav-link" href="mis-pedidos.html">
          <i class="bi bi-receipt"></i> Mis Pedidos
        </a></li>
      `
      );
    }

    // Solo admin: acceso al panel
    if (hasAdminRole(payload)) {
      nav.insertAdjacentHTML(
        "beforeend",
        `
        <li class="nav-item">
          <a class="nav-link" href="admin-solicitudes.html">
            <i class="bi bi-gear"></i> Admin
          </a>
        </li>
      `
      );
    }

    // Activo por archivo
    const here = (
      location.pathname.split("/").pop() || "index.html"
    ).toLowerCase();
    nav.querySelectorAll(".nav-link").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href === here || (here === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
  }

  // Contador inicial + listeners
  const badge = document.getElementById("cartCount");
  const updateBadge = () => {
    if (badge) {
      const count = cartCount();
      badge.textContent = count;
      // Ocultar badge si está en 0
      badge.style.display = count > 0 ? "inline" : "none";
    }
  };
  updateBadge();

  // Eventos para sincronizar entre páginas y pestañas
  window.addEventListener("cart:updated", updateBadge);
  window.addEventListener("storage", (e) => {
    if (e.key === "tsir.cart") updateBadge();
  });

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    clearToken();
    location.href = "index.html";
  });
}
