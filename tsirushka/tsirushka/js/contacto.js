import { apiFetch, getToken } from './api.js';
import { toggleAuthButtons, toast } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  toggleAuthButtons(!!getToken());

  const form = document.getElementById('formContacto');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      solicitanteNombre: document.getElementById('nombre').value.trim(),
      solicitanteEmail:  document.getElementById('email').value.trim(),
      solicitanteTelefono: document.getElementById('telefono').value.trim(),
      asunto: document.getElementById('asunto').value.trim(),
      mensaje: document.getElementById('mensaje').value.trim(),
      adjuntoUrl: null
    };
    try {
      await apiFetch('/contacto/solicitudes', { method: 'POST', body });
      toast('¡Gracias! Recibimos tu mensaje.', 'success');
      form.reset();
    } catch (err) {
      toast('No pudimos enviar la solicitud: ' + err.message, 'error');
    }
  });
});
