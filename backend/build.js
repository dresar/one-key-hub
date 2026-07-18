/**
 * build.js — Cross-platform build script for One Key Hub Backend
 * Works on Windows (cPanel), Linux, macOS.
 * Run: node build.js
 * Output: app.js (single bundled file)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building One Key Hub Backend...\n');

try {
  // Run tsup (use .cmd on Windows for node_modules/.bin executables)
  const isWindows = process.platform === 'win32';
  const tsupBin = path.join(__dirname, 'node_modules', '.bin', isWindows ? 'tsup.cmd' : 'tsup');

  execSync(
    `"${tsupBin}" src/index.ts --format cjs --out-dir dist_tmp --minify --no-splitting`,
    { stdio: 'inherit', cwd: __dirname }
  );

  // Copy output to app.js
  const src = path.join(__dirname, 'dist_tmp', 'index.js');
  const dest = path.join(__dirname, 'app.js');

  if (!fs.existsSync(src)) {
    throw new Error('Build output not found at dist_tmp/index.js');
  }

  fs.copyFileSync(src, dest);
  fs.rmSync(path.join(__dirname, 'dist_tmp'), { recursive: true, force: true });

  const size = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`\n✅ Build complete: app.js (${size} KB)`);
  console.log('\nTo deploy to cPanel, upload:');
  console.log('  📦 package.json');
  console.log('  ⚙️  .env');
  console.log('  🚀 app.js');
  console.log('\nThen run: npm install --production');
  console.log('Entry point: app.js\n');
} catch (err) {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
}
