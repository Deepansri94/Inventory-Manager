// ── Storage helpers ──────────────────────────────────────────────
const load = key => JSON.parse(localStorage.getItem(key) || '[]');
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

let products = load('inv_products');
let purchases = load('inv_purchases');
let transactions = load('inv_transactions');
let customers = load('inv_customers');
let ledgerEntries = load('inv_ledger');
let settings = JSON.parse(localStorage.getItem('inv_settings') || JSON.stringify({
  name: '', phone: '', addr1: '', addr2: '', city: '', state: '', upi: '', gst: '', footer: 'Thank you for your business!'
}));

const LOW_STOCK_THRESHOLD = 5;

// ── Navigation ───────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(item.dataset.page).classList.add('active');
    if (item.dataset.page === 'dashboard') renderDashboard();
    if (item.dataset.page === 'inventory') renderProducts();
    if (item.dataset.page === 'purchases') renderPurchases();
    if (item.dataset.page === 'transactions') renderTransactions(1);
    if (item.dataset.page === 'customers') renderCustomers();
    if (item.dataset.page === 'settings') loadSettingsForm();
  });
});

// ── Toast ────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => t.className = 'toast hidden', 3000);
}

// ── Modal ────────────────────────────────────────────────────────
function openModal(id) {
  if (id === 'product-modal') {
    document.getElementById('product-modal-title').textContent = 'Add Product';
    document.getElementById('edit-product-id').value = '';
    ['p-name','p-price','p-unit','p-stock'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('p-category').value = 'Groceries';
  }
  if (id === 'customer-modal') {
    document.getElementById('customer-modal-title').textContent = 'Add Customer';
    document.getElementById('edit-customer-id').value = '';
    ['c-name','c-phone','c-email','c-address'].forEach(f => document.getElementById(f).value = '');
  }
  if (id === 'txn-modal') {
    document.getElementById('txn-items-list').innerHTML = '';
    document.getElementById('txn-total-val').textContent = '0.00';
    setTxnPaidStatus('paid');
    refreshCustomerDropdowns();
    addTxnItem();
  }
  if (id === 'purchase-modal') {
    document.getElementById('pur-supplier').value = '';
    document.getElementById('pur-items-list').innerHTML = '';
    document.getElementById('pur-total-val').textContent = '0.00';
    purIdx = 0;
    addPurchaseItem();
  }
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// close modals on overlay click
['product-modal','purchase-modal','txn-modal','customer-modal','ledger-modal','restock-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeModal(id);
  });
});

// ── Dashboard ────────────────────────────────────────────────────
function renderDashboard() {
  const today = new Date().toDateString();
  const todayTxns = transactions.filter(t => new Date(t.date).toDateString() === today);
  const totalUnpaid = ledgerEntries.filter(l => l.paidStatus === 'unpaid').reduce((s, l) => s + l.total, 0);
  const lowStockItems = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD);

  document.getElementById('stat-products').textContent = products.length;
  document.getElementById('stat-today').textContent = '₹' + todayTxns.reduce((s, t) => s + t.total, 0).toFixed(2);
  document.getElementById('stat-revenue').textContent = '₹' + transactions.reduce((s, t) => s + t.total, 0).toFixed(2);
  document.getElementById('stat-unpaid').textContent = '₹' + totalUnpaid.toFixed(2);
  document.getElementById('stat-lowstock').textContent = lowStockItems.length;

  // low stock table
  const lsBody = document.getElementById('lowstock-body');
  lsBody.innerHTML = lowStockItems.map(p => `
    <tr class="low-stock-row">
      <td>${p.name}</td>
      <td><span class="cat-badge">${p.category}</span></td>
      <td><span class="badge-lowstock">⚠️ ${p.stock} ${p.unit || ''}</span></td>
      <td><button class="btn-restock" onclick="openRestockModal('${p.id}')">+ Restock</button></td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No low stock items</td></tr>';

  // recent sales
  const tbody = document.getElementById('recent-txns-body');
  const recent = [...transactions].reverse().slice(0, 8);
  tbody.innerHTML = recent.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString('en-IN')}</td>
      <td>${t.customerName || 'Walk-in'}</td>
      <td>${t.items.map(i => i.name).join(', ')}</td>
      <td>₹${t.total.toFixed(2)}</td>
      <td><span class="badge-${t.paidStatus === 'unpaid' ? 'unpaid' : 'paid'}">${t.paidStatus === 'unpaid' ? '❌ Unpaid' : '✅ Paid'}</span></td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No sales yet</td></tr>';
}

// ── Inventory / Products ─────────────────────────────────────────
function renderProducts() {
  const tbody = document.getElementById('products-body');
  tbody.innerHTML = products.map(p => `
    <tr class="${p.stock <= LOW_STOCK_THRESHOLD ? 'low-stock-row' : ''}">
      <td>${p.name}</td>
      <td><span class="cat-badge">${p.category}</span></td>
      <td>₹${parseFloat(p.price).toFixed(2)}</td>
      <td>${p.stock <= LOW_STOCK_THRESHOLD
        ? `<span class="badge-lowstock">⚠️ ${p.stock}</span>`
        : p.stock}
      </td>
      <td>${p.unit || '-'}</td>
      <td>
        <button class="btn-restock" onclick="openRestockModal('${p.id}')">+ Stock</button>
        <button class="btn-edit" onclick="editProduct('${p.id}')">✏️ Edit</button>
        <button class="btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No products added yet</td></tr>';
}

function saveProduct() {
  const id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('p-name').value.trim();
  const price = document.getElementById('p-price').value;
  const stock = document.getElementById('p-stock').value;
  if (!name) return toast('Product name is required', 'error');
  if (!price || isNaN(price)) return toast('Enter a valid price', 'error');
  if (stock === '' || isNaN(stock)) return toast('Enter current stock', 'error');

  const product = {
    id: id || Date.now().toString(),
    name,
    category: document.getElementById('p-category').value,
    price: parseFloat(price),
    unit: document.getElementById('p-unit').value.trim(),
    stock: parseInt(stock, 10)
  };
  if (id) {
    products = products.map(p => p.id === id ? product : p);
  } else {
    products.push(product);
  }
  save('inv_products', products);
  closeModal('product-modal');
  renderProducts();
  refreshItemDropdowns();
  toast(id ? 'Product updated.' : 'Product added.');
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('edit-product-id').value = p.id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-category').value = p.category;
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-unit').value = p.unit || '';
  document.getElementById('p-stock').value = p.stock;
  document.getElementById('product-modal').classList.remove('hidden');
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  products = products.filter(p => p.id !== id);
  save('inv_products', products);
  renderProducts();
  toast('Product deleted.');
}

function openRestockModal(id) {
  const p = products.find(x => x.id === id);
  document.getElementById('restock-modal-title').textContent = `Restock: ${p.name}`;
  document.getElementById('restock-product-id').value = p.id;
  document.getElementById('restock-current').value = p.stock;
  document.getElementById('restock-qty').value = '';
  document.getElementById('restock-modal').classList.remove('hidden');
}

function saveRestock() {
  const id = document.getElementById('restock-product-id').value;
  const qty = parseInt(document.getElementById('restock-qty').value, 10);
  if (!qty || qty < 1) return toast('Enter a valid quantity', 'error');
  products = products.map(p => p.id === id ? { ...p, stock: p.stock + qty } : p);
  save('inv_products', products);
  closeModal('restock-modal');
  renderProducts();
  renderDashboard();
  toast(`Stock updated.`);
}

// ── Purchases ────────────────────────────────────────────────────
function renderPurchases() {
  const tbody = document.getElementById('purchases-body');
  tbody.innerHTML = [...purchases].reverse().map(p => `
    <tr>
      <td>${new Date(p.date).toLocaleDateString('en-IN')}</td>
      <td>${p.supplierName || '-'}</td>
      <td>${p.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
      <td>₹${p.totalCost.toFixed(2)}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No purchases recorded yet</td></tr>';
}

function savePurchase() {
  const items = getPurchaseItems();
  if (!items.length) return toast('Add at least one item', 'error');
  const totalCost = items.reduce((s, i) => s + i.totalCost, 0);

  const purchase = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    supplierName: document.getElementById('pur-supplier').value.trim(),
    items,
    totalCost
  };
  purchases.push(purchase);
  save('inv_purchases', purchases);

  // increase stock for each purchased product
  items.forEach(item => {
    products = products.map(p => p.id === item.productId ? { ...p, stock: p.stock + item.qty } : p);
  });
  save('inv_products', products);

  closeModal('purchase-modal');
  renderPurchases();
  renderProducts();
  renderDashboard();
  toast('Purchase recorded. Stock updated.');
}

// ── Item rows (shared) ───────────────────────────────────────────
function getProductOptions() {
  if (!products.length) return '<option value="">-- Add products first --</option>';
  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });
  return Object.entries(grouped).map(([cat, items]) =>
    `<optgroup label="${cat}">${items.map(p =>
      `<option value="${p.id}" data-price="${p.price}">${p.name} (₹${p.price})</option>`
    ).join('')}</optgroup>`
  ).join('');
}

function refreshItemDropdowns() {
  const newOpts = `<option value="">-- Select Product --</option>${getProductOptions()}`;
  document.querySelectorAll('.bill-item-row select').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = newOpts;
    sel.value = cur;
  });
}

function onProductSelect(selectEl, prefix) {
  const price = selectEl.options[selectEl.selectedIndex]?.dataset?.price || 0;
  const row = selectEl.closest('.bill-item-row');
  row.querySelectorAll('input')[1].value = price;
  calcTotal(prefix);
}

function calcTotal(prefix) {
  const container = document.getElementById(`${prefix}-items-list`);
  let total = 0;
  container.querySelectorAll('.bill-item-row').forEach(row => {
    const qty = parseFloat(row.querySelectorAll('input')[0].value) || 0;
    const rate = parseFloat(row.querySelectorAll('input')[1].value) || 0;
    total += qty * rate;
  });
  document.getElementById(`${prefix}-total-val`).textContent = total.toFixed(2);
}

function getItems(prefix) {
  const container = document.getElementById(`${prefix}-items-list`);
  const items = [];
  container.querySelectorAll('.bill-item-row').forEach(row => {
    const sel = row.querySelector('select');
    const name = sel.options[sel.selectedIndex]?.text?.replace(/\s*\(₹.*\)$/, '').trim() || '';
    const qty = parseFloat(row.querySelectorAll('input')[0].value) || 0;
    const rate = parseFloat(row.querySelectorAll('input')[1].value) || 0;
    if (qty > 0 && rate > 0 && sel.value) items.push({ productId: sel.value, name, qty, rate, amount: qty * rate });
  });
  return items;
}

let txnIdx = 0;
function addTxnItem() {
  const html = `<div class="bill-item-row" id="txn-row-${txnIdx}">
    <select onchange="onProductSelect(this,'txn')">
      <option value="">-- Select Product --</option>${getProductOptions()}
    </select>
    <input type="number" min="1" value="1" placeholder="Qty" onchange="calcTotal('txn')" />
    <input type="number" min="0" step="0.5" value="0" placeholder="Rate ₹" onchange="calcTotal('txn')" />
    <button class="btn-danger" onclick="this.closest('.bill-item-row').remove();calcTotal('txn')">✕</button>
  </div>`;
  document.getElementById('txn-items-list').insertAdjacentHTML('beforeend', html);
  txnIdx++;
}

let purIdx = 0;
function getPurchaseItems() {
  const container = document.getElementById('pur-items-list');
  const items = [];
  container.querySelectorAll('.bill-item-row').forEach(row => {
    const sel = row.querySelector('select');
    const name = sel.options[sel.selectedIndex]?.text?.replace(/\s*\(₹.*\)$/, '').trim() || '';
    const qty = parseInt(row.querySelectorAll('input')[0].value, 10) || 0;
    const cost = parseFloat(row.querySelectorAll('input')[1].value) || 0;
    if (qty > 0 && sel.value) items.push({ productId: sel.value, name, qty, costPerUnit: cost, totalCost: qty * cost });
  });
  return items;
}

function calcPurTotal() {
  const items = getPurchaseItems();
  document.getElementById('pur-total-val').textContent = items.reduce((s, i) => s + i.totalCost, 0).toFixed(2);
}

function addPurchaseItem() {
  const html = `<div class="bill-item-row" id="pur-row-${purIdx}">
    <select onchange="calcPurTotal()">
      <option value="">-- Select Product --</option>${getProductOptions()}
    </select>
    <input type="number" min="1" value="1" placeholder="Qty" onchange="calcPurTotal()" />
    <input type="number" min="0" step="0.5" value="0" placeholder="Cost/unit ₹" onchange="calcPurTotal()" />
    <button class="btn-danger" onclick="this.closest('.bill-item-row').remove();calcPurTotal()">✕</button>
  </div>`;
  document.getElementById('pur-items-list').insertAdjacentHTML('beforeend', html);
  purIdx++;
}

// ── Transactions / Sales ─────────────────────────────────────────
let txnFilter = 'all';
let txnFromDate = null, txnToDate = null;

function getFilteredTransactions() {
  const now = new Date();
  return transactions.filter(t => {
    const d = new Date(t.date);
    if (txnFilter === 'this_month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (txnFilter === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    }
    if (txnFilter === 'custom' && txnFromDate && txnToDate) {
      const from = new Date(txnFromDate); from.setHours(0,0,0,0);
      const to = new Date(txnToDate); to.setHours(23,59,59,999);
      return d >= from && d <= to;
    }
    return true;
  });
}

function setTxnFilter(filter, btn) {
  txnFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('txn-date-range').classList.toggle('hidden', filter !== 'custom');
  if (filter !== 'custom') renderTransactions(1);
}

function applyCustomFilter() {
  txnFromDate = document.getElementById('txn-from-date').value;
  txnToDate = document.getElementById('txn-to-date').value;
  if (!txnFromDate || !txnToDate) return toast('Select both From and To dates', 'error');
  renderTransactions(1);
}

const TXN_PAGE_SIZE = 15;
let txnCurrentPage = 1;

function renderTransactions(page) {
  if (page !== undefined) txnCurrentPage = page;
  const filtered = getFilteredTransactions();
  const total = filtered.reduce((s, t) => s + t.total, 0);
  const paid = filtered.filter(t => t.paidStatus !== 'unpaid').reduce((s, t) => s + t.total, 0);
  const unpaid = filtered.filter(t => t.paidStatus === 'unpaid').reduce((s, t) => s + t.total, 0);

  document.getElementById('txn-summary').innerHTML = filtered.length ? `
    <div class="txn-summary-item">&#128202; <strong>${filtered.length}</strong> Sales</div>
    <div class="txn-summary-item">Total: <strong>&#8377;${total.toFixed(2)}</strong></div>
    <div class="txn-summary-item">&#9989; Paid: <strong>&#8377;${paid.toFixed(2)}</strong></div>
    <div class="txn-summary-item">&#10060; Unpaid: <strong>&#8377;${unpaid.toFixed(2)}</strong></div>` : '';

  const sorted = [...filtered].reverse();
  const totalPages = Math.max(1, Math.ceil(sorted.length / TXN_PAGE_SIZE));
  if (txnCurrentPage > totalPages) txnCurrentPage = totalPages;
  const pageData = sorted.slice((txnCurrentPage - 1) * TXN_PAGE_SIZE, txnCurrentPage * TXN_PAGE_SIZE);

  const tbody = document.getElementById('txns-body');
  tbody.innerHTML = pageData.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString('en-IN')}</td>
      <td>${t.customerName || 'Walk-in'}</td>
      <td>${t.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
      <td>&#8377;${t.total.toFixed(2)}</td>
      <td><span class="badge-${t.paidStatus === 'unpaid' ? 'unpaid' : 'paid'}">${t.paidStatus === 'unpaid' ? '&#10060; Unpaid' : '&#9989; Paid'}</span></td>
      <td><button class="btn-danger" onclick="deleteTxn('${t.id}')">&#128465;</button></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No sales found</td></tr>';

  const pg = document.getElementById('txn-pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="renderTransactions(${txnCurrentPage - 1})" ${txnCurrentPage === 1 ? 'disabled' : ''}>&laquo; Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= txnCurrentPage - 2 && i <= txnCurrentPage + 2)) {
      html += `<button class="page-btn ${i === txnCurrentPage ? 'active' : ''}" onclick="renderTransactions(${i})">${i}</button>`;
    } else if (i === txnCurrentPage - 3 || i === txnCurrentPage + 3) {
      html += `<span class="page-info">...</span>`;
    }
  }
  html += `<button class="page-btn" onclick="renderTransactions(${txnCurrentPage + 1})" ${txnCurrentPage === totalPages ? 'disabled' : ''}>Next &raquo;</button>`;
  html += `<span class="page-info">Page ${txnCurrentPage} of ${totalPages}</span>`;
  pg.innerHTML = html;
}

function setTxnPaidStatus(status) {
  document.getElementById('txn-paid-status').value = status;
  document.getElementById('txn-paid-btn').classList.toggle('active', status === 'paid');
  document.getElementById('txn-unpaid-btn').classList.toggle('active', status === 'unpaid');
}

function saveTransaction() {
  const items = getItems('txn');
  if (!items.length) return toast('Add at least one item', 'error');
  const custId = document.getElementById('txn-customer').value;
  const cust = customers.find(c => c.id === custId);
  const paidStatus = document.getElementById('txn-paid-status').value;
  const total = items.reduce((s, i) => s + i.amount, 0);

  const txn = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    customerId: custId,
    customerName: cust ? cust.name : 'Walk-in',
    items, total, paidStatus
  };
  transactions.push(txn);
  save('inv_transactions', transactions);

  // reduce stock for each sold product
  items.forEach(item => {
    products = products.map(p => p.id === item.productId ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p);
  });
  save('inv_products', products);

  // if unpaid and customer selected → add to ledger
  if (paidStatus === 'unpaid' && custId) {
    const entry = { id: 'L' + Date.now().toString(), customerId: custId, customerName: cust.name, date: txn.date, items, total, paidStatus: 'unpaid', txnId: txn.id };
    ledgerEntries.push(entry);
    save('inv_ledger', ledgerEntries);
  }

  closeModal('txn-modal');
  renderTransactions();
  renderCustomers();
  renderDashboard();
  toast(paidStatus === 'unpaid' ? '⚠️ Sale saved as Unpaid.' : 'Sale saved.', paidStatus === 'unpaid' ? 'error' : 'success');
}

function deleteTxn(id) {
  if (!confirm('Delete this sale?')) return;
  transactions = transactions.filter(t => t.id !== id);
  save('inv_transactions', transactions);
  ledgerEntries = ledgerEntries.filter(l => l.txnId !== id);
  save('inv_ledger', ledgerEntries);
  renderTransactions();
  renderCustomers();
  renderDashboard();
  toast('Sale deleted.');
}

function downloadTransactions() {
  const filtered = getFilteredTransactions();
  if (!filtered.length) return toast('No sales to download', 'error');
  const rows = [
    ['Date','Customer','Items','Amount','Status'],
    ...filtered.map(t => [
      new Date(t.date).toLocaleDateString('en-IN'),
      t.customerName || 'Walk-in',
      t.items.map(i => `${i.name} x${i.qty}`).join(' | '),
      t.total.toFixed(2),
      t.paidStatus === 'unpaid' ? 'Unpaid' : 'Paid'
    ])
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Sales.csv'; a.click();
  URL.revokeObjectURL(url);
  toast(`Downloaded ${filtered.length} sales.`);
}

// ── Customers ────────────────────────────────────────────────────
function getCustomerUnpaid(customerId) {
  return ledgerEntries.filter(l => l.customerId === customerId && l.paidStatus === 'unpaid')
    .reduce((s, l) => s + l.total, 0);
}

function renderCustomers() {
  const tbody = document.getElementById('customers-body');
  tbody.innerHTML = customers.map(c => {
    const unpaid = getCustomerUnpaid(c.id);
    return `<tr>
      <td>${c.name}</td>
      <td>${c.phone}</td>
      <td>${unpaid > 0
        ? `<span class="badge-unpaid">❌ ₹${unpaid.toFixed(2)}</span>`
        : `<span class="badge-paid">✅ Clear</span>`}
      </td>
      <td>
        <button class="btn-ledger" onclick="openLedger('${c.id}')">📒 Ledger</button>
        <button class="btn-edit" onclick="editCustomer('${c.id}')">✏️ Edit</button>
        <button class="btn-danger" onclick="deleteCustomer('${c.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No customers added</td></tr>';
  refreshCustomerDropdowns();
}

function saveCustomer() {
  const id = document.getElementById('edit-customer-id').value;
  const name = document.getElementById('c-name').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  if (!name || !phone) return toast('Name and Phone are required', 'error');
  if (!/^\d{10}$/.test(phone)) return toast('Enter a valid 10-digit phone number', 'error');

  const customer = { id: id || Date.now().toString(), name, phone, email: document.getElementById('c-email').value.trim(), address: document.getElementById('c-address').value.trim() };
  if (id) {
    customers = customers.map(c => c.id === id ? customer : c);
  } else {
    customers.push(customer);
  }
  save('inv_customers', customers);
  closeModal('customer-modal');
  renderCustomers();
  toast(id ? 'Customer updated.' : 'Customer added.');
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  document.getElementById('customer-modal-title').textContent = 'Edit Customer';
  document.getElementById('edit-customer-id').value = c.id;
  document.getElementById('c-name').value = c.name;
  document.getElementById('c-phone').value = c.phone;
  document.getElementById('c-email').value = c.email || '';
  document.getElementById('c-address').value = c.address || '';
  document.getElementById('customer-modal').classList.remove('hidden');
}

function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  customers = customers.filter(c => c.id !== id);
  save('inv_customers', customers);
  renderCustomers();
  toast('Customer deleted.');
}

function refreshCustomerDropdowns() {
  const opts = `<option value="">-- Walk-in / Select --</option>` +
    customers.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('');
  document.getElementById('txn-customer').innerHTML = opts;
}

// ── Ledger ───────────────────────────────────────────────────────
function openLedger(customerId) {
  const c = customers.find(x => x.id === customerId);
  document.getElementById('ledger-modal-title').textContent = `📒 ${c.name} — Unpaid Ledger`;
  renderLedgerEntries(customerId);
  document.getElementById('ledger-modal').classList.remove('hidden');
}

function renderLedgerEntries(customerId) {
  const entries = ledgerEntries.filter(l => l.customerId === customerId);
  const container = document.getElementById('ledger-entries');
  const totalUnpaid = entries.filter(l => l.paidStatus === 'unpaid').reduce((s, l) => s + l.total, 0);

  if (!entries.length) {
    container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No entries yet</p>';
    document.getElementById('ledger-total').textContent = '₹0.00';
    return;
  }

  container.innerHTML = [...entries].reverse().map(l => `
    <div class="kata-entry ${l.paidStatus === 'paid' ? 'paid-entry' : ''}">
      <div class="kata-entry-info">
        <div class="kata-date">${new Date(l.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
          ${l.paidStatus === 'paid' ? `<span style="color:#16a34a;margin-left:6px">✅ Paid on ${new Date(l.paidOn).toLocaleDateString('en-IN')}</span>` : ''}
        </div>
        <div class="kata-items">${l.items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>
      </div>
      <div class="kata-entry-amt ${l.paidStatus === 'paid' ? 'paid-amt' : ''}">₹${l.total.toFixed(2)}</div>
      ${l.paidStatus === 'unpaid'
        ? `<button class="btn-pay" onclick="markLedgerPaid('${l.id}','${customerId}')">✅ Mark Paid</button>`
        : `<span style="font-size:.78rem;color:#16a34a;font-weight:600">PAID</span>`}
    </div>`).join('');

  document.getElementById('ledger-total').textContent = '₹' + totalUnpaid.toFixed(2);
}

function markLedgerPaid(ledgerId, customerId) {
  const entry = ledgerEntries.find(l => l.id === ledgerId);
  ledgerEntries = ledgerEntries.map(l => l.id === ledgerId ? { ...l, paidStatus: 'paid', paidOn: new Date().toISOString() } : l);
  save('inv_ledger', ledgerEntries);

  if (entry) {
    transactions = transactions.map(t => (entry.txnId && t.id === entry.txnId) ? { ...t, paidStatus: 'paid' } : t);
    save('inv_transactions', transactions);
  }

  renderLedgerEntries(customerId);
  renderCustomers();
  renderTransactions();
  renderDashboard();
  toast('Marked as Paid. ✅');
}

// ── Settings ─────────────────────────────────────────────────────
function loadSettingsForm() {
  document.getElementById('s-name').value = settings.name || '';
  document.getElementById('s-phone').value = settings.phone || '';
  document.getElementById('s-addr1').value = settings.addr1 || '';
  document.getElementById('s-addr2').value = settings.addr2 || '';
  document.getElementById('s-city').value = settings.city || '';
  document.getElementById('s-state').value = settings.state || '';
  document.getElementById('s-upi').value = settings.upi || '';
  document.getElementById('s-gst').value = settings.gst || '';
}

function saveSettings() {
  settings = {
    name: document.getElementById('s-name').value.trim(),
    phone: document.getElementById('s-phone').value.trim(),
    addr1: document.getElementById('s-addr1').value.trim(),
    addr2: document.getElementById('s-addr2').value.trim(),
    city: document.getElementById('s-city').value.trim(),
    state: document.getElementById('s-state').value.trim(),
    upi: document.getElementById('s-upi').value.trim(),
    gst: document.getElementById('s-gst').value.trim()
  };
  localStorage.setItem('inv_settings', JSON.stringify(settings));
  document.querySelector('.shop-name-main').textContent = (settings.name ? '📦 ' + settings.name : '📦 Inventory');
  const msg = document.getElementById('settings-saved');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 3000);
}

// ── Auto-update ──────────────────────────────────────────────────
function checkForAppUpdate() {
  const btn = document.getElementById('check-update-btn');
  const statusEl = document.getElementById('update-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Checking...'; }
  if (statusEl) statusEl.innerHTML = '';
  if (window.electronAPI) {
    window.electronAPI.checkUpdate();
    setTimeout(() => { if (btn && btn.disabled) { btn.disabled = false; btn.textContent = '🔄 Check for Update'; } }, 12000);
  } else {
    if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.innerHTML = '❌ Update check only works in the desktop app.'; }
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Check for Update'; }
  }
}

if (window.electronAPI) {
  window.electronAPI.onUpdateResult(({ status, version }) => {
    const btn = document.getElementById('check-update-btn');
    const statusEl = document.getElementById('update-status');
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Check for Update'; }
    if (!statusEl) return;
    const messages = {
      available: { color: '#2563eb', html: `🆕 <strong>${version}</strong> is available. Preparing download...` },
      downloading: { color: '#d97706', html: '⏳ Downloading update...' },
      done: { color: '#16a34a', html: '✅ Download complete. Run the installer to update.' },
      'up-to-date': { color: '#16a34a', html: '✅ You are on the latest version.' },
      cancelled: { color: '#64748b', html: 'Update skipped.' },
      error: { color: '#dc2626', html: '❌ Could not check for updates.' }
    };
    const m = messages[status] || messages.error;
    statusEl.style.color = m.color;
    statusEl.innerHTML = m.html;
  });
}

// ── Init ─────────────────────────────────────────────────────────
renderDashboard();
renderCustomers();
renderTransactions(1);
if (settings.name) document.querySelector('.shop-name-main').textContent = '📦 ' + settings.name;
