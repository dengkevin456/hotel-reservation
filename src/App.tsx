import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { load, Store } from "@tauri-apps/plugin-store";
import "./App.css";

// Formats a Date as a local "YYYY-MM-DD" string for <input type="date"> (min/max/value).
function toDateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function App() {
  // Initialize navigator
  const navigate = useNavigate();
  // Allowed start-date window: from one month ago up to today (no future dates).
  const todayStr = toDateInputValue(new Date());
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = toDateInputValue(oneMonthAgo);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadPath, setDownloadPath] = useState("");
  const [openInExcel, setOpenInExcel] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // "new" = create a new report.csv in a chosen folder; "override" = overwrite a chosen file.
  const [mode, setMode] = useState<"new" | "override">("override");
  const [csvFilePath, setCsvFilePath] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  // Live clock shown in the footer, refreshed every second.
  const [now, setNow] = useState(() => new Date());

  // Storing the file path
  const storeRef = useRef<Store>(null);

  // Initialize the download path (if saved)
  useEffect(() => {
    let isMounted = true;

    async function initStore() {
      try {
        // Load settings file
        const store = await load("settings.json", {autoSave: true});
        if (!isMounted) return;
        storeRef.current = store;
        
        const downloadValueCache = await store.get<string>("download-cache");
        const csvValueCache = await store.get<string>("csv-cache");
        if (isMounted) {
            if (downloadValueCache) setDownloadPath(downloadValueCache);
            if (csvValueCache) setCsvFilePath(csvValueCache);
        }
      }
      catch (error: any) {
        setErrorMessage(typeof error === "string" ? error : error.message || "An error occured");
      }
    }

    initStore();

    return () => {
      isMounted = false;
    };
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function chooseFolder() {
    const selected = await open({ directory: true, title: "Choose download folder" });
    // `open` returns null if the dialog is cancelled.
    if (typeof selected === "string") {
      setDownloadPath(selected);
      if (storeRef.current) await storeRef.current.set("download-cache", selected);
    }
  }

  async function updateApp() {
    if (import.meta.env.DEV) {
      setErrorMessage("Running in development mode!");
      return;
    }
    setIsUpdating(true);
    try {
      const update = await check();
      if (update) {
          setSuccessMessage(`Update available: ${update.version}. Downloading…`);
          await update.downloadAndInstall();
          // The update is only applied once the running app exits and the
          // installer swaps the files, so relaunch to boot into the new version.
          setSuccessMessage(`Updated to ${update.version}. Restarting…`);
          await relaunch();
      } else {
          setSuccessMessage("You're already on the latest version.");
      }
    }
    catch (error: any) {
      setErrorMessage(
        typeof error === "string"
          ? error
          : error.message || "An unknown automation error occurred"
      );
    }
    finally {
      setIsUpdating(false);
    }
  }

  async function chooseCsvFile() {
    const selected = await open({
      title: "Choose CSV file to override",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (typeof selected === "string") {
      setCsvFilePath(selected);
      if (storeRef.current) await storeRef.current.set("csv-cache", selected);
    }
  }

  async function run() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage("Please enter a username and password.");
      return;
    }

    if (mode === "override") {
      if (!csvFilePath) {
        setErrorMessage("Please choose a CSV file to override.");
        return;
      }
      const isExisting = await invoke('check_path_exists', {path: csvFilePath});
      if (!isExisting) {
        setErrorMessage("The specified path doesn't exist!");
        return;
      }
    }

    // Guard the date in case it was typed outside the allowed one-month window.
    if (!startDate || startDate < oneMonthAgoStr || startDate > todayStr) {
      setErrorMessage("Start date must be between one month ago and today.");
      return;
    }

    setIsLoading(true);
    try {
      // The Playwright automation runs in Node via the Rust `run_automation` command.
      // New mode: an empty downloadPath falls back to the default Downloads folder.
      // Override mode: send the chosen file path and no download folder.
      await invoke("run_automation", {
        url: "https://www.choiceadvantage.com/choicehotels/sign_in.jsp",
        downloadPath: mode === "new" ? downloadPath.trim() || null : null,
        csvFilePath: mode === "override" ? csvFilePath : null,
        startDate,
        openInExcel,
        username: username.trim(),
        password,
      });
      // Only reached if the command resolved without throwing.
      setSuccessMessage("CSV modified and saved!");
    }
    catch (error: any) {
      setErrorMessage(
        typeof error === "string"
          ? error
          : error.message || "An unknown automation error occurred"
      );
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Hotel Reservation</h1>
        <p className="subtitle">
          Download the occupancy report and process it into a CSV.
        </p>
        <Link to="/instructions" className="subtitle-link">
          View instructions
        </Link>
      </header>

      <section className="card">
        <label className="field" htmlFor="username-input">
          <span className="field-label">Username</span>
          <input
            id="username-input"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </label>

        <label className="field" htmlFor="password-input">
          <span className="field-label">Password</span>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </label>

        <label className="field" htmlFor="start-date-input">
          <span className="field-label">Start date</span>
          <input
            id="start-date-input"
            type="date"
            value={startDate}
            min={oneMonthAgoStr}
            max={todayStr}
            onChange={(e) => setStartDate(e.currentTarget.value)}
          />
        </label>

        <div className="field">
          <label className="radio">
            <input
              type="radio"
              name="mode"
              checked={mode === "new"}
              onChange={() => setMode("new")}
            />
            <span>Create a new report.csv file</span>
          </label>
          <div className="field-row">
            <input
              id="download-path-input"
              value={downloadPath}
              onChange={(e) => setDownloadPath(e.currentTarget.value)}
              placeholder="Leave blank for your Downloads folder"
              disabled={mode !== "new"}
            />
            <button
              type="button"
              className="secondary"
              onClick={chooseFolder}
              disabled={mode !== "new"}
            >
              Choose folder
            </button>
          </div>
        </div>

        <div className="field">
          <label className="radio">
            <input
              type="radio"
              name="mode"
              checked={mode === "override"}
              onChange={() => setMode("override")}
            />
            <span>Override the contents of an existing CSV file</span>
          </label>
          <div className="field-row">
            <input
              value={csvFilePath}
              id="persist-input"
              readOnly
              placeholder="No file selected"
              disabled={mode !== "override"}
            />
            <button
              type="button"
              className="secondary"
              onClick={chooseCsvFile}
              disabled={mode !== "override"}
            >
              Choose file
            </button>
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={openInExcel}
            onChange={(e) => setOpenInExcel(e.currentTarget.checked)}
          />
          <span>Open in Excel when done</span>
        </label>

        <button className="primary" onClick={run} disabled={isLoading}>
          {isLoading ? "Running…" : "Run automation"}
        </button>

        <button type="button" className="danger" onClick={() => navigate("/report")}>
          Report a bug
        </button>

        <button
          type="button"
          className="secondary"
          onClick={updateApp}
          disabled={isLoading || isUpdating || import.meta.env.DEV}
        >
          {isUpdating ? "Updating…" : "Check for Updates"}
        </button>

        {errorMessage && <div className="message error">{errorMessage}</div>}
        {successMessage && <div className="message success">{successMessage}</div>}
      </section>

      <footer className="footer">
        <p>© {now.getFullYear()} Hotel Reservation. All rights reserved.</p>
        <p>{now.toLocaleString()}</p>
      </footer>
    </main>
  );
}

export default App;
