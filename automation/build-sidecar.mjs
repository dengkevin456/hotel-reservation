// Builds the automation sidecar binary that Tauri launches via the shell sidecar API.
//
//   1. esbuild bundles openExample.mjs (+ parsing.mjs + papaparse) into one CJS file.
//      Playwright is left external and shipped through pkg's "scripts"/"assets" config
//      (see package.json) because its dynamic requires can't be statically bundled.
//   2. @yao-pkg/pkg compiles that bundle into a single executable named for the Rust
//      host target triple, which is what Tauri's externalBin expects.
//
// Run with: npm run build:sidecar
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "automation", "dist");
const bundlePath = path.join(distDir, "automation.cjs");
const binDir = path.join(root, "src-tauri", "binaries");

mkdirSync(distDir, { recursive: true });
mkdirSync(binDir, { recursive: true });

// 1. Determine the Rust host target triple; sidecars must be named <name>-<triple>.
const triple = execSync("rustc --print host-tuple").toString().trim();
const isWindows = triple.includes("windows");
const outPath = path.join(binDir, `automation-${triple}${isWindows ? ".exe" : ""}`);

// Map the triple to a pkg target (node<major>-<platform>-<arch>).
const platform = isWindows ? "win" : triple.includes("darwin") ? "macos" : "linux";
const arch = triple.startsWith("aarch64") ? "arm64" : "x64";
const pkgTarget = `node22-${platform}-${arch}`;

console.log(`Target triple: ${triple}  ->  pkg target: ${pkgTarget}`);

// pkg can't follow Playwright's dynamic `require(path.join(packageRoot, "browsers.json"))`,
// so browsers.json never gets embedded. Rewrite it to a literal relative require (the file
// is always at ../browsers.json relative to lib/coreBundle.js) so pkg bundles it. Idempotent.
console.log("\n[0/2] Patching playwright-core for pkg...");
const coreBundlePath = path.join(root, "node_modules", "playwright-core", "lib", "coreBundle.js");
const coreSrc = readFileSync(coreBundlePath, "utf8");
const patchedSrc = coreSrc.replace(
  /require\([A-Za-z0-9_$.]*\.join\(packageRoot,\s*"browsers\.json"\)\)/g,
  'require("../browsers.json")'
);
if (patchedSrc !== coreSrc) {
  writeFileSync(coreBundlePath, patchedSrc);
  console.log("  Patched browsers.json require -> literal.");
} else {
  console.log("  Already patched (or pattern not found).");
}

console.log("\n[1/2] Bundling with esbuild...");
execSync(
  [
    "npx esbuild",
    `"${path.join(root, "automation", "openExample.mjs")}"`,
    "--bundle --platform=node --format=cjs --target=node20",
    "--external:playwright --external:playwright-core",
    `--outfile="${bundlePath}"`,
  ].join(" "),
  { stdio: "inherit", cwd: root }
);

console.log(`\n[2/2] Compiling sidecar -> ${outPath}`);
execSync(
  `npx @yao-pkg/pkg "${bundlePath}" --targets ${pkgTarget} --output "${outPath}"`,
  { stdio: "inherit", cwd: root }
);

console.log(`\nDone. Sidecar built at:\n  ${outPath}`);
