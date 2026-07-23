import { Link } from "react-router-dom";
import "./App.css";

function ReportBug() {
  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Report a bug</h1>
        <p className="subtitle">Work In Progress</p>
      </header>

      <section className="card">
        <Link to="/" className="secondary link-button">
          Back
        </Link>
      </section>
    </main>
  );
}

export default ReportBug;
