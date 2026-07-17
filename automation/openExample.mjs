// Standalone Playwright automation script.
// This runs in Node.js (NOT in the Tauri webview), which is why it can use Playwright.
// It is compiled into a sidecar binary (see package.json "build:sidecar") and launched
// by the Rust `run_automation` command via the Tauri shell sidecar API.
//
// Usage: automation[.exe] [url] [downloadDir] [excel]
import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { parseCSV } from "./parsing.mjs";

const url = process.argv[2] || "https://www.example.com";
// Optional second arg: where to save the download. Defaults to the user's Downloads folder.
const downloadsDir = process.argv[3] || path.join(os.homedir(), "Downloads");
// Optional third arg: pass "excel" to open the finished CSV in Excel.
const openInExcel = process.argv[4] === "excel";

// Credentials come from env vars (set by the Rust command), not CLI args, so
// they don't leak into process listings or terminal logs.
const username = process.env.AUTOMATION_USERNAME ?? "";
const password = process.env.AUTOMATION_PASSWORD ?? "";

// Opens a file in Excel on Windows. `start` locates excel.exe via the registry.
function openInExcelApp(filePath) {
  return new Promise((resolve, reject) => {
    exec(`start "" excel "${filePath}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getDayString(numDays) {
  const date = new Date();
  date.setDate(date.getDate() + numDays);

  const year = String(date.getFullYear());
  const day = String(date.getDate());
  const month = String(date.getMonth() + 1);
  return month + "/" + day + "/" + year
}

async function main() {
  if (!username || !password) {
    throw new Error("Missing username or password.");
  }

  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  let savedPath;
  try {
    const page = await browser.newPage();
    await page.goto(url);

    await page.fill('input[name="j_username"]', username)
    await page.fill('input[name="j_password"]', password)
    await page.locator("a#greenButton").click();
    console.log(`Opened ${url}`);
    await page.locator("a#bannerFavButton_8").click();

    await page.locator('#topTenvisitedReportsList #OccupancySnapshotReport').click();

    // Enter start date and end date
    const startInput = page.locator('input[name="startDateCurrentFuture"]');
    const endInput = page.locator('input[name="endDateCurrentFuture"]')

    await startInput.clear();
    await endInput.clear();
    await startInput.fill(getDayString(0));
    await endInput.fill(getDayString(90));

    // check csv checkbox
    await page.locator('input[name="CSVcheckbox"]').check();

    // Download stuff
    const downloadPromise = page.waitForEvent("download")

    const submitButton = page.locator("a#doSubmit");
    await submitButton.click();
    const download = await downloadPromise;

    // Playwright saves downloads to a temp dir and deletes them on browser close,
    // so copy it into the real Downloads folder using the site's suggested filename.
    savedPath = path.join(downloadsDir, download.suggestedFilename());
    await download.saveAs(savedPath);
  } finally {
    // Close the browser BEFORE touching the file. While the browser is open,
    // Playwright holds handles to the download, which locks the file on Windows
    // ("resource busy or locked" / EBUSY) when parseCSV tries to overwrite it.
    await browser.close();
  }

  // Now that all Playwright handles are released, it's safe to modify the file.
  if (savedPath) {
    await parseCSV(savedPath);

    if (openInExcel) {
      await openInExcelApp(savedPath);
      console.log("Opened in Excel.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
