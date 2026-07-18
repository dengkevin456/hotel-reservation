// Standalone Playwright automation script.
// This runs in Node.js (NOT in the Tauri webview), which is why it can use Playwright.
// It is compiled into a sidecar binary (see package.json "build:sidecar") and launched
// by the Rust `run_automation` command via the Tauri shell sidecar API.
//
// Usage: automation[.exe] [url] [downloadDir] [excel] [overrideCsvPath] [startingDate]
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { parseCSV, appendCSV } from "./parsing.mjs";

const url = process.argv[2] || "https://www.example.com";
// Optional second arg: where to save the download. Defaults to the user's Downloads folder.
const downloadsDir = process.argv[3] || path.join(os.homedir(), "Downloads");
// Optional third arg: pass "excel" to open the finished CSV in Excel.
const openInExcel = process.argv[4] === "excel";
// Optional fourth arg: an existing grid CSV to append into (override mode). When set,
// we append the fresh download into this file instead of creating a new report.csv.
const overrideCsvPath = process.argv[5] || "";
// Optional fifth argument: the starting date ("YYYY-MM-DD"); empty means today.
const startingDate = process.argv[6] || "";

// Credentials come from env vars (set by the Rust command), not CLI args, so
// they don't leak into process listings or terminal logs.
const username = process.env.AUTOMATION_USERNAME ?? "";
const password = process.env.AUTOMATION_PASSWORD ?? "";

// Returns a path that doesn't clash with an existing file. If "report.csv" exists,
// returns "report(1).csv", then "report(2).csv", and so on.
function getUniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  let counter = 1;
  let candidate;
  do {
    candidate = path.join(dir, `${base}(${counter})${ext}`);
    counter++;
  } while (fs.existsSync(candidate));

  return candidate;
}

// Opens a file in Excel on Windows. `start` locates excel.exe via the registry.
function openInExcelApp(filePath) {
  return new Promise((resolve, reject) => {
    exec(`start "" excel "${filePath}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getDayString(numDays, startingDate) {
  // startingDate is a "YYYY-MM-DD" string (from the date picker) or empty for today.
  // Parse it into local Y/M/D components so we don't hit the UTC off-by-one that
  // `new Date("YYYY-MM-DD")` causes.
  let date;
  if (startingDate) {
    const [y, m, d] = startingDate.split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date();
  }
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

    // getByText(...) returns a Locator (always truthy), so we must actually query
    const currentUrl = page.url();
    if (currentUrl.includes("j_security_check")) {
        throw new Error("Invalid Credentials");
    }

    await page.locator("a#bannerFavButton_8").click();

    await page.locator('#topTenvisitedReportsList #OccupancySnapshotReport').click();

    // Enter start date and end date
    const startInput = page.locator('input[name="startDateCurrentFuture"]');
    const endInput = page.locator('input[name="endDateCurrentFuture"]')

    await startInput.clear();
    await endInput.clear();
    await startInput.fill(getDayString(0, startingDate));
    await endInput.fill(getDayString(90, startingDate));

    // check csv checkbox
    await page.locator('input[name="CSVcheckbox"]').check();

    // Download stuff
    const downloadPromise = page.waitForEvent("download")

    const submitButton = page.locator("a#doSubmit");
    await submitButton.click();
    const download = await downloadPromise;

    // Playwright saves downloads to a temp dir and deletes them on browser close, so
    // copy it out. In override mode the download is just an intermediate, so stash it in
    // the OS temp dir; otherwise save it into the chosen Downloads folder.
    if (overrideCsvPath) {
      savedPath = path.join(os.tmpdir(), download.suggestedFilename());
    } else {
      // New-report mode: don't overwrite an existing file — fall back to
      // report(1).csv, report(2).csv, ... when the name is already taken.
      savedPath = getUniquePath(path.join(downloadsDir, download.suggestedFilename()));
    }
    await download.saveAs(savedPath);
  } finally {
    // Close the browser BEFORE touching the file. While the browser is open,
    // Playwright holds handles to the download, which locks the file on Windows
    // ("resource busy or locked" / EBUSY) when parseCSV tries to overwrite it.
    await browser.close();
  }

  // Now that all Playwright handles are released, it's safe to modify the file.
  if (savedPath) {
    // The grid column ("View Day") is the snapshot's start date, so each start
    // date the user picks becomes its own column. Formatted as M/D/YYYY to match
    // the grid's date format.
    const viewDay = getDayString(0, startingDate);

    // Override mode -> append into the chosen existing grid file.
    // New-report mode -> build a fresh grid in the downloaded file.
    if (overrideCsvPath) {
      appendCSV(savedPath, overrideCsvPath, viewDay);
    } else {
      parseCSV(savedPath, viewDay);
    }

    if (openInExcel) {
      const fileToOpen = overrideCsvPath || savedPath;
      await openInExcelApp(fileToOpen);
      console.log("Opened in Excel.");
    }
  }
}

main().catch((error) => {
  // Full error (with stack) to the terminal for debugging.
  console.error(error);
  // Also emit a single machine-readable line that the Rust command parses and
  // forwards to the app's red error box, so the UI shows a clean message.
  console.log(`USER_ERROR:${error.message}`);
  process.exit(1);
});
