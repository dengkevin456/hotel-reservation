import fs from "fs"
import Papa from "papaparse"
import { saveOrAppendGridData } from "./grid-parsing.mjs";

function getDayString(numDays) {
  const date = new Date();
  date.setDate(date.getDate() + numDays);

  const year = String(date.getFullYear());
  const day = String(date.getDate());
  const month = String(date.getMonth() + 1);
  return month + "/" + day + "/" + year
}

// Reads a freshly downloaded report CSV and returns a flat CSV string with the
// columns the grid builder expects: "View Day" (the snapshot's date), IDS_DATE, Occupied.
// viewDay defaults to today (M/D/YYYY) when not provided.
function toFlatCsv(downloadedCsvPath, viewDay) {
    const day = viewDay || getDayString(0);

    const rawCSV = fs.readFileSync(downloadedCsvPath, "utf-8")

    const parsed = Papa.parse(rawCSV, {
        header: true,
        skipEmptyLines: true
    })

    const modifiedData = parsed.data.map(row => {
        return {
            "View Day": day,
            IDS_DATE: row.IDS_DATE,
            Occupied: row.Occupied
        };
    })

    return Papa.unparse(modifiedData)
}

// New-report mode: build a fresh grid from the downloaded CSV under the given
// View Day column and write it back to that same file.
export function parseCSV(csvFilePath, viewDay) {
    const finalCsvContent = toFlatCsv(csvFilePath, viewDay)

    const gridContent = saveOrAppendGridData(null, finalCsvContent);

    fs.writeFileSync(csvFilePath, gridContent, "utf-8");
    console.log("CSV file modified and saved!");
}

// Override mode: append the downloaded CSV as a new "View Day" column into an
// existing grid file (csvGridPath), then write the merged grid back to that file.
export function appendCSV(csvFilePath, csvGridPath, viewDay) {
    const finalCsvContent = toFlatCsv(csvFilePath, viewDay)

    // Read the EXISTING grid file's *contents* (csvGridPath is a path, not CSV text)
    // so saveOrAppendGridData can merge the new column into it.
    const existingGrid = fs.existsSync(csvGridPath)
        ? fs.readFileSync(csvGridPath, "utf-8")
        : null;

    const gridContent = saveOrAppendGridData(existingGrid, finalCsvContent);

    // Write the merged grid back to the existing file the user chose to override.
    fs.writeFileSync(csvGridPath, gridContent, "utf-8");
    console.log("CSV file appended and saved!");
}
