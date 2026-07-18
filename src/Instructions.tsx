import { Link } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import "./App.css";

const GOOGLE_URL = "https://support.google.com/chrome/answer/95346?hl=en&co=GENIE.Platform%3DDesktop"

function Instructions() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleLinkClick = async(e: React.MouseEvent<HTMLAnchorElement>, url: string): Promise<void> => {
    e.preventDefault();
    try {
      setErrorMessage(null);
      await openUrl(url);
    }
    catch (error) {
      setErrorMessage("Unable to open link");
    }
  }
  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Instructions</h1>
        <p className="subtitle">How to use the Hotel Reservation tool.</p>
      </header>

      <section className="card">
        <ol className="instructions-list">
          <li>Enter your username and password.</li>
          <li>Pick a start date (from up to a month ago through today).</li>
          <li>
            Choose an output option:
            <ul>
              <li>Create a new report.csv in a chosen folder, or</li>
              <li>Override an existing CSV file to append a new column.</li>
            </ul>
          </li>
          <li>Optionally enable "Open in Excel when done".</li>
          <li>Click "Run automation" and wait for it to finish.</li>
        </ol>

        <div className="message warning">
          IMPORTANT
          <ul>
            <li>Ensure that <a href={GOOGLE_URL} onClick={(e) => handleLinkClick(e, GOOGLE_URL)}>Google Chrome</a> is installed otherwise the program will not work</li>
            <li>Make sure to <strong>NOT</strong> open the report grid in Excel or any other CSV viewing software beforehand.</li>
          </ul>
        </div>

        {
          errorMessage && 
          <div>
            Unable to open link
          </div>
        }

        <Link to="/" className="secondary link-button">
          Back to home
        </Link>
      </section>
    </main>
  );
}

export default Instructions;
