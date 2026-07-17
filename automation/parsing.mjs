import fs from "fs"
import Papa from "papaparse"

function getDayString(numDays) {
  const date = new Date();
  date.setDate(date.getDate() + numDays);

  const year = String(date.getFullYear());
  const day = String(date.getDate());
  const month = String(date.getMonth() + 1);
  return month + "/" + day + "/" + year
}

export function parseCSV(csvFilePath) {
    
    const rawCSV = fs.readFileSync(csvFilePath, "utf-8")

    const parsed = Papa.parse(rawCSV, {
        header: true,
        skipEmptyLines: true
    })

   const modifiedData = parsed.data.map(row => {
        return {
            "View Day": getDayString(0),
            IDS_DATE: row.IDS_DATE,
            Occupied: row.Occupied
        };
   })

   const finalCsvContent = Papa.unparse(modifiedData)

    fs.writeFileSync(csvFilePath, finalCsvContent, "utf-8");
    console.log("CSV file modified and saved!");
}