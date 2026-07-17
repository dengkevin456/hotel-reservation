import Papa from 'papaparse';

// Helper: Safely parse "M/D/YYYY" strings into timestamps for chronological sorting
const toTimestamp = (dateStr) => {
    const [m, d, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
};

/**
 * Converts a flat CSV string into the initial pivot grid layout.
 */
export function convertToGrid(csvString) {
    const { data } = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    return rebuildGrid(data);
}

/**
 * Appends a new set of flat CSV data into an existing grid CSV string.
 * It dynamically grows the columns and rows without overwriting existing cells.
 */
export function appendGridData(existingGridCsv, newFlatCsv) {
    // 1. Parse the existing matrix grid back into standard rows
    const { data: gridRows } = Papa.parse(existingGridCsv, { skipEmptyLines: true });
    
    // Extract columns (headers) and rows from the existing grid
    const headerRow = gridRows[0] || [];
    const existingViewDays = headerRow.slice(1); // Skip the first empty corner cell

    // 2. Map existing grid back into our lookup map structure
    const lookup = new Map();
    const viewDays = new Set(existingViewDays);
    const idsDates = new Set();

    for (let i = 1; i < gridRows.length; i++) {
        const row = gridRows[i];
        const idsDate = row[0];
        idsDates.add(idsDate);

        const dateMap = new Map();
        existingViewDays.forEach((viewDay, index) => {
            const cellValue = row[index + 1];
            if (cellValue !== undefined && cellValue !== '') {
                dateMap.set(viewDay, cellValue);
            }
        });
        lookup.set(idsDate, dateMap);
    }

    // 3. Parse and merge the incoming new data
    const { data: newData } = Papa.parse(newFlatCsv, { header: true, skipEmptyLines: true });

    for (const row of newData) {
        const viewDay = row['View Day'];
        const idsDate = row['IDS_DATE'];
        const occupied = row['Occupied'];

        if (viewDay && idsDate) {
            viewDays.add(viewDay);
            idsDates.add(idsDate);

            if (!lookup.has(idsDate)) {
                lookup.set(idsDate, new Map());
            }
            // This updates existing data or inserts brand new intersections
            lookup.get(idsDate).set(viewDay, occupied);
        }
    }

    // 4. Rebuild the merged grid dynamically
    const flattenedMergedData = [];
    for (const idsDate of idsDates) {
        const dateMap = lookup.get(idsDate);
        for (const viewDay of viewDays) {
            if (dateMap.has(viewDay)) {
                flattenedMergedData.push({
                    'View Day': viewDay,
                    'IDS_DATE': idsDate,
                    'Occupied': dateMap.get(viewDay)
                });
            }
        }
    }

    return rebuildGrid(flattenedMergedData);
}

/**
 * Internal helper to sort data and structure the final CSV output
 */
function rebuildGrid(flatDataArray) {
    const viewDays = new Set();
    const idsDates = new Set();
    const lookup = new Map();

    for (const row of flatDataArray) {
        const viewDay = row['View Day'];
        const idsDate = row['IDS_DATE'];
        const occupied = row['Occupied'];

        viewDays.add(viewDay);
        idsDates.add(idsDate);

        if (!lookup.has(idsDate)) {
            lookup.set(idsDate, new Map());
        }
        lookup.get(idsDate).set(viewDay, occupied);
    }

    const sortedViewDays = [...viewDays].sort((a, b) => toTimestamp(a) - toTimestamp(b));
    const sortedIdsDates = [...idsDates].sort((a, b) => toTimestamp(a) - toTimestamp(b));

    const headerRow = ['', ...sortedViewDays];
    const gridRows = sortedIdsDates.map(idsDate => {
        const rowData = sortedViewDays.map(viewDay => {
            const dateMap = lookup.get(idsDate);
            return dateMap?.has(viewDay) ? dateMap.get(viewDay) : '';
        });
        return [idsDate, ...rowData];
    });

    return Papa.unparse([headerRow, ...gridRows]);
}


// --- EXAMPLE USAGE ---

const initialCsv = `View Day,IDS_DATE,Occupied
7/14/2026,7/14/2026,60
7/14/2026,7/15/2026,79`;

// Step 1: Create the initial Grid
const initialGrid = convertToGrid(initialCsv);
console.log("--- Initial Grid ---");
console.log(initialGrid);

// Step 2: New data comes in later (with a brand new column date & new row date)
const freshIncomingData = `View Day,IDS_DATE,Occupied
7/15/2026,7/15/2026,85
7/15/2026,7/16/2026,42`;

// Step 3: Append the new data seamlessly
const updatedGrid = appendGridData(initialGrid, freshIncomingData);
console.log("\n--- Updated/Appended Grid ---");
console.log(updatedGrid);