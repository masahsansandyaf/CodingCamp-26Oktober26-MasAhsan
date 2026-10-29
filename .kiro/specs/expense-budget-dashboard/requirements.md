# Requirements Document

## Introduction

The Expense & Budget Visualizer Dashboard is a static, single-page web application that allows users to track personal expenses, visualize spending distribution by category, and monitor their total balance — all without a backend server. Data is persisted entirely in the browser using the Local Storage API. The interface is clean, responsive, and supports both dark and light display modes.

The application is built with HTML, CSS, and Vanilla JavaScript only. No build tools, no frameworks, and no server setup are required.

## Glossary

- **Dashboard**: The single-page application that displays the balance summary, input form, transaction list, and spending chart.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom label).
- **Balance**: The running total derived by summing all transaction amounts. Displayed as a negative value representing cumulative spending.
- **Transaction_List**: The scrollable UI component that renders all stored transactions.
- **Input_Form**: The UI form component used to create a new transaction.
- **Chart**: The pie chart component that visualizes spending distribution by category.
- **Local_Storage**: The browser-native key-value storage API used to persist transaction data client-side.
- **Category_Manager**: The UI component that allows users to add and manage custom categories.
- **Monthly_Summary**: The UI view that groups and totals transactions by calendar month.
- **Theme_Toggle**: The UI control that switches the Dashboard between dark mode and light mode.

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name accepting up to 100 characters, a numeric field for the amount accepting decimal values between 0.01 and 999999999.99, and a category selector.
2. THE Input_Form SHALL pre-populate the category selector with the options: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form with all fields filled and a positive numeric amount, THE Dashboard SHALL add the transaction to the Transaction_List and persist it to Local_Storage.
4. IF the user submits the Input_Form with one or more empty fields, THEN THE Input_Form SHALL display an inline validation error message for each empty field and SHALL NOT create a transaction.
5. IF the user submits the Input_Form with a non-positive or non-numeric value in the amount field, THEN THE Input_Form SHALL display an inline validation error message on the amount field and SHALL NOT create a transaction.
6. WHEN a transaction is successfully added, THE Input_Form SHALL reset the item name and amount fields to empty and reset the category selector to its first option.

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted transactions, each showing the item name, amount formatted as a currency value with a currency symbol and exactly 2 decimal places, and category.
2. THE Transaction_List SHALL be scrollable when the number of transactions causes the list content to exceed the visible height of the list container.
3. WHEN a user clicks the delete control on a transaction entry, THE Dashboard SHALL immediately remove that transaction from the Transaction_List and synchronously update Local_Storage to reflect the deletion, without requiring a confirmation step.
4. WHEN no transactions exist, THE Transaction_List SHALL display an empty-state message indicating no expenses have been recorded.
5. THE Transaction_List SHALL render transactions ordered by creation timestamp in descending order, with the most recently created transaction appearing at the top.

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending displayed prominently so that I can understand my overall expense at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total balance as the sum of all transaction amounts in a dedicated header section positioned above the transaction list.
2. WHEN a transaction is added, THE Dashboard SHALL recalculate and update the displayed total balance immediately within the current view.
3. WHEN a transaction is deleted, THE Dashboard SHALL recalculate and update the displayed total balance immediately within the current view.
4. WHEN no transactions exist, THE Dashboard SHALL display a total balance of 0.00.
5. THE Dashboard SHALL display the total balance formatted with a currency symbol and exactly 2 decimal places.
6. IF the total balance is negative, THEN THE Dashboard SHALL display a minus sign prefix alongside the currency symbol to indicate net spending exceeds net income.

### Requirement 4: Spending Chart

**User Story:** As a user, I want a pie chart showing my spending by category so that I can see where my money goes visually.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each slice represents the sum of expense transactions sharing the same category name, with each slice's arc proportional to that category's share of total expenses.
2. WHEN a transaction is added or deleted, THE Chart SHALL update the category totals and re-render within the same render cycle, without requiring a page reload.
3. WHEN only one category has transactions, THE Chart SHALL render a full single-slice pie chart for that category.
4. WHEN no expense transactions exist, THE Chart SHALL display an empty-state message indicating that no spending data is available, instead of rendering a blank canvas.
5. THE Chart SHALL assign a distinct color to each category slice for up to 10 categories, and SHALL include a legend mapping each color to its category name.
6. IF the number of expense categories exceeds 10, THEN THE Chart SHALL group all categories beyond the first 9 into a single "Other" slice with its own distinct color.

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my data when I close and reopen the tab.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL read all previously stored transactions from Local_Storage and render them in the Transaction_List, balance display, and Chart.
2. WHEN a transaction is added, THE Dashboard SHALL write the updated transaction list to Local_Storage before updating the UI.
3. WHEN a transaction is deleted, THE Dashboard SHALL write the updated transaction list to Local_Storage before updating the UI.
4. IF Local_Storage is unavailable, reading fails, or the stored data cannot be parsed as a valid transaction list, THEN THE Dashboard SHALL display a warning message indicating that saved data could not be loaded and SHALL operate in session-only mode, where all add and delete operations apply only to the current session without writing to Local_Storage.
5. IF a Local_Storage write operation fails during a transaction add or delete (such as when storage quota is exceeded), THEN THE Dashboard SHALL still update the UI with the in-memory transaction list and SHALL display a warning message indicating that the change was not persisted.

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own spending categories so that I can organize expenses beyond the default options.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide an input field accepting up to 50 characters and a submit control that allows users to add a custom category name.
2. WHEN the user submits a category name of 1–50 characters that does not match any existing category name (case-insensitive), THE Category_Manager SHALL add the new category to the category selector in the Input_Form.
3. WHEN the user submits an empty category name or a name that matches an existing category name (case-insensitive), THE Category_Manager SHALL display an inline validation error indicating whether the name is empty or already exists, and SHALL NOT add the category.
4. WHEN the user successfully adds a custom category, THE Dashboard SHALL persist all custom categories to Local_Storage.
5. WHEN the Dashboard loads, THE Dashboard SHALL restore all previously saved custom categories into the category selector.
6. IF Local_Storage is unavailable when persisting or restoring custom categories, THEN THE Dashboard SHALL display an error message indicating that custom categories cannot be saved and will not persist across page reloads.

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my expenses grouped by month so that I can track my spending trends over time.

#### Acceptance Criteria

1. THE Monthly_Summary SHALL display a list of calendar months for which at least one expense transaction exists, ordered from most recent to oldest, each showing the month label in "Month YYYY" format (e.g., "January 2025") and the total amount of expense transactions in that month rounded to two decimal places.
2. WHEN a transaction is added or deleted, THE Monthly_Summary SHALL reflect the updated monthly totals within 2 seconds of the event, without the user navigating away from or reloading the page.
3. THE Monthly_Summary SHALL be accessible from the Dashboard via a dedicated navigation control or tab.
4. WHEN no expense transactions exist, THE Monthly_Summary SHALL display an empty-state message indicating no monthly data is available.

### Requirement 8: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light display modes so that I can use the Dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme_Toggle SHALL be persistently visible in the top navigation area of the Dashboard.
2. WHEN the user activates the Theme_Toggle, THE Dashboard SHALL switch the active theme between dark mode and light mode.
3. WHEN the user activates the Theme_Toggle, THE Dashboard SHALL apply the selected theme to all UI components within 300 milliseconds without a page reload.
4. WHEN the user activates the Theme_Toggle, THE Dashboard SHALL save the selected theme value to Local_Storage under a designated theme preference key.
5. WHEN the Dashboard loads and a theme preference exists in Local_Storage, THE Dashboard SHALL apply that stored theme before rendering any UI components.
6. WHEN the Dashboard loads with no theme preference in Local_Storage and the browser supports the `prefers-color-scheme` media query, THE Dashboard SHALL apply the theme matching the operating system preference.
7. IF the Dashboard loads with no theme preference in Local_Storage and the browser does not support the `prefers-color-scheme` media query, THEN THE Dashboard SHALL apply light mode as the default theme.

### Requirement 9: Responsive Layout

**User Story:** As a user, I want the Dashboard to display correctly on both desktop and mobile screen sizes so that I can use it on any device.

#### Acceptance Criteria

1. THE Dashboard SHALL adapt its layout to viewport widths from 320px to 1920px without horizontal scrolling or content overflow.
2. WHEN the viewport width is below 768px, THE Dashboard SHALL stack all major UI sections vertically in a single-column layout.
3. WHEN the viewport width is 768px or above, THE Dashboard SHALL use a layout with at least 2 columns to make efficient use of available space.
4. THE Dashboard layout SHALL be implemented using relative units (rem, %, vw) and CSS media queries, with no fixed pixel widths applied to major layout containers.

### Requirement 10: Static Delivery and File Structure

**User Story:** As a developer, I want the application to be delivered as a static set of files with a clear folder structure so that it can be hosted anywhere without a build step.

#### Acceptance Criteria

1. THE Dashboard SHALL be delivered as a single `index.html` file at the project root that references exactly one CSS file located in a `css/` subdirectory.
2. THE Dashboard SHALL reference exactly one JavaScript file located in a `js/` subdirectory.
3. WHEN a user opens `index.html` directly in a modern browser (Chrome, Firefox, Edge, Safari) without a local server, THE Dashboard SHALL fully render all UI sections, resolve all referenced assets, display chart and transaction data, and produce no console errors.
4. THE Dashboard SHALL use Chart.js loaded via a CDN `<script>` tag and SHALL NOT require any local package installation.
