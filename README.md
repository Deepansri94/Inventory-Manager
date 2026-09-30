# Inventory Manager

A desktop app for small retail shop owners to manage inventory, record purchases, track revenue, and note unpaid customer balances — replacing manual written ledgers.

Built with Electron + Vanilla JS. All data stored locally in `localStorage`. No internet connection required except for auto-updates.

---

## Features

- **Inventory Management** — Add products with stock quantities; low-stock items highlighted automatically
- **Purchase Tracking** — Record supplier purchases; stock increases automatically
- **Revenue Tracking** — Record sales; view today's revenue, total revenue, and unpaid totals on the Dashboard
- **Unpaid Customer Ledger** — Track credit sales per customer; mark as paid to clear the balance

---

## Getting Started

### Prerequisites

- Windows 10 or later
- [Node.js](https://nodejs.org/) (for development only)

### Install & Run (Development)

```bash
npm install
npm start
```

### Build Installer

```bash
npm run build
```

Output: `dist/InventoryManager-Setup.exe`

---

## Project Structure

```
Inventory Manager/
  index.html       Page structure and all modals
  app.js           All UI logic and localStorage operations
  style.css        All styles
  main.js          Electron main: window creation, auto-update
  preload.js       IPC bridge (checkUpdate, onUpdateResult)
  package.json     Electron + electron-builder config
  docs/
    PRD.md         Product requirements
    ARCHITECTURE.md  Code structure and data model
    DESIGN_SYSTEM.md  Colors, typography, components
```

---

## Data Storage

All data is stored in `localStorage` on the user's machine under namespaced keys:

| Key | Contents |
| --- | --- |
| `inv_products` | Product catalogue with stock levels |
| `inv_purchases` | Supplier purchase history |
| `inv_transactions` | Sales transaction history |
| `inv_customers` | Customer list |
| `inv_ledger` | Unpaid customer ledger entries |
| `inv_settings` | Shop name, address, GST, UPI |

No data is sent to any external server.

---

## Auto-Update

The app checks [GitHub Releases](https://github.com/Deepansri94/Inventory-Manager/releases) for updates. When a new release tagged `build-N` is found, the installer is downloaded to the user's Downloads folder and opened for installation.

---

## Docs

- [PRD](docs/PRD.md) — What the app does and what is out of scope
- [Architecture](docs/ARCHITECTURE.md) — Code structure, data model, boundaries
- [Design System](docs/DESIGN_SYSTEM.md) — Colors, typography, component specs
- [Security Checklist](SECURITY.md) — Pre-release security review
- [Validation Checklist](VALIDATE.md) — Pre-release code and UI review

---

## Known Limitations (v1)

- Data is not encrypted (stored in plain localStorage on the owner's machine)
- No code signing — Windows SmartScreen will show a warning on first run; click "Run anyway"
- Single machine only — no cloud sync or multi-device support
