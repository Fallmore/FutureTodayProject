'use strict';

/**
 * Обёртка над fetch для API админки.
 * Все ошибки сервера сводятся к { ok:false, error:'текст' } —
 * страницы показывают их пользователю без alert-спама.
 */
async function apiRequest(url, options = {}) {
  const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (networkError) {
    return { ok: false, error: 'Сервер недоступен. Обновите страницу.' };
  }

  let body = null;
  try {
    body = await res.json();
  } catch (parseError) {
    body = null;
  }

  if (!res.ok) {
    return { ok: false, error: (body && body.error) || 'Ошибка запроса (' + res.status + ')' };
  }
  return { ok: true, data: body };
}

const AdminAPI = {
  listForms: () => apiRequest('/api/admin/forms'),
  createForm: (title) => apiRequest('/api/admin/forms', { method: 'POST', body: JSON.stringify({ title }) }),
  getForm: (id) => apiRequest('/api/admin/forms/' + encodeURIComponent(id)),
  saveForm: (id, payload) =>
    apiRequest('/api/admin/forms/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) }),
  deleteForm: (id) =>
    apiRequest('/api/admin/forms/' + encodeURIComponent(id), { method: 'DELETE' }),
  publishForm: (id) =>
    apiRequest('/api/admin/forms/' + encodeURIComponent(id) + '/publish', { method: 'POST' }),
  unpublishForm: (id) =>
    apiRequest('/api/admin/forms/' + encodeURIComponent(id) + '/unpublish', { method: 'POST' }),
  getSubmissions: (id) => apiRequest('/api/admin/forms/' + encodeURIComponent(id) + '/submissions'),
  exportUrl: (id) => '/api/admin/forms/' + encodeURIComponent(id) + '/export.csv',
  publicUrl: (slug) => '/f/' + encodeURIComponent(slug)
};

/** Безопасное текстовое поле: всё, что пришло с сервера, вставляется как текст */
function setText(node, value) {
  node.textContent = value == null ? '' : String(value);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Запасной путь для браузеров без Clipboard API или http:// без разрешения
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    document.body.removeChild(area);
    return copied;
  }
}
