# build-desktopEXE.md

Builds the Inventory Manager as a Windows `.exe` installer using GitHub Actions + electron-builder.
Every push to `main` triggers the workflow automatically. The installer is uploaded as a GitHub Release artifact.

---

## How it works

```
Push to main
    │
    ▼
GitHub Actions (windows-latest runner)
    │
    ├── npm install
    ├── Set version from run number (1.0.<run_number>)
    ├── electron-builder --win --x64
    │       └── produces dist/Inventory Manager Setup x.x.x.exe
    ├── Upload artifact → Actions tab (30-day retention)
    └── Create GitHub Release → tagged build-<run_number>
                └── attaches InventoryManager-Setup.exe
```

The auto-update in `main.js` polls the GitHub Releases API for a newer `build-*` tag and downloads the new `.exe` to the user's Downloads folder.

---

## One-time repository setup

1. Create a GitHub repository (e.g. `your-username/Inventory-Manager`).
2. Push this project folder to the `main` branch.
3. No extra secrets needed — the workflow uses the built-in `GITHUB_TOKEN`.
4. Make sure **Actions** are enabled: repository → Settings → Actions → Allow all actions.

---

## Workflow file

Create this file at `.github/workflows/build.yml` in the project root:

```yaml
name: Build Windows App

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

env:
  VERSION_CODE: ${{ github.run_number }}
  VERSION_NAME: '1.0.${{ github.run_number }}'

jobs:
  build:
    name: Build Inventory Manager Windows App
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Approve Electron install scripts
        run: |
          npm install-scripts approve electron@36.9.5
          npm install-scripts approve electron-winstaller@5.4.0

      - name: Set version in package.json
        shell: bash
        run: |
          node -e "
            const fs = require('fs');
            const p = JSON.parse(fs.readFileSync('package.json','utf8'));
            p.version = '${{ env.VERSION_NAME }}';
            fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
            console.log('Version set to:', p.version);
          "

      - name: Build Windows Installer
        run: npm run build
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Verify EXE was produced
        shell: bash
        run: |
          set -e
          EXE=$(find dist -name "*.exe" | head -1)
          if [ -z "$EXE" ]; then
            echo "ERROR: No .exe found in dist/"
            ls -lh dist/ || true
            exit 1
          fi
          echo "SUCCESS: $EXE"
          ls -lh "$EXE"

      - name: Prepare release artifact
        shell: bash
        run: |
          mkdir -p release
          cp dist/*.exe "release/InventoryManager-Setup.exe"
          ls -lh release/

      - name: Upload artifact (Actions tab)
        uses: actions/upload-artifact@v4
        with:
          name: Inventory-Manager-Windows
          path: release/InventoryManager-Setup.exe
          if-no-files-found: error
          retention-days: 30

      - name: Create GitHub Release and attach EXE
        shell: bash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: build-${{ env.VERSION_CODE }}
          RELEASE_NAME: Inventory Manager ${{ env.VERSION_NAME }}
        run: |
          set -e

          # Delete existing release/tag with the same name if it exists
          EXISTING_ID=$(curl -sS \
            -H "Authorization: Bearer ${GH_TOKEN}" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${TAG}" \
            | jq -r '.id // empty')

          if [ -n "$EXISTING_ID" ]; then
            curl -sS -X DELETE \
              -H "Authorization: Bearer ${GH_TOKEN}" \
              -H "Accept: application/vnd.github+json" \
              -H "X-GitHub-Api-Version: 2022-11-28" \
              "https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/${EXISTING_ID}"
            curl -sS -X DELETE \
              -H "Authorization: Bearer ${GH_TOKEN}" \
              -H "Accept: application/vnd.github+json" \
              -H "X-GitHub-Api-Version: 2022-11-28" \
              "https://api.github.com/repos/${GITHUB_REPOSITORY}/git/refs/tags/${TAG}"
          fi

          # Create new release
          RELEASE_RESPONSE=$(curl -sS -X POST \
            -H "Authorization: Bearer ${GH_TOKEN}" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            -H "Content-Type: application/json" \
            "https://api.github.com/repos/${GITHUB_REPOSITORY}/releases" \
            -d "$(jq -n \
              --arg tag "${TAG}" \
              --arg name "${RELEASE_NAME}" \
              '{tag_name:$tag,name:$name,body:"Automated build",draft:false,prerelease:false}')")

          UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | jq -r '.upload_url' | sed 's/{.*//')

          if [ -z "$UPLOAD_URL" ]; then
            echo "ERROR: Could not extract upload_url from release response"
            echo "$RELEASE_RESPONSE"
            exit 1
          fi

          # Upload EXE to the release
          curl -sS -X POST \
            -H "Authorization: Bearer ${GH_TOKEN}" \
            -H "Accept: application/vnd.github+json" \
            -H "Content-Type: application/octet-stream" \
            "${UPLOAD_URL}?name=InventoryManager-Setup.exe" \
            --data-binary @release/InventoryManager-Setup.exe

          echo "Release ${RELEASE_NAME} published successfully."
```

---

## How to download and install on a user machine

### Option A — From GitHub Actions (recommended during development)
1. Go to your repository → **Actions** tab
2. Click the latest **Build Windows App** run
3. Under **Artifacts**, download `Inventory-Manager-Windows.zip`
4. Extract the zip → run `InventoryManager-Setup.exe`
5. Follow the installer steps → a Desktop shortcut is created

### Option B — From GitHub Releases (recommended for distribution)
1. Go to your repository → **Releases**
2. Find the latest release (e.g. `Inventory Manager 1.0.42`)
3. Download `InventoryManager-Setup.exe` directly
4. Run the installer

---

## Version numbering

| Field | Value | Example |
| --- | --- | --- |
| `VERSION_CODE` | GitHub Actions run number (auto-increments) | `42` |
| `VERSION_NAME` | `1.0.<run_number>` | `1.0.42` |
| Git tag | `build-<run_number>` | `build-42` |

The auto-update in `main.js` compares the `build-*` tag number to the installed version's patch number to decide if an update is available.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails at `npm install` | Check `package.json` has correct `electron` version and `allowScripts` entries |
| No `.exe` in `dist/` | Check `electron-builder` config in `package.json` — `win.target` must be `nsis` |
| Release upload fails | Confirm repository **Actions** permissions are set to `Read and write` (Settings → Actions → General → Workflow permissions) |
| SmartScreen blocks installer on user machine | Expected for unsigned builds — user clicks "More info → Run anyway". Add code signing in v2 |
| Auto-update not detecting new version | Confirm `RELEASES_API` URL in `main.js` matches your actual GitHub repository name |
