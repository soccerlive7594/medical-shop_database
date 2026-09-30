const API_BASE = 'http://localhost:5000/api';
const state = {
  dashboard: null,
  medicines: [],
  suppliers: [],
  restocks: [],
  activeSection: 'dashboard'
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const elements = {};

function cacheElements() {
  elements.summaryCards = document.getElementById('summary-cards');
  elements.stockCards = document.getElementById('stock-cards');
  elements.lowStockAlerts = document.getElementById('low-stock-alerts');
  elements.recentRestocks = document.getElementById('recent-restocks');
  elements.medicineTable = document.getElementById('medicine-table');
  elements.supplierTable = document.getElementById('supplier-table');
  elements.reportLowStock = document.getElementById('report-low-stock');
  elements.reportSuppliers = document.getElementById('report-suppliers');
  elements.reportRestocks = document.getElementById('report-restocks');
  elements.restockForm = document.getElementById('restock-form');
  elements.medicineForm = document.getElementById('medicine-form');
  elements.supplierForm = document.getElementById('supplier-form');
  elements.toast = document.getElementById('toast');
  elements.summaryDetailModal = document.getElementById('summary-detail-modal');
  elements.summaryDetailTitle = document.getElementById('summary-detail-title');
  elements.summaryDetailCount = document.getElementById('summary-detail-count');
  elements.summaryDetailBody = document.getElementById('summary-detail-body');
  elements.medicineSearch = document.getElementById('medicine-search');
  elements.medicineCategoryFilter = document.getElementById('medicine-category-filter');
  elements.medicineStatusFilter = document.getElementById('medicine-status-filter');
  elements.lowStockOnly = document.getElementById('low-stock-only');
  elements.supplierSearch = document.getElementById('supplier-search');
  elements.restockMedicine = document.getElementById('restock-medicine');
  elements.restockSupplier = document.getElementById('restock-supplier');
  elements.restockQuantity = document.getElementById('restock-quantity');
  elements.restockUnitCost = document.getElementById('restock-unit-cost');
  elements.restockTotalCost = document.getElementById('restock-total-cost');
  elements.restockDate = document.getElementById('restock-date');
  elements.restockRemarks = document.getElementById('restock-remarks');

  elements.navLinks = [...document.querySelectorAll('.nav-link')];
  elements.pages = [...document.querySelectorAll('.page')];
  elements.modals = [...document.querySelectorAll('.modal')];
  elements.closeModalButtons = [...document.querySelectorAll('.close-modal')];
}

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.style.background = type === 'error' ? '#c93844' : '#1f2a37';
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2600);
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Cannot reach the backend at localhost:5000. In a terminal, run `cd backend` then `npm start`, and open http://localhost:5000.');
    }
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

async function loadData() {
  try {
    const [dashboardResponse, medicinesResponse, suppliersResponse, restocksResponse] = await Promise.all([
      fetchJson(`${API_BASE}/dashboard`),
      fetchJson(`${API_BASE}/medicines`),
      fetchJson(`${API_BASE}/suppliers`),
      fetchJson(`${API_BASE}/restocks`)
    ]);

    state.dashboard = dashboardResponse;
    state.medicines = medicinesResponse.medicines || medicinesResponse;
    state.suppliers = suppliersResponse.suppliers || suppliersResponse;
    state.restocks = restocksResponse.restocks || restocksResponse;

    populateSupplierSelects();
    renderDashboard();
    renderMedicines();
    renderSuppliers();
    renderReports();
    renderRestockForm();
    renderCategoryOptions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderDashboard() {
  const summary = state.dashboard?.summary || {
    total_medicines: state.medicines.length,
    low_stock: state.medicines.filter((item) => item.status === 'LOW').length,
    total_suppliers: state.suppliers.length,
    total_stock_value: state.medicines.reduce((sum, item) => sum + Number(item.current_stock || 0) * Number(item.unit_price || 0), 0)
  };

  elements.summaryCards.innerHTML = `
    <div class="summary-card" role="button" tabindex="0" data-summary-detail="medicines" aria-label="View all medicines">
      <div class="summary-label">Total Medicines</div>
      <div class="summary-value">${summary.total_medicines || 0}</div>
      <div class="summary-meta">Across active stock</div>
    </div>
    <div class="summary-card" role="button" tabindex="0" data-summary-detail="low-stock" aria-label="View low stock medicines">
      <div class="summary-label">Low Stock</div>
      <div class="summary-value">${summary.low_stock || 0}</div>
      <div class="summary-meta">Needs replenishment</div>
    </div>
    <div class="summary-card" role="button" tabindex="0" data-summary-detail="suppliers" aria-label="View suppliers">
      <div class="summary-label">Total Suppliers</div>
      <div class="summary-value">${summary.total_suppliers || 0}</div>
      <div class="summary-meta">Active vendors</div>
    </div>
    <div class="summary-card" role="button" tabindex="0" data-summary-detail="stock-value" aria-label="View total stock value">
      <div class="summary-label">Total Stock Value</div>
      <div class="summary-value">${currencyFormatter.format(Number(summary.total_stock_value || 0))}</div>
      <div class="summary-meta">Current valuation</div>
    </div>
  `;

  const medicines = state.dashboard?.medicines || state.medicines;
  elements.stockCards.innerHTML = medicines.length
    ? medicines
        .map((item) => {
          const percent = Math.min(100, Math.max(0, Number(item.stock_percentage || 0)));
          return `
            <div class="stock-card status-${String(item.status).toLowerCase()}">
              <div class="tank">
                <div class="liquid" style="height:${percent}%"></div>
              </div>
              <div class="stock-top">
                <h4>${item.name}</h4>
                <span class="status-badge">${item.status}</span>
              </div>
              <div class="stock-meta">
                <span>Qty: ${item.current_stock}</span>
                <span>${percent.toFixed(0)}%</span>
              </div>
            </div>
          `;
        })
        .join('')
    : '<div class="empty-state">No medicine data available.</div>';

  const lowStockItems = medicines.filter((item) => item.status === 'LOW');
  elements.lowStockAlerts.innerHTML = lowStockItems.length
    ? lowStockItems
        .slice(0, 6)
        .map(
          (item) => `
          <div class="alert-item">
            <div>
              <div class="alert-name">${item.name}</div>
              <small>${item.current_stock} / ${item.maximum_stock} units</small>
            </div>
            <span class="alert-pill">LOW</span>
          </div>
        `
        )
        .join('')
    : '<div class="empty-state">No low stock medicines.</div>';

  const recent = state.dashboard?.recentRestocks || state.restocks.slice(0, 5);
  elements.recentRestocks.innerHTML = recent.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Supplier</th>
            <th>Qty</th>
            <th>Total Cost</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${recent
            .slice(0, 6)
            .map(
              (record) => `
                <tr>
                  <td>${record.medicine_name || record.medicine?.name || '—'}</td>
                  <td>${record.supplier_name || record.supplier?.name || '—'}</td>
                  <td>${record.quantity}</td>
                  <td>${currencyFormatter.format(Number(record.total_cost || 0))}</td>
                  <td>${formatDate(record.restock_date || record.created_at)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No recent restocks.</div>';
}

function renderMedicines() {
  const searchValue = elements.medicineSearch.value.trim().toLowerCase();
  const categoryValue = elements.medicineCategoryFilter.value;
  const statusValue = elements.medicineStatusFilter.value;
  const lowOnly = elements.lowStockOnly.checked;

  const filtered = state.medicines.filter((medicine) => {
    const supplierName = (medicine.supplier_name || '').toLowerCase();
    const haystack = `${medicine.name} ${medicine.category} ${supplierName} ${medicine.rack_location}`.toLowerCase();

    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesCategory = categoryValue === 'all' || medicine.category === categoryValue;
    const matchesStatus = statusValue === 'all' || medicine.status === statusValue;
    const matchesLowOnly = !lowOnly || medicine.status === 'LOW';

    return matchesSearch && matchesCategory && matchesStatus && matchesLowOnly;
  });

  elements.medicineTable.innerHTML = filtered.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Min/Max</th>
            <th>Unit Price</th>
            <th>Supplier</th>
            <th>Rack</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (medicine) => `
                <tr>
                  <td>${medicine.name}</td>
                  <td>${medicine.category}</td>
                  <td>${medicine.current_stock}</td>
                  <td>${medicine.minimum_stock} / ${medicine.maximum_stock}</td>
                  <td>${currencyFormatter.format(Number(medicine.unit_price || 0))}</td>
                  <td>${medicine.supplier_name || '—'}</td>
                  <td>${medicine.rack_location}</td>
                  <td>${formatDate(medicine.expiry_date)}</td>
                  <td><span class="status-tag ${medicine.status.toLowerCase()}">${medicine.status}</span></td>
                  <td>
                    <div class="action-stack">
                      <button class="icon-btn view-medicine" data-id="${medicine.id}">View</button>
                      <button class="icon-btn edit-medicine" data-id="${medicine.id}">Edit</button>
                      <button class="icon-btn delete-medicine" data-id="${medicine.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No medicines matched your filters.</div>';

  attachMedicineActions();
}

function renderSuppliers() {
  const searchValue = elements.supplierSearch.value.trim().toLowerCase();
  const filtered = state.suppliers.filter((supplier) => {
    const haystack = `${supplier.name} ${supplier.contact_person} ${supplier.phone} ${supplier.email} ${supplier.address}`.toLowerCase();
    return !searchValue || haystack.includes(searchValue);
  });

  elements.supplierTable.innerHTML = filtered.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Address</th>
            <th>Medicines</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((supplier) => {
              const medicineCount = state.medicines.filter((medicine) => Number(medicine.supplier_id) === Number(supplier.id)).length;
              return `
                <tr>
                  <td>${supplier.name}</td>
                  <td>${supplier.contact_person}</td>
                  <td>${supplier.phone}</td>
                  <td>${supplier.email}</td>
                  <td>${supplier.address}</td>
                  <td>${medicineCount}</td>
                  <td>
                    <div class="action-stack">
                      <button class="icon-btn edit-supplier" data-id="${supplier.id}">Edit</button>
                      <button class="icon-btn delete-supplier" data-id="${supplier.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No suppliers found.</div>';

  attachSupplierActions();
}

function renderReports() {
  const lowStock = (state.dashboard?.medicines || state.medicines).filter((item) => item.status === 'LOW');
  elements.reportLowStock.innerHTML = lowStock.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Current</th>
            <th>Min</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${lowStock
            .map(
              (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.current_stock}</td>
                  <td>${item.minimum_stock}</td>
                  <td><span class="status-tag low">LOW</span></td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No low stock medicines.</div>';

  elements.reportSuppliers.innerHTML = state.suppliers.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Medicines</th>
          </tr>
        </thead>
        <tbody>
          ${state.suppliers
            .map((supplier) => {
              const count = state.medicines.filter((medicine) => Number(medicine.supplier_id) === Number(supplier.id)).length;
              return `
                <tr>
                  <td>${supplier.name}</td>
                  <td>${supplier.phone}</td>
                  <td>${supplier.email}</td>
                  <td>${count}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No supplier information.</div>';

  const restocks = state.restocks;
  elements.reportRestocks.innerHTML = restocks.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Supplier</th>
            <th>Qty</th>
            <th>Unit Cost</th>
            <th>Total Cost</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${restocks
            .slice(0, 10)
            .map(
              (record) => `
                <tr>
                  <td>${record.medicine_name || '—'}</td>
                  <td>${record.supplier_name || '—'}</td>
                  <td>${record.quantity}</td>
                  <td>${currencyFormatter.format(Number(record.unit_cost || 0))}</td>
                  <td>${currencyFormatter.format(Number(record.total_cost || 0))}</td>
                  <td>${formatDate(record.restock_date || record.created_at)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : '<div class="empty-state">No restock history.</div>';
}

function renderRestockForm() {
  const medicineOptions = state.medicines
    .map((medicine) => `<option value="${medicine.id}">${medicine.name}</option>`)
    .join('');
  const supplierOptions = state.suppliers
    .map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`)
    .join('');

  elements.restockMedicine.innerHTML = medicineOptions || '<option value="">No medicines</option>';
  elements.restockSupplier.innerHTML = supplierOptions || '<option value="">No suppliers</option>';

  if (!elements.restockQuantity.dataset.bound) {
    elements.restockQuantity.addEventListener('input', updateRestockTotal);
    elements.restockUnitCost.addEventListener('input', updateRestockTotal);
    elements.restockQuantity.dataset.bound = 'true';
  }

  if (!elements.restockDate.value) {
    elements.restockDate.value = new Date().toISOString().split('T')[0];
  }

  updateRestockTotal();
}

function updateRestockTotal() {
  const quantity = Number(elements.restockQuantity.value || 0);
  const unitCost = Number(elements.restockUnitCost.value || 0);
  const total = quantity * unitCost;
  elements.restockTotalCost.value = currencyFormatter.format(total);
}

function renderCategoryOptions() {
  const categories = [...new Set(state.medicines.map((item) => item.category))].sort();
  const options = ['<option value="all">All categories</option>']
    .concat(categories.map((category) => `<option value="${category}">${category}</option>`))
    .join('');

  elements.medicineCategoryFilter.innerHTML = options;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[character];
  });
}

function getStockStatus(medicine) {
  const current = Number(medicine.current_stock || 0);
  const minimum = Number(medicine.minimum_stock || 0);
  const maximum = Number(medicine.maximum_stock || 0);
  const percent = maximum > 0 ? (current / maximum) * 100 : 0;

  if (current <= minimum) return 'LOW';
  if (percent < 80) return 'MEDIUM';
  return 'FULL';
}

function renderDetailTable(headers, rows, options = {}) {
  if (!rows.length) {
    return '<div class="empty-state">There is no data to display yet.</div>';
  }

  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  const footer = options.footer
    ? `<tfoot><tr><td colspan="${headers.length - 1}">${escapeHTML(options.footer.label)}</td><td>${options.footer.value}</td></tr></tfoot>`
    : '';

  return `
    <div class="table-wrap">
      <table class="summary-detail-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHTML(header)}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
        ${footer}
      </table>
    </div>
  `;
}

function medicineTableRow(medicine) {
  const status = getStockStatus(medicine);
  return [
    escapeHTML(medicine.name),
    escapeHTML(medicine.category),
    escapeHTML(medicine.current_stock),
    escapeHTML(medicine.minimum_stock),
    escapeHTML(medicine.maximum_stock),
    currencyFormatter.format(Number(medicine.unit_price || 0)),
    escapeHTML(medicine.supplier_name || '—'),
    escapeHTML(medicine.rack_location || '—'),
    escapeHTML(formatDate(medicine.expiry_date)),
    `<span class="status-tag ${status.toLowerCase()}">${status}</span>`
  ];
}

async function fetchDetailData(kind) {
  if (kind === 'medicines' || kind === 'low-stock' || kind === 'stock-value') {
    const response = await fetchJson(`${API_BASE}/medicines`);
    return { medicines: response.medicines || response };
  }

  const [supplierResponse, medicineResponse] = await Promise.all([
    fetchJson(`${API_BASE}/suppliers`),
    fetchJson(`${API_BASE}/medicines`)
  ]);
  return {
    suppliers: supplierResponse.suppliers || supplierResponse,
    medicines: medicineResponse.medicines || medicineResponse
  };
}

function renderSummaryDetail(kind, data) {
  const medicines = data.medicines || [];
  const lowStockMedicines = medicines.filter(
    (medicine) => Number(medicine.current_stock) <= Number(medicine.minimum_stock)
  );

  if (kind === 'medicines') {
    elements.summaryDetailTitle.textContent = 'Medicine Inventory';
    elements.summaryDetailCount.textContent = `${medicines.length} medicines`;
    elements.summaryDetailBody.innerHTML = renderDetailTable(
      ['Medicine Name', 'Category', 'Current Stock', 'Minimum Stock', 'Maximum Stock', 'Unit Price', 'Supplier', 'Rack Location', 'Expiry Date', 'Stock Status'],
      medicines.map(medicineTableRow)
    );
    return;
  }

  if (kind === 'low-stock') {
    elements.summaryDetailTitle.textContent = 'Low Stock Medicines';
    elements.summaryDetailCount.textContent = `${lowStockMedicines.length} medicines need attention`;
    elements.summaryDetailBody.innerHTML = renderDetailTable(
      ['Medicine Name', 'Current Stock', 'Minimum Stock', 'Quantity Needed', 'Supplier', 'Rack Location', 'Status'],
      lowStockMedicines.map((medicine) => [
        escapeHTML(medicine.name),
        escapeHTML(medicine.current_stock),
        escapeHTML(medicine.minimum_stock),
        escapeHTML(Math.max(0, Number(medicine.minimum_stock) - Number(medicine.current_stock))),
        escapeHTML(medicine.supplier_name || '—'),
        escapeHTML(medicine.rack_location || '—'),
        '<span class="status-tag low">LOW</span>'
      ])
    );
    return;
  }

  if (kind === 'suppliers') {
    const suppliers = data.suppliers || [];
    elements.summaryDetailTitle.textContent = 'Supplier Directory';
    elements.summaryDetailCount.textContent = `${suppliers.length} suppliers`;
    elements.summaryDetailBody.innerHTML = renderDetailTable(
      ['Supplier Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Number of Medicines Supplied'],
      suppliers.map((supplier) => {
        const medicineCount = medicines.filter(
          (medicine) => Number(medicine.supplier_id) === Number(supplier.id)
        ).length;
        return [
          escapeHTML(supplier.name),
          escapeHTML(supplier.contact_person),
          escapeHTML(supplier.phone),
          escapeHTML(supplier.email),
          escapeHTML(supplier.address),
          escapeHTML(medicineCount)
        ];
      })
    );
    return;
  }

  const totalValue = medicines.reduce(
    (sum, medicine) => sum + Number(medicine.current_stock || 0) * Number(medicine.unit_price || 0),
    0
  );
  elements.summaryDetailTitle.textContent = 'Current Stock Valuation';
  elements.summaryDetailCount.textContent = `Total value ${currencyFormatter.format(totalValue)}`;
  elements.summaryDetailBody.innerHTML = renderDetailTable(
    ['Medicine Name', 'Current Stock', 'Unit Price', 'Stock Value'],
    medicines.map((medicine) => [
      escapeHTML(medicine.name),
      escapeHTML(medicine.current_stock),
      currencyFormatter.format(Number(medicine.unit_price || 0)),
      currencyFormatter.format(Number(medicine.current_stock || 0) * Number(medicine.unit_price || 0))
    ]),
    { footer: { label: 'Grand Total', value: currencyFormatter.format(totalValue) } }
  );
}

async function openSummaryDetail(kind) {
  elements.summaryDetailModal.classList.remove('hidden');
  elements.summaryDetailCount.textContent = 'Loading details';
  elements.summaryDetailTitle.textContent = 'Loading...';
  elements.summaryDetailBody.innerHTML = '<div class="detail-loading"><span class="detail-spinner" aria-hidden="true"></span><span>Loading live data from the database...</span></div>';
  document.body.style.overflow = 'hidden';

  try {
    const data = await fetchDetailData(kind);
    renderSummaryDetail(kind, data);
  } catch (error) {
    elements.summaryDetailTitle.textContent = 'Unable to load details';
    elements.summaryDetailCount.textContent = '';
    elements.summaryDetailBody.innerHTML = `<div class="detail-error">${escapeHTML(error.message || 'Please try again in a moment.')}</div>`;
  }
}

function closeSummaryDetail() {
  elements.summaryDetailModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function openMedicineModal(medicine = null) {
  const modal = document.getElementById('medicine-modal');
  const title = document.getElementById('medicine-modal-title');
  const form = document.getElementById('medicine-form');

  form.dataset.mode = medicine ? 'edit' : 'create';
  form.dataset.medicineId = medicine ? medicine.id : '';
  title.textContent = medicine ? 'Edit Medicine' : 'Add Medicine';

  const fields = [...form.elements].filter((item) => item.name);
  fields.forEach((field) => {
    if (field.name === 'supplier_id') {
      field.value = medicine ? String(medicine.supplier_id || '') : '';
    } else {
      field.value = medicine ? (medicine[field.name] ?? '') : '';
    }
  });

  modal.classList.remove('hidden');
}

function openSupplierModal(supplier = null) {
  const modal = document.getElementById('supplier-modal');
  const title = document.getElementById('supplier-modal-title');
  const form = document.getElementById('supplier-form');

  form.dataset.mode = supplier ? 'edit' : 'create';
  form.dataset.supplierId = supplier ? supplier.id : '';
  title.textContent = supplier ? 'Edit Supplier' : 'Add Supplier';

  const fields = [...form.elements].filter((item) => item.name);
  fields.forEach((field) => {
    field.value = supplier ? (supplier[field.name] ?? '') : '';
  });

  modal.classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

async function saveMedicine(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = Object.fromEntries(new FormData(form).entries());
  const payload = {
    ...formData,
    current_stock: Number(formData.current_stock),
    minimum_stock: Number(formData.minimum_stock),
    maximum_stock: Number(formData.maximum_stock),
    unit_price: Number(formData.unit_price),
    supplier_id: Number(formData.supplier_id)
  };

  try {
    const isEdit = form.dataset.mode === 'edit';
    const url = isEdit ? `${API_BASE}/medicines/${form.dataset.medicineId}` : `${API_BASE}/medicines`;
    const method = isEdit ? 'PUT' : 'POST';
    await fetchJson(url, {
      method,
      body: JSON.stringify(payload)
    });
    closeModal('medicine-modal');
    form.reset();
    showToast(isEdit ? 'Medicine updated successfully.' : 'Medicine added successfully.');
    await loadData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const isEdit = form.dataset.mode === 'edit';
    const url = isEdit ? `${API_BASE}/suppliers/${form.dataset.supplierId}` : `${API_BASE}/suppliers`;
    const method = isEdit ? 'PUT' : 'POST';
    await fetchJson(url, {
      method,
      body: JSON.stringify(payload)
    });
    closeModal('supplier-modal');
    form.reset();
    showToast(isEdit ? 'Supplier updated successfully.' : 'Supplier added successfully.');
    await loadData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteMedicine(id) {
  if (!window.confirm('Delete this medicine?')) {
    return;
  }

  try {
    await fetchJson(`${API_BASE}/medicines/${id}`, { method: 'DELETE' });
    showToast('Medicine deleted.');
    await loadData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteSupplier(id) {
  if (!window.confirm('Delete this supplier?')) {
    return;
  }

  try {
    await fetchJson(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
    showToast('Supplier deleted.');
    await loadData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function saveRestock(event) {
  event.preventDefault();

  const payload = {
    medicine_id: Number(elements.restockMedicine.value),
    supplier_id: Number(elements.restockSupplier.value),
    quantity: Number(elements.restockQuantity.value),
    unit_cost: Number(elements.restockUnitCost.value),
    total_cost: Number(elements.restockUnitCost.value) * Number(elements.restockQuantity.value || 0),
    restock_date: elements.restockDate.value,
    remarks: elements.restockRemarks.value
  };

  try {
    await fetchJson(`${API_BASE}/restocks`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    elements.restockForm.reset();
    elements.restockDate.value = new Date().toISOString().split('T')[0];
    elements.restockTotalCost.value = '';
    showToast('Restock saved successfully.');
    await loadData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function attachMedicineActions() {
  document.querySelectorAll('.view-medicine').forEach((button) => {
    button.addEventListener('click', () => {
      const medicine = state.medicines.find((item) => Number(item.id) === Number(button.dataset.id));
      if (!medicine) return;
      showToast(`${medicine.name} - ${medicine.status} stock status`);
    });
  });

  document.querySelectorAll('.edit-medicine').forEach((button) => {
    button.addEventListener('click', () => {
      const medicine = state.medicines.find((item) => Number(item.id) === Number(button.dataset.id));
      if (medicine) openMedicineModal(medicine);
    });
  });

  document.querySelectorAll('.delete-medicine').forEach((button) => {
    button.addEventListener('click', () => deleteMedicine(button.dataset.id));
  });
}

function attachSupplierActions() {
  document.querySelectorAll('.edit-supplier').forEach((button) => {
    button.addEventListener('click', () => {
      const supplier = state.suppliers.find((item) => Number(item.id) === Number(button.dataset.id));
      if (supplier) openSupplierModal(supplier);
    });
  });

  document.querySelectorAll('.delete-supplier').forEach((button) => {
    button.addEventListener('click', () => deleteSupplier(button.dataset.id));
  });
}

function populateSupplierSelects() {
  const medicineSelect = document.querySelector('select[name="supplier_id"]');
  if (medicineSelect) {
    medicineSelect.innerHTML = state.suppliers
      .map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`)
      .join('');
  }
}

function bindEvents() {
  elements.summaryCards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-summary-detail]');
    if (card) openSummaryDetail(card.dataset.summaryDetail);
  });

  elements.summaryCards.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-summary-detail]')) {
      event.preventDefault();
      openSummaryDetail(event.target.dataset.summaryDetail);
    }
  });

  document.getElementById('close-summary-detail').addEventListener('click', closeSummaryDetail);
  elements.summaryDetailModal.addEventListener('click', (event) => {
    if (event.target === elements.summaryDetailModal) closeSummaryDetail();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.summaryDetailModal.classList.contains('hidden')) {
      closeSummaryDetail();
    }
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const section = link.dataset.section;
      state.activeSection = section;
      elements.navLinks.forEach((item) => item.classList.toggle('active', item === link));
      elements.pages.forEach((page) => page.classList.toggle('active', page.id === section));
    });
  });

  elements.closeModalButtons.forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.target));
  });

  document.getElementById('open-medicine-modal').addEventListener('click', () => openMedicineModal());
  document.getElementById('open-supplier-modal').addEventListener('click', () => openSupplierModal());

  document.getElementById('medicine-modal').addEventListener('click', (event) => {
    if (event.target.id === 'medicine-modal') closeModal('medicine-modal');
  });

  document.getElementById('supplier-modal').addEventListener('click', (event) => {
    if (event.target.id === 'supplier-modal') closeModal('supplier-modal');
  });

  elements.medicineSearch.addEventListener('input', renderMedicines);
  elements.medicineCategoryFilter.addEventListener('change', renderMedicines);
  elements.medicineStatusFilter.addEventListener('change', renderMedicines);
  elements.lowStockOnly.addEventListener('change', renderMedicines);
  elements.supplierSearch.addEventListener('input', renderSuppliers);

  elements.medicineForm.addEventListener('submit', saveMedicine);
  elements.supplierForm.addEventListener('submit', saveSupplier);
  elements.restockForm.addEventListener('submit', saveRestock);
}

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  loadData();
});
