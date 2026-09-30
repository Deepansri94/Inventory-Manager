# SECURITY.md

Security review checklist. Run through every item before pushing to `main` or handing the build to a user.
If any item fails, fix it before proceeding. Do not ship with open items.

---

## 01 Secrets and credentials

- [ ] No API keys, tokens, passwords, or UPI credentials are hardcoded in any `.js`, `.html`, or `.json` file.
- [ ] `package.json` contains no private registry tokens or auth fields.
- [ ] `.gitignore` excludes `node_modules/`, `dist/`, `release/`, and any `.env` files.
- [ ] GitHub Actions workflows use `${{ secrets.GITHUB_TOKEN }}` only — no personal access tokens committed.
- [ ] No `console.log` statements print sensitive user data (names, phone numbers, balances).

**How to check:**
```
grep -r "password\|token\|secret\|apikey\|api_key" --include="*.js" --include="*.json" --include="*.html" .
```
Expected result: zero matches outside of `node_modules/`.

---

## 02 Data storage

- [ ] All user data is stored in `localStorage` on the user's own machine. No data is sent to any external server.
- [ ] No `fetch()` or `XMLHttpRequest` calls in `app.js` point to external URLs (the only allowed external call is the GitHub Releases API in `main.js` for auto-update).
- [ ] localStorage keys are namespaced (`inv_products`, `inv_customers`, etc.) to avoid collisions with other apps.

**How to check:**
```
grep -n "fetch\|XMLHttpRequest\|axios" app.js
```
Expected result: zero matches.

---

## 03 Electron security

- [ ] `nodeIntegration: false` is set in all `BrowserWindow` `webPreferences`.
- [ ] `contextIsolation: true` is set in all `BrowserWindow` `webPreferences`.
- [ ] `preload.js` only exposes the minimum required API (`checkUpdate`, `onUpdateResult`). No `require`, `fs`, or `shell` is exposed to the renderer.
- [ ] `setWindowOpenHandler` returns `{ action: 'deny' }` for all popup attempts — external URLs open in the system browser via `shell.openExternal`, not inside Electron.
- [ ] `setMenuBarVisibility(false)` is set so users cannot access DevTools via the menu in production.
- [ ] No `webSecurity: false` anywhere in the codebase.

**How to check — scan main.js and preload.js:**
```
grep -n "nodeIntegration\|contextIsolation\|webSecurity\|enableRemoteModule" main.js preload.js
```
Expected: `nodeIntegration: false`, `contextIsolation: true`, no `webSecurity: false`.

---

## 04 Input validation

- [ ] Customer phone number is validated as 10 digits before saving (`/^\d{10}$/`).
- [ ] Product price and stock fields are validated as valid numbers before saving.
- [ ] Purchase and sale quantities are validated as positive integers before saving.
- [ ] No user input is passed to `eval()`, `innerHTML` without sanitisation, or `document.write()`.

**How to check:**
```
grep -n "eval\|document\.write\|innerHTML" app.js
```
Review each `innerHTML` hit — confirm it only uses data from `localStorage` (data the user themselves entered), not from any external source.

---

## 05 Auto-update security

- [ ] The GitHub Releases API URL in `main.js` points to the correct repository (`Deepansri94/Inventory-Manager`).
- [ ] The downloaded `.exe` is saved to the user's `Downloads` folder and opened via `shell.openPath` — it is not executed programmatically.
- [ ] HTTP redirects in `httpsGet` strip custom headers (Authorization) before following to S3 or CDN URLs, preventing credential leakage.

---

## 06 Build artefact

- [ ] The `files` array in `package.json` `build` config excludes `.git/` and any local dev files.
- [ ] No `node_modules` from the dev machine are bundled — `electron-builder` installs production deps fresh during the build.
- [ ] The final `.exe` is signed (recommended for v2 — unsigned EXEs trigger Windows SmartScreen warnings on first run).

---

## 07 Dependency audit

Run before every release:
```
npm audit
```
- [ ] Zero `critical` severity vulnerabilities.
- [ ] Zero `high` severity vulnerabilities in runtime dependencies (devDependency highs are acceptable if they do not affect the built app).

To fix automatically:
```
npm audit fix
```
Only use `--force` if you have reviewed what it changes.

---

## 08 Pre-ship smoke test

- [ ] Install the `.exe` on a clean Windows machine (not the dev machine).
- [ ] App opens without errors or missing file dialogs.
- [ ] Add a product, record a purchase, record a sale, mark a customer unpaid then paid — all data persists after closing and reopening the app.
- [ ] No DevTools console errors on normal use.
- [ ] Windows Defender / antivirus does not block the installer (if it does, code signing is required).

---

## Known accepted risks

| Risk | Reason accepted | Mitigation |
| --- | --- | --- |
| Data stored in localStorage (no encryption) | App runs on the owner's private machine | Acceptable for v1; encrypt in v2 if multi-user |
| No code signing on the EXE | Cost and complexity for v1 | User must click "Run anyway" on SmartScreen once |
| Auto-update downloads over HTTPS but does not verify checksum | GitHub CDN is trusted | Add SHA256 verification in v2 |
