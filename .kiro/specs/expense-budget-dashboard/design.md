# Design Document

## Overview

The Expense & Budget Visualizer Dashboard is a zero-dependency, static single-page application (SPA) delivered as three files: `index.html`, `css/style.css`, and `js/app.js`. All runtime state lives in JavaScript module-level variables; all persistence uses `window.localStorage`. The UI is divided into four visible regions — Header, Dashboard Panel (balance + chart), Transaction Panel (form + list), and the Monthly Summary view — plus a Theme Toggle anchored in the header. A tab/nav control switches the main content area between the Dashboard view and the Monthly Summary view.

Chart.js is loaded via CDN `<script>` tag and is the only external dependency. The application works when `index.html` is opened directly from the file system (`file://` protocol) without any local server.

Design goals:
- **No build step**: plain HTML/CSS/JS, no transpilation, no bundler.
- **Module pattern**: all JavaScript lives in an IIFE or ES module to avoid polluting the global scope.
- **Single source of truth**: one in-memory `transactions[]` array and one `categories[]` array drive every UI component. All renders are triggered by mutations to these arrays.
- **Accessibility**: semantic HTML, ARIA labels, keyboard-navigable controls, sufficient color contrast in both themes.

---

## Architecture

The application follows a unidirectional data-flow pattern without a framework:

```
User Action
    │
    ▼
Event Handler (js/app.js)
    │  mutates
    ▼
In-Memory State (transactions[], categories[], theme)
    │  persisted by
    ▼
LocalStorage
    │  read by
    ▼
Render Functions (renderAll)
    │  write to
    ▼
DOM
```

Every mutation follows this contract:

1. Validate input.
2. Update in-memory state.
3. Persist to `localStorage` (attempt; handle quota errors gracefully).
4. Call `renderAll()` which delegates to individual render functions.

`renderAll()` is intentionally synchronous and idempotent — calling it multiple times produces the same DOM state.

### Module Structure (js/app.js)

```
js/app.js
├── Constants & Config
├── State
│   ├── transactions: Transaction[]
│   ├── categories: string[]
│   └── theme: 'light' | 'dark'
├── Storage Layer
│   ├── loadFromStorage()
│   ├── saveTransactions()
│   ├── saveCategories()
│   └── saveTheme()
├── Validation
│   ├── validateTransaction(name, amount, category)
│   └── validateCategory(name, existingCategories)
├── State Mutations
│   ├── addTransaction(name, amount, category)
│   ├── deleteTransaction(id)
│   ├── addCategory(name)
│   └── setTheme(theme)
├── Render Functions
│   ├── renderAll()
│   ├── renderBalance()
│   ├── renderTransactionList()
│   ├── renderChart()
│   ├── renderMonthlySummary()
│   └── renderCategorySelector()
└── Initialisation
    └── init()
```

---

## Components and Interfaces

### 1. Header

- Contains: app title, Theme_Toggle button, tab navigation (Dashboard / Monthly Summary).
- The Theme_Toggle is a `<button>` with `aria-pressed` reflecting the active theme.
- Tab navigation uses `role="tablist"` / `role="tab"` / `aria-selected` pattern.

### 2. Balance Display

- A `<section>` with a large `<p>` or `<output>` element showing the formatted total.
- Updated by `renderBalance()` which reads `transactions` from state.
- Format: `[−]$X,XXX.XX` (currency symbol, two decimal places, minus prefix when negative).

### 3. Input Form (Transaction)

```
<form id="transaction-form">
  <input  id="item-name"   type="text"   maxlength="100">
  <input  id="item-amount" type="number" min="0.01" max="999999999.99" step="0.01">
  <select id="item-category">   <!-- populated by renderCategorySelector() -->
  <button type="submit">Add Expense</button>
</form>
```

- Inline error `<span>` elements sit adjacent to each field, toggled via `aria-live="polite"`.
- On successful submission: form fields are reset; `renderAll()` is called.

### 4. Transaction List

```
<ul id="transaction-list" role="list">
  <li data-id="{id}" class="transaction-item">
    <span class="item-name">...</span>
    <span class="item-amount">$X.XX</span>
    <span class="item-category">...</span>
    <button class="delete-btn" aria-label="Delete {name}">✕</button>
  </li>
  ...
</ul>
```

- Rendered entirely by `renderTransactionList()` — the list is cleared and rebuilt on every call.
- Sorted descending by `createdAt` timestamp.
- Empty state: replaces `<ul>` content with a `<p class="empty-state">` message.

### 5. Spending Chart (Pie)

- A `<canvas id="spending-chart">` element managed exclusively by Chart.js.
- `renderChart()` checks if a Chart.js instance already exists on the canvas. If yes, it updates `.data` and calls `.update()`. If no, it creates a new `Chart` instance.
- Chart type: `'pie'`.
- Up to 9 named categories get individual colors; a 10th "Other" slice aggregates the rest.
- Empty state: destroys any existing chart instance and shows a sibling `<p class="chart-empty-state">`.

### 6. Category Manager

```
<form id="category-form">
  <input  id="custom-category" type="text" maxlength="50">
  <button type="submit">Add Category</button>
  <span   id="category-error" aria-live="polite"></span>
</form>
```

- On success: new category added to `categories[]`, persisted, `renderCategorySelector()` called.
- Duplicate detection is case-insensitive (`name.trim().toLowerCase()`).

### 7. Monthly Summary View

- Hidden by default; shown when the "Monthly Summary" tab is active.
- `renderMonthlySummary()` groups `transactions` by `YYYY-MM` key, sorts descending, and renders:

```
<ul id="monthly-summary-list">
  <li>
    <span class="month-label">January 2025</span>
    <span class="month-total">$1,234.56</span>
  </li>
  ...
</ul>
```

- Empty state: `<p class="empty-state">` message.

### 8. Theme Toggle

- Toggles a `data-theme="dark"` attribute on `<html>` element.
- CSS variables defined under `:root` (light) and `[data-theme="dark"]` (dark) govern all colors.
- The toggle button label/icon updates to reflect the current mode.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id          - Unique identifier (crypto.randomUUID() or Date.now() fallback)
 * @property {string} name        - Item name, 1–100 characters
 * @property {number} amount      - Positive decimal, 0.01–999999999.99
 * @property {string} category    - Category label string
 * @property {number} createdAt   - Unix timestamp (ms) from Date.now() at creation time
 */
```

### LocalStorage Keys

| Key | Type | Description |
|---|---|---|
| `ebd_transactions` | `JSON string` | Serialized `Transaction[]` array |
| `ebd_categories` | `JSON string` | Serialized `string[]` of custom category names |
| `ebd_theme` | `'light' \| 'dark'` | Active theme preference |

### State Object (in-memory)

```js
const state = {
  transactions: [],   // Transaction[]
  categories: [],     // string[] — custom categories only; defaults are hardcoded constants
  theme: 'light',     // 'light' | 'dark'
  storageAvailable: true,  // false when localStorage is unavailable
};
```

### Default Categories (constant, not stored)

```js
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
```

Custom categories from `state.categories` are appended after defaults in the selector.

### Chart Color Palette (constant)

```js
const CHART_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#C9CBCF', '#7BC8A4',
  '#E7E9ED', '#FF6384', // 10th slot reserved for "Other"
];
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction addition grows the list by exactly one

*For any* existing transaction list and any valid transaction input (non-empty name ≤ 100 chars, amount between 0.01 and 999999999.99, non-empty category), adding the transaction SHALL result in the transaction list length increasing by exactly one, and the new transaction SHALL appear as the first element (index 0) when the list is sorted by `createdAt` descending.

**Validates: Requirements 1.3, 2.5**

### Property 2: Invalid transaction inputs are rejected without mutating state

*For any* transaction list and any invalid transaction input — where the name is empty or whitespace-only, the amount is zero, negative, non-numeric, or outside the range 0.01–999999999.99, or the category is empty — the resulting transaction list SHALL be identical (same length, same entries) to the list before the submission attempt.

**Validates: Requirements 1.4, 1.5**

### Property 3: Delete removes exactly the targeted transaction

*For any* non-empty transaction list, deleting a transaction by its `id` SHALL produce a list whose length is exactly one less than the original, that does not contain any transaction with the deleted `id`, and that contains every other transaction from the original list unchanged.

**Validates: Requirements 2.3**

### Property 4: Balance equals the sum of all transaction amounts

*For any* transaction list (including the empty list), the computed total balance SHALL equal the arithmetic sum of all `amount` fields across all transactions, formatted to exactly two decimal places with a currency symbol prefix and a minus sign prefix when the sum is negative.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

### Property 5: Serialization round-trip preserves all data

*For any* list of valid transactions and any list of custom category strings, serializing them to JSON and deserializing back SHALL produce structures that are deeply equal to the originals (same `id`, `name`, `amount`, `category`, `createdAt` for every transaction; same string values and order for categories).

**Validates: Requirements 5.1, 5.2, 5.3, 6.4, 6.5**

### Property 6: Custom category validation is case-insensitively deduplicated and rejects whitespace

*For any* existing category list, submitting a candidate name that is empty, composed entirely of whitespace, or matches any existing category name (case-insensitive after trimming) SHALL leave the category list unchanged; submitting a non-empty, non-duplicate name (1–50 characters) SHALL append exactly one new entry, regardless of the original casing.

**Validates: Requirements 6.2, 6.3**

### Property 7: Monthly summary totals are consistent with the transaction list

*For any* transaction list, the sum of all per-month totals in the Monthly Summary SHALL equal the sum of all transaction amounts, and each individual monthly total SHALL equal the sum of `amount` fields for every transaction whose `createdAt` falls within that calendar month.

**Validates: Requirements 7.1, 7.2**

### Property 8: Chart data aggregation is complete and proportional

*For any* non-empty transaction list, the sum of all pie-chart slice values SHALL equal the total of all transaction amounts, each named-category slice value SHALL equal the sum of `amount` fields for transactions belonging to that category, and when more than 9 distinct categories are present the remaining categories SHALL be aggregated into a single "Other" slice whose value equals the sum of all amounts not in the top 9 categories.

**Validates: Requirements 4.1, 4.5, 4.6**

---

## Error Handling

### LocalStorage Unavailability

Detected at startup in `loadFromStorage()` by attempting a test `setItem`/`removeItem`. If it throws, `state.storageAvailable = false` is set and a persistent warning banner is displayed. All subsequent write calls are no-ops when `storageAvailable` is `false`.

### LocalStorage Parse Failure

If `JSON.parse` throws on the stored transactions or categories value, the error is caught, `state.transactions` and `state.categories` default to empty arrays, and a warning banner is shown.

### LocalStorage Quota Exceeded

Write calls (`saveTransactions`, `saveCategories`, `saveTheme`) are wrapped in `try/catch`. If a `QuotaExceededError` is thrown, the in-memory state is already updated (mutation happened before the write attempt), so the UI reflects the change; a non-blocking toast notification informs the user that the change was not persisted.

### Chart.js CDN Failure

If the Chart.js `<script>` tag fails to load (network unavailable), a `window.onerror` / `<script onerror>` handler replaces the chart canvas with an error message: "Chart unavailable — could not load Chart.js."

### Form Validation Errors

Inline error `<span>` elements are shown adjacent to invalid fields. They are cleared on the next valid submission or when the field value changes. Errors use `aria-live="polite"` so screen readers announce them.

---

## Testing Strategy

### Unit Tests (example-based)

Target pure functions that can be tested in isolation:

- `validateTransaction(name, amount, category)` — specific valid and invalid inputs.
- `validateCategory(name, existingCategories)` — empty, duplicate (various cases), valid.
- `formatCurrency(amount)` — specific values including 0, negatives, large numbers.
- `groupByMonth(transactions)` — specific transaction arrays producing known month groups.
- `buildChartData(transactions, categories)` — verifies correct slice values and "Other" aggregation.
- `loadFromStorage()` — with mocked `localStorage` returning valid JSON, invalid JSON, and throwing.

### Property-Based Tests

The property-based testing library to use is **[fast-check](https://fast-check.dev/)** (the standard choice for JavaScript). Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment referencing the design property:
> `// Feature: expense-budget-dashboard, Property {N}: {property_text}`

**Property 1 — Valid transaction addition grows list by one**
Generate: arbitrary `transactions[]`, arbitrary valid `(name, amount, category)`.
Assert: result list length is `transactions.length + 1` and the new item is at index 0 after sort.
`// Feature: expense-budget-dashboard, Property 1: Valid transaction addition grows the list by exactly one`

**Property 2 — Invalid transaction inputs are rejected without mutating state**
Generate: arbitrary `transactions[]`, arbitrary invalid `(name, amount, category)` tuples (at least one field failing validation).
Assert: result state deep-equals the original state.
`// Feature: expense-budget-dashboard, Property 2: Invalid transaction inputs are rejected without mutating state`

**Property 3 — Delete removes exactly the targeted transaction**
Generate: non-empty `transactions[]`, pick a random `id` from the array.
Assert: result has `length - 1` entries, does not contain the deleted `id`, and all other entries are present unchanged.
`// Feature: expense-budget-dashboard, Property 3: Delete removes exactly the targeted transaction`

**Property 4 — Balance equals sum of all transaction amounts**
Generate: arbitrary `transactions[]` (including empty list).
Assert: `computeBalance(transactions) === transactions.reduce((s, t) => s + t.amount, 0)` (within floating-point tolerance), formatted to 2 decimal places with correct prefix.
`// Feature: expense-budget-dashboard, Property 4: Balance equals the sum of all transaction amounts`

**Property 5 — Serialization round-trip preserves all data**
Generate: arbitrary `Transaction[]` and `string[]` categories.
Assert: `deserialize(serialize(txns))` deep-equals `txns`; `deserializeCategories(serializeCategories(cats))` deep-equals `cats`.
`// Feature: expense-budget-dashboard, Property 5: Serialization round-trip preserves all data`

**Property 6 — Custom category validation is case-insensitively deduplicated and rejects whitespace**
Generate: arbitrary `categories[]`, candidate names that are either empty, whitespace-only, or case-insensitive duplicates of existing entries; and separate candidates that are valid new names.
Assert: invalid candidates leave categories unchanged; valid candidates append exactly one new entry.
`// Feature: expense-budget-dashboard, Property 6: Custom category validation is case-insensitively deduplicated and rejects whitespace`

**Property 7 — Monthly summary totals are consistent with the transaction list**
Generate: arbitrary `transactions[]`.
Assert: `sum(groupByMonth(transactions).map(m => m.total)) === sum(transactions.map(t => t.amount))` (within floating-point tolerance); each month's total matches the sum of that month's transactions.
`// Feature: expense-budget-dashboard, Property 7: Monthly summary totals are consistent with the transaction list`

**Property 8 — Chart data aggregation is complete and proportional**
Generate: non-empty `transactions[]` (including cases with > 9 distinct categories).
Assert: `sum(buildChartData(txns).values) === sum(txns.map(t => t.amount))`; each named slice value matches its category sum; when categories > 9, an "Other" slice aggregates the remainder.
`// Feature: expense-budget-dashboard, Property 8: Chart data aggregation is complete and proportional`

### Integration / Smoke Tests

- Open `index.html` in a headless browser (Playwright or manual): verify no console errors, all sections render, Chart.js loads from CDN.
- Add a transaction, reload page, verify it reappears (LocalStorage round-trip end-to-end).
- Delete a transaction, reload, verify it is gone.
- Toggle theme, reload, verify stored theme is applied before paint.
- Add a custom category, reload, verify it is present in the selector.
