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
    '#FF6384', // 9 — "Other" slice (vivid pink, same distinct look)
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

  /**
   * Single source of truth for the application.
   *
   * @type {{
   *   transactions: Array<{id:string, name:string, amount:number, category:string, createdAt:number}>,
   *   categories: string[],
   *   theme: 'light'|'dark',
   *   storageAvailable: boolean
   * }}
   */
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

  /**
   * Shows the persistent warning banner.
   * @param {string} [message] Optional override message.
   */
  function showStorageWarning(message) {
    const banner = document.getElementById('storage-warning');
    const msgEl  = document.getElementById('storage-warning-message');
    if (!banner) return;
    if (message && msgEl) msgEl.textContent = message;
    banner.hidden = false;
  }

  /**
   * Shows a brief toast notification (auto-hides after ~3 s).
   * @param {string} [message]
   */
  function showQuotaToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message || 'Warning: Changes could not be saved — storage quota exceeded.';
    toast.hidden = false;
    toast.classList.remove('toast--fading');

    // Start fade after 2.5 s, hide after 3 s
    setTimeout(function () {
      toast.classList.add('toast--fading');
    }, 2500);
    setTimeout(function () {
      toast.hidden = true;
      toast.classList.remove('toast--fading');
    }, 3000);
  }

  // ============================================================
  // Storage Layer
  // ============================================================

  /**
   * Probes localStorage with a test write/remove to determine availability.
   * Sets `state.storageAvailable` as a side-effect.
   *
   * @returns {boolean}
   */
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

  /**
   * Reads all persisted values from localStorage and populates in-memory state.
   */
  function loadFromStorage() {
    if (!isStorageAvailable()) {
      showStorageWarning('Warning: Local storage is unavailable. Your data will not be saved.');
      return;
    }

    // --- Transactions ---
    const rawTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (rawTransactions !== null) {
      try {
        const parsed = JSON.parse(rawTransactions);
        state.transactions = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        state.transactions = [];
        showStorageWarning('Warning: Saved transaction data could not be loaded. Starting fresh.');
      }
    }

    // --- Categories ---
    const rawCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (rawCategories !== null) {
      try {
        const parsed = JSON.parse(rawCategories);
        state.categories = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        state.categories = [];
      }
    }

    // --- Theme ---
    const rawTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (rawTheme === 'light' || rawTheme === 'dark') {
      state.theme = rawTheme;
    } else {
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      state.theme = prefersDark ? 'dark' : 'light';
    }
  }

  /**
   * Persists `state.transactions` to localStorage.
   */
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

  /**
   * Persists `state.categories` to localStorage.
   */
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

  /**
   * Persists `state.theme` to localStorage.
   */
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

  /**
   * Validates transaction inputs.
   *
   * @param {string} name
   * @param {string|number} amount
   * @param {string} category
   * @returns {{ name: string|null, amount: string|null, category: string|null }}
   */
  function validateTransaction(name, amount, category) {
    const errors = { name: null, amount: null, category: null };

    // name
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length === 0) {
      errors.name = 'Item name is required.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Item name must be 100 characters or fewer.';
    }

    // amount
    const numericAmount = Number(amount);
    if (amount === '' || amount === null || amount === undefined || isNaN(numericAmount)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (!isFinite(numericAmount) || numericAmount < 0.01) {
      errors.amount = 'Amount must be at least 0.01.';
    } else if (numericAmount > 999999999.99) {
      errors.amount = 'Amount must not exceed 999,999,999.99.';
    }

    // category
    const trimmedCategory = typeof category === 'string' ? category.trim() : '';
    if (trimmedCategory.length === 0) {
      errors.category = 'Please select a category.';
    }

    return errors;
  }

  /**
   * Validates a new custom category name.
   *
   * @param {string} name
   * @param {string[]} existingCategories  Custom categories in state (not the defaults).
   * @returns {string|null} Error message, or null when valid.
   */
  function validateCategory(name, existingCategories) {
    const trimmed = typeof name === 'string' ? name.trim() : '';

    if (trimmed.length === 0) {
      return 'Category name is required.';
    }
    if (trimmed.length > 50) {
      return 'Category name must be 50 characters or fewer.';
    }

    const allCategories = DEFAULT_CATEGORIES.concat(existingCategories);
    const lowerTrimmed = trimmed.toLowerCase();
    const duplicate = allCategories.some(function (c) {
      return c.toLowerCase() === lowerTrimmed;
    });
    if (duplicate) {
      return 'That category already exists.';
    }

    return null;
  }

  // ============================================================
  // State Mutations
  // ============================================================

  /**
   * Creates and adds a new transaction to state, persists, and re-renders.
   *
   * @param {string} name
   * @param {number} amount
   * @param {string} category
   * @returns {boolean} true when the transaction was added successfully.
   */
  function addTransaction(name, amount, category) {
    const errors = validateTransaction(name, amount, category);
    if (errors.name || errors.amount || errors.category) {
      return false;
    }

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);

    const transaction = {
      id:        id,
      name:      name.trim(),
      amount:    parseFloat(Number(amount).toFixed(2)),
      category:  category.trim(),
      createdAt: Date.now(),
    };

    // Prepend so newest appears first after sort-descending
    state.transactions.unshift(transaction);
    saveTransactions();
    renderAll();
    return true;
  }

  /**
   * Removes the transaction with the given id, persists, and re-renders.
   *
   * @param {string} id
   */
  function deleteTransaction(id) {
    state.transactions = state.transactions.filter(function (t) {
      return t.id !== id;
    });
    saveTransactions();
    renderAll();
  }

  /**
   * Adds a custom category, persists, and refreshes the category selector.
   *
   * @param {string} name
   * @returns {boolean} true when added successfully.
   */
  function addCategory(name) {
    const error = validateCategory(name, state.categories);
    if (error) return false;
    state.categories.push(name.trim());
    saveCategories();
    renderCategorySelector();
    return true;
  }

  /**
   * Applies the given theme to the document and persists it.
   *
   * @param {'light'|'dark'} theme
   */
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const btn      = document.getElementById('theme-toggle');
    const iconEl   = btn && btn.querySelector('.theme-toggle-icon');
    const labelEl  = btn && btn.querySelector('.theme-toggle-label');

    if (btn) {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      if (iconEl)  iconEl.textContent  = isDark ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    saveTheme();
  }

  // ============================================================
  // Helpers / Pure Utils
  // ============================================================

  /**
   * Formats a number as a currency string: "$1,234.56" or "-$1,234.56".
   *
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    const abs = Math.abs(value);
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (value < 0 ? '-Rp' : 'Rp') + formatted;
  }

  /**
   * Formats a "Month YYYY" label from a Date object.
   *
   * @param {Date} date
   * @returns {string} e.g. "October 2026"
   */
  function formatMonthLabel(date) {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Groups transactions by "YYYY-MM" key and sums amounts per month.
   *
   * @param {Array<{amount: number, createdAt: number}>} transactions
   * @returns {Array<{key: string, label: string, total: number}>} Sorted descending by key.
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
   * Aggregates transaction amounts by category.
   * If more than 9 distinct categories exist, the extras are merged into "Other".
   *
   * @param {Array<{amount: number, category: string}>} transactions
   * @returns {{ labels: string[], amounts: number[], colors: string[] }}
   */
  function buildChartData(transactions) {
    const map = {};
    transactions.forEach(function (t) {
      if (!map[t.category]) map[t.category] = 0;
      map[t.category] += t.amount;
    });

    const entries = Object.entries(map); // [[category, total], ...]
    const labels  = [];
    const amounts = [];
    const colors  = [];

    if (entries.length <= 9) {
      entries.forEach(function (entry, i) {
        labels.push(entry[0]);
        amounts.push(parseFloat(entry[1].toFixed(2)));
        colors.push(CHART_COLORS[i % 9]);
      });
    } else {
      // First 9 categories keep individual slices
      entries.slice(0, 9).forEach(function (entry, i) {
        labels.push(entry[0]);
        amounts.push(parseFloat(entry[1].toFixed(2)));
        colors.push(CHART_COLORS[i]);
      });
      // Remaining go into "Other"
      const otherTotal = entries.slice(9).reduce(function (sum, entry) {
        return sum + entry[1];
      }, 0);
      labels.push('Other');
      amounts.push(parseFloat(otherTotal.toFixed(2)));
      colors.push(CHART_COLORS[9]);
    }

    return { labels: labels, amounts: amounts, colors: colors };
  }

  // ============================================================
  // Render Functions
  // ============================================================

  /**
   * Recalculates and displays the running total balance.
   */
  function renderBalance() {
    const total = state.transactions.reduce(function (sum, t) {
      return sum + t.amount;
    }, 0);

    const display = document.getElementById('balance-display');
    if (!display) return;

    // Expenses are displayed as negative spending
    const negativeTotal = Math.abs(total);
    display.textContent = total === 0 ? 'Rp 0.00' : formatCurrency(total);

    display.classList.toggle('balance-amount--negative', total < 0);
    display.classList.toggle('balance-amount--positive', total >== 0);
  }

  /**
   * Rebuilds the transaction list from state.
   */
  function renderTransactionList() {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    list.innerHTML = '';

    if (state.transactions.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state-item';
      li.innerHTML = '<p class="empty-state">No expenses recorded yet.</p>';
      list.appendChild(li);
      return;
    }

    // Sort descending by createdAt
    const sorted = state.transactions.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    sorted.forEach(function (t) {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.setAttribute('data-id', t.id);

      li.innerHTML =
        '<span class="item-name" title="' + escapeHtml(t.name) + '">' + escapeHtml(t.name) + '</span>' +
        '<span class="item-amount">' + formatCurrency(t.amount) + '</span>' +
        '<span class="item-category">' + escapeHtml(t.category) + '</span>' +
        '<button class="delete-btn" type="button" data-id="' + escapeHtml(t.id) + '" ' +
          'aria-label="Delete transaction: ' + escapeHtml(t.name) + '">✕</button>';

      list.appendChild(li);
    });
  }

  /**
   * Rebuilds the category <select> options, preserving current selection.
   */
  function renderCategorySelector() {
    const select = document.getElementById('item-category');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '';

    const allCategories = DEFAULT_CATEGORIES.concat(state.categories);
    allCategories.forEach(function (cat) {
      const option = document.createElement('option');
      option.value       = cat;
      option.textContent = cat;
      select.appendChild(option);
    });

    // Restore previous selection if still valid
    if (currentValue && allCategories.includes(currentValue)) {
      select.value = currentValue;
    }
  }

  /**
   * Renders or updates the Chart.js pie chart.
   */
  function renderChart() {
    const canvas    = document.getElementById('spending-chart');
    const emptyMsg  = document.getElementById('chart-empty-state');

    // Chart.js may have failed to load from CDN
    if (window.__chartJsFailed || typeof Chart === 'undefined') {
      return; // onerror handler in HTML already replaced canvas with message
    }

    if (!canvas) return;

    if (state.transactions.length === 0) {
      // Show empty state, destroy existing chart
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      canvas.style.display = 'none';
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }

    // Hide empty state, show canvas
    if (emptyMsg) emptyMsg.hidden = true;
    canvas.style.display = '';

    const chartData = buildChartData(state.transactions);

    if (chartInstance) {
      // Update existing chart in place
      chartInstance.data.labels                          = chartData.labels;
      chartInstance.data.datasets[0].data               = chartData.amounts;
      chartInstance.data.datasets[0].backgroundColor    = chartData.colors;
      chartInstance.data.datasets[0].borderColor        = chartData.colors;
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
          responsive:    true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color:     getComputedStyle(document.documentElement)
                              .getPropertyValue('--color-text-primary').trim() || '#1a1d23',
                font:      { size: 12 },
                boxWidth:  14,
                padding:   10,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const value = context.parsed;
                  return ' ' + context.label + ': ' + formatCurrency(value);
                },
              },
            },
          },
        },
      });
    }
  }

  /**
   * Renders the monthly summary list.
   */
  function renderMonthlySummary() {
    const list = document.getElementById('monthly-summary-list');
    if (!list) return;

    list.innerHTML = '';

    if (state.transactions.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state-item';
      li.innerHTML = '<p class="empty-state">No monthly data available.</p>';
      list.appendChild(li);
      return;
    }

    const months = groupByMonth(state.transactions);
    months.forEach(function (m) {
      const li = document.createElement('li');
      li.className = 'monthly-summary-item';
      li.innerHTML =
        '<span class="month-label">' + escapeHtml(m.label) + '</span>' +
        '<span class="month-total">' + formatCurrency(m.total) + '</span>';
      list.appendChild(li);
    });
  }

  /**
   * Synchronous, idempotent full re-render.
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

  /**
   * Escapes characters that have special meaning in HTML to prevent XSS.
   *
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  /**
   * Sets up all event listeners. Called once by init().
   */
  function attachEventListeners() {

    // --- Transaction form submit ---
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const nameInput     = document.getElementById('item-name');
        const amountInput   = document.getElementById('item-amount');
        const categoryInput = document.getElementById('item-category');

        const nameVal     = nameInput     ? nameInput.value     : '';
        const amountVal   = amountInput   ? amountInput.value   : '';
        const categoryVal = categoryInput ? categoryInput.value : '';

        const errors = validateTransaction(nameVal, amountVal, categoryVal);

        // Show / clear inline errors
        setFieldError('item-name-error',     errors.name);
        setFieldError('item-amount-error',   errors.amount);
        setFieldError('item-category-error', errors.category);

        if (errors.name || errors.amount || errors.category) return;

        const success = addTransaction(nameVal, parseFloat(amountVal), categoryVal);
        if (success) {
          txForm.reset();
          // Re-render selector after reset (reset clears to first option which is fine)
          renderCategorySelector();
          // Clear any lingering error spans
          setFieldError('item-name-error',     null);
          setFieldError('item-amount-error',   null);
          setFieldError('item-category-error', null);
        }
      });
    }

    // --- Transaction list delete (event delegation) ---
    const txList = document.getElementById('transaction-list');
    if (txList) {
      txList.addEventListener('click', function (e) {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (id) deleteTransaction(id);
      });
    }

    // --- Category form submit ---
    const catForm = document.getElementById('category-form');
    if (catForm) {
      catForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const catInput = document.getElementById('custom-category');
        const catVal   = catInput ? catInput.value : '';
        const error    = validateCategory(catVal, state.categories);

        setFieldError('category-error', error);

        if (error) return;

        const success = addCategory(catVal);
        if (success) {
          catForm.reset();
          setFieldError('category-error', null);
        }
      });
    }

    // --- Theme toggle ---
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);

        // Re-create chart with updated legend colors
        if (chartInstance) {
          chartInstance.destroy();
          chartInstance = null;
        }
        renderChart();
      });
    }

    // --- Tab navigation ---
    const dashboardTab = document.getElementById('tab-dashboard');
    const monthlyTab   = document.getElementById('tab-monthly');
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

    // --- Storage warning dismiss ---
    const closeBtn = document.getElementById('storage-warning-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        const banner = document.getElementById('storage-warning');
        if (banner) banner.hidden = true;
      });
    }
  }

  /**
   * Activates a tab button and its associated panel.
   * @param {HTMLElement} tab
   * @param {HTMLElement} panel
   */
  function activateTab(tab, panel) {
    if (tab) {
      tab.setAttribute('aria-selected', 'true');
      tab.classList.add('tab-btn--active');
    }
    if (panel) panel.hidden = false;
  }

  /**
   * Deactivates a tab button and hides its panel.
   * @param {HTMLElement} tab
   * @param {HTMLElement} panel
   */
  function deactivateTab(tab, panel) {
    if (tab) {
      tab.setAttribute('aria-selected', 'false');
      tab.classList.remove('tab-btn--active');
    }
    if (panel) panel.hidden = true;
  }

  /**
   * Sets or clears an inline field error.
   * @param {string} spanId  id of the <span> error element.
   * @param {string|null} message  Error text, or null to clear.
   */
  function setFieldError(spanId, message) {
    const span = document.getElementById(spanId);
    if (!span) return;
    span.textContent = message || '';
  }

  // ============================================================
  // Init
  // ============================================================

  /**
   * Entry point. Called once on DOMContentLoaded.
   */
  function init() {
    // 1. Detect storage availability and load persisted state
    loadFromStorage();

    // 2. Apply theme before rendering (avoids flash of wrong theme)
    setTheme(state.theme);

    // 3. Wire all event listeners
    attachEventListeners();

    // 4. Initial full render
    renderAll();
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

})();
