// /js/api.js
import { BASE_URL } from './config.js';

const TOKEN_KEY = 'tsir.jwt';

export function saveToken(token){ localStorage.setItem(TOKEN_KEY, token); }
export function getToken(){ return localStorage.getItem(TOKEN_KEY); }
export function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

export async function apiFetch(path, {method='GET', headers={}, body, auth=false} = {}) {
  const h = {'Content-Type':'application/json', ...headers};
  if (auth) {
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
  }
  
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit'
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { 
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const j = await res.json();
        msg = j.message || j.error || JSON.stringify(j);
      } else {
        // Si no es JSON, intentar leer como texto
        const text = await res.text();
        msg = text || msg;
      }
    } catch {}
    
    throw new Error(msg);
  }
  
  // 204 No Content:
  if (res.status === 204) return null;

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}