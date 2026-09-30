# VALIDATE.md

Code review and pre-deployment validation checklist.
Complete every section before merging to `main` and triggering a build.

---

## 01 Code correctness

### app.js
- [ ] Every `save()` call is paired with an update to the in-memory array before it (never save stale data).
- [ ] Every `render*()` function reads from the current in-memory array, not a stale snapshot.
- [ ] `saveTransaction()` reduces product stock after saving the transaction — confirm the order is: save txn → update stock → save stock.
- [ ] `savePurchase()` increases product stock after saving the purchase — same order check.
- [ ] `markLedgerPaid()` syncs the matching transaction to `paid` using `txnId` — confirm the link is not broken if a transaction was deleted.
- [ ] `calcTotal()` and `calcPurTotal()` produce correct results for multi-item rows (qty × rate summed).
- [ ] Pagination in `renderTransactions()` does not go out of bounds when the last page has fewer than `TXN_PAGE_SIZE` records.
- [ ] `downloadTransactions()` exports all filtered records, not just the current page.

### main.js
- [ ] `createWindow()` sets `minWidth` and `minHeight` so the layout never breaks.
- [ ] `httpsGet()` follows redirects correctly and does not loop infinitely.
- [ ] Auto-update `checkForUpdate()` handles the case where the GitHub API returns a non-JSON response (network error, rate limit).
- [ ] `app.on('window-all-closed')` calls `app.quit()` on non-macOS platforms.

### index.html
- [ ] Every modal has a corresponding `closeModal()` call on the Cancel button and on overlay click.
- [ ] Every form field referenced in `app.js` by `getElementById` exists in `index.html` with the exact same id.
- [ ] No inline `style` attributes use hardcoded hex values that conflict with `DESIGN_SYSTEM.md` tokens.

### style.css
- [ ] All color values match the tokens defined in `docs/DESIGN_SYSTEM.md`.
- [ ] `.hidden { display: none !important; }` is present and used consistently — no visibility toggling done via inline styles in `app.js`.
- [ ] Responsive rule at `max-width: 768px` does not break the sidebar or content layout.

---

## 02 Data integrity

- [ ] Adding a product and immediately checking `inv_products` in localStorage shows the correct record.
- [ ] Recording a purchase increases the product's `stock` field by the exact quantity purchased.
- [ ] Recording a sale decreases the product's `stock` field by the exact quantity sold. Stock never goes below 0.
- [ ] An unpaid sale with a customer creates exactly one `ledgerEntry` in `inv_ledger`.
- [ ] Marking a ledger entry paid sets `paidStatus: 'paid'` on both the ledger entry and the matching transaction.
- [ ] Deleting a transaction also removes its linked ledger entry (matched by `txnId`).
- [ ] Dashboard stats (Today's Revenue, Total Revenue, Total Unpaid, Low Stock count) match manual counts from the data tables.

**How to spot-check in DevTools (F12 → Console):**
```js
JSON.parse(localStorage.getItem('inv_products'))   // check stock values
JSON.parse(localStorage.getItem('inv_ledger'))     // check paidStatus
JSON.parse(localStorage.getItem('inv_transactions')) // check totals
```

---

## 03 UI completeness

- [ ] Every page renders an empty-state message when there is no data (not a blank panel).
- [ ] Low-stock rows are highlighted in amber on both the Dashboard and the Inventory page.
- [ ] Paid badge is green, Unpaid badge is red — consistent across Customers, Sales, and Ledger.
- [ ] Toast messages appear for every save, update, delete, and error action.
- [ ] Modals close on Cancel button click and on overlay click.
- [ ] All buttons have visible hover states.
- [ ] The sidebar active item is highlighted with the left border accent.

---

## 04 Edge cases

- [ ] Recording a sale with zero items shows an error toast and does not save.
- [ ] Recording a purchase with zero items shows an error toast and does not save.
- [ ] Adding a customer with a non-10-digit phone shows a validation error.
- [ ] Adding a product with no name or invalid price shows a validation error.
- [ ] Restocking with quantity 0 or blank shows a validation error.
- [ ] Deleting a product that has been sold does not crash the Sales or Dashboard page (the product name is stored on the transaction, not looked up live).
- [ ] Custom date filter with From > To date range returns zero results gracefully (no crash).
- [ ] Downloading CSV with zero filtered transactions shows an error toast and does not download an empty file.

---

## 05 Performance

- [ ] Opening the app with 500+ products does not cause visible lag on the Inventory page.
- [ ] Opening the Sales page with 1000+ transactions renders within 1 second (pagination limits DOM nodes to 15 per page).
- [ ] No `render*()` function is called more times than necessary on a single user action.

---

## 06 Pre-build checklist

Run these in order before pushing to `main`:

```
# 1. Check for leftover debug code
grep -n "console.log\|debugger\|TODO\|FIXME" app.js main.js

# 2. Verify no secrets
grep -rn "password\|token\|secret" --include="*.js" --include="*.json" .

# 3. Confirm package.json version and appId are correct
cat package.json | grep -E "name|version|appId|productName"

# 4. Confirm build files list excludes dev artifacts
cat package.json | grep -A 10 '"files"'
```

- [ ] Zero `console.log` / `debugger` statements in `app.js` and `main.js`.
- [ ] `package.json` `appId` is `com.inventorymanager.app`.
- [ ] `package.json` `productName` is `Inventory Manager`.
- [ ] `build.files` excludes `.git/`.

---

## 07 Post-install smoke test (on a clean machine)

After installing the `.exe` on a machine that has never had the app:

| Step | Expected result | Pass? |
| --- | --- | --- |
| Launch app | Window opens, Dashboard shows zeros, no errors | |
| Add a product | Appears in Inventory table, stock shown | |
| Record a purchase | Stock increases, appears in Purchases table | |
| Record a paid sale | Stock decreases, appears in Sales, revenue updates on Dashboard | |
| Record an unpaid sale for a customer | Ledger entry created, customer shows red unpaid badge | |
| Mark ledger entry paid | Badge turns green, transaction status updates | |
| Close and reopen app | All data persists | |
| Settings — save shop name | Sidebar name updates immediately | |
| Check for Update button | Shows "latest version" or triggers download | |

All rows must pass before the build is distributed.
