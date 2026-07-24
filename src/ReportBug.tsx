import { Link } from "react-router-dom";
import "./App.css";
import "./ReportBug.css";
import { useState } from "react";

function ReportBug() {
  const [notWorking, showNotWorking] = useState(false);

  const showMessage = () => {
      showNotWorking(true);
      setTimeout(() => {
        showNotWorking(false);
      }, 3000);
  }

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Report a bug</h1>
        <p className="subtitle">Describe the problem you ran into.</p>
      </header>

      <section className="card">
        <label className="field" htmlFor="bug-description">
          <span className="field-label">Description</span>
          <textarea
            id="bug-description"
            className="bug-textarea"
            placeholder="What happened? What did you expect to happen?"
            rows={8}
          />
        </label>

        <button type="button" onClick={showMessage} className="submit-bug">
          Submit Bug
        </button>

        {
          notWorking && <p className="coming-soon">Coming Soon</p>
        }

        <Link to="/" className="secondary link-button">
          Back
        </Link>
      </section>
    </main>
  );
}

export default ReportBug;
