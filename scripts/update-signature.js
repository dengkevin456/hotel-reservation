import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Post-build step: after `tauri build` has bundled the installer and produced its
// updater signature (.sig), copy that signature into latest.json and stamp a fresh
// pub_date. Run this AFTER the build finishes (see build.bat) — the .sig file does
// not exist until the bundling phase completes.
//
// Usage (from the project root):  node scripts/update-signature.js

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Read latest.json — its version tells us which installer/.sig was produced.
const latestPath = path.join(root, 'latest.json');
const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
const version = latest.version;

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error(`latest.json "version" must be a semver like 1.2.3 (got: ${version})`);
}

// 2. The Windows NSIS updater artifact Tauri writes for this version.
const sigPath = path.join(
  root,
  'src-tauri', 'target', 'release', 'bundle', 'nsis',
  `hotel-reservation_${version}_x64-setup.exe.sig`
);

if (!fs.existsSync(sigPath)) {
  throw new Error(
    `Signature file not found: ${sigPath}\n` +
    `Did the build finish? This script must run after "tauri build".`
  );
}

const signature = fs.readFileSync(sigPath, 'utf8').trim();

// 3. Update the signature for the Windows platform and stamp the publish time.
if (!latest.platforms || !latest.platforms['windows-x86_64']) {
  throw new Error('latest.json is missing platforms["windows-x86_64"].');
}

latest.platforms['windows-x86_64'].signature = signature;
latest.pub_date = new Date().toISOString();

fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2) + '\n');

console.log(`Updated latest.json for v${version}:`);
console.log(`  signature -> ${sigPath}`);
console.log(`  pub_date  -> ${latest.pub_date}`);
