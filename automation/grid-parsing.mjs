import Papa from 'papaparse';

// Helper: Safely parse "M/D/YYYY" strings into timestamps for chronological sorting
const toTimestamp = (dateStr) => {
    const [m, d, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
};

function daysFromToday(startStr) {
  const [m, d, y] = startStr.split("/").map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - start) / 86400000);
}

/**
 * Creates a new grid OR appends to an existing grid if one is provided.
 * @param {string|null|undefined} existingGridCsv - The current grid CSV string (or empty value).
 * @param {string} newFlatCsv - The new raw/flat CSV data coming in.
 * @returns {string} The fully updated grid in CSV format.
 */
export function saveOrAppendGridData(existingGridCsv, newFlatCsv) {
    // 1. IF THE GRID DOESN'T EXIST: Just generate a fresh grid from the incoming flat data.
    if (!existingGridCsv || existingGridCsv.trim() === "") {
        const { data: newData } = Papa.parse(newFlatCsv, { header: true, skipEmptyLines: true });
        return rebuildGrid(newData);
    }

    // 2. IF THE GRID EXISTS: Parse it back to matrix rows so we can append to it.
    const { data: gridRows } = Papa.parse(existingGridCsv, { skipEmptyLines: true });
    
    const headerRow = gridRows[0] || [];
    const existingViewDays = headerRow.slice(1); // Skip the first empty corner cell

    const lookup = new Map();
    const viewDays = new Set(existingViewDays);
    const idsDates = new Set();

    // Map existing grid back into our memory lookup structure
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

    // 3. Parse and merge the incoming new flat data
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
            lookup.get(idsDate).set(viewDay, occupied);
        }
    }

    // 4. Flatten the merged lookup maps back into standard objects for the rebuilding utility
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
 * Utility helper to sort data chronologically and build the final CSV grid format.
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

    // Drop any View Day column or IDS_DATE row that is more than 90 days in the PAST.
    // Future dates are always kept (daysFromToday is negative for future dates), so
    // this only prunes stale old dates, never upcoming ones.
    const withinRange = (dateStr) => daysFromToday(dateStr) <= 90;

    const sortedViewDays = [...viewDays]
        //.filter(withinRange)
        .sort((a, b) => toTimestamp(a) - toTimestamp(b));
    const sortedIdsDates = [...idsDates]
        // .filter(withinRange)
        .sort((a, b) => toTimestamp(a) - toTimestamp(b));

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