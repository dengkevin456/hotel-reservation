import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Make latest.json the single source of truth for the app version:
// edit "version" there, run this script, and every other file that
// carries a version string is rewritten to match.
//
// Usage (from the project root):  node scripts/sync-version.js

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Read the desired version from the source of truth.
const latestPath = path.join(root, 'latest.json');
const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
const version = latest.version;

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error(`latest.json "version" must be a semver like 1.2.3 (got: ${version})`);
}

// Helper: rewrite the top-level "version" field of a JSON file, preserving indentation.
function syncJsonVersion(relPath) {
  const filePath = path.join(root, relPath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.version = version;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ${relPath} -> ${version}`);
}

// 2. package.json + tauri.conf.json share the same simple JSON shape.
syncJsonVersion('package.json');
syncJsonVersion('src-tauri/tauri.conf.json');

// 3. Cargo.toml: replace only the [package] version, not any dependency versions.
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]*(")/,
  `$1${version}$2`
);
fs.writeFileSync(cargoPath, cargo);
console.log(`  src-tauri/Cargo.toml -> ${version}`);

// 4. Re-derive the download URL inside latest.json so it points at this version's release.
for (const platform of Object.values(latest.platforms ?? {})) {
  platform.url =
    `https://github.com/dengkevin456/hotel-reservation/releases/download/v${version}/myapp_${version}_x64-setup.exe`;
}
fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2) + '\n');
console.log(`  latest.json url -> v${version}`);

console.log(`\nSynced everything to version v${version}.`);
