import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Instructions from "./Instructions";
import DarkMode from "./DarkMode";
import ReportBug from "./ReportBug";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DarkMode />
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/report" element={<ReportBug />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
