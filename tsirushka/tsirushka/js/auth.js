// /js/auth.js
import { apiFetch, saveToken, clearToken, getToken } from './api.js';
import { toast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;
    
    // Validación básica
    if (!email || !password) {
      toast('Por favor completa todos los campos', 'warn');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.innerHTML;
    
    try {
      // Deshabilitar botón y mostrar loading
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';
      
      const data = await apiFetch('/auth/login', {method:'POST', body:{email, password}});
      
      if (!data.accessToken) {
        toast('Error: No se recibió el token de autenticación', 'error');
        return;
      }
      
      saveToken(data.accessToken);
      toast('¡Bienvenido! Redirigiendo...', 'success');
      
      setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        location.href = redirect ? decodeURIComponent(redirect) : 'index.html';
      }, 800);
      
    } catch (err) {
      console.error('Error en login:', err);
      
      let mensaje = 'No se pudo iniciar sesión';
      
      if (err.message.includes('Usuario o contraseña inválidos') || 
          err.message.includes('inválidos')) {
        mensaje = 'Usuario o contraseña incorrectos';
      } else if (err.message.includes('bloqueado')) {
        mensaje = 'Tu cuenta está bloqueada. Contacta al administrador.';
      } else if (err.message.includes('HTTP 500')) {
        mensaje = 'Error del servidor. Intenta de nuevo más tarde.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        mensaje = 'No se pudo conectar al servidor. Verifica tu conexión.';
      } else {
        mensaje = err.message;
      }
      
      toast(mensaje, 'error');
      
      // Restaurar botón
      submitBtn.disabled = false;
      submitBtn.innerHTML = btnText;
    }
  });

  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombreCompleto = document.getElementById('regNombre').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    
    // Validación básica
    if (!nombreCompleto || !email || !password) {
      toast('Por favor completa todos los campos', 'warn');
      return;
    }
    
    if (password.length < 6) {
      toast('La contraseña debe tener al menos 6 caracteres', 'warn');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.innerHTML;
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando cuenta...';
      
      await apiFetch('/auth/register', {method:'POST', body:{nombreCompleto, email, password}});
      
      toast('Cuenta creada exitosamente. Iniciando sesión...', 'success');
      
      // Auto-login después de registro
      const data = await apiFetch('/auth/login', {method:'POST', body:{email, password}});
      
      if (!data.accessToken) {
        toast('Cuenta creada pero no se pudo iniciar sesión automáticamente', 'warn');
        setTimeout(() => location.href = 'login.html', 1500);
        return;
      }
      
      saveToken(data.accessToken);
      
      setTimeout(() => {
        location.href = 'index.html';
      }, 1000);
      
    } catch (err) {
      console.error('Error en registro:', err);
      
      let mensaje = 'No se pudo crear la cuenta';
      
      if (err.message.includes('ya registrado') || err.message.includes('already exists')) {
        mensaje = 'Este email ya está registrado';
      } else if (err.message.includes('HTTP 500')) {
        mensaje = 'Error del servidor. Intenta de nuevo más tarde.';
      } else if (err.message.includes('Failed to fetch')) {
        mensaje = 'No se pudo conectar al servidor. Verifica tu conexión.';
      } else {
        mensaje = err.message;
      }
      
      toast(mensaje, 'error');
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = btnText;
    }
  });

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      toast('Sesión cerrada', 'info');
      setTimeout(() => {
        location.href = 'index.html';
      }, 500);
    });
  }
});