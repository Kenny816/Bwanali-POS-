#!/bin/bash
# ============================================================================
# Bwanali POS – Add Windows EXE Build Configuration
# Run this script from inside your project root (where package.json is)
# ============================================================================
set -e

if [[ ! -f package.json ]]; then
    echo "❌ package.json not found. Please run this script from your project root."
    exit 1
fi

echo "🔧 Adding Electron and GitHub Actions configuration..."

# ----------------------------------------------------------------------------
# 1. Create electron.js (Electron main process)
# ----------------------------------------------------------------------------
cat > electron.js << 'EOF2'
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the built React app
  mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
EOF2
echo "✅ electron.js created."

# ----------------------------------------------------------------------------
# 2. Update package.json – add main, scripts, build config, devDependencies
# ----------------------------------------------------------------------------
echo "📝 Updating package.json..."

# Backup original
cp package.json package.json.bak

# Use sed to patch package.json
# Add main field
sed -i 's/^{$/{\n  "main": "electron.js",/' package.json

# Add scripts if they don't exist
if ! grep -q '"electron":' package.json; then
    sed -i '/"scripts": {/a \    "electron": "electron .",\n    "dist": "npm run build && electron-builder",' package.json
fi

# Add build configuration at the end before the closing }
if ! grep -q '"build":' package.json; then
    sed -i '$ s/}$/,\n  "build": {\n    "appId": "com.bwanali.pos",\n    "productName": "Bwanali POS",\n    "directories": { "output": "dist" },\n    "win": { "target": "nsis" }\n  }\n}/' package.json
fi

# Add devDependencies if they don't exist
if ! grep -q '"electron":' package.json; then
    sed -i '/"devDependencies": {/a \    "electron": "^28.0.0",\n    "electron-builder": "^24.0.0",' package.json
fi

echo "✅ package.json updated (backup saved as package.json.bak)."

# ----------------------------------------------------------------------------
# 3. Create GitHub Actions workflow
# ----------------------------------------------------------------------------
mkdir -p .github/workflows
cat > .github/workflows/build-exe.yml << 'EOF2'
name: Build Windows EXE

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:  # Allows manual trigger

jobs:
  build:
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build React app
        run: npm run build

      - name: Build Windows EXE
        run: npx electron-builder --win --publish never

      - name: Upload EXE artifact
        uses: actions/upload-artifact@v4
        with:
          name: Bwanali-POS-Setup
          path: dist/*.exe
EOF2
echo "✅ GitHub Actions workflow created at .github/workflows/build-exe.yml"

# ----------------------------------------------------------------------------
# 4. Install Electron dependencies locally
# ----------------------------------------------------------------------------
read -p "Do you want to install Electron and electron-builder locally now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install --save-dev electron electron-builder
    echo "✅ Electron dependencies installed."
fi

# ----------------------------------------------------------------------------
# 5. Summary
# ----------------------------------------------------------------------------
echo ""
echo "🎉 Configuration complete!"
echo ""
echo "📦 Next steps:"
echo "1. Commit and push the changes to GitHub:"
echo "   git add ."
echo "   git commit -m 'Add Electron and GitHub Actions for Windows EXE build'"
echo "   git push"
echo ""
echo "2. Go to your GitHub repository → Actions tab"
echo "   The workflow 'Build Windows EXE' will start automatically."
echo ""
echo "3. After the build finishes, download the EXE installer from the Artifacts section."
echo ""
echo "💡 To test locally: npm run build && npm run electron"
