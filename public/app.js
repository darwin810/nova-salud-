const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount || 0);
const state = { user: null, products: [], cart: new Map(), page: 1, view: 'inicio', restock: false };
const loginScreen = $('#loginScreen'); const appShell = $('#appShell');

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la solicitud.'); error.status = response.status; error.code = data.code; throw error; }
  return data;
}
function notify(message, type = 'success') { const node = document.createElement('div'); node.className = 'toast' + (type === 'error' ? ' error' : ''); node.textContent = message; $('#toastRegion').append(node); setTimeout(() => node.remove(), 3700); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function statusLabel(product) { return product.stock === 0 ? ['out', 'Agotado'] : product.stock <= product.minStock ? ['low', 'Stock bajo'] : ['ok', 'Disponible']; }
function thumbColor(name) { const colors = ['mint', 'pink', 'gold', 'blue']; return colors[(name || '').charCodeAt(0) % colors.length]; }
function productIcon(name) { return ['✚', '◈', '✿', '◉'][(name || '').charCodeAt(0) % 4]; }
function productNameCell(p) { return `<span class="product-cell"><span class="product-thumb ${thumbColor(p.name)}">${productIcon(p.name)}</span>${esc(p.name)}</span>`; }

function showLogin() { loginScreen.hidden = false; appShell.hidden = true; }
function showApp() { loginScreen.hidden = true; appShell.hidden = false; $('#profileName').textContent = state.user.username; }
async function boot() {
  $('#todayDate').textContent = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  try { const { user } = await api('/auth/me'); state.user = user; showApp(); await refreshAll(); if (user.mustChangePassword) changePassword(); }
  catch { showLogin(); }
}
function validateLoginField(field) {
  const messageNode = field.name === 'username' ? $('#usernameError') : $('#passwordError');
  const value = field.value.trim();
  const message = field.name === 'username'
    ? (!value ? 'Escribe tu usuario.' : value.length < 3 ? 'Debe tener al menos 3 caracteres.' : value.length > 40 || !/^[a-zA-Z0-9._-]+$/.test(value) ? 'Usa letras, números, punto, guion o guion bajo.' : '')
    : (!field.value ? 'Escribe tu contraseña.' : new TextEncoder().encode(field.value).length > 72 ? 'La contraseña supera el límite permitido.' : '');
  field.setAttribute('aria-invalid', String(Boolean(message)));
  messageNode.textContent = message;
  return !message;
}
const loginFields = [...$('#loginForm').querySelectorAll('input')];
loginFields.forEach((field) => {
  field.addEventListener('blur', () => { field.dataset.touched = 'true'; validateLoginField(field); });
  field.addEventListener('input', () => {
    if (field.dataset.touched) validateLoginField(field);
    $('#loginError').textContent = '';
  });
});
$('#toggleLoginPassword').addEventListener('click', (event) => {
  const field = $('#loginPassword');
  const visible = field.type === 'password';
  field.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  field.focus();
});
$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#loginError').textContent = '';
  const valid = loginFields.map((field) => { field.dataset.touched = 'true'; return validateLoginField(field); }).every(Boolean);
  if (!valid) { loginFields.find((field) => field.getAttribute('aria-invalid') === 'true')?.focus(); return; }
  const form = new FormData(event.currentTarget);
  const submitButton = $('#loginSubmit'); submitButton.disabled = true; submitButton.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Verificando acceso…';
  try { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) }); state.user = result.user; showApp(); notify('Sesión iniciada. Bienvenido a Nova Salud.'); await refreshAll(); if (result.user.mustChangePassword) changePassword(); }
  catch (error) { $('#loginError').textContent = error.message; notify(error.message, 'error'); $('#loginPassword').focus(); }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Ingresar a Nova Salud <span>→</span>'; }
});
$('#logoutButton').addEventListener('click', async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally { state.cart.clear(); showLogin(); } });
function changePassword() {
  const dialog = document.createElement('dialog'); dialog.className = 'modal'; dialog.innerHTML = `<form><div class="modal-heading"><div><p class="eyebrow">PROTEGE TU CUENTA</p><h2>Crea una contraseña segura</h2><p>La clave inicial debe cambiarse antes de usar el sistema.</p></div></div><label class="stack-form">Nueva contraseña<input name="password" type="password" minlength="12" maxlength="72" required autocomplete="new-password" placeholder="Mínimo 12 caracteres"></label><p class="error-text" aria-live="polite"></p><div class="modal-actions"><button class="button primary">Actualizar y continuar →</button></div></form>`;
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('form').addEventListener('submit', async (e) => { e.preventDefault(); const password = new FormData(e.currentTarget).get('password'); try { await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ password }) }); state.user.mustChangePassword = false; dialog.close(); dialog.remove(); notify('Contraseña actualizada. Ya puedes trabajar.'); await refreshAll(); } catch (error) { dialog.querySelector('.error-text').textContent = error.message; } });
}

async function refreshAll() { await Promise.all([loadDashboard(), loadProducts()]); if (state.view === 'historial') await loadSales(); }
async function loadDashboard() {
  const data = await api('/dashboard');
  $('#statProducts').textContent = data.totalProducts;
  $('#statRevenue').textContent = money(data.today.totalCents / 100);
  $('#statSales').textContent = data.today.count;
  $('#statLow').textContent = data.lowStockCount;
  $('#navStockCount').textContent = data.lowStockCount || '';
  $('#alertRows').innerHTML = data.lowStock.map((p) => { const [cls, label] = statusLabel(p); return `<tr><td>${productNameCell(p)}</td><td>${esc(p.category)}</td><td><span class="stock-num">${p.stock} uds.</span></td><td><span class="status ${cls}">${label}</span></td></tr>`; }).join('');
  $('#alertEmpty').hidden = data.lowStock.length !== 0;
}
async function loadProducts() {
  const params = new URLSearchParams(); const q = $('#productSearch').value.trim(); if (q) params.set('q', q); if ($('#restockFilter').checked || state.restock) params.set('restock', 'true');
  const data = await api('/products' + (params.size ? '?' + params : '')); state.products = data.products;
  $('#productCount').textContent = `${data.products.length} ${data.products.length === 1 ? 'producto' : 'productos'}`;
  $('#productRows').innerHTML = data.products.map((p) => { const [cls, label] = statusLabel(p); return `<tr><td>${productNameCell(p)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td><span class="stock-num">${p.stock}</span><span class="minimum-stock"> / mín. ${p.minStock}</span></td><td><span class="status ${cls}">${label}</span></td><td><button class="row-action" data-edit="${p.id}" aria-label="Editar ${esc(p.name)}">Editar</button></td></tr>`; }).join('');
  $('#productsEmpty').hidden = data.products.length > 0; renderCatalog();
}
function renderCatalog() {
  const query = $('#saleSearch').value.trim().toLowerCase();
  const products = state.products.filter((p) => !query || `${p.name} ${p.category}`.toLowerCase().includes(query));
  $('#catalogList').innerHTML = products.map((p) => `<div class="catalog-item"><span class="product-thumb ${thumbColor(p.name)}">${productIcon(p.name)}</span><span class="catalog-info"><b>${esc(p.name)}</b><small>${esc(p.category)} · ${p.stock} disponibles</small></span><span class="catalog-price">${money(p.price)}</span><button class="add-product" data-add="${p.id}" aria-label="Agregar ${esc(p.name)}" ${p.stock === 0 ? 'disabled' : ''}>＋</button></div>`).join('');
  $('#catalogEmpty').hidden = products.length > 0;
}
function renderCart() {
  const items = [...state.cart.values()];
  $('#cartCount').textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
  $('#cartItems').innerHTML = items.map(({ product, quantity }) => `<div class="cart-row"><span class="cart-row-info"><b>${esc(product.name)}</b><small>${money(product.price)} c/u</small></span><span class="quantity"><button data-dec="${product.id}" aria-label="Quitar una unidad">−</button><b>${quantity}</b><button data-inc="${product.id}" aria-label="Agregar una unidad" ${quantity >= product.stock ? 'disabled' : ''}>＋</button></span><span class="cart-row-total">${money(product.price * quantity)}</span><button class="remove-item" data-remove="${product.id}" aria-label="Eliminar ${esc(product.name)}">×</button></div>`).join('');
  $('#cartEmpty').hidden = items.length > 0;
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  $('#cartTotal').textContent = money(total); $('#confirmSale').disabled = items.length === 0;
}

function go(view, restock = false) {
  state.view = view; state.restock = restock; document.querySelectorAll('.view').forEach((node) => node.classList.toggle('active', node.id === 'view-' + view));
  document.querySelectorAll('.nav-link').forEach((node) => node.classList.toggle('active', node.dataset.view === view));
  const titles = { inicio: 'Resumen', inventario: 'Inventario', ventas: 'Nueva venta', historial: 'Historial de ventas' };
  $('#crumbTitle').textContent = titles[view]; $('#sidebar').classList.remove('open');
  if (view === 'inventario') { $('#restockFilter').checked = restock; loadProducts(); }
  if (view === 'ventas') { loadProducts(); renderCart(); }
  if (view === 'historial') { state.page = 1; loadSales(); }
}
document.querySelectorAll('[data-view]').forEach((node) => node.addEventListener('click', () => go(node.dataset.view)));
document.querySelectorAll('[data-go]').forEach((node) => node.addEventListener('click', () => go(node.dataset.go, node.dataset.restock === 'true')));
$('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#productSearch').addEventListener('input', debounce(loadProducts, 180));
$('#restockFilter').addEventListener('change', loadProducts);
$('#saleSearch').addEventListener('input', renderCatalog);
function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }

const modal = $('#productModal');
$('#newProductButton').addEventListener('click', () => { $('#productModalTitle').textContent = 'Nuevo producto'; $('#productForm').reset(); $('#productError').textContent = ''; modal.showModal(); });
document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-close]'); if (close) $('#' + close.dataset.close).close();
  const edit = event.target.closest('[data-edit]'); if (edit) { const p = state.products.find((item) => item.id === edit.dataset.edit); if (!p) return; const form = $('#productForm'); $('#productModalTitle').textContent = 'Editar producto'; for (const key of ['name', 'category', 'price', 'stock', 'minStock']) form.elements[key].value = p[key]; form.elements.id.value = p.id; form.elements.version.value = p.version; $('#productError').textContent = ''; modal.showModal(); }
  const add = event.target.closest('[data-add]'); if (add) { const p = state.products.find((item) => item.id === add.dataset.add); if (!p) return; const item = state.cart.get(p.id); if (item) item.quantity = Math.min(p.stock, item.quantity + 1); else state.cart.set(p.id, { product: p, quantity: 1 }); renderCart(); }
  for (const [action, delta] of [['data-inc', 1], ['data-dec', -1]]) { const button = event.target.closest('[' + action + ']'); if (button) { const item = state.cart.get(button.getAttribute(action)); if (item) { item.quantity += delta; if (item.quantity < 1) state.cart.delete(button.getAttribute(action)); renderCart(); } } }
  const remove = event.target.closest('[data-remove]'); if (remove) { state.cart.delete(remove.dataset.remove); renderCart(); }
});

$('#productForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#productError').textContent = '';
  const form = new FormData(event.currentTarget); const data = { name: form.get('name'), category: form.get('category'), price: Number(form.get('price')), stock: Number(form.get('stock')), minStock: Number(form.get('minStock')) };
  const id = form.get('id'); const version = form.get('version');
  try { await api('/products' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', headers: id ? { 'If-Match': version } : {}, body: JSON.stringify(data) }); modal.close(); notify(id ? 'Producto actualizado.' : 'Producto agregado al inventario.'); await refreshAll(); }
  catch (error) { $('#productError').textContent = error.message; }
});

$('#confirmSale').addEventListener('click', async (event) => {
  const button = event.currentTarget; button.disabled = true; button.innerHTML = 'Registrando venta…';
  const idempotencyKey = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const data = await api('/sales', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ customerName: $('#customerName').value.trim(), items: [...state.cart.values()].map(({ product, quantity }) => ({ productId: product.id, quantity })) }) });
    state.cart.clear(); $('#customerName').value = ''; renderCart(); notify(`Venta confirmada · ${money(data.sale.total)}`); await refreshAll();
  } catch (error) { notify(error.message, 'error'); await loadProducts(); renderCart(); }
  finally { button.innerHTML = 'Confirmar venta <span>→</span>'; button.disabled = state.cart.size === 0; }
});

async function loadSales() {
  try {
    const data = await api(`/sales?page=${state.page}&limit=10`);
    $('#salesRows').innerHTML = data.sales.map((sale) => `<tr><td>${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sale.createdAt))}</td><td>${sale.customerName ? esc(sale.customerName) : '<span class="customer-anon">Cliente general</span>'}</td><td>${sale.items.map((item) => `${esc(item.name)} × ${item.quantity}`).join(', ')}</td><td><b class="sales-total">${money(sale.total)}</b></td></tr>`).join('');
    $('#salesEmpty').hidden = data.sales.length > 0; $('#pageInfo').textContent = `Página ${data.page} de ${Math.max(data.pages, 1)}`; $('#historySummary').textContent = `${data.total} ${data.total === 1 ? 'venta registrada' : 'ventas registradas'}`;
    $('#prevPage').disabled = data.page <= 1; $('#nextPage').disabled = data.page >= data.pages;
  } catch (error) { notify(error.message, 'error'); }
}
$('#prevPage').addEventListener('click', () => { if (state.page > 1) { state.page--; loadSales(); } });
$('#nextPage').addEventListener('click', () => { state.page++; loadSales(); });
boot();
