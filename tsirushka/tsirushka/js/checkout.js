// /js/checkout.js
import { moneyCRC, toast } from './ui.js';
import { apiFetch, getToken } from './api.js';

const KEY = 'tsir.cart';
const STORE_SINPE = '+506 8630-4400';

// ========== FORMATEO DE TARJETA ==========

function formatCardNumber(value) {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  if (parts.length) {
    return parts.join(' ');
  } else {
    return value;
  }
}

function formatExpiry(value) {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  
  if (v.length >= 2) {
    return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
  }
  
  return v;
}

function detectCardType(number) {
  const patterns = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/
  };

  const cleaned = number.replace(/\s/g, '');
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(cleaned)) {
      return type;
    }
  }
  
  return 'unknown';
}

function updateCardBrandIcon(type) {
  const iconEl = document.getElementById('cardBrandIcon');
  if (!iconEl) return;

  const icons = {
    visa: '<svg width="40" height="26" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#1434CB"/><text x="50%" y="50%" fill="white" font-size="14" font-weight="bold" text-anchor="middle" dy=".3em">VISA</text></svg>',
    mastercard: '<svg width="40" height="26" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#EB001B"/><circle cx="20" cy="16" r="10" fill="#FF5F00"/><circle cx="28" cy="16" r="10" fill="#F79E1B"/></svg>',
    amex: '<svg width="40" height="26" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#006FCF"/><text x="50%" y="50%" fill="white" font-size="10" font-weight="bold" text-anchor="middle" dy=".3em">AMEX</text></svg>',
    unknown: '<i class="bi bi-credit-card fs-4"></i>'
  };

  iconEl.innerHTML = icons[type] || icons.unknown;
}

function validateCard(cardData) {
  const errors = [];

  // Validar número (debe tener 13-19 dígitos)
  const number = cardData.numero.replace(/\s/g, '');
  if (number.length < 13 || number.length > 19) {
    errors.push('Número de tarjeta inválido');
  }

  // Validar nombre
  if (!cardData.nombreTitular || cardData.nombreTitular.length < 3) {
    errors.push('Nombre del titular requerido');
  }

  // Validar expiración
  if (!/^\d{2}\/\d{2}$/.test(cardData.fechaExpiracion)) {
    errors.push('Fecha de expiración inválida (MM/AA)');
  } else {
    const [month, year] = cardData.fechaExpiracion.split('/');
    const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
    if (expiry < new Date()) {
      errors.push('La tarjeta está vencida');
    }
  }

  // Validar CVV
  if (cardData.cvv.length < 3 || cardData.cvv.length > 4) {
    errors.push('CVV inválido');
  }

  return errors;
}

// ========== CARRITO Y COTIZACIÓN ==========

function readCart(){
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

function renderSummary(cart, quote=null){
  const sumEl = document.getElementById('cartSummary');
  
  if (!cart.length){
    sumEl.innerHTML = '<div class="text-muted text-center py-3">No hay productos. <a href="index.html">Ir al catálogo</a>.</div>';
    document.getElementById('sumSubtotal').textContent = moneyCRC(0);
    document.getElementById('sumShipping').textContent = moneyCRC(0);
    document.getElementById('sumTotal').textContent = moneyCRC(0);
    return;
  }
  
  sumEl.innerHTML = cart.map(it => `
    <div class="d-flex justify-content-between mb-2">
      <small>${it.nombre} × ${it.cantidad}</small>
      <small class="text-end">${moneyCRC(it.precioCentimos * it.cantidad)}</small>
    </div>
  `).join('');

  if (quote){
    document.getElementById('sumSubtotal').textContent = moneyCRC(quote.subtotalCentimos);
    document.getElementById('sumShipping').textContent = moneyCRC(quote.envioCentimos);
    document.getElementById('sumTotal').textContent = moneyCRC(quote.totalCentimos);
  } else {
    const subtotal = cart.reduce((a, x) => a + x.precioCentimos * x.cantidad, 0);
    document.getElementById('sumSubtotal').textContent = moneyCRC(subtotal);
    document.getElementById('sumShipping').textContent = '—';
    document.getElementById('sumTotal').textContent = moneyCRC(subtotal);
  }
}

async function quote(){
  const cart = readCart();
  if (!cart.length) return null;

  const mode = document.querySelector('input[name="shippingMode"]:checked')?.value || 'ENVIO';
  const provincia = document.getElementById('province')?.value?.trim();
  
  const envio = (mode === 'ENVIO' && provincia) ? {
    provincia: provincia,
    canton: document.getElementById('canton')?.value?.trim() || '',
    distrito: document.getElementById('district')?.value?.trim() || '',
  } : null;

  try {
    const body = {
      items: cart.map(x => ({ id: x.id, cantidad: x.cantidad })),
      entrega: { modo: mode, direccion: envio }
    };

    const q = await apiFetch('/checkout/quote', { method:'POST', body, auth: true });
    return q;
  } catch (err) {
    console.warn('Error cotizando:', err);
    return null;
  }
}

// ========== PAGO ==========

function collectPayment(){
  const metodo = document.querySelector('input[name="payMethod"]:checked')?.value || 'SINPE';
  
  if (metodo === 'TARJETA'){
    const cardNumber = (document.getElementById('cardNumber')?.value || '').replace(/\s/g, '');
    const cardName = (document.getElementById('cardName')?.value || '').trim();
    const cardExpiry = (document.getElementById('cardExpiry')?.value || '').trim();
    const cardCvv = (document.getElementById('cardCvv')?.value || '').trim();
    
    // Validar antes de enviar
    const cardData = {
      numero: cardNumber,
      nombreTitular: cardName,
      fechaExpiracion: cardExpiry,
      cvv: cardCvv
    };
    
    const errors = validateCard(cardData);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    
    const cardType = detectCardType(cardNumber);
    const last4 = cardNumber.slice(-4);
    
    return {
      metodo: 'TARJETA',
      referencia: `${cardType.toUpperCase()}-****${last4}`,
      extra: {
        tipo: cardType,
        ultimosDigitos: last4,
        nombreTitular: cardName,
        expiracion: cardExpiry,
        notas: (document.getElementById('cardNotes')?.value || '').trim()
      }
    };
  } else {
    return {
      metodo: 'SINPE',
      referencia: (document.getElementById('sinpeRef')?.value || '').trim(),
      extra: {
        telefonoPagador: (document.getElementById('sinpePhone')?.value || '').trim(),
        notas: (document.getElementById('sinpeNotes')?.value || '').trim(),
        destino: STORE_SINPE
      }
    };
  }
}

// ========== CREAR PEDIDO ==========

async function placeOrder(){
  const cart = readCart();
  if (!cart.length) { 
    toast('Tu carrito está vacío', 'warn'); 
    return; 
  }

  const mode = document.querySelector('input[name="shippingMode"]:checked')?.value || 'ENVIO';
  const isEnvio = mode === 'ENVIO';
  
  // Validar campos requeridos de envío
  if (isEnvio) {
    const provincia = document.getElementById('province')?.value?.trim();
    const canton = document.getElementById('canton')?.value?.trim();
    const distrito = document.getElementById('district')?.value?.trim();
    const direccion = document.getElementById('address')?.value?.trim();
    
    if (!provincia || !canton || !distrito || !direccion) {
      toast('Por favor completá todos los campos de dirección', 'warn');
      return;
    }
  }

  let pago;
  try {
    pago = collectPayment();
  } catch (err) {
    toast(err.message, 'warn');
    return;
  }

  const payload = {
    cliente: {
      nombre: document.getElementById('fullName').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefono: document.getElementById('phone')?.value?.trim() || null,
    },
    entrega: {
      modo: mode,
      direccion: isEnvio ? {
        provincia: document.getElementById('province').value.trim(),
        canton: document.getElementById('canton').value.trim(),
        distrito: document.getElementById('district').value.trim(),
        direccionExacta: document.getElementById('address').value.trim(),
        notas: document.getElementById('notes')?.value?.trim() || null,
      } : null
    },
    items: cart.map(x => ({ id: x.id, cantidad: x.cantidad })),
    pago
  };

  try {
    // Deshabilitar botón
    const btn = document.getElementById('btnPlace');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

    const res = await apiFetch('/checkout/place-order', { 
      method: 'POST', 
      body: payload,
      auth: true 
    });

    // Limpiar carrito
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('cart:updated'));

    // Redirigir al success
    const params = new URLSearchParams({
      orderId: res.orderId,
      metodo: pago.metodo
    });
    if (pago.metodo === 'SINPE') params.set('sinpe', STORE_SINPE);
    if (pago.referencia) params.set('ref', pago.referencia);

    location.href = `order-success.html?${params.toString()}`;

  } catch (err) {
    console.error('Error creando pedido:', err);
    toast('No se pudo crear el pedido: ' + err.message, 'error');
    
    // Rehabilitar botón
    const btn = document.getElementById('btnPlace');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2-circle"></i> Confirmar pedido';
  }
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()){
    const redirect = encodeURIComponent('checkout.html');
    location.href = `login.html?redirect=${redirect}`;
    return;
  }

  // Set SINPE destino en UI
  document.getElementById('sinpeNumberLabel').textContent = STORE_SINPE;

  const cart = readCart();
  renderSummary(cart, null);

  const form = document.getElementById('formCheckout');
  const shippingFields = document.getElementById('shippingFields');
  const cardFields = document.getElementById('cardFields');
  const sinpeFields = document.getElementById('sinpeFields');

  // ========== FORMATEO DE TARJETA ==========
  
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      const formatted = formatCardNumber(e.target.value);
      e.target.value = formatted;
      
      const type = detectCardType(formatted);
      updateCardBrandIcon(type);
    });
  }

  const cardExpiryInput = document.getElementById('cardExpiry');
  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      e.target.value = formatExpiry(e.target.value);
    });
  }

  // Solo números en CVV
  const cardCvvInput = document.getElementById('cardCvv');
  if (cardCvvInput) {
    cardCvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  }

  // ========== TOGGLE MODES ==========

  // Toggle envío / retiro
  document.querySelectorAll('input[name="shippingMode"]').forEach(r => {
    r.addEventListener('change', () => {
      const isEnvio = r.value === 'ENVIO';
      shippingFields.style.display = isEnvio ? '' : 'none';
      
      // Hacer/deshacer campos required
      ['province', 'canton', 'district', 'address'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.required = isEnvio;
      });
      
      quote().then(q => { if (q) renderSummary(readCart(), q); }).catch(()=>{});
    });
  });

  // Toggle métodos de pago
  document.querySelectorAll('input[name="payMethod"]').forEach(r => {
    r.addEventListener('change', () => {
      const m = r.value;
      cardFields.style.display = (m === 'TARJETA') ? '' : 'none';
      sinpeFields.style.display = (m === 'SINPE') ? '' : 'none';
    });
  });

  // Re-cotizar cuando cambia provincia
  document.getElementById('province')?.addEventListener('change', () => {
    quote().then(q => { if (q) renderSummary(readCart(), q); }).catch(()=>{});
  });

  // Submit form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await placeOrder();
  });

  // Cotizar inicial
  try {
    const q = await quote();
    if (q) renderSummary(cart, q);
  } catch (err) {
    console.warn('Error en cotización inicial:', err);
  }
});