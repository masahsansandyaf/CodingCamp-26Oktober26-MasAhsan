# Implementation Plan: Expense & Budget Visualizer Dashboard

## Overview

Implement a zero-dependency static single-page application delivered as three files (`index.html`, `css/style.css`, `js/app.js`). The implementation follows a unidirectional data-flow pattern: every user action mutates in-memory state, persists to `localStorage`, and triggers a synchronous `renderAll()` call. Chart.js is loaded via CDN.

## Tasks

- [x] 1. Scaffold project structure, HTML skeleton, state, and storage layer
  - Create `index.html` at the project root with the full semantic HTML structure: header (app title, Theme_Toggle button, tab nav), main area containing the Dashboard view (balance section, chart canvas, transaction form, category manager, transaction list) and the Monthly Summary view (hidden by default)
  - Create `css/style.css` in a `css/` subdirectory with CSS custom property variables for both light and dark themes under `:root` and `[data-theme="dark"]`, base resets, and placeholder rules for all major layout regions
  - Create `js/app.js` in a `js/` subdirectory as a self-invoking ES module wrapper (IIFE) containing `Constants & Config`, an empty `state` object, and a stubbed `init()` call at the bottom
  - Add the Chart.js CDN `<script>` tag and an `<script onerror>` handler stub in `index.html`
  - Wire `<link>` and `<script>` tags so all three files are referenced from `index.html`
  - Declare `DEFAULT_CATEGORIES`, `CHART_COLORS`, `STORAGE_KEYS` constants
  - Define the `state` object with `transactions`, `categories`, `theme`, and `storageAvailable` fields matching the design data model
  - Write `isStorageAvailable()` using a test `setItem`/`removeItem` probe
  - Write `loadFromStorage()` — reads and `JSON.parse`s `ebd_transactions`, `ebd_categories`, and `ebd_theme`; handles `JSON.parse` failures and missing keys gracefully; sets `state.storageAvailable`
  - Write `saveTransactions()`, `saveCategories()`, and `saveTheme()` — each wraps its `localStorage.setItem` in a `try/catch` for `QuotaExceededError`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 6.5, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4_

- [x] 2. Implement validation, state mutations, and render functions
  - Implement `validateTransaction(name, amount, category)` — returns an object with per-field error messages; name must be non-empty ≤ 100 chars, amount must be numeric between 0.01 and 999999999.99, category must be non-empty
  - Implement `validateCategory(name, existingCategories)` — returns an error message or `null`; rejects empty/whitespace-only names and case-insensitive duplicates against the combined default + custom list
  - Implement `addTransaction(name, amount, category)` — validates inputs; on success creates a `Transaction` object with `crypto.randomUUID()` (or `Date.now()` fallback) and current `Date.now()` timestamp; prepends to `state.transactions`; calls `saveTransactions()`; calls `renderAll()`
  - Implement `deleteTransaction(id)` — filters `state.transactions` to remove the entry matching `id`; calls `saveTransactions()`; calls `renderAll()`
  - Implement `addCategory(name)` — validates, appends to `state.categories`, calls `saveCategories()`, calls `renderCategorySelector()`
  - Implement `setTheme(theme)` — updates `state.theme`, sets `data-theme` on `<html>`, calls `saveTheme()`, updates toggle button `aria-pressed` and label
  - Implement `renderBalance()` — computes sum of all `state.transactions[].amount`; formats as `[−]$X,XXX.XX`; writes to the balance display element
  - Implement `renderTransactionList()` — clears and rebuilds `<ul id="transaction-list">` from `state.transactions` sorted by `createdAt` descending; each `<li>` shows name, formatted amount, category, and a delete button with `aria-label`; renders empty-state `<p>` when list is empty
  - Implement `renderCategorySelector()` — rebuilds `<select id="item-category">` options from `DEFAULT_CATEGORIES` concatenated with `state.categories`; preserves current selection when possible
  - Implement `renderChart()` — calls `buildChartData(state.transactions)` to compute per-category sums and "Other" aggregation; if a Chart.js instance exists on the canvas, updates `.data` and calls `.update()`; otherwise creates a new `Chart` instance of type `'pie'` with the color palette and legend; renders empty-state message and destroys any existing instance when `state.transactions` is empty
  - Implement `renderMonthlySummary()` — calls `groupByMonth(state.transactions)` to group by `YYYY-MM` key; sorts descending; renders `<ul id="monthly-summary-list">` with month label in "Month YYYY" format and total formatted to 2 decimal places; renders empty-state `<p>` when list is empty
  - Implement `renderAll()` — calls `renderBalance()`, `renderTransactionList()`, `renderChart()`, `renderMonthlySummary()`, and `renderCategorySelector()` in sequence; function is synchronous and idempotent
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.2, 6.3, 6.4, 7.1, 7.4, 8.2, 8.3, 8.4_

- [x] 3. Wire event handlers, init, and error UI
  - Attach a `submit` listener on `#transaction-form`; call `validateTransaction()`; display inline errors via adjacent `<span aria-live="polite">` elements on failure; call `addTransaction()` and reset form fields on success
  - Use event delegation on `#transaction-list` for delete; read `data-id` from the clicked `<li>`; call `deleteTransaction(id)`
  - Attach a `submit` listener on `#category-form`; call `validateCategory()`; display inline error via `#category-error` on failure; call `addCategory()` on success
  - Attach a `click` listener on the Theme_Toggle button; toggle between `'light'` and `'dark'`; call `setTheme()`; update `aria-pressed` and visible label/icon
  - Attach `click` listeners on the tab buttons; toggle visibility of the two view containers; update `aria-selected` on tabs; tab nav uses `role="tablist"` / `role="tab"` pattern
  - Add `onerror` attribute or `window.addEventListener('error', ...)` on the Chart.js `<script>` tag; on failure replace the chart canvas with an error message `<p>`: "Chart unavailable — could not load Chart.js."
  - Implement `init()` — call `isStorageAvailable()`; call `loadFromStorage()` which populates `state`; apply stored or OS-default theme via `setTheme()` before any render; call `renderAll()`
  - Add a persistent warning `<div id="storage-warning">` banner (hidden by default) shown when `state.storageAvailable` is `false` or when `loadFromStorage()` catches a parse error
  - Add a non-blocking toast element that appears briefly after a `QuotaExceededError` write failure
  - Add a persistent error message for the custom categories LocalStorage failure path
  - Add `document.addEventListener('DOMContentLoaded', init)` as the last statement in the IIFE
  - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.3, 5.1, 5.4, 5.5, 6.1, 6.2, 6.3, 6.5, 6.6, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 10.3_

- [x] 4. Implement responsive CSS layout, theming, and final styling
  - Define all color, background, and border tokens under `:root` (light theme) and `[data-theme="dark"]` (dark theme); ensure all UI components consume these variables exclusively for color
  - Use relative units (`rem`, `%`, `vw`) and CSS Grid or Flexbox for all major layout containers; write `@media` queries so that viewports below 768 px use a single-column stacked layout and viewports ≥ 768 px use a ≥ 2-column layout; verify no horizontal overflow from 320 px to 1920 px
  - Apply styles for header, balance display, transaction form, transaction list (scrollable container), chart canvas, category manager, monthly summary list, theme toggle, tab navigation, empty states, inline error messages, warning banner, and toast notification; ensure sufficient color contrast in both themes
  - _Requirements: 2.2, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4_

## Notes

- Each task references specific requirements for traceability
- The application must open directly from the file system (`file://`) with no local server

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4"] }
  ]
}
```
