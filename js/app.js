(function () {
  'use strict';

  // ============================================================
  // Constants & Config
  // ============================================================

  /** Default categories always available in the selector. Not stored in localStorage. */
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  /** Color palette for chart slices. Index 9 is reserved for the "Other" aggregate slice. */
  const CHART_COLORS = [
    '#FF6384', // 0 — pink-red
    '#36A2EB', // 1 — blue
    '#FFCE56', // 2 — yellow
    '#4BC0C0', // 3 — teal
    '#9966FF', // 4 — purple
    '#FF9F40', // 5 — orange
    '#C9CBCF', // 6 — grey
    '#7BC8A4', // 7 — green
    '#E7E9ED', // 8 — light grey
    '#FF6384', // 9 — "Other" slice
  ];

  /** LocalStorage key names. */
  const STORAGE_KEYS = {
    TRANSACTIONS: 'ebd_transactions',
    CATEGORIES:   'ebd_categories',
    THEME:        'ebd_theme',
  };

  // ============================================================
  // State
  // ============================================================

  const state = {
    transactions:     [],
    categories:       [],
    theme:            'light',
    storageAvailable: true,
  };

  /** Reference to the active Chart.js instance (null when none exists). */
  let chartInstance = null;

  // ============================================================
  // UI Notifications
  // ============================================================

  function showStorageWarning(message) {
    const banner = document.getElementById('storage-warning');
    const msgEl  = document.getElementById('storage-warning-message');
    if (!banner) return;
    if (message && msgEl) msgEl.textContent = message;
    banner.hidden = false;
  }

  function showQuotaToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message || 'Perubahan tidak tersimpan — kapasitas penyimpanan penuh.';
    toast.hidden = false;
    toast.classList.remove('toast--fading');
    setTimeout(function () { toast.classList.add('toast--fading'); }, 2500);
    setTimeout(function () {
      toast.hidden = true;
      toast.classList.remove('toast--fading');
    }, 3000);
  }

  // ============================================================
  // Storage Layer
  // ============================================================

  function isStorageAvailable() {
    try {
      const testKey = '__ebd_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      state.storageAvailable = true;
      return true;
    } catch (e) {
      state.storageAvailable = false;
      return false;
    }
  }

  function loadFromStorage() {
    if (!isStorageAvailable()) {
      showStorageWarning('Peringatan: Penyimpanan lokal tidak tersedia. Data tidak akan disimpan.');
      return;
    }

    // Transactions
    const rawTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (rawTransactions !== null) {
      try {
        const parsed = JSON.parse(rawTransactions);
        state.transactions = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        state.transactions = [];
        showStorageWarning('Peringatan: Data tersimpan tidak dapat dimuat. Memulai dari awal.');
      }
    }

    // Categories
    const rawCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (rawCategories !== null) {
      try {
        const parsed = JSON.parse(rawCategories);
        state.categories = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        state.categories = [];
      }
    }

    // Theme
    const rawTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (rawTheme === 'light' || rawTheme === 'dark') {
      state.theme = rawTheme;
    } else {
      const prefersDark = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      state.theme = prefersDark ? 'dark' : 'light';
    }
  }

  function saveTransactions() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        showQuotaToast();
      }
    }
  }

  function saveCategories() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        showQuotaToast();
      }
    }
  }

  function saveTheme() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        showQuotaToast();
      }
    }
  }

  // ============================================================
  // Validation
  // ============================================================

  function validateTransaction(name, amount, category) {
    const errors = { name: null, amount: null, category: null };

    // name
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length === 0) {
      errors.name = 'Nama item wajib diisi.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Nama item maksimal 100 karakter.';
    }

    // amount
    const numericAmount = Number(amount);
    if (amount === '' || amount === null || amount === undefined || isNaN(numericAmount)) {
      errors.amount = 'Jumlah harus berupa angka.';
    } else if (!isFinite(numericAmount) || numericAmount < 1) {
      errors.amount = 'Jumlah minimal Rp1.';
    } else if (numericAmount > 999999999999) {
      errors.amount = 'Jumlah tidak boleh melebihi Rp999.999.999.999.';
    }

    // category
    const trimmedCategory = typeof category === 'string' ? category.trim() : '';
    if (trimmedCategory.length === 0) {
      errors.category = 'Pilih kategori terlebih dahulu.';
    }

    return errors;
  }

  function validateCategory(name, existingCategories) {
    const trimmed = typeof name === 'string' ? name.trim() : '';

    if (trimmed.length === 0) {
      return 'Nama kategori wajib diisi.';
    }
    if (trimmed.length > 50) {
      return 'Nama kategori maksimal 50 karakter.';
    }

    const allCategories = DEFAULT_CATEGORIES.concat(existingCategories);
    const lowerTrimmed  = trimmed.toLowerCase();
    const duplicate = allCategories.some(function (c) {
      return c.toLowerCase() === lowerTrimmed;
    });
    if (duplicate) {
      return 'Kategori tersebut sudah ada.';
    }

    return null;
  }

  // ============================================================
  // State Mutations
  // ============================================================

  function addTransaction(name, amount, category) {
    const errors = validateTransaction(name, amount, category);
    if (errors.name || errors.amount || errors.category) return false;

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);

    const transaction = {
      id:        id,
      name:      name.trim(),
      amount:    Math.round(Number(amount)),
      category:  category.trim(),
      createdAt: Date.now(),
    };

    state.transactions.unshift(transaction);
    saveTransactions();
    renderAll();
    return true;
  }

  function deleteTransaction(id) {
    state.transactions = state.transactions.filter(function (t) {
      return t.id !== id;
    });
    saveTransactions();
    renderAll();
  }

  function addCategory(name) {
    const error = validateCategory(name, state.categories);
    if (error) return false;
    state.categories.push(name.trim());
    saveCategories();
    renderCategorySelector();
    return true;
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const btn     = document.getElementById('theme-toggle');
    const iconEl  = btn && btn.querySelector('.theme-toggle-icon');
    const labelEl = btn && btn.querySelector('.theme-toggle-label');

    if (btn) {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
      if (iconEl)  iconEl.textContent  = isDark ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
    }

    saveTheme();
  }

  // ============================================================
  // Helpers / Pure Utils
  // ============================================================

  /**
   * Format angka ke Rupiah: "Rp150.000" atau "-Rp150.000".
   * Tanpa desimal sesuai konvensi Rupiah.
   *
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return (value < 0 ? '-Rp' : 'Rp') + formatted;
  }

  /**
   * Format label bulan dalam Bahasa Indonesia: "Oktober 2026".
   *
   * @param {Date} date
   * @returns {string}
   */
  function formatMonthLabel(date) {
    return date.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  }

  /**
   * Kelompokkan transaksi per bulan dan jumlahkan.
   *
   * @param {Array<{amount:number, createdAt:number}>} transactions
   * @returns {Array<{key:string, label:string, total:number}>} Urutan terbaru ke terlama.
   */
  function groupByMonth(transactions) {
    const map = {};
    transactions.forEach(function (t) {
      const d   = new Date(t.createdAt);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!map[key]) {
        map[key] = { key: key, label: formatMonthLabel(d), total: 0 };
      }
      map[key].total += t.amount;
    });

    return Object.values(map).sort(function (a, b) {
      return b.key.localeCompare(a.key);
    });
  }

  /**
   * Akumulasi jumlah per kategori untuk pie chart.
   * Lebih dari 9 kategori digabung menjadi "Lainnya".
   *
   * @param {Array<{amount:number, category:string}>} transactions
   * @returns {{ labels:string[], amounts:number[], colors:string[] }}
   */
  function buildChartData(transactions) {
    const map = {};
    transactions.forEach(function (t) {
      if (!map[t.category]) map[t.category] = 0;
      map[t.category] += t.amount;
    });

    const entries = Object.entries(map);
    const labels  = [];
    const amounts = [];
    const colors  = [];

    if (entries.length <= 9) {
      entries.forEach(function (entry, i) {
        labels.push(entry[0]);
        amounts.push(Math.round(entry[1]));
        colors.push(CHART_COLORS[i % 9]);
      });
    } else {
      entries.slice(0, 9).forEach(function (entry, i) {
        labels.push(entry[0]);
        amounts.push(Math.round(entry[1]));
        colors.push(CHART_COLORS[i]);
      });
      const otherTotal = entries.slice(9).reduce(function (sum, entry) {
        return sum + entry[1];
      }, 0);
      labels.push('Lainnya');
      amounts.push(Math.round(otherTotal));
      colors.push(CHART_COLORS[9]);
    }

    return { labels: labels, amounts: amounts, colors: colors };
  }

  // ============================================================
  // Render Functions
  // ============================================================

  /**
   * Hitung ulang dan tampilkan total saldo.
   */
  function renderBalance() {
    const total   = state.transactions.reduce(function (sum, t) { return sum + t.amount; }, 0);
    const display = document.getElementById('balance-display');
    if (!display) return;

    // Semua pengeluaran ditampilkan sebagai nilai negatif
    display.textContent = total === 0 ? 'Rp0' : formatCurrency(-total);

    display.classList.toggle('balance-amount--negative', total > 0);
    display.classList.toggle('balance-amount--positive', total === 0);
  }

  /**
   * Bangun ulang daftar transaksi dari state.
   */
  function renderTransactionList() {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    list.innerHTML = '';

    if (state.transactions.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state-item';
      li.innerHTML = '<p class="empty-state">Belum ada pengeluaran yang dicatat.</p>';
      list.appendChild(li);
      return;
    }

    // Urutkan terbaru ke terlama
    const sorted = state.transactions.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    sorted.forEach(function (t) {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.setAttribute('data-id', t.id);

      li.innerHTML =
        '<span class="item-name" title="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</span>' +
        '<span class="item-amount">-' + formatCurrency(t.amount) + '</span>' +
        '<span class="item-category">' + escapeHtml(t.category) + '</span>' +
        '<button class="delete-btn" type="button" data-id="' + escapeHtml(t.id) + '" ' +
          'aria-label="Hapus transaksi: ' + escapeHtml(t.name) + '">✕</button>';

      list.appendChild(li);
    });
  }

  /**
   * Bangun ulang opsi <select> kategori, pertahankan pilihan saat ini.
   */
  function renderCategorySelector() {
    const select = document.getElementById('item-category');
    if (!select) return;

    const currentValue  = select.value;
    select.innerHTML    = '';

    const allCategories = DEFAULT_CATEGORIES.concat(state.categories);
    allCategories.forEach(function (cat) {
      const option       = document.createElement('option');
      option.value       = cat;
      option.textContent = cat;
      select.appendChild(option);
    });

    if (currentValue && allCategories.includes(currentValue)) {
      select.value = currentValue;
    }
  }

  /**
   * Render atau perbarui pie chart Chart.js.
   */
  function renderChart() {
    const canvas   = document.getElementById('spending-chart');
    const emptyMsg = document.getElementById('chart-empty-state');

    if (window.__chartJsFailed || typeof Chart === 'undefined') return;
    if (!canvas) return;

    if (state.transactions.length === 0) {
      if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
      canvas.style.display = 'none';
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }

    if (emptyMsg) emptyMsg.hidden = true;
    canvas.style.display = '';

    const chartData = buildChartData(state.transactions);

    if (chartInstance) {
      chartInstance.data.labels                       = chartData.labels;
      chartInstance.data.datasets[0].data             = chartData.amounts;
      chartInstance.data.datasets[0].backgroundColor  = chartData.colors;
      chartInstance.data.datasets[0].borderColor      = chartData.colors;
      chartInstance.update();
    } else {
      chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels:   chartData.labels,
          datasets: [{
            data:            chartData.amounts,
            backgroundColor: chartData.colors,
            borderColor:     chartData.colors,
            borderWidth:     2,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color:    getComputedStyle(document.documentElement)
                            .getPropertyValue('--color-text-primary').trim() || '#1a1d23',
                font:     { size: 12 },
                boxWidth: 14,
                padding:  10,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return ' ' + context.label + ': ' + formatCurrency(context.parsed);
                },
              },
            },
          },
        },
      });
    }
  }

  /**
   * Render daftar ringkasan bulanan.
   */
  function renderMonthlySummary() {
    const list = document.getElementById('monthly-summary-list');
    if (!list) return;

    list.innerHTML = '';

    if (state.transactions.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state-item';
      li.innerHTML = '<p class="empty-state">Belum ada data bulanan.</p>';
      list.appendChild(li);
      return;
    }

    groupByMonth(state.transactions).forEach(function (m) {
      const li = document.createElement('li');
      li.className = 'monthly-summary-item';
      li.innerHTML =
        '<span class="month-label">' + escapeHtml(m.label) + '</span>' +
        '<span class="month-total">-' + formatCurrency(m.total) + '</span>';
      list.appendChild(li);
    });
  }

  /**
   * Re-render penuh — synchronous dan idempotent.
   */
  function renderAll() {
    renderBalance();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
    renderCategorySelector();
  }

  // ============================================================
  // Security Helper
  // ============================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  function attachEventListeners() {

    // Transaction form
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const nameVal     = document.getElementById('item-name')     ? document.getElementById('item-name').value     : '';
        const amountVal   = document.getElementById('item-amount')   ? document.getElementById('item-amount').value   : '';
        const categoryVal = document.getElementById('item-category') ? document.getElementById('item-category').value : '';

        const errors = validateTransaction(nameVal, amountVal, categoryVal);

        setFieldError('item-name-error',     errors.name);
        setFieldError('item-amount-error',   errors.amount);
        setFieldError('item-category-error', errors.category);

        if (errors.name || errors.amount || errors.category) return;

        if (addTransaction(nameVal, parseFloat(amountVal), categoryVal)) {
          txForm.reset();
          renderCategorySelector();
          setFieldError('item-name-error',     null);
          setFieldError('item-amount-error',   null);
          setFieldError('item-category-error', null);
        }
      });
    }

    // Delete (event delegation)
    const txList = document.getElementById('transaction-list');
    if (txList) {
      txList.addEventListener('click', function (e) {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (id) deleteTransaction(id);
      });
    }

    // Category form
    const catForm = document.getElementById('category-form');
    if (catForm) {
      catForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const catVal = document.getElementById('custom-category')
          ? document.getElementById('custom-category').value : '';
        const error = validateCategory(catVal, state.categories);
        setFieldError('category-error', error);
        if (error) return;
        if (addCategory(catVal)) {
          catForm.reset();
          setFieldError('category-error', null);
        }
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        setTheme(state.theme === 'dark' ? 'light' : 'dark');
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        renderChart();
      });
    }

    // Tab navigation
    const dashboardTab  = document.getElementById('tab-dashboard');
    const monthlyTab    = document.getElementById('tab-monthly');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewMonthly   = document.getElementById('view-monthly');

    if (dashboardTab) {
      dashboardTab.addEventListener('click', function () {
        activateTab(dashboardTab, viewDashboard);
        deactivateTab(monthlyTab, viewMonthly);
      });
    }
    if (monthlyTab) {
      monthlyTab.addEventListener('click', function () {
        activateTab(monthlyTab, viewMonthly);
        deactivateTab(dashboardTab, viewDashboard);
      });
    }

    // Dismiss storage warning
    const closeBtn = document.getElementById('storage-warning-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        const banner = document.getElementById('storage-warning');
        if (banner) banner.hidden = true;
      });
    }
  }

  function activateTab(tab, panel) {
    if (tab)  { tab.setAttribute('aria-selected', 'true');  tab.classList.add('tab-btn--active'); }
    if (panel) panel.hidden = false;
  }

  function deactivateTab(tab, panel) {
    if (tab)  { tab.setAttribute('aria-selected', 'false'); tab.classList.remove('tab-btn--active'); }
    if (panel) panel.hidden = true;
  }

  function setFieldError(spanId, message) {
    const span = document.getElementById(spanId);
    if (span) span.textContent = message || '';
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    loadFromStorage();          // baca localStorage → state
    setTheme(state.theme);      // terapkan tema sebelum render (hindari flash)
    attachEventListeners();     // pasang semua event listener
    renderAll();                // render awal
  }

  document.addEventListener('DOMContentLoaded', init);

})();
