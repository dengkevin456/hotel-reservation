import Papa from 'papaparse';

// Helper: Reduce any date string to a canonical "M/D/YYYY" (no leading zeros, and any
// surrounding weekday text or time component stripped off). The same calendar day can
// otherwise arrive formatted differently ("07/23/2026", "7/23/2026", "7/23/2026 0:00",
// "Thu 7/23/2026"); normalizing here keeps them a single row/column instead of creating
// a duplicate that sorts to the bottom.
const normalizeDate = (dateStr) => {
    const match = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!match) return String(dateStr).trim();
    const [, m, d, y] = match;
    // A 2-digit year (e.g. "26") would otherwise parse as year 26 AD, so expand it to 20xx.
    const year = y.length === 2 ? `20${y}` : y;
    return `${Number(m)}/${Number(d)}/${year}`;
};

// Helper: Safely parse date strings into timestamps for chronological sorting.
const toTimestamp = (dateStr) => {
    const [m, d, y] = normalizeDate(dateStr).split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
};

// Helper: Get the weekday name (e.g. "Tuesday") for a date string. Builds the date in
// UTC and reads it in UTC so the weekday is the calendar day itself, independent of the
// machine's timezone (mixing a local constructor with getUTCDay() shifts it by a day).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const toWeekday = (dateStr) => {
    const [m, d, y] = normalizeDate(dateStr).split('/').map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
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

    // 2. IF THE GRID EXISTS: First fix any stale/wrong weekday labels so the loaded grid
    // has each day matching the date in its first column, then parse it back to matrix rows.
    const correctedGridCsv = correctWeekdays(existingGridCsv);
    const { data: gridRows } = Papa.parse(correctedGridCsv, { skipEmptyLines: true });
    
    const headerRow = gridRows[0] || [];

    // Detect legacy grids that predate the weekday column. The weekday column (index 1)
    // only ever holds weekday names or an empty corner cell — never a date. So if any cell
    // in that column contains a slash, it's a real view-day/date column and this grid is
    // legacy: column 0 is the date and view-day data starts at column 1 (offset 1).
    // Otherwise the weekday column is present and data starts at column 2 (offset 2).
    const isLegacy = gridRows.some((row) => (row[1] ?? "").includes("/"));
    const dataOffset = isLegacy ? 1 : 2;

    // Normalize the column dates so a re-formatted same-day column merges instead of duplicating.
    const existingViewDays = headerRow.slice(dataOffset).map(normalizeDate); // Skip the corner cell(s)

    const lookup = new Map();
    const viewDays = new Set(existingViewDays);
    const idsDates = new Set();

    // Map existing grid back into our memory lookup structure
    for (let i = 1; i < gridRows.length; i++) {
        const row = gridRows[i];
        const idsDate = normalizeDate(row[0]);
        idsDates.add(idsDate);

        const dateMap = new Map();
        existingViewDays.forEach((viewDay, index) => {
            // Column 0 is the date; for the current format column 1 is the weekday label.
            const cellValue = row[index + dataOffset];
            if (cellValue !== undefined && cellValue !== '') {
                dateMap.set(viewDay, cellValue);
            }
        });
        lookup.set(idsDate, dateMap);
    }

    // 3. Parse and merge the incoming new flat data
    const { data: newData } = Papa.parse(newFlatCsv, { header: true, skipEmptyLines: true });

    for (const row of newData) {
        const viewDay = normalizeDate(row['View Day']);
        const idsDate = normalizeDate(row['Date']);
        const occupied = row['Occupied'];

        if (row['View Day'] && row['Date']) {
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
                    'Date': idsDate,
                    'Occupied': dateMap.get(viewDay)
                });
            }
        }
    }


    return rebuildGrid(flattenedMergedData);
}

/**
 * Corrects the weekday column (column 1) of an existing grid so each row's weekday
 * matches the date in column 0. Useful when a grid was hand-edited or produced before
 * the weekday logic was fixed, leaving a stale/wrong day beside a date.
 * @param {string|null|undefined} gridCsv - The current grid CSV string.
 * @returns {string} The grid CSV with every weekday recomputed from its date.
 */
export function correctWeekdays(gridCsv) {
    if (!gridCsv || gridCsv.trim() === "") {
        return gridCsv ?? "";
    }

    const { data: gridRows } = Papa.parse(gridCsv, { skipEmptyLines: true });

    // Legacy grids (see saveOrAppendGridData) have no weekday column: column 1 holds a
    // real view-day date. There's nothing to correct there, so return the grid unchanged.
    const isLegacy = gridRows.some((row) => (row[1] ?? "").includes("/"));
    if (isLegacy) {
        return Papa.unparse(gridRows);
    }

    // Row 0 is the header (empty corner cells); data rows start at index 1.
    const corrected = gridRows.map((row, i) => {
        if (i === 0 || !row[0]) return row;
        const fixed = [...row];
        fixed[1] = toWeekday(row[0]);
        return fixed;
    });

    return Papa.unparse(corrected);
}

/**
 * Utility helper to sort data chronologically and build the final CSV grid format.
 */
function rebuildGrid(flatDataArray) {
    const viewDays = new Set();
    const idsDates = new Set();
    const lookup = new Map();

    for (const row of flatDataArray) {
        const viewDay = normalizeDate(row['View Day']);
        const idsDate = normalizeDate(row['Date']);
        const occupied = row['Occupied'];

        viewDays.add(viewDay);
        idsDates.add(idsDate);

        if (!lookup.has(idsDate)) {
            lookup.set(idsDate, new Map());
        }
        lookup.get(idsDate).set(viewDay, occupied);
    }

    const sortedViewDays = [...viewDays]
        //.filter(withinRange)
        .sort((a, b) => toTimestamp(a) - toTimestamp(b));
    const sortedIdsDates = [...idsDates]
        // .filter(withinRange)
        .sort((a, b) => toTimestamp(a) - toTimestamp(b));

    // Two empty corner cells: one above the date column, one above the weekday column.
    const headerRow = ['', '', ...sortedViewDays];
    const gridRows = sortedIdsDates.map(idsDate => {
        const rowData = sortedViewDays.map(viewDay => {
            const dateMap = lookup.get(idsDate);
            return dateMap?.has(viewDay) ? dateMap.get(viewDay) : '';
        });
        return [idsDate, toWeekday(idsDate), ...rowData];
    });

    return Papa.unparse([headerRow, ...gridRows]);
}