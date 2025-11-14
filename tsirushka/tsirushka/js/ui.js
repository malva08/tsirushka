  export function moneyCRC(centimos){
    const colones = (centimos ?? 0) / 100;
    return colones.toLocaleString('es-CR', {style:'currency', currency:'CRC', maximumFractionDigits:0});
  }
  export function getQueryParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }
  export function toggleAuthButtons(isLogged){
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    if (!btnLogin || !btnLogout) return;
    btnLogin.classList.toggle('d-none', isLogged);
    btnLogout.classList.toggle('d-none', !isLogged);
  }

  // Toasts Bootstrap (simple)
  export function toast(msg, type='info'){
    let holder = document.getElementById('toast-holder');
    if(!holder){
      holder = document.createElement('div');
      holder.id = 'toast-holder';
      holder.className = 'toast-container position-fixed top-0 end-0 p-3';
      document.body.appendChild(holder);
    }
    const color = ({
      info:'primary', success:'success', error:'danger', warn:'warning'
    })[type] || 'primary';

    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${color} border-0`;
    el.role = 'alert'; el.ariaLive='assertive'; el.ariaAtomic='true';
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${msg}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
    holder.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 2500 });
    t.show();
    el.addEventListener('hidden.bs.toast', ()=> el.remove());
  }
